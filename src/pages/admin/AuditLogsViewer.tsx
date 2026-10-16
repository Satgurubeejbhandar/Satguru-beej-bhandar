// src/pages/admin/AuditLogsViewer.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  ShieldCheck,
  RefreshCw,
  Search,
  X,
  Eye,
  AlertCircle,
  ShieldAlert,
  Copy,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id?: string | number | null
  user_role?: string | null
  reason?: string | null
  performed_by?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  created_at: string
}

export default function AuditLogsViewer() {
  const { role, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const isMounted = useRef(true)

  const loadLogs = useCallback(
    async (isManualRefresh = false) => {
      if (role !== 'admin') return
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300)

        if (fetchError) throw fetchError

        if (isMounted.current) {
          setLogs((data as AuditLog[]) || [])
          setLastRefreshed(new Date())
          if (isManualRefresh) toast.success('Audit logs refreshed')
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Audit logs लोड करने में समस्या आई'
        if (isMounted.current) {
          setError(msg)
          if (isManualRefresh) toast.error(msg)
        }
      } finally {
        if (isMounted.current) setLoading(false)
      }
    },
    [role]
  )

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      void loadLogs()
    }
    return () => {
      isMounted.current = false
    }
  }, [loadLogs, role, authLoading])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return logs

    return logs.filter((l) => {
      const action = (l.action || '').toLowerCase()
      const entity = (l.entity_type || '').toLowerCase()
      const reason = (l.reason || '').toLowerCase()
      const userRole = (l.user_role || '').toLowerCase()
      const performedBy = (l.performed_by || '').toLowerCase()
      const id = String(l.entity_id || '').toLowerCase()
      return (
        action.includes(query) ||
        entity.includes(query) ||
        reason.includes(query) ||
        userRole.includes(query) ||
        performedBy.includes(query) ||
        id.includes(query)
      )
    })
  }, [search, logs])

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    } catch {
      return '—'
    }
  }

  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toUpperCase()
    if (['DELETE', 'VOID', 'CANCEL', 'REVOKE', 'REMOVE'].some((k) => act.includes(k))) {
      return 'bg-rose-100 text-rose-800 border-rose-200'
    }
    if (['CREATE', 'ADD', 'INSERT', 'NEW', 'PAYMENT', 'STOCK_IN'].some((k) => act.includes(k))) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    if (['UPDATE', 'EDIT', 'CHANGE', 'OVERRIDE', 'MODIFY', 'STOCK_OUT', 'STOCK_ADJUST'].some((k) => act.includes(k))) {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }
    if (['LOGIN', 'LOGOUT', 'AUTH', 'PIN', 'SESSION'].some((k) => act.includes(k))) {
      return 'bg-purple-100 text-purple-800 border-purple-200'
    }
    if (['EXPORT', 'SETTINGS', 'STATUS'].some((k) => act.includes(k))) {
      return 'bg-amber-100 text-amber-900 border-amber-200'
    }
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  const handleCopyId = (id: string) => {
    void navigator.clipboard.writeText(id)
    setCopiedId(true)
    toast.success('ID copied to clipboard')
    setTimeout(() => {
      if (isMounted.current) setCopiedId(false)
    }, 2000)
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-3xl border border-rose-200 text-center space-y-3 shadow-sm">
        <ShieldAlert className="inline-block text-rose-600" size={40} />
        <h1 className="text-xl font-black text-rose-700 uppercase tracking-wide">
          Access Denied
        </h1>
        <p className="text-sm text-slate-600 font-medium">
          आपके पास Audit Logs देखने की अनुमति नहीं है। यह क्षेत्र केवल System
          Administrators के लिए है।
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 tracking-tight">
            <ShieldCheck className="text-amber-400 shrink-0" size={32} />
            System Audit Logs
          </h1>
          <p className="text-emerald-200 text-xs sm:text-sm mt-1.5 font-medium max-w-xl">
            Immutable security trail — voids, payments, PIN resets, stock changes,
            overrides (IST).
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadLogs(true)}
            disabled={loading}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Fetching Logs...' : 'Refresh Logs'}
          </button>
          {lastRefreshed && (
            <span className="text-[10px] text-emerald-300 font-mono flex items-center gap-1">
              <Clock size={10} />
              {lastRefreshed.toLocaleTimeString('en-IN', { hour12: true })}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-800 text-xs font-bold shadow-sm">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
        <Search className="text-slate-400 shrink-0 ml-1" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, entity, reason, role, email, or ID..."
          className="flex-1 outline-none text-sm font-semibold text-slate-800 bg-transparent placeholder-slate-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]" aria-label="System Audit Logs">
            <thead>
              <tr className="bg-emerald-900 text-white font-black uppercase tracking-wider text-[10px]">
                <th scope="col" className="p-4">Time (IST)</th>
                <th scope="col" className="p-4">Action</th>
                <th scope="col" className="p-4">Entity</th>
                <th scope="col" className="p-4">Role</th>
                <th scope="col" className="p-4">Performed By</th>
                <th scope="col" className="p-4">Reason / Details</th>
                <th scope="col" className="p-4 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 font-bold bg-slate-50/50">
                    <RefreshCw className="animate-spin inline-block mr-2 text-emerald-600" size={18} />
                    Loading secure audit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck size={32} className="text-slate-300" />
                      <span>
                        {search
                          ? 'No logs match your search criteria.'
                          : 'No audit logs recorded yet. Actions will appear after logAudit() is wired.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatDate(l.created_at)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md font-black text-[10px] border tracking-wide uppercase ${getActionBadgeClass(
                          l.action
                        )}`}
                      >
                        {l.action}
                      </span>
                    </td>

                    <td className="p-4 text-slate-800">
                      <span className="font-extrabold text-[12px] block">{l.entity_type}</span>
                      {l.entity_id != null && l.entity_id !== '' && (
                        <span
                          className="text-[10px] text-slate-400 font-mono mt-0.5 block truncate max-w-[140px]"
                          title={String(l.entity_id)}
                        >
                          {String(l.entity_id)}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className="uppercase text-[9px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        {l.user_role || 'ADMIN'}
                      </span>
                    </td>

                    <td className="p-4 text-[11px] text-slate-600 font-mono max-w-[160px] truncate" title={l.performed_by || undefined}>
                      {l.performed_by || '—'}
                    </td>

                    <td
                      className="p-4 text-slate-600 max-w-xs truncate font-semibold"
                      title={l.reason || undefined}
                    >
                      {l.reason || <span className="text-slate-300 italic">—</span>}
                    </td>

                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(l)}
                        className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors mx-auto block opacity-80 group-hover:opacity-100"
                        title="View Full Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 p-3 text-center text-[10px] font-bold text-slate-500">
          Showing latest <span className="text-emerald-700">{filtered.length}</span> records
          {search ? ' (filtered)' : ''} · max 300
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-emerald-950 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={24} />
                  Log Detail
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {formatDate(selectedLog.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Action
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md font-black text-[10px] border uppercase ${getActionBadgeClass(
                    selectedLog.action
                  )}`}
                >
                  {selectedLog.action}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                  Entity Type
                </span>
                <span className="font-black text-slate-900">{selectedLog.entity_type}</span>
              </div>

              {selectedLog.entity_id != null && selectedLog.entity_id !== '' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                      Entity ID
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(String(selectedLog.entity_id))}
                      className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 text-[10px] font-bold bg-emerald-100 px-2 py-1 rounded-lg transition-colors"
                    >
                      {copiedId ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                      {copiedId ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <div className="font-mono text-slate-800 text-xs break-all bg-white p-2 rounded border border-slate-200">
                    {String(selectedLog.entity_id)}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">
                  User Role
                </span>
                <span className="font-black text-emerald-800 uppercase text-xs bg-emerald-100 px-2 py-0.5 rounded-md">
                  {selectedLog.user_role || 'ADMIN'}
                </span>
              </div>

              {selectedLog.performed_by && (
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-2">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider shrink-0">
                    Performed By
                  </span>
                  <span className="font-mono text-xs text-slate-800 truncate">
                    {selectedLog.performed_by}
                  </span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider block mb-2">
                  Reason / Description
                </span>
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed font-medium text-xs max-h-32 overflow-y-auto">
                  {selectedLog.reason || (
                    <span className="text-slate-400 italic">No description recorded.</span>
                  )}
                </div>
              </div>

              {(selectedLog.old_data || selectedLog.new_data) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg overflow-auto max-h-36">
                    <p className="font-bold text-rose-700 mb-1">BEFORE</p>
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLog.old_data || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg overflow-auto max-h-36">
                    <p className="font-bold text-emerald-700 mb-1">AFTER</p>
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLog.new_data || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-sm transition-all active:scale-[0.98] shadow-md"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  )
}