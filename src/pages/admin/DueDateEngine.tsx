// src/pages/admin/DueDateEngine.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { CalendarClock, Play, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

type EngineResult = {
  assigned: number
  refreshed: number
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

export default function DueDateEngine() {
  const { role, loading: authLoading } = useAuth()
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<EngineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const runEngine = async () => {
    if (role !== 'admin') return

    setRunning(true)
    setResult(null)
    setError(null)

    try {
      // Calls the high-performance PostgreSQL RPC Function
      const { data, error: rpcError } = await supabase.rpc('run_due_date_engine')

      if (rpcError) throw rpcError

      const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

      const engineStats: EngineResult = {
        assigned: safeNum(raw.assigned ?? raw.p_assigned),
        refreshed: safeNum(raw.refreshed ?? raw.p_refreshed),
      }

      if (isMountedRef.current) {
        setResult(engineStats)
        toast.success(
          `Engine Complete! Assigned: ${engineStats.assigned}, Refreshed: ${engineStats.refreshed}`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Engine execution failed'
      if (isMountedRef.current) {
        setError(msg)
        toast.error('Engine Run Failed: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setRunning(false)
      }
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Due Date Engine की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="text-amber-400" size={28} /> Due Date Engine
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Auto-assign missing due dates &amp; refresh remaining days in bulk (Database Powered)
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" /> {error}
          </span>
          <button onClick={runEngine} className="underline hover:text-rose-950 font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Action Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-5 shadow-sm">
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          Executes bulk calculation across all credit accounts. Sets{' '}
          <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold font-mono">
            due_date = today + repayment_days
          </code>{' '}
          for unassigned active accounts and recalculates days remaining.
        </p>

        <button
          type="button"
          disabled={running}
          onClick={runEngine}
          className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 cursor-pointer"
        >
          {running ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing Database...
            </>
          ) : (
            <>
              <Play size={18} /> Run Due Date Engine
            </>
          )}
        </button>

        {/* Results Display */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Engine Run Successful
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 font-sans">
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  New Due Dates Set
                </span>
                <span className="text-base font-black text-slate-900 font-mono">{result.assigned}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  Accounts Refreshed
                </span>
                <span className="text-base font-black text-slate-900 font-mono">{result.refreshed}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}