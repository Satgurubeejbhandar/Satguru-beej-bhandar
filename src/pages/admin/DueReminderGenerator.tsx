// src/pages/admin/DueReminderGenerator.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Megaphone, Play, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

type ReminderResult = {
  due: number
  overdue: number
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

export default function DueReminderGenerator() {
  const { role, loading: authLoading } = useAuth()
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<ReminderResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const runGenerator = async () => {
    if (role !== 'admin') return

    setRunning(true)
    setResult(null)
    setError(null)

    try {
      // High-performance DB RPC execution (1 Single Network Call)
      const { data, error: rpcError } = await supabase.rpc('generate_due_reminders')

      if (rpcError) throw rpcError

      const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

      const reminderStats: ReminderResult = {
        due: safeNum(raw.due ?? raw.p_due),
        overdue: safeNum(raw.overdue ?? raw.p_overdue),
      }

      if (isMountedRef.current) {
        setResult(reminderStats)

        if (reminderStats.due === 0 && reminderStats.overdue === 0) {
          toast('No new reminders to generate for today', { icon: 'ℹ️' })
        } else {
          toast.success(
            `Reminders generated! Due Soon: ${reminderStats.due}, Overdue: ${reminderStats.overdue}`
          )
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate reminders'
      if (isMountedRef.current) {
        setError(msg)
        toast.error('Generator Run Failed: ' + msg)
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
        <p className="text-sm text-gray-600">Aapke paas Due Reminder Generator की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="text-amber-400" size={28} /> Due Reminder Generator
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Auto-creates pending notification logs (WhatsApp / SMS engine triggers)
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" /> {error}
          </span>
          <button onClick={runGenerator} className="underline hover:text-rose-950 font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Action Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 text-center">
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          Scans accounts with outstanding balance &gt; 0. Generates in-app reminders for accounts due within 30 days and overdue accounts.{' '}
          <span className="block text-slate-400 mt-1 font-semibold">
            *Safe execution: Duplicate reminders for today are automatically skipped.
          </span>
        </p>

        <button
          type="button"
          disabled={running}
          onClick={runGenerator}
          className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 cursor-pointer"
        >
          {running ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generating Reminders...
            </>
          ) : (
            <>
              <Play size={18} /> Generate Reminders
            </>
          )}
        </button>

        {/* Results Summary */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Generator Run Complete
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 font-sans">
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  Due Soon (30 Days)
                </span>
                <span className="text-base font-black text-slate-900 font-mono">{result.due}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  Overdue Notices
                </span>
                <span className="text-base font-black text-rose-600 font-mono">{result.overdue}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}