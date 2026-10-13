// src/pages/admin/StockLedgerViewer.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Layers, RefreshCw, Search, Package, X, Loader2, IndianRupee,
  AlertTriangle, Box, ShieldAlert, ShoppingCart, Truck, RotateCcw,
  ListChecks, TrendingDown, TrendingUp, Calendar, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface StockMovementRow {
  id: string
  movement_type: string
  quantity_in: number
  quantity_out: number
  balance_after: number
  reference_number: string | null
  created_at: string
  product_name: string
  company_name: string
  batch_number: string | null
}

interface ProductStockRow {
  product_id: string
  product_name: string
  sku: string | null
  company_id: string | null
  company_name: string | null
  category_id: string | null
  category_name: string | null
  unit_name: string
  reorder_level: number
  minimum_stock: number
  current_stock: number
  current_stock_value: number
  purchase_qty: number
  purchase_value: number
  last_purchase_date: string | null
  sales_qty: number
  sales_value: number
  last_sale_date: string | null
  return_in_qty: number
  return_in_value: number
  last_return_in_date: string | null
  return_out_qty: number
  return_out_value: number
  last_return_out_date: string | null
}

interface SummaryCards {
  total_products: number
  total_stock_value: number
  total_purchase_value: number
  total_sales_value: number
  total_return_in_value: number
  total_return_out_value: number
  low_stock_products: number
  out_of_stock_products: number
}

interface CompanyOpt { id: string; company_name: string }
interface CategoryOpt { id: string; category_name: string }

interface DetailHeader {
  product_id: string
  product_name: string
  sku: string | null
  company_name: string | null
  category_name: string | null
  unit_name: string
  current_stock: number
  current_stock_value: number
  reorder_level: number
}

interface DetailSaleRow {
  bill_date: string
  bill_number: string
  bill_type: string
  farmer_name: string | null
  quantity: number
  rate: number
  total_amount: number
  created_at: string
}

interface DetailPurchaseRow {
  bill_date: string
  bill_number: string
  vendor_bill_number: string | null
  company_name: string | null
  quantity: number
  purchase_rate: number
  total_amount: number
  created_at: string
}

interface DetailReturnRow {
  return_date: string
  return_number: string
  farmer_name: string | null
  quantity: number
  rate: number
  total_amount: number
  created_at: string
}

/* --- NEW ADDITION: Company Purchase Return Type --- */
interface DetailPurchaseReturnRow {
  return_date: string
  return_number: string
  company_name: string | null
  quantity: number
  rate: number
  total_amount: number
  created_at: string
}

interface DetailBatchRow {
  id: string
  batch_number: string | null
  quantity_available: number
  purchase_rate: number
  selling_rate: number
  expiry_date: string | null
}

interface DetailLedgerRow {
  id: string
  created_at: string
  movement_type: string
  reference_number: string | null
  quantity_in: number
  quantity_out: number
  balance_after: number
}

type TabKey = 'ledger' | 'product-wise'
type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type DatePreset = 'all' | '7d' | '30d' | '90d' | 'fy' | 'custom'

/* --- NEW ADDITION: Added 'purchase_returns' to ModalSection --- */
type ModalSection = 'summary' | 'sales' | 'purchases' | 'returns' | 'purchase_returns' | 'batches' | 'ledger'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatQty(qty: number, unit: string): string {
  const q = safeNum(qty)
  const rounded = Number.isInteger(q) ? String(q) : q.toFixed(2)
  return `${rounded} ${unit || 'pcs'}`
}

function formatDateIN(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    // Handle both YYYY-MM-DD and full ISO timestamps
    const dateStr = d.includes('T') ? d : d + 'T00:00:00'
    const dt = new Date(dateStr)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return d
  }
}

