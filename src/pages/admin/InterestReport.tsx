// src/pages/admin/InterestReport.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Percent, RefreshCw, Download, Loader2, Calendar, FileText, ShieldCheck, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Farmer {
  farmer_name: string
  farmer_id: string
  village?: string | null
}

interface InterestRecord {
  id: string
  farmer_id: string
  principal_amount: number | string
  overdue_days: number | string
  interest_rate: number | string
  interest_amount: number | string
  calculation_date: string | null
  created_at: string
  farmer?: Farmer | null
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

function escapeCSV(value: string | number | null | undefined): string {
  const safe = String(value ?? '').replace(/"/g, '""')
  if (/^[=+\-@]/.test(safe)) {
    return `"'${safe}"`
  }
  return `"${safe}"`
}

export default function InterestReport() {
  const [rows, setRows] = useState<InterestRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('interest_records')
        .select('id, farmer_id, principal_amount, overdue_days, interest_rate, interest_amount, calculation_date, created_at, farmer:farmers(farmer_name, farmer_id, village)')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      if (isMountedRef.current) {
        setRows((data as unknown as InterestRecord[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load interest records'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows
    const term = searchTerm.toLowerCase().trim()
    return rows.filter(
      (r) =>
        (r.farmer?.farmer_name || '').toLowerCase().includes(term) ||
        (r.farmer?.farmer_id || '').toLowerCase().includes(term) ||
        (r.farmer?.village || '').toLowerCase().includes(term)
    )
  }, [rows, searchTerm])

  const totalInterest = useMemo(() => {
    return filteredRows.reduce((a, r) => a + safeNum(r.interest_amount), 0)
  }, [filteredRows])

  const totalPrincipal = useMemo(() => {
    return filteredRows.reduce((a, r) => a + safeNum(r.principal_amount), 0)
  }, [filteredRows])

  const exportToCSV = () => {
    if (filteredRows.length === 0) {
      toast.error('No records available to export')
      return
    }

    const headers = ['Farmer Name', 'Farmer ID', 'Village', 'Principal (INR)', 'Overdue Days', 'Rate (%)', 'Interest Amount (INR)', 'Calculation Date']
    const csvLines = [
      headers.join(','),
      ...filteredRows.map((r) => [
        escapeCSV(r.farmer?.farmer_name || 'N/A'),
        escapeCSV(r.farmer?.farmer_id || 'N/A'),
        escapeCSV(r.farmer?.village || 'N/A'),
        safeNum(r.principal_amount),
        safeNum(r.overdue_days),
        safeNum(r.interest_rate),
        safeNum(r.interest_amount),
        escapeCSV(r.calculation_date || 'N/A'),
      ].join(',')),
      `\n"TOTAL",,,${totalPrincipal},,,${totalInterest},`,
    ]

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Interest_Report_${getLocalDateString(0)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Interest report exported to CSV! 📊')
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Percent className="text-amber-400 shrink-0" size={28} /> Interest Report
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Overdue interest audit log &amp; calculation summary
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={loading || filteredRows.length === 0}
            aria-label="Export interest report as CSV"
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border border-emerald-700 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh interest report"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Interest Charged ({filteredRows.length} Records)
            </span>
            <span className="text-xl font-black text-amber-700 font-mono">
              ₹{formatINR(totalInterest)}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Percent size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Overdue Principal Base
            </span>
            <span className="text-xl font-black text-slate-800 font-mono">
              ₹{formatINR(totalPrincipal)}
            </span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <FileText size={20} />
          </div>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search by farmer name, ID, or village..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search interest records"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[600px]" aria-label="Interest records report table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                <th scope="col" className="p-4">Farmer Details</th>
                <th scope="col" className="p-4 text-right">Principal Base</th>
                <th scope="col" className="p-4 text-center">Overdue Days</th>
                <th scope="col" className="p-4 text-center">Rate (%)</th>
                <th scope="col" className="p-4 text-right">Interest Amount</th>
                <th scope="col" className="p-4 text-center">Calculation Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2 font-medium">
                      <Loader2 className="animate-spin text-emerald-600" size={20} />
                      Loading interest calculations...
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    No interest records found {searchTerm ? `matching "${searchTerm}"` : ''}.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const farmerName = r.farmer?.farmer_name || 'Unknown Farmer'
                  const farmerCode = r.farmer?.farmer_id || 'N/A'
                  const village = r.farmer?.village ? `(${r.farmer.village})` : ''

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 text-sm">{farmerName}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {farmerCode} <span className="text-slate-500 font-sans">{village}</span>
                        </p>
                      </td>
                      <td className="p-4 font-bold text-slate-700 text-right font-mono">
                        ₹{formatINR(r.principal_amount)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full font-black text-[11px] font-mono">
                          {safeNum(r.overdue_days)} Days
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-600 font-mono">
                        {safeNum(r.interest_rate)}%
                      </td>
                      <td className="p-4 font-black text-amber-700 text-sm text-right font-mono">
                        ₹{formatINR(r.interest_amount)}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px] text-center">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {r.calculation_date || 'N/A'}
                        </span>
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