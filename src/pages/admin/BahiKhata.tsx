import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Lock,
  Unlock,
  Download,
  Printer,
  Save,
  PlusCircle,
  MinusCircle,
  Trash2,
  CalendarDays,
  X,
  FileCheck,
  RefreshCw,
  Loader2,
  Wallet,
  Banknote,
  ReceiptText,
  Package,
  Sprout,
  TrendingUp,
  TrendingDown,
  CircleCheck,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* =========================================================
   TYPES
========================================================= */
interface CashBill {
  id: string
  ref: string
  name: string
  amount: number
  type: 'sale' | 'physical'
}
interface Payment {
  id: string
  ref: string
  farmer: string
  amount: number
}
interface Purchase {
  id: string
  ref: string
  company: string
  amount: number
}
interface SuvidhaExpense {
  id: string
  amount: number
  description: string
  time?: string
}
interface Adjustment {
  id: string
  type: 'in' | 'out'
  amount: number
  reason: string
  time?: string
}
interface BahiLocalData {
  openingBalance: number
  suvidhaExpenses: SuvidhaExpense[]
  stockNotes: string
  footerNotes: string
  adjustments: Adjustment[]
  isLocked: boolean
  isClosed: boolean
}

/* =========================================================
   HELPERS
========================================================= */
const localDate = (date: Date = new Date()): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const formatINR = (amount: number): string =>
  Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const safeNum = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const relationObject = (value: unknown): Record<string, any> | null => {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? first : null
  }
  return typeof value === 'object' ? (value as Record<string, any>) : null
}
const genId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
const getLocalKey = (date: string) => `bahi_${date}`
const getOpeningKey = (date: string) => `bahi_opening_${date}`
const getNextDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + 1))
}
const emptyLocalData = (): BahiLocalData => ({
  openingBalance: 0,
  suvidhaExpenses: [],
  stockNotes: '',
  footerNotes: '',
  adjustments: [],
  isLocked: false,
  isClosed: false,
})
const readLocalData = (date: string): BahiLocalData => {
  try {
    const raw = localStorage.getItem(getLocalKey(date))
    if (!raw) {
      const transferred = localStorage.getItem(getOpeningKey(date))
      return {
        ...emptyLocalData(),
        openingBalance: transferred ? safeNum(transferred) : 0,
      }
    }
    const parsed = JSON.parse(raw)
    let expenses: SuvidhaExpense[] = []
    if (Array.isArray(parsed.suvidhaExpenses)) {
      expenses = parsed.suvidhaExpenses
    } else if (typeof parsed.suvidhaNotes === 'string' && parsed.suvidhaNotes.trim()) {
      const parts = parsed.suvidhaNotes.match(/[^,\n]+/g) || []
      expenses = parts.map((part: string) => {
        const match = part.match(/\d+(?:\.\d+)?/)
        return {
          id: genId(),
          amount: match ? safeNum(match[0]) : 0,
          description: part.replace(/\d+(?:\.\d+)?/g, '').trim() || part.trim(),
        }
      }).filter((e: SuvidhaExpense) => e.amount > 0 || e.description)
    }
    return {
      openingBalance: safeNum(parsed.openingBalance),
      suvidhaExpenses: expenses,
      stockNotes: typeof parsed.stockNotes === 'string' ? parsed.stockNotes : '',
      footerNotes: typeof parsed.footerNotes === 'string' ? parsed.footerNotes : '',
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
      isLocked: Boolean(parsed.isLocked),
      isClosed: Boolean(parsed.isClosed),
    }
  } catch (error) {
    console.error('Bahi local data read error:', error)
    return emptyLocalData()
  }
}

const money = (value: number) => `₹${formatINR(value)}`
const dateLabel = (value: string) =>
  value ? value.split('-').reverse().join('-') : ''

