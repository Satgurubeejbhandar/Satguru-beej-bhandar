// src/pages/admin/InventoryValuation.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  PieChart,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Boxes,
  IndianRupee,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  History,
  Wallet,
  Landmark,
  Trophy,
  Percent,
  Info,
  ShoppingCart,
  RotateCcw,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BatchRow {
  quantity_available: number | string
  purchase_rate: number | string | null
  selling_rate: number | string | null
  expiry_date?: string | null
  is_expired?: boolean | null
}

interface ValuationMetrics {
  // 1. Current Active In-Hand Stock
  totalQty: number
  purchaseValue: number
  sellingValue: number
  potentialProfit: number
  profitMarginPercent: number
  nearExpiryValue: number
  expiredValue: number

  // 2. Realized Profit on Actual Billed Sales
  grossPurchases: number
  purchaseReturns: number
  netPurchases: number

  grossSales: number
  salesReturns: number
  netSales: number

  costOfGoodsSold: number // Purchase cost of items actually sold
  realizedProfit: number // Net Sales - Cost of Goods Sold
  realizedMarginPercent: number
}

const INITIAL_METRICS: ValuationMetrics = {
  totalQty: 0,
  purchaseValue: 0,
  sellingValue: 0,
  potentialProfit: 0,
  profitMarginPercent: 0,
  nearExpiryValue: 0,
  expiredValue: 0,

  grossPurchases: 0,
  purchaseReturns: 0,
  netPurchases: 0,

  grossSales: 0,
  salesReturns: 0,
  netSales: 0,

  costOfGoodsSold: 0,
  realizedProfit: 0,
  realizedMarginPercent: 0,
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
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function InventoryValuation() {
  const { role, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<ValuationMetrics>(INITIAL_METRICS)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadValuation = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)
      const todayStr = getLocalDateString(0)
      const in60Str = getLocalDateString(60)

      // =========================================================================
      // STEP 1: ACTIVE IN-HAND CLOSING STOCK
      // =========================================================================
      const allBatches: BatchRow[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1
        const { data, error } = await supabase
          .from('inventory_batches')
          .select('quantity_available, purchase_rate, selling_rate, expiry_date, is_expired')
          .gt('quantity_available', 0)
          .range(from, to)

        if (error) throw error
        if (!isMountedRef.current) return
        if (data && data.length > 0) allBatches.push(...(data as unknown as BatchRow[]))
        hasMore = (data?.length ?? 0) === pageSize
        page++
      }

      if (!isMountedRef.current) return

      let q = 0
      let closingStockCost = 0
      let closingStockRetail = 0
      let expCost = 0
      let nearCost = 0

      allBatches.forEach((b) => {
        const qa = safeNum(b.quantity_available)
        const pr = safeNum(b.purchase_rate)
        const sr = safeNum(b.selling_rate)
        const batchCost = qa * pr
        const batchRetail = qa * sr

        const isExpired =
          !!b.is_expired ||
          (!!b.expiry_date && b.expiry_date < todayStr)

        if (isExpired) {
          expCost += batchCost
          return
        }

        q += qa
        closingStockCost += batchCost
        closingStockRetail += batchRetail

        if (b.expiry_date && b.expiry_date <= in60Str) {
          nearCost += batchCost
        }
      })

      const potentialProfit = closingStockRetail - closingStockCost
      const activeMargin = closingStockRetail > 0 ? (potentialProfit / closingStockRetail) * 100 : 0
      const averageCostRatio = closingStockRetail > 0 ? closingStockCost / closingStockRetail : 0.70

      // =========================================================================
      // STEP 2: GROSS PURCHASES & PURCHASE RETURNS
      // =========================================================================
      let grossPurchases = 0
      try {
        let pPage = 0
        while (true) {
          const { data, error } = await supabase
            .from('purchase_bills')
            .select('total_amount, purchase_status')
            .range(pPage * 1000, (pPage + 1) * 1000 - 1)

          if (error || !data || data.length === 0) break

          data.forEach((pb: any) => {
            const status = String(pb.purchase_status || 'active').toLowerCase()
            if (status === 'active') {
              grossPurchases += safeNum(pb.total_amount)
            }
          })

          if (data.length < 1000) break
          pPage++
        }
      } catch (e) {
        console.warn("Purchase bills fetch error:", e)
      }

      let purchaseReturns = 0
      try {
        const { data: prData } = await supabase.from('purchase_returns').select('total_amount, return_status')
        prData?.forEach((pr: any) => {
          const st = String(pr.return_status || 'completed').toLowerCase()
          if (st !== 'cancelled' && st !== 'void') {
            purchaseReturns += safeNum(pr.total_amount)
          }
        })
      } catch (e) { }

      const netPurchases = Math.max(0, grossPurchases - purchaseReturns)

      // =========================================================================
      // STEP 3: GROSS SALES & SALES RETURNS
      // =========================================================================
      let grossSales = 0
      try {
        let sPage = 0
        while (true) {
          const { data, error } = await supabase
            .from('sales_bills')
            .select('total_amount, bill_status')
            .range(sPage * 1000, (sPage + 1) * 1000 - 1)

          if (error || !data || data.length === 0) break

          data.forEach((sb: any) => {
            const status = String(sb.bill_status || 'active').toLowerCase()
            if (status === 'active') {
              grossSales += safeNum(sb.total_amount)
            }
          })

          if (data.length < 1000) break
          sPage++
        }
      } catch (e) { }

      // Sales Returns (returns table)
      let salesReturns = 0
      try {
        const { data: srData } = await supabase.from('returns').select('*')
        srData?.forEach((r: any) => {
          const st = String(r.status || r.return_status || 'completed').toLowerCase()
          if (st !== 'cancelled' && st !== 'void') {
            const amt = safeNum(r.total_amount ?? r.refund_amount ?? r.amount ?? r.total_return_amount)
            salesReturns += amt
          }
        })
      } catch (e) { }

      const netSales = Math.max(0, grossSales - salesReturns)

      // =========================================================================
      // STEP 4: ITEM-LEVEL COST OF GOODS SOLD & REALIZED PROFIT
      // =========================================================================
      let soldItemsCost = 0

      try {
        // Fetch all sales_bill_items for active bills
        const { data: soldItems } = await supabase
          .from('sales_bill_items')
          .select(`
            quantity, rate, total_amount, batch_id,
            sales_bill:sales_bills!inner(bill_status),
            batch:inventory_batches(purchase_rate)
          `)

        if (soldItems && soldItems.length > 0) {
          soldItems.forEach((item: any) => {
            const sbStatus = String(item.sales_bill?.bill_status || 'active').toLowerCase()
            if (sbStatus === 'active') {
              const qty = safeNum(item.quantity)
              const batchPr = safeNum(item.batch?.purchase_rate)
              
              if (batchPr > 0) {
                soldItemsCost += qty * batchPr
              } else {
                // Fallback to average purchase ratio if batch purchase rate is missing
                const itemTotal = safeNum(item.total_amount ?? (qty * safeNum(item.rate)))
                soldItemsCost += itemTotal * averageCostRatio
              }
            }
          })
        }
      } catch (e) {
        console.warn("Error calculating sold items cost, using ratio fallback:", e)
      }

      // Adjust cost for sales returns
      if (salesReturns > 0 && netSales > 0 && soldItemsCost > 0) {
        const returnCostRatio = soldItemsCost / grossSales
        soldItemsCost -= salesReturns * returnCostRatio
      } else if (soldItemsCost === 0 && netSales > 0) {
        soldItemsCost = netSales * averageCostRatio
      }

      // Realized Profit = Net Sales - Cost of Sold Items
      let realizedProfit = 0
      let realizedMarginPercent = 0

      if (netSales > 0) {
        realizedProfit = netSales - soldItemsCost
        realizedMarginPercent = (realizedProfit / netSales) * 100
      }

      if (isMountedRef.current) {
        setMetrics({
          totalQty: q,
          purchaseValue: closingStockCost,
          sellingValue: closingStockRetail,
          potentialProfit,
          profitMarginPercent: Math.round(activeMargin * 10) / 10,
          nearExpiryValue: nearCost,
          expiredValue: expCost,

          grossPurchases,
          purchaseReturns,
          netPurchases,

          grossSales,
          salesReturns,
          netSales,

          costOfGoodsSold: Math.round(soldItemsCost),
          realizedProfit: Math.round(realizedProfit),
          realizedMarginPercent: Math.round(realizedMarginPercent * 10) / 10,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate valuation'
      if (isMountedRef.current) toast.error(msg)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadValuation()
    }
  }, [loadValuation, role, authLoading])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">आपके पास Inventory Valuation देखने की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-6 font-sans pb-12">
      
      {/* ─── Header Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <PieChart className="text-amber-400 shrink-0" size={28} /> Inventory Valuation
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Satguru Beej Bhandar — Itemized Profit &amp; Valuation Engine
          </p>
        </div>
        <button
          type="button"
          onClick={loadValuation}
          disabled={loading}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50 shadow-md cursor-pointer transition-all active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Calculating...' : 'Refresh Valuation'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border text-center">
          <Loader2 className="animate-spin text-emerald-600 mx-auto mb-2" size={32} />
          <p className="text-slate-500 font-semibold text-sm">Auditing active stock and sales bills...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">

          {/* ========================================================================= */}
          {/* SECTION 1: IN-HAND CLOSING STOCK AT COST PRICE                            */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Boxes className="text-emerald-600" size={20} /> Current Active Stock (Dukan ka Stock)
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                At Cost Price (Purchase Rate)
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-emerald-600 flex justify-between group hover:border-emerald-200 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Qty</p>
                  <p className="text-2xl font-black font-mono mt-1 text-slate-800">
                    {metrics.totalQty.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform"><Boxes size={22} /></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-600 flex justify-between group hover:border-blue-200 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closing Stock Value (Cost)</p>
                  <p className="text-2xl font-black font-mono mt-1 text-slate-800">₹{formatINR(metrics.purchaseValue)}</p>
                  <p className="text-[10px] font-bold text-blue-600 mt-0.5">Asset Value in Shop</p>
                </div>
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl group-hover:scale-110 transition-transform"><IndianRupee size={22} /></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-indigo-600 flex justify-between group hover:border-indigo-200 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expected Sales Value</p>
                  <p className="text-2xl font-black text-indigo-950 font-mono mt-1">₹{formatINR(metrics.sellingValue)}</p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl group-hover:scale-110 transition-transform"><Landmark size={22} /></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-teal-600 flex justify-between group hover:border-teal-200 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Potential Gross Profit</p>
                  <p className="text-2xl font-black text-teal-700 font-mono mt-1">₹{formatINR(metrics.potentialProfit)}</p>
                  <p className="text-[11px] font-bold text-teal-600 mt-0.5 flex items-center gap-1">
                    <TrendingUp size={12} /> Expected Margin: {metrics.profitMarginPercent}%
                  </p>
                </div>
                <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition-transform"><Trophy size={22} /></div>
              </div>

              <div className="bg-amber-50 p-5 rounded-2xl border shadow-sm border-l-4 border-l-amber-500 flex justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Near Expiry (60 Days)</p>
                  <p className="text-2xl font-black text-amber-900 font-mono mt-1">₹{formatINR(metrics.nearExpiryValue)}</p>
                  <p className="text-[10px] text-amber-700 mt-0.5 font-medium">Risk of capital loss</p>
                </div>
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl"><AlertTriangle size={22} /></div>
              </div>

              <div className="bg-rose-50 p-5 rounded-2xl border shadow-sm border-l-4 border-l-rose-600 flex justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Expired Dead Stock</p>
                  <p className="text-2xl font-black text-rose-700 font-mono mt-1">₹{formatINR(metrics.expiredValue)}</p>
                  <p className="text-[10px] text-rose-600 mt-0.5 font-medium">Write-off required · Not in capital</p>
                </div>
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl"><XCircle size={22} /></div>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* ========================================================================= */}
          {/* SECTION 2: BILLEDS SALES PROFIT (BILLED ITEMS PURCHASE COST VS SALES)      */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <History className="text-indigo-600" size={22} />
              <div>
                <h2 className="text-lg font-black text-slate-800">Actual Billed Sales Profit</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Margin calculated strictly on items actually sold
                </p>
              </div>
            </div>

            {/* Purchases & Sales Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Purchases Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Wallet size={16} className="text-slate-700" /> Purchases Summary
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">`purchase_bills`</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 font-semibold">
                    <span>Gross Purchases (Supplier Bills)</span>
                    <span className="font-mono">₹{formatINR(metrics.grossPurchases)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span className="flex items-center gap-1"><RotateCcw size={12} /> Less: Purchase Returns</span>
                    <span className="font-mono">− ₹{formatINR(metrics.purchaseReturns)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t">
                    <span>Net Purchases</span>
                    <span className="font-mono">₹{formatINR(metrics.netPurchases)}</span>
                  </div>
                </div>
              </div>

              {/* Sales Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShoppingCart size={16} className="text-emerald-600" /> Sales Summary (Cash + Udhaar)
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">`sales_bills`</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 font-semibold">
                    <span>Gross Sales (Total Bills)</span>
                    <span className="font-mono">₹{formatINR(metrics.grossSales)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span className="flex items-center gap-1"><RotateCcw size={12} /> Less: Farmer Returns</span>
                    <span className="font-mono">− ₹{formatINR(metrics.salesReturns)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-900 font-black text-sm pt-2 border-t">
                    <span>Net Sales</span>
                    <span className="font-mono">₹{formatINR(metrics.netSales)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Profit Output Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Cost of Sold Items */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sold Items Purchase Cost</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Khareed rate of billed items</p>
                  <p className="text-2xl font-black font-mono mt-2 text-amber-400">
                    ₹{formatINR(metrics.costOfGoodsSold)}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-800 pt-1.5">
                  Cost price of items sold in Net Sales
                </p>
              </div>

              {/* Realized Profit */}
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-md flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Realized Profit (Munafa)</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Net Sales − Sold Items Cost</p>
                  <p className="text-2xl font-black font-mono mt-2 text-emerald-900">
                    +₹{formatINR(metrics.realizedProfit)}
                  </p>
                </div>
                <p className="text-[10px] font-bold text-emerald-700 mt-2 border-t border-emerald-200 pt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Actual profit earned on sales
                </p>
              </div>

              {/* Margin % */}
              <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl shadow-md flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest">Realized Margin %</p>
                  <p className="text-[10px] text-indigo-500 mt-0.5">Profit Percentage</p>
                  <p className="text-2xl font-black text-indigo-950 font-mono mt-2">
                    {metrics.realizedMarginPercent}%
                  </p>
                </div>
                <p className="text-[10px] text-indigo-700 font-semibold mt-2 border-t border-indigo-200 pt-1.5 flex items-center gap-1">
                  <Percent size={13} /> Profit margin ratio
                </p>
              </div>

            </div>

            {/* Explanation Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Info size={14} className="text-emerald-600" /> Calculations Summary:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                  1. Net Sales = ₹{formatINR(metrics.grossSales)} (Sales) − ₹{formatINR(metrics.salesReturns)} (Returns) = <strong>₹{formatINR(metrics.netSales)}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                  2. Cost Price of Sold Items = <strong>₹{formatINR(metrics.costOfGoodsSold)}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono col-span-1 md:col-span-2">
                  3. Realized Profit = Net Sales (₹{formatINR(metrics.netSales)}) − Sold Items Cost (₹{formatINR(metrics.costOfGoodsSold)}) = <strong className="text-emerald-800">+₹{formatINR(metrics.realizedProfit)} ({metrics.realizedMarginPercent}% Profit)</strong>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  )
}