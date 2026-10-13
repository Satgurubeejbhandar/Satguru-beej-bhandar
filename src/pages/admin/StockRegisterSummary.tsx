// src/pages/admin/StockRegisterSummary.tsx
import { useState, useEffect, useCallback, useMemo, useRef, type FC } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  BookOpen, RefreshCw, PackageSearch, Search, Layers, 
  ArrowDownLeft, ArrowUpRight, Scale, ShieldAlert 
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ProductJoin {
  product_name: string | null
  sku: string | null
}

interface CompanyJoin {
  company_name: string | null
}

interface RawLedgerEntry {
  product_id: string | null
  quantity_in: number | string | null
  quantity_out: number | string | null
  movement_type: string | null
  reference_type: string | null
  product: ProductJoin | null
  company: CompanyJoin | null
}

export interface StockSummaryRow {
  productId: string
  name: string
  sku: string
  company: string
  rawTin: number // Net Actual Purchases (Purchases - Purchase Returns)
  rawTout: number // Net Actual Sales (Sales - Sales Returns)
  tin: number
  tout: number
  balance: number
}

const REFRESH_COOLDOWN_MS = 1500

// ─── Utility Functions ───────────────────────────────────────────────────────

function roundQuantity(num: number, decimals: number = 4): number {
  return Number(Math.round(Number(`${num}e${decimals}`)) + `e-${decimals}`)
}

function formatQty(val: number): string {
  return Number.isFinite(val)
    ? val.toLocaleString('en-IN', { maximumFractionDigits: 3 })
    : '0'
}

/**
 * Paginated batch fetcher that retrieves ALL stock ledger entries.
 * Selects valid schema columns: movement_type, reference_type
 */