/* =========================================================
   COMPONENT
========================================================= */
export default function BahiKhata() {
  const { role, loading: authLoading } = useAuth()
  const [selectedDate, setSelectedDate] = useState(localDate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cashBills, setCashBills] = useState<CashBill[]>([])
  const [udhariJama, setUdhariJama] = useState<Payment[]>([])
  const [purchaseBills, setPurchaseBills] = useState<Purchase[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [suvidhaExpenses, setSuvidhaExpenses] = useState<SuvidhaExpense[]>([])
  const [suvidhaForm, setSuvidhaForm] = useState({ amount: '', description: '' })
  const [stockNotes, setStockNotes] = useState('')
  const [footerNotes, setFooterNotes] = useState('')
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [adjModal, setAdjModal] = useState<{ isOpen: boolean; type: 'in' | 'out' }>({
    isOpen: false,
    type: 'in',
  })
  const [adjForm, setAdjForm] = useState({ amount: '', reason: '' })
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)

  const readCurrentLocalData = useCallback((date: string) => {
    const data = readLocalData(date)
    setOpeningBalance(data.openingBalance)
    setSuvidhaExpenses(data.suvidhaExpenses)
    setStockNotes(data.stockNotes)
    setFooterNotes(data.footerNotes)
    setAdjustments(data.adjustments)
    setIsLocked(data.isLocked)
    setIsClosed(data.isClosed)
  }, [])

  const saveLocalData = useCallback((showToast = false) => {
    if (role !== 'admin') return
    try {
      setSaving(true)
      const data: BahiLocalData = {
        openingBalance,
        suvidhaExpenses,
        stockNotes,
        footerNotes,
        adjustments,
        isLocked,
        isClosed,
      }
      localStorage.setItem(getLocalKey(selectedDate), JSON.stringify(data))
      if (showToast) toast.success('बही का डेटा सेव हो गया।')
    } catch (error) {
      console.error('Bahi save error:', error)
      toast.error('बही सेव नहीं हुई। Browser storage जाँचें।')
    } finally {
      setSaving(false)
    }
  }, [
    role, selectedDate, openingBalance, suvidhaExpenses, stockNotes,
    footerNotes, adjustments, isLocked, isClosed,
  ])

  useEffect(() => {
    if (loading || authLoading || role !== 'admin') return
    const timer = window.setTimeout(() => saveLocalData(false), 700)
    return () => window.clearTimeout(timer)
  }, [
    openingBalance, suvidhaExpenses, stockNotes, footerNotes, adjustments,
    isLocked, isClosed, loading, authLoading, role, saveLocalData,
  ])

  const loadSupabaseData = useCallback(async (date: string) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const startOfDay = `${date}T00:00:00`
      const endOfDay = `${date}T23:59:59.999`
      const [salesResult, physicalResult, paymentsResult, purchasesResult] =
        await Promise.all([
          supabase.from('sales_bills').select('*')
            .in('bill_type', ['cash', 'CASH', 'Cash', 'nagad', 'NAGAD', 'Nagad'])
            .gte('bill_date', startOfDay).lte('bill_date', endOfDay)
            .order('bill_date', { ascending: false }),
          supabase.from('physical_bills').select('*')
            .gte('bill_date', startOfDay).lte('bill_date', endOfDay)
            .order('bill_date', { ascending: false }),
          supabase.from('payments').select('*')
            .eq('payment_date', date)
            .order('created_at', { ascending: false }),
          supabase.from('purchase_bills').select('*, companies(company_name)')
            .gte('bill_date', startOfDay).lte('bill_date', endOfDay)
            .order('bill_date', { ascending: false }),
        ])

      if (!mountedRef.current || requestId !== requestIdRef.current) return
      if (salesResult.error) console.error('Sales error:', salesResult.error)
      if (physicalResult.error) console.error('Physical error:', physicalResult.error)
      if (paymentsResult.error) console.error('Payments error:', paymentsResult.error)
      if (purchasesResult.error) console.error('Purchases error:', purchasesResult.error)

      const paymentData: any[] = paymentsResult.data ?? []
      const salesData: any[] = salesResult.data ?? []
      const physicalData: any[] = physicalResult.data ?? []
      const allFarmerIds = [...new Set([
        ...paymentData.map(r => r.farmer_id),
        ...salesData.map(r => r.farmer_id),
        ...physicalData.map(r => r.farmer_id),
      ].filter(id => id !== null && id !== undefined && id !== ''))]

      const farmerMap: Record<string, string> = {}
      if (allFarmerIds.length) {
        const byId = await supabase.from('farmers').select('*').in('id', allFarmerIds)
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        if (!byId.error && byId.data?.length) {
          byId.data.forEach((f: any) => {
            farmerMap[String(f.id)] = f.farmer_name || f.name || f.full_name || f.farmerName || ''
          })
        } else {
          const byFarmerId = await supabase.from('farmers').select('*').in('farmer_id', allFarmerIds)
          if (!mountedRef.current || requestId !== requestIdRef.current) return
          if (!byFarmerId.error && byFarmerId.data) {
            byFarmerId.data.forEach((f: any) => {
              farmerMap[String(f.farmer_id ?? f.id)] =
                f.farmer_name || f.name || f.full_name || f.farmerName || ''
            })
          }
        }
      }

      const resolveFarmerName = (row: any, fallback = 'Walk-in'): string => {
        const mapped = row.farmer_id ? farmerMap[String(row.farmer_id)] : ''
        if (mapped) return mapped
        for (const key of ['farmer_name', 'customer_name', 'payment_received_from', 'name']) {
          if (row[key] && String(row[key]).trim()) return String(row[key]).trim()
        }
        const nested = relationObject(row.farmers)
        const name = nested?.farmer_name || nested?.name || nested?.full_name
        return name ? String(name) : fallback
      }

      const standardRows: CashBill[] = salesData.map((row: any) => ({
        id: String(row.id),
        ref: String(row.bill_number ?? '—'),
        name: resolveFarmerName(row),
        amount: safeNum(row.total_amount ?? row.amount ?? row.final_amount),
        type: 'sale',
      }))
      const physicalRows: CashBill[] = physicalData
        .filter((row: any) => {
          const transactionType = String(row.transaction_type ?? '').trim().toLowerCase()
          const billType = String(row.bill_type ?? '').trim().toLowerCase()
          return ['cash', 'nagad'].includes(transactionType) || ['cash', 'nagad'].includes(billType)
        })
        .map((row: any) => ({
          id: String(row.id),
          ref: String(row.bill_number ?? '—'),
          name: resolveFarmerName(row),
          amount: safeNum(row.bill_amount ?? row.total_amount ?? row.amount),
          type: 'physical',
        }))
      setCashBills([...standardRows, ...physicalRows])

      const paymentRows: Payment[] = paymentData.map((row: any) => ({
        id: String(row.id),
        ref: String(row.receipt_number ?? row.payment_number ?? row.bill_number ??
          (row.id ? `PAY-${String(row.id).slice(0, 8)}` : '—')),
        farmer: resolveFarmerName(row, 'अज्ञात किसान'),
        amount: safeNum(row.payment_amount ?? row.amount ?? row.received_amount),
      }))
      setUdhariJama(paymentRows)

      const purchaseRows: Purchase[] = (purchasesResult.data ?? []).map((row: any) => {
        const company = relationObject(row.companies)
        return {
          id: String(row.id),
          ref: String(row.bill_number ?? '—'),
          company: company?.company_name || row.company_name || 'Unknown Company',
          amount: safeNum(row.total_amount ?? row.amount),
        }
      })
      setPurchaseBills(purchaseRows)
      if (paymentRows.length) {
        console.log('Payments loaded:', paymentRows.length, '| Sample farmer:', paymentRows[0]?.farmer)
      }
    } catch (error) {
      console.error('BahiKhata data loading error:', error)
      if (mountedRef.current && requestId === requestIdRef.current) {
        toast.error('बही खाता डेटा लोड करने में त्रुटि हुई।')
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (authLoading || role !== 'admin') return
    readCurrentLocalData(selectedDate)
    void loadSupabaseData(selectedDate)
  }, [selectedDate, role, authLoading, readCurrentLocalData, loadSupabaseData])

  const totalNagad = useMemo(() => cashBills.reduce((t, b) => t + safeNum(b.amount), 0), [cashBills])
  const totalUdhari = useMemo(() => udhariJama.reduce((t, p) => t + safeNum(p.amount), 0), [udhariJama])
  const totalSuvidha = useMemo(() => suvidhaExpenses.reduce((t, e) => t + safeNum(e.amount), 0), [suvidhaExpenses])
  const totalPurchase = useMemo(() => purchaseBills.reduce((t, p) => t + safeNum(p.amount), 0), [purchaseBills])
  const adjIn = useMemo(() => adjustments.filter(a => a.type === 'in').reduce((t, a) => t + safeNum(a.amount), 0), [adjustments])
  const adjOut = useMemo(() => adjustments.filter(a => a.type === 'out').reduce((t, a) => t + safeNum(a.amount), 0), [adjustments])
  const closingBalance = useMemo(
    () => Math.round((openingBalance + totalNagad + totalUdhari + adjIn - totalSuvidha - adjOut) * 100) / 100,
    [openingBalance, totalNagad, totalUdhari, adjIn, totalSuvidha, adjOut],
  )

  const handleAddSuvidha = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLocked || isClosed) return toast.error('बही लॉक है।')
    const amount = safeNum(suvidhaForm.amount)
    const description = suvidhaForm.description.trim()
    if (amount <= 0) return toast.error('सही रकम दर्ज करें।')
    if (!description) return toast.error('विवरण लिखना अनिवार्य है।')
    setSuvidhaExpenses(prev => [...prev, {
      id: genId(), amount, description,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }])
    setSuvidhaForm({ amount: '', description: '' })
    toast.success('खर्च जोड़ दिया गया।')
  }

  const deleteSuvidha = (id: string) => {
    if (isLocked || isClosed) return
    if (!window.confirm('इस खर्च को हटाना है?')) return
    setSuvidhaExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('खर्च हटा दिया गया।')
  }

  const handleAddAdjustment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLocked || isClosed) return toast.error('बही लॉक है। पहले अनलॉक करें।')
    const amount = safeNum(adjForm.amount)
    const reason = adjForm.reason.trim()
    if (amount <= 0) return toast.error('कृपया सही रकम दर्ज करें।')
    if (!reason) return toast.error('रकम का कारण लिखना अनिवार्य है।')
    setAdjustments(prev => [...prev, {
      id: genId(), type: adjModal.type, amount, reason,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }])
    setAdjForm({ amount: '', reason: '' })
    setAdjModal({ isOpen: false, type: 'in' })
    toast.success(adjModal.type === 'in' ? 'रोकड़ जमा की एंट्री जोड़ दी गई।' : 'रोकड़ निकासी की एंट्री जोड़ दी गई।')
  }

  const deleteAdjustment = (id: string) => {
    if (isLocked || isClosed) return
    if (!window.confirm('क्या आप इस एंट्री को हटाना चाहते हैं?')) return
    setAdjustments(prev => prev.filter(a => a.id !== id))
    toast.success('एडजस्टमेंट हटा दिया गया।')
  }

  const handleCloseLedger = () => {
    if (isClosed) return toast.error('यह बही पहले से बंद है।')
    if (!window.confirm('क्या आप आज की बही बंद करना चाहते हैं? अंतिम गल्ला अगले दिन के Opening Balance में दर्ज होगा।')) return
    try {
      const nextDate = getNextDate(selectedDate)
      const currentData: BahiLocalData = {
        openingBalance, suvidhaExpenses, stockNotes, footerNotes, adjustments,
        isLocked: true, isClosed: true,
      }
      localStorage.setItem(getLocalKey(selectedDate), JSON.stringify(currentData))
      const nextDayAlreadyExists = localStorage.getItem(getLocalKey(nextDate))
      if (!nextDayAlreadyExists) localStorage.setItem(getOpeningKey(nextDate), String(closingBalance))
      setIsClosed(true)
      setIsLocked(true)
      toast.success(`बही बंद हो गई। ${nextDate} की Opening Balance ${nextDayAlreadyExists ? 'पहले से मौजूद है।' : 'तैयार कर दी गई है।'}`)
    } catch (error) {
      console.error('Close ledger error:', error)
      toast.error('बही बंद नहीं हो सकी।')
    }
  }

  const handleUnlock = () => {
    if (!window.confirm('क्या आप बही को फिर से खोलना चाहते हैं? अगले दिन का Opening Balance अपने आप नहीं बदलेगा।')) return
    setIsLocked(false)
    setIsClosed(false)
    toast.success('बही एडिट मोड में खोल दी गई।')
  }

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.setTextColor(125, 25, 45)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('|| Shree Ganeshay Namah ||', pageWidth / 2, 10, { align: 'center' })
      doc.setFontSize(8)
      doc.text('|| Shree Lakshmi Narayan Ji Maharaj, Sada Sahay Karo Karobar ||', pageWidth / 2, 15, { align: 'center' })
      doc.setFontSize(15)
      doc.text('SATGURU BEEJ BHANDAR - DAILY BAHI KHATA', pageWidth / 2, 22, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 50, 50)
      doc.text(`Date: ${selectedDate}`, pageWidth / 2, 28, { align: 'center' })

      const rowCount = Math.max(cashBills.length, suvidhaExpenses.length + adjustments.length, purchaseBills.length, udhariJama.length, 1)
      const tableBody: string[][] = []
      for (let i = 0; i < rowCount; i++) {
        const cash = cashBills[i]
        const expense = suvidhaExpenses[i]
        const adjustment = adjustments[i - suvidhaExpenses.length]
        const purchase = purchaseBills[i]
        const payment = udhariJama[i]
        let expenseText = ''
        if (expense) expenseText = `${expense.description} - Rs. ${formatINR(expense.amount)}`
        else if (adjustment) expenseText = `${adjustment.type === 'in' ? 'CASH IN' : 'CASH OUT'} Rs. ${formatINR(adjustment.amount)} - ${adjustment.reason}`
        tableBody.push([
          cash ? `${cash.name} (${cash.ref}) - Rs. ${formatINR(cash.amount)}` : '',
          expenseText,
          purchase ? `${purchase.company} (${purchase.ref}) - Rs. ${formatINR(purchase.amount)}` : '',
          payment ? `${payment.farmer} (${payment.ref}) - Rs. ${formatINR(payment.amount)}` : '',
        ])
      }

      autoTable(doc, {
        startY: 33,
        head: [['Cash / Nagad Sales', 'Suvidha / Adjustments', 'Purchase Bills', 'Farmer Payments']],
        body: tableBody,
        theme: 'grid',
        tableWidth: pageWidth - 20,
        margin: { left: 10, right: 10, bottom: 18 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top', lineColor: [225, 210, 200], lineWidth: 0.15 },
        headStyles: { fillColor: [112, 24, 43], textColor: [255, 244, 214], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: (pageWidth - 20) / 4 },
          1: { cellWidth: (pageWidth - 20) / 4 },
          2: { cellWidth: (pageWidth - 20) / 4 },
          3: { cellWidth: (pageWidth - 20) / 4 },
        },
      })

      let y = ((doc as any).lastAutoTable?.finalY ?? 40) + 6
      const pageHeight = doc.internal.pageSize.getHeight()
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 14
      }
      doc.setFontSize(8)
      doc.text(`Opening: Rs. ${formatINR(openingBalance)} | Cash/Nagad: Rs. ${formatINR(totalNagad)} | Farmer Payments: Rs. ${formatINR(totalUdhari)}`, 10, y)
      doc.text(`Suvidha: Rs. ${formatINR(totalSuvidha)} | Cash In: Rs. ${formatINR(adjIn)} | Cash Out: Rs. ${formatINR(adjOut)} | Purchase Bills: Rs. ${formatINR(totalPurchase)}`, 10, y + 5)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(112, 24, 43)
      doc.text(`FINAL GALLA BALANCE: Rs. ${formatINR(closingBalance)}`, 10, y + 12)
      if (stockNotes.trim()) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(50, 50, 50)
        const lines = doc.splitTextToSize(`Stock Notes: ${stockNotes}`, pageWidth - 20)
        doc.text(lines, 10, y + 19)
      }
      if (footerNotes.trim()) {
        doc.addPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Special Notes', 10, 15)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(doc.splitTextToSize(footerNotes, pageWidth - 20), 10, 23)
      }
      doc.save(`Bahi_Khata_${selectedDate}.pdf`)
      toast.success('PDF डाउनलोड शुरू हो गया।')
    } catch (error) {
      console.error('Bahi PDF error:', error)
      toast.error('PDF बनाने में त्रुटि हुई।')
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><Loader2 className="animate-spin text-rose-900" size={36} /></div>
  }
  if (role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6"><div className="rounded-2xl bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto mb-3 text-rose-800" size={38} /><h2 className="text-xl font-black text-stone-800">Access Denied</h2><p className="mt-2 text-stone-500">केवल Admin बही खाता खोल सकता है।</p></div></div>
  }

  const editable = !isLocked && !isClosed
  const hasOpeningTransfer = localStorage.getItem(getOpeningKey(selectedDate)) !== null

  const statCard = (title: string, value: number, icon: React.ReactNode, tone: string, note: string) => (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p>
          <p className="mt-2 break-words text-xl font-black tracking-tight text-stone-900 sm:text-2xl">{money(value)}</p>
          <p className="mt-1 text-xs text-stone-500">{note}</p>
        </div>
        <div className={`rounded-xl p-3 ${tone}`}>{icon}</div>
      </div>
    </div>
  )

  const sectionClass = 'flex min-h-[430px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm'
  const sectionHeader = 'flex items-center gap-3 border-b border-stone-100 bg-white px-4 py-4'
  const inputClass = 'w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100 disabled:bg-stone-100 disabled:text-stone-500'

  return (
    <div className="min-h-screen bg-[#f6f4f1] px-3 py-4 text-stone-800 sm:px-5 lg:px-7">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 7mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          .bahi-print-grid { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 5px !important; }
          .bahi-print-card { min-height: 100mm !important; height: auto !important; max-height: none !important; break-inside: avoid; box-shadow: none !important; }
          .bahi-scroll { overflow: visible !important; max-height: none !important; }
          input, textarea { border: none !important; background: transparent !important; }
          .no-print-shadow { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-r from-[#401522] via-[#681d32] to-[#8b3041] text-white shadow-xl shadow-rose-950/10">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[30px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-amber-300/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 p-5 sm:p-7 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
              <Sprout size={14} /> Daily Accounts · Satguru
            </div>
            <p className="text-sm font-semibold text-rose-100">॥ श्री गणेशाय नमः ॥</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">सतगुरु बीज भण्डार</h1>
            <p className="mt-2 text-sm text-rose-100/85">दैनिक बही खाता <span className="mx-2 text-amber-300">•</span> Daily Cash & Ledger Register</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${isClosed ? 'bg-stone-200 text-stone-800' : isLocked ? 'bg-amber-200 text-amber-950' : 'bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-200/25'}`}>
                {isClosed ? <FileCheck size={14} /> : isLocked ? <Lock size={14} /> : <CircleCheck size={14} />}
                {isClosed ? 'CLOSED' : isLocked ? 'LOCKED' : 'OPEN · EDITABLE'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                <CalendarDays size={14} /> {dateLabel(selectedDate)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="बही की तारीख"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-bold text-white outline-none [color-scheme:dark] focus:border-amber-300"
              />
              <button onClick={() => void loadSupabaseData(selectedDate)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-bold transition hover:bg-white/20 disabled:opacity-50" title="डेटा Refresh करें">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={() => saveLocalData(true)} disabled={saving || !editable} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-sm font-black text-rose-950 transition hover:bg-amber-200 disabled:opacity-50" title="बही सेव करें">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}<span className="hidden sm:inline">Save</span>
              </button>
              <button onClick={handleDownloadPDF} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-rose-950 transition hover:bg-rose-50" title="PDF डाउनलोड करें">
                <Download size={16} /><span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-transparent px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/10" title="Print">
                <Printer size={16} /><span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 print-hidden">
          <Loader2 size={17} className="animate-spin" /> Supabase से आज का डेटा लोड हो रहा है…
        </div>
      )}

      {/* Summary cards */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCard('आरंभिक रोकड़', openingBalance, <Wallet size={21} />, 'bg-violet-50 text-violet-700', 'Opening cash balance')}
        {statCard('नकद / नगद बिक्री', totalNagad, <Banknote size={21} />, 'bg-emerald-50 text-emerald-700', `${cashBills.length} बिल / एंट्री`)}
        {statCard('किसान से उधारी जमा', totalUdhari, <TrendingUp size={21} />, 'bg-sky-50 text-sky-700', `${udhariJama.length} भुगतान / रसीद`)}
        {statCard('आज का अंतिम गल्ला', closingBalance, <ReceiptText size={21} />, 'bg-amber-50 text-amber-800', 'Calculated closing balance')}
      </section>

      {/* Main ledger columns */}
      <div className="bahi-print-grid mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {/* Cash sales */}
        <section className={`${sectionClass} bahi-print-card`}>
          <div className={sectionHeader}>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Banknote size={21} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-stone-900">नकद / नगद जमा</h2>
              <p className="text-xs text-stone-500">Cash & Nagad Sales</p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{cashBills.length}</span>
          </div>
          <div className="bahi-scroll flex-1 space-y-2 overflow-auto p-3">
            {cashBills.length === 0 ? <EmptyState loading={loading} text="आज कोई नकद बिल नहीं" /> : cashBills.map(bill => (
              <div key={`${bill.type}-${bill.id}`} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-800">{bill.name}</p>
                  <p className="mt-1 truncate text-[11px] text-stone-500">{bill.ref} <span className="mx-1">·</span>{bill.type === 'physical' ? 'Physical bill' : 'Sales bill'}</p>
                </div>
                <span className="shrink-0 text-sm font-black text-emerald-700">{money(bill.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-emerald-100 bg-emerald-50/80 px-4 py-3">
            <span className="text-sm font-bold text-stone-600">कुल नकद</span><span className="text-base font-black text-emerald-800">{money(totalNagad)}</span>
          </div>
        </section>

        {/* Expenses */}
        <section className={`${sectionClass} bahi-print-card`}>
          <div className={sectionHeader}>
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-700"><TrendingDown size={21} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-stone-900">सुविधा / खर्च</h2>
              <p className="text-xs text-stone-500">Expenses & Cash Adjustments</p>
            </div>
            <div className="flex gap-1 print-hidden">
              <button disabled={!editable} onClick={() => setAdjModal({ isOpen: true, type: 'in' })} className="rounded-lg bg-emerald-100 p-2 text-emerald-800 transition hover:bg-emerald-200 disabled:opacity-40" title="रोकड़ जमा"><PlusCircle size={17} /></button>
              <button disabled={!editable} onClick={() => setAdjModal({ isOpen: true, type: 'out' })} className="rounded-lg bg-rose-100 p-2 text-rose-800 transition hover:bg-rose-200 disabled:opacity-40" title="रोकड़ निकासी"><MinusCircle size={17} /></button>
            </div>
          </div>
          <form onSubmit={handleAddSuvidha} className="space-y-2 border-b border-stone-100 bg-amber-50/60 p-3 print-hidden">
            <div className="flex gap-2">
              <div className="relative w-[105px] shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-stone-400">₹</span>
                <input type="number" min="1" step="1" required disabled={!editable} value={suvidhaForm.amount} onChange={e => setSuvidhaForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className={`${inputClass} pl-7`} />
              </div>
              <input type="text" required disabled={!editable} value={suvidhaForm.description} onChange={e => setSuvidhaForm(p => ({ ...p, description: e.target.value }))} placeholder="खर्च का विवरण…" className={inputClass} />
              <button type="submit" disabled={!editable} className="shrink-0 rounded-xl bg-rose-900 px-3 text-white transition hover:bg-rose-800 disabled:opacity-40" title="खर्च जोड़ें"><PlusCircle size={19} /></button>
            </div>
          </form>
          <div className="bahi-scroll flex-1 space-y-2 overflow-auto p-3">
            {suvidhaExpenses.length === 0 && adjustments.length === 0 ? <EmptyState loading={false} text="अभी कोई खर्च नहीं जोड़ा गया" /> : null}
            {suvidhaExpenses.map(expense => (
              <div key={expense.id} className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-stone-800">{expense.description}</p>{expense.time && <p className="mt-1 text-[10px] text-stone-500">{expense.time}</p>}</div>
                <span className="shrink-0 text-sm font-black text-rose-700">−{money(expense.amount)}</span>
                {editable && <button onClick={() => deleteSuvidha(expense.id)} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-100 hover:text-rose-700 print-hidden" title="खर्च हटाएँ"><Trash2 size={14} /></button>}
              </div>
            ))}
            {adjustments.map(adj => (
              <div key={adj.id} className={`flex items-center gap-2 rounded-xl border p-3 ${adj.type === 'in' ? 'border-emerald-100 bg-emerald-50/70' : 'border-rose-100 bg-rose-50/70'}`}>
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-stone-800">{adj.reason}</p><p className="mt-1 text-[10px] text-stone-500">{adj.type === 'in' ? 'रोकड़ जमा' : 'रोकड़ निकासी'}{adj.time ? ` · ${adj.time}` : ''}</p></div>
                <span className={`shrink-0 text-sm font-black ${adj.type === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{adj.type === 'in' ? '+' : '−'}{money(adj.amount)}</span>
                {editable && <button onClick={() => deleteAdjustment(adj.id)} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-100 hover:text-rose-700 print-hidden" title="एंट्री हटाएँ"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-rose-100 bg-rose-50/70 px-4 py-3">
            <span className="text-sm font-bold text-stone-600">कुल सुविधा खर्च</span><span className="text-base font-black text-rose-800">−{money(totalSuvidha)}</span>
          </div>
        </section>

        {/* Purchases */}
        <section className={`${sectionClass} bahi-print-card`}>
          <div className={sectionHeader}>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Package size={21} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-stone-900">सामान आया</h2>
              <p className="text-xs text-stone-500">Purchase Bills & Stock Notes</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{purchaseBills.length}</span>
          </div>
          <div className="bahi-scroll max-h-[255px] flex-1 space-y-2 overflow-auto p-3">
            {purchaseBills.length === 0 ? <EmptyState loading={loading} text="आज कोई खरीद बिल नहीं" /> : purchaseBills.map(bill => (
              <div key={bill.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-stone-800">{bill.company}</p><p className="mt-1 truncate text-[11px] text-stone-500">{bill.ref}</p></div>
                <span className="shrink-0 text-sm font-black text-blue-700">{money(bill.amount)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-100 p-3">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">स्टॉक / अन्य विवरण</label>
            <textarea disabled={!editable} value={stockNotes} onChange={e => setStockNotes(e.target.value)} placeholder="आज आए सामान या स्टॉक से जुड़ी टिप्पणी…" className={`${inputClass} min-h-[105px] resize-y leading-6`} />
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-blue-100 bg-blue-50/70 px-4 py-3">
            <span className="text-sm font-bold text-stone-600">कुल खरीद</span><span className="text-base font-black text-blue-800">{money(totalPurchase)}</span>
          </div>
        </section>

        {/* Farmer payments */}
        <section className={`${sectionClass} bahi-print-card`}>
          <div className={sectionHeader}>
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Sprout size={21} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-stone-900">उधारी जमा</h2>
              <p className="text-xs text-stone-500">Farmer Payments Received</p>
            </div>
            <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">{udhariJama.length}</span>
          </div>
          <div className="bahi-scroll flex-1 space-y-2 overflow-auto p-3">
            {udhariJama.length === 0 ? <EmptyState loading={loading} text="आज कोई उधारी जमा नहीं" /> : udhariJama.map(payment => (
              <div key={payment.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-800">{payment.farmer.trim().slice(0, 1) || 'क'}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-stone-800">{payment.farmer}</p><p className="mt-1 truncate text-[11px] text-stone-500">रसीद: {payment.ref}</p></div>
                <span className="shrink-0 text-sm font-black text-emerald-700">+{money(payment.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-sky-100 bg-sky-50/70 px-4 py-3">
            <span className="text-sm font-bold text-stone-600">कुल उधारी जमा</span><span className="text-base font-black text-emerald-800">+{money(totalUdhari)}</span>
          </div>
        </section>
      </div>

      {/* Closing balance panel */}
      <section className="mb-5 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm no-print-shadow">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr]">
          <div className="border-b border-stone-100 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-stone-700"><Wallet size={18} className="text-rose-800" /> आरंभिक रोकड़ (Opening Balance)</div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-stone-400">₹</span>
                <input type="number" min="0" step="0.01" disabled={!editable} value={openingBalance || ''} onChange={e => setOpeningBalance(safeNum(e.target.value))} placeholder="0.00" className={`${inputClass} py-3 pl-10 text-xl font-black`} />
              </div>
              {hasOpeningTransfer && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CircleCheck size={14} /> पिछली बही से प्राप्त</span>}
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-500">आरंभिक रोकड़ में पिछले दिन का अंतिम गल्ला शामिल करें।</p>
          </div>
          <div className="bg-gradient-to-br from-[#fffaf0] to-[#f8e9d7] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-800/70">Final Galla Balance</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-[#651c30] sm:text-4xl">{money(closingBalance)}</h2>
                <p className="mt-2 max-w-lg text-xs leading-5 text-stone-600">Opening + Cash/Nagad + Farmer Payments + Cash In − Suvidha − Cash Out</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                <MiniAmount label="रोकड़ ज्यादा" value={adjIn} positive />
                <MiniAmount label="रोकड़ कम" value={adjOut} />
                <MiniAmount label="सुविधा खर्च" value={totalSuvidha} />
                <MiniAmount label="कुल खरीद" value={totalPurchase} neutral />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><ReceiptText size={18} /></div>
          <div><h2 className="font-black text-stone-900">विशेष टिप्पणी</h2><p className="text-xs text-stone-500">Daily notes / follow-up</p></div>
        </div>
        <textarea disabled={!editable} value={footerNotes} onChange={e => setFooterNotes(e.target.value)} placeholder="आज की बही के लिए कोई विशेष टिप्पणी लिखें…" className="min-h-[100px] w-full resize-y border-0 bg-transparent p-4 text-sm leading-6 outline-none placeholder:text-stone-400 disabled:bg-stone-50" />
      </section>

      {/* Bottom actions */}
      <div className="print-hidden mb-8 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-stone-500"><ShieldCheck size={17} className="text-emerald-700" /><span>यह बही इस ब्राउज़र के Local Storage में सेव होती है। नियमित रूप से PDF बैकअप रखें।</span></div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <button onClick={() => { setIsLocked(true); toast.success('बही लॉक कर दी गई है।') }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-900 transition hover:bg-amber-100"><Lock size={17} /> बही लॉक करें</button>
              <button onClick={handleCloseLedger} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-rose-800"><FileCheck size={17} /> बही बंद करें</button>
            </>
          ) : (
            <button onClick={handleUnlock} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"><Unlock size={17} /> बही फिर खोलें</button>
          )}
        </div>
      </div>

      {/* Adjustment modal */}
      {adjModal.isOpen && (
        <div className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className={`flex items-center justify-between px-5 py-4 text-white ${adjModal.type === 'in' ? 'bg-emerald-700' : 'bg-rose-800'}`}>
              <div><p className="text-xs font-bold uppercase tracking-widest text-white/70">Cash adjustment</p><h3 className="mt-1 text-lg font-black">{adjModal.type === 'in' ? 'रोकड़ ज्यादा (Cash In)' : 'रोकड़ कम (Cash Out)'}</h3></div>
              <button onClick={() => setAdjModal({ isOpen: false, type: 'in' })} className="rounded-xl p-2 transition hover:bg-white/15" title="बंद करें"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddAdjustment} className="space-y-4 p-5">
              <div><label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-stone-500">रकम (Amount) *</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-stone-400">₹</span><input type="number" min="0.01" step="0.01" required autoFocus value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} className={`${inputClass} pl-8 text-lg`} placeholder="0.00" /></div></div>
              <div><label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-stone-500">कारण / टिप्पणी *</label><input type="text" required value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} className={inputClass} placeholder="रकम का कारण लिखें…" /></div>
              <div className="flex gap-2 pt-1"><button type="button" onClick={() => setAdjModal({ isOpen: false, type: 'in' })} className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600 hover:bg-stone-50">रद्द करें</button><button type="submit" className={`flex-1 rounded-xl px-4 py-3 text-sm font-black text-white ${adjModal.type === 'in' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-800 hover:bg-rose-900'}`}>एंट्री जोड़ें</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ loading, text }: { loading: boolean; text: string }) {
  return (
    <div className="flex min-h-[125px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-7 text-center">
      <div className="mb-2 rounded-full bg-white p-3 text-stone-300 shadow-sm">{loading ? <Loader2 size={20} className="animate-spin" /> : <ReceiptText size={20} />}</div>
      <p className="text-xs font-semibold text-stone-400">{loading ? 'डेटा लोड हो रहा है…' : text}</p>
    </div>
  )
}

function MiniAmount({ label, value, positive = false, neutral = false }: { label: string; value: number; positive?: boolean; neutral?: boolean }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/75 p-3">
      <p className="text-[10px] font-bold text-stone-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-black ${positive ? 'text-emerald-700' : neutral ? 'text-blue-700' : 'text-rose-700'}`}>{money(value)}</p>
    </div>
  )
}
