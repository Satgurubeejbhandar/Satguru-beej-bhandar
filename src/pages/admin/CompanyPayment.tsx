// src/pages/admin/CompanyPayment.tsx
import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Wallet, Loader2, CheckCircle2, ShieldAlert, RefreshCw, History,
  Search, X, Calendar, Filter, Eye, ChevronLeft, ChevronRight,
  Banknote, Smartphone, FileCheck, IndianRupee, TrendingDown, Building2,
  Camera, Upload, User, Receipt
} from 'lucide-react'
import toast from 'react-hot-toast'
import PaymentReceipt from '../../components/PaymentReceipt.tsx'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Company {
  id: string
  company_name: string
  gstin?: string | null
}

interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  ifsc_code: string
  upi_id?: string | null
  is_primary: boolean
}

interface PaymentHistoryRow {
  id: string
  company_id: string
  company_name: string
  company_gstin?: string | null
  payment_number: string
  payment_date: string
  amount: number
  payment_mode: string
  description: string
}

type PaymentMode = 'bank' | 'upi' | 'cheque' | 'cash'

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
type PageSize = typeof PAGE_SIZE_OPTIONS[number]

const MAX_PHOTO_MB = 5

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function safeNum(val: unknown): number {
  return Number.isFinite(Number(val)) ? Number(val) : 0
}

