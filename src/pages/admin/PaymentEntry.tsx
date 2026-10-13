// src/pages/admin/PaymentEntry.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Share2,
  Wallet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  ShieldAlert,
  Download,
  Printer,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface CreditAccountInfo {
  id?: string
  current_outstanding: number
  available_credit?: number
  credit_limit?: number
}

export interface FarmerOption {
  id: string
  farmer_name: string
  farmer_id: string
  village: string | null
  mobile: string | null
  credit_limit: number
  outstanding_balance?: number
  credit_accounts?: CreditAccountInfo[] | CreditAccountInfo | null
}

export interface PaymentReceipt {
  payment_id: string
  payment_number: string
  payment_amount: number
  payment_mode: string
  previous_outstanding: number
  new_outstanding: number
  farmer_name: string
  farmer_id_code: string
  farmer_mobile: string | null
  payment_date: string
  reference_number: string
  notes: string
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash (नकद)' },
  { value: 'upi', label: 'UPI / PhonePe / GPay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const

const PAYMENT_MODE_LABEL: Record<string, string> = {
  cash: 'Cash (नकद)',
  upi: 'UPI / PhonePe / GPay',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
}

const SUPABASE_MAX_ROWS = 1000

const SHOP_INFO = {
  name: 'SATGURU BEEJ BHANDAR',
  address: 'Daloosar, Sardarshahar (Churu), Rajasthan',
  tagline: 'मिट्टी से कटाई तक',
}

function formatINR(value: number): string {
  return (Number(value) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function roundCurrency(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 60)
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length >= 10 ? digits : null
}

function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatTime12(d: Date): string {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

function referenceDisplay(mode: string, ref: string): string {
  const trimmed = (ref || '').trim()
  if (mode === 'cash') return trimmed || 'Cash Payment'
  return trimmed || 'N/A'
}

function extractOutstanding(farmer: FarmerOption | null | undefined): number {
  if (!farmer) return 0

  let caOutstanding: number | undefined

  if (Array.isArray(farmer.credit_accounts) && farmer.credit_accounts.length > 0) {
    caOutstanding = Number(farmer.credit_accounts[0]?.current_outstanding)
  } else if (farmer.credit_accounts && typeof farmer.credit_accounts === 'object' && 'current_outstanding' in farmer.credit_accounts) {
    caOutstanding = Number((farmer.credit_accounts as CreditAccountInfo).current_outstanding)
  }

  if (caOutstanding !== undefined && !isNaN(caOutstanding)) {
    return roundCurrency(caOutstanding)
  }

  const directBalance = Number(farmer.outstanding_balance)
  if (!isNaN(directBalance)) {
    return roundCurrency(directBalance)
  }

  return 0
}

function extractAvailableCredit(farmer: FarmerOption | null | undefined): number {
  if (!farmer) return 0

  let caAvailable: number | undefined

  if (Array.isArray(farmer.credit_accounts) && farmer.credit_accounts.length > 0) {
    caAvailable = Number(farmer.credit_accounts[0]?.available_credit)
  } else if (farmer.credit_accounts && typeof farmer.credit_accounts === 'object' && 'available_credit' in farmer.credit_accounts) {
    caAvailable = Number((farmer.credit_accounts as CreditAccountInfo).available_credit)
  }

  if (caAvailable !== undefined && !isNaN(caAvailable)) {
    return roundCurrency(caAvailable)
  }

  const limit = Number(farmer.credit_limit) || 0
  const outstanding = extractOutstanding(farmer)
  return Math.max(0, roundCurrency(limit - outstanding))
}

const FARMER_SELECT = `
  id,
  farmer_name,
  farmer_id,
  village,
  mobile,
  credit_limit,
  outstanding_balance,
  credit_accounts (
    id,
    current_outstanding,
    available_credit,
    credit_limit
  )
`

async function fetchAllActiveFarmers(): Promise<FarmerOption[]> {
  const all: FarmerOption[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('farmers')
      .select(FARMER_SELECT)
      .eq('account_status', 'active')
      .order('farmer_name', { ascending: true })
      .range(from, from + SUPABASE_MAX_ROWS - 1)

    if (error) throw error

    if (data && data.length > 0) {
      all.push(...(data as FarmerOption[]))
    }

    if (!data || data.length < SUPABASE_MAX_ROWS) break
    from += SUPABASE_MAX_ROWS
  }

  return all
}

const A6_WIDTH_MM = 105
const A6_HEIGHT_MM = 148

function PaymentSlipTemplate({
  receipt,
  slipRef,
}: {
  receipt: PaymentReceipt
  slipRef: React.RefObject<HTMLDivElement | null>
}) {
  const paymentDate = new Date(receipt.payment_date)
  const dateStr = formatDateDMY(paymentDate)
  const timeStr = formatTime12(paymentDate)
  const modeLabel = PAYMENT_MODE_LABEL[receipt.payment_mode] || receipt.payment_mode
  const refText = referenceDisplay(receipt.payment_mode, receipt.reference_number)

  const widthPx = Math.round(A6_WIDTH_MM * 3.78)
  const heightPx = Math.round(A6_HEIGHT_MM * 3.78)

  return (
    <div
      ref={slipRef}
      style={{
        width: `${widthPx}px`,
        minHeight: `${heightPx}px`,
        background: '#ffffff',
        color: '#111827',
        fontFamily:
          '"Helvetica Neue", Helvetica, Arial, "Noto Sans Devanagari", sans-serif',
        padding: '10px 12px',
        boxSizing: 'border-box',
        position: 'relative',
        fontSize: '9px',
        lineHeight: 1.35,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          style={{
            transform: 'rotate(-35deg)',
            fontSize: '22px',
            fontWeight: 900,
            color: 'rgba(4,120,87,0.07)',
            whiteSpace: 'nowrap',
            letterSpacing: '2px',
          }}
        >
          SATGURU FARMER PAYMENT
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', borderBottom: '1.5px solid #065f46', paddingBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#064e3b', letterSpacing: '0.5px' }}>
            {SHOP_INFO.name}
          </div>
          <div style={{ fontSize: '7.5px', color: '#374151', marginTop: '2px' }}>
            {SHOP_INFO.address}
          </div>
          <div
            style={{
              marginTop: '5px',
              background: '#064e3b',
              color: '#fef3c7',
              display: 'inline-block',
              padding: '2px 10px',
              fontSize: '9px',
              fontWeight: 800,
              borderRadius: '3px',
              letterSpacing: '1px',
            }}
          >
            UDHAAR PAYMENT SLIP
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px',
            fontSize: '8px',
          }}
        >
          <div>
            <div style={{ color: '#6b7280' }}>Receipt No.</div>
            <div style={{ fontWeight: 800, color: '#111827' }}>{receipt.payment_number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#6b7280' }}>Date / Time</div>
            <div style={{ fontWeight: 700 }}>{dateStr}</div>
            <div style={{ fontWeight: 700 }}>{timeStr}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: '6px',
            padding: '5px 6px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '7px', color: '#065f46', fontWeight: 700 }}>
            Payment Received From / भुगतान कर्ता
          </div>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#064e3b', marginTop: '1px' }}>
            {receipt.farmer_name}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '7.5px' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Farmer ID: </span>
              <span style={{ fontWeight: 700 }}>{receipt.farmer_id_code}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Mob: </span>
              <span style={{ fontWeight: 700 }}>{receipt.farmer_mobile || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '6px' }}>
          <div
            style={{
              fontSize: '8px',
              fontWeight: 800,
              color: '#065f46',
              borderBottom: '1px dashed #a7f3d0',
              paddingBottom: '2px',
              marginBottom: '3px',
            }}
          >
            PAYMENT DETAILS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span style={{ color: '#374151' }}>Payment Mode</span>
            <span style={{ fontWeight: 800 }}>{modeLabel}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '8px',
              marginTop: '2px',
            }}
          >
            <span style={{ color: '#374151' }}>UTR / Ref.</span>
            <span style={{ fontWeight: 700, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
              {refText}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '6px' }}>
          <div
            style={{
              fontSize: '8px',
              fontWeight: 800,
              color: '#065f46',
              borderBottom: '1px dashed #a7f3d0',
              paddingBottom: '2px',
              marginBottom: '4px',
            }}
          >
            ACCOUNT SUMMARY
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '3px 5px',
              background: '#f9fafb',
              borderRadius: '3px',
              marginBottom: '2px',
            }}
          >
            <span style={{ fontSize: '8px', color: '#374151' }}>Outstanding Before</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#374151' }}>
              ₹{formatINR(receipt.previous_outstanding)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 5px',
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: '3px',
              marginBottom: '2px',
            }}
          >
            <span style={{ fontSize: '8px', color: '#065f46', fontWeight: 700 }}>Payment Received</span>
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#064e3b' }}>
              ₹{formatINR(receipt.payment_amount)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 5px',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: '3px',
            }}
          >
            <span style={{ fontSize: '8px', color: '#9a3412', fontWeight: 700 }}>Outstanding After</span>
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#9a3412' }}>
              ₹{formatINR(receipt.new_outstanding)}
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: '8px',
            paddingTop: '5px',
            borderTop: '1px dashed #9ca3af',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '7.5px', color: '#065f46', fontWeight: 700 }}>
            Payment received successfully.
          </div>
          <div style={{ fontSize: '7px', color: '#374151', marginTop: '1px' }}>
            Thank you for choosing {SHOP_INFO.name}.
          </div>
          <div
            style={{
              marginTop: '4px',
              fontSize: '8px',
              fontWeight: 800,
              color: '#064e3b',
              letterSpacing: '0.5px',
            }}
          >
            {SHOP_INFO.tagline}
          </div>
          <div style={{ fontSize: '7px', color: '#6b7280', marginTop: '1px' }}>
            {SHOP_INFO.name}
          </div>
        </div>
      </div>
    </div>
  )
}

