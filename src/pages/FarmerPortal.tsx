// src/pages/FarmarPortal.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { round2, safeNum } from '../lib/round'
import {
  LogOut,
  MapPin,
  Phone,
  History,
  FileText,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Wallet,
  ArrowDownLeft,
  Camera,
  Eye,
  X,
  Loader2,
  Download,
  ExternalLink,
  Receipt
} from 'lucide-react'

interface CreditAccount {
  id?: string
  credit_limit?: number
  current_outstanding?: number
  available_credit?: number
  [key: string]: unknown
}

interface Farmer {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string
  village: string
  mobile: string
  aadhaar_number?: string
  credit_limit?: number
  repayment_days?: number
  outstanding_balance?: number
  photo_url?: string | null
  credit_accounts?: CreditAccount[] | CreditAccount | null
  [key: string]: unknown
}

interface SalesBill {
  id: string
  bill_number: string
  bill_date: string
  total_items: number
  total_amount: number
  bill_status: string
  farmer_id: string
  bill_type: string
  [key: string]: unknown
}

interface PhysicalBill {
  id: string
  bill_number: string
  bill_date: string
  bill_amount: number
  bill_type: string // estimate/gst
  transaction_type: string // udhaar/cash
  notes?: string | null
  file_path?: string | null
  file_name?: string | null
  file_type?: string | null
  status: string
  created_at: string
}

interface Payment {
  id: string
  payment_number: string
  payment_date: string
  payment_amount: number
  payment_mode: string
  farmer_id: string
  [key: string]: unknown
}

interface ReturnRecord {
  id: string
  return_number: string
  return_date: string
  total_amount: number
  reason?: string | null
  return_status: string
  farmer_id: string
  [key: string]: unknown
}

export interface InterestRecord {
  id: string
  interest_amount: number
  calculation_date: string
  is_applied: boolean
}

export interface CashbackRecord {
  id: string
  cashback_released: number
  released_date: string
}

interface BillItem {
  id: string
  product_name: string
  company_name?: string | null
  batch_number?: string | null
  quantity: number
  unit_name?: string | null
  rate: number
  total_amount: number
  gst_percent?: number
  taxable_amount?: number
}

interface FarmerSession {
  id: string
  [key: string]: unknown
}

const FARMER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getSession(): FarmerSession | null {
  try {
    const raw = sessionStorage.getItem('farmer_session')
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    const nested =
      rec.farmer && typeof rec.farmer === 'object'
        ? (rec.farmer as Record<string, unknown>)
        : null
    const idRaw = rec.id ?? nested?.id
    const id = typeof idRaw === 'string' ? idRaw.trim() : ''
    if (!id || !FARMER_UUID_RE.test(id)) return null
    return { ...rec, id } as FarmerSession
  } catch {
    return null
  }
}

