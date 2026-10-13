// src/pages/admin/ExpiryReport.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Clock, RefreshCw, Download, Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Package, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Strict Type Definition ───────────────────────────────────────────
type ExpiryBatchRow = {
  id: string
  batch_number: string | null
  quantity_available: number | string
  purchase_rate: number | string | null
  expiry_date: string
  is_expired: boolean
  product?: {
    product_name: string
    sku: string | null
  } | null
  company?: {
    company_name: string
  } | null
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

function getDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 0
  const parts = expiryDateStr.split('-')
  if (parts.length !== 3) return 0

  const expYear = parseInt(parts[0], 10)
  const expMonth = parseInt(parts[1], 10) - 1
  const expDay = parseInt(parts[2], 10)

  const expDate = new Date(expYear, expMonth, expDay)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expDate.setHours(0, 0, 0, 0)

  const diffMs = expDate.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
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

function escapeCSV(value: string | number | null | undefined): string {
  const safe = String(value ?? '').replace(/"/g, '""')
  if (/^[=+\-@]/.test(safe)) {
    return `"'${safe}"`
  }
  return `"${safe}"`
}

export default function ExpiryReport() {
  const { role, loading: authLoading } = useAuth()
  const [days, setDays] = useState<number>(60)
  const [rows, setRows] = useState<ExpiryBatchRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)

      const startDate = getLocalDateString(0)
      const endDate = getLocalDateString(days)

      const allBatches: ExpiryBatchRow[] = []
      let page = 0
      const pageSize = 1000
      let fetchMore = true

      while (fetchMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await supabase
          .from('inventory_batches')
          .select('id, batch_number, quantity_available, purchase_rate, expiry_date, is_expired, product:products(product_name, sku), company:companies(company_name)')
          .gt('quantity_available', 0)
          .eq('is_expired', false)
          .gte('expiry_date', startDate)
          .lte('expiry_date', endDate)
          .order('expiry_date', { ascending: true })
          .range(from, to)

        if (error) throw error

        if (!isMountedRef.current) return

        if (data && data.length > 0) {
          allBatches.push(...(data as unknown as ExpiryBatchRow[]))
        }

        fetchMore = (data?.length ?? 0) === pageSize
        page++
      }

      if (isMountedRef.current) {
        setRows(allBatches)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load expiry report'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [days, role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      load()
    }
  }, [load, role, authLoading])

  const totalValue = useMemo(() => {
    return rows.reduce((sum, r) => {
      const qty = safeNum(r.quantity_available)
      const rate = safeNum(r.purchase_rate)
      return sum + qty * rate
    }, 0)
  }, [rows])

  const exportToCSV = () => {
    if (rows.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = ['Product', 'SKU', 'Company', 'Batch Number', 'Qty Available', 'Expiry Date', 'Days Left', 'Purchase Rate', 'Total Value']
    const csvRows = [
      headers.join(','),
      ...rows.map((r) => {
        const pName = escapeCSV(r.product?.product_name || '')
        const sku = escapeCSV(r.product?.sku || '')
        const company = escapeCSV(r.company?.company_name || '')
        const batch = escapeCSV(r.batch_number || '')
        const qty = safeNum(r.quantity_available)
        const expiry = escapeCSV(r.expiry_date || '')
        const daysLeft = getDaysRemaining(r.expiry_date)
        const rate = safeNum(r.purchase_rate)
        const val = (qty * rate).toFixed(2)

        return [pName, sku, company, batch, qty, expiry, daysLeft, rate, val].join(',')
      }),
    ]

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Expiry_Report_${days}Days_${getLocalDateString(0)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV Report downloaded successfully')
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Expiry Report dekhne ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-3 py-4 md:p-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-5 md:p-6 rounded-3xl shadow-xl flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
            <Clock className="text-amber-400 shrink-0" size={26} /> Expiry Risk Report
          </h1>
          <p className="text-emerald-200 text-xs mt-1 leading-relaxed">
            Identify near-expiry stock to prioritize FEFO sales or vendor returns
          </p>
        </div>

        {/* Action Controls for Select, Refresh, and Export */}
        <div className="grid grid-cols-1 sm:flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Select expiry window days"
            className="w-full sm:w-auto rounded-xl px-3 py-2.5 sm:py-2 bg-white text-slate-900 text-xs font-extrabold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer border-0"
          >
            <option value={15}>Next 15 Days</option>
            <option value={30}>Next 30 Days</option>
            <option value={60}>Next 60 Days</option>
            <option value={90}>Next 90 Days</option>
            <option value={180}>Next 180 Days</option>
          </select>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={load}
              aria-label="Refresh expiry report"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>

            <button
              type="button"
              disabled={loading || rows.length === 0}
              onClick={exportToCSV}
              aria-label="Export expiry report as CSV"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-emerald-800 hover:bg-emerald-700 disabled:bg-emerald-950/55 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border border-emerald-700 active:scale-95 disabled:opacity-50"
              title="Download Excel CSV"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Financial Impact Metric Box */}
      <div className="bg-white p-4 md:p-5 rounded-3xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] md:text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Near-Expiry At Risk Value ({days} Days Window)
            </p>
            <p className="text-xl md:text-2xl font-black text-slate-900 mt-0.5 font-mono">
              ₹{formatINR(totalValue)}
            </p>
          </div>
        </div>

        <div className="flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-amber-100">
          <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">At-Risk Batches</span>
          <span className="text-lg md:text-xl font-black text-amber-800 font-mono">{rows.length}</span>
        </div>
      </div>

      {/* Main Container - Conditional Rendering for Screen Sizes */}
      <div>
        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
            <Loader2 size={32} className="animate-spin mx-auto text-emerald-600 mb-3" />
            <p className="text-xs font-bold text-slate-600">Analyzing near-expiry inventory...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && rows.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-3" />
            <p className="font-bold text-slate-800 text-sm">No Batches Expiring Soon</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No stock batches found expiring within the selected {days}-day window.
            </p>
          </div>
        )}

        {/* Data Present States */}
        {!loading && rows.length > 0 && (
          <>
            {/* DESKTOP VIEW: Structured Table (Hidden on Mobile) */}
            <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse" aria-label="Near-expiry stock batches table">
                  <thead>
                    <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                      <th scope="col" className="p-3.5">Product</th>
                      <th scope="col" className="p-3.5">Company</th>
                      <th scope="col" className="p-3.5">Batch</th>
                      <th scope="col" className="p-3.5 text-center">Available Qty</th>
                      <th scope="col" className="p-3.5">Expiry Date</th>
                      <th scope="col" className="p-3.5">Time Left</th>
                      <th scope="col" className="p-3.5 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rows.map((r) => {
                      const qty = safeNum(r.quantity_available)
                      const rate = safeNum(r.purchase_rate)
                      const rowVal = qty * rate
                      const daysLeft = getDaysRemaining(r.expiry_date)

                      let badgeStyle = 'bg-slate-100 text-slate-700'
                      if (daysLeft <= 15) {
                        badgeStyle = 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                      } else if (daysLeft <= 30) {
                        badgeStyle = 'bg-amber-100 text-amber-900 font-bold border border-amber-200'
                      }

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">
                            {r.product?.product_name || '—'}
                            {r.product?.sku && (
                              <span className="block text-[10px] text-slate-400 font-mono font-normal">
                                SKU: {r.product.sku}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-600">{r.company?.company_name || '—'}</td>
                          <td className="p-3.5 font-mono text-slate-800 font-bold">
                            {r.batch_number || '—'}
                          </td>
                          <td className="p-3.5 font-black text-center text-slate-900 text-sm font-mono">{qty}</td>
                          <td className="p-3.5 font-mono font-bold text-slate-800">{r.expiry_date}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] inline-block font-mono ${badgeStyle}`}>
                              {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Expires Today' : `${daysLeft} days left`}
                            </span>
                          </td>
                          <td className="p-3.5 font-black text-right text-slate-900 font-mono">
                            ₹{formatINR(rowVal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE VIEW: Cards Layout (Hidden on Desktop) */}
            <div className="block md:hidden space-y-3">
              {rows.map((r) => {
                const qty = safeNum(r.quantity_available)
                const rate = safeNum(r.purchase_rate)
                const rowVal = qty * rate
                const daysLeft = getDaysRemaining(r.expiry_date)

                let badgeStyle = 'bg-slate-100 text-slate-600'
                if (daysLeft <= 15) {
                  badgeStyle = 'bg-rose-100 text-rose-800 font-bold border border-rose-100'
                } else if (daysLeft <= 30) {
                  badgeStyle = 'bg-amber-100 text-amber-900 font-bold border border-amber-100'
                }

                return (
                  <div
                    key={r.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5"
                  >
                    {/* Card Title Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase block">
                          {r.company?.company_name || 'Unknown Brand'}
                        </span>
                        <h2 className="text-sm font-black text-slate-950 leading-tight">
                          {r.product?.product_name || '—'}
                        </h2>
                        {r.product?.sku && (
                          <span className="inline-block text-[10px] text-slate-500 font-mono">
                            SKU: {r.product.sku}
                          </span>
                        )}
                      </div>

                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono shrink-0 ${badgeStyle}`}>
                        {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Expires Today' : `${daysLeft}d left`}
                      </span>
                    </div>

                    {/* Quick Metric Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase font-bold tracking-wider">
                          Batch Number
                        </span>
                        <span className="font-mono font-bold text-slate-800">{r.batch_number || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase font-bold tracking-wider">
                          Expiry Date
                        </span>
                        <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                          <Calendar size={10} className="text-slate-500" />
                          {r.expiry_date}
                        </span>
                      </div>
                    </div>

                    {/* Stock Quantity & Financial Value */}
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Package size={14} className="text-slate-400" />
                        <span>Qty: <strong className="font-mono font-black text-slate-950">{qty}</strong></span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[9px] block uppercase font-bold">Total Stock Value</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ₹{formatINR(rowVal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}