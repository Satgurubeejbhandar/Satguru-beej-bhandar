// src/pages/admin/SaraSamanInventory.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  Search, AlertTriangle, Clock, 
  Building2, Filter, ShieldAlert, RefreshCw, Download 
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface InventoryBatch {
  id: string
  batch_number: string | null
  lot_number: string | null
  quantity_available: number | string | null
  purchase_rate: number | string | null
  selling_rate: number | string | null
  manufacturing_date: string | null
  expiry_date: string | null
  product: {
    id: string
    sku: string | null
    product_name: string | null
    reorder_level: number | string | null
    pack_size: string | null
    pack_unit: string | null
    category: { category_name: string | null } | null
  } | null
  company: {
    company_name: string | null
  } | null
}

interface InventoryStats {
  totalQuantity: number
  totalPurchaseValue: number
  totalSellingValue: number
  expiringCount: number
  lowStockCount: number
  expiredCount: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toNumber(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function escapeCSV(val: string): string {
  const safe = String(val ?? '').replace(/"/g, '""')
  return `"${safe}"`
}

async function fetchAllBatches(batchSize = 1000): Promise<InventoryBatch[]> {
  const allRows: InventoryBatch[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        product:products(id, sku, product_name, reorder_level, pack_size, pack_unit, category:product_categories(category_name)),
        company:companies(company_name)
      `)
      .order('expiry_date', { ascending: true })
      .range(from, from + batchSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...(data as unknown as InventoryBatch[]))
    if (data.length < batchSize) break
    from += batchSize
  }

  return allRows
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SaraSamanInventory() {
  const { role, loading: authLoading } = useAuth()
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'expiring' | 'low_stock' | 'expired'>('all')

  const [stats, setStats] = useState<InventoryStats>({
    totalQuantity: 0,
    totalPurchaseValue: 0,
    totalSellingValue: 0,
    expiringCount: 0,
    lowStockCount: 0,
    expiredCount: 0
  })

  const isMountedRef = useRef(true)

  /* ---- Data Loading & Stats Calculation ---- */

  const loadInventory = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)
      const rawBatches = await fetchAllBatches()
      
      if (!isMountedRef.current) return
      setBatches(rawBatches)

      const today = new Date()
      const todayStr = getLocalDateString(today)
      
      const in60Days = new Date()
      in60Days.setDate(today.getDate() + 60)
      const in60DaysStr = getLocalDateString(in60Days)

      let totalQty = 0
      let totalPurVal = 0
      let totalSellVal = 0
      let expSoon = 0
      let expired = 0

      // Map to aggregate stock quantity per product (eliminating batch low-stock duplication)
      const productStockMap = new Map<string, { totalQty: number; reorderLevel: number }>()

      for (const b of rawBatches) {
        const qty = toNumber(b.quantity_available)
        const purRate = toNumber(b.purchase_rate)
        const sellRate = toNumber(b.selling_rate)
        const expDateStr = b.expiry_date 

        totalQty += qty
        totalPurVal += qty * purRate
        totalSellVal += qty * sellRate

        if (qty > 0) {
          if (expDateStr) {
            if (expDateStr < todayStr) {
              expired++
            } else if (expDateStr <= in60DaysStr) {
              expSoon++
            }
          }

          // Build Aggregate Product stock map
          const prodId = b.product?.id
          if (prodId) {
            const current = productStockMap.get(prodId) || {
              totalQty: 0,
              reorderLevel: toNumber(b.product?.reorder_level) || 10
            }
            current.totalQty += qty
            productStockMap.set(prodId, current)
          }
        }
      }

      // Calculate low stock items aggregate (100% correct matching Dashboard stats)
      let lowStock = 0
      productStockMap.forEach((val) => {
        if (val.totalQty <= val.reorderLevel) {
          lowStock++
        }
      })

      setStats({
        totalQuantity: totalQty,
        totalPurchaseValue: totalPurVal,
        totalSellingValue: totalSellVal,
        expiringCount: expSoon,
        lowStockCount: lowStock,
        expiredCount: expired
      })

    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'डेटा लोड नहीं हो सका'
      toast.error('इन्वेंटरी लोड करने में त्रुटि: ' + msg)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadInventory()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [loadInventory, role, authLoading])

  /* ---- Filtering (Memoized) ---- */

  const filteredBatches = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()
    
    const today = new Date()
    const todayStr = getLocalDateString(today)
    
    const in60Days = new Date()
    in60Days.setDate(today.getDate() + 60)
    const in60DaysStr = getLocalDateString(in60Days)

    return batches.filter(b => {
      if (query) {
        const haystack = [
          b.product?.product_name,
          b.product?.sku,
          b.company?.company_name,
          b.batch_number,
          b.lot_number
        ].filter(Boolean).join(' ').toLowerCase()

        if (!haystack.includes(query)) return false
      }

      const qty = toNumber(b.quantity_available)
      const expDateStr = b.expiry_date

      if (filterType === 'expiring') {
        return qty > 0 && expDateStr && expDateStr >= todayStr && expDateStr <= in60DaysStr
      }
      if (filterType === 'low_stock') {
        const reorder = toNumber(b.product?.reorder_level) || 10
        return qty > 0 && qty <= reorder
      }
      if (filterType === 'expired') {
        return qty > 0 && expDateStr && expDateStr < todayStr
      }

      return true
    })
  }, [batches, searchTerm, filterType])

  /* ---- CSV Export ---- */

  const exportToCSV = useCallback(() => {
    if (filteredBatches.length === 0) {
      toast.error('एक्सपोर्ट करने के लिए कोई डेटा नहीं है')
      return
    }

    const header = 'Product,SKU,Company,Batch,Lot,Available Qty,Purchase Rate,Selling Rate,Mfg Date,Expiry Date\n'
    const body = filteredBatches.map(b => [
      escapeCSV(b.product?.product_name || ''),
      escapeCSV(b.product?.sku || ''),
      escapeCSV(b.company?.company_name || ''),
      escapeCSV(b.batch_number || ''),
      escapeCSV(b.lot_number || ''),
      toNumber(b.quantity_available),
      toNumber(b.purchase_rate).toFixed(2),
      toNumber(b.selling_rate).toFixed(2),
      escapeCSV(b.manufacturing_date || ''),
      escapeCSV(b.expiry_date || '')
    ].join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Sara_Saman_Inventory_${getLocalDateString(new Date())}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Inventory Excel/CSV डाउनलोड हो गई!')
  }, [filteredBatches])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas inventory dekhne ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
            STOCK CONTROL MASTER
          </span>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">SARA SAMAN (सारा सामान — स्टॉक)</h1>
          <p className="text-emerald-200 text-xs mt-1">Daloosar, Sardarshahar — Real-time Company &amp; Batch Stock Tracker</p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button 
            onClick={exportToCSV} 
            disabled={loading || filteredBatches.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl border border-emerald-700 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>
          <button 
            onClick={loadInventory} 
            disabled={loading}
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl border border-amber-500 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            {loading ? 'Refreshing...' : 'Refresh Stock'}
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-emerald-600 transition-all hover:shadow-md">
          <p className="text-xs font-bold text-gray-500 uppercase">Total Stock Quantity</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalQuantity.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Available Units / Bags</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-blue-600 transition-all hover:shadow-md">
          <p className="text-xs font-bold text-gray-500 uppercase">Purchase Value (कुल लागत)</p>
          <p className="text-2xl font-black text-blue-900 mt-1">₹{formatINR(stats.totalPurchaseValue)}</p>
          <p className="text-[11px] text-blue-700 font-semibold mt-1">Total Capital Invested</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-amber-500 transition-all hover:shadow-md">
          <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <Clock size={14} className="text-amber-600" /> Expiring in 60 Days
          </p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.expiringCount} Batches</p>
          <p className="text-[11px] text-amber-800 font-semibold mt-1">Needs Fast Disposal</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-rose-600 transition-all hover:shadow-md">
          <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <AlertTriangle size={14} className="text-rose-600" /> Low Stock Alert
          </p>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.lowStockCount} Items</p>
          <p className="text-[11px] text-rose-800 font-semibold mt-1">Below Reorder Level</p>
        </div>
      </div>

      {/* Urgent Expiry Banner */}
      {stats.expiringCount > 0 && filterType !== 'expiring' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-amber-600 shrink-0" size={24} />
            <div>
              <p className="font-bold text-amber-900 text-sm">EXPIRY ALERT: {stats.expiringCount} उत्पाद अगले 60 दिनों में एक्सपायर होने वाले हैं!</p>
              <p className="text-xs text-amber-800">उन्हें पहले बेचने (FEFO) या कंपनी को रिटर्न करने की प्रक्रिया शुरू करें।</p>
            </div>
          </div>
          <button 
            onClick={() => setFilterType('expiring')}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 shrink-0 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            View Expiring Items
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
          <Search className="text-slate-400 shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search by Product Name, Company, SKU, Batch No..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full outline-none text-slate-800 font-medium placeholder-slate-400 text-sm bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar shrink-0">
          <Filter size={16} className="text-slate-400 shrink-0 hidden sm:block" />
          
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterType === 'all' ? 'bg-emerald-800 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Stock
          </button>
          <button
            type="button"
            onClick={() => setFilterType('expiring')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              filterType === 'expiring' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Clock size={12} /> Expiring Soon (60 Days)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              filterType === 'low_stock' ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle size={12} /> Low Stock
          </button>
          <button
            type="button"
            onClick={() => setFilterType('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              filterType === 'expired' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert size={12} /> Expired
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white border-b border-emerald-800 uppercase font-extrabold tracking-wider">
                <th className="p-4" scope="col">Product &amp; SKU</th>
                <th className="p-4" scope="col">Company</th>
                <th className="p-4" scope="col">Batch / Lot No</th>
                <th className="p-4 text-right" scope="col">Available Stock</th>
                <th className="p-4 text-right" scope="col">Purchase Rate</th>
                <th className="p-4 bg-emerald-950 text-amber-300 text-right" scope="col">Selling Rate</th>
                <th className="p-4" scope="col">Mfg Date</th>
                <th className="p-4" scope="col">Expiry Date</th>
                <th className="p-4 text-center" scope="col">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-emerald-700" />
                      <span className="font-bold">Fetching Inventory Master...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500 font-medium">
                    {batches.length === 0 
                      ? 'कोई स्टॉक रिकॉर्ड नहीं मिला।' 
                      : 'आपकी सर्च या फ़िल्टर के अनुसार कोई स्टॉक नहीं मिला।'}
                  </td>
                </tr>
              ) : (
                filteredBatches.map(b => {
                  const qty = toNumber(b.quantity_available)
                  const todayStr = getLocalDateString(new Date())
                  
                  const in60Days = new Date()
                  in60Days.setDate(in60Days.getDate() + 60)
                  const in60DaysStr = getLocalDateString(in60Days)
                  
                  const expStr = b.expiry_date

                  const isExpired = qty > 0 && expStr && expStr < todayStr
                  const isExpiringSoon = qty > 0 && expStr && expStr >= todayStr && expStr <= in60DaysStr
                  const isZeroQty = qty <= 0

                  return (
                    <tr 
                      key={b.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        isZeroQty ? 'opacity-60 bg-slate-50' : 
                        isExpired ? 'bg-rose-50/50' : 
                        isExpiringSoon ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="p-4">
                        <p className={`font-bold text-sm ${isZeroQty ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {b.product?.product_name || '—'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] mt-1">
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {b.product?.sku || 'NO-SKU'}
                          </span>
                          <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {b.product?.pack_size} {b.product?.pack_unit}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 font-bold text-emerald-900">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-emerald-700 shrink-0" />
                          <span className="truncate max-w-[120px]" title={b.company?.company_name || ''}>
                            {b.company?.company_name || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 font-mono">
                        <p className="font-bold text-slate-800">B: {b.batch_number || '—'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">L: {b.lot_number || '—'}</p>
                      </td>

                      <td className="p-4 font-black text-sm text-right">
                        <span className={`px-2.5 py-1 rounded-lg border ${
                          isZeroQty ? 'bg-slate-100 text-slate-500 border-slate-200' :
                          qty <= Number(b.product?.reorder_level || 10) 
                            ? 'bg-rose-100 text-rose-800 border-rose-200' 
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}>
                          {qty}
                        </span>
                      </td>

                      <td className="p-4 font-bold text-slate-700 text-right">
                        ₹{formatINR(toNumber(b.purchase_rate))}
                      </td>

                      <td className="p-4 font-black text-sm text-emerald-950 bg-emerald-50/60 text-right">
                        ₹{formatINR(toNumber(b.selling_rate))}
                      </td>

                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {b.manufacturing_date || '—'}
                      </td>

                      <td className="p-4 font-mono text-[11px]">
                        {expStr ? (
                          <span className={`font-bold ${
                            isExpired ? 'text-rose-600' : 
                            isExpiringSoon ? 'text-amber-700' : 
                            'text-slate-800'
                          }`}>
                            {expStr}
                          </span>
                        ) : '—'}
                      </td>

                      <td className="p-4 text-center">
                        {isZeroQty ? (
                          <span className="px-2 py-1 bg-slate-200 text-slate-600 font-bold rounded-md text-[9px] uppercase tracking-wider">
                            OUT OF STOCK
                          </span>
                        ) : isExpired ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-800 font-bold rounded-md text-[9px] uppercase tracking-wider border border-rose-200">
                            EXPIRED
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-900 font-bold rounded-md text-[9px] uppercase tracking-wider border border-amber-200">
                            NEAR EXPIRY
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[9px] uppercase tracking-wider border border-emerald-200">
                            IN STOCK
                          </span>
                        )}
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