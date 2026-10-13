// src/pages/admin/CompanyPurchaseSummary.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Building2,
  RefreshCw,
  FileText,
  Search,
  AlertCircle,
  Download,
  X,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface CompanySummary {
  company_id: string
  company_name: string
  mobile: string
  gstin: string
  bills: number
  opening_balance: number
  total_purchase: number
  total_payment: number
  total_return: number
  closing_balance: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function escapeCSV(value: string): string {
  const safe = String(value ?? '').replace(/"/g, '""')
  if (/^[=+\-@]/.test(safe)) {
    return `"'${safe}"`
  }
  return `"${safe}"`
}

/* ---- Paginated Chunk Fetchers to Bypass 1000-row Truncation Limit ---- */
async function fetchAllUdhaarPurchases(): Promise<any[]> {
  const list: any[] = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select('company_id, total_amount')
      .eq('bill_type', 'udhaar')
      .eq('purchase_status', 'active')
      .range(from, from + size - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    list.push(...data)
    if (data.length < size) break
    from += size
  }
  return list
}

async function fetchAllCompanyPayments(): Promise<any[]> {
  const list: any[] = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('company_payments')
      .select('company_id, payment_amount')
      .range(from, from + size - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    list.push(...data)
    if (data.length < size) break
    from += size
  }
  return list
}

async function fetchAllPurchaseReturns(): Promise<any[]> {
  const list: any[] = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('purchase_returns')
      .select('company_id, total_amount')
      .eq('return_status', 'completed')
      .range(from, from + size - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    list.push(...data)
    if (data.length < size) break
    from += size
  }
  return list
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CompanyPurchaseSummary() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const isMountedRef = useRef(true)

  /* ---- Data Load & Aggregation ---- */

  const loadSummary = useCallback(async () => {
    if (role !== 'admin') return

    const currentRequestId = ++requestIdRef.current
    setLoading(true)
    setFetchError(null)

    try {
      // ── Enforce 100% safe, paginated, double-check bypass loops ──
      const [compRes, rawPurchases, rawPayments, rawReturns] = await Promise.all([
        supabase.from('companies').select('id, company_name, mobile, gstin, opening_balance, opening_balance_type'),
        fetchAllUdhaarPurchases(),
        fetchAllCompanyPayments(),
        fetchAllPurchaseReturns()
      ])

      if (compRes.error) throw compRes.error

      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) return

      const aggregationMap = new Map<string, CompanySummary>()

      // 1. Initialise Map
      for (const c of (compRes.data || [])) {
        let openBal = toNumber(c.opening_balance)
        if (c.opening_balance_type === 'receivable') openBal = -openBal

        aggregationMap.set(c.id, {
          company_id: c.id,
          company_name: c.company_name || 'Unregistered / Unknown Supplier',
          mobile: c.mobile || '',
          gstin: c.gstin || '',
          opening_balance: openBal,
          total_purchase: 0,
          total_payment: 0,
          total_return: 0,
          closing_balance: 0,
          bills: 0
        })
      }

      // 2. Aggregate Purchases
      for (const p of rawPurchases) {
        const key = p.company_id || 'orphaned_or_deleted'
        const existing = aggregationMap.get(key)
        if (existing) {
          existing.total_purchase += toNumber(p.total_amount)
          existing.bills += 1
        }
      }

      // 3. Aggregate Payments
      for (const p of rawPayments) {
        if (!p.company_id) continue
        const existing = aggregationMap.get(p.company_id)
        if (existing) {
          existing.total_payment += toNumber(p.payment_amount)
        }
      }

      // 4. Aggregate Returns
      for (const r of rawReturns) {
        if (!r.company_id) continue
        const existing = aggregationMap.get(r.company_id)
        if (existing) {
          existing.total_return += toNumber(r.total_amount)
        }
      }

      // 5. Final Calculation
      const sortedRows = Array.from(aggregationMap.values()).map(r => {
        r.closing_balance = r.opening_balance + r.total_purchase - r.total_payment - r.total_return
        return r
      }).sort((a, b) => b.closing_balance - a.closing_balance)

      setRows(sortedRows)
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) return
      setFetchError('डेटा लोड करने में असमर्थ। कृपया नेटवर्क की जाँच करें।')
    } finally {
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadSummary()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [loadSummary, role, authLoading])

  const filteredRows = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()
    if (!query) return rows

    return rows.filter(
      (r) =>
        r.company_name.toLowerCase().includes(query) ||
        r.mobile.includes(query) ||
        r.gstin.toLowerCase().includes(query)
    )
  }, [rows, searchTerm])

  const grandTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, curr) => {
        acc.opening += curr.opening_balance
        acc.purchase += curr.total_purchase
        acc.payment += curr.total_payment
        acc.return += curr.total_return
        acc.closing += curr.closing_balance
        acc.bills += curr.bills
        return acc
      },
      { opening: 0, purchase: 0, payment: 0, return: 0, closing: 0, bills: 0 }
    )
  }, [filteredRows])

  const exportToCSV = useCallback(() => {
    if (filteredRows.length === 0) {
      toast.error('Export करने के लिए कोई डेटा नहीं है')
      return
    }

    const header =
      'Company Name,GSTIN,Mobile,Bills Count,Opening Bal,Total Purchase (Cr),Total Payment (Dr),Total Return (Dr),Closing Bal\n'

    const body = filteredRows
      .map(
        (r) =>
          [
            escapeCSV(r.company_name),
            escapeCSV(r.gstin),
            escapeCSV(r.mobile),
            r.bills,
            r.opening_balance.toFixed(2),
            r.total_purchase.toFixed(2),
            r.total_payment.toFixed(2),
            r.total_return.toFixed(2),
            r.closing_balance.toFixed(2),
          ].join(',')
      )
      .join('\n')

    const blob = new Blob(['\uFEFF' + header + body], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Sundry_Creditors_Summary_${new Date().toISOString().slice(0, 10)}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Excel/CSV रिपोर्ट डाउनलोड हो गई!')
  }, [filteredRows])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Company Purchase Summary की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-amber-400 shrink-0" size={26} aria-hidden="true" />
            Company Purchase Summary
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Tally-style Sundry Creditors &amp; Outstanding Balances
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={loading || filteredRows.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 border border-emerald-700/50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <Download size={14} aria-hidden="true" /> Export CSV
          </button>
          <button
            type="button"
            onClick={loadSummary}
            disabled={loading}
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={16}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search by Company Name, Mobile or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all text-slate-800"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {!loading && (
          <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 font-bold shrink-0 whitespace-nowrap font-mono">
            {filteredRows.length} / {rows.length} companies
          </span>
        )}
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-800 font-bold">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} aria-hidden="true" /> {fetchError}
          </span>
          <button
            type="button"
            onClick={loadSummary}
            className="underline hover:text-red-950 ml-4 shrink-0 font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[850px]" aria-label="Company purchase summary">
            <thead>
              <tr className="bg-emerald-900 text-white font-bold tracking-wider uppercase text-[10px]">
                <th scope="col" className="p-4 w-10 text-center">#</th>
                <th scope="col" className="p-4 whitespace-nowrap">Supplier Company</th>
                <th scope="col" className="p-4 text-center">Bills</th>
                <th scope="col" className="p-4 text-right whitespace-nowrap">Opening Bal</th>
                <th scope="col" className="p-4 text-right whitespace-nowrap text-rose-300">Purchase (Cr)</th>
                <th scope="col" className="p-4 text-right whitespace-nowrap text-emerald-300">Payment (Dr)</th>
                <th scope="col" className="p-4 text-right whitespace-nowrap text-purple-300">Return (Dr)</th>
                <th scope="col" className="p-4 text-right whitespace-nowrap text-amber-300">Closing Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-400">
                    <RefreshCw className="animate-spin mx-auto text-emerald-800 mb-2" size={24} />
                    <span>Calculating supplier balances…</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-400">
                    <FileText className="mx-auto text-slate-300 mb-2" size={32} />
                    <span>No records found.</span>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredRows.map((r, idx) => {
                    const isOrphan = r.company_id === 'orphaned_or_deleted'
                    return (
                      <tr key={r.company_id} className={`hover:bg-slate-50/80 transition-colors ${isOrphan ? 'bg-amber-50/40' : ''}`}>
                        <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-4">
                          <p className="font-bold text-emerald-900 text-sm">{r.company_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            GST: {r.gstin || '—'} {r.mobile ? `| Ph: ${r.mobile}` : ''}
                          </p>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-900 font-mono">{r.bills}</td>
                        <td className="p-4 text-right font-mono text-slate-600 whitespace-nowrap">
                          ₹{formatINR(r.opening_balance)} <span className="text-[9px]">{r.opening_balance >= 0 ? 'Cr' : 'Dr'}</span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {r.total_purchase > 0 ? `₹${formatINR(r.total_purchase)}` : '—'}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {r.total_payment > 0 ? `₹${formatINR(r.total_payment)}` : '—'}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-purple-700 whitespace-nowrap">
                          {r.total_return > 0 ? `₹${formatINR(r.total_return)}` : '—'}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                          ₹{formatINR(r.closing_balance)} <span className="text-[10px]">{r.closing_balance >= 0 ? 'Cr' : 'Dr'}</span>
                        </td>
                      </tr>
                    )
                  })}

                  <tr className="bg-emerald-50 border-t-2 border-emerald-950 font-black text-emerald-950 text-sm">
                    <td className="p-4 text-center font-mono">—</td>
                    <td className="p-4 uppercase">
                      Grand Total (कुल योग) · {filteredRows.length}{' '}
                      {filteredRows.length === 1 ? 'Company' : 'Companies'}
                    </td>
                    <td className="p-4 text-center font-mono">{grandTotals.bills}</td>
                    <td className="p-4 text-right font-mono text-xs whitespace-nowrap">
                      ₹{formatINR(grandTotals.opening)} {grandTotals.opening >= 0 ? 'Cr' : 'Dr'}
                    </td>
                    <td className="p-4 text-right text-rose-700 font-mono whitespace-nowrap">₹{formatINR(grandTotals.purchase)}</td>
                    <td className="p-4 text-right text-emerald-700 font-mono whitespace-nowrap">₹{formatINR(grandTotals.payment)}</td>
                    <td className="p-4 text-right text-purple-700 font-mono whitespace-nowrap">₹{formatINR(grandTotals.return)}</td>
                    <td className="p-4 text-right text-base font-mono whitespace-nowrap text-slate-900">
                      ₹{formatINR(grandTotals.closing)} {grandTotals.closing >= 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}