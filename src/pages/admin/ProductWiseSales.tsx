// src/pages/admin/ProductWiseSales.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  PackageSearch, 
  RefreshCw, 
  Loader2, 
  Layers, 
  Hash, 
  Tag,
  ShieldAlert,
  RotateCcw,
  IndianRupee,
  Info
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface ProductSalesAggregate {
  id: string
  name: string
  sku: string
  grossQty: number
  returnsQty: number
  netQty: number
  grossAmount: number
  returnsAmount: number
  netAmount: number
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatCurrencyINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductWiseSales() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<ProductSalesAggregate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const isMountedRef = useRef<boolean>(true)

  const loadData = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)

      const productMap = new Map<
        string,
        {
          id: string
          name: string
          sku: string
          grossQty: number
          returnsQty: number
          grossAmount: number
          returnsAmount: number
        }
      >()

      const pageSize = 1000

      // ==========================================
      // 1. FETCH ALL DIGITAL SALES ITEMS
      // ==========================================
      let salesFrom = 0
      while (true) {
        if (!isMountedRef.current) return

        const { data, error } = await supabase
          .from('sales_bill_items')
          .select(`
            product_id,
            product_name,
            quantity,
            total_amount,
            sales_bill:sales_bills!inner(bill_status),
            product:products(sku, product_name)
          `)
          .eq('sales_bill.bill_status', 'active')
          .range(salesFrom, salesFrom + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        data.forEach((item: any) => {
          const pId = item.product_id || item.product_name || 'unknown_product'
          const pName = item.product?.product_name || item.product_name || 'Unknown Product'
          const sku = item.product?.sku || '—'
          const qty = safeNum(item.quantity)
          const amt = safeNum(item.total_amount)

          const existing = productMap.get(pId) || {
            id: pId,
            name: pName,
            sku: sku,
            grossQty: 0,
            returnsQty: 0,
            grossAmount: 0,
            returnsAmount: 0,
          }

          existing.grossQty += qty
          existing.grossAmount += amt
          if (existing.sku === '—' && sku !== '—') existing.sku = sku
          if (existing.name === 'Unknown Product' && pName !== 'Unknown Product') existing.name = pName

          productMap.set(pId, existing)
        })

        if (data.length < pageSize) break
        salesFrom += pageSize
      }

      // ==========================================
      // 2. FETCH ALL FARMER RETURN ITEMS
      // ==========================================
      let retFrom = 0
      while (true) {
        if (!isMountedRef.current) return

        const { data, error } = await supabase
          .from('return_items')
          .select(`
            product_id,
            quantity,
            total_amount,
            return:returns!inner(return_status),
            product:products(sku, product_name)
          `)
          .range(retFrom, retFrom + pageSize - 1)

        if (error) {
          console.warn('Return items fetch warning:', error)
          break
        }
        if (!data || data.length === 0) break

        data.forEach((item: any) => {
          const st = String(item.return?.return_status || 'completed').toLowerCase()
          if (st === 'cancelled' || st === 'void') return

          const pId = item.product_id || 'unknown_product'
          const pName = item.product?.product_name || 'Returned Product'
          const sku = item.product?.sku || '—'
          const qty = safeNum(item.quantity)
          const amt = safeNum(item.total_amount)

          const existing = productMap.get(pId) || {
            id: pId,
            name: pName,
            sku: sku,
            grossQty: 0,
            returnsQty: 0,
            grossAmount: 0,
            returnsAmount: 0,
          }

          existing.returnsQty += qty
          existing.returnsAmount += amt

          productMap.set(pId, existing)
        })

        if (data.length < pageSize) break
        retFrom += pageSize
      }

      if (!isMountedRef.current) return

      // ==========================================
      // 3. COMPUTE NET QUANTITY & NET AMOUNT
      // ==========================================
      const aggregatedList: ProductSalesAggregate[] = Array.from(productMap.values()).map((p) => {
        const netQty = Math.max(0, p.grossQty - p.returnsQty)
        const netAmount = Math.max(0, p.grossAmount - p.returnsAmount)

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          grossQty: Math.round(p.grossQty * 100) / 100,
          returnsQty: Math.round(p.returnsQty * 100) / 100,
          netQty: Math.round(netQty * 100) / 100,

          grossAmount: Math.round(p.grossAmount * 100) / 100,
          returnsAmount: Math.round(p.returnsAmount * 100) / 100,
          netAmount: Math.round(netAmount * 100) / 100,
        }
      })

      // Sort by Net Sales Value Descending (Highest selling products first)
      aggregatedList.sort((a, b) => b.netAmount - a.netAmount)

      setRows(aggregatedList)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const errorMessage = err instanceof Error ? err.message : 'Failed to load product sales report'
      toast.error(errorMessage)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadData()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [loadData, role, authLoading])

  // Total summary calculations
  const summaries = useMemo(() => {
    let grossQty = 0
    let returnsQty = 0
    let netQty = 0

    let grossAmount = 0
    let returnsAmount = 0
    let netAmount = 0

    rows.forEach((r) => {
      grossQty += r.grossQty
      returnsQty += r.returnsQty
      netQty += r.netQty

      grossAmount += r.grossAmount
      returnsAmount += r.returnsAmount
      netAmount += r.netAmount
    })

    return {
      distinctProducts: rows.length,
      grossQty: Math.round(grossQty * 100) / 100,
      returnsQty: Math.round(returnsQty * 100) / 100,
      netQty: Math.round(netQty * 100) / 100,

      grossAmount: Math.round(grossAmount * 100) / 100,
      returnsAmount: Math.round(returnsAmount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    }
  }, [rows])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास उत्पाद-वार बिक्री रिपोर्ट देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/30 min-h-screen font-sans">
      
      {/* Banner Header */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-955 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <PackageSearch className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Product-wise Sales
            </h1>
          </div>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium">
            Product sales quantity &amp; value after deducting farmer returns
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          aria-label="Refresh product-wise sales report"
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Distinct Products Count */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-600 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distinct Products</p>
            <p className="text-lg sm:text-2xl font-black text-emerald-950 font-mono">
              {summaries.distinctProducts}
            </p>
          </div>
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <Layers size={18} />
          </div>
        </div>

        {/* Net Quantity Sold */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-600 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Units Sold</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {loading ? '—' : summaries.netQty.toLocaleString('en-IN')}
            </p>
            {summaries.returnsQty > 0 && (
              <p className="text-[10px] text-rose-600 font-bold">
                ({summaries.returnsQty} units returned)
              </p>
            )}
          </div>
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Tag size={18} />
          </div>
        </div>

        {/* Returns Value */}
        <div className="bg-rose-50 p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-600 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Product Returns</p>
            <p className="text-lg sm:text-2xl font-black text-rose-800 font-mono">
              − ₹{loading ? '—' : formatCurrencyINR(summaries.returnsAmount)}
            </p>
          </div>
          <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center text-rose-700 shrink-0">
            <RotateCcw size={18} />
          </div>
        </div>

        {/* Net Sales Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Revenue</p>
            <p className="text-lg sm:text-2xl font-black text-amber-700 font-mono">
              ₹{loading ? '—' : formatCurrencyINR(summaries.netAmount)}
            </p>
          </div>
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <IndianRupee size={18} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
        
        {/* Loading / Empty States Handler */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold space-y-2">
            <Loader2 size={24} className="animate-spin mx-auto text-emerald-800" />
            <p className="text-xs">गणना की जा रही है (Auditing product sales and returns)...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center text-slate-400 font-medium text-xs sm:text-sm space-y-2">
            <p>कोई सक्रिय बिक्री या रिटर्न रिकॉर्ड नहीं मिला (No active sales data found).</p>
          </div>
        ) : (
          <>
            {/* ===== DESKTOP VIEW (Table) ===== */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse" aria-label="Product-wise sales data">
                <thead>
                  <tr className="bg-emerald-900 text-emerald-50 font-bold uppercase text-[10px] tracking-wider border-b border-emerald-950">
                    <th scope="col" className="p-4 pl-6 w-16 text-center">Rank</th>
                    <th scope="col" className="p-4">Product Name</th>
                    <th scope="col" className="p-4">SKU</th>
                    <th scope="col" className="p-4 text-right">Gross Qty</th>
                    <th scope="col" className="p-4 text-right">Returned Qty</th>
                    <th scope="col" className="p-4 text-right">Net Qty Sold</th>
                    <th scope="col" className="p-4 text-right pr-6">Net Sales Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {rows.map((row, idx) => (
                    <tr key={row.id || `${row.name}-${idx}`} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 text-center text-slate-400 font-mono font-bold pl-6">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900 text-sm">{row.name}</td>
                      <td className="p-4 font-mono text-slate-600">{row.sku}</td>
                      <td className="p-4 text-right font-mono text-slate-500">{row.grossQty}</td>
                      <td className="p-4 text-right font-mono text-rose-600">
                        {row.returnsQty > 0 ? `−${row.returnsQty}` : '—'}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm font-mono">
                        {row.netQty}
                      </td>
                      <td className="p-4 text-right pr-6 font-black font-mono text-emerald-850 text-sm">
                        ₹{formatCurrencyINR(row.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-emerald-900 font-black text-xs text-emerald-950">
                    <td className="p-4 pl-6 text-center text-emerald-950 font-mono">—</td>
                    <td className="p-4 text-emerald-950 font-extrabold uppercase" colSpan={2}>
                      Total ({rows.length} Products)
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500">{summaries.grossQty}</td>
                    <td className="p-4 text-right font-mono text-rose-600">−{summaries.returnsQty}</td>
                    <td className="p-4 text-right font-black text-emerald-950 text-sm font-mono">{summaries.netQty}</td>
                    <td className="p-4 pr-6 text-right font-mono text-sm sm:text-base text-emerald-900">
                      ₹{formatCurrencyINR(summaries.netAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ===== MOBILE VIEW ===== */}
            <div className="md:hidden divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <div key={row.id || `${row.name}-${idx}`} className="p-4 hover:bg-slate-50/30 flex flex-col space-y-3">
                  
                  {/* Card Header: Rank Badge + Product Title */}
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-black shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm break-words leading-tight">
                        {row.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-semibold">
                        <Hash size={11} className="text-slate-400 shrink-0" />
                        <span>SKU: {row.sku}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Metrics: Qty & Total Value */}
                  <div className="flex justify-between items-center bg-slate-50/60 rounded-xl p-3 border border-slate-100/50">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Net Qty Sold</span>
                      <p className="font-mono font-black text-slate-800 text-xs mt-0.5">
                        {row.netQty}
                        {row.returnsQty > 0 && (
                          <span className="text-[9px] text-rose-600 font-normal ml-1">
                            (−{row.returnsQty} ret)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Net Sales Value</span>
                      <p className="font-mono font-extrabold text-emerald-800 text-xs sm:text-sm mt-0.5">
                        ₹{formatCurrencyINR(row.netAmount)}
                      </p>
                    </div>
                  </div>

                </div>
              ))}

              {/* Mobile Grand Total Banner */}
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-5 flex justify-between items-center border-t border-emerald-900">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Net Sales Aggregate</p>
                  <p className="text-xs text-emerald-100 font-bold">
                    ({rows.length} Items · {summaries.netQty.toLocaleString('en-IN')} Sold)
                  </p>
                </div>
                <p className="text-lg font-black text-amber-400 font-mono">
                  ₹{formatCurrencyINR(summaries.netAmount)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex items-start gap-2">
        <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-800">Net Product Sales Formula:</strong> Gross Sales Qty &amp; Value from <code className="bg-slate-100 px-1 rounded">sales_bill_items</code> minus Returned Qty &amp; Refund Value from <code className="bg-slate-100 px-1 rounded">return_items</code>.
        </p>
      </div>
    </div>
  )
}