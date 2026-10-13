// src/pages/admin/RateOverrideLogs.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { IndianRupee, RefreshCw, Search, ShieldAlert, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface AuditLogEntry {
  id: string
  created_at: string
  action: string
  entity_type: string | null
  entity_id: string | null
  reason: string | null
  performed_by: string | null 
  metadata?: Record<string, any> | null 
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

function formatAuditTimestamp(isoString: string): string {
  if (!isoString) return '—'
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return isoString
  }
}

function getActionBadgeStyle(action: string): string {
  const normalized = action.toUpperCase()
  if (normalized.includes('OVERRIDE')) {
    return 'bg-rose-50 text-rose-700 border border-rose-200'
  }
  if (normalized.includes('RATE')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
  if (normalized.includes('DELETE') || normalized.includes('VOID')) {
    return 'bg-red-50 text-red-700 border border-red-200'
  }
  return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RateOverrideLogs() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchText, setSearchText] = useState<string>('')
  const isMountedRef = useRef<boolean>(true)

  const loadLogs = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .or('action.ilike.%RATE%,action.ilike.%OVERRIDE%,action.ilike.%BILL%')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      if (isMountedRef.current) {
        setRows((data as AuditLogEntry[]) || [])
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const errorMessage = err instanceof Error ? err.message : 'Audit log retrieval failed'
      toast.error(errorMessage)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadLogs()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [loadLogs, role, authLoading])

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((r) => {
      const action = (r.action || '').toLowerCase()
      const entity = (r.entity_type || '').toLowerCase()
      const reason = (r.reason || '').toLowerCase()
      return action.includes(query) || entity.includes(query) || reason.includes(query)
    })
  }, [rows, searchText])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Rate / Bill Audit Logs देखने की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="text-amber-400" size={28} aria-hidden="true" />
            Rate / Bill Audit Slice
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Real-time operations tracking filtered for rate alterations &amp; overrides
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          aria-label="Refresh audit logs"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Local Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="text-slate-400 shrink-0" size={18} aria-hidden="true" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter logs by Action, Entity or Reason..."
          aria-label="Filter audit logs"
          className="flex-1 outline-none text-sm font-semibold text-slate-800 bg-transparent outline-none"
        />
        {filteredRows.length !== rows.length && (
          <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 font-bold shrink-0">
            Found {filteredRows.length} of {rows.length}
          </span>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" role="table" aria-label="Audit log records">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5 w-12 text-center">#</th>
                <th scope="col" className="p-3.5">Time (IST)</th>
                <th scope="col" className="p-3.5">Action</th>
                <th scope="col" className="p-3.5">Entity Type</th>
                <th scope="col" className="p-3.5">Reason / Override Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-800" />
                    <span>Loading audit history...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                      {formatAuditTimestamp(r.created_at)}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${getActionBadgeStyle(r.action)}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {r.entity_type || '—'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs sm:max-w-md truncate" title={r.reason || ''}>
                      {r.reason ? (
                        <div className="flex items-start gap-1.5">
                          {r.action.toUpperCase().includes('OVERRIDE') && (
                            <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={14} />
                          )}
                          <span className="leading-relaxed font-bold">{r.reason}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No override reason provided</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}