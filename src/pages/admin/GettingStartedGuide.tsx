import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Rocket,
  Building2,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Receipt,
  IndianRupee,
  Activity,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Step Definitions with Category & Icons ──
const STEPS = [
  {
    n: 1,
    id: 'company',
    t: 'Add Company',
    desc: 'Register seed & fertilizer companies',
    to: '/admin/companies',
    icon: Building2,
    category: 'Master Setup',
  },
  {
    n: 2,
    id: 'product',
    t: 'Add Product (set Selling Rate)',
    desc: 'Define items, HSN, and default rates',
    to: '/admin/products',
    icon: Package,
    category: 'Master Setup',
  },
  {
    n: 3,
    id: 'purchase',
    t: 'Purchase / Stock In',
    desc: 'Record incoming stock batches and buy rates',
    to: '/admin/purchase',
    icon: ShoppingCart,
    category: 'Inventory',
  },
  {
    n: 4,
    id: 'stock_check',
    t: 'Check SARA SAMAN',
    desc: 'Verify live stock inventory & batches',
    to: '/admin/sara-saman',
    icon: Boxes,
    category: 'Inventory',
  },
  {
    n: 5,
    id: 'farmer',
    t: 'Register Farmer + PIN + Limit',
    desc: 'Add customer details, udhaar limit & security PIN',
    to: '/admin/farmers',
    icon: Users,
    category: 'Customers',
  },
  {
    n: 6,
    id: 'bill',
    t: 'Create Udhaar Bill',
    desc: 'Issue credit/cash bills with auto stock deduction',
    to: '/admin/bills',
    icon: Receipt,
    category: 'Sales',
  },
  {
    n: 7,
    id: 'payment',
    t: 'Take Payment',
    desc: 'Collect customer payments & update ledger',
    to: '/admin/payments',
    icon: IndianRupee,
    category: 'Finance',
  },
  {
    n: 8,
    id: 'e2e',
    t: 'Run Health + E2E Checklist',
    desc: 'Verify system sanity & database health',
    to: '/admin/e2e',
    icon: Activity,
    category: 'Audit',
  },
] as const

const STORAGE_KEY = 'satguru_guide_completed_steps_v1'

export default function GettingStartedGuide() {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
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

  // Sync with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
    } catch (e) {
      console.error('Failed to save guide progress', e)
    }
  }, [completed])

  const doneCount = STEPS.filter((s) => !!completed[s.id]).length
  const totalCount = STEPS.length
  const progressPercent = Math.round((doneCount / totalCount) * 100)

  const toggleComplete = useCallback(
    (e: React.SyntheticEvent, id: string, stepTitle: string) => {
      e.preventDefault()
      e.stopPropagation()

      setCompleted((prev) => {
        const nextState = !prev[id]
        if (nextState) {
          toast.success(`Completed: ${stepTitle}`)
        }
        return { ...prev, [id]: nextState }
      })
    },
    []
  )

  const resetProgress = useCallback(() => {
    if (window.confirm('Reset all onboarding guide progress?')) {
      setCompleted({})
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Safe catch
      }
      toast.success('Onboarding progress reset completed')
    }
  }, [])

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="text-amber-400" size={28} /> Getting Started
          </h1>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-800/80 rounded-full border border-emerald-700 font-mono">
            {progressPercent}% Done
          </span>
        </div>

        <p className="text-emerald-200 text-xs flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Follow this sequence for first-time shop setup ({doneCount}/{totalCount} steps completed)
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-emerald-950/60 rounded-full h-2 overflow-hidden border border-emerald-800">
          <div
            className="bg-amber-400 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex justify-end px-1">
        <button
          type="button"
          onClick={resetProgress}
          aria-label="Reset onboarding progress"
          className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
        >
          <RotateCcw size={13} /> Reset Onboarding Progress
        </button>
      </div>

      {/* Steps List */}
      <div className="space-y-3" role="list" aria-label="Onboarding setup steps">
        {STEPS.map((s) => {
          const Icon = s.icon
          const isDone = !!completed[s.id]

          return (
            <Link
              key={s.id}
              to={s.to}
              role="listitem"
              className={`group flex items-center justify-between border rounded-2xl p-4 transition-all duration-200 shadow-sm ${
                isDone
                  ? 'bg-emerald-50/40 border-emerald-200 opacity-80'
                  : 'bg-white hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                {/* Accessible Step Toggle Badge */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => toggleComplete(e, s.id, s.t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      toggleComplete(e, s.id, s.t)
                    }
                  }}
                  title="Click to toggle done state"
                  aria-label={`Mark step ${s.n} ${s.t} as ${isDone ? 'incomplete' : 'complete'}`}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform active:scale-95 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDone
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-900 group-hover:bg-emerald-800 text-white'
                  }`}
                >
                  {isDone ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                </div>

                {/* Step Text Info */}
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md font-mono">
                      Step {s.n}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {s.category}
                    </span>
                  </div>
                  <span
                    className={`font-bold text-sm mt-0.5 truncate ${
                      isDone ? 'line-through text-slate-500' : 'text-slate-900'
                    }`}
                  >
                    {s.t}
                  </span>
                  <span className="text-xs text-slate-500 truncate mt-0.5">{s.desc}</span>
                </div>
              </div>

              {/* Action Chevron */}
              <div className="text-slate-300 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all shrink-0">
                <ChevronRight size={20} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}