function safeNumber(value: unknown): number {
  return safeNum(value)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function sanitize(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function pickCreditAccount(
  farmer: Farmer,
  creditFromRpc?: CreditAccount | null
): CreditAccount | null {
  if (creditFromRpc && typeof creditFromRpc === 'object') return creditFromRpc
  const ca = farmer.credit_accounts
  if (Array.isArray(ca) && ca.length > 0) return ca[0]
  if (ca && typeof ca === 'object') return ca as CreditAccount
  return null
}

export default function FarmerPortal() {
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [bills, setBills] = useState<SalesBill[]>([])
  const [physicalBills, setPhysicalBills] = useState<PhysicalBill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [dbOutstanding, setDbOutstanding] = useState(0)
  const [dbAvailable, setDbAvailable] = useState(0)

  // Attachment Viewer Modal (Physical Bills)
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)
  const [previewDocType, setPreviewDocType] = useState<string>('image')
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('')
  const [loadingDocPreview, setLoadingDocPreview] = useState<boolean>(false)

  // Digital Bill Items Modal
  const [billItemsModalOpen, setBillItemsModalOpen] = useState<boolean>(false)
  const [selectedBillHeader, setSelectedBillHeader] = useState<SalesBill | null>(null)
  const [selectedBillItems, setSelectedBillItems] = useState<BillItem[]>([])
  const [loadingBillItems, setLoadingBillItems] = useState<boolean>(false)

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('farmer_session')
    window.location.replace('/login')
  }, [])

  const loadFarmerPortal = useCallback(
    async (signal?: AbortSignal) => {
      setError(null)

      const sess = getSession()
      if (!sess?.id) {
        handleLogout()
        return
      }

      if (!FARMER_UUID_RE.test(sess.id)) {
        setError('सेशन अमान्य है। कृपया दोबारा लॉगिन करें।')
        setFarmer(null)
        sessionStorage.removeItem('farmer_session')
        return
      }

      try {
        // Maintenance Mode Check
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'maintenance_mode')
          .maybeSingle()

        if (settingsData?.setting_value === 'true') {
          handleLogout()
          return
        }

        if (signal?.aborted) return

        await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: sess.id })

        const { data: bundle, error: bundleErr } = await supabase.rpc(
          'get_farmer_portal_bundle',
          { p_farmer_id: sess.id }
        )

        if (signal?.aborted) return

        if (bundleErr || !bundle || (bundle as any).success === false) {
          throw new Error(
            bundleErr?.message || 'किसान पोर्टल डेटा लोड नहीं हो सका। कृपया पुनः लॉगिन करें।'
          )
        }

        const b = bundle as {
          farmer: Farmer
          credit_account?: CreditAccount | null
          bills?: SalesBill[]
          physical_bills?: PhysicalBill[]
          payments?: Payment[]
          returns?: ReturnRecord[]
        }

        const farmerObj = b.farmer
        if (!farmerObj?.id || farmerObj.id !== sess.id) {
          setError('किसान सेशन मेल नहीं खाता। दोबारा लॉगिन करें।')
          setFarmer(null)
          sessionStorage.removeItem('farmer_session')
          return
        }

        if (b.credit_account) {
          farmerObj.credit_accounts = [b.credit_account]
        }

        setFarmer(farmerObj)
        setBills(Array.isArray(b.bills) ? b.bills : [])
        setPhysicalBills(Array.isArray(b.physical_bills) ? b.physical_bills : [])
        setPayments(Array.isArray(b.payments) ? b.payments : [])
        setReturnsList(Array.isArray(b.returns) ? b.returns : [])

        const acc = pickCreditAccount(farmerObj, b.credit_account)
        const outstandingVal = round2(
          safeNumber(acc?.current_outstanding ?? farmerObj.outstanding_balance)
        )
        const limitVal = round2(safeNumber(acc?.credit_limit ?? farmerObj.credit_limit))
        const availableVal = round2(
          acc?.available_credit !== undefined && acc?.available_credit !== null
            ? safeNumber(acc.available_credit)
            : Math.max(0, limitVal - outstandingVal)
        )

        setDbOutstanding(outstandingVal)
        setDbAvailable(availableVal)
      } catch (err: unknown) {
        if (signal?.aborted) return
        const msg = err instanceof Error ? err.message : 'डेटा लोड करने में समस्या आई'
        setError(msg)
      }
    },
    [handleLogout]
  )

  useEffect(() => {
    const controller = new AbortController()
    let alive = true

    ;(async () => {
      await loadFarmerPortal(controller.signal)
      if (alive) setLoading(false)
    })()

    return () => {
      alive = false
      controller.abort()
    }
  }, [loadFarmerPortal])

  // Maintenance heartbeat
  useEffect(() => {
    const maintenanceInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'maintenance_mode')
          .maybeSingle()

        if (data?.setting_value === 'true') {
          clearInterval(maintenanceInterval)
          sessionStorage.removeItem('farmer_session')
          window.location.replace('/login')
        }
      } catch {
        // Non-blocking
      }
    }, 15000)

    return () => clearInterval(maintenanceInterval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadFarmerPortal()
    setRefreshing(false)
  }

  // View Physical Bill Attachment in Modal
  const handleViewPhysicalAttachment = async (pb: PhysicalBill) => {
    if (!pb.file_path) return

    try {
      setLoadingDocPreview(true)
      setPreviewDocTitle(`Physical Bill #${pb.bill_number}`)
      setPreviewDocType(pb.file_type?.includes('pdf') ? 'pdf' : 'image')
      setPreviewDocUrl(null)
      setPreviewModalOpen(true)

      const { data, error: urlErr } = await supabase.storage
        .from('physical-bills')
        .createSignedUrl(pb.file_path, 3600)

      if (urlErr || !data?.signedUrl) {
        throw new Error(urlErr?.message || 'Signed URL generation failed')
      }

      setPreviewDocUrl(data.signedUrl)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to view document'
      setError('दस्तावेज़ खोलने में असमर्थ: ' + msg)
      setPreviewModalOpen(false)
    } finally {
      setLoadingDocPreview(false)
    }
  }

  // View Digital POS Bill Items in Modal
  const handleViewDigitalBill = async (bill: SalesBill) => {
    if (!farmer?.id || !bill.id) return

    try {
      setLoadingBillItems(true)
      setSelectedBillHeader(bill)
      setSelectedBillItems([])
      setBillItemsModalOpen(true)

      const { data, error: rpcErr } = await supabase.rpc('get_farmer_bill_details', {
        p_bill_id: bill.id,
        p_farmer_id: farmer.id,
      })

      if (rpcErr) {
        throw new Error(rpcErr.message)
      }

      const res = data as {
        success: boolean
        message?: string
        bill?: SalesBill
        items?: BillItem[]
      }

      if (!res || res.success === false) {
        throw new Error(res?.message || 'बिल का विवरण लोड नहीं हो सका।')
      }

      setSelectedBillItems(Array.isArray(res.items) ? res.items : [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'बिल का विवरण लोड करने में समस्या आई'
      setError('बिल का विवरण खोलने में असमर्थ: ' + msg)
      setBillItemsModalOpen(false)
    } finally {
      setLoadingBillItems(false)
    }
  }

  const limit = farmer
    ? safeNumber(pickCreditAccount(farmer)?.credit_limit ?? farmer.credit_limit)
    : 0

  const maskedAadhaar =
    farmer?.aadhaar_number && farmer.aadhaar_number.length >= 12
      ? `XXXX-XXXX-${farmer.aadhaar_number.slice(-4)}`
      : 'Not Registered'

  // Segregate Digital & Physical Bills
  const udhaarDigitalBills = useMemo(
    () => bills.filter((b) => b.bill_type === 'udhaar'),
    [bills]
  )
  const cashDigitalBills = useMemo(
    () => bills.filter((b) => b.bill_type !== 'udhaar'),
    [bills]
  )

  const udhaarPhysicalBills = useMemo(
    () => physicalBills.filter((pb) => pb.transaction_type === 'udhaar'),
    [physicalBills]
  )
  const cashPhysicalBills = useMemo(
    () => physicalBills.filter((pb) => pb.transaction_type !== 'udhaar'),
    [physicalBills]
  )

  // Section-wise Totals
  const totalUdhaarDigital = useMemo(
    () => udhaarDigitalBills.reduce((s, b) => s + safeNumber(b.total_amount), 0),
    [udhaarDigitalBills]
  )
  const totalUdhaarPhysical = useMemo(
    () => udhaarPhysicalBills.reduce((s, pb) => s + safeNumber(pb.bill_amount), 0),
    [udhaarPhysicalBills]
  )
  const totalUdhaarCombined = totalUdhaarDigital + totalUdhaarPhysical

  const totalCashDigital = useMemo(
    () => cashDigitalBills.reduce((s, b) => s + safeNumber(b.total_amount), 0),
    [cashDigitalBills]
  )
  const totalCashPhysical = useMemo(
    () => cashPhysicalBills.reduce((s, pb) => s + safeNumber(pb.bill_amount), 0),
    [cashPhysicalBills]
  )
  const totalCashCombined = totalCashDigital + totalCashPhysical

  const totalPayments = useMemo(
    () => payments.reduce((s, p) => s + safeNumber(p.payment_amount), 0),
    [payments]
  )
  const totalReturns = useMemo(
    () => returnsList.reduce((s, r) => s + safeNumber(r.total_amount), 0),
    [returnsList]
  )

  if (loading) {
    return (
      <div
        className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center text-white font-bold gap-3"
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="animate-spin text-amber-400" size={28} />
        <p className="text-sm">Loading Kisan Portal...</p>
      </div>
    )
  }

  if (!farmer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-2xl shadow text-center max-w-sm w-full">
          {error && (
            <p className="text-rose-600 font-medium text-sm mb-3 flex items-center justify-center gap-1">
              <AlertTriangle size={16} /> {error}
            </p>
          )}
          <p className="text-gray-700 font-bold mb-4">सेशन समाप्त हो गया है।</p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            फिर से लॉगिन करें
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4 md:p-6 space-y-6 max-w-4xl mx-auto font-sans">
      {error && (
        <div
          className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2"
          role="alert"
        >
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 sm:p-6 rounded-3xl shadow-xl flex justify-between items-center gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
            KISAN PORTAL
          </span>
          <h1 className="text-lg sm:text-2xl font-black mt-1">सतगुरु बीज भंडार</h1>
          <p className="text-emerald-200 text-xs">दल्लुसर, सरदारशहर (चूरू)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow transition-colors cursor-pointer"
            aria-label="Refresh data"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow transition-colors cursor-pointer"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Kisan Card */}
      <section
        className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border-2 border-amber-500/40 space-y-5"
        aria-label="Kisan Card"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-emerald-800 pb-4 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-800 border-2 border-emerald-600 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
              {farmer.photo_url ? (
                <img src={farmer.photo_url} alt="Farmer" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-emerald-300">
                  {farmer.farmer_name?.charAt(0)?.toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <p className="text-amber-400 font-mono font-black text-base sm:text-lg tracking-wider">
                {sanitize(farmer.farmer_id)}
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {sanitize(farmer.farmer_name)}
              </h2>
              <p className="text-emerald-200 text-xs mt-0.5">
                S/O {sanitize(farmer.father_name)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs bg-emerald-900/50 p-3 rounded-xl sm:bg-transparent sm:p-0 sm:rounded-none w-full sm:w-auto">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <MapPin size={14} /> {sanitize(farmer.village)}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300 mt-2 sm:mt-1">
              <Phone size={14} /> {sanitize(farmer.mobile)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-emerald-900/60 p-3 rounded-2xl border border-emerald-800">
            <p className="text-emerald-300 text-[10px]">क्रेडिट सीमा (Credit Limit)</p>
            <p className="text-amber-400 font-black text-base mt-0.5 font-mono">
              {formatCurrency(limit)}
            </p>
          </div>

          <div className="bg-emerald-900/60 p-3 rounded-2xl border border-emerald-800">
            <p className="text-emerald-300 text-[10px]">वर्तमान उधारी (Outstanding)</p>
            <p className="text-rose-400 font-black text-base mt-0.5 font-mono">
              {formatCurrency(dbOutstanding)}
            </p>
          </div>

          <div className="bg-emerald-900/60 p-3 rounded-2xl border border-emerald-800 col-span-2 sm:col-span-1">
            <p className="text-emerald-300 text-[10px]">उपलब्ध क्रेडिट (Available)</p>
            <p className="text-emerald-400 font-black text-base mt-0.5 font-mono">
              {formatCurrency(dbAvailable)}
            </p>
          </div>
        </div>

        <div className="text-[10px] text-emerald-400 pt-1 flex justify-between border-t border-emerald-800/80">
          <span>Aadhaar: {maskedAadhaar}</span>
          <span>Repayment Period: {safeNumber(farmer.repayment_days) || 90} Days</span>
        </div>
      </section>

      {/* Transaction History - Ledger Style */}
      <section
        className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm space-y-6"
        aria-label="Transaction History"
      >
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3">
          <h3 className="font-black text-emerald-950 text-base flex items-center gap-2">
            <History className="text-amber-500" size={20} /> लेनदेन इतिहास (Transaction History)
          </h3>
          <p className="text-[10px] text-gray-500 font-bold">
            (यह केवल बिल और भुगतानों की सूची है। ब्याज, ओपनिंग बैलेंस या कैशबैक सीधे मुख्य बकाया में जुड़ता है)
          </p>
        </div>

        <div className="space-y-6">
          {/* ══════════ 1. UDHAAR (उधारी) BILLS SECTION ══════════ */}
          <div>
            <div className="flex items-center justify-between border-l-4 border-rose-500 bg-rose-50/70 pl-3 pr-3 py-2 rounded-lg mb-3">
              <h4 className="font-black text-xs text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-rose-700" /> उधारी बिल (Udhaar Bills)
              </h4>
              <div className="text-right">
                <p className="text-[9px] font-bold text-rose-700 uppercase tracking-wider">कुल राशि</p>
                <p className="font-mono font-black text-rose-800 text-xs">
                  {formatCurrency(totalUdhaarCombined)} ({udhaarDigitalBills.length + udhaarPhysicalBills.length})
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {udhaarDigitalBills.length === 0 && udhaarPhysicalBills.length === 0 ? (
                <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                  कोई उधारी बिल रिकॉर्ड नहीं मिला।
                </p>
              ) : (
                <>
                  {/* Digital Udhaar Bills */}
                  {udhaarDigitalBills.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl border bg-rose-50/40 border-rose-100 hover:bg-rose-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          <span>Bill No:</span>
                          <span className="font-mono break-all">{sanitize(b.bill_number)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                            उधारी
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1 font-medium">
                          {formatDate(b.bill_date)} • Items: {safeNumber(b.total_items)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-black font-mono text-sm text-rose-700 shrink-0">
                          {formatCurrency(safeNumber(b.total_amount))}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleViewDigitalBill(b)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>सामान देखें</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Physical Udhaar Paper Bills */}
                  {udhaarPhysicalBills.map((pb) => (
                    <div
                      key={pb.id}
                      className="p-3.5 rounded-xl border bg-amber-50/60 border-amber-200 hover:bg-amber-100/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          <Camera size={14} className="text-amber-700 shrink-0" />
                          <span>पर्ची बिल:</span>
                          <span className="font-mono break-all">#{sanitize(pb.bill_number)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                            उधारी
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-amber-200 text-amber-900">
                            PHYSICAL
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1 font-medium">
                          {formatDate(pb.bill_date)} {pb.notes ? `• ${sanitize(pb.notes)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-black font-mono text-sm text-rose-700 shrink-0">
                          {formatCurrency(safeNumber(pb.bill_amount))}
                        </span>
                        {pb.file_path ? (
                          <button
                            type="button"
                            onClick={() => handleViewPhysicalAttachment(pb)}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>📷 पर्ची</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic px-2">No Image</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ══════════ 2. PAYMENTS (भुगतान) SECTION ══════════ */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between border-l-4 border-emerald-500 bg-emerald-50/70 pl-3 pr-3 py-2 rounded-lg mb-3">
              <h4 className="font-black text-xs text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownLeft size={14} className="text-emerald-700" /> जमा पेमेंट (Payments)
              </h4>
              <div className="text-right">
                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">कुल राशि</p>
                <p className="font-mono font-black text-emerald-800 text-xs">
                  {formatCurrency(totalPayments)} ({payments.length})
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {payments.length === 0 ? (
                <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                  कोई पेमेंट रिकॉर्ड नहीं मिला।
                </p>
              ) : (
                payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100 flex justify-between items-center hover:bg-emerald-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-emerald-950 flex items-center gap-2 flex-wrap">
                        <span>Receipt:</span>
                        <span className="font-mono break-all">{sanitize(p.payment_number)}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          भुगतान
                        </span>
                      </p>
                      <p className="text-[10px] text-emerald-700/80 mt-1 font-bold uppercase tracking-wide">
                        {formatDate(p.payment_date)} • Mode: {sanitize(p.payment_mode)}
                      </p>
                    </div>
                    <span className="font-black text-emerald-700 font-mono text-sm shrink-0 ml-2">
                      + {formatCurrency(safeNumber(p.payment_amount))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ══════════ 3. NAGAD (नकद) BILLS SECTION ══════════ */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between border-l-4 border-teal-500 bg-teal-50/70 pl-3 pr-3 py-2 rounded-lg mb-3">
              <h4 className="font-black text-xs text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={14} className="text-teal-700" /> नकद बिल (Nagad / Cash Bills)
              </h4>
              <div className="text-right">
                <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wider">कुल राशि</p>
                <p className="font-mono font-black text-teal-800 text-xs">
                  {formatCurrency(totalCashCombined)} ({cashDigitalBills.length + cashPhysicalBills.length})
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {cashDigitalBills.length === 0 && cashPhysicalBills.length === 0 ? (
                <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                  कोई नकद बिल रिकॉर्ड नहीं मिला।
                </p>
              ) : (
                <>
                  {/* Digital Cash Bills */}
                  {cashDigitalBills.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl border bg-teal-50/40 border-teal-100 hover:bg-teal-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          <span>Bill No:</span>
                          <span className="font-mono break-all">{sanitize(b.bill_number)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                            नकद
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1 font-medium">
                          {formatDate(b.bill_date)} • Items: {safeNumber(b.total_items)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-black font-mono text-sm text-teal-700 shrink-0">
                          {formatCurrency(safeNumber(b.total_amount))}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleViewDigitalBill(b)}
                          className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>सामान देखें</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Physical Cash Paper Bills */}
                  {cashPhysicalBills.map((pb) => (
                    <div
                      key={pb.id}
                      className="p-3.5 rounded-xl border bg-teal-50/60 border-teal-200 hover:bg-teal-100/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          <Camera size={14} className="text-teal-700 shrink-0" />
                          <span>पर्ची बिल:</span>
                          <span className="font-mono break-all">#{sanitize(pb.bill_number)}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                            नकद
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-amber-200 text-amber-900">
                            PHYSICAL
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1 font-medium">
                          {formatDate(pb.bill_date)} {pb.notes ? `• ${sanitize(pb.notes)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-black font-mono text-sm text-teal-700 shrink-0">
                          {formatCurrency(safeNumber(pb.bill_amount))}
                        </span>
                        {pb.file_path ? (
                          <button
                            type="button"
                            onClick={() => handleViewPhysicalAttachment(pb)}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>📷 पर्ची</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic px-2">No Image</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {totalCashCombined > 0 && (
              <p className="text-[10px] text-teal-700 font-bold italic mt-2 pl-1">
                * नकद बिल आपके उधारी खाते से अलग हैं और तुरंत भुगतान हो चुके हैं।
              </p>
            )}
          </div>

          {/* ══════════ 4. RETURNS (सामान वापसी) SECTION ══════════ */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between border-l-4 border-purple-500 bg-purple-50/70 pl-3 pr-3 py-2 rounded-lg mb-3">
              <h4 className="font-black text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw size={14} className="text-purple-700" /> वापसी सामान (Product Returns)
              </h4>
              <div className="text-right">
                <p className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">कुल राशि</p>
                <p className="font-mono font-black text-purple-800 text-xs">
                  {formatCurrency(totalReturns)} ({returnsList.length})
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {returnsList.length === 0 ? (
                <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">
                  कोई सामान वापसी रिकॉर्ड नहीं मिला।
                </p>
              ) : (
                returnsList.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 flex justify-between items-center hover:bg-purple-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-purple-950 flex items-center gap-2 flex-wrap">
                        <span>Return No:</span>
                        <span className="font-mono break-all">{sanitize(r.return_number)}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                          वापसी
                        </span>
                      </p>
                      <p className="text-[10px] text-purple-700/80 mt-1 font-medium">
                        {formatDate(r.return_date)}{' '}
                        {r.reason ? `• कारण: ${sanitize(r.reason)}` : ''}
                      </p>
                    </div>
                    <span className="font-black text-purple-800 font-mono text-sm shrink-0 ml-2">
                      - {formatCurrency(safeNumber(r.total_amount))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ DIGITAL BILL ITEMS MODAL (इन-पोर्टल बिल विवरण) ══════════ */}
      {billItemsModalOpen && selectedBillHeader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-900 text-white">
              <div>
                <span className="text-[9px] font-extrabold uppercase bg-amber-400 text-emerald-950 px-2 py-0.5 rounded">
                  {selectedBillHeader.bill_type === 'udhaar' ? 'उधारी बिल' : 'नकद बिल'}
                </span>
                <h4 className="font-black text-base mt-1 flex items-center gap-2 font-mono">
                  Bill #{sanitize(selectedBillHeader.bill_number)}
                </h4>
                <p className="text-emerald-200 text-[11px]">
                  दिनांक: {formatDate(selectedBillHeader.bill_date)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBillItemsModalOpen(false)}
                className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-xl cursor-pointer transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content / Items List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50">
              {loadingBillItems ? (
                <div className="py-12 text-center text-emerald-800">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs font-bold">सामान का विवरण लोड हो रहा है...</p>
                </div>
              ) : selectedBillItems.length === 0 ? (
                <p className="text-center text-gray-500 text-xs py-8">
                  इस बिल में कोई सामान सूची नहीं मिली।
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-emerald-900/10 text-emerald-950 border-b border-emerald-200 text-[11px] uppercase tracking-wider">
                          <th className="p-3 font-black">क्र.सं.</th>
                          <th className="p-3 font-black">उत्पाद (Product)</th>
                          <th className="p-3 font-black">बैच</th>
                          <th className="p-3 font-black text-right">मात्रा</th>
                          <th className="p-3 font-black text-right">दर (Rate)</th>
                          <th className="p-3 font-black text-right">कुल</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {selectedBillItems.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-emerald-50/50 transition">
                            <td className="p-3 text-gray-500 text-[10px]">{idx + 1}</td>
                            <td className="p-3 font-bold text-gray-900">
                              {sanitize(item.product_name)}
                              {item.company_name && (
                                <span className="block text-[10px] text-gray-400 font-normal">
                                  {sanitize(item.company_name)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-gray-600 font-mono text-[11px]">
                              {item.batch_number ? sanitize(item.batch_number) : '—'}
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              {safeNumber(item.quantity)}{' '}
                              <span className="text-[10px] text-gray-500 font-normal">
                                {sanitize(item.unit_name)}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-gray-700">
                              {formatCurrency(safeNumber(item.rate))}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-emerald-800">
                              {formatCurrency(safeNumber(item.total_amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-emerald-950 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg">
                    <div>
                      <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                        कुल आइटम (Total Items)
                      </p>
                      <p className="text-sm font-black font-mono mt-0.5">
                        {selectedBillItems.length} Products
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        कुल बिल राशि (Grand Total)
                      </p>
                      <p className="text-lg font-black font-mono text-amber-400 mt-0.5">
                        {formatCurrency(safeNumber(selectedBillHeader.total_amount))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setBillItemsModalOpen(false)}
                className="px-5 py-2 bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
              >
                बंद करें (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Physical Bill Image Attachment Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Receipt className="text-emerald-700" size={18} />
                <span>{previewDocTitle || 'Physical Bill Document Viewer'}</span>
              </h4>
              <div className="flex items-center space-x-2">
                {previewDocUrl && (
                  <a
                    href={previewDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-600 hover:text-emerald-700 hover:bg-gray-200 rounded-xl cursor-pointer"
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-gray-900/5 min-h-[300px]">
              {loadingDocPreview ? (
                <div className="text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  <span className="text-xs font-bold">दस्तावेज़ लोड हो रहा है...</span>
                </div>
              ) : previewDocUrl ? (
                previewDocType === 'pdf' ? (
                  <div className="text-center space-y-4">
                    <FileText className="w-16 h-16 text-rose-500 mx-auto" />
                    <p className="text-sm font-bold text-gray-800">PDF Document Ready</p>
                    <a
                      href={previewDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow hover:bg-emerald-700 transition cursor-pointer"
                    >
                      <Download size={14} />
                      <span>PDF डाउनलोड / देखें (Open PDF)</span>
                    </a>
                  </div>
                ) : (
                  <img
                    src={previewDocUrl}
                    alt="Physical Bill Original"
                    className="max-h-[72vh] object-contain rounded-xl shadow-md"
                  />
                )
              ) : (
                <p className="text-gray-400 text-xs font-bold">दस्तावेज़ उपलब्ध नहीं है।</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}