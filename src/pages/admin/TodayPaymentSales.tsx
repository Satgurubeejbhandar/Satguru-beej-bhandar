// src/pages/admin/TodayPaymentSales.tsx
// Read-only Nagad/Cash sales report. This page never creates payments or edits bills.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  IndianRupee,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Source = 'standard' | 'physical'
type Preset = 'today' | 'yesterday' | '7days' | 'month' | 'custom'

interface FarmerInfo {
  name?: string | null
  farmer_name?: string | null
  id?: string | null
  farmer_id?: string | null
}

interface CashSale {
  id: string
  bill_number: string | null
  bill_date: string | null
  amount: number
  transaction: 'cash'
  source: Source
  farmer_id: string | null
  farmer_name: string
  farmer_code: string
  is_gst_bill: boolean | null
}

const money = (value: number) =>
  `₹${(Number.isFinite(value) ? value : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const localDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const addDays = (date: Date, count: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function relationFarmer(value: any): FarmerInfo | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export default function TodayPaymentSales() {
  const { role, loading: authLoading } = useAuth() as any
  const isAdmin = role === 'admin'

  const [preset, setPreset] = useState<Preset>('today')
  const [fromDate, setFromDate] = useState(localDate(new Date()))
  const [toDate, setToDate] = useState(localDate(new Date()))
  const [sales, setSales] = useState<CashSale[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | Source>('all')
  const [docFilter, setDocFilter] = useState<'all' | 'gst' | 'estimate'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'high' | 'low'>('newest')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const applyPreset = (next: Preset) => {
    setPreset(next)
    const today = new Date()
    if (next === 'today') {
      setFromDate(localDate(today))
      setToDate(localDate(today))
    } else if (next === 'yesterday') {
      const yesterday = addDays(today, -1)
      setFromDate(localDate(yesterday))
      setToDate(localDate(yesterday))
    } else if (next === '7days') {
      setFromDate(localDate(addDays(today, -6)))
      setToDate(localDate(today))
    } else if (next === 'month') {
      setFromDate(localDate(startOfMonth(today)))
      setToDate(localDate(today))
    }
    setPage(1)
  }

  const fetchSales = useCallback(async () => {
    if (!isAdmin) return
    if (!fromDate || !toDate) {
      toast.error('कृपया तारीख चुनें।')
      return
    }
    if (fromDate > toDate) {
      toast.error('From Date, To Date से बड़ी नहीं हो सकती।')
      return
    }

    setLoading(true)
    setLoaded(false)
    try {
      // Safe Date Boundaries
      const startOfDay = `${fromDate}T00:00:00`
      const endOfDay = `${toDate}T23:59:59.999`

      // Using select('*, farmers(*)') to avoid crashes if exact column name differs
      const [standardResult, physicalResult] = await Promise.all([
        supabase
          .from('sales_bills')
          .select('*, farmers(*)')
          .in('bill_type', ['cash', 'CASH', 'Cash', 'nagad', 'NAGAD'])
          .gte('bill_date', startOfDay)
          .lte('bill_date', endOfDay)
          .order('bill_date', { ascending: false })
          .limit(5000),
        supabase
          .from('physical_bills')
          .select('*, farmers(*)')
          .gte('bill_date', startOfDay)
          .lte('bill_date', endOfDay)
          .order('bill_date', { ascending: false })
          .limit(5000),
      ])

      if (standardResult.error) throw new Error(`Digital bills error: ${standardResult.error.message}`)
      if (physicalResult.error) throw new Error(`Physical bills error: ${physicalResult.error.message}`)

      // Safely map Standard/Digital Bills
      const standardRows: CashSale[] = (standardResult.data ?? []).map((row: any) => {
        const farmer = relationFarmer(row.farmers)
        return {
          id: String(row.id),
          bill_number: row.bill_number ?? '-',
          bill_date: row.bill_date ?? null,
          amount: Number(row.total_amount || row.amount || 0),
          transaction: 'cash',
          source: 'standard',
          farmer_id: row.farmer_id ?? null,
          farmer_name: farmer?.name ?? farmer?.farmer_name ?? row.customer_name ?? 'Walk-in / नाम उपलब्ध नहीं',
          farmer_code: farmer?.farmer_id ?? farmer?.id ?? '',
          is_gst_bill: row.is_gst_bill ?? row.is_gst ?? null,
        }
      })

      // Safely filter and map Physical Bills
      const physicalRows: CashSale[] = (physicalResult.data ?? [])
        .filter((row: any) => {
          const type = String(row.transaction_type || row.bill_type || '').toLowerCase()
          return type === 'cash' || type === 'nagad'
        })
        .map((row: any) => {
          const farmer = relationFarmer(row.farmers)
          return {
            id: String(row.id),
            bill_number: row.bill_number ?? '-',
            bill_date: row.bill_date ?? null,
            amount: Number(row.bill_amount || row.total_amount || 0),
            transaction: 'cash',
            source: 'physical',
            farmer_id: row.farmer_id ?? null,
            farmer_name: farmer?.name ?? farmer?.farmer_name ?? row.customer_name ?? 'Walk-in / नाम उपलब्ध नहीं',
            farmer_code: farmer?.farmer_id ?? farmer?.id ?? '',
            is_gst_bill: null,
          }
        })

      const combined = [...standardRows, ...physicalRows].sort((a, b) =>
        String(b.bill_date ?? '').localeCompare(String(a.bill_date ?? '')),
      )
      
      setSales(combined)
      setLoaded(true)
      setPage(1)
    } catch (error) {
      console.error('[TodayPaymentSales] fetch failed:', error)
      const message = error instanceof Error ? error.message : 'डेटा लोड नहीं हो पाया।'
      toast.error(`Nagad sales report लोड नहीं हुई: ${message}`)
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, isAdmin])

  useEffect(() => {
    if (authLoading || !isAdmin) return
    void fetchSales()
  }, [authLoading, isAdmin, fetchSales])

  const filteredSales = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    const filtered = sales.filter((sale) => {
      const matchesSearch = !q || [sale.bill_number, sale.farmer_name, sale.farmer_code]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(q))
      const matchesSource = sourceFilter === 'all' || sale.source === sourceFilter
      const matchesDoc = docFilter === 'all' ||
        (docFilter === 'gst' && sale.is_gst_bill === true) ||
        (docFilter === 'estimate' && sale.is_gst_bill === false)
      return matchesSearch && matchesSource && matchesDoc
    })
    return filtered.sort((a, b) => {
      if (sortBy === 'high') return b.amount - a.amount
      if (sortBy === 'low') return a.amount - b.amount
      const dateCompare = String(a.bill_date ?? '').localeCompare(String(b.bill_date ?? ''))
      return sortBy === 'newest' ? -dateCompare : dateCompare
    })
  }, [sales, search, sourceFilter, docFilter, sortBy])

  const total = filteredSales.reduce((sum, sale) => sum + sale.amount, 0)
  const digitalTotal = filteredSales.filter((sale) => sale.source === 'standard').reduce((sum, sale) => sum + sale.amount, 0)
  const physicalTotal = filteredSales.filter((sale) => sale.source === 'physical').reduce((sum, sale) => sum + sale.amount, 0)
  const today = localDate(new Date())
  const todayTotal = sales.filter((sale) => sale.bill_date && sale.bill_date.startsWith(today))
    .reduce((sum, sale) => sum + sale.amount, 0)
  const pages = Math.max(1, Math.ceil(filteredSales.length / pageSize))
  const visibleRows = filteredSales.slice((page - 1) * pageSize, page * pageSize)

  const exportCsv = () => {
    if (!filteredSales.length) {
      toast.error('Export करने के लिए कोई रिकॉर्ड नहीं है।')
      return
    }
    const headers = ['Date & Time', 'Bill Number', 'Sale Source', 'Transaction', 'Customer / Farmer', 'Farmer ID', 'Document Type', 'Amount (INR)']
    const rows = filteredSales.map((sale) => [
      sale.bill_date,
      sale.bill_number,
      sale.source === 'standard' ? 'Digital Bill' : 'Physical Bill',
      'Nagad / Cash',
      sale.farmer_name,
      sale.farmer_code,
      sale.source === 'physical' ? 'Physical' : sale.is_gst_bill ? 'GST' : 'Estimate',
      sale.amount.toFixed(2),
    ])
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Nagad-Sales-${fromDate}-to-${toDate}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const printReport = () => window.print()

  if (authLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading access…</div>
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <ShieldAlert className="mb-3 h-8 w-8" />
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm">इस रिपोर्ट को देखने के लिए Admin login आवश्यक है।</p>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-5 lg:p-6">
      <style>{`@media print { .no-print { display:none !important; } body { background:#fff !important; } main { max-width:none !important; padding:0 !important; } .print-card { box-shadow:none !important; border:1px solid #ddd !important; } }`}</style>
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-700"><Wallet className="h-4 w-4" /> SATGURU BEEJ BHANDAR</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Today Payment Sales</h1>
          <p className="mt-1 text-sm text-slate-500">केवल Nagad / Cash बिक्री — Udhaar रिकॉर्ड शामिल नहीं हैं।</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button onClick={() => void fetchSales()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"><Download className="h-4 w-4" /> Export CSV</button>
          <button onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="print-card rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between text-sm text-emerald-100"><span>आज की कुल Nagad बिक्री</span><IndianRupee className="h-5 w-5" /></div>
          <div className="mt-3 text-3xl font-extrabold">{money(todayTotal)}</div>
          <div className="mt-2 text-xs text-emerald-100">आज की तारीख: {today}</div>
        </div>
        <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-500"><span>Selected period total</span><TrendingUp className="h-5 w-5 text-emerald-700" /></div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">{money(total)}</div>
          <div className="mt-2 text-xs text-slate-500">{filteredSales.length} matching bill(s)</div>
        </div>
        <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-500"><span>Digital cash bills</span><ReceiptText className="h-5 w-5 text-blue-600" /></div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">{money(digitalTotal)}</div>
          <div className="mt-2 text-xs text-slate-500">{filteredSales.filter((sale) => sale.source === 'standard').length} bill(s)</div>
        </div>
        <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-500"><span>Physical cash bills</span><FileSpreadsheet className="h-5 w-5 text-amber-600" /></div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">{money(physicalTotal)}</div>
          <div className="mt-2 text-xs text-slate-500">{filteredSales.filter((sale) => sale.source === 'physical').length} bill(s)</div>
        </div>
      </section>

      <section className="print-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><CalendarDays className="h-5 w-5 text-emerald-700" /> Date range & filters</div>
        <div className="no-print flex flex-wrap gap-2">
          {([
            ['today', 'Today'], ['yesterday', 'Yesterday'], ['7days', 'Last 7 days'], ['month', 'This month'], ['custom', 'Custom range'],
          ] as [Preset, string][]).map(([value, label]) => (
            <button key={value} onClick={() => applyPreset(value)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${preset === value ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium text-slate-600">From date<input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPreset('custom') }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" /></label>
          <label className="text-sm font-medium text-slate-600">To date<input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPreset('custom') }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" /></label>
          <label className="text-sm font-medium text-slate-600">Sale source<select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value as 'all' | Source); setPage(1) }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="all">All sources</option><option value="standard">Digital bill</option><option value="physical">Physical bill</option></select></label>
          <label className="text-sm font-medium text-slate-600">Document type<select value={docFilter} onChange={(e) => { setDocFilter(e.target.value as 'all' | 'gst' | 'estimate'); setPage(1) }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="all">All types</option><option value="gst">GST bills</option><option value="estimate">Estimate bills</option></select></label>
          <label className="text-sm font-medium text-slate-600">Sort by<select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="high">Amount: high to low</option><option value="low">Amount: low to high</option></select></label>
        </div>
        <div className="no-print mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search bill number, farmer name or Farmer ID…" className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div>
          <button onClick={() => { setSearch(''); setSourceFilter('all'); setDocFilter('all'); setSortBy('newest'); applyPreset('today') }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset filters</button>
        </div>
      </section>

      <section className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="text-lg font-bold text-slate-900">Nagad Sales Register</h2><p className="text-sm text-slate-500">{fromDate} से {toDate} तक · केवल Cash/Nagad transactions</p></div>
          <div className="text-sm font-semibold text-slate-700">Visible total: <span className="text-emerald-700">{money(total)}</span></div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Sales records लोड हो रहे हैं…</div>
        ) : !loaded ? (
          <div className="p-10 text-center text-slate-500">रिपोर्ट लोड करने के लिए Refresh दबाएँ।</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-10 text-center"><ReceiptText className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-slate-700">कोई Nagad sale नहीं मिली</p><p className="mt-1 text-sm text-slate-500">Date range या search filters बदलकर देखें।</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[950px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                  <th className="px-4 py-3 font-bold">#</th><th className="px-4 py-3 font-bold">Date & time</th><th className="px-4 py-3 font-bold">Bill no.</th><th className="px-4 py-3 font-bold">Customer / Farmer</th><th className="px-4 py-3 font-bold">Source</th><th className="px-4 py-3 font-bold">Document</th><th className="px-4 py-3 text-right font-bold">Nagad amount</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((sale, index) => (
                    <tr key={`${sale.source}-${sale.id}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{sale.bill_date ? new Date(sale.bill_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{sale.bill_number || '—'}</td>
                      <td className="px-4 py-3"><div className="font-semibold text-slate-800">{sale.farmer_name}</div>{sale.farmer_code && <div className="mt-0.5 text-xs text-slate-500">ID: {sale.farmer_code}</div>}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sale.source === 'standard' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{sale.source === 'standard' ? 'Digital bill' : 'Physical bill'}</span></td>
                      <td className="px-4 py-3 text-slate-600">{sale.source === 'physical' ? 'Physical' : sale.is_gst_bill ? 'GST bill' : 'Estimate'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-emerald-700">{money(sale.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50"><tr><td colSpan={6} className="px-4 py-4 text-right font-bold text-slate-800">Filtered total</td><td className="px-4 py-4 text-right text-base font-extrabold text-emerald-800">{money(total)}</td></tr></tfoot>
              </table>
            </div>
            <div className="no-print flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredSales.length)} of {filteredSales.length} records</p>
              <div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="px-2 text-sm font-semibold text-slate-600">Page {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Next</button></div>
            </div>
          </>
        )}
      </section>
      <p className="text-xs leading-relaxed text-slate-500">Accounting safety: यह page केवल report पढ़ता है। इसमें payment entry, farmer outstanding update, stock update, bill edit/delete या <code>process_farmer_payment</code> call नहीं है।</p>
    </main>
  )
}