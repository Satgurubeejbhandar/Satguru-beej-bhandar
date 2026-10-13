// src/pages/admin/SalesRegister.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FC,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  FileSpreadsheet,
  Search,
  Printer,
  Download,
  RefreshCw,
  Loader2,
  Calendar,
  Filter,
  ShieldAlert,
  Package,
  IndianRupee,
  Hash,
  User,
  Building2,
  Tag,
  Camera,
  RotateCcw,
  ShoppingCart
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types & Interfaces ──────────────────────────────────────────────────────

interface SalesBillInfo {
  bill_number: string
  bill_date: string
  bill_status: string
  farmer?: {
    farmer_name: string
    farmer_id: string
  } | null
  group?: {
    group_name: string
    group_id: string
  } | null
}

interface ProductInfo {
  product_name: string
  sku: string
  company?: {
    company_name: string
  } | null
}

interface CompanyInfo {
  company_name: string
}

export interface UnifiedRegisterRow {
  id: string
  sales_bill_id: string
  product_id?: string | null
  product_name?: string | null
  batch_number?: string | null
  quantity: number
  unit_name?: string | null
  rate: number
  total_amount: number
  created_at?: string
  sales_bill?: SalesBillInfo | null
  product?: ProductInfo | null
  company?: CompanyInfo | null
  is_physical?: boolean
  is_return?: boolean
  file_path?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(val: number | string | null | undefined): string {
  const n = safeNum(val)
  const absFormatted = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return n < 0 ? `-₹${absFormatted}` : `₹${absFormatted}`
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '-'
  const parts = dStr.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dStr
}

function getThirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Secure Date-Constrained Paginated Fetcher ───────────────────────────────

async function fetchUnifiedSalesRegister(
  fromDate: string,
  toDate: string,
  batchSize = 1000
): Promise<UnifiedRegisterRow[]> {
  const start = fromDate || getThirtyDaysAgo()
  const end = toDate || getToday()

  // 1. Fetch Digital Sales Bill Items
  const digitalRecords: UnifiedRegisterRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('sales_bill_items')
      .select(`
        *,
        sales_bill:sales_bills!inner(
          bill_number,
          bill_date,
          bill_status,
          farmer:farmers(farmer_name, farmer_id),
          group:farmer_groups(group_name, group_id)
        ),
        product:products(product_name, sku),
        company:companies(company_name)
      `)
      .eq('sales_bill.bill_status', 'active')
      .gte('sales_bill.bill_date', start)
      .lte('sales_bill.bill_date', end)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    digitalRecords.push(
      ...(data as unknown as UnifiedRegisterRow[]).map((d) => ({
        ...d,
        quantity: safeNum(d.quantity),
        rate: safeNum(d.rate),
        total_amount: safeNum(d.total_amount),
        is_physical: false,
        is_return: false,
      }))
    )
    if (data.length < batchSize) break
    from += batchSize
  }