async function buildPdfBlob(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
    compress: true,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const margin = 0
  const availW = pageWidth - margin * 2
  const availH = pageHeight - margin * 2

  const ratio = canvas.width / canvas.height
  let renderW = availW
  let renderH = renderW / ratio

  if (renderH > availH) {
    renderH = availH
    renderW = renderH * ratio
  }

  const offsetX = (pageWidth - renderW) / 2
  const offsetY = (pageHeight - renderH) / 2

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST')

  return pdf.output('blob')
}

export default function PaymentEntry() {
  const { role, loading: authLoading } = useAuth()

  const [farmers, setFarmers] = useState<FarmerOption[]>([])
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerOption | null>(null)
  const [loadingFarmers, setLoadingFarmers] = useState<boolean>(true)
  const [syncingFarmer, setSyncingFarmer] = useState<boolean>(false)

  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<string>('cash')
  const [refNo, setRefNo] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [lastPayment, setLastPayment] = useState<PaymentReceipt | null>(null)
  const [pdfBusy, setPdfBusy] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)
  const farmerSelectSeq = useRef<number>(0)
  const saveLockRef = useRef<boolean>(false)
  const slipRef = useRef<HTMLDivElement>(null)

  const loadFarmers = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoadingFarmers(true)

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const data = await fetchAllActiveFarmers()

      if (isMounted.current) {
        setFarmers(data)
      }
    } catch (err: unknown) {
      console.error('loadFarmers failed:', err)
      if (isMounted.current) {
        toast.error('Failed to load farmers. Please try again.')
      }
    } finally {
      if (isMounted.current) setLoadingFarmers(false)
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') return
    void loadFarmers()
  }, [loadFarmers, role, authLoading])

  const handleFarmerSelect = useCallback(async (farmerId: string) => {
    if (!farmerId) {
      setSelectedFarmer(null)
      return
    }

    const seq = ++farmerSelectSeq.current

    try {
      setSyncingFarmer(true)

      try {
        await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: farmerId })
      } catch (syncErr) {
        console.warn('sync_farmer_credit_account:', syncErr)
      }

      if (farmerSelectSeq.current !== seq || !isMounted.current) return

      const { data, error } = await supabase
        .from('farmers')
        .select(FARMER_SELECT)
        .eq('id', farmerId)
        .single()

      if (error) throw error

      if (isMounted.current && farmerSelectSeq.current === seq) {
        setSelectedFarmer(data as FarmerOption)
      }
    } catch (err: unknown) {
      console.error('handleFarmerSelect failed:', err)
      if (isMounted.current && farmerSelectSeq.current === seq) {
        toast.error('Error fetching farmer balance. Please try again.')
      }
    } finally {
      if (isMounted.current && farmerSelectSeq.current === seq) {
        setSyncingFarmer(false)
      }
    }
  }, [])

  const handleManualSync = useCallback(async () => {
    if (!selectedFarmer) return
    try {
      setSyncingFarmer(true)
      toast.loading('खाता बैलेंस चेक हो रहा है...', { id: 'sync' })

      await supabase.rpc('sync_farmer_credit_account', {
        p_farmer_id: selectedFarmer.id,
      })

      const { data, error } = await supabase
        .from('farmers')
        .select(FARMER_SELECT)
        .eq('id', selectedFarmer.id)
        .single()

      if (error) throw error

      if (isMounted.current) {
        setSelectedFarmer(data as FarmerOption)
        toast.success('खाता अपडेट हो गया!', { id: 'sync' })
      }
    } catch (err: unknown) {
      console.error('handleManualSync failed:', err)
      toast.error('Sync failed. Please try again.', { id: 'sync' })
    } finally {
      if (isMounted.current) setSyncingFarmer(false)
    }
  }, [selectedFarmer])

  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault()

    if (role !== 'admin') {
      toast.error('पेमेंट एंट्री करने की अनुमति केवल एडमिन को है।')
      return
    }

    if (!selectedFarmer) {
      toast.error('किसान का चयन करें!')
      return
    }

    const amt = roundCurrency(parseFloat(paymentAmount))
    if (isNaN(amt) || amt <= 0) {
      toast.error('वैध पेमेंट राशि दर्ज करें!')
      return
    }

    if (amt > 10_000_000) {
      toast.error('Amount too large. Please verify.')
      return
    }

    const outstanding = extractOutstanding(selectedFarmer)

    if (amt > outstanding && outstanding > 0) {
      const confirmed = window.confirm(
        `पेमेंट राशि (₹${formatINR(amt)}) कुल उधारी (₹${formatINR(outstanding)}) से अधिक है।\n\nक्या आप यह एडवांस पेमेंट जमा करना चाहते हैं?`
      )
      if (!confirmed) return
    }

    if (amt >= 100000) {
      const confirmed = window.confirm(
        `बड़ी राशि: ₹${formatINR(amt)}\n\nक्या आप इसे जमा करना चाहते हैं?`
      )
      if (!confirmed) return
    }

  if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        toast.error('Session expired. Please sign in again.')
        return
      }

      // 🟢 FIX: Same farmer + same amount + same mode within last 2 minutes = possible double click
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { data: recentDup } = await supabase
        .from('payments')
        .select('id, payment_number, created_at')
        .eq('farmer_id', selectedFarmer.id)
        .eq('payment_amount', amt)
        .eq('payment_mode', paymentMode)
        .gte('created_at', twoMinutesAgo)
        .limit(1)
        .maybeSingle()

      if (recentDup) {
        toast.error('इसी राशि का पेमेंट अभी-अभी दर्ज हो चुका है। Duplicate entry रोकी गई।')
        return
      }

      if (userError || !user) {
        toast.error('Session expired. Please sign in again.')
        return
      }

      const cleanRef = sanitizeText(refNo)
      const cleanNotes = sanitizeText(notes)

     const { data, error } = await supabase.rpc('process_farmer_payment', {
        p_farmer_id: selectedFarmer.id,
        p_payment_amount: amt,
        p_payment_mode: paymentMode,
        p_reference_number: cleanRef,
        p_notes: cleanNotes,
        p_created_by: user.id,
      })

      if (error) {
        console.error('Payment Error:', error)
        throw error
      }

      const result = Array.isArray(data) ? data[0] : data
      if (!result || !result.payment_number) {
        throw new Error('Payment was processed but receipt could not be generated.')
      }

      toast.success('पेमेंट रसीद सफलतापूर्वक जमा हो गई!')

      const paymentDateISO =
        result.payment_date ||
        result.created_at ||
        result.payment_timestamp ||
        new Date().toISOString()

      const receipt: PaymentReceipt = {
        payment_id: result.payment_id,
        payment_number: result.payment_number,
        payment_amount: Number(result.payment_amount),
        payment_mode: result.payment_mode || paymentMode,
        previous_outstanding: Number(result.previous_outstanding ?? outstanding),
        new_outstanding: Number(result.new_outstanding ?? 0),
        farmer_name: result.farmer_name || selectedFarmer.farmer_name,
        farmer_id_code: result.farmer_id_code || selectedFarmer.farmer_id,
        farmer_mobile: result.farmer_mobile || selectedFarmer.mobile || null,
        payment_date: paymentDateISO,
        reference_number: cleanRef,
        notes: cleanNotes,
      }

      if (isMounted.current) {
        setLastPayment(receipt)
        setPaymentAmount('')
        setRefNo('')
        setNotes('')
        setPaymentMode('cash')
      }

      await handleFarmerSelect(selectedFarmer.id)
      await loadFarmers()
    } catch (err: unknown) {
      console.error('handleSavePayment failed:', err)
      if (isMounted.current) {
        toast.error('पेमेंट जमा करने में त्रुटि। कृपया पुनः प्रयास करें।', {
          duration: 5000,
        })
      }
    } finally {
      saveLockRef.current = false
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  const generatePdfBlob = useCallback(async (): Promise<Blob | null> => {
    if (!lastPayment) return null
    const node = slipRef.current
    if (!node) {
      toast.error('Payment slip not ready. Please try again.')
      return null
    }
    try {
      const blob = await buildPdfBlob(node)
      return blob
    } catch (err) {
      console.error('PDF generation failed:', err)
      toast.error('Payment saved, but PDF generation failed. Please try again.')
      return null
    }
  }, [lastPayment])

  const handleDownloadPdf = useCallback(async () => {
    if (!lastPayment || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const filename = `SATGURU-PAYMENT-SLIP-${sanitizeFilename(lastPayment.payment_number)}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
      toast.success('Payment Slip PDF downloaded!')
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [lastPayment, pdfBusy, generatePdfBlob])

  const handlePrintPdf = useCallback(async () => {
    if (!lastPayment || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        toast.error('Popup blocked. Please allow popups to print.')
      } else {
        setTimeout(() => {
          try {
            win.focus()
            win.print()
          } catch {
            // Ignore
          }
        }, 700)
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [lastPayment, pdfBusy, generatePdfBlob])

  const handleShareWhatsAppPdf = useCallback(async () => {
    if (!lastPayment || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await generatePdfBlob()
      if (!blob) return
      const filename = `SATGURU-PAYMENT-SLIP-${sanitizeFilename(lastPayment.payment_number)}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })

      const shareText =
        `SATGURU BEEJ BHANDAR\nUdhaar Payment Slip\n` +
        `Receipt: ${lastPayment.payment_number}\n` +
        `Farmer: ${lastPayment.farmer_name} (${lastPayment.farmer_id_code})\n` +
        `Payment: ₹${formatINR(lastPayment.payment_amount)}\n` +
        `Remaining: ₹${formatINR(lastPayment.new_outstanding)}`

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
        share?: (data: ShareData) => Promise<void>
      }

      const shareData: ShareData = {
        title: 'SATGURU Payment Slip',
        text: shareText,
        files: [file],
      }

      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share(shareData)
          toast.success('Payment slip shared!')
          return
        } catch (err: unknown) {
          const e = err as { name?: string }
          if (e?.name === 'AbortError') {
            return
          }
          console.warn('Web Share failed, falling back:', err)
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      const phone = normalisePhone(lastPayment.farmer_mobile)
      const waUrl = phone
        ? `https://wa.me/${phone}`
        : `https://wa.me/`

      toast(
        'PDF downloaded. WhatsApp खुल रहा है — कृपया डाउनलोड की गई PDF को chat में attach करें।',
        { duration: 6000, icon: '📎' }
      )

      window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('WhatsApp share error:', err)
      toast.error('WhatsApp share failed. Please use Download PDF.')
    } finally {
      if (isMounted.current) setPdfBusy(false)
    }
  }, [lastPayment, pdfBusy, generatePdfBlob])

  const currentOutstanding = extractOutstanding(selectedFarmer)
  const availableCredit = extractAvailableCredit(selectedFarmer)

  const parsedAmount = parseFloat(paymentAmount)
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0
  const isFormReady =
    !!selectedFarmer &&
    isAmountValid &&
    !saving &&
    !syncingFarmer &&
    role === 'admin'

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas payment entry ki anumati nahi hai.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Wallet className="text-amber-400" size={28} />
          Payment & Udhaar Recovery (भुगतान प्राप्ति)
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          किसान से पेमेंट जमा करना व उधारी खाता अपडेट करना
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSavePayment}
        className="bg-white p-4 sm:p-6 rounded-3xl border shadow-sm space-y-4 text-xs sm:text-sm"
        noValidate
      >
        <div>
          <label
            htmlFor="farmer-select"
            className="block font-bold text-gray-700 mb-1"
          >
            किसान का चयन करें (Select Farmer){' '}
            <span className="text-rose-500">*</span>
          </label>
          <select
            id="farmer-select"
            required
            disabled={loadingFarmers || saving || authLoading}
            onChange={(e) => void handleFarmerSelect(e.target.value)}
            value={selectedFarmer?.id ?? ''}
            className="w-full p-3 border border-gray-200 rounded-xl font-bold bg-white focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-all text-xs sm:text-sm text-gray-800"
          >
            <option value="">
              {loadingFarmers ? 'Loading farmers list...' : '-- किसान चुनें --'}
            </option>
            {farmers.map((f) => {
              const due = extractOutstanding(f)
              return (
                <option key={f.id} value={f.id}>
                  {f.farmer_name} (ID: {f.farmer_id}){' '}
                  {f.village ? `- ${f.village}` : ''}{' '}
                  {due > 0 ? `[उधारी: ₹${formatINR(due)}]` : ''}
                </option>
              )
            })}
          </select>

          {!loadingFarmers && farmers.length === 0 && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs">
              <Users size={14} />
              <span>कोई एक्टिव किसान नहीं मिला।</span>
            </div>
          )}
        </div>

        {selectedFarmer && (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <p className="text-xs text-emerald-800 font-bold">
                  Current Outstanding (कुल उधारी):
                </p>
                <div className="text-xl sm:text-2xl text-rose-700 font-mono font-black">
                  {syncingFarmer ? (
                    <span className="inline-flex items-center gap-1.5 text-base">
                      <Loader2
                        size={16}
                        className="animate-spin text-emerald-700"
                      />
                      अपडेट हो रहा है...
                    </span>
                  ) : (
                    `₹${formatINR(currentOutstanding)}`
                  )}
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-emerald-800 font-bold">
                  Available Credit Limit:
                </p>
                <p className="text-base sm:text-lg text-emerald-900 font-mono font-bold">
                  ₹{formatINR(availableCredit)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleManualSync()}
              disabled={syncingFarmer || saving}
              className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={syncingFarmer ? 'animate-spin' : ''}
              />
              खाता Balance Re-calculate करें
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="payment-amount"
              className="block font-bold text-gray-700 mb-1"
            >
              पेमेंट राशि (Amount ₹) <span className="text-rose-500">*</span>
            </label>
            <input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              disabled={saving || syncingFarmer}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              onBlur={() => {
                const val = parseFloat(paymentAmount)
                if (!isNaN(val) && val > 0) {
                  setPaymentAmount(roundCurrency(val).toString())
                }
              }}
              placeholder="e.g. 2000"
              className="w-full p-3 border border-gray-200 rounded-xl font-black text-base sm:text-lg text-emerald-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
            />
            {isAmountValid &&
              currentOutstanding > 0 &&
              parsedAmount > currentOutstanding && (
                <p className="mt-1 text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  राशि उधारी से अधिक है (Advance जमा होगा)
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="payment-mode"
              className="block font-bold text-gray-700 mb-1"
            >
              पेमेंट मोड (Mode) <span className="text-rose-500">*</span>
            </label>
            <select
              id="payment-mode"
              value={paymentMode}
              disabled={saving || syncingFarmer}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl font-bold bg-white text-gray-800 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-xs sm:text-sm"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ref-no" className="block font-bold text-gray-700 mb-1">
            Reference / UTR / Cheque No
          </label>
          <input
            id="ref-no"
            type="text"
            disabled={saving || syncingFarmer}
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            maxLength={100}
            placeholder="e.g. UPI Ref / Cheque No"
            className="w-full p-3 border border-gray-200 rounded-xl font-mono text-gray-800 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-xs sm:text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="payment-notes"
            className="block font-bold text-gray-700 mb-1"
          >
            Notes (टिप्पणी)
          </label>
          <input
            id="payment-notes"
            type="text"
            disabled={saving || syncingFarmer}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Optional remarks..."
            className="w-full p-3 border border-gray-200 rounded-xl text-gray-800 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-xs sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!isFormReady}
          className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              पेमेंट जमा हो रही है...
            </>
          ) : (
            'Confirm Payment (भुगतान जमा करें) 💰'
          )}
        </button>
      </form>

      {lastPayment && (
        <div className="p-4 sm:p-5 bg-white border border-emerald-200 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
            <CheckCircle2 size={18} className="text-emerald-600" />
            रसीद तैयार है — Receipt No: {lastPayment.payment_number}
          </div>

          {/* Preview card */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-amber-50 p-4">
            <div className="text-center border-b border-emerald-200 pb-2 mb-3">
              <div className="text-base font-black text-emerald-900">
                {SHOP_INFO.name}
              </div>
              <div className="text-[10px] text-gray-600">{SHOP_INFO.address}</div>
              <div className="inline-block mt-1 px-3 py-0.5 bg-emerald-800 text-amber-100 text-[10px] font-bold rounded tracking-wider">
                UDHAAR PAYMENT SLIP
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <div className="text-gray-500">Receipt No</div>
                <div className="font-bold text-gray-800">
                  {lastPayment.payment_number}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500">Date / Time</div>
                <div className="font-bold text-gray-800">
                  {formatDateDMY(new Date(lastPayment.payment_date))}
                </div>
                <div className="font-bold text-gray-800">
                  {formatTime12(new Date(lastPayment.payment_date))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-2 border border-emerald-100 text-xs mb-2">
              <div className="text-[10px] text-emerald-700 font-bold">
                Payment Received From
              </div>
              <div className="font-black text-emerald-900 text-sm">
                {lastPayment.farmer_name}
              </div>
              <div className="flex justify-between text-[11px] mt-1">
                <span>
                  <span className="text-gray-500">ID: </span>
                  <span className="font-bold">{lastPayment.farmer_id_code}</span>
                </span>
                <span>
                  <span className="text-gray-500">Mob: </span>
                  <span className="font-bold">
                    {lastPayment.farmer_mobile || 'N/A'}
                  </span>
                </span>
              </div>
            </div>

            <div className="text-xs space-y-1 mb-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Mode</span>
                <span className="font-bold">
                  {PAYMENT_MODE_LABEL[lastPayment.payment_mode] ||
                    lastPayment.payment_mode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">UTR / Ref.</span>
                <span className="font-mono font-bold text-right break-all max-w-[60%]">
                  {referenceDisplay(
                    lastPayment.payment_mode,
                    lastPayment.reference_number
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between bg-gray-50 rounded px-2 py-1 text-xs">
                <span>Outstanding Before</span>
                <span className="font-bold">
                  ₹{formatINR(lastPayment.previous_outstanding)}
                </span>
              </div>
              <div className="flex justify-between bg-emerald-100 rounded px-2 py-1 text-xs border border-emerald-200">
                <span className="font-bold text-emerald-900">
                  Payment Received
                </span>
                <span className="font-black text-emerald-900">
                  ₹{formatINR(lastPayment.payment_amount)}
                </span>
              </div>
              <div className="flex justify-between bg-amber-100 rounded px-2 py-1 text-sm border border-amber-200">
                <span className="font-bold text-amber-900">
                  Outstanding After
                </span>
                <span className="font-black text-amber-900">
                  ₹{formatINR(lastPayment.new_outstanding)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfBusy}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
            >
              {pdfBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => void handlePrintPdf()}
              disabled={pdfBusy}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
            >
              {pdfBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              Print Slip
            </button>
            <button
              type="button"
              onClick={() => void handleShareWhatsAppPdf()}
              disabled={pdfBusy}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
            >
              {pdfBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              WhatsApp PDF
            </button>
          </div>

          <div className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
            <FileText size={11} />
            A6 PDF तैयार होगा — mobile पर share करें, desktop पर download करके WhatsApp Web में attach करें।
          </div>
        </div>
      )}

      {/* Off-screen A6 slip for PDF export */}
      {lastPayment && (
        <div
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            zIndex: -1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <PaymentSlipTemplate receipt={lastPayment} slipRef={slipRef as React.RefObject<HTMLDivElement>} />
        </div>
      )}
    </div>
  )
}