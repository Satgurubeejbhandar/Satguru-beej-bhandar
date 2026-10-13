// src/pages/admin/GSTCalculation.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  FileText, 
  Printer, 
  RefreshCw, 
  Loader2, 
  ShieldAlert, 
  Calendar, 
  ArrowUpRight, 
  Scale, 
  AlertTriangle 
} from 'lucide-react'
import toast from 'react-hot-toast'
import { round2, safeNum as libSafeNum } from '../../lib/round'

interface GstReportData {
  period: { start: string | null; end: string | null }
  purchases: { taxable: number; cgst: number; sgst: number; igst: number; total_tax: number; total_amount: number }
  gst_sales: { count: number; taxable: number; cgst: number; sgst: number; igst: number; total_tax: number; total_amount: number }
  estimate_sales: { count: number; total_amount: number }
  net_gst_payable: { cgst: number; sgst: number; igst: number; total: number }
  rate_breakdown: { gst_percent: number; taxable: number; tax_amount: number }[]
}

function safeNum(val: unknown): number {
  return round2(libSafeNum(val))
}

function formatINR(val: number | null | undefined): string {
  return safeNum(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getFinancialYearDates(): { start: string; end: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  let startYear = currentYear
  if (currentMonth < 3) { startYear = currentYear - 1 }
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` }
}

export default function GSTCalculation() {
  const { role, loading: authLoading } = useAuth()
  const defaultFY = useRef(getFinancialYearDates())
  const [startDate, setStartDate] = useState(defaultFY.current.start)
  const [endDate, setEndDate] = useState(defaultFY.current.end)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<GstReportData | null>(null)

  const isMounted = useRef(true)

  const loadReport = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_gst_summary', {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      })
      if (error) throw error
      if (isMounted.current) setReport(data as GstReportData)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Error'
      toast.error('GST Report error: ' + msg)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    isMounted.current = true
    if (role === 'admin') void loadReport()
    return () => { isMounted.current = false }
  }, [loadReport, role])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास जीएसटी गणना रिपोर्ट देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/30 min-h-screen font-sans">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <FileText className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              GST Calculation &amp; Returns
            </h1>
          </div>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium">
            Input Tax Credit (ITC) vs Output Tax Liability (GST Bills Only)
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button 
            onClick={() => void loadReport()} 
            disabled={loading}
            className="flex-1 md:flex-none px-4 py-3 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 hover:text-white disabled:opacity-50 disabled:pointer-events-none font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-emerald-700/50 transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            Refresh
          </button>
          <button 
            onClick={() => window.print()} 
            className="flex-1 md:flex-none px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/15 cursor-pointer"
          >
            <Printer size={15} /> 
            Print Report
          </button>
        </div>
      </div>

      {/* Date Range Selector Panel */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold print-hidden">
        <span className="text-slate-500 flex items-center gap-1.5"><Calendar size={15} /> Date Range:</span>
        <div className="flex items-center gap-2 flex-1 sm:flex-none">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-full sm:w-auto p-2.5 border border-slate-200 rounded-xl font-mono text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-slate-50/50 transition" 
          />
          <span className="text-slate-400 font-bold px-1">to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-full sm:w-auto p-2.5 border border-slate-200 rounded-xl font-mono text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-slate-50/50 transition" 
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-20 text-center text-slate-500 space-y-3">
          <Loader2 className="animate-spin mx-auto text-emerald-800" size={32} /> 
          <p className="font-bold text-xs sm:text-sm">Calculating GST Liabilities...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          
          {/* Dual Tax Box Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* INPUT TAX CREDIT (PURCHASES) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-emerald-100 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-emerald-900 border-b border-emerald-100 pb-3 flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">📥</span> 
                Input Tax Credit (GST Purchases)
              </h3>
              <div className="space-y-3 text-xs sm:text-sm font-semibold text-slate-700">
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">Total Taxable Purchase:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.purchases.taxable)}</span>
                </div>
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">Input CGST:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.purchases.cgst)}</span>
                </div>
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">Input SGST:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.purchases.sgst)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-dashed border-emerald-100 pt-3 mt-3 font-black text-emerald-850 text-xs sm:text-sm">
                  <span>Total Input Tax Credit (ITC):</span>
                  <span className="font-mono text-sm sm:text-base">₹{formatINR(report.purchases.total_tax)}</span>
                </div>
              </div>
            </div>

            {/* OUTPUT TAX LIABILITY (GST BILLS ONLY) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-rose-100 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-rose-900 border-b border-rose-100 pb-3 flex items-center gap-2">
                <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg shrink-0">📤</span> 
                Output Tax Liability (GST Bills: {report.gst_sales.count})
              </h3>
              <div className="space-y-3 text-xs sm:text-sm font-semibold text-slate-700">
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">GST Taxable Sales:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.gst_sales.taxable)}</span>
                </div>
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">Output CGST:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.gst_sales.cgst)}</span>
                </div>
                <div className="flex justify-between items-center gap-2 py-0.5">
                  <span className="text-slate-500">Output SGST:</span>
                  <span className="font-mono font-bold text-slate-900">₹{formatINR(report.gst_sales.sgst)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-dashed border-rose-100 pt-3 mt-3 font-black text-rose-850 text-xs sm:text-sm">
                  <span>Total Output Tax Liability:</span>
                  <span className="font-mono text-sm sm:text-base">₹{formatINR(report.gst_sales.total_tax)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* NET GST PAYABLE */}
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6 border border-emerald-800">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
                <Scale size={13} /> Net GST Payable (Output - Input)
              </span>
              <p className="text-2xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight leading-none">
                ₹{formatINR(report.net_gst_payable.total)}
              </p>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-col gap-3 md:gap-1 text-center md:text-right text-xs text-emerald-200 font-bold border-t border-emerald-800/60 md:border-t-0 pt-4 md:pt-0">
              <div className="space-y-1">
                <p className="text-[10px] text-emerald-400 uppercase">CGST Payable</p>
                <p className="font-mono text-sm sm:text-base text-white">₹{formatINR(report.net_gst_payable.cgst)}</p>
              </div>
              <div className="space-y-1 md:mt-2">
                <p className="text-[10px] text-emerald-400 uppercase">SGST Payable</p>
                <p className="font-mono text-sm sm:text-base text-white">₹{formatINR(report.net_gst_payable.sgst)}</p>
              </div>
            </div>
          </div>

          {/* Rate Breakdown Table (Gst Percentage Wise) */}
          {report.rate_breakdown && report.rate_breakdown.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 bg-emerald-950 text-white font-bold text-xs sm:text-sm flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <ArrowUpRight size={18} className="text-amber-400 shrink-0" /> 
                  GST Rate-wise Breakdown
                </span>
                <span className="font-mono text-emerald-300 text-xs bg-emerald-900/50 px-2.5 py-1 rounded-md">
                  {report.rate_breakdown.length} Slugs
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-100">
                      <th className="p-3.5 pl-6">Tax Rate</th>
                      <th className="p-3.5 text-right">Taxable Amount</th>
                      <th className="p-3.5 text-right pr-6">Calculated Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {report.rate_breakdown.map((row) => (
                      <tr key={row.gst_percent} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 pl-6 font-mono font-bold text-slate-900">{row.gst_percent}% GST</td>
                        <td className="p-3.5 text-right font-mono">₹{formatINR(row.taxable)}</td>
                        <td className="p-3.5 text-right pr-6 font-mono font-bold text-emerald-800">₹{formatINR(row.tax_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STRICTLY EXCLUDED ESTIMATE SALES BOX */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-3xl text-xs sm:text-sm text-amber-950 space-y-2 shadow-sm">
            <h4 className="font-extrabold text-amber-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              Estimate Sales (कच्चा बिल) — STRICTLY EXCLUDED FROM GST
            </h4>
            <div className="space-y-1.5 font-medium text-slate-700">
              <p>
                कच्चे बिलों की कुल बिक्री: <strong className="font-mono text-base font-black text-slate-900">₹{formatINR(report.estimate_sales.total_amount)}</strong> ({report.estimate_sales.count} Bills)
              </p>
              <p className="text-[10px] sm:text-xs text-amber-800/95 font-bold leading-relaxed">
                * यह राशि पूरी तरह से गैर-जीएसटी (Non-GST) है और इसे आपके मुख्य टर्नओवर या किसी भी टैक्स लायबिलिटी की गणना में शामिल नहीं किया गया है।
              </p>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  )
}