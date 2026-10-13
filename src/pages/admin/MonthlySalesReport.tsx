// src/pages/admin/MonthlySalesReport.tsx
import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  CalendarRange, 
  RefreshCw, 
  ShieldAlert, 
  Calendar, 
  Layers, 
  ArrowUpRight,
  Loader2,
  RotateCcw,
  IndianRupee,
  ShoppingCart
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DaySummary {
  day: string
  digitalAmount: number
  digitalBills: number
  physicalAmount: number
  physicalBills: number
  returnAmount: number
  returnCount: number
  netAmount: number
  totalBills: number
}

interface SalesBillRow {
  bill_date: string | null | undefined
  total_amount: number | string | null
}

interface PhysicalBillRow {
  bill_date: string | null | undefined
  bill_amount: number | string | null
}

interface ReturnRow {
  return_date: string | null | undefined
  total_amount: number | string | null
  return_status?: string | null
}

const SUPABASE_MAX_ROWS = 1000

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const [y, m] = value.split('-').map(Number)
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '-'
  const parts = dStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dStr
}

function formatMonthDisplay(mStr: string | null | undefined): string {
  if (!mStr) return '-'
  const parts = mStr.split('-')
  if (parts.length === 2) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
    return date.toLocaleString('default', { month: 'long', year: 'numeric' })
  }
  return mStr
}

