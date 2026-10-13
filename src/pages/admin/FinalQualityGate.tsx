import { useState, useEffect, useCallback, useRef } from 'react'
import { BadgeCheck, CheckCircle2, RotateCcw, CheckSquare, Sparkles, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Gate items with unique string IDs ──
const GATES = [
  { id: 'build_pass', label: 'Build passes (npm run build)' },
  { id: 'admin_auth', label: 'Admin login/logout OK' },
  { id: 'public_site', label: 'Public site OK without forced login' },
  { id: 'stock_bill', label: 'Stock in + bill deduct OK' },
  { id: 'payment_ledger', label: 'Payment ledger OK' },
  { id: 'farmer_portal', label: 'Farmer portal no WA history' },
  { id: 'error_panel', label: 'Problems panel 0 errors' },
] as const

const STORAGE_KEY = 'satguru_quality_gate_checks_v1'

export default function FinalQualityGate() {
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // LocalStorage Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(on))
    } catch (e) {
      console.error('Failed to save quality gate state', e)
    }
  }, [on])

  const doneCount = GATES.filter((g) => !!on[g.id]).length
  const totalCount = GATES.length
  const percent = Math.round((doneCount / totalCount) * 100)
  const isReady = doneCount === totalCount

  // Handlers
  const toggleGate = useCallback((id: string) => {
    setOn((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const selectAll = useCallback(() => {
    const allChecked: Record<string, boolean> = {}
    GATES.forEach((g) => {
      allChecked[g.id] = true
    })
    setOn(allChecked)
    toast.success('All Quality Gates marked as passed')
  }, [])

  const resetAll = useCallback(() => {
    if (window.confirm('Reset all Final Quality Gate sign-off progress?')) {
      setOn({})
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Safe catch
      }
      toast.success('Quality Gate progress reset completed')
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BadgeCheck className="text-amber-400" size={28} /> Final Quality Gate
          </h1>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-800/80 rounded-full border border-emerald-700 font-mono">
            {percent}% Complete
          </span>
        </div>

        <p className="text-emerald-200 text-xs flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          {doneCount}/{totalCount} Checks Passed {isReady ? '· READY FOR PRODUCTION USE' : ''}
        </p>

        {/* Animated Progress Bar */}
        <div className="w-full bg-emerald-950/60 rounded-full h-2.5 overflow-hidden border border-emerald-800">
          <div
            className="bg-amber-400 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-between text-xs font-bold px-1">
        <button
          type="button"
          onClick={selectAll}
          className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 transition-colors"
          aria-label="Select all quality gates"
        >
          <CheckSquare size={14} /> Select All
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 transition-colors"
          aria-label="Reset all quality gates"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Checklist Box */}
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden"
        role="list"
        aria-label="Final quality gate criteria"
      >
        {GATES.map((g) => {
          const checked = !!on[g.id]
          return (
            <div
              key={g.id}
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              onClick={() => toggleGate(g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleGate(g.id)
                }
              }}
              className={`flex items-center gap-3.5 p-4 text-xs font-semibold cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                checked ? 'bg-emerald-50/50 text-emerald-950' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleGate(g.id)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                aria-label={g.label}
              />
              <span className={`flex-1 ${checked ? 'line-through text-slate-400 font-normal' : 'font-bold'}`}>
                {g.label}
              </span>
              {checked && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Ready Banner */}
      {isReady && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl text-center font-black text-emerald-900 shadow-lg shadow-emerald-500/10 flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300 text-xs">
          <Sparkles className="text-amber-500 animate-bounce" size={24} />
          <span>✅ QUALITY GATE PASSED — SATGURU BEEJ BHANDAR SYSTEM READY FOR PRODUCTION</span>
        </div>
      )}
    </div>
  )
}