// src/pages/admin/ReportsHub.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart3,
  Users,
  Package,
  IndianRupee,
  AlertTriangle,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions & Diagnostics Interface                          */
/* ------------------------------------------------------------------ */

interface ReportData {
  totalFarmers: number
  totalOutstanding: number
  totalStockValue: number
  todaySales: number
  todayPayments: number
  overdueCount: number
  lowStockCount: number
}

interface DiagnosticInfo {
  tableName: string
  status: 'SUCCESS' | 'FAILED' | 'EMPTY'
  rowCount: number
  detectedColumns: string[]
  errorDetails?: string
}

const INITIAL_REPORT: ReportData = {
  totalFarmers: 0,
  totalOutstanding: 0,
  totalStockValue: 0,
  todaySales: 0,
  todayPayments: 0,
  overdueCount: 0,
  lowStockCount: 0,
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                  */
/* ------------------------------------------------------------------ */

function extractNumericFuzzy(obj: Record<string, any> | null | undefined, keywords: string[]): number {
  if (!obj) return 0
  for (const key of keywords) {
    if (key in obj && obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
      const val = parseFloat(String(obj[key]))
      if (!Number.isNaN(val)) return val
    }
  }
  const objKeys = Object.keys(obj)
  for (const k of objKeys) {
    const lowerKey = k.toLowerCase()
    for (const kw of keywords) {
      if (lowerKey.includes(kw)) {
        const val = parseFloat(String(obj[k]))
        if (!Number.isNaN(val)) return val
      }
    }
  }
  return 0
}

function extractDateFuzzy(obj: Record<string, any> | null | undefined, keywords: string[]): string | null {
  if (!obj) return null
  for (const key of keywords) {
    if (key in obj && obj[key]) return String(obj[key])
  }
  const objKeys = Object.keys(obj)
  for (const k of objKeys) {
    const lowerKey = k.toLowerCase()
    for (const kw of keywords) {
      if (lowerKey.includes(kw) && obj[k]) return String(obj[k])
    }
  }
  return null
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/* ------------------------------------------------------------------ */
/*  Table Fetcher for Diagnostics                                     */
/* ------------------------------------------------------------------ */
async function fetchFirstAvailableTable(
  possibleNames: string[],
  selectFields: string = '*',
  limit: number = 2000
): Promise<{ name: string; data: Record<string, any>[] | null; error: any }> {
  let lastError: any = null

  for (const name of possibleNames) {
    try {
      const { data, error } = await (supabase.from(name as any) as any)
        .select(selectFields)
        .limit(limit)

      if (!error && data) {
        return { name, data: data as Record<string, any>[], error: null }
      }
      lastError = error
    } catch (err) {
      lastError = err
    }
  }
  return { name: possibleNames[0], data: null, error: lastError || 'Table not found' }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportsHub() {
  const [loading, setLoading] = useState<boolean>(true)
  const [report, setReport] = useState<ReportData>(INITIAL_REPORT)
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo[]>([])
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false)
  
  const isMountedRef = useRef<boolean>(true)

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const currentDiagnostics: DiagnosticInfo[] = []
      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

      // ── Step 1: Query Tables for Diagnostics ────────
      const [farmersRes, salesRes, paymentsRes, creditRes, batchesRes] = await Promise.all([
        fetchFirstAvailableTable(['farmers'], '*'),
        fetchFirstAvailableTable(['sales_bills'], '*'),
        fetchFirstAvailableTable(['payments'], '*'),
        fetchFirstAvailableTable(['credit_accounts'], '*'),
        fetchFirstAvailableTable(['inventory_batches'], '*'),
      ])

      if (!isMountedRef.current) return

      const logDiagnostic = (res: { name: string; data: Record<string, any>[] | null; error: any }, defaultName: string) => {
        const rowCount = res.data ? res.data.length : 0
        const cols = res.data && res.data[0] ? Object.keys(res.data[0]) : []
        currentDiagnostics.push({
          tableName: res.name || defaultName,
          status: res.error ? 'FAILED' : rowCount > 0 ? 'SUCCESS' : 'EMPTY',
          rowCount,
          detectedColumns: cols,
          errorDetails: res.error ? JSON.stringify(res.error) : undefined,
        })
      }

      logDiagnostic(farmersRes, 'farmers')
      logDiagnostic(salesRes, 'sales_bills')
      logDiagnostic(paymentsRes, 'payments')
      logDiagnostic(creditRes, 'credit_accounts')
      logDiagnostic(batchesRes, 'inventory_batches')
      setDiagnostics(currentDiagnostics)

      // ── Step 2: FETCH TRUE STATS FROM RPC (Database Source of Truth) ──
      const { data: dbStats, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats')
      
      let overdueCount = 0
      
      // Calculate overdue farmers locally since RPC doesn't provide it yet
      const creditRows: Record<string, any>[] = creditRes.data || []
      if (creditRows.length > 0) {
        for (const row of creditRows) {
          const bal = extractNumericFuzzy(row, ['current_outstanding', 'outstanding', 'balance'])
          const dueDate = extractDateFuzzy(row, ['due_date'])
          if (bal > 0 && dueDate && dueDate < todayIST) {
            overdueCount++
          }
        }
      }

      if (rpcError) {
        throw new Error('Database RPC Failed: ' + rpcError.message)
      }

      // Set Exact Data matching the Dashboard
      setReport({
        totalFarmers: Number(dbStats?.activeFarmers || 0),
        totalOutstanding: Number(dbStats?.totalOutstanding || 0),
        totalStockValue: Number(dbStats?.totalStockValue || 0),
        todaySales: Number(dbStats?.todaySales || 0),
        todayPayments: Number(dbStats?.todayPayments || 0),
        lowStockCount: Number(dbStats?.lowStockCount || 0),
        overdueCount: overdueCount,
      })

    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'डैशबोर्ड डेटा लोड करने में त्रुटि'
      toast.error(msg)
      console.error('❌ Data Load Error:', err)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadReports()
    return () => {
      isMountedRef.current = false
    }
  }, [loadReports])

  const cards = [
    {
      title: 'Active Farmers',
      hindiTitle: 'सक्रिय किसान',
      value: report.totalFarmers.toLocaleString('en-IN'),
      icon: Users,
      color: 'border-l-indigo-500',
      bgColor: 'bg-indigo-50/50',
      iconColor: 'text-indigo-600',
      textColor: 'text-indigo-950',
    },
    {
      title: 'Total Outstanding',
      hindiTitle: 'कुल बकाया उधारी',
      value: `₹${formatINR(report.totalOutstanding)}`,
      icon: IndianRupee,
      color: 'border-l-rose-500',
      bgColor: 'bg-rose-50/50',
      iconColor: 'text-rose-600',
      textColor: 'text-rose-950',
    },
    {
      title: 'Stock Purchase Value',
      hindiTitle: 'कुल स्टॉक खरीद मूल्य',
      value: `₹${formatINR(report.totalStockValue)}`,
      icon: Package,
      color: 'border-l-emerald-500',
      bgColor: 'bg-emerald-50/50',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-950',
    },
    {
      title: "Today's Sales",
      hindiTitle: "आज की बिक्री",
      value: `₹${formatINR(report.todaySales)}`,
      icon: BarChart3,
      color: 'border-l-blue-500',
      bgColor: 'bg-blue-50/50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-950',
    },
    {
      title: "Today's Payments",
      hindiTitle: "आज का भुगतान संग्रह",
      value: `₹${formatINR(report.todayPayments)}`,
      icon: TrendingUp,
      color: 'border-l-teal-500',
      bgColor: 'bg-teal-50/50',
      iconColor: 'text-teal-600',
      textColor: 'text-teal-950',
    },
    {
      title: 'Overdue Farmers',
      hindiTitle: 'अतिदेय (समयपार) किसान',
      value: report.overdueCount.toLocaleString('en-IN'),
      icon: AlertTriangle,
      color: 'border-l-amber-500',
      bgColor: 'bg-amber-50/50',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-950',
    },
    {
      title: 'Low Stock Items',
      hindiTitle: 'कम स्टॉक वाले आइटम',
      value: report.lowStockCount.toLocaleString('en-IN'),
      icon: Package,
      color: 'border-l-orange-500',
      bgColor: 'bg-orange-50/50',
      iconColor: 'text-orange-600',
      textColor: 'text-orange-950',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/30 min-h-screen font-sans">
      
      {/* Banner Header */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <BarChart3 className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Reports Hub
            </h1>
          </div>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium">
            Real-time business snapshot matching exact database stats
          </p>
        </div>
        <button
          type="button"
          onClick={loadReports}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer transition-all shrink-0"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {loading ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>

      {/* Metric Cards Grid - Multi-Responsive columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="space-y-2 w-2/3">
                    <div className="h-2.5 bg-slate-200 rounded" />
                    <div className="h-2 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                </div>
                <div className="h-6 bg-slate-200 rounded w-3/4" />
              </div>
            ))
          : cards.map((c) => {
              const Icon = c.icon
              return (
                <div
                  key={c.title}
                  className={`bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm border-l-4 ${c.color} hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {c.title}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {c.hindiTitle}
                      </p>
                    </div>
                    <div className={`p-2.5 ${c.bgColor} ${c.iconColor} rounded-xl shrink-0`}>
                      <Icon size={18} />
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <p className={`text-xl sm:text-2xl font-black font-mono leading-none tracking-tight ${c.textColor}`}>
                      {c.value}
                    </p>
                  </div>
                </div>
              )
            })}
      </div>

      {/* Database Diagnostic Check Utility */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="w-full flex justify-between items-center text-slate-800 text-xs sm:text-sm font-bold uppercase tracking-wider outline-none"
        >
          <span className="flex items-center gap-2.5 text-slate-900">
            <Database size={18} className="text-emerald-700" />
            Database Schema Diagnostics ({diagnostics.length} Tables Scanned)
          </span>
          {showDiagnostics ? (
            <ChevronUp size={18} className="text-slate-500" />
          ) : (
            <ChevronDown size={18} className="text-slate-500" />
          )}
        </button>

        {showDiagnostics && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-start gap-2 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-150">
              <span className="text-base">💡</span>
              <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed font-medium">
                यह सिस्टम आपके डेटाबेस तालिकाओं का वास्तविक समय विश्लेषण दिखाता है। अगर कोई मूल्य 0.00 दिखा रहा है, तो नीचे चेक करें कि तालिका कनेक्टेड (SUCCESS) है या खाली (EMPTY) है।
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {diagnostics.map((diag) => (
                <div
                  key={diag.tableName}
                  className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/70 text-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-black text-slate-900 font-mono text-xs sm:text-sm">{diag.tableName}</span>
                    <span className="flex items-center gap-1 font-bold text-[10px] shrink-0">
                      {diag.status === 'SUCCESS' ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <CheckCircle2 size={12} /> Connected
                        </span>
                      ) : diag.status === 'EMPTY' ? (
                        <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          ⚠️ Empty
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <XCircle size={12} /> Error/Missing
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-500 border-b border-dashed border-slate-200 pb-2">
                    <span className="font-semibold">Rows Found:</span>
                    <b className="font-mono text-slate-800 bg-slate-200/50 px-2 py-0.5 rounded-md">{diag.rowCount}</b>
                  </div>

                  {diag.detectedColumns.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                        <ArrowUpRight size={11} /> Detected Schema
                      </p>
                      <p className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-100 truncate">
                        {diag.detectedColumns.join(', ')}
                      </p>
                    </div>
                  )}

                  {diag.errorDetails && (
                    <div className="text-[9px] text-rose-600 bg-rose-50/70 p-2 rounded-lg font-mono break-all mt-1 border border-rose-100">
                      {diag.errorDetails}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}