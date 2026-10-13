// src/pages/admin/LateInterestManager.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock, IndianRupee, RefreshCw, Loader2, Search, CheckCircle2, X, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

interface Farmer {
  farmer_name: string
  farmer_id: string
  mobile?: string | null
  village?: string | null
}

interface CreditAccount {
  id: string
  farmer_id: string
  current_outstanding: number | string
  due_date: string
  last_interest_date?: string | null
  farmer?: Farmer | null
}

interface OverdueAccount extends CreditAccount {
  overdueDays: number
  calculatedInterest: number
  lockedRate: number
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function getLocalDateString(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays)
  }
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function diffCalendarDays(fromYYYYMMDD: string, toYYYYMMDD: string): number {
  if (!fromYYYYMMDD || !toYYYYMMDD) return 0

  const parseLocal = (s: string) => {
    const parts = s.split('-')
    if (parts.length !== 3) return null
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    const dt = new Date(y, m, d)
    dt.setHours(0, 0, 0, 0)
    return dt
  }

  const a = parseLocal(fromYYYYMMDD)
  const b = parseLocal(toYYYYMMDD)
  if (!a || !b) return 0

  const diffMs = b.getTime() - a.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export default function LateInterestManager() {
  const [overdueAccounts, setOverdueAccounts] = useState<OverdueAccount[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [interestRate, setInterestRate] = useState<string>('18')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadOverdue = useCallback(async () => {
    try {
      setLoading(true)

      const { data: setRow } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'late_interest_rate')
        .maybeSingle()

      const rateNum = safeNum(setRow?.setting_value || 18)

      if (isMountedRef.current) {
        setInterestRate(String(rateNum))
      }

      const todayStr = getLocalDateString(0)

      const { data, error } = await supabase
        .from('credit_accounts')
        .select('id, farmer_id, current_outstanding, due_date, last_interest_date, farmer:farmers(farmer_name, farmer_id, mobile, village)')
        .gt('current_outstanding', 0)
        .lt('due_date', todayStr)

      if (error) throw error

      const calculated: OverdueAccount[] = ((data as unknown as CreditAccount[]) || []).map((acc) => {
        const baseDateStr = acc.last_interest_date || acc.due_date
        const overdueDays = diffCalendarDays(baseDateStr, todayStr)
        const principal = safeNum(acc.current_outstanding)
        const interestAmt =
          Math.round(((principal * rateNum * overdueDays) / (365 * 100) + Number.EPSILON) * 100) / 100

        return {
          ...acc,
          overdueDays,
          calculatedInterest: interestAmt,
          lockedRate: rateNum,
        }
      })

      if (isMountedRef.current) {
        setOverdueAccounts(calculated)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load overdue accounts'
      if (isMountedRef.current) {
        toast.error('ओवरड्यू लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadOverdue()
  }, [loadOverdue])

  const handleApplyInterest = async (acc: OverdueAccount) => {
    if (acc.calculatedInterest <= 0) {
      toast.error('Interest amount must be greater than 0')
      return
    }

    const confirmed = window.confirm(
      `किसान "${acc.farmer?.farmer_name || acc.farmer_id}" के खाते में ₹${formatINR(acc.calculatedInterest)} ब्याज (${acc.overdueDays} दिन × ${acc.lockedRate}% p.a.) जोड़ना है?`
    )
    if (!confirmed) return

    setApplyingId(acc.id)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const principal = safeNum(acc.current_outstanding)

      // Strict Validation: Re-verify system interest rate before applying to prevent client-side injection
      const { data: setRow } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'late_interest_rate')
        .maybeSingle()

      const currentSystemRate = safeNum(setRow?.setting_value || 18)
      const computedSecureInterest =
        Math.round(((principal * currentSystemRate * acc.overdueDays) / (365 * 100) + Number.EPSILON) * 100) / 100

      const { error: rpcErr } = await supabase.rpc('apply_late_interest', {
        p_account_id: acc.id,
        p_farmer_id: acc.farmer_id,
        p_principal: principal,
        p_interest_amount: computedSecureInterest, // Using secure server-synced calculated amount
        p_interest_rate: currentSystemRate,
        p_overdue_days: acc.overdueDays,
        p_created_by: user?.id || null,
      })

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Database transaction rejected interest charge.')
      }

      toast.success(
        `किसान ${acc.farmer?.farmer_name || ''} के खाते में ₹${formatINR(computedSecureInterest)} ब्याज सफलतापूर्वक जोड़ा गया!`
      )
      await loadOverdue()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply interest'
      if (isMountedRef.current) {
        toast.error('ब्याज जोड़ने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setApplyingId(null)
      }
    }
  }

  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) return overdueAccounts
    const term = searchTerm.toLowerCase().trim()
    return overdueAccounts.filter(
      (acc) =>
        (acc.farmer?.farmer_name || '').toLowerCase().includes(term) ||
        (acc.farmer?.farmer_id || '').toLowerCase().includes(term) ||
        (acc.farmer?.village || '').toLowerCase().includes(term) ||
        (acc.farmer?.mobile || '').includes(term)
    )
  }, [overdueAccounts, searchTerm])

  const totalCalculatedInterest = useMemo(
    () => filteredAccounts.reduce((sum, a) => sum + safeNum(a.calculatedInterest), 0),
    [filteredAccounts]
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <div className="flex flex-wrap justify-between items-center bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl gap-4 font-sans">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="text-amber-400 shrink-0" size={28} /> Late Interest Engine (विलंब ब्याज)
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            नियत समय से अधिक उधारी पर स्वचालित ब्याज गणना ({interestRate}% Per Annum)
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverdue}
          disabled={loading}
          aria-label="Recalculate overdue interest"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50 shrink-0 active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Calculating...' : 'Recalculate Overdue'}
        </button>
      </div>

      {!loading && filteredAccounts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-amber-900 shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
              Overdue Accounts
            </span>
            <span className="text-lg font-black text-amber-950 font-mono">{filteredAccounts.length}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
              Total Interest to Charge
            </span>
            <span className="text-lg font-black text-amber-950 font-mono">
              ₹{formatINR(totalCalculatedInterest)}
            </span>
          </div>
        </div>
      )}

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search overdue farmer by name, ID, village or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search overdue accounts"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
            className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]" aria-label="Overdue accounts and late interest calculator">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                <th scope="col" className="p-4">Farmer Info</th>
                <th scope="col" className="p-4">Due Date</th>
                <th scope="col" className="p-4 text-center">Overdue Days</th>
                <th scope="col" className="p-4 text-right">Principal Outstanding</th>
                <th scope="col" className="p-4 text-center">Interest Rate</th>
                <th scope="col" className="p-4 text-right bg-emerald-950 text-amber-300">
                  Calculated Interest
                </th>
                <th scope="col" className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-emerald-600" size={20} />
                      Calculating overdue interest...
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-1 py-4">
                      <CheckCircle2 size={24} className="text-emerald-600 mb-1" />
                      <span className="font-semibold">
                        {searchTerm
                          ? `No overdue accounts matching "${searchTerm}"`
                          : 'कोई ओवरड्यू खाता नहीं मिला। सभी समय पर हैं! 🎉'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isThisApplying = applyingId === acc.id

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 text-sm">
                          {acc.farmer?.farmer_name || 'Unknown Farmer'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {acc.farmer?.farmer_id || 'N/A'}{' '}
                          {acc.farmer?.village && `| ${acc.farmer.village}`}
                        </p>
                      </td>
                      <td className="p-4 font-mono text-rose-600 font-bold">{acc.due_date}</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-800 font-black text-[11px] font-mono">
                          {acc.overdueDays} Days Late
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-right font-mono">
                        ₹{formatINR(acc.current_outstanding)}
                      </td>
                      <td className="p-4 font-bold text-slate-600 text-center font-mono">
                        {acc.lockedRate}% p.a.
                      </td>
                      <td className="p-4 font-black text-amber-700 bg-amber-50/60 text-sm text-right font-mono">
                        ₹{formatINR(acc.calculatedInterest)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          disabled={isThisApplying || acc.calculatedInterest <= 0 || applyingId !== null}
                          onClick={() => handleApplyInterest(acc)}
                          aria-label={`Apply late interest to ${acc.farmer?.farmer_name || acc.farmer_id}`}
                          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 mx-auto shadow transition-all cursor-pointer active:scale-95"
                        >
                          {isThisApplying ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Applying...
                            </>
                          ) : (
                            <>
                              <IndianRupee size={13} /> Apply Interest
                            </>
                          )}
                        </button>
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