function presetToDates(preset: DatePreset, customFrom: string, customTo: string): {
  from: string | null
  to: string | null
} {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0]
  if (preset === 'all') return { from: null, to: null }
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null }
  if (preset === 'fy') {
    const y = today.getFullYear()
    const m = today.getMonth()
    const startY = m < 3 ? y - 1 : y
    return { from: `${startY}-04-01`, to: `${startY + 1}-03-31` }
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  return { from: iso(new Date(today.getTime() - days * 86400000)), to: iso(today) }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function StockLedgerViewer() {
  const { role, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<TabKey>('ledger')

  // Ledger tab
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledgerSearch, setLedgerSearch] = useState('')

  // Product-wise tab
  const [products, setProducts] = useState<ProductStockRow[]>([])
  const [cards, setCards] = useState<SummaryCards | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSearch, setPwSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatus>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [companies, setCompanies] = useState<CompanyOpt[]>([])
  const [categories, setCategories] = useState<CategoryOpt[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modalSection, setModalSection] = useState<ModalSection>('summary')
  const [detailHeader, setDetailHeader] = useState<DetailHeader | null>(null)
  const [detailSales, setDetailSales] = useState<DetailSaleRow[]>([])
  const [detailPurchases, setDetailPurchases] = useState<DetailPurchaseRow[]>([])
  const [detailReturns, setDetailReturns] = useState<DetailReturnRow[]>([])
  
  /* --- NEW ADDITION: State for Purchase Returns --- */
  const [detailPurchaseReturns, setDetailPurchaseReturns] = useState<DetailPurchaseReturnRow[]>([])
  
  const [detailBatches, setDetailBatches] = useState<DetailBatchRow[]>([])
  const [detailLedger, setDetailLedger] = useState<DetailLedgerRow[]>([])

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  /* ---------- Load Raw Ledger (30 days) ---------- */
  const loadStockLedger = useCallback(async () => {
    try {
      setLedgerLoading(true)
      const startDateLimit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const { data, error } = await supabase
        .from('stock_ledger')
        .select(`
          id,
          movement_type,
          quantity_in,
          quantity_out,
          balance_after,
          reference_number,
          created_at,
          product:products(product_name),
          company:companies(company_name),
          batch:inventory_batches(batch_number)
        `)
        .gte('created_at', startDateLimit)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      if (isMountedRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (data || []).map((r: any) => ({
          id: r.id,
          movement_type: r.movement_type || 'MOVEMENT',
          quantity_in: safeNum(r.quantity_in),
          quantity_out: safeNum(r.quantity_out),
          balance_after: safeNum(r.balance_after),
          reference_number: r.reference_number || null,
          created_at: r.created_at || '',
          product_name:
            (Array.isArray(r.product) ? r.product[0]?.product_name : r.product?.product_name) ||
            'Product',
          company_name:
            (Array.isArray(r.company) ? r.company[0]?.company_name : r.company?.company_name) ||
            'Company',
          batch_number:
            (Array.isArray(r.batch) ? r.batch[0]?.batch_number : r.batch?.batch_number) || '—',
        }))
        setMovements(rows)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stock ledger load failed'
      if (isMountedRef.current) toast.error('स्टॉक लेजर लोड करने में त्रुटि: ' + msg)
    } finally {
      if (isMountedRef.current) setLedgerLoading(false)
    }
  }, [])

  /* ---------- Load Product-wise Summary ---------- */
  const loadProductWise = useCallback(async () => {
    if (role !== 'admin') return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setPwLoading(true)
      const { from, to } = presetToDates(datePreset, customFrom, customTo)

      const { data, error } = await supabase.rpc('get_product_stock_summary', {
        p_search: pwSearch.trim() || null,
        p_company_id: companyId || null,
        p_category_id: categoryId || null,
        p_stock_status: stockStatus,
        p_date_from: from,
        p_date_to: to,
      })

      if (controller.signal.aborted) return
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = data as any
      if (payload && payload.success === false && payload.message) {
        throw new Error(payload.message)
      }

      if (isMountedRef.current && !controller.signal.aborted) {
        setCards(payload?.cards || null)
        setProducts((payload?.products as ProductStockRow[]) || [])
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : 'Product stock summary failed'
      if (isMountedRef.current) {
        toast.error('Product-wise stock: ' + msg)
        setProducts([])
        setCards(null)
      }
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        setPwLoading(false)
      }
    }
  }, [role, pwSearch, companyId, categoryId, stockStatus, datePreset, customFrom, customTo])

  const loadFilters = useCallback(async () => {
    try {
      const [cRes, catRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_name')
          .eq('account_status', 'active')
          .order('company_name'),
        supabase
          .from('product_categories')
          .select('id, category_name')
          .eq('is_active', true)
          .order('category_name'),
      ])
      if (isMountedRef.current) {
        setCompanies((cRes.data as CompanyOpt[]) || [])
        setCategories((catRes.data as CategoryOpt[]) || [])
      }
    } catch {
      // non-blocking
    }
  }, [])

  const openProductDetail = async (productId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setModalSection('summary')
    setDetailHeader(null)
    setDetailSales([])
    setDetailPurchases([])
    setDetailReturns([])
    setDetailPurchaseReturns([]) // --- NEW ADDITION ---
    setDetailBatches([])
    setDetailLedger([])

    try {
      const { data, error } = await supabase.rpc('get_product_stock_detail', {
        p_product_id: productId,
      })
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = data as any
      if (!payload?.success) throw new Error(payload?.message || 'Detail load failed')

      /* --- NEW ADDITION START: Fetch Company Purchase Returns --- */
      let prMapped: DetailPurchaseReturnRow[] = []
      try {
        const { data: prData } = await supabase
          .from('purchase_return_items')
          .select(`
            quantity, purchase_rate, total_amount, created_at,
            purchase_returns!inner(return_date, return_number, return_status, companies(company_name))
          `)
          .eq('product_id', productId)
          .eq('purchase_returns.return_status', 'completed')
          .order('created_at', { ascending: false })

        prMapped = (prData || []).map((row: any) => ({
          return_date: row.purchase_returns?.return_date,
          return_number: row.purchase_returns?.return_number,
          company_name: row.purchase_returns?.companies?.company_name || null,
          quantity: safeNum(row.quantity),
          rate: safeNum(row.purchase_rate),
          total_amount: safeNum(row.total_amount),
          created_at: row.created_at
        }))
      } catch (prErr) {
        console.error('Failed to fetch purchase returns', prErr)
      }
      /* --- NEW ADDITION END --- */

      if (isMountedRef.current) {
        setDetailHeader(payload.header || null)
        setDetailSales(payload.sales || [])
        setDetailPurchases(payload.purchases || [])
        setDetailReturns(payload.returns || [])
        setDetailPurchaseReturns(prMapped) // --- NEW ADDITION ---
        setDetailBatches(payload.batches || [])
        setDetailLedger(payload.ledger || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Detail failed'
      toast.error(msg)
      setDetailOpen(false)
    } finally {
      if (isMountedRef.current) setDetailLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadStockLedger()
      loadFilters()
    }
    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [authLoading, role, loadStockLedger, loadFilters])

  useEffect(() => {
    if (tab === 'product-wise' && role === 'admin' && !authLoading) {
      void loadProductWise()
    }
  }, [tab, role, authLoading, loadProductWise])

  // Lock body scroll when modal open
  useEffect(() => {
    if (detailOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [detailOpen])

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase()
    if (!q) return movements
    return movements.filter((m) => {
      const haystack = `${m.product_name} ${m.company_name} ${m.batch_number} ${m.reference_number} ${m.movement_type}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [movements, ledgerSearch])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Stock module sirf Admin ke liye hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-3 sm:p-4 font-sans">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Layers className="text-amber-400 shrink-0" size={24} />
            <span>Stock Management</span>
          </h1>
          <p className="text-emerald-200 text-[10px] sm:text-xs mt-1">
            Audit ledger (30 days) · Product-wise live stock &amp; transaction history
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (tab === 'ledger') void loadStockLedger()
            else void loadProductWise()
          }}
          disabled={tab === 'ledger' ? ledgerLoading : pwLoading}
          className="px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow cursor-pointer w-full sm:w-auto justify-center"
        >
          <RefreshCw
            size={14}
            className={
              (tab === 'ledger' ? ledgerLoading : pwLoading) ? 'animate-spin' : ''
            }
          />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border shadow-sm flex gap-1">
        <button
          type="button"
          onClick={() => setTab('ledger')}
          className={`flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer ${
            tab === 'ledger'
              ? 'bg-emerald-800 text-white shadow'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ListChecks size={14} className="inline mr-1" />
          <span className="hidden sm:inline">Raw </span>Stock Ledger
        </button>
        <button
          type="button"
          onClick={() => setTab('product-wise')}
          className={`flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer ${
            tab === 'product-wise'
              ? 'bg-emerald-800 text-white shadow'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Package size={14} className="inline mr-1" />
          Product<span className="hidden sm:inline"> Wise Stock</span>
        </button>
      </div>

      {/* ═══════════════════════════ TAB: LEDGER ═══════════════════════════ */}
      {tab === 'ledger' && (
        <>
          <div className="bg-white p-3 rounded-2xl border shadow-sm flex items-center gap-2">
            <Search className="text-gray-400 shrink-0" size={16} />
            <input
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Search product / batch / bill..."
              className="flex-1 outline-none text-xs font-semibold text-gray-800 bg-transparent min-w-0"
            />
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-emerald-900 text-white font-extrabold uppercase text-[10px]">
                    <th className="p-3">Date</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Movement</th>
                    <th className="p-3">Ref #</th>
                    <th className="p-3 text-right">In</th>
                    <th className="p-3 text-right">Out</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-gray-800">
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <Loader2 className="animate-spin inline mr-2" /> Loading...
                      </td>
                    </tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        No movements in last 30 days.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-[10px] text-gray-600 whitespace-nowrap">
                          {formatDateIN(m.created_at)}
                        </td>
                        <td className="p-3">
                          <p className="font-bold">{m.product_name}</p>
                          <p className="text-[9px] text-gray-500">{m.company_name}</p>
                        </td>
                        <td className="p-3 font-mono text-emerald-800 text-[10px]">
                          {m.batch_number}
                        </td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[9px] uppercase">
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px]">
                          {m.reference_number || '—'}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                          {m.quantity_in > 0 ? `+${m.quantity_in}` : '—'}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-600 font-mono">
                          {m.quantity_out > 0 ? `-${m.quantity_out}` : '—'}
                        </td>
                        <td className="p-3 text-right font-black font-mono bg-emerald-50/50">
                          {m.balance_after}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {ledgerLoading ? (
              <div className="bg-white p-6 rounded-2xl border text-center">
                <Loader2 className="animate-spin inline mr-2" /> Loading...
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border text-center text-gray-500 text-xs">
                No movements in last 30 days.
              </div>
            ) : (
              filteredMovements.map((m) => (
                <div key={m.id} className="bg-white p-3 rounded-2xl border shadow-sm space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {m.product_name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {m.company_name}
                      </p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[9px] uppercase shrink-0">
                      {m.movement_type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-400">Date:</span>{' '}
                      <span className="font-mono font-bold">
                        {formatDateIN(m.created_at)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Ref:</span>{' '}
                      <span className="font-mono font-bold">
                        {m.reference_number || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Batch:</span>{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        {m.batch_number}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Bal:</span>{' '}
                      <span className="font-mono font-black text-emerald-900">
                        {m.balance_after}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t text-[11px] font-bold">
                    <span className="text-emerald-700">
                      In: {m.quantity_in > 0 ? `+${m.quantity_in}` : '—'}
                    </span>
                    <span className="text-rose-600">
                      Out: {m.quantity_out > 0 ? `-${m.quantity_out}` : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════ TAB: PRODUCT WISE ═══════════════════════════ */}
      {tab === 'product-wise' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'Products', value: cards ? String(cards.total_products) : '—', icon: Box, color: 'text-slate-700' },
              { label: 'Stock Value', value: cards ? `₹${formatINR(cards.total_stock_value)}` : '—', icon: IndianRupee, color: 'text-emerald-700' },
              { label: 'Purchase Val', value: cards ? `₹${formatINR(cards.total_purchase_value)}` : '—', icon: TrendingUp, color: 'text-blue-700' },
              { label: 'Sales Value', value: cards ? `₹${formatINR(cards.total_sales_value)}` : '—', icon: TrendingDown, color: 'text-amber-700' },
              { label: 'Return In Val', value: cards ? `₹${formatINR(cards.total_return_in_value)}` : '—', icon: RotateCcw, color: 'text-purple-700' },
              { label: 'Low Stock', value: cards ? String(cards.low_stock_products) : '—', icon: AlertTriangle, color: 'text-orange-700' },
              { label: 'Out of Stock', value: cards ? String(cards.out_of_stock_products) : '—', icon: AlertTriangle, color: 'text-rose-700' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border p-2.5 sm:p-3 shadow-sm">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                  <c.icon size={11} className={c.color} /> {c.label}
                </p>
                <p className={`text-xs sm:text-sm font-black font-mono truncate mt-0.5 ${c.color}`}>
                  {pwLoading ? '…' : c.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white p-3 rounded-2xl border shadow-sm space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  value={pwSearch}
                  onChange={(e) => setPwSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadProductWise()}
                  placeholder="Search product / SKU / company"
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className={`sm:hidden px-3 py-2 rounded-xl text-xs font-bold ${showFilters ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                <Filter size={14} />
              </button>
            </div>

            <div className={`${showFilters ? 'block' : 'hidden'} sm:block space-y-3`}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2 border rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category_name}</option>
                  ))}
                </select>
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                  className="w-full p-2 border rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Stock Status</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase w-full sm:w-auto">
                  Date (txn totals):
                </span>
                {(
                  [
                    ['all', 'All'],
                    ['7d', '7D'],
                    ['30d', '30D'],
                    ['90d', '3M'],
                    ['fy', 'FY'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDatePreset(k)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                      datePreset === k
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void loadProductWise()}
                  className="ml-auto px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1.5 font-mono"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1.5 font-mono"
                  />
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              <b>Current Stock &amp; Value</b> always live from <code>inventory_batches</code>.
              Date filter affects only Purchase/Sales/Return totals.
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[1100px]">
                <thead>
                  <tr className="bg-emerald-900 text-white font-extrabold uppercase text-[10px]">
                    <th className="p-3">Product</th>
                    <th className="p-3">Company</th>
                    <th className="p-3 text-right">Purchase</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Return In</th>
                    <th className="p-3 text-right">Return Out</th>
                    <th className="p-3 text-right bg-emerald-950">Stock</th>
                    <th className="p-3 text-right bg-emerald-950">Value</th>
                    <th className="p-3">Last Sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-gray-800">
                  {pwLoading ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center">
                        <Loader2 className="animate-spin inline mr-2" /> Calculating...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-gray-500">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const low =
                        p.current_stock > 0 &&
                        p.current_stock <= Math.max(p.reorder_level, p.minimum_stock, 1)
                      const out = p.current_stock <= 0
                      return (
                        <tr
                          key={p.product_id}
                          onClick={() => void openProductDetail(p.product_id)}
                          className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                          title="Click for full history"
                        >
                          <td className="p-3">
                            <p className="font-bold text-gray-900">{p.product_name}</p>
                            <p className="text-[9px] font-mono text-gray-500">
                              {p.sku || '—'} · {p.category_name || '—'}
                            </p>
                          </td>
                          <td className="p-3">{p.company_name || '—'}</td>
                          <td className="p-3 text-right">
                            <p className="font-bold">
                              {formatQty(p.purchase_qty, p.unit_name)}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              ₹{formatINR(p.purchase_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_purchase_date)}
                            </p>
                          </td>
                          <td className="p-3 text-right">
                            <p className="font-bold text-rose-700">
                              {formatQty(p.sales_qty, p.unit_name)}
                            </p>
                            <p className="text-[9px] text-rose-600 font-mono">
                              ₹{formatINR(p.sales_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_sale_date)}
                            </p>
                          </td>
                          <td className="p-3 text-right">
                            <p className="font-bold text-emerald-700">
                              {formatQty(p.return_in_qty, p.unit_name)}
                            </p>
                            <p className="text-[9px] text-emerald-600 font-mono">
                              ₹{formatINR(p.return_in_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_return_in_date)}
                            </p>
                          </td>
                          <td className="p-3 text-right">
                            <p className="font-bold text-purple-700">
                              {formatQty(p.return_out_qty, p.unit_name)}
                            </p>
                            <p className="text-[9px] text-purple-600 font-mono">
                              ₹{formatINR(p.return_out_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_return_out_date)}
                            </p>
                          </td>
                          <td className="p-3 text-right bg-emerald-50/30">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg font-black font-mono text-[11px] ${
                                out
                                  ? 'bg-rose-100 text-rose-800'
                                  : low
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {formatQty(p.current_stock, p.unit_name)}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black font-mono text-emerald-950 bg-emerald-50/30">
                            ₹{formatINR(p.current_stock_value)}
                          </td>
                          <td className="p-3 text-[10px] font-mono text-slate-600">
                            {formatDateIN(p.last_sale_date)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tablet & Mobile — Product Cards */}
          <div className="lg:hidden space-y-2">
            {pwLoading ? (
              <div className="bg-white p-6 rounded-2xl border text-center">
                <Loader2 className="animate-spin inline mr-2" /> Calculating stock...
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border text-center text-gray-500 text-xs">
                No products found.
              </div>
            ) : (
              products.map((p) => {
                const low =
                  p.current_stock > 0 &&
                  p.current_stock <= Math.max(p.reorder_level, p.minimum_stock, 1)
                const out = p.current_stock <= 0
                return (
                  <div
                    key={p.product_id}
                    className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                  >
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-900 leading-tight">
                            {p.product_name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            {p.sku || '—'} · {p.company_name || '—'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-1 rounded-lg font-black font-mono text-[11px] ${
                            out
                              ? 'bg-rose-100 text-rose-800'
                              : low
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {formatQty(p.current_stock, p.unit_name)}
                        </span>
                      </div>

                      <div className="bg-emerald-50 rounded-xl p-2 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase">
                          Stock Value
                        </span>
                        <span className="font-black font-mono text-emerald-950 text-sm">
                          ₹{formatINR(p.current_stock_value)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-blue-700 font-bold uppercase text-[9px]">
                            Purchase
                          </p>
                          <p className="font-bold text-slate-800">
                            {formatQty(p.purchase_qty, p.unit_name)}
                          </p>
                          <p className="font-mono text-blue-700">
                            ₹{formatINR(p.purchase_value)}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {formatDateIN(p.last_purchase_date)}
                          </p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2">
                          <p className="text-amber-700 font-bold uppercase text-[9px]">
                            Sales
                          </p>
                          <p className="font-bold text-slate-800">
                            {formatQty(p.sales_qty, p.unit_name)}
                          </p>
                          <p className="font-mono text-amber-700">
                            ₹{formatINR(p.sales_value)}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {formatDateIN(p.last_sale_date)}
                          </p>
                        </div>
                        {p.return_in_qty > 0 && (
                          <div className="bg-purple-50 rounded-lg p-2">
                            <p className="text-purple-700 font-bold uppercase text-[9px]">
                              Return In
                            </p>
                            <p className="font-bold text-slate-800">
                              {formatQty(p.return_in_qty, p.unit_name)}
                            </p>
                            <p className="font-mono text-purple-700">
                              ₹{formatINR(p.return_in_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_return_in_date)}
                            </p>
                          </div>
                        )}
                        {p.return_out_qty > 0 && (
                          <div className="bg-pink-50 rounded-lg p-2">
                            <p className="text-pink-700 font-bold uppercase text-[9px]">
                              Return Out
                            </p>
                            <p className="font-bold text-slate-800">
                              {formatQty(p.return_out_qty, p.unit_name)}
                            </p>
                            <p className="font-mono text-pink-700">
                              ₹{formatINR(p.return_out_value)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {formatDateIN(p.last_return_out_date)}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void openProductDetail(p.product_id)}
                        className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition"
                      >
                        View Full History &amp; Bills →
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════ DETAIL MODAL ═══════════════════════════ */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-5xl h-[95vh] sm:h-auto sm:max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-900 text-white p-3 sm:p-4 flex justify-between items-start gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] text-emerald-300 font-bold uppercase">
                  Product History &amp; Ledger
                </p>
                <h2 className="text-base sm:text-lg font-black truncate">
                  {detailHeader?.product_name || 'Loading...'}
                </h2>
                <p className="text-[10px] sm:text-xs text-emerald-200 truncate">
                  {detailHeader?.company_name || '—'} · {detailHeader?.category_name || '—'} ·{' '}
                  SKU: {detailHeader?.sku || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-2 hover:bg-emerald-800 rounded-xl shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Section Tabs — Horizontally Scrollable on Mobile */}
            <div className="bg-slate-100 border-b shrink-0">
              <div className="flex gap-1 overflow-x-auto px-2 py-2">
                {(
                  [
                    ['summary', 'Summary', Package],
                    ['sales', `Sales (${detailSales.length})`, ShoppingCart],
                    ['purchases', `Purchase (${detailPurchases.length})`, Truck],
                    ['returns', `Farmer Ret. (${detailReturns.length})`, RotateCcw],
                    /* --- NEW ADDITION: Co. Ret. Tab --- */
                    ['purchase_returns', `Co. Ret. (${detailPurchaseReturns.length})`, Truck],
                    ['batches', `Batches (${detailBatches.length})`, Box],
                    ['ledger', `Ledger (${detailLedger.length})`, ListChecks],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setModalSection(k as ModalSection)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1 ${
                      modalSection === k
                        ? 'bg-emerald-800 text-white shadow'
                        : 'bg-white text-slate-600 border'
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-slate-50">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-500 font-bold">
                  <Loader2 className="animate-spin inline mr-2" /> Loading detail...
                </div>
              ) : (
                <>
                  {/* SUMMARY SECTION */}
                  {modalSection === 'summary' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-100 border border-emerald-200 rounded-2xl p-3">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase">
                            Available Stock
                          </p>
                          <p className="text-lg sm:text-xl font-black font-mono text-emerald-950">
                            {formatQty(
                              detailHeader?.current_stock || 0,
                              detailHeader?.unit_name || 'pcs'
                            )}
                          </p>
                        </div>
                        <div className="bg-amber-100 border border-amber-200 rounded-2xl p-3">
                          <p className="text-[10px] font-bold text-amber-800 uppercase">
                            Stock Value
                          </p>
                          <p className="text-lg sm:text-xl font-black font-mono text-amber-950">
                            ₹{formatINR(detailHeader?.current_stock_value)}
                          </p>
                        </div>
                        <div className="bg-slate-100 rounded-2xl p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                            Unit
                          </p>
                          <p className="text-base font-black">
                            {detailHeader?.unit_name || '—'}
                          </p>
                        </div>
                        <div className="bg-slate-100 rounded-2xl p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                            Reorder Level
                          </p>
                          <p className="text-base font-black font-mono">
                            {detailHeader?.reorder_level ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white border rounded-2xl p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-700">
                          📊 Quick Stats
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <p className="text-slate-500">Total Sales</p>
                            <p className="font-black text-rose-700">
                              {detailSales.length} bills
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Total Purchase</p>
                            <p className="font-black text-blue-700">
                              {detailPurchases.length} bills
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Total Returns</p>
                            <p className="font-black text-purple-700">
                              {detailReturns.length} returns
                            </p>
                          </div>
                          {/* --- NEW ADDITION: Co. Returns Quick Stat --- */}
                          <div>
                            <p className="text-slate-500">Co. Returns</p>
                            <p className="font-black text-pink-700">
                              {detailPurchaseReturns.length} returns
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Active Batches</p>
                            <p className="font-black text-emerald-700">
                              {detailBatches.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Total Movements</p>
                            <p className="font-black text-slate-700">
                              {detailLedger.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SALES SECTION */}
                  {modalSection === 'sales' && (
                    <SalesSection sales={detailSales} unit={detailHeader?.unit_name || 'pcs'} />
                  )}

                  {/* PURCHASES SECTION */}
                  {modalSection === 'purchases' && (
                    <PurchasesSection
                      purchases={detailPurchases}
                      unit={detailHeader?.unit_name || 'pcs'}
                    />
                  )}

                  {/* RETURNS SECTION (Farmer Returns) */}
                  {modalSection === 'returns' && (
                    <ReturnsSection returns={detailReturns} unit={detailHeader?.unit_name || 'pcs'} />
                  )}

                  {/* --- NEW ADDITION: PURCHASE RETURNS SECTION (Company Returns) --- */}
                  {modalSection === 'purchase_returns' && (
                    <PurchaseReturnsSection
                      returns={detailPurchaseReturns}
                      unit={detailHeader?.unit_name || 'pcs'}
                    />
                  )}

                  {/* BATCHES SECTION */}
                  {modalSection === 'batches' && (
                    <BatchesSection batches={detailBatches} />
                  )}

                  {/* LEDGER SECTION */}
                  {modalSection === 'ledger' && (
                    <LedgerSection ledger={detailLedger} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-Components (Responsive Modal Sections)                          */
/* ------------------------------------------------------------------ */

function SalesSection({ sales, unit }: { sales: DetailSaleRow[]; unit: string }) {
  if (sales.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No sales history for this product.
      </div>
    )
  }
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-amber-100 text-amber-950 font-bold">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Bill No</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Farmer</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((r, i) => (
                <tr key={i} className="hover:bg-amber-50">
                  <td className="p-2 font-mono text-[11px]">
                    {formatDateIN(r.bill_date)}
                  </td>
                  <td className="p-2 font-mono font-bold text-emerald-800">
                    {r.bill_number}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                        r.bill_type === 'cash'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.bill_type}
                    </span>
                  </td>
                  <td className="p-2 font-bold">{r.farmer_name || '—'}</td>
                  <td className="p-2 text-right font-black text-rose-600 font-mono">
                    {formatQty(r.quantity, unit)}
                  </td>
                  <td className="p-2 text-right font-mono">₹{formatINR(r.rate)}</td>
                  <td className="p-2 text-right font-mono font-bold text-emerald-950">
                    ₹{formatINR(r.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {sales.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono font-bold text-emerald-800 text-sm">
                  {r.bill_number}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  <Calendar size={9} className="inline mr-1" />
                  {formatDateIN(r.bill_date)}
                </p>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                  r.bill_type === 'cash'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {r.bill_type}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800">
              👤 {r.farmer_name || '—'}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">Qty</p>
                <p className="font-black text-rose-600 font-mono">
                  {formatQty(r.quantity, unit)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Rate</p>
                <p className="font-mono font-bold">₹{formatINR(r.rate)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Value</p>
                <p className="font-mono font-black text-emerald-950">
                  ₹{formatINR(r.total_amount)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function PurchasesSection({ purchases, unit }: { purchases: DetailPurchaseRow[]; unit: string }) {
  if (purchases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No purchase history for this product.
      </div>
    )
  }
  return (
    <>
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-blue-100 text-blue-950 font-bold">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Bill No</th>
                <th className="p-2 text-left">Vendor Bill</th>
                <th className="p-2 text-left">Company</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map((r, i) => (
                <tr key={i} className="hover:bg-blue-50">
                  <td className="p-2 font-mono text-[11px]">
                    {formatDateIN(r.bill_date)}
                  </td>
                  <td className="p-2 font-mono font-bold text-emerald-800">
                    {r.bill_number}
                  </td>
                  <td className="p-2 font-mono text-[10px]">
                    {r.vendor_bill_number || '—'}
                  </td>
                  <td className="p-2 font-bold">{r.company_name || '—'}</td>
                  <td className="p-2 text-right font-black text-emerald-600 font-mono">
                    +{formatQty(r.quantity, unit)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ₹{formatINR(r.purchase_rate)}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-emerald-950">
                    ₹{formatINR(r.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        {purchases.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono font-bold text-emerald-800 text-sm">
                  {r.bill_number}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  <Calendar size={9} className="inline mr-1" />
                  {formatDateIN(r.bill_date)}
                </p>
              </div>
              {r.vendor_bill_number && (
                <span className="text-[9px] font-mono text-slate-500">
                  {r.vendor_bill_number}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-800">
              🏢 {r.company_name || '—'}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">Qty</p>
                <p className="font-black text-emerald-600 font-mono">
                  +{formatQty(r.quantity, unit)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Rate</p>
                <p className="font-mono font-bold">₹{formatINR(r.purchase_rate)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Value</p>
                <p className="font-mono font-black text-emerald-950">
                  ₹{formatINR(r.total_amount)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ReturnsSection({ returns, unit }: { returns: DetailReturnRow[]; unit: string }) {
  if (returns.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No returns recorded for this product.
      </div>
    )
  }
  return (
    <>
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-purple-100 text-purple-950 font-bold">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Return No</th>
                <th className="p-2 text-left">Farmer</th>
                <th className="p-2 text-right">Qty (Back to Stock)</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {returns.map((r, i) => (
                <tr key={i} className="hover:bg-purple-50">
                  <td className="p-2 font-mono text-[11px]">
                    {formatDateIN(r.return_date)}
                  </td>
                  <td className="p-2 font-mono font-bold text-purple-800">
                    {r.return_number}
                  </td>
                  <td className="p-2 font-bold">{r.farmer_name || '—'}</td>
                  <td className="p-2 text-right font-black text-purple-600 font-mono">
                    +{formatQty(r.quantity, unit)}
                  </td>
                  <td className="p-2 text-right font-mono">₹{formatINR(r.rate)}</td>
                  <td className="p-2 text-right font-mono font-bold text-purple-950">
                    ₹{formatINR(r.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        {returns.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono font-bold text-purple-800 text-sm">
                  {r.return_number}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  <Calendar size={9} className="inline mr-1" />
                  {formatDateIN(r.return_date)}
                </p>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold uppercase text-[9px]">
                Return In
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800">
              👤 {r.farmer_name || '—'}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">Qty</p>
                <p className="font-black text-purple-600 font-mono">
                  +{formatQty(r.quantity, unit)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Rate</p>
                <p className="font-mono font-bold">₹{formatINR(r.rate)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Value</p>
                <p className="font-mono font-black text-purple-950">
                  ₹{formatINR(r.total_amount)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* --- NEW ADDITION: Purchase Returns Component --- */
function PurchaseReturnsSection({ returns, unit }: { returns: DetailPurchaseReturnRow[]; unit: string }) {
  if (returns.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No company returns recorded for this product.
      </div>
    )
  }
  return (
    <>
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-pink-100 text-pink-950 font-bold">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Return No</th>
                <th className="p-2 text-left">Company</th>
                <th className="p-2 text-right">Qty (Deducted)</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {returns.map((r, i) => (
                <tr key={i} className="hover:bg-pink-50">
                  <td className="p-2 font-mono text-[11px]">
                    {formatDateIN(r.return_date)}
                  </td>
                  <td className="p-2 font-mono font-bold text-pink-800">
                    {r.return_number}
                  </td>
                  <td className="p-2 font-bold">{r.company_name || '—'}</td>
                  <td className="p-2 text-right font-black text-rose-600 font-mono">
                    -{formatQty(r.quantity, unit)}
                  </td>
                  <td className="p-2 text-right font-mono">₹{formatINR(r.rate)}</td>
                  <td className="p-2 text-right font-mono font-bold text-pink-950">
                    ₹{formatINR(r.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        {returns.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono font-bold text-pink-800 text-sm">
                  {r.return_number}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  <Calendar size={9} className="inline mr-1" />
                  {formatDateIN(r.return_date)}
                </p>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-pink-100 text-pink-800 font-bold uppercase text-[9px]">
                Return Out
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800">
              🏢 {r.company_name || '—'}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">Qty</p>
                <p className="font-black text-rose-600 font-mono">
                  -{formatQty(r.quantity, unit)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Rate</p>
                <p className="font-mono font-bold">₹{formatINR(r.rate)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Value</p>
                <p className="font-mono font-black text-pink-950">
                  ₹{formatINR(r.total_amount)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
/* --- END OF NEW ADDITION --- */

function BatchesSection({ batches }: { batches: DetailBatchRow[] }) {
  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No batches found.
      </div>
    )
  }
  return (
    <>
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-200 font-bold">
              <tr>
                <th className="p-2 text-left">Batch</th>
                <th className="p-2 text-right">Available</th>
                <th className="p-2 text-right">Pur. Rate</th>
                <th className="p-2 text-right">Sell Rate</th>
                <th className="p-2 text-left">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold">{b.batch_number || '—'}</td>
                  <td className="p-2 text-right font-black font-mono">
                    {safeNum(b.quantity_available)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ₹{formatINR(b.purchase_rate)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ₹{formatINR(b.selling_rate)}
                  </td>
                  <td className="p-2 font-mono">{formatDateIN(b.expiry_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        {batches.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono font-bold text-sm">{b.batch_number || '—'}</p>
              <span className="text-[10px] font-mono text-slate-500">
                Exp: {formatDateIN(b.expiry_date)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">Available</p>
                <p className="font-black font-mono text-emerald-700">
                  {safeNum(b.quantity_available)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Pur.Rate</p>
                <p className="font-mono">₹{formatINR(b.purchase_rate)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Sell Rate</p>
                <p className="font-mono">₹{formatINR(b.selling_rate)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function LedgerSection({ ledger }: { ledger: DetailLedgerRow[] }) {
  if (ledger.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center text-slate-500 text-sm">
        No ledger entries.
      </div>
    )
  }
  return (
    <>
      <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-200 font-bold">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Movement</th>
                <th className="p-2 text-left">Ref</th>
                <th className="p-2 text-right">In</th>
                <th className="p-2 text-right">Out</th>
                <th className="p-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ledger.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-2 font-mono text-[11px]">
                    {formatDateIN(r.created_at)}
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 font-bold uppercase text-[9px]">
                      {r.movement_type}
                    </span>
                  </td>
                  <td className="p-2 font-mono font-bold text-[11px]">
                    {r.reference_number || '—'}
                  </td>
                  <td className="p-2 text-right font-bold text-emerald-600 font-mono">
                    {safeNum(r.quantity_in) > 0 ? `+${safeNum(r.quantity_in)}` : '—'}
                  </td>
                  <td className="p-2 text-right font-bold text-rose-600 font-mono">
                    {safeNum(r.quantity_out) > 0 ? `-${safeNum(r.quantity_out)}` : '—'}
                  </td>
                  <td className="p-2 text-right font-black font-mono">
                    {safeNum(r.balance_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-2">
        {ledger.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 font-bold uppercase text-[9px]">
                  {r.movement_type}
                </span>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  <Calendar size={9} className="inline mr-1" />
                  {formatDateIN(r.created_at)}
                </p>
              </div>
              <span className="font-mono font-bold text-[11px]">
                {r.reference_number || '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-[11px]">
              <div>
                <p className="text-[9px] text-slate-500">In</p>
                <p className="font-bold text-emerald-600 font-mono">
                  {safeNum(r.quantity_in) > 0 ? `+${safeNum(r.quantity_in)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500">Out</p>
                <p className="font-bold text-rose-600 font-mono">
                  {safeNum(r.quantity_out) > 0 ? `-${safeNum(r.quantity_out)}` : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Balance</p>
                <p className="font-black font-mono">{safeNum(r.balance_after)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}