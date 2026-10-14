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

// ✅ Shared slip components (नई file से)
import {
  PaymentSlipTemplate,
  buildPdfBlob,
  formatINR,
  formatDateDMY,
  formatTime12,
  referenceDisplay,
  sanitizeFilename,
  normalisePhone,
  PAYMENT_MODE_LABEL,
  SHOP_INFO,
  type PaymentReceipt,
} from '../../components/PaymentSlip'

// Re-export for other files that may import PaymentReceipt from here
export type { PaymentReceipt }

/* ─────────── Types ─────────── */
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

/* ─────────── Constants ─────────── */
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash (नकद)' },
  { value: 'upi', label: 'UPI / PhonePe / GPay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const

const SUPABASE_MAX_ROWS = 1000

/* ─────────── Helpers (page-specific) ─────────── */
function roundCurrency(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function extractOutstanding(farmer: FarmerOption | null | undefined): number {
  if (!farmer) return 0

  let caOutstanding: number | undefined

  if (Array.isArray(farmer.credit_accounts) && farmer.credit_accounts.length > 0) {
    caOutstanding = Number(farmer.credit_accounts[0]?.current_outstanding)
  } else if (
    farmer.credit_accounts &&
    typeof farmer.credit_accounts === 'object' &&
    'current_outstanding' in farmer.credit_accounts
  ) {
    caOutstanding = Number(
      (farmer.credit_accounts as CreditAccountInfo).current_outstanding
    )
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
  } else if (
    farmer.credit_accounts &&
    typeof farmer.credit_accounts === 'object' &&
    'available_credit' in farmer.credit_accounts
  ) {
    caAvailable = Number(
      (farmer.credit_accounts as CreditAccountInfo).available_credit
    )
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

/* ═════════════════════════════════════════════
                 MAIN COMPONENT
   ═════════════════════════════════════════════ */
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

  /* ─── Load farmers ─── */
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

  /* ─── Farmer select ─── */
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

  /* ─── Manual sync ─── */
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

  /* ─── Save payment ─── */
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

      // Duplicate guard: same farmer + amount + mode within last 2 minutes
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

  /* ─── PDF actions ─── */
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
      const waUrl = phone ? `https://wa.me/${phone}` : `https://wa.me/`

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

  /* ─── Derived values ─── */
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

  /* ─── Access check ─── */
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

  /* ─── Render ─── */
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
          <label htmlFor="farmer-select" className="block font-bold text-gray-700 mb-1">
            किसान का चयन करें (Select Farmer) <span className="text-rose-500">*</span>
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
                      <Loader2 size={16} className="animate-spin text-emerald-700" />
                      अपडेट हो रहा है...
                    </span>
                  ) : (
                    `₹${formatINR(currentOutstanding)}`
                  )}
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-emerald-800 font-bold">Available Credit Limit:</p>
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
              <RefreshCw size={12} className={syncingFarmer ? 'animate-spin' : ''} />
              खाता Balance Re-calculate करें
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="payment-amount" className="block font-bold text-gray-700 mb-1">
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
            <label htmlFor="payment-mode" className="block font-bold text-gray-700 mb-1">
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
          <label htmlFor="payment-notes" className="block font-bold text-gray-700 mb-1">
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

      {/* Receipt Preview */}
      {lastPayment && (
        <div className="p-4 sm:p-5 bg-white border border-emerald-200 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
            <CheckCircle2 size={18} className="text-emerald-600" />
            रसीद तैयार है — Receipt No: {lastPayment.payment_number}
          </div>

          {/* On-screen Preview Card (watermark + styled) */}
          <div className="rounded-xl border-2 border-emerald-700 bg-white overflow-hidden shadow-lg relative">
            {/* Watermark preview */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden z-0">
              <div
                style={{ transform: 'rotate(-32deg)' }}
                className="flex flex-col gap-3 items-center"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="text-2xl font-black tracking-widest"
                    style={{ color: 'rgba(6, 78, 59, 0.08)' }}
                  >
                    SATGURU PAYMENTS
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white text-center p-4 border-b-4 border-amber-500">
                <div className="text-lg font-black tracking-wide">{SHOP_INFO.name}</div>
                <div className="text-[10px] text-emerald-100 mt-1">{SHOP_INFO.address}</div>
                <div className="text-[10px] text-amber-200 italic font-bold mt-0.5">
                  {SHOP_INFO.tagline}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="text-center">
                  <span className="inline-block bg-amber-500 text-emerald-900 border-2 border-emerald-900 px-4 py-1 text-xs font-black rounded-full tracking-widest">
                    UDHAAR PAYMENT SLIP
                  </span>
                </div>

                <div className="flex justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs">
                  <div>
                    <div className="text-[9px] text-emerald-700 font-bold">RECEIPT NO.</div>
                    <div className="font-black text-emerald-900">
                      {lastPayment.payment_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-emerald-700 font-bold">DATE & TIME</div>
                    <div className="font-black text-emerald-900">
                      {formatDateDMY(new Date(lastPayment.payment_date))}
                    </div>
                    <div className="font-bold text-emerald-900 text-[11px]">
                      {formatTime12(new Date(lastPayment.payment_date))}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-500 rounded-lg p-2.5">
                  <div className="text-[9px] text-emerald-800 font-black tracking-wide">
                    ◆ PAYMENT RECEIVED FROM
                  </div>
                  <div className="font-black text-emerald-900 text-base border-b border-dashed border-emerald-600 pb-1 mt-1">
                    {lastPayment.farmer_name}
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span>
                      <span className="text-emerald-700 font-bold">ID: </span>
                      <span className="font-black text-emerald-900">
                        {lastPayment.farmer_id_code}
                      </span>
                    </span>
                    <span>
                      <span className="text-emerald-700 font-bold">Mob: </span>
                      <span className="font-black text-emerald-900">
                        {lastPayment.farmer_mobile || 'N/A'}
                      </span>
                    </span>
                  </div>
                </div>

                <div>
                  <div className="bg-emerald-900 text-white text-[10px] font-black px-2 py-1 rounded-t tracking-wider">
                    ◆ PAYMENT DETAILS
                  </div>
                  <div className="border-2 border-emerald-900 border-t-0 rounded-b p-2 bg-white text-xs">
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-700 font-semibold">Payment Mode</span>
                      <span className="font-black text-emerald-900">
                        {PAYMENT_MODE_LABEL[lastPayment.payment_mode] || lastPayment.payment_mode}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-t border-dotted border-gray-300 mt-1 pt-1">
                      <span className="text-gray-700 font-semibold">UTR / Ref.</span>
                      <span className="font-bold font-mono text-emerald-900 text-right break-all max-w-[60%]">
                        {referenceDisplay(
                          lastPayment.payment_mode,
                          lastPayment.reference_number
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-emerald-900 text-white text-[10px] font-black px-2 py-1 rounded-t tracking-wider">
                    ◆ ACCOUNT SUMMARY
                  </div>
                  <div className="border-2 border-emerald-900 border-t-0 rounded-b p-2 bg-white space-y-1.5">
                    <div className="flex justify-between bg-gray-100 border-l-4 border-gray-500 rounded px-2 py-1.5 text-xs">
                      <span className="font-bold text-gray-700">Outstanding Before</span>
                      <span className="font-black text-gray-700">
                        ₹{formatINR(lastPayment.previous_outstanding)}
                      </span>
                    </div>
                    <div className="flex justify-between bg-gradient-to-r from-emerald-50 to-emerald-200 border-2 border-emerald-600 rounded px-2 py-1.5 text-sm">
                      <span className="font-black text-emerald-900">✓ Payment Received</span>
                      <span className="font-black text-emerald-900">
                        ₹{formatINR(lastPayment.payment_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between bg-gradient-to-r from-amber-50 to-amber-200 border-2 border-orange-600 rounded px-2 py-1.5 text-sm">
                      <span className="font-black text-orange-900">Outstanding After</span>
                      <span className="font-black text-orange-900">
                        ₹{formatINR(lastPayment.new_outstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                {lastPayment.notes && (
                  <div className="bg-yellow-50 border border-dashed border-yellow-600 rounded px-2 py-1 text-xs">
                    <span className="font-black text-yellow-900">Note: </span>
                    <span className="text-yellow-900">{lastPayment.notes}</span>
                  </div>
                )}

                <div className="border-t-2 border-dashed border-emerald-900 pt-2 text-center">
                  <div className="text-xs font-black text-emerald-900">
                    ✓ Payment Received Successfully
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    Thank you for choosing {SHOP_INFO.name}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-200 pt-1 mt-1.5">
                    <span>📞 {SHOP_INFO.phone}</span>
                    <span className="font-bold text-emerald-900">Computer Generated Slip</span>
                  </div>
                </div>
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
              {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => void handlePrintPdf()}
              disabled={pdfBusy}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
            >
              {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print Slip
            </button>
            <button
              type="button"
              onClick={() => void handleShareWhatsAppPdf()}
              disabled={pdfBusy}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
            >
              {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
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
          <PaymentSlipTemplate
            receipt={lastPayment}
            slipRef={slipRef as React.RefObject<HTMLDivElement>}
          />
        </div>
      )}
    </div>
  )
}