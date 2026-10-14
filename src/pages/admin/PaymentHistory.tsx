// src/pages/admin/PaymentHistory.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Search,
  CalendarDays,
  Filter,
  Loader2,
  ShieldAlert,
  Download,
  Printer,
  Share2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Receipt,
  X,
  RefreshCw,
  IndianRupee,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PaymentSlipTemplate,
  buildPdfBlob,
  formatINR,
  formatDateDMY,
  formatTime12,
  sanitizeFilename,
  normalisePhone,
  PAYMENT_MODE_LABEL,
  SHOP_INFO,
  type PaymentReceipt,
} from '../../components/PaymentSlip'

/* ─── Types ─── */
interface PaymentRow {
  id: string
  payment_number: string
  farmer_id: string
  payment_amount: number
  payment_mode: string
  payment_received_from: string | null
  reference_number: string | null
  payment_date: string | null
  payment_time: string | null
  previous_outstanding: number
  new_outstanding: number
  notes: string | null
  created_at: string
  farmers: {
    farmer_name: string
    farmer_id: string
    mobile: string | null
    village: string | null
  } | null
}

const PAGE_SIZE = 15

const MODE_OPTIONS = [
  { value: 'all', label: 'All Modes (सभी)' },
  { value: 'cash', label: 'Cash (नकद)' },
  { value: 'upi', label: 'UPI / PhonePe / GPay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
]

function getPaymentDateTime(row: PaymentRow): Date {
  if (row.payment_date) {
    const timeStr = row.payment_time || '00:00:00'
    const d = new Date(`${row.payment_date}T${timeStr}`)
    if (!isNaN(d.getTime())) return d
  }
  return new Date(row.created_at)
}

function rowToReceipt(row: PaymentRow): PaymentReceipt {
  const dt = getPaymentDateTime(row)
  return {
    payment_id: row.id,
    payment_number: row.payment_number,
    payment_amount: Number(row.payment_amount),
    payment_mode: row.payment_mode,
    previous_outstanding: Number(row.previous_outstanding ?? 0),
    new_outstanding: Number(row.new_outstanding ?? 0),
    farmer_name: row.farmers?.farmer_name || row.payment_received_from || 'Unknown',
    farmer_id_code: row.farmers?.farmer_id || '',
    farmer_mobile: row.farmers?.mobile || null,
    payment_date: dt.toISOString(),
    reference_number: row.reference_number || '',
    notes: row.notes || '',
  }
}

/* ─── Component ─── */
export default function PaymentHistory() {
  const { role, loading: authLoading } = useAuth()

  /* Filters */
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modeFilter, setModeFilter] = useState('all')

  /* Data */
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)

  /* Slip */
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const slipRef = useRef<HTMLDivElement>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  /* ─── Fetch Payments ─── */
  const fetchPayments = useCallback(async (page: number) => {
    if (role !== 'admin') return
    setLoading(true)

    try {
      let farmerIds: string[] | null = null

      // Step 1: If search, find matching farmer IDs first
      if (searchQuery.trim()) {
        const s = searchQuery.trim().replace(/[,;]/g, ' ')
        const { data: matchedFarmers, error: fErr } = await supabase
          .from('farmers')
          .select('id')
          .or(
            `farmer_name.ilike.%${s}%,farmer_id.ilike.%${s}%,mobile.ilike.%${s}%,village.ilike.%${s}%`
          )

        if (fErr) throw fErr
        farmerIds = matchedFarmers?.map((f: { id: string }) => f.id) || []
        if (farmerIds.length === 0) {
          if (isMounted.current) {
            setPayments([])
            setTotalCount(0)
          }
          return
        }
      }

      // Step 2: Fetch payments with farmer join
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('payments')
        .select(
          `
          id,
          payment_number,
          farmer_id,
          payment_amount,
          payment_mode,
          payment_received_from,
          reference_number,
          payment_date,
          payment_time,
          previous_outstanding,
          new_outstanding,
          notes,
          created_at,
          farmers!farmer_id (
            farmer_name,
            farmer_id,
            mobile,
            village
          )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (farmerIds) query = query.in('farmer_id', farmerIds)
      if (dateFrom) query = query.gte('payment_date', dateFrom)
      if (dateTo) query = query.lte('payment_date', dateTo)
      if (modeFilter !== 'all') query = query.eq('payment_mode', modeFilter)

      const { data, error, count } = await query

      if (error) throw error

      if (isMounted.current) {
        setPayments((data as unknown as PaymentRow[]) || [])
        setTotalCount(count || 0)
      }
    } catch (err: unknown) {
      console.error('fetchPayments error:', err)
      if (isMounted.current) {
        toast.error('Payment history load करने में त्रुटि।')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [role, searchQuery, dateFrom, dateTo, modeFilter])

  useEffect(() => {
    if (authLoading || role !== 'admin') return
    void fetchPayments(currentPage)
  }, [fetchPayments, currentPage, authLoading, role])

  const handleSearch = () => {
    setCurrentPage(1)
    setSelectedReceipt(null)
    void fetchPayments(1)
  }

  const handleReset = () => {
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setModeFilter('all')
    setCurrentPage(1)
    setSelectedReceipt(null)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  /* ─── PDF Actions ─── */
  const generatePdfBlob = useCallback(async (): Promise<Blob | null> => {
    if (!selectedReceipt || !slipRef.current) {
      toast.error('Slip तैयार नहीं है।')
      return null
    }
    try {
      return await buildPdfBlob(slipRef.current)
    } catch (err) {
      console.error('PDF error:', err)
      toast.error('PDF generation failed.')
      return null
    }
  }, [selectedReceipt])

  const handleDownload = useCallback(async () => {
    if (!selectedReceipt || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const fn = `SATGURU-PAY-${sanitizeFilename(selectedReceipt.payment_number)}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fn
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
      toast.success('PDF Downloaded!')
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [selectedReceipt, pdfBusy, generatePdfBlob])

  const handlePrint = useCallback(async () => {
    if (!selectedReceipt || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) { toast.error('Popup blocked!') }
      else { setTimeout(() => { try { win.focus(); win.print() } catch { /* */ } }, 700) }
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [selectedReceipt, pdfBusy, generatePdfBlob])

  const handleWhatsApp = useCallback(async () => {
    if (!selectedReceipt || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const fn = `SATGURU-PAY-${sanitizeFilename(selectedReceipt.payment_number)}.pdf`
      const file = new File([blob], fn, { type: 'application/pdf' })
      const text =
        `SATGURU BEEJ BHANDAR — Payment Slip\n` +
        `Receipt: ${selectedReceipt.payment_number}\n` +
        `Farmer: ${selectedReceipt.farmer_name}\n` +
        `Amount: ₹${formatINR(selectedReceipt.payment_amount)}\n` +
        `Remaining: ₹${formatINR(selectedReceipt.new_outstanding)}`

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try { await nav.share({ title: 'Payment Slip', text, files: [file] }); toast.success('Shared!'); return }
        catch (e: unknown) { if ((e as { name?: string })?.name === 'AbortError') return }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fn
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      const phone = normalisePhone(selectedReceipt.farmer_mobile)
      window.open(phone ? `https://wa.me/${phone}` : 'https://wa.me/', '_blank', 'noopener,noreferrer')
      toast('PDF Downloaded — WhatsApp में attach करें।', { duration: 5000, icon: '📎' })
    } catch {
      toast.error('Share failed.')
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [selectedReceipt, pdfBusy, generatePdfBlob])

  /* ─── Access Check ─── */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Payment history देखने की अनुमति केवल एडमिन को है।</p>
      </div>
    )
  }

  const pageTotal = payments.reduce((s, p) => s + Number(p.payment_amount), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Receipt className="text-amber-400" size={28} />
          Payment History (भुगतान इतिहास)
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          किसान के नाम, दिनांक या मोड से कोई भी पेमेंट खोजें और रसीद दोबारा निकालें
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <Filter size={16} />
          Filters / खोजें
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="किसान का नाम, ID, मोबाइल या गाँव खोजें..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
          />
        </div>

        {/* Date + Mode Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              <CalendarDays size={11} className="inline mr-1" />From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              <CalendarDays size={11} className="inline mr-1" />To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Payment Mode
            </label>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-emerald-600 outline-none"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              खोजें
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      {!loading && payments.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-4">
            <span className="font-bold text-emerald-900 flex items-center gap-1">
              <FileText size={14} />
              कुल {totalCount} पेमेंट
            </span>
            <span className="font-bold text-emerald-800 flex items-center gap-1">
              <IndianRupee size={14} />
              इस पेज: ₹{formatINR(pageTotal)}
            </span>
          </div>
          <span className="text-gray-500 text-xs">
            Page {currentPage} / {totalPages}
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin text-emerald-700 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Payment history लोड हो रही है...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && payments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Receipt size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-500 mt-2 font-bold">कोई पेमेंट नहीं मिली।</p>
          <p className="text-xs text-gray-400 mt-1">Filters बदलकर दोबारा खोजें।</p>
        </div>
      )}

      {/* Results Table (Desktop) */}
      {!loading && payments.length > 0 && (
        <div className="hidden sm:block bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white text-left">
                <th className="px-3 py-2.5 font-bold">#</th>
                <th className="px-3 py-2.5 font-bold">Date</th>
                <th className="px-3 py-2.5 font-bold">Receipt</th>
                <th className="px-3 py-2.5 font-bold">Farmer</th>
                <th className="px-3 py-2.5 font-bold">Village</th>
                <th className="px-3 py-2.5 font-bold text-right">Amount</th>
                <th className="px-3 py-2.5 font-bold">Mode</th>
                <th className="px-3 py-2.5 font-bold text-center">Slip</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row, idx) => {
                const dt = getPaymentDateTime(row)
                const isSelected = selectedReceipt?.payment_id === row.id
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 hover:bg-emerald-50 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-100' : ''}`}
                    onClick={() => setSelectedReceipt(isSelected ? null : rowToReceipt(row))}
                  >
                    <td className="px-3 py-2.5 text-gray-500 font-mono">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-800">{formatDateDMY(dt)}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock size={9} /> {formatTime12(dt)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-emerald-800 text-[11px]">
                      {row.payment_number}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900">
                        {row.farmers?.farmer_name || row.payment_received_from || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        ID: {row.farmers?.farmer_id || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {row.farmers?.village || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-emerald-900">
                      ₹{formatINR(Number(row.payment_amount))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                        {PAYMENT_MODE_LABEL[row.payment_mode] || row.payment_mode}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedReceipt(isSelected ? null : rowToReceipt(row))
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-emerald-100'
                        }`}
                      >
                        {isSelected ? '✕ Close' : '📄 View'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Results Cards (Mobile) */}
      {!loading && payments.length > 0 && (
        <div className="sm:hidden space-y-2">
          {payments.map((row) => {
            const dt = getPaymentDateTime(row)
            const isSelected = selectedReceipt?.payment_id === row.id
            return (
              <div
                key={row.id}
                className={`bg-white rounded-xl border p-3 space-y-2 transition-all cursor-pointer ${
                  isSelected ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-gray-200'
                }`}
                onClick={() => setSelectedReceipt(isSelected ? null : rowToReceipt(row))}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">
                      {row.farmers?.farmer_name || row.payment_received_from || '—'}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {row.farmers?.farmer_id || '—'} · {row.farmers?.village || ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-900 text-base">
                      ₹{formatINR(Number(row.payment_amount))}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                      {PAYMENT_MODE_LABEL[row.payment_mode] || row.payment_mode}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span className="font-mono font-bold text-emerald-700">{row.payment_number}</span>
                  <span>{formatDateDMY(dt)} {formatTime12(dt)}</span>
                </div>
                {isSelected && (
                  <div className="text-[10px] text-emerald-700 font-bold text-center">
                    ▲ Slip नीचे दिख रही है ▲
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 bg-white border rounded-xl disabled:opacity-30 hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-gray-700">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 bg-white border rounded-xl disabled:opacity-30 hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Slip Preview + Actions */}
      {selectedReceipt && (
        <div className="bg-white border-2 border-emerald-600 rounded-2xl overflow-hidden shadow-lg animate-in fade-in duration-300">
          {/* Slip Header */}
          <div className="bg-emerald-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <FileText size={16} className="text-amber-400" />
              Slip Preview — {selectedReceipt.payment_number}
            </div>
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="p-1 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Slip Card */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-amber-50 relative overflow-hidden">
            {/* Watermark preview */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden z-0">
              <div style={{ transform: 'rotate(-32deg)' }} className="flex flex-col gap-3 items-center">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-2xl font-black tracking-widest" style={{ color: 'rgba(6, 78, 59, 0.07)' }}>
                    SATGURU PAYMENTS
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white text-center p-3 rounded-t-xl border-b-4 border-amber-500">
                <div className="text-base font-black tracking-wide">{SHOP_INFO.name}</div>
                <div className="text-[9px] text-emerald-100 mt-0.5">{SHOP_INFO.address}</div>
              </div>
              <div className="bg-white border-x-2 border-b-2 border-emerald-700 rounded-b-xl p-3 space-y-2">
                <div className="text-center">
                  <span className="inline-block bg-amber-500 text-emerald-900 border-2 border-emerald-900 px-3 py-0.5 text-[10px] font-black rounded-full tracking-widest">
                    UDHAAR PAYMENT SLIP
                  </span>
                </div>
                <div className="flex justify-between bg-emerald-50 rounded px-2 py-1 text-[11px]">
                  <div>
                    <div className="text-[8px] text-emerald-700 font-bold">RECEIPT</div>
                    <div className="font-black text-emerald-900">{selectedReceipt.payment_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] text-emerald-700 font-bold">DATE</div>
                    <div className="font-black text-emerald-900">{formatDateDMY(new Date(selectedReceipt.payment_date))}</div>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-300 rounded p-2">
                  <div className="text-[8px] text-emerald-700 font-black">◆ FROM</div>
                  <div className="font-black text-emerald-900 text-sm">{selectedReceipt.farmer_name}</div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="font-bold">ID: {selectedReceipt.farmer_id_code}</span>
                    <span className="font-bold">Mob: {selectedReceipt.farmer_mobile || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between bg-gray-100 border-l-3 border-gray-500 rounded px-2 py-1">
                    <span className="font-bold text-gray-700">Before</span>
                    <span className="font-black">₹{formatINR(selectedReceipt.previous_outstanding)}</span>
                  </div>
                  <div className="flex justify-between bg-emerald-100 border-2 border-emerald-600 rounded px-2 py-1 text-sm">
                    <span className="font-black text-emerald-900">✓ Paid</span>
                    <span className="font-black text-emerald-900">₹{formatINR(selectedReceipt.payment_amount)}</span>
                  </div>
                  <div className="flex justify-between bg-amber-100 border-2 border-orange-500 rounded px-2 py-1 text-sm">
                    <span className="font-black text-orange-900">After</span>
                    <span className="font-black text-orange-900">₹{formatINR(selectedReceipt.new_outstanding)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 grid grid-cols-3 gap-2 border-t border-emerald-200 bg-white">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={pdfBusy}
              className="py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              PDF
            </button>
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={pdfBusy}
              className="py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
              Print
            </button>
            <button
              type="button"
              onClick={() => void handleWhatsApp()}
              disabled={pdfBusy}
              className="py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
              WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Off-screen A6 slip for PDF */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', left: '-10000px', top: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true">
          <PaymentSlipTemplate receipt={selectedReceipt} slipRef={slipRef as React.RefObject<HTMLDivElement>} />
        </div>
      )}
    </div>
  )
}