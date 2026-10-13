// src/pages/admin/AuditLogsViewer.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ShieldCheck, RefreshCw, Search, X, Eye, AlertCircle, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id?: string | number | null
  user_role?: string | null
  reason?: string | null
  performed_by?: string | null
  created_at: string
}

export default function AuditLogsViewer() {
  const { role, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const isMounted = useRef<boolean>(true)

  // ── Load Audit Logs from Supabase Client ─────────────────────────────────

  const loadLogs = useCallback(async () => {
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
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Audit logs लोड करने में समस्या आई'
      if (isMounted.current) {
        setError(msg)
        toast.error(msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      loadLogs()
    }

    return () => {
      isMounted.current = false
    }
  }, [loadLogs, role, authLoading])

  // Performance Optimization: Memoized filter logic
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return logs

    return logs.filter((l) => {
      const action = (l.action || '').toLowerCase()
      const entity = (l.entity_type || '').toLowerCase()
      const reason = (l.reason || '').toLowerCase()
      const userRole = (l.user_role || '').toLowerCase()
      const id = String(l.entity_id || '').toLowerCase()
      return (
        action.includes(query) ||
        entity.includes(query) ||
        reason.includes(query) ||
        userRole.includes(query) ||
        id.includes(query)
      )
    })
  }, [search, logs])

  // Helper for safe Indian Date & Time (Asia/Kolkata) formatting
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

  // Action badge colors helper
  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toUpperCase()
    if (act.includes('DELETE') || act.includes('VOID') || act.includes('CANCEL') || act.includes('REVOKE')) {
      return 'bg-rose-100 text-rose-800 border-rose-200'
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('INSERT')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CHANGE') || act.includes('OVERRIDE')) {
      return 'bg-amber-100 text-amber-800 border-amber-200'
    }
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Audit Logs dekhne ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-amber-400" size={28} /> Audit Logs
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Immutable Audit Trail — Farmer ID reset, bills voiding, stock write-offs & settings (IST Kolkata Time)
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-800 text-xs font-bold">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="text-gray-400 shrink-0" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, entity, role, reason, or entity ID..."
          className="flex-1 outline-none text-sm font-medium bg-transparent"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]" aria-label="System Audit Logs">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5">Time (IST)</th>
                <th scope="col" className="p-3.5">Action</th>
                <th scope="col" className="p-3.5">Entity</th>
                <th scope="col" className="p-3.5">Role</th>
                <th scope="col" className="p-3.5">Reason / Details</th>
                <th scope="col" className="p-3.5 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    <RefreshCw className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
                    Loading audit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                      {formatDate(l.created_at)}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] border inline-block ${getActionBadgeClass(
                          l.action
                        )}`}
                      >
                        {l.action}
                      </span>
                    </td>

                    <td className="p-3.5 text-gray-800">
                      <span className="font-bold">{l.entity_type}</span>
                      {l.entity_id ? (
                        <span className="block text-[10px] text-gray-400 font-mono mt-0.5">
                          ID: {String(l.entity_id).slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>

                    <td className="p-3.5">
                      <span className="uppercase text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {l.user_role || 'ADMIN'}
                      </span>
                    </td>

                    <td
                      className="p-3.5 text-gray-600 max-w-xs truncate"
                      title={l.reason || undefined}
                    >
                      {l.reason || '—'}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
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
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h2 className="text-lg font-black text-emerald-950">Audit Log Details</h2>
                <p className="text-xs text-gray-500 font-mono">{formatDate(selectedLog.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-500">Action:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getActionBadgeClass(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-500">Entity Type:</span>
                <span className="font-bold text-gray-900">{selectedLog.entity_type}</span>
              </div>

              {selectedLog.entity_id && (
                <div className="flex justify-between border-b pb-2">
                  <span className="font-bold text-gray-500">Entity ID:</span>
                  <span className="font-mono text-gray-800 break-all">{String(selectedLog.entity_id)}</span>
                </div>
              )}

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-500">User Role:</span>
                <span className="font-bold text-emerald-800 uppercase">{selectedLog.user_role || 'ADMIN'}</span>
              </div>

              <div>
                <span className="font-bold text-gray-500 block mb-1">Reason / Description:</span>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {selectedLog.reason || 'No description recorded.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}