function formatINR(val: number | null | undefined): string {
  return safeNum(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '—'
  const parts = dStr.split('T')[0].split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dStr
}

function modeBadgeClasses(mode: string): string {
  const m = String(mode || '').toLowerCase()
  switch (m) {
    case 'bank':   return 'bg-blue-100 text-blue-900 border-blue-200'
    case 'upi':    return 'bg-purple-100 text-purple-900 border-purple-200'
    case 'cheque': return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'cash':   return 'bg-emerald-100 text-emerald-900 border-emerald-200'
    default:       return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

function ModeIcon({ mode, size = 12 }: { mode: string; size?: number }) {
  const m = String(mode || '').toLowerCase()
  switch (m) {
    case 'upi':    return <Smartphone size={size} />
    case 'cheque': return <FileCheck size={size} />
    case 'cash':   return <IndianRupee size={size} />
    case 'bank':   return <Banknote size={size} />
    default:       return <Banknote size={size} />
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CompanyPayment() {
  const { role, loading: authLoading } = useAuth()

  // Master data
  const [companies, setCompanies] = useState<Company[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Payment form state
  const [saving, setSaving] = useState(false)
  const [paymentCompanyId, setPaymentCompanyId] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank')
  const [refNo, setRefNo] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])

  // Dynamic per-mode fields
  const [selectedBankId, setSelectedBankId] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeBankName, setChequeBankName] = useState('')
  const [cashRecipientName, setCashRecipientName] = useState('')
  const [cashPhotoFile, setCashPhotoFile] = useState<File | null>(null)
  const [cashPhotoPreview, setCashPhotoPreview] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Balance
  const [fetchingBalance, setFetchingBalance] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)

  // History
  const [historyCompanyId, setHistoryCompanyId] = useState<string>('')
  const [historyRows, setHistoryRows] = useState<PaymentHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Pagination
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const [currentPage, setCurrentPage] = useState(1)

  // Modals
  const [viewRow, setViewRow] = useState<PaymentHistoryRow | null>(null)
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null)

  // Refs
  const isMounted = useRef(true)
  const saveLockRef = useRef<boolean>(false)
  const balanceReqId = useRef(0)
  const historyReqId = useRef(0)

  /* ---- Load Companies + Bank Accounts ---- */
  const loadMasters = useCallback(async () => {
    try {
      setLoading(true)
      const [companiesRes, banksRes] = await Promise.all([
        supabase.from('companies').select('id, company_name, gstin')
          .eq('account_status', 'active').order('company_name'),
        supabase.from('business_bank_accounts')
          .select('id, bank_name, account_name, account_number, ifsc_code, upi_id, is_primary')
          .eq('is_active', true)
          .order('is_primary', { ascending: false }).order('bank_name'),
      ])
      if (companiesRes.error) throw companiesRes.error
      if (isMounted.current) {
        setCompanies((companiesRes.data as Company[]) || [])
        const banks = (banksRes.data as BankAccount[]) || []
        setBankAccounts(banks)
        const primary = banks.find(b => b.is_primary)
        if (primary) setSelectedBankId(primary.id)
      }
    } catch (err) {
      toast.error('Load failed: ' + (err as Error).message)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    if (role === 'admin') void loadMasters()
    return () => { isMounted.current = false }
  }, [loadMasters, role])

  /* ---- Optimized Company Balance Fetch (No Heavy Ledger array transfer) ---- */
  const fetchCompanyBalance = useCallback(async (id: string) => {
    if (!id) { setPendingAmount(null); return }
    const reqId = ++balanceReqId.current
    setFetchingBalance(true)
    try {
      // Direct high-performance lightweight numeric aggregations
      const [purchasesRes, paymentsRes, returnsRes, companyRes] = await Promise.all([
        supabase.from('purchase_bills').select('total_amount').eq('company_id', id).eq('purchase_status', 'active'),
        supabase.from('company_payments').select('payment_amount').eq('company_id', id),
        supabase.from('purchase_returns').select('total_amount').eq('company_id', id).eq('return_status', 'completed'),
        supabase.from('companies').select('opening_balance, opening_balance_type').eq('id', id).single()
      ])

      if (reqId !== balanceReqId.current) return

      const openBal = safeNum(companyRes.data?.opening_balance)
      const isPayable = companyRes.data?.opening_balance_type === 'payable'
      const initialPayable = isPayable ? openBal : -openBal

      const totalPurchases = (purchasesRes.data || []).reduce((sum, p) => sum + safeNum(p.total_amount), 0)
      const totalPayments = (paymentsRes.data || []).reduce((sum, p) => sum + safeNum(p.payment_amount), 0)
      const totalReturns = (returnsRes.data || []).reduce((sum, r) => sum + safeNum(r.total_amount), 0)

      const closingPayable = initialPayable + totalPurchases - totalPayments - totalReturns

      if (isMounted.current && reqId === balanceReqId.current) {
        setPendingAmount(closingPayable)
      }
    } catch (err) {
      console.warn('Balance summary aggregation failed:', err)
      if (isMounted.current && reqId === balanceReqId.current) setPendingAmount(null)
    } finally {
      if (isMounted.current && reqId === balanceReqId.current) setFetchingBalance(false)
    }
  }, [])

  const handlePaymentCompanySelect = (id: string) => {
    setPaymentCompanyId(id)
    void fetchCompanyBalance(id)
  }

  /* ---- Authentic History Loader (From actual company_payments table) ---- */
  const loadPaymentHistory = useCallback(async (targetCompanyId: string) => {
    const reqId = ++historyReqId.current
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      let query = supabase
        .from('company_payments')
        .select(`
          id,
          company_id,
          payment_number,
          payment_date,
          payment_amount,
          payment_mode,
          reference_number,
          notes,
          company:companies(company_name, gstin)
        `)

      if (targetCompanyId) {
        query = query.eq('company_id', targetCompanyId)
      }

      const { data, error } = await query
        .order('payment_date', { ascending: false })
        .order('payment_number', { ascending: false })

      if (error) throw error
      if (reqId !== historyReqId.current || !isMounted.current) return

      // Map rows safely
      const rows: PaymentHistoryRow[] = (data || []).map((p: any) => {
        const comp = Array.isArray(p.company) ? p.company[0] : p.company
        return {
          id: p.id,
          company_id: p.company_id,
          company_name: comp?.company_name || 'Unknown Company',
          company_gstin: comp?.gstin || null,
          payment_number: p.payment_number,
          payment_date: p.payment_date,
          amount: safeNum(p.payment_amount),
          payment_mode: p.payment_mode || 'bank',
          description: p.notes || p.reference_number || 'Supplier payment voucher',
        }
      })

      setHistoryRows(rows)
      setCurrentPage(1)
    } catch (err) {
      const msg = (err as Error).message
      if (isMounted.current && reqId === historyReqId.current) {
        setHistoryError(msg)
        setHistoryRows([])
        toast.error('Payment history load failed: ' + msg)
      }
    } finally {
      if (isMounted.current && reqId === historyReqId.current) setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin' && companies.length > 0) void loadPaymentHistory(historyCompanyId)
  }, [role, companies, historyCompanyId, loadPaymentHistory])

  /* ---- Filters ---- */
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return historyRows.filter(r => {
      if (fromDate && r.payment_date < fromDate) return false
      if (toDate && r.payment_date > toDate) return false
      if (q) {
        const hay = [r.company_name, r.payment_number, r.description, r.payment_mode].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [historyRows, searchQuery, fromDate, toDate])

  const summary = useMemo(() => ({
    totalCount: filteredRows.length,
    totalAmount: filteredRows.reduce((s, r) => s + r.amount, 0),
    latestDate: filteredRows[0]?.payment_date || null,
  }), [filteredRows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const pageEnd = Math.min(pageStart + pageSize, filteredRows.length)
  const pageRows = filteredRows.slice(pageStart, pageEnd)

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [totalPages, currentPage])

  const clearFilters = () => {
    setSearchQuery(''); setFromDate(''); setToDate(''); setHistoryCompanyId(''); setCurrentPage(1)
  }

  const anyFilterActive = Boolean(searchQuery) || Boolean(fromDate) || Boolean(toDate) || Boolean(historyCompanyId)

  /* ---- Photo Handling ---- */
  const handlePhotoSelect = (file: File | null) => {
    if (!file) { setCashPhotoFile(null); setCashPhotoPreview(null); return }
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      toast.error('केवल JPG / PNG / WebP allowed')
      return
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(`फोटो size ${MAX_PHOTO_MB}MB से कम होनी चाहिए`)
      return
    }
    setCashPhotoFile(file)
    const reader = new FileReader()
    reader.onload = e => setCashPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearPhoto = () => {
    setCashPhotoFile(null); setCashPhotoPreview(null)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const uploadPhoto = async (paymentNo: string): Promise<string | null> => {
    if (!cashPhotoFile) return null
    const ext = cashPhotoFile.name.split('.').pop() || 'jpg'
    const safe = paymentNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const path = `${new Date().getFullYear()}/${safe}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('cash-recipient-photos')
      .upload(path, cashPhotoFile, { cacheControl: '3600', upsert: false })
    if (error) throw new Error('Photo upload failed: ' + error.message)
    return path
  }

  /* ---- Reset payment-mode-specific fields when mode changes ---- */
  const handleModeChange = (m: PaymentMode) => {
    setMode(m)
    setRefNo('')
    setChequeNumber('')
    setChequeBankName('')
    setCashRecipientName('')
    clearPhoto()
  }

  /* ---- Submit ---- */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const amt = safeNum(amount)
    if (!paymentCompanyId) return toast.error('सप्लायर कंपनी चुनें!')
    if (amt <= 0) return toast.error('वैध राशि दर्ज करें!')

    // Mode-specific validation
    if (mode === 'bank') {
      if (!selectedBankId) return toast.error('Bank account चुनें!')
      if (!refNo.trim()) return toast.error('UTR / Transaction No enter करें!')
    }
    if (mode === 'upi') {
      if (!refNo.trim()) return toast.error('UPI Transaction ID enter करें!')
    }
    if (mode === 'cheque') {
      if (!chequeNumber.trim()) return toast.error('Cheque number enter करें!')
    }
    if (mode === 'cash') {
      if (!cashRecipientName.trim()) return toast.error('Cash recipient name mandatory है!')
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()

      // Step 1: Record payment
      const { data, error } = await supabase.rpc('record_company_payment', {
        p_company_id: paymentCompanyId,
        p_payment_amount: amt,
        p_payment_mode: mode,
        p_payment_date: paymentDate,
        p_reference_number: refNo.trim() || null,
        p_notes: notes.trim() || null,
        p_created_by: authData?.user?.id || null,
        p_bank_account_id: mode === 'bank' ? selectedBankId : null,
        p_cash_recipient_name: mode === 'cash' ? cashRecipientName.trim() : null,
        p_cash_recipient_photo: null, // uploaded below
        p_cheque_number: mode === 'cheque' ? chequeNumber.trim() : null,
        p_cheque_bank_name: mode === 'cheque' ? chequeBankName.trim() || null : null,
      })

      if (error) throw error

      const result = data as { payment_id: string; payment_number: string }
      const paymentId = result.payment_id
      const paymentNo = result.payment_number

      // Step 2: Upload photo (if any) and update record
      if (mode === 'cash' && cashPhotoFile && paymentId) {
        try {
          const path = await uploadPhoto(paymentNo)
          if (path) {
            await supabase
              .from('company_payments')
              .update({ cash_recipient_photo_path: path })
              .eq('id', paymentId)
          }
        } catch (photoErr) {
          console.warn('Photo upload failed but payment saved:', photoErr)
          toast.error('Payment saved, but photo upload failed')
        }
      }

      toast.success(`Payment ${paymentNo} सफलतापूर्वक दर्ज!`)

      // Reset form
      setAmount(''); setRefNo(''); setNotes('')
      setChequeNumber(''); setChequeBankName(''); setCashRecipientName('')
      clearPhoto()
      setPaymentDate(new Date().toISOString().split('T')[0])

      // Refresh
      await Promise.all([fetchCompanyBalance(paymentCompanyId), loadPaymentHistory(historyCompanyId)])

      // Open receipt automatically
      setReceiptPaymentId(paymentId)
    } catch (err) {
      toast.error('Payment Error: ' + (err as Error).message)
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setSaving(false)
    }
  }

  const handleRefreshHistory = () => {
    if (historyLoading) return
    void loadPaymentHistory(historyCompanyId)
    if (paymentCompanyId) void fetchCompanyBalance(paymentCompanyId)
  }

  const openReceiptForHistoryRow = async (row: PaymentHistoryRow) => {
    try {
      const { data, error } = await supabase
        .from('company_payments')
        .select('id')
        .eq('payment_number', row.payment_number)
        .maybeSingle()
      if (error) throw error
      if (!data?.id) {
        toast.error('Receipt not available for this record')
        return
      }
      setReceiptPaymentId(data.id)
    } catch (err) {
      toast.error('Receipt lookup failed: ' + (err as Error).message)
    }
  }

  /* ---- Admin gate ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center">
        <ShieldAlert className="inline text-red-600 mb-2" size={32} />
        <h1 className="font-bold text-red-700">Access Denied</h1>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 font-sans">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="text-amber-400" size={28} /> Company Payment (सप्लायर भुगतान)
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Record supplier payments, generate receipts & view full history
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-10 rounded-3xl border text-center">
          <Loader2 className="animate-spin mx-auto text-emerald-800 mb-3" size={32} />
          <p className="text-sm text-slate-500 font-medium">Loading Master Data…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: FORM */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  New Payment Entry
                </h2>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">सप्लायर कंपनी *</label>
                <select required disabled={loading || saving} value={paymentCompanyId}
                  onChange={(e) => handlePaymentCompanySelect(e.target.value)}
                  className="w-full p-3 border rounded-xl font-bold text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">-- Select Supplier --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.gstin ? `(GST: ${c.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {paymentCompanyId && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      Current Pending / Payable:
                    </p>
                    <p className="text-xl font-black font-mono mt-0.5 text-rose-700">
                      {fetchingBalance ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 size={14} className="animate-spin" /> Loading...
                        </span>
                      ) : pendingAmount !== null ? (
                        `₹${formatINR(Math.abs(pendingAmount))} ${pendingAmount >= 0 ? '(Cr)' : '(Dr)'}`
                      ) : '—'}
                    </p>
                  </div>
                  <button type="button" onClick={() => void fetchCompanyBalance(paymentCompanyId)}
                    disabled={fetchingBalance || saving}
                    className="p-2 text-emerald-800 hover:bg-emerald-100 rounded-xl cursor-pointer">
                    <RefreshCw size={14} className={fetchingBalance ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">भुगतान राशि ₹ *</label>
                  <input required type="number" step="0.01" min="1" value={amount}
                    onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000"
                    className="w-full p-3 border rounded-xl font-black text-base text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">भुगतान मोड *</label>
                  <select value={mode} onChange={(e) => handleModeChange(e.target.value as PaymentMode)}
                    className="w-full p-3 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="bank">Bank Transfer</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash (नकद)</option>
                  </select>
                </div>
              </div>

              {/* ── DYNAMIC BANK FIELDS ── */}
              {mode === 'bank' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <label className="block font-bold text-blue-900 text-[11px] uppercase">Paid From Bank Account *</label>
                  {bankAccounts.length === 0 ? (
                    <p className="text-[11px] text-rose-700 font-bold p-2 bg-rose-50 rounded">
                      ⚠ कोई bank account सेट नहीं। पहले Bank Accounts Master में जोड़ें।
                    </p>
                  ) : (
                    <select required value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full p-2.5 border rounded-lg font-bold text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- Select Bank --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} — {b.account_number} {b.is_primary ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <div>
                    <label className="block font-bold text-blue-900 text-[11px] uppercase mb-1">UTR / Transaction No *</label>
                    <input required value={refNo} onChange={(e) => setRefNo(e.target.value)}
                      placeholder="e.g. UTR1209938"
                      className="w-full p-2.5 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* ── UPI ── */}
              {mode === 'upi' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <label className="block font-bold text-purple-900 text-[11px] uppercase mb-1">UPI Transaction ID / UTR *</label>
                  <input required value={refNo} onChange={(e) => setRefNo(e.target.value)}
                    placeholder="e.g. 412345678901"
                    className="w-full p-2.5 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-purple-500" />
                  {bankAccounts.some(b => b.upi_id) && (
                    <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full p-2.5 border rounded-lg font-bold text-xs bg-white outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">-- (optional) UPI paid from --</option>
                      {bankAccounts.filter(b => b.upi_id).map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name} — {b.upi_id}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* ── CHEQUE ── */}
              {mode === 'cheque' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-amber-900 text-[11px] uppercase mb-1">Cheque No *</label>
                      <input required value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g. 000123"
                        className="w-full p-2.5 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block font-bold text-amber-900 text-[11px] uppercase mb-1">Drawn On (Bank)</label>
                      <input value={chequeBankName} onChange={(e) => setChequeBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── CASH ── */}
              {mode === 'cash' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-bold text-emerald-900 text-[11px] uppercase mb-1 flex items-center gap-1">
                      <User size={11} /> Cash Paid To (Person Name) *
                    </label>
                    <input required value={cashRecipientName} onChange={(e) => setCashRecipientName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full p-2.5 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-900 text-[11px] uppercase mb-1">
                      Recipient Photo (Optional, max {MAX_PHOTO_MB}MB)
                    </label>
                    {cashPhotoPreview ? (
                      <div className="relative inline-block">
                        <img src={cashPhotoPreview} alt="preview" className="w-32 h-32 object-cover rounded-lg border-2 border-emerald-400" />
                        <button type="button" onClick={clearPhoto}
                          className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow cursor-pointer">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 py-2 bg-white border-2 border-emerald-300 hover:border-emerald-500 rounded-lg font-bold text-emerald-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                          <Camera size={14} /> Camera
                        </button>
                        <button type="button" onClick={() => galleryInputRef.current?.click()}
                          className="flex-1 py-2 bg-white border-2 border-emerald-300 hover:border-emerald-500 rounded-lg font-bold text-emerald-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload size={14} /> Gallery
                        </button>
                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                          className="hidden" onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)} />
                        <input ref={galleryInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                          className="hidden" onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">भुगतान की तिथि *</label>
                  <input type="date" required value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-3 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Notes / Remarks</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional..."
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <button type="submit" disabled={saving || !paymentCompanyId || !amount}
                className="w-full py-4 mt-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-95">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {saving ? 'Saving...' : 'Confirm Payment & Generate Receipt 💰'}
              </button>
            </form>
          </div>

          {/* RIGHT: HISTORY */}
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <History size={13} />
                  <p className="text-[9px] font-black uppercase tracking-wider">Payments</p>
                </div>
                <p className="text-lg font-black text-slate-900 mt-1">{summary.totalCount}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-rose-700">
                  <TrendingDown size={13} />
                  <p className="text-[9px] font-black uppercase tracking-wider">Total Paid</p>
                </div>
                <p className="text-base font-black font-mono text-rose-700 mt-1">₹{formatINR(summary.totalAmount)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-blue-700">
                  <Building2 size={13} />
                  <p className="text-[9px] font-black uppercase tracking-wider">Scope</p>
                </div>
                <p className="text-xs font-black text-slate-900 mt-1 truncate">
                  {historyCompanyId ? companies.find(c => c.id === historyCompanyId)?.company_name || '—' : 'All Companies'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-amber-700">
                  <Calendar size={13} />
                  <p className="text-[9px] font-black uppercase tracking-wider">Latest</p>
                </div>
                <p className="text-xs font-black font-mono text-slate-900 mt-1">
                  {summary.latestDate ? formatDateDisplay(summary.latestDate) : '—'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <History size={16} />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Payment History</h2>
                </div>
                <div className="flex items-center gap-2">
                  {anyFilterActive && (
                    <button onClick={clearFilters}
                      className="px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer flex items-center gap-1">
                      <X size={12} /> Clear
                    </button>
                  )}
                  <button onClick={handleRefreshHistory} disabled={historyLoading}
                    className="px-3 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-50">
                    <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Company</label>
                  <select value={historyCompanyId} onChange={(e) => setHistoryCompanyId(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">All Companies</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Search</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                      placeholder="Name, Ref, UTR..."
                      className="w-full pl-7 pr-2 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">From</label>
                  <input type="date" value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1) }}
                    className="w-full p-2 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">To</label>
                  <input type="date" value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setCurrentPage(1) }}
                    className="w-full p-2 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="overflow-x-auto">
                {historyLoading ? (
                  <div className="py-16 text-center text-slate-500 font-bold text-xs">
                    <Loader2 className="animate-spin mx-auto mb-2 text-emerald-700" size={28} />
                    Loading Payment History...
                  </div>
                ) : historyError ? (
                  <div className="py-10 text-center bg-rose-50 border-t border-rose-200 text-rose-800 font-bold text-sm">
                    ⚠ {historyError}
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="py-14 text-center text-slate-500 font-medium text-xs">
                    <Filter className="mx-auto mb-2 text-slate-300" size={28} />
                    {anyFilterActive ? 'No payments for selected filters' : 'No supplier payments found'}
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-emerald-950 text-white font-black uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Payment No.</th>
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Mode</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                      {pageRows.map((row) => {
                        const rowMode = row.payment_mode || 'bank'
                        return (
                          <tr key={row.id} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{formatDateDisplay(row.payment_date)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 whitespace-nowrap">{row.payment_number}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 truncate max-w-[200px]">{row.company_name}</div>
                              {row.company_gstin && <div className="text-[10px] text-slate-500 font-mono">{row.company_gstin}</div>}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${modeBadgeClasses(rowMode)}`}>
                                <ModeIcon mode={rowMode} /> {rowMode.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700 whitespace-nowrap">₹{formatINR(row.amount)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex justify-center gap-1">
                                <button onClick={() => setViewRow(row)} title="View Details"
                                  className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer">
                                  <Eye size={14} />
                                </button>
                                <button onClick={() => openReceiptForHistoryRow(row)} title="View Receipt"
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer">
                                  <Receipt size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {!historyLoading && !historyError && filteredRows.length > 0 && (
                <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span>Showing <b>{pageStart + 1}</b>–<b>{pageEnd}</b> of <b>{filteredRows.length}</b></span>
                    <select value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setCurrentPage(1) }}
                      className="ml-2 p-1 border rounded-md text-[11px] font-bold bg-white outline-none focus:ring-2 focus:ring-emerald-500">
                      {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 font-black text-slate-800">Page {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setViewRow(null) }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 px-5 py-4 flex justify-between items-center">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Wallet size={16} className="text-amber-400" /> Payment Details
              </h3>
              <button onClick={() => setViewRow(null)} className="p-1.5 text-white/80 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between"><span className="font-bold text-slate-500">Payment No.</span><span className="font-mono font-black">{viewRow.payment_number}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">Company</span><span className="font-black text-right">{viewRow.company_name}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">Amount</span><span className="font-mono font-black text-rose-700">₹{formatINR(viewRow.amount)}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">Date</span><span className="font-mono">{formatDateDisplay(viewRow.payment_date)}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">Payment Mode</span><span className="font-bold uppercase">{viewRow.payment_mode}</span></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Description</p>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700 whitespace-pre-wrap">{viewRow.description || '—'}</div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-between">
              <button onClick={() => { const row = viewRow; setViewRow(null); openReceiptForHistoryRow(row) }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                <Receipt size={13} /> View Receipt
              </button>
              <button onClick={() => setViewRow(null)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {receiptPaymentId && (
        <PaymentReceipt paymentId={receiptPaymentId} onClose={() => setReceiptPaymentId(null)} />
      )}
    </div>
  )
}