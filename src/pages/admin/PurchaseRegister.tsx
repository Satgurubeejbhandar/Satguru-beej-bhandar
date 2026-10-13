// src/pages/admin/PurchaseRegister.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { 
  Truck, 
  RefreshCw, 
  Search, 
  Download,  
  ShieldAlert, 
  Loader2, 
  Calendar, 
  Hash, 
  Layers, 
  Building2, 
  User,
  Eye,
  ExternalLink,
  X,
  Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CompanyInfo {
  company_name: string | null
  gst_number: string | null
}

interface PurchaseBillRow {
  id: string
  bill_number: string
  bill_date: string
  vendor_bill_number: string | null
  total_amount: number
  total_items: number
  notes: string | null
  bill_photo_url: string | null
  company: CompanyInfo | null
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function escapeCSV(val: string): string {
  const safe = String(val ?? '').replace(/"/g, '""')
  return `"${safe}"`
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'Document'
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '—'
  const parts = dStr.split('T')[0].split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dStr
}

/**
 * Multi-fallback smart storage URL resolver for Private & Public Supabase Buckets
 */
async function resolveStorageUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''

  const cleanStr = pathOrUrl.trim()
  if (!cleanStr) return ''

  let bucket = 'company-bills'
  let objectPath = ''

  if (cleanStr.includes('/storage/v1/object/')) {
    try {
      const parts = cleanStr.split('/storage/v1/object/')[1]
      if (parts) {
        const withoutQuery = parts.split('?')[0]
        const segments = withoutQuery.split('/').filter(Boolean)
        if (segments.length >= 3) {
          bucket = segments[1]
          objectPath = segments.slice(2).join('/')
        }
      }
    } catch {
      // ignore
    }
  }

  if (!objectPath) {
    if (cleanStr.startsWith('http://') || cleanStr.startsWith('https://')) {
      return cleanStr
    }
    objectPath = cleanStr
  }

  // Attempt 1: Exact path as recorded
  try {
    const { data: signed1, error: err1 } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600)

    if (!err1 && signed1?.signedUrl) return signed1.signedUrl
  } catch { }

  // Attempt 2: If objectPath starts with bucket name, try stripping it
  if (objectPath.startsWith(`${bucket}/`)) {
    const strippedPath = objectPath.substring(bucket.length + 1)
    try {
      const { data: signed2, error: err2 } = await supabase.storage
        .from(bucket)
        .createSignedUrl(strippedPath, 3600)

      if (!err2 && signed2?.signedUrl) return signed2.signedUrl
    } catch { }
  }

  // Attempt 3: Try prepending bucket name if missing
  if (!objectPath.startsWith(`${bucket}/`)) {
    const prependedPath = `${bucket}/${objectPath}`
    try {
      const { data: signed3, error: err3 } = await supabase.storage
        .from(bucket)
        .createSignedUrl(prependedPath, 3600)

      if (!err3 && signed3?.signedUrl) return signed3.signedUrl
    } catch { }
  }

  return cleanStr
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PurchaseRegister() {
  const { role, loading: authLoading } = useAuth()
  const [bills, setBills] = useState<PurchaseBillRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  // Invoice viewer modal state
  const [viewingInvoice, setViewingInvoice] = useState<{
    url: string
    refNo: string
    date: string
    companyName: string
    loading: boolean
  } | null>(null)
  const [imgLoadError, setImgLoadError] = useState(false)

  const isMountedRef = useRef<boolean>(true)

  const loadPurchaseRegister = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)
      const pageSize = 1000
      let page = 0
      const all: PurchaseBillRow[] = []
      let hasMore = true