  // 2. Fetch Physical Paper Bills
  const physicalRecords: UnifiedRegisterRow[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('physical_bills')
      .select('*, farmer:farmers(farmer_name, farmer_id)')
      .gte('bill_date', start)
      .lte('bill_date', end)
      .eq('status', 'active')
      .range(from, from + batchSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: UnifiedRegisterRow[] = data.map((pb: any) => ({
      id: pb.id,
      sales_bill_id: pb.id,
      product_name: 'Physical Paper Bill',
      batch_number: 'N/A',
      quantity: 1,
      unit_name: 'Bill',
      rate: safeNum(pb.bill_amount),
      total_amount: safeNum(pb.bill_amount),
      created_at: pb.created_at,
      is_physical: true,
      is_return: false,
      file_path: pb.file_path,
      sales_bill: {
        bill_number: pb.bill_number,
        bill_date: pb.bill_date,
        bill_status: pb.status,
        farmer: pb.farmer,
        group: null,
      },
      product: null,
      company: null,
    }))

    physicalRecords.push(...mapped)
    if (data.length < batchSize) break
    from += batchSize
  }

  // 3. Fetch Customer Sales Returns (return_items + returns)
  const returnRecords: UnifiedRegisterRow[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('return_items')
      .select(`
        *,
        return:returns!inner(
          return_number,
          return_date,
          return_status,
          reason,
          farmer:farmers(farmer_name, farmer_id),
          group:farmer_groups(group_name, group_id),
          original_bill:sales_bills(bill_number)
        ),
        product:products(product_name, sku, company:companies(company_name))
      `)
      .gte('return.return_date', start)
      .lte('return.return_date', end)
      .range(from, from + batchSize - 1)

    if (error) {
      console.warn('Return items query error:', error)
      break
    }
    if (!data || data.length === 0) break

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedReturns: UnifiedRegisterRow[] = data.map((ri: any) => {
      const retHeader = ri.return || {}
      const prod = ri.product || {}
      const st = String(retHeader.return_status || 'completed').toLowerCase()
      
      if (st === 'cancelled' || st === 'void') {
        return null
      }

      const q = safeNum(ri.quantity)
      const amt = safeNum(ri.total_amount ?? (q * safeNum(ri.rate)))

      return {
        id: `ret_${ri.id}`,
        sales_bill_id: ri.return_id,
        product_name: prod.product_name || ri.reason || 'Returned Product',
        batch_number: 'RETURN',
        quantity: -Math.abs(q), // Negative for Return
        unit_name: 'Pkt',
        rate: safeNum(ri.rate),
        total_amount: -Math.abs(amt), // Negative for Return
        created_at: ri.created_at || retHeader.created_at,
        is_physical: false,
        is_return: true,
        sales_bill: {
          bill_number: retHeader.return_number || 'RETURN',
          bill_date: retHeader.return_date,
          bill_status: retHeader.return_status || 'completed',
          farmer: retHeader.farmer,
          group: retHeader.group,
        },
        product: prod,
        company: prod.company ? { company_name: prod.company.company_name } : null,
      }
    }).filter(Boolean) as UnifiedRegisterRow[]

    returnRecords.push(...mappedReturns)
    if (data.length < batchSize) break
    from += batchSize
  }

  // Merge and sort all entries chronologically
  const combined = [...digitalRecords, ...physicalRecords, ...returnRecords]
  combined.sort((a, b) => {
    const d1 = new Date(a.sales_bill?.bill_date || a.created_at || '').getTime()
    const d2 = new Date(b.sales_bill?.bill_date || b.created_at || '').getTime()
    return d2 - d1
  })

  return combined
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SalesRegister: FC = () => {
  const { role, loading: authLoading } = useAuth()

  const [items, setItems] = useState<UnifiedRegisterRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [exporting, setExporting] = useState<boolean>(false)

  const [fromDate, setFromDate] = useState<string>(getThirtyDaysAgo())
  const [toDate, setToDate] = useState<string>(getToday())

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'DIGITAL' | 'PHYSICAL' | 'RETURN'>('ALL')

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadRegister = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)
      const data = await fetchUnifiedSalesRegister(fromDate, toDate)
      if (isMountedRef.current) {
        setItems(data)
      }
    } catch (err: unknown) {
      console.error('Failed to load sales register:', err)
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Error fetching register'
        toast.error('सेल्स रजिस्टर लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [fromDate, toDate, role])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') return
    void loadRegister()
  }, [loadRegister, role, authLoading])

  const companyOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => {
      const cName = it.company?.company_name
      if (cName) set.add(cName)
    })
    return Array.from(set).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()

    return items.filter((row) => {
      // Source filter
      if (sourceFilter === 'DIGITAL' && (row.is_physical || row.is_return)) return false
      if (sourceFilter === 'PHYSICAL' && !row.is_physical) return false
      if (sourceFilter === 'RETURN' && !row.is_return) return false

      // Company filter
      if (selectedCompany !== 'ALL') {
        const comp = row.company?.company_name || ''
        if (comp !== selectedCompany && !row.is_physical) return false
      }

      if (!q) return true

      const billNo = row.sales_bill?.bill_number?.toLowerCase() || ''
      const farmerName = row.sales_bill?.farmer?.farmer_name?.toLowerCase() || ''
      const farmerId = row.sales_bill?.farmer?.farmer_id?.toLowerCase() || ''
      const groupName = row.sales_bill?.group?.group_name?.toLowerCase() || ''
      const pName = (row.product_name || row.product?.product_name || '').toLowerCase()
      const batch = (row.batch_number || '').toLowerCase()

      return (
        billNo.includes(q) ||
        farmerName.includes(q) ||
        farmerId.includes(q) ||
        groupName.includes(q) ||
        pName.includes(q) ||
        batch.includes(q)
      )
    })
  }, [items, searchTerm, selectedCompany, sourceFilter])

  // Summary Metrics Breakdown
  const summaries = useMemo(() => {
    let grossSales = 0
    let salesReturns = 0
    let grossQty = 0
    let returnQty = 0

    filteredItems.forEach((row) => {
      if (row.is_return) {
        salesReturns += Math.abs(safeNum(row.total_amount))
        returnQty += Math.abs(safeNum(row.quantity))
      } else {
        grossSales += safeNum(row.total_amount)
        grossQty += safeNum(row.quantity)
      }
    })

    const netSales = grossSales - salesReturns
    const netQty = grossQty - returnQty

    return {
      count: filteredItems.length,
      grossSales: Math.round(grossSales * 100) / 100,
      salesReturns: Math.round(salesReturns * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      netQty: Math.round(netQty * 100) / 100,
    }
  }, [filteredItems])

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error('एक्सपोर्ट करने के लिए कोई डेटा नहीं है')
      return
    }

    setExporting(true)
    try {
      const headers = [
        'Type',
        'Date',
        'Bill / Return No',
        'Customer / Farmer',
        'Farmer ID / Group',
        'Company',
        'Product Name',
        'Batch Number',
        'Quantity',
        'Unit',
        'Rate ₹',
        'Total Amount ₹',
      ]

      const rows = filteredItems.map((r) => {
        const customer =
          r.sales_bill?.farmer?.farmer_name ||
          r.sales_bill?.group?.group_name ||
          'Counter Customer'
        const custId =
          r.sales_bill?.farmer?.farmer_id ||
          r.sales_bill?.group?.group_id ||
          '-'
        const prod = r.product_name || r.product?.product_name || '-'
        const comp = r.company?.company_name || '-'
        let type = 'Digital Sale'
        if (r.is_physical) type = 'Physical Paper Bill'
        if (r.is_return) type = 'Farmer Return'

        return [
          `"${type}"`,
          `"${r.sales_bill?.bill_date || ''}"`,
          `"${r.sales_bill?.bill_number || ''}"`,
          `"${customer.replace(/"/g, '""')}"`,
          `"${custId}"`,
          `"${comp.replace(/"/g, '""')}"`,
          `"${prod.replace(/"/g, '""')}"`,
          `"${r.batch_number || '-'}"`,
          safeNum(r.quantity),
          `"${r.unit_name || ''}"`,
          safeNum(r.rate),
          safeNum(r.total_amount),
        ].join(',')
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Sales_Register_${fromDate}_to_${toDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('CSV फ़ाइल सफलतापूर्वक डाउनलोड हो गई')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('एक्सपोर्ट असफल रहा')
    } finally {
      if (isMountedRef.current) setExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास सेल्स रजिस्टर देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto p-3 sm:p-6 font-sans bg-slate-50/50 min-h-screen">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #ffffff !important; }
          .print-hidden { display: none !important; }
          .print-only { display: block !important; }
          .print-table { display: table !important; }
          .print-table th, .print-table td { padding: 4px 6px !important; font-size: 10px !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print-hidden">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <FileSpreadsheet className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Sales Register
              <span className="hidden sm:inline text-emerald-300 font-normal ml-2 text-sm">(विक्रय रजिस्टर)</span>
            </h1>
          </div>
          <p className="text-emerald-300 text-xs sm:text-sm font-medium max-w-xl">
            Complete Itemized Sales, Physical Bills &amp; Customer Returns Statement
          </p>
        </div>

        <div className="grid grid-cols-3 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => void loadRegister()}
            disabled={loading}
            className="px-3 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-emerald-700/50 transition cursor-pointer disabled:opacity-60 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{loading ? 'Loading...' : 'Refresh'}</span>
            <span className="sm:hidden">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting || loading}
            className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer disabled:opacity-60"
          >
            <Download size={14} />
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'CSV'}</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print A4</span>
            <span className="sm:hidden">Print</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-md space-y-4 print-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          {/* Search Box */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block font-bold text-[11px] text-slate-700 uppercase tracking-wider">
              Search Product / Bill / Farmer / Return
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search DAP, Bill #1042, RET-..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-slate-50/50 font-medium text-slate-800 transition"
              />
            </div>
          </div>

          {/* Source Filter */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block font-bold text-[11px] text-slate-700 uppercase tracking-wider">
              Source Filter
            </label>
            <select
              value={sourceFilter}
              onChange={(e: any) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600 bg-slate-50/50 font-semibold text-slate-800 transition cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="DIGITAL">Digital Sales</option>
              <option value="PHYSICAL">Physical Bills</option>
              <option value="RETURN">Farmer Returns</option>
            </select>
          </div>

          {/* Company Filter */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block font-bold text-[11px] text-slate-700 uppercase tracking-wider">
              Company
            </label>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-slate-50/50 font-semibold text-slate-800 appearance-none transition cursor-pointer"
              >
                <option value="ALL">All Companies</option>
                {companyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Period Filters */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} /> Date Range
            </label>
            <div className="flex items-center gap-2 min-w-0">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full min-w-0 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50/50 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
              />
              <span className="text-slate-400 text-xs shrink-0 font-bold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full min-w-0 px-2.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 bg-slate-50/50 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 text-[11px]">
          <span className="font-bold text-slate-500 self-center pr-1">Quick Period:</span>
          <button
            type="button"
            onClick={() => {
              const today = getToday()
              setFromDate(today)
              setToDate(today)
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg font-semibold text-slate-700 transition cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, '0')
              setFromDate(`${y}-${m}-01`)
              setToDate(now.toISOString().split('T')[0])
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg font-semibold text-slate-700 transition cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => {
              setFromDate(getThirtyDaysAgo())
              setToDate(getToday())
            }}
            className="px-3 py-1.5 bg-emerald-100 text-emerald-950 font-bold rounded-lg transition cursor-pointer border border-emerald-200"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print-hidden">
        
        {/* Gross Sales */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gross Sales</p>
            <p className="text-lg font-black font-mono text-slate-800 mt-0.5 truncate">
              {formatINR(summaries.grossSales)}
            </p>
          </div>
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 ml-2 text-slate-600">
            <ShoppingCart size={18} />
          </div>
        </div>

        {/* Returns */}
        <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Farmer Returns</p>
            <p className="text-lg font-black font-mono text-rose-900 mt-0.5 truncate">
              − {formatINR(summaries.salesReturns)}
            </p>
          </div>
          <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center shrink-0 ml-2 text-rose-700">
            <RotateCcw size={18} />
          </div>
        </div>

        {/* Net Sales */}
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Net Sales Revenue</p>
            <p className="text-xl font-black font-mono text-emerald-950 mt-0.5 truncate">
              {formatINR(summaries.netSales)}
            </p>
          </div>
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 ml-2 text-emerald-800">
            <IndianRupee size={18} />
          </div>
        </div>

        {/* Net Qty */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Net Qty Sold</p>
            <p className="text-lg font-black font-mono text-slate-900 mt-0.5 truncate">
              {summaries.netQty.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 ml-2 text-slate-600">
            <Package size={18} />
          </div>
        </div>

      </div>

      {/* Printable Title Header (Print Only) */}
      <div className="hidden print:block text-center border-b pb-3 mb-3 print-only">
        <h2 className="text-xl font-black uppercase tracking-wide text-emerald-950">
          SATGURU BEEJ BHANDAR
        </h2>
        <p className="text-[11px] text-gray-600">Daloosar, Sardarshahar (Churu), Rajasthan</p>
        <p className="text-xs font-bold mt-1 text-emerald-800">
          UNIFIED SALES &amp; RETURNS REGISTER ({formatDateDisplay(fromDate)} — {formatDateDisplay(toDate)})
        </p>
      </div>

      {/* Data Container */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-16 text-center text-slate-400 space-y-3">
          <Loader2 size={32} className="animate-spin text-emerald-700 mx-auto" />
          <p className="font-bold text-xs">सेल्स और रिटर्न रिकॉर्ड्स लोड हो रहे हैं...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-16 text-center text-slate-400 space-y-3">
          <Package size={40} className="mx-auto text-slate-300" />
          <p className="font-bold text-sm">इस अवधि में कोई बिक्री या रिटर्न रिकॉर्ड नहीं मिला।</p>
        </div>
      ) : (
        <>
          {/* ===== DESKTOP TABLE VIEW ===== */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse print-table">
                <thead>
                  <tr className="bg-emerald-900 text-emerald-50 font-bold uppercase text-[11px] tracking-wider border-b border-emerald-950">
                    <th className="p-3.5 pl-6 whitespace-nowrap">दिनांक</th>
                    <th className="p-3.5 whitespace-nowrap">बिल / रिटर्न नं.</th>
                    <th className="p-3.5">किसान / पार्टी</th>
                    <th className="p-3.5">कंपनी</th>
                    <th className="p-3.5">आइटम / विवरण</th>
                    <th className="p-3.5 whitespace-nowrap">बैच नं.</th>
                    <th className="p-3.5 text-right whitespace-nowrap">मात्रा</th>
                    <th className="p-3.5 text-right whitespace-nowrap">दर ₹</th>
                    <th className="p-3.5 text-right whitespace-nowrap pr-6">कुल राशि ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredItems.map((row) => {
                    const bill = row.sales_bill
                    const customerName =
                      bill?.farmer?.farmer_name ||
                      bill?.group?.group_name ||
                      'Counter Sale'
                    const customerId =
                      bill?.farmer?.farmer_id ||
                      bill?.group?.group_id ||
                      ''
                    const productName =
                      row.product_name || row.product?.product_name || '—'
                    const companyName = row.company?.company_name || '—'

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          row.is_return
                            ? 'bg-rose-50/60 hover:bg-rose-100/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-3 pl-6 font-mono whitespace-nowrap text-slate-500">
                          {formatDateDisplay(bill?.bill_date || row.created_at)}
                        </td>
                        <td className="p-3 font-mono font-bold whitespace-nowrap">
                          {bill?.bill_number || '—'}
                          {row.is_physical && (
                            <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded uppercase">
                              PHY
                            </span>
                          )}
                          {row.is_return && (
                            <span className="ml-1 text-[9px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded uppercase font-extrabold">
                              RETURN
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="font-extrabold text-slate-900">{customerName}</p>
                          {customerId && (
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              ID: {customerId}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 font-semibold">{companyName}</td>
                        <td className={`p-3 font-bold ${row.is_return ? 'text-rose-900' : 'text-slate-900'}`}>
                          {productName}
                        </td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {row.batch_number || '—'}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                            row.is_return ? 'text-rose-700' : 'text-slate-800'
                          }`}
                        >
                          {safeNum(row.quantity)}{' '}
                          <span className="text-slate-400 text-[10px]">{row.unit_name || ''}</span>
                        </td>
                        <td className="p-3 text-right font-mono whitespace-nowrap text-slate-600">
                          ₹{formatINR(row.rate)}
                        </td>
                        <td
                          className={`p-3 pr-6 text-right font-mono font-black whitespace-nowrap ${
                            row.is_return ? 'text-rose-700' : 'text-emerald-950'
                          }`}
                        >
                          {formatINR(row.total_amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-emerald-900 font-black text-xs text-emerald-950">
                    <td colSpan={6} className="p-3.5 pl-6 uppercase">
                      Net Totals ({filteredItems.length} Records)
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      {summaries.netQty.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-400">—</td>
                    <td className="p-3.5 pr-6 text-right font-mono text-sm text-emerald-900">
                      {formatINR(summaries.netSales)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ===== TABLET & MOBILE CARD VIEW ===== */}
          <div className="lg:hidden space-y-3 print-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map((row) => {
                const bill = row.sales_bill
                const customerName =
                  bill?.farmer?.farmer_name ||
                  bill?.group?.group_name ||
                  'Counter Sale'
                const customerId =
                  bill?.farmer?.farmer_id ||
                  bill?.group?.group_id ||
                  ''
                const productName =
                  row.product_name || row.product?.product_name || '—'
                const companyName = row.company?.company_name || '—'

                return (
                  <div
                    key={row.id}
                    className={`rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 space-y-3 ${
                      row.is_return
                        ? 'bg-rose-50/50 border-rose-200'
                        : row.is_physical
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-white border-slate-200/80'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          {row.is_return ? (
                            <RotateCcw size={13} className="text-rose-600 shrink-0" />
                          ) : row.is_physical ? (
                            <Camera size={13} className="text-amber-600 shrink-0" />
                          ) : (
                            <Package size={13} className="text-emerald-600 shrink-0" />
                          )}
                          <p
                            className={`font-bold text-sm truncate ${
                              row.is_return
                                ? 'text-rose-900'
                                : row.is_physical
                                ? 'text-amber-900'
                                : 'text-slate-900'
                            }`}
                          >
                            {productName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Building2 size={10} className="shrink-0" />
                          <span className="truncate font-semibold">{companyName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          Total
                        </span>
                        <p
                          className={`text-base font-black font-mono leading-none mt-1 ${
                            row.is_return ? 'text-rose-700' : 'text-emerald-900'
                          }`}
                        >
                          {formatINR(row.total_amount)}
                        </p>
                      </div>
                    </div>

                    {/* Bill Info Row */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                          <Calendar size={10} /> <span>Date</span>
                        </div>
                        <p className="font-mono font-bold text-slate-700 pl-3.5">
                          {formatDateDisplay(bill?.bill_date || row.created_at)}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                          <Hash size={10} /> <span>Ref / Bill</span>
                        </div>
                        <p className="font-mono font-bold text-emerald-800 pl-3.5 truncate">
                          {bill?.bill_number || '—'}
                          {row.is_return && (
                            <span className="ml-1 text-[9px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-extrabold">
                              RET
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-0.5 col-span-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                          <User size={10} /> <span>Customer / Party</span>
                        </div>
                        <p className="font-bold text-slate-800 pl-3.5 text-xs truncate">
                          {customerName}
                          {customerId && (
                            <span className="ml-1.5 text-[10px] font-mono text-slate-500 font-normal">
                              (ID: {customerId})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Batch & Qty Row */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center font-sans">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                          <Tag size={9} /> <span>Batch</span>
                        </div>
                        <p className="font-mono text-xs font-bold text-slate-700 truncate">
                          {row.batch_number || '—'}
                        </p>
                      </div>
                      <div className="border-l border-r border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Qty</p>
                        <p
                          className={`font-mono text-xs font-bold ${
                            row.is_return ? 'text-rose-700' : 'text-slate-800'
                          }`}
                        >
                          {safeNum(row.quantity)}
                          <span className="text-slate-400 text-[9px] ml-1">
                            {row.unit_name || ''}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                          Rate
                        </p>
                        <p className="font-mono text-xs font-bold text-slate-700">
                          ₹{formatINR(row.rate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mobile Net Totals Card */}
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-2xl border border-emerald-800 shadow-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">
                  Net Sales Revenue
                </p>
                <p className="text-[11px] text-emerald-100 font-bold mt-0.5">
                  ({filteredItems.length} Records · {summaries.netQty.toLocaleString('en-IN')} Net Qty)
                </p>
              </div>
              <p className="text-xl font-black text-amber-400 font-mono">
                {formatINR(summaries.netSales)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SalesRegister