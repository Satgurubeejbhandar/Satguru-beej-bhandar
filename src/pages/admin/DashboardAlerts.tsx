import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  AlertTriangle,
  Clock,
  Package,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  TrendingDown,
  Database,
  Coins
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── 1. STRICT INTERFACES & TYPES ───────────────────────────────────
interface ExpiringBatch {
  id: string
  expiry_date: string
  quantity_available: number | string
  product: {
    product_name: string
    sku: string | null
  } | null
  company: {
    company_name: string
  } | null
}

interface LowStockItem {
  product_id: string
  product_name: string
  sku: string
  company: string
  reorder: number
  qty: number
}

interface OverdueFarmer {
  id: string
  current_outstanding: number | string
  due_date: string
  farmer: {
    farmer_name: string
    farmer_id: string
    village: string | null
  } | null
}

// ─── 2. LOCAL HELPERS & UTILITIES ─────────────────────────────────────
const getLocalDateString = (offsetDays = 0) => {
  const date = new Date()
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
    maximumFractionDigits: 0,
  })
}

export default function DashboardAlerts() {
  const [loading, setLoading] = useState(true)
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [overdue, setOverdue] = useState<OverdueFarmer[]>([])
  const [advanceDepositsTotal, setAdvanceDepositsTotal] = useState(0)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const reqIdRef = useRef(0)
  const isMountedRef = useRef(true)

  // ─── 3. PARALLELIZED DATABASE FETCHING ────────────────────────────
  const loadAlerts = useCallback(async () => {
    const currentReqId = ++reqIdRef.current
    setLoading(true)
    setFetchError(null)

    try {
      const todayStr = getLocalDateString(0)
      const in60Str = getLocalDateString(60)

      // Parallel execution across independent alert sources
      const [expiringRes, stockRes, overdueRes, advanceRes] = await Promise.all([
        // Query 1: Expiring Batches
        supabase
          .from('inventory_batches')
          .select(`
            id,
            expiry_date,
            quantity_available,
            product:products(product_name, sku),
            company:companies(company_name)
          `)
          .gt('quantity_available', 0)
          .eq('is_expired', false)
          .lte('expiry_date', in60Str)
          .gte('expiry_date', todayStr)
          .order('expiry_date')
          .limit(30),

        // Query 2: Active Inventory Batches
        supabase
          .from('inventory_batches')
          .select(`
            quantity_available,
            product_id,
            product:products(id, product_name, sku, reorder_level),
            company:companies(company_name)
          `)
          .eq('is_expired', false),

        // Query 3: Overdue Outstanding Accounts
        supabase
          .from('credit_accounts')
          .select(`
            id,
            current_outstanding,
            due_date,
            farmer:farmers(farmer_name, farmer_id, village)
          `)
          .gt('current_outstanding', 0)
          .lt('due_date', todayStr)
          .order('due_date')
          .limit(30),

        // Query 4: Advance Deposits Held (Credit Surplus - Outstanding < 0)
        supabase
          .from('credit_accounts')
          .select('current_outstanding')
          .lt('current_outstanding', 0)
      ])

      if (expiringRes.error) throw expiringRes.error
      if (stockRes.error) throw stockRes.error
      if (overdueRes.error) throw overdueRes.error
      if (advanceRes.error) throw advanceRes.error

      if (currentReqId !== reqIdRef.current || !isMountedRef.current) return

      // A. Process Expiring Batches
      setExpiring((expiringRes.data as unknown as ExpiringBatch[]) ?? [])

      // B. Process Low Stock Aggregates
      const rawBatches = stockRes.data || []
      const lowMap = new Map<string, LowStockItem>()

      rawBatches.forEach((b: any) => {
        const pid = b.product_id
        if (!pid) return

        const prev = lowMap.get(pid) || {
          product_id: pid,
          product_name: b.product?.product_name || 'Unknown Product',
          sku: b.product?.sku || 'N/A',
          company: b.company?.company_name || 'Unknown Brand',
          reorder: safeNum(b.product?.reorder_level) || 10,
          qty: 0,
        }
        prev.qty += safeNum(b.quantity_available)
        lowMap.set(pid, prev)
      })

      const lowStockList = Array.from(lowMap.values())
        .filter((x) => x.qty > 0 && x.qty <= x.reorder)
        .slice(0, 30)

      setLowStock(lowStockList)

      // C. Process Overdue Farmers
      setOverdue((overdueRes.data as unknown as OverdueFarmer[]) ?? [])

      // D. Process Advance Deposits Sum
      const rawAdvances = advanceRes.data || []
      const advanceSum = rawAdvances.reduce(
        (sum, item) => sum + Math.abs(safeNum(item.current_outstanding)),
        0
      )
      setAdvanceDepositsTotal(advanceSum)

    } catch (err: unknown) {
      if (currentReqId === reqIdRef.current && isMountedRef.current) {
        const safeMessage = err instanceof Error ? err.message : 'अलर्ट लोड करने में त्रुटि आई।'
        setFetchError(safeMessage)
        toast.error('अलर्ट केंद्र अपडेट करने में विफल')
      }
    } finally {
      if (currentReqId === reqIdRef.current && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadAlerts()

    return () => {
      isMountedRef.current = false
    }
  }, [loadAlerts])

  // ─── 4. METRICS DERIVATIONS ───────────────────────────────────────
  const overdueTotalValue = useMemo(() => {
    return overdue.reduce((sum, item) => sum + safeNum(item.current_outstanding), 0)
  }, [overdue])

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* ── Top Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-amber-400 shrink-0" size={26} /> Live Security &amp; Alerts Center
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Real-time batch expiry tracking · Intelligent stock reorder signals · Overdue debt monitoring
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={loadAlerts}
          aria-label="Sync live alerts"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyzing...' : 'Sync Live Alerts'}
        </button>
      </div>

      {/* ── Error Banner ── */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" /> {fetchError}
          </span>
          <button onClick={loadAlerts} className="underline hover:text-rose-950 font-bold">
            Retry
          </button>
        </div>
      )}

      {/* ── Interactive KPI Ribbon ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Expiring Soon</p>
            <p className="text-sm font-black text-slate-800 mt-0.5">{expiring.length} Batches</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-700">
            <Package size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Under Reorder Level</p>
            <p className="text-sm font-black text-rose-700 mt-0.5">{lowStock.length} Products</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-700">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Overdue Receivables</p>
            <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
              {formatINR(overdueTotalValue)}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-xs">
            <Coins size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp size={10} /> Advance Held
            </p>
            <p className="text-sm font-black text-emerald-800 mt-0.5 font-mono">
              {formatINR(advanceDepositsTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN ALERTS GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-3xl h-72 animate-pulse shadow-xs" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Column 1: Expiry Alerts */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="bg-amber-500 text-slate-950 px-4 py-3 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
              <span className="flex items-center gap-1.5"><Clock size={14} /> Expiring ≤ 60 Days</span>
              <span className="bg-slate-950/10 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono">{expiring.length}</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {expiring.length === 0 ? (
                <EmptyAlertState text="No batches near expiration." />
              ) : (
                expiring.map((b) => (
                  <div key={b.id} className="p-3.5 hover:bg-slate-50 transition-colors flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-slate-950 text-xs">{b.product?.product_name || '—'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {b.company?.company_name || '—'} {b.product?.sku ? `· SKU: ${b.product.sku}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-mono">
                        Exp: {b.expiry_date}
                      </span>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 font-mono">Qty: {safeNum(b.quantity_available)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Low Stock Alerts */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="bg-rose-600 text-white px-4 py-3 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
              <span className="flex items-center gap-1.5"><Package size={14} /> Low Stock Alert</span>
              <span className="bg-white/25 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono">{lowStock.length}</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {lowStock.length === 0 ? (
                <EmptyAlertState text="All inventories above reorder thresholds." />
              ) : (
                lowStock.map((p) => (
                  <div key={p.product_id} className="p-3.5 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2">
                    <div>
                      <p className="font-bold text-slate-950 text-xs">{p.product_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{p.company} · {p.sku}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="inline-block text-[11px] font-black text-rose-700">
                        {p.qty} Units Left
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">Threshold: {p.reorder}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Overdue Outstanding Alerts */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="bg-slate-900 text-white px-4 py-3 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
              <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> Overdue Ledger Debt</span>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono">{overdue.length}</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {overdue.length === 0 ? (
                <EmptyAlertState text="Zero overdue customer receivables." />
              ) : (
                overdue.map((a) => (
                  <div key={a.id} className="p-3.5 hover:bg-slate-50 transition-colors flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-slate-950 text-xs">{a.farmer?.farmer_name || '—'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        ID: {a.farmer?.farmer_id || '—'} {a.farmer?.village ? `• ${a.farmer.village}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-rose-600 font-mono">
                        {formatINR(a.current_outstanding)}
                      </p>
                      <span className="inline-block text-[9px] font-bold text-slate-400 mt-1 font-mono">
                        Due: {a.due_date}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── 5. REUSABLE CLEAN SUB-COMPONENT ────────────────────────────────
function EmptyAlertState({ text }: { text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400">
      <Database size={24} className="opacity-20 mb-1.5" />
      <p className="text-[11px] font-semibold text-center">{text}</p>
    </div>
  )
}