      while (hasMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1

        // Primary Query Attempt
        const { data, error } = await (async () => {
          let req = supabase
            .from('purchase_bills')
            .select(`
              id,
              bill_number,
              bill_date,
              vendor_bill_number,
              total_amount,
              total_items,
              notes,
              bill_photo_url,
              company:companies(company_name, gst_number)
            `)
            .order('bill_date', { ascending: false })
            .range(from, to)

          if (fromDate) req = req.gte('bill_date', fromDate)
          if (toDate) req = req.lte('bill_date', toDate)

          const res = await req
          if (res.error && res.error.message.includes('vendor_bill_number')) {
            // Fallback Query if column is missing on DB
            let fallbackReq = supabase
              .from('purchase_bills')
              .select(`
                id,
                bill_number,
                bill_date,
                total_amount,
                total_items,
                notes,
                bill_photo_url,
                company:companies(company_name, gst_number)
              `)
              .order('bill_date', { ascending: false })
              .range(from, to)

            if (fromDate) fallbackReq = fallbackReq.gte('bill_date', fromDate)
            if (toDate) fallbackReq = fallbackReq.lte('bill_date', toDate)

            return await fallbackReq
          }
          return res
        })()

        if (error) throw error
        if (!isMountedRef.current) break

        const chunk = (data || []).map((row: Record<string, any>) => {
          let vendorNo = row.vendor_bill_number || null
          if (!vendorNo && row.notes) {
            const match = String(row.notes).match(/Vendor Bill:\s*([^\s|]+)/)
            if (match) vendorNo = match[1]
          }

          return {
            id: String(row.id),
            bill_number: String(row.bill_number || ''),
            bill_date: String(row.bill_date || ''),
            vendor_bill_number: vendorNo,
            total_amount: safeNum(row.total_amount),
            total_items: safeNum(row.total_items),
            notes: row.notes || null,
            bill_photo_url: row.bill_photo_url || null,
            company: Array.isArray(row.company) ? row.company[0] : row.company,
          }
        })

        all.push(...chunk)
        hasMore = chunk.length === pageSize
        page++
      }

