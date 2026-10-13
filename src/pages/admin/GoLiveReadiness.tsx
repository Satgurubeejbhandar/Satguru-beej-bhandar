import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Flag,
  CheckCircle2,
  RotateCcw,
  CheckSquare,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Structured Items with Category & Unique IDs ──
const ITEMS = [
  { id: 'supabase_rls', label: 'Supabase project + RLS enabled', category: 'Security & DB' },
  { id: 'admin_role', label: 'Admin user in Auth + profiles.role=admin', category: 'Security & DB' },
  { id: 'storage_private', label: 'Storage buckets private (docs/bills)', category: 'Security & DB' },
  { id: 'company_product', label: 'At least 1 company + 1 product added', category: 'Master Data' },
  { id: 'stock_in_rates', label: 'Stock-in tested with selling rate', category: 'Inventory' },
  { id: 'farmer_pin_login', label: 'Farmer create + PIN login tested', category: 'Farmers' },
  { id: 'bill_stock_deduct', label: 'Bill creation + stock deduct tested', category: 'Billing' },
  { id: 'payment_ledger', label: 'Payment collection + ledger tested', category: 'Finance' },
  { id: 'farmer_wa_history', label: 'Farmer WhatsApp history absent/clean', category: 'Privacy' },
  { id: 'alerts_checked', label: 'Expiry + low stock alerts checked', category: 'Alerts' },
  { id: 'backup_csv', label: 'Backup/export CSV export tried', category: 'Data Safety' },
  { id: 'e2e_green', label: 'E2E checklist mostly green', category: 'Quality' },
] as const

const STORAGE_KEY = 'satguru_golive_readiness_state_v1'

export default function GoLiveReadiness() {
  const [on, setOn] = useState<Record<string, boolean>>(() => {
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
      console.error('Failed to persist go-live readiness', e)
    }
  }, [on])

  const score = useMemo(() => ITEMS.filter((item) => !!on[item.id]).length, [on])
  const total = ITEMS.length
  const pct = Math.round((score / total) * 100)
  const isReady = score === total

  const toggleItem = useCallback((id: string) => {
    setOn((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const selectAll = useCallback(() => {
    const allChecked: Record<string, boolean> = {}
    ITEMS.forEach((item) => {
      allChecked[item.id] = true
    })
    setOn(allChecked)
    toast.success('All Go-Live readiness checks marked as completed')
  }, [])

  const resetAll = useCallback(() => {
    if (window.confirm('Reset all Go-Live Readiness checklist progress?')) {
      setOn({})
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Safe catch
      }
      toast.success('Go-Live readiness progress reset completed')
    }
  }, [])

  // Dynamic Bar Color based on completion %
  const getProgressColor = () => {
    if (pct < 40) return 'bg-rose-500'
    if (pct < 85) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="text-amber-400" size={28} /> Go-Live Readiness
          </h1>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border font-mono ${
              isReady
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {pct}% Ready
          </span>
        </div>

        <p className="text-emerald-200 text-xs flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Score: {score}/{total} Checks Completed {isReady ? '· SYSTEM READY FOR DEPLOYMENT' : ''}
        </p>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-emerald-950/60 rounded-full h-2.5 overflow-hidden border border-emerald-800">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center justify-between text-xs font-bold px-1">
        <button
          type="button"
          onClick={selectAll}
          className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 transition-colors"
          aria-label="Select all readiness items"
        >
          <CheckSquare size={14} /> Select All
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1.5 text-slate-400 hover:text-rose-600 transition-colors"
          aria-label="Reset all readiness items"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Items Checklist Box */}
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-2"
        role="list"
        aria-label="Go-live readiness items"
      >
        {ITEMS.map((item) => {
          const checked = !!on[item.id]

          return (
            <div
              key={item.id}
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              onClick={() => toggleItem(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleItem(item.id)
                }
              }}
              className={`flex items-center justify-between gap-3 p-3 rounded-2xl text-xs font-semibold cursor-pointer transition-all border focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                checked
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                  : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  aria-label={item.label}
                />
                <span className={checked ? 'line-through text-slate-400 font-normal' : 'font-bold text-slate-800'}>
                  {item.label}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                  {item.category}
                </span>
                {checked && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* 100% Celebration Banner */}
      {isReady && (
        <div className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white rounded-2xl text-center font-black shadow-lg shadow-emerald-500/20 flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300 text-xs">
          <Sparkles className="text-amber-300 animate-bounce" size={26} />
          <span>🚀 GO-LIVE VERIFICATION COMPLETE! SATGURU BEEJ BHANDAR IS READY FOR PRODUCTION DEPLOYMENT.</span>
        </div>
      )}
    </div>
  )
}