async function fetchAllSalesBills(
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<SalesBillRow[]> {
  const allRows: SalesBillRow[] = []
  let from = 0
  const pageSize = SUPABASE_MAX_ROWS

  while (true) {
    if (signal?.aborted) return allRows

    const { data, error } = await supabase
      .from('sales_bills')
      .select('bill_date, total_amount')
      .eq('bill_status', 'active')
      .gte('bill_date', start)
      .lte('bill_date', end)
      .order('bill_date', { ascending: true })
      .range(from, from + pageSize - 1)

    if (signal?.aborted) return allRows
    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...(data as SalesBillRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

async function fetchAllPhysicalBills(
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<PhysicalBillRow[]> {
  const allRows: PhysicalBillRow[] = []
  let from = 0
  const pageSize = SUPABASE_MAX_ROWS

  while (true) {
    if (signal?.aborted) return allRows

    const { data, error } = await supabase
      .from('physical_bills')
      .select('bill_date, bill_amount')
      .eq('status', 'active')
      .gte('bill_date', start)
      .lte('bill_date', end)
      .order('bill_date', { ascending: true })
      .range(from, from + pageSize - 1)

    if (signal?.aborted) return allRows
    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...(data as PhysicalBillRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

async function fetchAllReturns(
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<ReturnRow[]> {
  const allRows: ReturnRow[] = []
  let from = 0
  const pageSize = SUPABASE_MAX_ROWS

  while (true) {
    if (signal?.aborted) return allRows

    const { data, error } = await supabase
      .from('returns')
      .select('return_date, total_amount, return_status')
      .gte('return_date', start)
      .lte('return_date', end)
      .order('return_date', { ascending: true })
      .range(from, from + pageSize - 1)

    if (signal?.aborted) return allRows
    if (error) {
      console.warn('Returns fetch error in monthly report:', error)
      break
    }
    if (!data || data.length === 0) break

    allRows.push(...(data as ReturnRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return allRows
}

export default function MonthlySalesReport() {
  const { role, loading: authLoading } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const [netSalesTotal, setNetSalesTotal] = useState(0)
  const [grossSalesTotal, setGrossSalesTotal] = useState(0)
  const [returnsTotal, setReturnsTotal] = useState(0)

  const [digitalTotal, setDigitalTotal] = useState(0)
  const [physicalTotal, setPhysicalTotal] = useState(0)

  const [totalCount, setTotalCount] = useState(0)
  const [digitalCount, setDigitalCount] = useState(0)
  const [physicalCount, setPhysicalCount] = useState(0)
  const [returnCount, setReturnCount] = useState(0)

  const [byDay, setByDay] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (role !== 'admin') return

    if (!isValidMonth(month)) {
      toast.error('Please select a valid month.')
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)

      const [y, m] = month.split('-').map(Number)
      const start = `${month}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const end = `${month}-${String(lastDay).padStart(2, '0')}`

      const [digitalData, physicalData, returnsData] = await Promise.all([
        fetchAllSalesBills(start, end, controller.signal),
        fetchAllPhysicalBills(start, end, controller.signal),
        fetchAllReturns(start, end, controller.signal)
      ])

      if (controller.signal.aborted) return

      const map = new Map<
        string,
        {
          digitalAmount: number
          digitalBills: number
          physicalAmount: number
          physicalBills: number
          returnAmount: number
          returnCount: number
        }
      >()

      let runningDigital = 0
      let runningPhysical = 0
      let runningReturns = 0
      let validReturnsCount = 0

      // 1. Process Digital Sales Bills
      for (const bill of digitalData) {
        const amount = roundCurrency(Number(bill.total_amount) || 0)
        runningDigital = roundCurrency(runningDigital + amount)

        const bDate = bill.bill_date || 'Unknown Date'
        const existing = map.get(bDate) || {
          digitalAmount: 0,
          digitalBills: 0,
          physicalAmount: 0,
          physicalBills: 0,
          returnAmount: 0,
          returnCount: 0
        }
        existing.digitalAmount = roundCurrency(existing.digitalAmount + amount)
        existing.digitalBills += 1
        map.set(bDate, existing)
      }

      // 2. Process Physical Paper Bills
      for (const pb of physicalData) {
        const amount = roundCurrency(Number(pb.bill_amount) || 0)
        runningPhysical = roundCurrency(runningPhysical + amount)

        const pbDate = pb.bill_date || 'Unknown Date'
        const existing = map.get(pbDate) || {
          digitalAmount: 0,
          digitalBills: 0,
          physicalAmount: 0,
          physicalBills: 0,
          returnAmount: 0,
          returnCount: 0
        }
        existing.physicalAmount = roundCurrency(existing.physicalAmount + amount)
        existing.physicalBills += 1
        map.set(pbDate, existing)
      }

      // 3. Process Farmer Returns
      for (const ret of returnsData) {
        const st = String(ret.return_status || 'completed').toLowerCase()
        if (st === 'void' || st === 'cancelled' || st === 'canceled') continue

        const amount = roundCurrency(Number(ret.total_amount) || 0)
        runningReturns = roundCurrency(runningReturns + amount)
        validReturnsCount++

        const rDate = ret.return_date || 'Unknown Date'
        const existing = map.get(rDate) || {
          digitalAmount: 0,
          digitalBills: 0,
          physicalAmount: 0,
          physicalBills: 0,
          returnAmount: 0,
          returnCount: 0
        }
        existing.returnAmount = roundCurrency(existing.returnAmount + amount)
        existing.returnCount += 1
        map.set(rDate, existing)
      }

      const grossSales = roundCurrency(runningDigital + runningPhysical)
      const netSales = roundCurrency(grossSales - runningReturns)
      const grandCount = digitalData.length + physicalData.length

      setGrossSalesTotal(grossSales)
      setReturnsTotal(runningReturns)
      setNetSalesTotal(netSales)

      setDigitalTotal(runningDigital)
      setPhysicalTotal(runningPhysical)

      setTotalCount(grandCount)
      setDigitalCount(digitalData.length)
      setPhysicalCount(physicalData.length)
      setReturnCount(validReturnsCount)

      setByDay(
        Array.from(map.entries())
          .map(([day, v]) => {
            const netAmt = roundCurrency(v.digitalAmount + v.physicalAmount - v.returnAmount)
            return {
              day,
              digitalAmount: v.digitalAmount,
              digitalBills: v.digitalBills,
              physicalAmount: v.physicalAmount,
              physicalBills: v.physicalBills,
              returnAmount: v.returnAmount,
              returnCount: v.returnCount,
              netAmount: netAmt,
              totalAmount: roundCurrency(v.digitalAmount + v.physicalAmount),
              totalBills: v.digitalBills + v.physicalBills
            }
          })
          .sort((a, b) => a.day.localeCompare(b.day))
      )
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = err as any
      if (
        controller.signal.aborted ||
        errObj?.name === 'AbortError' ||
        errObj?.message?.includes('aborted')
      ) {
        return
      }

      console.error('MonthlySalesReport load failed:', errObj?.message || errObj)
      toast.error('बिक्री रिपोर्ट लोड करने में त्रुटि: ' + (errObj?.message || 'Error'))
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [month, role])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') return

    void load()

    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [load, role, authLoading])

  const handleMonthChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value && isValidMonth(value)) {
      setMonth(value)
    }
  }

  const currentMonthLabel = useMemo(() => {
    return formatMonthDisplay(month)
  }, [month])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास इस मासिक बिक्री रिपोर्ट को देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/30 min-h-screen font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <CalendarRange className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Monthly Sales Report
            </h1>
          </div>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium">
            डिजिटल + पर्ची बिलों की बिक्री में से किसान रिटर्न घटाकर शुद्ध मासिक बिक्री
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-emerald-850 hover:bg-emerald-800 transition border border-emerald-700/40 px-3 py-2.5 rounded-xl text-xs font-bold w-full md:w-auto">
            <Calendar size={16} className="text-amber-300 shrink-0" />
            <input
              id="month-picker"
              type="month"
              value={month}
              onChange={handleMonthChange}
              aria-label="Select month for sales report"
              className="bg-transparent text-white outline-none w-full font-mono text-center cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || authLoading}
            aria-label="Reload sales report"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Load
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Net Monthly Sales */}
        <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-600 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="space-y-1">
            <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
              <IndianRupee size={12} className="text-emerald-600" /> Net Monthly Sales
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
              ₹{netSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md self-start mt-2">
            Gross − Returns
          </span>
        </div>

        {/* Gross Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-slate-500 flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ShoppingCart size={12} className="text-slate-600" /> Gross Sales
            </p>
            <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              ₹{grossSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md self-start mt-2">
            {totalCount} Total Bills
          </span>
        </div>

        {/* Farmer Returns */}
        <div className="bg-rose-50/70 p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-600 flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <RotateCcw size={12} className="text-rose-600" /> Farmer Returns
            </p>
            <p className="text-lg sm:text-xl font-black text-rose-800 font-mono">
              − ₹{returnsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md self-start mt-2">
            {returnCount} Return(s)
          </span>
        </div>

        {/* Digital vs Physical */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-600 flex flex-col justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Layers size={12} className="text-blue-600" /> Digital / Paper
            </p>
            <p className="text-xs font-bold text-slate-700 font-mono pt-1">
              DIG: ₹{digitalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs font-bold text-slate-700 font-mono">
              PHY: ₹{physicalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md self-start mt-2">
            {digitalCount} DIG · {physicalCount} PHY
          </span>
        </div>

      </div>

      {/* Day-wise Table & Mobile Cards */}
      <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 bg-emerald-950 text-white font-bold text-xs sm:text-sm flex justify-between items-center border-b border-emerald-900">
          <span className="flex items-center gap-2">
            <ArrowUpRight size={18} className="text-amber-400 shrink-0" />
            Day-wise Net Sales Breakdown ({currentMonthLabel})
          </span>
          <span className="font-mono text-emerald-300 text-xs bg-emerald-900/50 px-2.5 py-1 rounded-md">
            {byDay.length} Days Active
          </span>
        </div>

        {loading || authLoading ? (
          <div className="p-16 text-center text-slate-400 font-bold space-y-2">
            <Loader2 size={24} className="animate-spin mx-auto text-emerald-800" />
            <p className="text-xs">मासिक बिक्री रिपोर्ट लोड की जा रही है...</p>
          </div>
        ) : byDay.length === 0 ? (
          <p className="p-16 text-center text-slate-400 font-medium text-xs sm:text-sm">
            इस महीने में कोई बिक्री या रिटर्न रिकॉर्ड नहीं मिला।
          </p>
        ) : (
          <>
            {/* DESKTOP VIEW */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-100">
                    <th className="p-4 pl-6">Date</th>
                    <th className="p-4 text-center">Digital Sales</th>
                    <th className="p-4 text-center">Physical Sales</th>
                    <th className="p-4 text-center">Returns (-)</th>
                    <th className="p-4 text-right pr-6">Net Day Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {byDay.map((d) => (
                    <tr key={d.day} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 pl-6 font-mono font-bold text-slate-900">
                        {formatDateDisplay(d.day)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono text-blue-900 font-bold">
                          ₹{d.digitalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          ({d.digitalBills} bills)
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono text-amber-900 font-bold">
                          ₹{d.physicalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          ({d.physicalBills} bills)
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {d.returnAmount > 0 ? (
                          <>
                            <span className="font-mono text-rose-700 font-bold">
                              − ₹{d.returnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-rose-500 block font-normal">
                              ({d.returnCount} returns)
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right pr-6 font-black font-mono text-emerald-950 text-sm">
                        ₹{d.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-emerald-900 font-black text-xs text-emerald-950">
                    <td className="p-4 pl-6 uppercase font-extrabold">Monthly Net Aggregate</td>
                    <td className="p-4 text-center font-mono text-blue-950 font-bold">
                      ₹{digitalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center font-mono text-amber-950 font-bold">
                      ₹{physicalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center font-mono text-rose-700 font-bold">
                      − ₹{returnsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 pr-6 text-right font-mono text-base text-emerald-950">
                      ₹{netSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* MOBILE VIEW */}
            <div className="sm:hidden divide-y divide-slate-100">
              {byDay.map((d) => (
                <div key={d.day} className="p-4 hover:bg-slate-50/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatDateDisplay(d.day)}
                    </span>
                    <span className="font-mono font-black text-emerald-950 text-sm">
                      ₹{d.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl text-center">
                    <div>
                      <span className="text-blue-800 font-bold block">Digital</span>
                      ₹{d.digitalAmount.toLocaleString('en-IN')}
                    </div>
                    <div>
                      <span className="text-amber-800 font-bold block">Paper</span>
                      ₹{d.physicalAmount.toLocaleString('en-IN')}
                    </div>
                    <div>
                      <span className="text-rose-700 font-bold block">Returns</span>
                      {d.returnAmount > 0 ? `-₹${d.returnAmount.toLocaleString('en-IN')}` : '—'}
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 flex justify-between items-center border-t border-emerald-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">
                    Monthly Net Sales Total
                  </p>
                  <p className="text-xs text-emerald-100 font-bold">
                    Gross ₹{grossSalesTotal.toLocaleString('en-IN')} − Returns ₹{returnsTotal.toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="text-lg font-black text-amber-400 font-mono">
                  ₹{netSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}