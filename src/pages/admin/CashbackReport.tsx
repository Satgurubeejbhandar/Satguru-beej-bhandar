// src/pages/admin/CashbackReport.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Sparkles, RefreshCw, Loader2, IndianRupee, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface FarmerInfo {
  farmer_name: string
  farmer_id: string
}

interface GroupInfo {
  group_name: string
  group_id: string
}

interface CashbackRow {
  id: string
  eligible_amount: number | string
  cashback_rate: number | string
  cashback_earned: number | string
  cashback_released: number | string
  cashback_pending: number | string
  created_at: string
  farmer?: FarmerInfo | null
  group?: GroupInfo | null
}

const CASHBACK_SELECT = `
  id,
  eligible_amount,
  cashback_rate,
  cashback_earned,
  cashback_released,
  cashback_pending,
  created_at,
  farmer:farmers(farmer_name, farmer_id),
  group:farmer_groups(group_name, group_id)
`

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

export default function CashbackReport() {
  const [rows, setRows] = useState<CashbackRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const { data, error } = await supabase
        .from('cashback_records')
        .select(CASHBACK_SELECT)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      if (isMounted.current) {
        setRows((data as unknown as CashbackRow[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cashback report लोड करने में समस्या आई'
      if (isMounted.current) {
        toast.error(msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    load()

    return () => {
      isMounted.current = false
    }
  }, [load])

  const { earned, released, pending } = useMemo(() => {
    let e = 0
    let r = 0
    let p = 0
    for (const row of rows) {
      e += safeNum(row.cashback_earned)
      r += safeNum(row.cashback_released)
      p += safeNum(row.cashback_pending)
    }
    return { earned: e, released: r, pending: p }
  }, [rows])

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-amber-400" size={28} /> Cashback Report
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Eligible · Earned · Released · Pending
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition-all shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <IndianRupee size={12} /> Total Earned
          </p>
          <p className="font-black text-xl text-gray-900 mt-1">
            ₹{formatINR(earned)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" /> Released
          </p>
          <p className="font-black text-xl text-emerald-800 mt-1">
            ₹{formatINR(released)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} className="text-amber-600" /> Pending
          </p>
          <p className="font-black text-xl text-amber-700 mt-1">
            ₹{formatINR(pending)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[700px]" aria-label="Cashback records report">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5">Party</th>
                <th scope="col" className="p-3.5">Eligible</th>
                <th scope="col" className="p-3.5">Rate</th>
                <th scope="col" className="p-3.5">Earned</th>
                <th scope="col" className="p-3.5">Released</th>
                <th scope="col" className="p-3.5">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    <Loader2 className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
                    Loading cashback data...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    No cashback records found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-gray-900">
                        {r.group?.group_name || r.farmer?.farmer_name || '—'}
                      </p>
                      <span className="block text-[10px] font-mono text-gray-500">
                        {r.group?.group_id || r.farmer?.farmer_id || '—'}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-gray-900">
                      ₹{formatINR(r.eligible_amount)}
                    </td>
                    <td className="p-3.5 font-bold text-emerald-800">
                      {safeNum(r.cashback_rate)}%
                    </td>
                    <td className="p-3.5 font-black text-gray-900">
                      ₹{formatINR(r.cashback_earned)}
                    </td>
                    <td className="p-3.5 text-emerald-800 font-bold">
                      ₹{formatINR(r.cashback_released)}
                    </td>
                    <td className="p-3.5 text-amber-700 font-bold">
                      ₹{formatINR(r.cashback_pending)}
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