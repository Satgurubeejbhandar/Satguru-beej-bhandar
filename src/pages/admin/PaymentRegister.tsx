// src/pages/admin/PaymentRegister.tsx
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Wallet,
  RefreshCw,
  Search,
  Loader2,
  XCircle,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface FarmerInfo {
  farmer_name: string | null
  farmer_id: string | null
  village: string | null
}

export interface PaymentRow {
  id: string
  payment_number: string
  payment_date: string | null
  created_at: string
  payment_amount: number
  payment_mode: string
  new_outstanding: number
  farmer: FarmerInfo | null
}

interface PaymentQueryItem {
  id: string
  payment_number: string | null
  payment_date: string | null
  created_at: string
  payment_amount: number | string | null
  payment_mode: string | null
  new_outstanding: number | string | null
  farmer: FarmerInfo | FarmerInfo[] | null
}

const PAGE_SIZE = 1000

/**
 * Utility to round floating point currency values accurately
 */
function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function normalizeFarmer(
  farmer: FarmerInfo | FarmerInfo[] | null | undefined
): FarmerInfo | null {
  if (!farmer) return null
  if (Array.isArray(farmer)) return farmer[0] || null
  return farmer
}

function normalizePayment(item: PaymentQueryItem): PaymentRow {
  return {
    id: item.id,
    payment_number: item.payment_number || 'N/A',
    payment_date: item.payment_date ?? item.created_at ?? null,
    created_at: item.created_at,
    payment_amount: roundCurrency(Number(item.payment_amount) || 0),
    payment_mode: item.payment_mode || 'cash',
    new_outstanding: roundCurrency(Number(item.new_outstanding) || 0),
    farmer: normalizeFarmer(item.farmer),
  }
}

/**
 * Paginated fetch to bypass Supabase 1000-row limit and prevent total truncation
 */
async function fetchAllPayments(
  fromDate: string,
  toDate: string,
  signal?: AbortSignal
): Promise<PaymentRow[]> {
  const allRows: PaymentRow[] = []
  let from = 0

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    let q = supabase
      .from('payments')
      .select(
        `
        id,
        payment_number,
        payment_date,
        created_at,
        payment_amount,
        payment_mode,
        new_outstanding,
        farmer:farmers(farmer_name, farmer_id, village)
      `
      )
      .order('created_at', { ascending: false })

    if (fromDate) {
      q = q.gte('payment_date', fromDate)
    }
    if (toDate) {
      q = q.lte('payment_date', toDate)
    }

    q = q.range(from, from + PAGE_SIZE - 1)

    const { data, error } = await q

    if (error) throw error

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    if (data && data.length > 0) {
      const normalized = (data as PaymentQueryItem[]).map(normalizePayment)
      allRows.push(...normalized)
    }

    if (!data || data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return allRows
}

export default function PaymentRegister() {
  const { role, loading: authLoading } = useAuth()

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    if (role !== 'admin') return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const data = await fetchAllPayments(fromDate, toDate, controller.signal)

      if (controller.signal.aborted || !isMounted.current) return

      setRows(data)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('PaymentRegister load failed:', err)
      if (isMounted.current) {
        toast.error('Failed to load payments. Please try again.')
      }
    } finally {
      if (!controller.signal.aborted && isMounted.current) {
        setLoading(false)
      }
    }
  }, [fromDate, toDate, role])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') {
      setLoading(false)
      return
    }
    void load()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load, role, authLoading])

  // Memoized Search Filter
  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    if (!searchTerm) return rows

    return rows.filter((r) => {
      const fName = r.farmer?.farmer_name || ''
      const fId = r.farmer?.farmer_id || ''
      const pNum = r.payment_number || ''
      const pMode = r.payment_mode || ''

      const haystack = `${fName} ${fId} ${pNum} ${pMode}`.toLowerCase()
      return haystack.includes(searchTerm)
    })
  }, [rows, search])

  // Memoized Total Calculation with intermediate rounding
  const total = useMemo(() => {
    const sum = filtered.reduce(
      (acc, r) => roundCurrency(acc + (r.payment_amount || 0)),
      0
    )
    return roundCurrency(sum)
  }, [filtered])

  const clearFilters = () => {
    setSearch('')
    setFromDate('')
    setToDate('')
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas payment register dekhne ki anumati nahi hai.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="text-amber-400" size={28} /> Payment Register
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            All recovery and payment entries
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || authLoading}
          aria-label="Refresh payment register"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Control Panel: Search & Date Filters */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-emerald-600 focus-within:border-emerald-600 transition-all">
          <Search className="text-gray-400 shrink-0" size={18} />
          <input
            id="search-payment"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by farmer name, ID, receipt no, or mode..."
            aria-label="Search payment records"
            className="flex-1 outline-none text-sm font-medium text-gray-800 placeholder-gray-400 bg-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="from-date" className="font-bold text-gray-600">
              From:
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="to-date" className="font-bold text-gray-600">
              To:
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-emerald-600 outline-none"
            />
          </div>

          {(fromDate || toDate || search) && (
            <button
              type="button"
              onClick={clearFilters}
              title="Clear filters"
              className="p-1.5 text-rose-600 hover:text-rose-800 transition-colors"
            >
              <XCircle size={18} />
            </button>
          )}

          <div className="pl-2 border-l text-right">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">
              Total Received
            </span>
            <p className="text-base font-black text-emerald-900 font-mono">
              ₹
              {total.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs text-left"
            aria-label="Payment register table"
          >
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase">
                <th scope="col" className="p-3">
                  Date
                </th>
                <th scope="col" className="p-3">
                  Receipt
                </th>
                <th scope="col" className="p-3">
                  Farmer
                </th>
                <th scope="col" className="p-3">
                  Mode
                </th>
                <th scope="col" className="p-3">
                  Amount
                </th>
                <th scope="col" className="p-3">
                  New Outstanding
                </th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2
                        size={16}
                        className="animate-spin text-emerald-800"
                      />
                      Loading payments...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const displayDate = r.payment_date
                    ? r.payment_date.split('T')[0]
                    : '—'

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3 font-mono text-gray-700">
                        {displayDate}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {r.payment_number}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">
                          {r.farmer?.farmer_name || '—'}
                        </p>
                        <p className="text-[10px] font-mono text-gray-500">
                          {r.farmer?.farmer_id || 'N/A'}{' '}
                          {r.farmer?.village ? `· ${r.farmer.village}` : ''}
                        </p>
                      </td>
                      <td className="p-3 uppercase font-bold text-emerald-800">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100">
                          {r.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 font-black text-emerald-800 font-mono text-sm">
                        ₹
                        {r.payment_amount.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 font-bold text-gray-800 font-mono">
                        ₹
                        {r.new_outstanding.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50 font-black text-xs border-t-2 border-emerald-900">
                  <td
                    colSpan={4}
                    className="p-3 text-emerald-950 uppercase font-extrabold"
                  >
                    Total ({filtered.length} Entries)
                  </td>
                  <td className="p-3 text-emerald-900 font-mono text-sm">
                    ₹
                    {total.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}