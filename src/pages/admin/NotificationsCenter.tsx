// src/pages/admin/NotificationsCenter.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Bell,
  Send,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Strict TypeScript Interfaces
export interface FarmerInfo {
  farmer_name: string | null
  farmer_id: string | null
  mobile: string | null
}

export interface NotificationRow {
  id: string
  farmer_id: string | null
  notification_type: string
  title: string
  message: string
  channel: string | null
  status: 'pending' | 'sent' | 'failed' | string
  created_at: string
  sent_at: string | null
  farmer: FarmerInfo | null
}

export type FilterStatus = 'all' | 'pending' | 'sent' | 'failed'

interface NotificationsQueryItem {
  id: string
  farmer_id: string | null
  notification_type: string | null
  title: string | null
  message: string | null
  channel: string | null
  status: string | null
  created_at: string
  sent_at: string | null
  farmer: FarmerInfo | FarmerInfo[] | null
}

function normalizeFarmer(
  farmer: FarmerInfo | FarmerInfo[] | null | undefined
): FarmerInfo | null {
  if (!farmer) return null
  if (Array.isArray(farmer)) return farmer[0] || null
  return farmer
}

function normalizeNotification(item: NotificationsQueryItem): NotificationRow {
  return {
    id: item.id,
    farmer_id: item.farmer_id ?? null,
    notification_type: item.notification_type || 'General',
    title: item.title || 'Untitled',
    message: item.message || '',
    channel: item.channel ?? null,
    status: item.status || 'pending',
    created_at: item.created_at,
    sent_at: item.sent_at ?? null,
    farmer: normalizeFarmer(item.farmer),
  }
}

export default function NotificationsCenter() {
  const { role, loading: authLoading } = useAuth()

  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const abortRef = useRef<AbortController | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    if (role !== 'admin') return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      if (controller.signal.aborted) return

      let q = supabase
        .from('notifications')
        .select(
          `
          id,
          farmer_id,
          notification_type,
          title,
          message,
          channel,
          status,
          created_at,
          sent_at,
          farmer:farmers(farmer_name, farmer_id, mobile)
        `
        )
        .order('created_at', { ascending: false })
        .limit(200)

      if (filter !== 'all') {
        q = q.eq('status', filter)
      }

      const { data, error } = await q

      if (controller.signal.aborted || !isMounted.current) return
      if (error) throw error

      const normalizedData: NotificationRow[] = (
        (data || []) as NotificationsQueryItem[]
      ).map(normalizeNotification)

      setRows(normalizedData)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('NotificationsCenter load failed:', err)
      if (isMounted.current) {
        toast.error('Failed to load notifications. Please try again.')
      }
    } finally {
      if (!controller.signal.aborted && isMounted.current) {
        setLoading(false)
      }
    }
  }, [filter, role])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') {
      setLoading(false)
      return
    }
    void load()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load, role, authLoading])

  const markSent = async (id: string) => {
    if (role !== 'admin') {
      toast.error('Aapke paas is action ki anumati nahi hai.')
      return
    }
    if (!id || actionLoading[id]) return

    setActionLoading((prev) => ({ ...prev, [id]: true }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const now = new Date().toISOString()

      // Only flip pending → sent (prevents clobbering failed/sent)
      const { data: updated, error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: now })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (updateError) throw updateError

      if (!updated) {
        toast.error('Notification already processed or not found.')
        await load()
        return
      }

      const { error: logError } = await supabase.from('notification_logs').insert([
        { notification_id: id, channel: 'manual', status: 'sent' },
      ])

      if (logError) {
        console.warn('Failed to insert notification_log record:', logError.message)
      }

      toast.success('Marked as sent')

      if (isMounted.current) {
        setRows((prevRows) =>
          prevRows.map((r) =>
            r.id === id ? { ...r, status: 'sent', sent_at: now } : r
          )
        )
      }

      // Background refresh to stay aligned with server/filter
      void load()
    } catch (err: unknown) {
      console.error('markSent failed:', err)
      if (isMounted.current) {
        toast.error('Failed to mark as sent. Please try again.')
      }
    } finally {
      if (isMounted.current) {
        setActionLoading((prev) => ({ ...prev, [id]: false }))
      }
    }
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas notifications center ki anumati nahi hai.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="text-amber-400" size={28} /> Notifications Center
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Due / Overdue / Bill / Payment reminders (Pending → Sent)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || authLoading}
          aria-label="Refresh notifications"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter Options */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'sent', 'failed'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            disabled={authLoading}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === s
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 font-medium">
        Showing latest 200 notifications{filter !== 'all' ? ` · filter: ${filter}` : ''}.
      </p>

      {/* Notifications Table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label="Notifications list">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase">
                <th scope="col" className="p-3">
                  Farmer
                </th>
                <th scope="col" className="p-3">
                  Type
                </th>
                <th scope="col" className="p-3">
                  Title / Message
                </th>
                <th scope="col" className="p-3">
                  Channel
                </th>
                <th scope="col" className="p-3">
                  Status
                </th>
                <th scope="col" className="p-3 text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-800" />
                      Loading notifications...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No notifications found.
                  </td>
                </tr>
              ) : (
                rows.map((n) => {
                  const isItemLoading = !!actionLoading[n.id]
                  return (
                    <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">
                          {n.farmer?.farmer_name || '—'}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {n.farmer?.farmer_id || 'N/A'}
                          {n.farmer?.mobile ? ` | ${n.farmer.mobile}` : ''}
                        </p>
                      </td>
                      <td className="p-3 font-bold text-emerald-800">
                        {n.notification_type}
                      </td>
                      <td className="p-3 max-w-xs">
                        <p className="font-bold text-gray-900">{n.title}</p>
                        <p className="text-gray-500 truncate" title={n.message}>
                          {n.message}
                        </p>
                      </td>
                      <td className="p-3 uppercase">{n.channel || 'in_app'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                            n.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : n.status === 'failed'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {n.status === 'pending' ? (
                          <button
                            type="button"
                            disabled={isItemLoading || authLoading}
                            onClick={() => void markSent(n.id)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center gap-1 mx-auto transition-colors"
                          >
                            {isItemLoading ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Send size={12} />
                            )}
                            {isItemLoading ? 'Saving...' : 'Mark Sent'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}