      if (isMountedRef.current) {
        setBills(all)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase register load failed'
      if (isMountedRef.current) {
        toast.error('खरीद रजिस्टर लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [fromDate, toDate, role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadPurchaseRegister()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [loadPurchaseRegister, role, authLoading])

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills

    return bills.filter((b) => {
      const compName = b.company?.company_name || ''
      const billNo = b.bill_number || ''
      const vendorNo = b.vendor_bill_number || ''
      const billNotes = b.notes || ''

      const haystack = `${compName} ${billNo} ${vendorNo} ${billNotes}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [bills, search])

  const totalPurchaseValue = useMemo(() => {
    return filteredBills.reduce((acc, b) => acc + safeNum(b.total_amount), 0)
  }, [filteredBills])

  const exportCSV = () => {
    if (filteredBills.length === 0) {
      toast.error('Export के लिए कोई डेटा नहीं है')
      return
    }

    const header = 'Date,System Bill No,Company Name,GSTIN,Vendor Bill No,Total Items,Total Amount ₹\n'
    const body = filteredBills
      .map((b) =>
        [
          escapeCSV(b.bill_date),
          escapeCSV(b.bill_number),
          escapeCSV(b.company?.company_name || ''),
          escapeCSV(b.company?.gst_number || ''),
          escapeCSV(b.vendor_bill_number || ''),
          b.total_items,
          b.total_amount.toFixed(2),
        ].join(',')
      )
      .join('\n')

    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Purchase_Register_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Purchase Register CSV डाउनलोड हो गया!')
  }

  /* ---- Open Physical Invoice Modal ---- */
  const handleOpenInvoice = useCallback(async (rawUrl: string, refNo: string, date: string, companyName: string) => {
    setImgLoadError(false)
    setViewingInvoice({
      url: '',
      refNo,
      date,
      companyName,
      loading: true,
    })

    try {
      const finalUrl = await resolveStorageUrl(rawUrl)
      if (!finalUrl) {
        toast.error('Bill URL not available')
        setViewingInvoice(null)
        return
      }
      setViewingInvoice({
        url: finalUrl,
        refNo,
        date,
        companyName,
        loading: false,
      })
    } catch {
      toast.error('Unable to open bill image.')
      setViewingInvoice(null)
    }
  }, [])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास खरीद रजिस्टर देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/50 min-h-screen">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <Truck className="text-emerald-400 shrink-0" size={24} /> 
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Purchase Register
            </h1>
          </div>
          <p className="text-emerald-300 text-xs sm:text-sm font-medium max-w-xl">
            कंपनी-वार खरीद बिल, इनवॉइस संदर्भ एवं इनवर्ड स्टॉक एंट्री लॉग
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={exportCSV}
            disabled={loading || filteredBills.length === 0}
            className="flex-1 md:flex-none px-4 py-3 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 hover:text-white disabled:opacity-50 disabled:pointer-events-none font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-emerald-700/50 transition cursor-pointer"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            type="button"
            onClick={loadPurchaseRegister}
            disabled={loading}
            className="flex-1 md:flex-none px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 disabled:pointer-events-none font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-md space-y-4">
        <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
          
          {/* Search bar */}
          <div className="flex items-center gap-2.5 flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition bg-slate-50/50">
            <Search className="text-slate-400 shrink-0" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, bill no, vendor..."
              className="flex-1 outline-none text-xs sm:text-sm font-medium bg-transparent min-w-0 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Date Filters + Total purchases */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between xl:justify-end">
            
            {/* Date Pickers */}
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 w-full sm:w-auto">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent outline-none font-semibold text-slate-700 min-w-[100px]"
                />
              </div>
              <span className="font-bold text-slate-400 px-1">to</span>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 w-full sm:w-auto">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent outline-none font-semibold text-slate-700 min-w-[100px]"
                />
              </div>
            </div>

            {/* Total purchase amount display */}
            <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4 flex sm:block justify-between items-center bg-emerald-50/40 sm:bg-transparent p-2 sm:p-0 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Purchases</span>
              <p className="text-lg font-black text-emerald-800 font-mono">₹{formatINR(totalPurchaseValue)}</p>
            </div>
          </div>

        </div>
      </div>

      {/* ===== DESKTOP TABLE VIEW ===== */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-emerald-900 text-emerald-50 font-bold uppercase text-[11px] tracking-wider border-b border-emerald-950">
                <th className="p-4 pl-6">Bill Date</th>
                <th className="p-4">System Bill #</th>
                <th className="p-4">Company Name</th>
                <th className="p-4">Vendor Invoice #</th>
                <th className="p-4 text-center">Items</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-center pr-6">Attachment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-emerald-700" />
                      <span>Loading purchase records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    No purchase bills found.
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 pl-6 font-mono text-slate-500">{formatDateDisplay(b.bill_date)}</td>
                    <td className="p-4 font-mono font-bold text-emerald-900">{b.bill_number}</td>
                    <td className="p-4">
                      <p className="font-extrabold text-slate-900">{b.company?.company_name || '—'}</p>
                      {b.company?.gst_number && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-[10px] font-mono text-slate-600 rounded">
                          GST: {b.company.gst_number}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-800">
                      {b.vendor_bill_number || '—'}
                    </td>
                    <td className="p-4 text-center font-bold font-mono">{b.total_items}</td>
                    <td className="p-4 text-right font-black text-emerald-850 font-mono text-sm">
                      ₹{formatINR(b.total_amount)}
                    </td>
                    <td className="p-4 text-center pr-6">
                      {b.bill_photo_url ? (
                        <button
                          onClick={() => handleOpenInvoice(
                            b.bill_photo_url!, 
                            b.bill_number, 
                            b.bill_date, 
                            b.company?.company_name || 'Unknown'
                          )}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold rounded-lg border border-emerald-100 text-[11px] inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Click to view uploaded physical invoice"
                        >
                          <Eye size={13} className="text-emerald-600" /> View Bill
                        </button>
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filteredBills.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-emerald-900 font-black">
                  <td colSpan={5} className="p-4 pl-6 uppercase text-emerald-950 font-extrabold">
                    Grand Total ({filteredBills.length} Bills)
                  </td>
                  <td className="p-4 text-right font-mono text-base text-emerald-900">
                    ₹{formatINR(totalPurchaseValue)}
                  </td>
                  <td className="p-4 pr-6"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ===== TABLET & MOBILE CARD VIEW ===== */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border text-center text-slate-400 font-bold">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-emerald-700" />
              <span>Loading purchase records...</span>
            </div>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border text-center text-slate-400 font-medium">
            No purchase bills found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBills.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4">
                  {/* Card Top: Company Name + Price */}
                  <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <p className="font-bold text-slate-900 text-sm truncate">
                          {b.company?.company_name || '—'}
                        </p>
                      </div>
                      {b.company?.gst_number && (
                        <p className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded inline-block">
                          GST: {b.company.gst_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Amount</span>
                      <p className="text-base font-black text-emerald-900 font-mono leading-none mt-1">
                        ₹{formatINR(b.total_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Card Data Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                        <Calendar size={11} /> <span>Bill Date</span>
                      </div>
                      <p className="font-mono font-bold text-slate-700 pl-4">{formatDateDisplay(b.bill_date)}</p>
                    </div>
                    
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                        <Hash size={11} /> <span>System Bill</span>
                      </div>
                      <p className="font-mono font-bold text-emerald-800 pl-4 truncate">{b.bill_number}</p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                        <User size={11} /> <span>Vendor Inv</span>
                      </div>
                      <p className="font-mono font-bold text-slate-700 pl-4 truncate">
                        {b.vendor_bill_number || '—'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                        <Layers size={11} /> <span>Total Items</span>
                      </div>
                      <p className="font-mono font-bold text-slate-700 pl-4">{b.total_items}</p>
                    </div>
                  </div>

                  {/* Card Footer: View Attachment Link */}
                  {b.bill_photo_url && (
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenInvoice(
                          b.bill_photo_url!, 
                          b.bill_number, 
                          b.bill_date, 
                          b.company?.company_name || 'Unknown'
                        )}
                        className="w-full px-3 py-2.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold rounded-xl border border-emerald-100 text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
                      >
                        <Eye size={14} /> View Attached Bill
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile / Tablet Grand Total Sticky Footer or Card */}
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-2xl border border-emerald-800 shadow-xl p-5 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Grand Total</p>
                <p className="text-xs text-emerald-100 font-bold mt-0.5">
                  ({filteredBills.length} Bills)
                </p>
              </div>
              <p className="text-xl font-black text-amber-400 font-mono">
                ₹{formatINR(totalPurchaseValue)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ============ INVOICE VIEWER POPUP MODAL ============ */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in print-hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                    Physical Bill: {viewingInvoice.refNo}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bill Date: {formatDateDisplay(viewingInvoice.date)} • {viewingInvoice.companyName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingInvoice.url && (
                  <a
                    href={viewingInvoice.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[72vh] custom-scrollbar">
              {viewingInvoice.loading ? (
                <div className="text-center py-12">
                  <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">Loading invoice document...</p>
                </div>
              ) : viewingInvoice.url ? (
                viewingInvoice.url.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={viewingInvoice.url}
                    title="Invoice PDF"
                    className="w-full h-[65vh] rounded-2xl border border-slate-200 bg-white"
                  />
                ) : !imgLoadError ? (
                  <img
                    src={viewingInvoice.url}
                    alt="Uploaded Bill"
                    onError={() => setImgLoadError(true)}
                    className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-md border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="text-center p-8 bg-white rounded-2xl border border-rose-100 max-w-md">
                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert size={24} />
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1">Unable to preview image directly</p>
                    <p className="text-xs text-slate-500 mb-4">
                      The file might be restricted by storage permissions or moved.
                    </p>
                    <a
                      href={viewingInvoice.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                    >
                      <ExternalLink size={14} /> Open Direct File Link
                    </a>
                  </div>
                )
              ) : (
                <p className="text-slate-400 font-medium">No document available.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Satguru Beej Bhandar Accounting Document
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {viewingInvoice.url && (
                  <a
                    href={viewingInvoice.url}
                    download={`Bill_${sanitizeFilename(viewingInvoice.refNo)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} /> Download File
                  </a>
                )}
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}