async function fetchAllStockLedgerEntries(
  signal?: AbortSignal,
  batchSize = 1000
): Promise<RawLedgerEntry[]> {
  const records: RawLedgerEntry[] = []
  let from = 0

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const { data, error } = await supabase
      .from('stock_ledger')
      .select(`
        product_id,
        quantity_in,
        quantity_out,
        movement_type,
        reference_type,
        product:products(product_name, sku),
        company:companies(company_name)
      `)
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    records.push(...(data as unknown as RawLedgerEntry[]))
    if (data.length < batchSize) break
    from += batchSize
  }

  return records
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const StockRegisterSummary: FC = () => {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<StockSummaryRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)
  const cooldownRef = useRef<boolean>(false)

  const load = useCallback(async (isManualRefresh: boolean = false) => {
    if (role !== 'admin') return

    if (isManualRefresh && cooldownRef.current) {
      toast('Please wait a moment before refreshing again.', { icon: '⏳' })
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    if (isManualRefresh) {
      setRefreshing(true)
      cooldownRef.current = true
      setTimeout(() => {
        cooldownRef.current = false
      }, REFRESH_COOLDOWN_MS)
    } else {
      setLoading(true)
    }

    try {
      const rawData = await fetchAllStockLedgerEntries(controller.signal)

      if (controller.signal.aborted) return

      const summaryMap = new Map<string, StockSummaryRow>()

      // 1. Accumulate raw unrounded values with Returns Adjustment
      for (const entry of rawData) {
        const pId = entry.product_id || `unassigned_${entry.product?.sku || 'unknown'}`
        const existing = summaryMap.get(pId) || {
          productId: pId,
          name: entry.product?.product_name || 'Unnamed Product',
          sku: entry.product?.sku || '—',
          company: entry.company?.company_name || '—',
          rawTin: 0,
          rawTout: 0,
          tin: 0,
          tout: 0,
          balance: 0,
        }

        if (existing.name === 'Unnamed Product' && entry.product?.product_name) {
          existing.name = entry.product.product_name
        }
        if (existing.sku === '—' && entry.product?.sku) {
          existing.sku = entry.product.sku
        }
        if (existing.company === '—' && entry.company?.company_name) {
          existing.company = entry.company.company_name
        }

        const qIn = Number(entry.quantity_in) || 0
        const qOut = Number(entry.quantity_out) || 0
        const movType = String(entry.movement_type || '').toUpperCase()
        const refType = String(entry.reference_type || '').toLowerCase()

        // Check if transaction is a Sales Return (customer return)
        const isSalesReturn =
          movType === 'RETURN_IN' ||
          refType === 'product_return' ||
          refType === 'sales_return' ||
          refType === 'sale_return'

        // Check if transaction is a Purchase Return (supplier return)
        const isPurchaseReturn =
          movType === 'RETURN_OUT' ||
          refType === 'purchase_return'

        if (isSalesReturn) {
          // Sales return restores stock: Instead of adding to Inflow, DECREASE Net Outflow (Sales)
          const returnedQty = qIn > 0 ? qIn : qOut
          existing.rawTout -= returnedQty
        } else if (isPurchaseReturn) {
          // Purchase return reduces stock: Instead of adding to Outflow, DECREASE Net Inflow (Purchases)
          const returnedQty = qOut > 0 ? qOut : qIn
          existing.rawTin -= returnedQty
        } else {
          // Standard Sales & Purchases
          existing.rawTin += qIn
          existing.rawTout += qOut
        }

        summaryMap.set(pId, existing)
      }

      // 2. Compute final rounded balances EXACTLY ONCE
      const computedSummary: StockSummaryRow[] = Array.from(summaryMap.values())
        .map((item) => {
          const tinRounded = roundQuantity(item.rawTin)
          const toutRounded = roundQuantity(item.rawTout)
          return {
            ...item,
            tin: tinRounded,
            tout: toutRounded,
            balance: roundQuantity(tinRounded - toutRounded),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

      setRows(computedSummary)
      
      if (isManualRefresh) {
        toast.success('Stock Ledger Synced Successfully')
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Failed to aggregate stock register.'
      toast.error(msg)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      load()
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [load, role, authLoading])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q)
    )
  }, [rows, searchQuery])

  // Aggregate totals exactly like rows to ensure math matches perfectly
  const totals = useMemo(() => {
    let rawTotalIn = 0
    let rawTotalOut = 0

    for (const r of filteredRows) {
      rawTotalIn += r.rawTin
      rawTotalOut += r.rawTout
    }

    const tIn = roundQuantity(rawTotalIn)
    const tOut = roundQuantity(rawTotalOut)

    return {
      totalIn: tIn,
      totalOut: tOut,
      totalNet: roundQuantity(tIn - tOut),
    }
  }, [filteredRows])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Stock Register Summary देखने की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto p-4 sm:p-6">
      {/* ─── Header Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <BookOpen className="text-amber-400" size={28} aria-hidden="true" />
            Stock Register Summary
          </h1>
          <p className="text-emerald-200 text-xs mt-1.5 font-medium">
            Aggregated Ledger Data · Net Inflow (Purchases) − Net Outflow (Net Sales) = Net Stock Balance
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          aria-label="Refresh stock summary"
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          {refreshing ? 'Syncing Ledger...' : 'Sync Stock'}
        </button>
      </div>

      {/* ─── Summary Cards ─── */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl shadow-inner">
              <Layers size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Active Products</p>
              <p className="text-lg sm:text-xl font-black text-slate-900">{filteredRows.length}</p>
            </div>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3.5">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl shadow-inner">
              <ArrowDownLeft size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider" title="Purchases minus Purchase Returns">Net Inflow</p>
              <p className="text-lg sm:text-xl font-black font-mono text-emerald-900">{formatQty(totals.totalIn)}</p>
            </div>
          </div>

          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-3.5">
            <div className="p-3 bg-rose-100 text-rose-800 rounded-xl shadow-inner">
              <ArrowUpRight size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider" title="Sales minus Sales Returns">Net Outflow</p>
              <p className="text-lg sm:text-xl font-black font-mono text-rose-900">{formatQty(totals.totalOut)}</p>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-3.5">
            <div className="p-3 bg-indigo-100 text-indigo-800 rounded-xl shadow-inner">
              <Scale size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-indigo-800 uppercase tracking-wider">Net Balance</p>
              <p className={`text-lg sm:text-xl font-black font-mono ${totals.totalNet < 0 ? 'text-rose-600' : 'text-indigo-950'}`}>
                {formatQty(totals.totalNet)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Search Bar ─── */}
      {!loading && rows.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search product, SKU or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all font-semibold shadow-sm"
          />
        </div>
      )}

      {/* ─── Data Table ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead>
              <tr className="bg-emerald-950 text-white font-black uppercase text-xs tracking-wider">
                <th className="p-4 rounded-tl-2xl">Product &amp; SKU</th>
                <th className="p-4">Company</th>
                <th className="p-4 text-right">Net Inflow</th>
                <th className="p-4 text-right">Net Outflow</th>
                <th className="p-4 text-right rounded-tr-2xl">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500">
                    <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-emerald-700" aria-hidden="true" />
                    <p className="font-bold">Syncing Ledger Data...</p>
                    <p className="text-xs mt-1">Calculating accurate balances.</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-500">
                    <PackageSearch size={36} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
                    <p className="font-bold text-slate-700">
                      {searchQuery ? 'No matching products found.' : 'No ledger movements found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isDeficit = r.balance < 0
                  return (
                    <tr key={r.productId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{r.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono font-semibold mt-0.5">
                          {r.sku}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 font-bold text-xs">{r.company}</td>
                      <td className="p-4 text-right font-bold font-mono text-emerald-700">
                        {formatQty(r.tin)}
                      </td>
                      <td className="p-4 text-right font-bold font-mono text-rose-700">
                        {formatQty(r.tout)}
                      </td>
                      <td className="p-4 text-right">
                        <span
                          className={`font-black font-mono px-3 py-1 rounded-xl text-xs shadow-sm inline-block min-w-[80px] text-center border ${
                            isDeficit
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : r.balance === 0
                              ? 'bg-slate-50 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          }`}
                        >
                          {formatQty(r.balance)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {!loading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50/50 font-black border-t-2 border-emerald-900 text-emerald-950 text-sm">
                  <td className="p-4 uppercase tracking-wider" colSpan={2}>
                    Grand Total ({filteredRows.length} {filteredRows.length === 1 ? 'Product' : 'Products'})
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-800">
                    {formatQty(totals.totalIn)}
                  </td>
                  <td className="p-4 text-right font-mono text-rose-800">
                    {formatQty(totals.totalOut)}
                  </td>
                  <td className="p-4 text-right font-mono text-base">
                    <span className={totals.totalNet < 0 ? 'text-rose-700' : 'text-emerald-950'}>
                      {formatQty(totals.totalNet)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

export default StockRegisterSummary