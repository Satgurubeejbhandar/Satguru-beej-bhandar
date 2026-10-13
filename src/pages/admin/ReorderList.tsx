// src/pages/admin/ReorderList.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ListOrdered, RefreshCw, AlertTriangle, PackageCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReorderRow {
  product_id: string
  product_name: string
  company_name: string
  sku: string
  total_available: number
  reorder_level: number
}

interface ProductWithCompany {
  id: string
  product_name: string
  sku: string | null
  reorder_level: number | string | null
  company: { company_name: string | null } | { company_name: string | null }[] | null
}

interface BatchQty {
  product_id: string
  quantity_available: number | string | null
}

function toNumber(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function getUrgencyTier(available: number, reorderLevel: number): 'critical' | 'warning' | 'low' {
  if (available <= 0) return 'critical'
  const ratio = available / Math.max(reorderLevel, 1)
  if (ratio <= 0.3) return 'critical'
  if (ratio <= 0.7) return 'warning'
  return 'low'
}

const URGENCY_STYLES: Record<string, { row: string; badge: string; text: string; label: string }> = {
  critical: {
    row: 'bg-red-50/60',
    badge: 'bg-red-100 text-red-700 border-red-200',
    text: 'text-red-700',
    label: 'CRITICAL',
  },
  warning: {
    row: 'bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    text: 'text-amber-700',
    label: 'LOW',
  },
  low: {
    row: '',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    text: 'text-slate-700',
    label: 'REORDER',
  },
}

export default function ReorderList() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<ReorderRow[]>([])
  const [loading, setLoading] = useState(true)
  const isMountedRef = useRef(true)

  const load = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)

      // Strategy 1: Try the RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_low_stock')

      if (!rpcError && rpcData) {
        if (isMountedRef.current) {
          setRows((rpcData as unknown as ReorderRow[]) || [])
        }
        return
      }

      // Strategy 2: Fallback — Filter out expired/blocked stock in memory (Safely Paginated)
      const allProducts: ProductWithCompany[] = []
      let pPage = 0
      const pSize = 1000
      let hasMoreProducts = true

      while (hasMoreProducts && isMountedRef.current) {
        const { data, error } = await supabase
          .from('products')
          .select('id, product_name, sku, reorder_level, company:companies(company_name)')
          .eq('is_active', true)
          .range(pPage * pSize, (pPage + 1) * pSize - 1)

        if (error) throw error
        if (data && data.length > 0) allProducts.push(...(data as unknown as ProductWithCompany[]))
        hasMoreProducts = (data?.length ?? 0) === pSize
        pPage++
      }

      const allBatches: BatchQty[] = []
      let bPage = 0
      const bSize = 1000
      let hasMoreBatches = true

      while (hasMoreBatches && isMountedRef.current) {
        const { data, error } = await supabase
          .from('inventory_batches')
          .select('product_id, quantity_available')
          .gt('quantity_available', 0)
          .eq('is_expired', false)
          .range(bPage * bSize, (bPage + 1) * bSize - 1)

        if (error) throw error
        if (data && data.length > 0) allBatches.push(...(data as unknown as BatchQty[]))
        hasMoreBatches = (data?.length ?? 0) === bSize
        bPage++
      }

      if (!isMountedRef.current) return

      const stockMap = new Map<string, number>()
      for (const batch of allBatches) {
        const pid = batch.product_id
        const qty = toNumber(batch.quantity_available)
        stockMap.set(pid, (stockMap.get(pid) || 0) + qty)
      }

      const lowStockList: ReorderRow[] = []
      for (const p of allProducts) {
        const available = stockMap.get(p.id) || 0
        const reorderLevel = toNumber(p.reorder_level) || 10

        if (available <= reorderLevel) {
          let companyName = '—'
          if (p.company) {
            if (Array.isArray(p.company)) {
              companyName = p.company[0]?.company_name || '—'
            } else {
              companyName = p.company.company_name || '—'
            }
          }

          lowStockList.push({
            product_id: p.id,
            product_name: p.product_name || 'Unknown Product',
            company_name: companyName,
            sku: p.sku || '—',
            total_available: available,
            reorder_level: reorderLevel,
          })
        }
      }

      lowStockList.sort((a, b) => a.total_available - b.total_available)
      setRows(lowStockList)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const message = err instanceof Error ? err.message : 'Failed to load reorder list'
      toast.error(message)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      load()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [load, role, authLoading])

  const stats = useMemo(() => {
    let critical = 0
    let warning = 0
    let reorder = 0
    for (const r of rows) {
      const tier = getUrgencyTier(r.total_available, r.reorder_level)
      if (tier === 'critical') critical++
      else if (tier === 'warning') warning++
      else reorder++
    }
    return { critical, warning, reorder, total: rows.length }
  }, [rows])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Reorder / Low Stock List की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListOrdered className="text-amber-400" size={28} aria-hidden="true" />
            Reorder / Low Stock List
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Products at or below reorder level — sorted by urgency
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Refresh reorder list"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-900 font-mono">{stats.total}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Low</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-red-700 font-mono">{stats.critical}</p>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Critical (0-30%)</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-amber-700 font-mono">{stats.warning}</p>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Warning (30-70%)</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-700 font-mono">{stats.reorder}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reorder (70-100%)</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" role="table" aria-label="Low stock reorder list">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5 w-12 text-center">#</th>
                <th scope="col" className="p-3.5">Product</th>
                <th scope="col" className="p-3.5">Company</th>
                <th scope="col" className="p-3.5">SKU</th>
                <th scope="col" className="p-3.5 text-right">Available</th>
                <th scope="col" className="p-3.5 text-right">Reorder Level</th>
                <th scope="col" className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-emerald-800" />
                      <span>Checking stock levels…</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <PackageCheck size={32} className="text-emerald-500" />
                      <span className="font-bold text-emerald-800">Stock is healthy!</span>
                      <span className="text-[11px]">All products are above their reorder levels.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const tier = getUrgencyTier(r.total_available, r.reorder_level)
                  const style = URGENCY_STYLES[tier]

                  return (
                    <tr
                      key={r.product_id}
                      className={`hover:bg-slate-50 transition-colors ${style.row}`}
                    >
                      <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-900">{r.product_name}</td>
                      <td className="p-3.5 text-slate-700">{r.company_name}</td>
                      <td className="p-3.5 font-mono text-slate-600">{r.sku}</td>
                      <td className={`p-3.5 font-black text-right font-mono ${style.text}`}>
                        {r.total_available}
                      </td>
                      <td className="p-3.5 font-bold text-right text-slate-700 font-mono">
                        {r.reorder_level}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${style.badge}`}
                        >
                          {tier === 'critical' && <AlertTriangle size={10} />}
                          {style.label}
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