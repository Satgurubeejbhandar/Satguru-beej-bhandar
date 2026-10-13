// src/pages/admin/FarmerWiseSales.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Users, RefreshCw, Search, Loader2, Download, ShieldCheck,
  TrendingUp, CreditCard, RotateCcw, X, Filter, MapPin, ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

type FarmerSummaryRow = {
  farmer_uuid: string
  farmer_code: string
  name: string
  village: string
  bills: number
  sales_amount: number
  payment_amount: number
  return_amount: number
}

type RpcRow = {
  farmer_uuid: string
  farmer_code: string | null
  farmer_name: string | null
  village: string | null
  bill_count: number | string | null
  sales_amount: number | string | null
  payment_amount: number | string | null
  return_amount: number | string | null
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

function formatINRCompact(amount: number | string | null | undefined): string {
  const n = safeNum(amount)
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return formatINR(n)
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

function escapeCSV(value: string | number | null | undefined): string {
  const safe = String(value ?? '').replace(/"/g, '""')
  if (/^[=+\-@]/.test(safe)) {
    return `"'${safe}"`
  }
  return `"${safe}"`
}

export default function FarmerWiseSales() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<FarmerSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const isMountedRef = useRef<boolean>(true)
  const activeRequestId = useRef<number>(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (role !== 'admin') return

    const reqId = ++activeRequestId.current
    setLoading(true)

    try {
      if (startDate && endDate && startDate > endDate) {
        toast.error('Start Date, End Date से पहले होनी चाहिए')
        setLoading(false)
        return
      }

      setRows([])

      // 🔧 FIX #10: सीधे RPC से कंबाइंड डेटा लें (इसके अंदर स्टैंडर्ड और फिजिकल बिल पहले से ही सही तरीके से जुड़े हुए हैं)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('farmer_wise_sales', {
        p_start: startDate || null,
        p_end: endDate || null,
      })
      if (rpcErr) throw rpcErr

      if (reqId !== activeRequestId.current || !isMountedRef.current) return

      // 🔧 FIX #10: एक्स्ट्रा फिजिकल बिल क्वेरी और मर्जर हटा दिया गया है। RPC डेटा को ही डायरेक्ट मैप करें।
      const mapped: FarmerSummaryRow[] = ((rpcData || []) as unknown as RpcRow[]).map((r) => ({
        farmer_uuid: r.farmer_uuid,
        farmer_code: r.farmer_code || '—',
        name: r.farmer_name || '—',
        village: r.village || '—',
        bills: safeNum(r.bill_count),
        sales_amount: safeNum(r.sales_amount),
        payment_amount: safeNum(r.payment_amount),
        return_amount: safeNum(r.return_amount),
      }))

      setRows(mapped.sort((a, b) => b.sales_amount - a.sales_amount))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load summary'
      if (isMountedRef.current && reqId === activeRequestId.current) {
        toast.error(msg)
        setRows([])
      }
    } finally {
      if (isMountedRef.current && reqId === activeRequestId.current) {
        setLoading(false)
      }
    }
  }, [startDate, endDate, role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      void load()
    }
  }, [load, role, authLoading])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const hay = `${r.name} ${r.farmer_code} ${r.village}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  const totals = useMemo(() => {
    let billsCount = 0,
      salesSum = 0,
      paymentSum = 0,
      returnSum = 0
    for (const r of filtered) {
      billsCount += safeNum(r.bills)
      salesSum += safeNum(r.sales_amount)
      paymentSum += safeNum(r.payment_amount)
      returnSum += safeNum(r.return_amount)
    }
    
    // 🟢 FIX: Round all footer totals
    return { 
      bills: billsCount, 
      sales: Math.round((salesSum + Number.EPSILON) * 100) / 100, 
      payments: Math.round((paymentSum + Number.EPSILON) * 100) / 100, 
      returns: Math.round((returnSum + Number.EPSILON) * 100) / 100 
    }
  }, [filtered])

  const isFilterActive = search.trim() !== '' || startDate !== '' || endDate !== ''

  const clearAllFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
  }

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('No rows to export')
      return
    }
    const header = [
      'Farmer Code',
      'Name',
      'Village',
      'Bills Count (Digi+Phy)',
      'Total Sales (Rs)',
      'Total Payments (Rs)',
      'Total Returns (Rs)',
    ]
    const lines = [
      header.join(','),
      ...filtered.map((r) =>
        [
          escapeCSV(r.farmer_code),
          escapeCSV(r.name),
          escapeCSV(r.village),
          r.bills,
          r.sales_amount.toFixed(2),
          r.payment_amount.toFixed(2),
          r.return_amount.toFixed(2),
        ].join(',')
      ),
      `\n"TOTAL (FILTERED)",,,${totals.bills},${totals.sales.toFixed(2)},${totals.payments.toFixed(2)},${totals.returns.toFixed(2)}`,
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `farmer-summary-report-${getLocalDateString(0)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV Report downloaded successfully')
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Farmer-wise Sales Report की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-6 max-w-7xl mx-auto p-2 sm:p-4 md:p-6 font-sans">
      {/* ============ HEADER BANNER ============ */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-base sm:text-xl md:text-2xl font-black flex items-center gap-2">
            <Users className="text-amber-400 shrink-0" size={22} />
            <span className="leading-tight">Farmer-wise Summary Report</span>
          </h1>
          <p className="text-emerald-200 text-[10px] sm:text-xs mt-1 flex items-start sm:items-center gap-1 font-medium">
            <ShieldCheck size={12} className="text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>डिजिटल और फिजिकल पर्ची बिलों का किसानवार सम्पूर्ण विवरण</span>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || filtered.length === 0}
            className="flex-1 sm:flex-none justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-[11px] sm:text-xs flex items-center gap-1.5 border border-emerald-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex-1 sm:flex-none justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl text-[11px] sm:text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ============ FILTER TOOLBAR ============ */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500 transition">
          <Search className="text-slate-400 shrink-0" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, village..."
            className="flex-1 outline-none text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 bg-transparent min-w-0"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-1 rounded-full hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer"
              title="Clear search"
            >
              <X size={14} className="text-slate-500" />
            </button>
          )}
        </div>

        <div className="sm:hidden">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <Filter size={13} />
            {showFilters ? 'Hide' : 'Show'} Date Filters
            {(startDate || endDate) && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] rounded-full font-black">
                {[startDate, endDate].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-2 sm:items-center`}>
          <label className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-wide sm:mr-1">
            Date Range:
          </label>
          <div className="flex items-center gap-2 flex-1 sm:flex-none text-xs font-bold">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 sm:flex-none border border-slate-300 rounded-xl px-2 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-[11px] sm:text-xs"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 sm:flex-none border border-slate-300 rounded-xl px-2 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-[11px] sm:text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="px-2.5 py-2 bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-700 rounded-xl text-[10px] font-black uppercase transition cursor-pointer"
            >
              Reset Dates
            </button>
          )}
        </div>

        {isFilterActive && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-[10px] sm:text-[11px]">
            <p className="font-bold text-slate-600">
              Showing <span className="text-emerald-700">{filtered.length}</span> of{' '}
              <span className="text-slate-800">{rows.length}</span> farmers
            </p>
            <button
              onClick={clearAllFilters}
              className="px-2.5 py-1.5 text-[10px] font-black rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 active:bg-rose-300 transition self-start sm:self-auto cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* ============ KPI RIBBON ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <span className="text-slate-500 text-[9px] sm:text-[10px] uppercase font-bold flex items-center gap-1">
            <Users size={11} /> Total Farmers
          </span>
          <span className="text-base sm:text-xl font-black text-slate-900 font-mono mt-1 block">
            {filtered.length}
          </span>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <span className="text-blue-700 text-[9px] sm:text-[10px] uppercase font-bold flex items-center gap-1">
            <TrendingUp size={11} /> <span className="hidden xs:inline">Total</span> Sales
          </span>
          <span className="text-sm sm:text-xl font-black text-blue-900 font-mono mt-1 block break-all">
            <span className="sm:hidden">{formatINRCompact(totals.sales)}</span>
            <span className="hidden sm:inline">{formatINR(totals.sales)}</span>
          </span>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <span className="text-teal-700 text-[9px] sm:text-[10px] uppercase font-bold flex items-center gap-1">
            <CreditCard size={11} /> <span className="hidden xs:inline">Total</span> Payments
          </span>
          <span className="text-sm sm:text-xl font-black text-teal-900 font-mono mt-1 block break-all">
            <span className="sm:hidden">{formatINRCompact(totals.payments)}</span>
            <span className="hidden sm:inline">{formatINR(totals.payments)}</span>
          </span>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <span className="text-purple-700 text-[9px] sm:text-[10px] uppercase font-bold flex items-center gap-1">
            <RotateCcw size={11} /> <span className="hidden xs:inline">Total</span> Returns
          </span>
          <span className="text-sm sm:text-xl font-black text-purple-900 font-mono mt-1 block break-all">
            <span className="sm:hidden">{formatINRCompact(totals.returns)}</span>
            <span className="hidden sm:inline">{formatINR(totals.returns)}</span>
          </span>
        </div>
      </div>

      {/* ============ DESKTOP TABLE ============ */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-emerald-950 text-white font-bold tracking-wider uppercase text-[11px]">
                <th className="p-3.5 w-12 text-center whitespace-nowrap">#</th>
                <th className="p-3.5 whitespace-nowrap">Farmer Info</th>
                <th className="p-3.5 whitespace-nowrap">Village</th>
                <th className="p-3.5 text-right whitespace-nowrap text-blue-300">
                  Sales (बिक्री)
                </th>
                <th className="p-3.5 text-right whitespace-nowrap text-teal-300">
                  Payments (जमा)
                </th>
                <th className="p-3.5 text-right whitespace-nowrap text-purple-300">
                  Returns (वापसी)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto text-emerald-700 mb-2" size={24} />
                    <p className="font-bold text-xs">डेटा लोड हो रहा है...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">
                    इस फिल्टर के लिए कोई रिकॉर्ड नहीं मिला।
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.farmer_uuid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-400 font-mono text-center">{idx + 1}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                        {r.farmer_code} • {r.bills} bill{r.bills !== 1 ? 's' : ''}
                      </p>
                    </td>
                    <td className="p-3.5 text-slate-600 font-bold">{r.village}</td>

                    <td className="p-3.5 text-right">
                      {r.sales_amount > 0 ? (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded font-black font-mono">
                          {formatINR(r.sales_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-mono">—</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      {r.payment_amount > 0 ? (
                        <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded font-black font-mono">
                          {formatINR(r.payment_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-mono">—</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      {r.return_amount > 0 ? (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded font-black font-mono">
                          {formatINR(r.return_amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-emerald-900 font-black text-xs">
                  <td className="p-4 uppercase text-slate-700" colSpan={3}>
                    Total (Filtered) — {filtered.length} Farmers
                  </td>
                  <td className="p-4 text-right font-mono text-blue-700 text-sm">
                    {formatINR(totals.sales)}
                  </td>
                  <td className="p-4 text-right font-mono text-teal-700 text-sm">
                    {formatINR(totals.payments)}
                  </td>
                  <td className="p-4 text-right font-mono text-purple-700 text-sm">
                    {formatINR(totals.returns)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ============ MOBILE CARD VIEW ============ */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin mx-auto text-emerald-700 mb-2" size={24} />
            <p className="font-bold text-xs text-slate-500">डेटा लोड हो रहा है...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-400 font-medium text-xs">
              इस फिल्टर के लिए कोई रिकॉर्ड नहीं मिला।
            </p>
          </div>
        ) : (
          <>
            {filtered.map((r, idx) => (
              <div
                key={r.farmer_uuid}
                className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm active:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="shrink-0 w-6 h-6 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-[10px] font-black">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 text-sm truncate">{r.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.farmer_code}
                        </span>
                        <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                          <MapPin size={9} /> {r.village}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Bills</p>
                    <p className="font-mono font-black text-slate-800 text-sm">{r.bills}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                    <p className="text-[8px] font-black text-blue-700 uppercase leading-tight mb-1">
                      Sales
                    </p>
                    <p className="font-mono font-black text-blue-900 text-[10px] break-all leading-tight">
                      {r.sales_amount > 0 ? formatINRCompact(r.sales_amount) : '—'}
                    </p>
                  </div>

                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-center">
                    <p className="text-[8px] font-black text-teal-700 uppercase leading-tight mb-1">
                      Payments
                    </p>
                    <p className="font-mono font-black text-teal-900 text-[10px] break-all leading-tight">
                      {r.payment_amount > 0 ? formatINRCompact(r.payment_amount) : '—'}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                    <p className="text-[8px] font-black text-purple-700 uppercase leading-tight mb-1">
                      Returns
                    </p>
                    <p className="font-mono font-black text-purple-900 text-[10px] break-all leading-tight">
                      {r.return_amount > 0 ? formatINRCompact(r.return_amount) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-900 rounded-2xl p-3 mt-3">
              <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wide mb-2 text-center">
                Total (Filtered) — {filtered.length} Farmers
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-2 text-center">
                  <p className="text-[8px] font-black text-blue-700 uppercase mb-0.5">Sales</p>
                  <p className="font-mono font-black text-blue-900 text-[10px] break-all">
                    {formatINRCompact(totals.sales)}
                  </p>
                </div>
                <div className="bg-teal-100 border border-teal-300 rounded-lg p-2 text-center">
                  <p className="text-[8px] font-black text-teal-700 uppercase mb-0.5">Payments</p>
                  <p className="font-mono font-black text-teal-900 text-[10px] break-all">
                    {formatINRCompact(totals.payments)}
                  </p>
                </div>
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-2 text-center">
                  <p className="text-[8px] font-black text-purple-700 uppercase mb-0.5">Returns</p>
                  <p className="font-mono font-black text-purple-900 text-[10px] break-all">
                    {formatINRCompact(totals.returns)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}