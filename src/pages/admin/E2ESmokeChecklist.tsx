import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ListChecks, RotateCcw, Square, ShieldCheck, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

type TestCase = {
  id: string
  category: 'Auth & Access' | 'Inventory & Stock' | 'Billing & Payments' | 'Farmer Portal' | 'Audit & Compliance'
  title: string
}

const TEST_CASES: TestCase[] = [
  // Auth & Access
  { id: 'auth_1', category: 'Auth & Access', title: 'Guest opens public website without login' },
  { id: 'auth_2', category: 'Auth & Access', title: 'Guest sees Udhaar scheme; private portal locked' },
  { id: 'auth_3', category: 'Auth & Access', title: 'Admin login with Supabase Auth works' },
  { id: 'auth_4', category: 'Auth & Access', title: 'Admin logout clears session completely' },

  // Inventory & Stock
  { id: 'inv_1', category: 'Inventory & Stock', title: 'Create company master record' },
  { id: 'inv_2', category: 'Inventory & Stock', title: 'Create product with selling rate' },
  { id: 'inv_3', category: 'Inventory & Stock', title: 'Purchase stock-in with purchase + selling rate, batch, expiry' },
  { id: 'inv_4', category: 'Inventory & Stock', title: 'SARA SAMAN shows live stock + updated rates' },
  { id: 'inv_5', category: 'Inventory & Stock', title: 'Expired batch blocked from being sold' },
  { id: 'inv_6', category: 'Inventory & Stock', title: 'Low stock + expiry alerts visible to admin only' },

  // Billing & Payments
  { id: 'bill_1', category: 'Billing & Payments', title: 'Create farmer + PIN + credit account' },
  { id: 'bill_2', category: 'Billing & Payments', title: 'Edit farmer ID preserves transaction history' },
  { id: 'bill_3', category: 'Billing & Payments', title: 'Create group of 4 farmers with security PIN' },
  { id: 'bill_4', category: 'Billing & Payments', title: 'Billing auto-fetches selling rate + FEFO batch' },
  { id: 'bill_5', category: 'Billing & Payments', title: 'Bill deducts stock atomically' },
  { id: 'bill_6', category: 'Billing & Payments', title: 'Insufficient stock blocked during billing' },
  { id: 'bill_7', category: 'Billing & Payments', title: 'Payment reduces outstanding + credits ledger' },
  { id: 'bill_8', category: 'Billing & Payments', title: 'Bill void restores stock + reverses credit' },
  { id: 'bill_9', category: 'Billing & Payments', title: 'Sales return restores stock' },

  // Farmer Portal & Privacy
  { id: 'farmer_1', category: 'Farmer Portal', title: 'Admin WhatsApp bill/payment share (no Aadhaar numbers)' },
  { id: 'farmer_2', category: 'Farmer Portal', title: 'Farmer login PIN + lockout after 3 failed attempts' },
  { id: 'farmer_3', category: 'Farmer Portal', title: 'Farmer portal: WhatsApp history button hidden' },
  { id: 'farmer_4', category: 'Farmer Portal', title: 'Farmer A cannot see Farmer B data (RLS enforcement)' },

  // Audit & Compliance
  { id: 'audit_1', category: 'Audit & Compliance', title: 'Audit log records sensitive actions' },
  { id: 'audit_2', category: 'Audit & Compliance', title: 'Financial reports match database totals' },
]

const STORAGE_KEY = 'qa_e2e_smoke_progress_v1'

export default function E2ESmokeChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
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

  // Auto-sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done))
    } catch (err) {
      console.error('Failed to save QA progress:', err)
    }
  }, [done])

  const toggle = useCallback((id: string) => {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const resetAll = useCallback(() => {
    if (window.confirm('Reset all QA checklist progress?')) {
      setDone({})
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Safe catch
      }
      toast.success('Checklist reset completed')
    }
  }, [])

  const selectAll = useCallback(() => {
    const allDone: Record<string, boolean> = {}
    TEST_CASES.forEach((tc) => {
      allDone[tc.id] = true
    })
    setDone(allDone)
    toast.success('All tests marked as passed')
  }, [])

  const passedCount = useMemo(() => {
    return Object.values(done).filter(Boolean).length
  }, [done])

  const progressPercentage = Math.round((passedCount / TEST_CASES.length) * 100)

  // Group tests by category
  const categories = useMemo(() => {
    const groups: Record<string, TestCase[]> = {}
    TEST_CASES.forEach((tc) => {
      if (!groups[tc.category]) groups[tc.category] = []
      groups[tc.category].push(tc)
    })
    return groups
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="text-amber-400" size={28} /> E2E Smoke Checklist
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="p-2 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl transition-colors text-xs font-bold"
              title="Mark All Passed"
            >
              Pass All
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="p-2 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl transition-colors"
              title="Reset Progress"
              aria-label="Reset Progress"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-emerald-200 font-semibold">
            <span>QA Go-Live Readiness</span>
            <span className="font-mono">
              Passed {passedCount} of {TEST_CASES.length} ({progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-emerald-950/80 rounded-full h-2.5 overflow-hidden border border-emerald-800/50">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                progressPercentage === 100 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completion Alert */}
      {progressPercentage === 100 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-bold shadow-sm animate-in fade-in zoom-in-95 duration-150">
          <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
          <span>All {TEST_CASES.length} E2E Smoke tests passed! System is ready for production go-live.</span>
        </div>
      )}

      {/* Categorized Test Cases */}
      <div className="space-y-4">
        {Object.entries(categories).map(([categoryName, cases]) => (
          <div key={categoryName} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                {categoryName}
              </span>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {cases.filter((c) => done[c.id]).length}/{cases.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100" role="list" aria-label={`${categoryName} test cases`}>
              {cases.map((tc) => {
                const isPassed = !!done[tc.id]
                return (
                  <div
                    key={tc.id}
                    role="checkbox"
                    aria-checked={isPassed}
                    tabIndex={0}
                    onClick={() => toggle(tc.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(tc.id)
                      }
                    }}
                    className={`flex items-start gap-3.5 p-4 text-xs font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-50 ${
                      isPassed ? 'bg-emerald-50/40 text-slate-600' : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-emerald-600">
                      {isPassed ? (
                        <CheckCircle2 size={18} className="text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Square size={18} className="text-slate-300" />
                      )}
                    </div>
                    <span className={`leading-relaxed ${isPassed ? 'line-through text-slate-400' : 'text-slate-800 font-semibold'}`}>
                      {tc.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}