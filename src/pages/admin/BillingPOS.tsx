// src/pages/admin/BillingPOS.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FormEvent,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Receipt,
  Plus,
  Trash2,
  Printer,
  Loader2,
  Download,
  ShieldAlert,
  X,
  Wallet,
  CreditCard,
  FileText,
  Share2,
  Search,
  Camera,
  UploadCloud,
  Eye,
  FileSpreadsheet,
  Calendar,
  IndianRupee,
  CheckCircle2,
  Layers,
  Pencil,
  ArrowLeftRight,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { SalesBillTemplate, BillTemplateData } from '../../components/SalesBillTemplate'
import { round2, safeNum as libSafeNum } from '../../lib/round'

// ─── Interfaces ──────────────────────────────────────────────────────────

interface CreditAccount {
  id?: string
  current_outstanding?: number | string | null
  available_credit?: number | string | null
  credit_limit?: number | string | null
}

interface Farmer {
  id: string
  farmer_id: string
  farmer_name: string
  father_name?: string | null
  village?: string | null
  mobile?: string | null
  credit_limit?: number | string | null
  outstanding_balance?: number | string | null
  credit_accounts?: CreditAccount[] | CreditAccount | null
}

interface FarmerGroup {
  id: string
  group_id: string
  group_name: string
  credit_limit?: number | string | null
}

interface Product {
  id: string
  product_name: string
  gst_percent?: number | null
  hsn_code?: string | null
  company_id?: string | null
  pack_size?: number | null
  pack_unit?: string | null
  company?: { company_name: string } | null
}

interface Batch {
  id: string
  product_id: string
  batch_number: string
  quantity_available: number | string
  selling_rate: number | string
  expiry_date: string
  company_id?: string | null
  created_at?: string | null
}

interface BillItem {
  _uid: string
  product_id: string
  batch_id: string
  available_qty: number
  original_qty: number    // ⭐ FIX #1: track original qty for edit mode
  quantity: number
  rate: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  total_amount: number
  expiry_date: string
  batch_number: string
  company_id?: string | null
  gst_percent: number
  hsn_code?: string
  product_name?: string
}

type BillMode = 'udhaar' | 'cash'
type DocType = 'estimate' | 'gst'
type PosBillingType = 'standard' | 'physical'

interface PhysicalBillSuccessData {
  farmerName: string
  billNumber: string
  billType: DocType
  transactionType: BillMode
  billAmount: number
  previousOutstanding: number
  newOutstanding: number
}

interface EditSearchResult {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number
  bill_type: string
  is_gst_bill?: boolean
  transaction_type?: string
  bill_type_phys?: string
  farmer_id: string
  edit_count: number
  source: 'standard' | 'physical'
  farmer?: { farmer_name: string; farmer_id: string } | null
  farmers?: { farmer_name: string; farmer_id: string } | null
}

interface OriginalBillSnapshot {
  total: number
  billType: string
  docType: string
  billNumber: string
  itemCount: number
  farmerName: string
}

// ─── Utilities ───────────────────────────────────────────────────────────

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'uid_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

function safeNum(val: unknown): number {
  return libSafeNum(val)
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown Error'
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(' | ')
  }
  if (typeof err === 'string') return err
  return 'Unknown Error'
}

// ⭐ FIX #4: Kolkata TZ date
function getKolkataDate(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// ⭐ FIX #3: detect PDF from path/url
function isPdfPath(p: string | null | undefined): boolean {
  if (!p) return false
  return /\.pdf($|\?)/i.test(p)
}

// ⭐ FIX #7: WhatsApp phone normalizer (same as PrintableBill)
function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = String(raw).replace(/[^\d+]/g, '')
  if (!cleaned) return null
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1)
    if (digits.length < 8 || digits.length > 15) return null
    return digits
  }
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  if (digits.length >= 8 && digits.length <= 15) return digits
  return null
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const EMPTY_ROW = (): BillItem => ({
  _uid: safeUUID(),
  product_id: '',
  batch_id: '',
  available_qty: 0,
  original_qty: 0,
  quantity: 1,
  rate: 0,
  taxable_amount: 0,
  cgst_amount: 0,
  sgst_amount: 0,
  total_amount: 0,
  expiry_date: '',
  batch_number: '',
  company_id: null,
  gst_percent: 0,
  hsn_code: '',
})

export default function BillingPOS() {
  const { role, loading: authLoading } = useAuth()
  const isAdmin = role === 'admin'

  // Master Data
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [groups, setGroups] = useState<FarmerGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([])
  const [mastersLoading, setMastersLoading] = useState<boolean>(true)

  // Primary Mode Selector
  const [posMode, setPosMode] = useState<PosBillingType>('standard')

  // Common Header State
  const [billMode, setBillMode] = useState<BillMode>('udhaar')
  const [docType, setDocType] = useState<DocType>('estimate')
  const [billTargetType, setBillTargetType] = useState<'farmer' | 'group'>('farmer')
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<FarmerGroup | null>(null)

  // Farmer Search Dropdown
  const [farmerSearch, setFarmerSearch] = useState('')
  const [isFarmerDropdownOpen, setIsFarmerDropdownOpen] = useState(false)
  const farmerSearchRef = useRef<HTMLDivElement>(null)

  // Mode A: Standard Digital Bill State
  const [billItems, setBillItems] = useState<BillItem[]>([EMPTY_ROW()])
  const [saving, setSaving] = useState<boolean>(false)
  const [createdBill, setCreatedBill] = useState<BillTemplateData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false)
  const [pdfProcessing, setPdfProcessing] = useState<boolean>(false)

  // Mode B: Physical Bill State
  const [physicalBillDate, setPhysicalBillDate] = useState<string>(() => getKolkataDate())
  const [physicalBillNumber, setPhysicalBillNumber] = useState<string>('')
  const [physicalBillAmount, setPhysicalBillAmount] = useState<string>('')
  const [physicalNotes, setPhysicalNotes] = useState<string>('')
  const [physicalFile, setPhysicalFile] = useState<File | null>(null)
  const [physicalFilePreview, setPhysicalFilePreview] = useState<string | null>(null)
  const [physicalFileIsPdf, setPhysicalFileIsPdf] = useState<boolean>(false) // ⭐ FIX #3
  const [physicalFileError, setPhysicalFileError] = useState<string | null>(null)
  const [physicalSaving, setPhysicalSaving] = useState<boolean>(false)
  const [physicalFormErrors, setPhysicalFormErrors] = useState<Record<string, string>>({})
  const [physicalSuccessData, setPhysicalSuccessData] = useState<PhysicalBillSuccessData | null>(null)

  const [previewDocModalOpen, setPreviewDocModalOpen] = useState<boolean>(false)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const isMounted = useRef<boolean>(true)
  const saveLockRef = useRef<boolean>(false)

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editingBillSource, setEditingBillSource] = useState<'standard' | 'physical' | null>(null)
  const [editSearchOpen, setEditSearchOpen] = useState(false)
  const [editSearchQuery, setEditSearchQuery] = useState('')
  const [editSearchResults, setEditSearchResults] = useState<EditSearchResult[]>([])
  const [editSearching, setEditSearching] = useState(false)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [originalBill, setOriginalBill] = useState<OriginalBillSnapshot | null>(null)
  const editSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (farmerSearchRef.current && !farmerSearchRef.current.contains(event.target as Node)) {
        setIsFarmerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleModeToggle = (mode: PosBillingType) => {
    if (mode === posMode) return
    if (isEditMode) return toast.error('Edit mode active hone par mode change nahi kar sakte!')
    setPosMode(mode)
    setSelectedFarmer(null)
    setSelectedGroup(null)
    setFarmerSearch('')
    setPhysicalSuccessData(null)
  }

  const loadBillingMasters = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setMastersLoading(true)

      const [fRes, gRes, pRes, bRes] = await Promise.all([
        supabase.from('farmers').select('*, credit_accounts(*)').eq('account_status', 'active').order('farmer_name'),
        supabase.from('farmer_groups').select('*'),
        supabase.from('products').select('*, company:companies(company_name)').eq('is_active', true),
        supabase
          .from('inventory_batches')
          .select('*')
          .gt('quantity_available', 0)
          .eq('is_expired', false)
          .eq('is_blocked', false)
          .order('expiry_date', { ascending: true }),
      ])

      if (fRes.error) throw fRes.error
      if (gRes.error) throw gRes.error
      if (pRes.error) throw pRes.error
      if (bRes.error) throw bRes.error

      if (isMounted.current) {
        setFarmers((fRes.data as Farmer[]) || [])
        setGroups((gRes.data as FarmerGroup[]) || [])
        setProducts((pRes.data as Product[]) || [])
        setAvailableBatches((bRes.data as Batch[]) || [])
      }
    } catch {
      if (isMounted.current) toast.error('Master data load nahi ho paya.')
    } finally {
      if (isMounted.current) setMastersLoading(false)
    }
  }, [role])

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) {
      setMastersLoading(false)
      return
    }
    void loadBillingMasters()
  }, [loadBillingMasters, isAdmin, authLoading])

  const batchesByProduct = useMemo(() => {
    const map = new Map<string, Batch[]>()
    availableBatches.forEach((b) => {
      if (!map.has(b.product_id)) map.set(b.product_id, [])
      map.get(b.product_id)!.push(b)
    })
    map.forEach((arr) =>
      arr.sort((a, b) => {
        const byExpiry = (a.expiry_date || '').localeCompare(b.expiry_date || '')
        if (byExpiry !== 0) return byExpiry
        return (a.created_at || '').localeCompare(b.created_at || '')
      })
    )
    return map
  }, [availableBatches])

  const getTotalAvailableForProduct = useCallback(
    (productId: string): number => {
      const arr = batchesByProduct.get(productId) || []
      return arr.reduce((sum, b) => sum + safeNum(b.quantity_available), 0)
    },
    [batchesByProduct]
  )

  const getFarmerCreditDetails = (f: Farmer | null) => {
    if (!f) return { outstanding: 0, available: 0, creditLimit: 0 }
    const acc = Array.isArray(f.credit_accounts) ? f.credit_accounts[0] : f.credit_accounts
    const outstanding =
      acc?.current_outstanding !== null && acc?.current_outstanding !== undefined
        ? round2(safeNum(acc.current_outstanding))
        : round2(safeNum(f.outstanding_balance))
    const limit = safeNum(f.credit_limit ?? acc?.credit_limit ?? 0)
    const available = acc?.available_credit != null ? safeNum(acc.available_credit) : Math.max(0, limit - outstanding)
    return { outstanding, available, creditLimit: limit }
  }

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase()
    if (!q) return farmers.slice(0, 50)
    return farmers.filter((f) => {
      const name = (f.farmer_name || '').toLowerCase()
      const fid = (f.farmer_id || '').toLowerCase()
      const father = (f.father_name || '').toLowerCase()
      const village = (f.village || '').toLowerCase()
      const mobile = (f.mobile || '').toLowerCase()
      return name.includes(q) || fid.includes(q) || father.includes(q) || village.includes(q) || mobile.includes(q)
    })
  }, [farmers, farmerSearch])

  const calculateRowTotals = useCallback((row: BillItem, isGst: boolean): BillItem => {
    const qty = safeNum(row.quantity)
    const rate = safeNum(row.rate)
    const total = qty * rate

    let taxable = total
    let cgst = 0
    let sgst = 0

    if (isGst && row.gst_percent > 0) {
      // Rate is GST-inclusive: Taxable + CGST + SGST = Grand Total (IGST 0, intra-state 50/50)
      taxable = round2((total * 100) / (100 + row.gst_percent))
      const totalGst = round2(total - taxable)
      cgst = round2(totalGst / 2)
      sgst = round2(totalGst - cgst)
    }

    return {
      ...row,
      taxable_amount: isGst ? taxable : round2(total),
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: round2(total),
    }
  }, [])

  useEffect(() => {
    if (posMode === 'standard') {
      setBillItems((prev) => prev.map((item) => calculateRowTotals(item, docType === 'gst')))
    }
  }, [docType, posMode, calculateRowTotals])

  const handleProductSelect = (index: number, prodId: string) => {
    const productBatches = batchesByProduct.get(prodId) || []
    const totalAvailable = productBatches.reduce((s, b) => s + safeNum(b.quantity_available), 0)

    if (totalAvailable === 0 && prodId && !isEditMode) {
      toast.error('इस उत्पाद का कोई एक्टिव स्टॉक बैच उपलब्ध नहीं है!')
    }

    setBillItems((prev) => {
      const updated = [...prev]
      const row = { ...updated[index], product_id: prodId }

      if (productBatches.length > 0) {
        const feFoBatch = productBatches[0]
        const prodObj = products.find((p) => p.id === prodId)
        row.batch_id = feFoBatch.id
        row.available_qty = totalAvailable
        row.original_qty = 0 // fresh product, no original
        row.rate = safeNum(feFoBatch.selling_rate)
        row.expiry_date = feFoBatch.expiry_date || ''
        row.batch_number = feFoBatch.batch_number || ''
        row.company_id = feFoBatch.company_id || prodObj?.company_id || null
        row.quantity = 1
        row.gst_percent = safeNum(prodObj?.gst_percent)
        row.hsn_code = prodObj?.hsn_code || ''
        row.product_name = prodObj?.product_name || ''
      } else {
        row.batch_id = ''
        row.available_qty = 0
        row.original_qty = 0
        row.rate = 0
        row.gst_percent = 0
        row.hsn_code = ''
        row.product_name = ''
      }

      updated[index] = calculateRowTotals(row, docType === 'gst')
      return updated
    })
  }

  // ⭐ FIX #1 + #6: Edit mode effective available + toast outside updater
  const handleQtyChange = (index: number, qtyVal: number | string) => {
    const qty = Number(qtyVal)
    if (isNaN(qty) || qty <= 0) return

    const safeQty = Math.round((qty + Number.EPSILON) * 1000) / 1000
    const row = billItems[index]
    if (!row) return

    const effectiveAvailable = isEditMode
      ? row.available_qty + row.original_qty
      : row.available_qty

    if (safeQty > effectiveAvailable) {
      toast.error(`केवल उपलब्ध मात्रा (${effectiveAvailable}) दर्ज करें!`)
      return
    }

    setBillItems((prev) => {
      const updated = [...prev]
      const newRow = { ...updated[index], quantity: safeQty }
      updated[index] = calculateRowTotals(newRow, docType === 'gst')
      return updated
    })
  }

  const addBillRow = () => setBillItems((prev) => [...prev, EMPTY_ROW()])
  const removeBillRow = (uid: string) => {
    setBillItems((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r._uid !== uid)))
  }

  const totalBillValue = round2(billItems.reduce((acc, curr) => acc + safeNum(curr.total_amount), 0))
  const totalTaxable = round2(billItems.reduce((acc, curr) => acc + safeNum(curr.taxable_amount), 0))
  const totalTax = round2(billItems.reduce((acc, curr) => acc + safeNum(curr.cgst_amount) + safeNum(curr.sgst_amount), 0))

  // ─── Edit search ───────────────────────────────────────────────────
  const handleEditSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) {
      setEditSearchResults([])
      return
    }
    setEditSearching(true)
    try {
      const { data: matchedFarmers } = await supabase
        .from('farmers')
        .select('id')
        .ilike('farmer_name', `%${q}%`)
        .limit(20)

      const farmerIds = matchedFarmers?.map((f) => f.id) || []

      const { data: stdByNum } = await supabase
        .from('sales_bills')
        .select('id, bill_number, bill_date, total_amount, bill_type, is_gst_bill, farmer_id, edit_count, farmers(farmer_name, farmer_id)')
        .ilike('bill_number', `%${q}%`)
        .order('bill_date', { ascending: false })
        .limit(15)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stdByFarmer: any[] = []
      if (farmerIds.length > 0) {
        const { data } = await supabase
          .from('sales_bills')
          .select('id, bill_number, bill_date, total_amount, bill_type, is_gst_bill, farmer_id, edit_count, farmers(farmer_name, farmer_id)')
          .in('farmer_id', farmerIds)
          .order('bill_date', { ascending: false })
          .limit(15)
        stdByFarmer = data || []
      }

      const seen = new Set<string>()
      const standardResults: EditSearchResult[] = [...(stdByNum || []), ...stdByFarmer]
        .filter((b) => {
          if (seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
        .map((b) => ({
          id: b.id,
          bill_number: b.bill_number,
          bill_date: b.bill_date,
          total_amount: safeNum(b.total_amount),
          bill_type: b.bill_type,
          is_gst_bill: b.is_gst_bill,
          farmer_id: b.farmer_id,
          edit_count: b.edit_count || 0,
          source: 'standard',
          farmers: Array.isArray(b.farmers) ? b.farmers[0] : b.farmers,
        }))

      let physicalResults: EditSearchResult[] = []
      try {
        const { data: physByNum, error: errNum } = await supabase
          .from('physical_bills')
          .select('id, bill_number, bill_date, bill_amount, transaction_type, bill_type, farmer_id, edit_count, farmers(farmer_name, farmer_id)')
          .ilike('bill_number', `%${q}%`)
          .order('bill_date', { ascending: false })
          .limit(15)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let physByFarmer: any[] = []
        if (farmerIds.length > 0 && !errNum) {
          const { data } = await supabase
            .from('physical_bills')
            .select('id, bill_number, bill_date, bill_amount, transaction_type, bill_type, farmer_id, edit_count, farmers(farmer_name, farmer_id)')
            .in('farmer_id', farmerIds)
            .order('bill_date', { ascending: false })
            .limit(15)
          physByFarmer = data || []
        }

        const pSeen = new Set<string>()
        physicalResults = [...(physByNum || []), ...physByFarmer]
          .filter((b) => {
            if (pSeen.has(b.id)) return false
            pSeen.add(b.id)
            return true
          })
          .map((b) => ({
            id: b.id,
            bill_number: b.bill_number,
            bill_date: b.bill_date,
            total_amount: safeNum(b.bill_amount),
            bill_type: b.transaction_type,
            bill_type_phys: b.bill_type,
            farmer_id: b.farmer_id,
            edit_count: b.edit_count || 0,
            source: 'physical',
            farmers: Array.isArray(b.farmers) ? b.farmers[0] : b.farmers,
          }))
      } catch {
        // physical table may not exist
      }

      const allResults = [...standardResults, ...physicalResults]
        .sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))
        .slice(0, 30)

      setEditSearchResults(allResults)
    } catch (err) {
      console.error('[POS Edit Search Err]:', err)
      toast.error('खोज के दौरान त्रुटि आई।')
    } finally {
      setEditSearching(false)
    }
  }, [])

  const handleEditSearchInput = (val: string) => {
    setEditSearchQuery(val)
    if (editSearchTimerRef.current) clearTimeout(editSearchTimerRef.current)
    editSearchTimerRef.current = setTimeout(() => {
      void handleEditSearch(val)
    }, 400)
  }

  // ─── Load bill for edit (⭐ FIX #3: PDF detection) ──────────────────
  const handleLoadBillForEdit = async (result: EditSearchResult) => {
    try {
      if (result.source === 'standard') {
        const { data: bill, error } = await supabase
          .from('sales_bills')
          .select(`
            id, bill_number, bill_date, total_amount, bill_type, is_gst_bill, farmer_id,
            farmers!inner(id, farmer_id, farmer_name, father_name, village, mobile, credit_limit, outstanding_balance, credit_accounts(*)),
            sales_bill_items(
              id, product_id, product_name, batch_number, quantity, rate,
              total_amount, taxable_amount, cgst_amount, sgst_amount, hsn_code, gst_percent
            )
          `)
          .eq('id', result.id)
          .single()

        if (error || !bill) throw new Error(error?.message || 'Standard Bill fetch failure')

        setPosMode('standard')
        setBillMode(bill.bill_type as BillMode)
        setDocType(bill.is_gst_bill ? 'gst' : 'estimate')
        setBillTargetType('farmer')
        setSelectedGroup(null)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const farmerObj = bill.farmers as any
        if (farmerObj) setSelectedFarmer(farmerObj as Farmer)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedItems: BillItem[] = ((bill.sales_bill_items as any[]) || []).map((item: any) => {
          const prodObj = products.find((p) => p.id === item.product_id)
          const originalQty = Number(item.quantity || 0)
          return {
            _uid: safeUUID(),
            product_id: item.product_id || '',
            batch_id: '',
            available_qty: getTotalAvailableForProduct(item.product_id),
            original_qty: originalQty, // ⭐ FIX #1
            quantity: originalQty,
            rate: Number(item.rate || 0),
            taxable_amount: Number(item.taxable_amount || 0),
            cgst_amount: Number(item.cgst_amount || 0),
            sgst_amount: Number(item.sgst_amount || 0),
            total_amount: Number(item.total_amount || 0),
            expiry_date: '',
            batch_number: item.batch_number || '',
            company_id: prodObj?.company_id || null,
            gst_percent: Number(item.gst_percent || 0),
            hsn_code: item.hsn_code || '',
            product_name: item.product_name || prodObj?.product_name || '',
          }
        })

        setBillItems(mappedItems.length > 0 ? mappedItems : [EMPTY_ROW()])
        setIsEditMode(true)
        setEditingBillId(bill.id)
        setEditingBillSource('standard')
        setOriginalBill({
          total: Number(bill.total_amount),
          billType: bill.bill_type,
          docType: bill.is_gst_bill ? 'gst' : 'estimate',
          billNumber: bill.bill_number,
          itemCount: mappedItems.length,
          farmerName: farmerObj?.farmer_name || '—',
        })
      } else {
        const { data: bill, error } = await supabase
          .from('physical_bills')
          .select(`
            id, bill_number, bill_date, bill_amount, transaction_type, bill_type,
            notes, file_path, farmer_id,
            farmers!inner(id, farmer_id, farmer_name, father_name, village, mobile, credit_limit, outstanding_balance, credit_accounts(*))
          `)
          .eq('id', result.id)
          .single()

        if (error || !bill) throw new Error(error?.message || 'Physical Bill fetch failure')

        setPosMode('physical')
        setBillMode(bill.transaction_type as BillMode)
        setDocType((bill.bill_type as DocType) || 'estimate')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const farmerObj = bill.farmers as any
        if (farmerObj) setSelectedFarmer(farmerObj as Farmer)

        setPhysicalBillDate(bill.bill_date || getKolkataDate())
        setPhysicalBillNumber(bill.bill_number || '')
        setPhysicalBillAmount(String(bill.bill_amount || ''))
        setPhysicalNotes(bill.notes || '')
        setPhysicalFile(null)

        // ⭐ FIX #3: Correct preview setup for PDF vs image
        if (bill.file_path) {
          const isPdf = isPdfPath(bill.file_path)
          try {
            // Try signed URL (private bucket safe); fallback to publicUrl
            const { data: signed } = await supabase.storage
              .from('physical-bills')
              .createSignedUrl(bill.file_path, 60 * 60)
            if (signed?.signedUrl) {
              setPhysicalFilePreview(signed.signedUrl)
            } else {
              const { data: urlData } = supabase.storage.from('physical-bills').getPublicUrl(bill.file_path)
              if (urlData?.publicUrl) setPhysicalFilePreview(urlData.publicUrl)
            }
            setPhysicalFileIsPdf(isPdf)
          } catch {
            setPhysicalFilePreview(null)
            setPhysicalFileIsPdf(false)
          }
        } else {
          setPhysicalFilePreview(null)
          setPhysicalFileIsPdf(false)
        }

        setIsEditMode(true)
        setEditingBillId(bill.id)
        setEditingBillSource('physical')
        setOriginalBill({
          total: Number(bill.bill_amount),
          billType: bill.transaction_type,
          docType: bill.bill_type || 'estimate',
          billNumber: bill.bill_number,
          itemCount: 0,
          farmerName: farmerObj?.farmer_name || '—',
        })
      }

      setEditSearchOpen(false)
      setEditSearchQuery('')
      setEditSearchResults([])
      toast.success(`बिल (${result.bill_number}) संपादन के लिए लोड किया गया!`)
    } catch (err: unknown) {
      console.error('[POS Loader Err]:', err)
      toast.error('बिल लोड करने में विफल: ' + getErrorMessage(err))
    }
  }

  const handleCancelEdit = () => {
    if (!confirm('क्या आप बदलाव रद्द करना चाहते हैं? किया गया सारा बदलाव मिट जाएगा।')) return
    setIsEditMode(false)
    setEditingBillId(null)
    setEditingBillSource(null)
    setOriginalBill(null)
    setEditNotes('')
    setBillItems([EMPTY_ROW()])
    setSelectedFarmer(null)
    setSelectedGroup(null)
    setPhysicalBillNumber('')
    setPhysicalBillAmount('')
    setPhysicalNotes('')
    setPhysicalFile(null)
    setPhysicalFilePreview(null)
    setPhysicalFileIsPdf(false)
    setPhysicalBillDate(getKolkataDate())
    setBillMode('udhaar')
    setDocType('estimate')
    toast.success('संपादन मोड बंद किया गया।')
  }

  // ⭐ FIX #2: Credit limit check in edit flow
  const validateEditCreditLimit = (): boolean => {
    if (billMode !== 'udhaar') return true
    if (!selectedFarmer) return true

    const { outstanding, creditLimit } = getFarmerCreditDetails(selectedFarmer)
    if (creditLimit <= 0) return true

    const originalTotal = safeNum(originalBill?.total)
    const newTotal = editingBillSource === 'standard'
      ? totalBillValue
      : safeNum(physicalBillAmount)

    // Effective outstanding after this edit = (outstanding - originalTotal) + newTotal
    const effectiveOutstanding = outstanding - originalTotal + newTotal

    if (effectiveOutstanding > creditLimit) {
      const remainingCredit = Math.max(0, creditLimit - (outstanding - originalTotal))
      toast.error(
        `क्रेडिट लिमिट पार! लिमिट: ₹${formatINR(creditLimit)}, ` +
          `एडिट बाद अनुमानित बकाया: ₹${formatINR(effectiveOutstanding)}, ` +
          `बिल के लिए उपलब्ध: ₹${formatINR(remainingCredit)}`
      )
      return false
    }
    return true
  }

  const handlePrepareEditSubmit = () => {
    if (editingBillSource === 'standard') {
      if (totalBillValue <= 0) return toast.error('बिल में कम से कम एक वैध उत्पाद जोड़ें!')
      const invalidRow = billItems.find((r) => !r.product_id || r.quantity <= 0)
      if (invalidRow) return toast.error('सभी उत्पाद और मात्रा सही तरीके से भरें!')
      const overstock = billItems.find((r) => r.quantity > r.available_qty + r.original_qty)
      if (overstock) return toast.error('स्टॉक पर्याप्त नहीं है। मात्रा उपलब्ध बैच से अधिक नहीं हो सकती।')
    } else {
      const amt = parseFloat(physicalBillAmount)
      if (!physicalBillAmount || isNaN(amt) || amt <= 0) return toast.error('वैध बिल राशि दर्ज करें!')
    }

    if (!validateEditCreditLimit()) return // ⭐ FIX #2

    setEditConfirmOpen(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingBillId || !editingBillSource) return
    if (saveLockRef.current || editSaving) return
    saveLockRef.current = true
    setEditSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('Session Expired! Please login again.')

      if (editingBillSource === 'standard') {
        const itemsPayload = billItems.map((bi) => {
          const prodObj = products.find((p) => p.id === bi.product_id)
          return {
            product_id: bi.product_id,
            quantity: bi.quantity,
            rate: bi.rate,
            product_name: prodObj?.product_name || bi.product_name || 'Product',
          }
        })

        const { data: rpcResult, error: rpcErr } = await supabase.rpc('edit_standard_bill', {
          p_bill_id: editingBillId,
          p_items: itemsPayload,
          p_new_bill_type: billMode,
          p_new_is_gst: docType === 'gst',
          p_user_id: authData.user.id,
          p_edit_notes: editNotes.trim() || null,
        })

        if (rpcErr) throw rpcErr

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = (rpcResult as any)
        toast.success(`Standard Bill Updated! Old Total: ₹${formatINR(res?.old_total)} → New Total: ₹${formatINR(res?.new_total)}`)
      } else {
        const numericAmount = parseFloat(physicalBillAmount)

        const { data: rpcResult, error: rpcErr } = await supabase.rpc('edit_physical_bill', {
          p_bill_id: editingBillId,
          p_new_amount: numericAmount,
          p_new_bill_type: billMode,
          p_new_doc_type: docType,
          p_new_bill_number: physicalBillNumber.trim(),
          p_new_bill_date: physicalBillDate,
          p_new_notes: physicalNotes.trim() || null,
          p_user_id: authData.user.id,
          p_edit_notes: editNotes.trim() || null,
        })

        if (rpcErr) throw rpcErr

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = (rpcResult as any)
        toast.success(`Physical Bill Updated! Old: ₹${formatINR(res?.old_total)} → New: ₹${formatINR(res?.new_total)}`)
      }

      setIsEditMode(false)
      setEditingBillId(null)
      setEditingBillSource(null)
      setOriginalBill(null)
      setEditNotes('')
      setEditConfirmOpen(false)

      setBillItems([EMPTY_ROW()])
      setSelectedFarmer(null)
      setSelectedGroup(null)
      setPhysicalBillNumber('')
      setPhysicalBillAmount('')
      setPhysicalNotes('')
      setPhysicalFile(null)
      setPhysicalFilePreview(null)
      setPhysicalFileIsPdf(false)
      setBillMode('udhaar')
      setDocType('estimate')

      await loadBillingMasters()
    } catch (err: unknown) {
      console.error('[Confirm Edit Err]:', err)
      toast.error('त्रुटि: ' + getErrorMessage(err), { duration: 8000 })
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setEditSaving(false)
    }
  }

  const handleFinalizeStandardBill = async (e: FormEvent) => {
    e.preventDefault()
    if (isEditMode) {
      handlePrepareEditSubmit()
      return
    }

    if (!isAdmin) return toast.error('आपके पास बिलिंग की अनुमति नहीं है।')
    if (billTargetType === 'farmer' && !selectedFarmer) return toast.error('किसान का चयन करें!')
    if (billTargetType === 'group' && !selectedGroup) return toast.error('ग्रुप का चयन करें!')
    if (totalBillValue <= 0) return toast.error('बिल में कम से कम एक वैध उत्पाद जोड़ें!')

    const invalidRow = billItems.find((r) => !r.product_id || r.quantity <= 0)
    if (invalidRow) return toast.error('सभी प्रोडक्ट लाइन्स में उत्पाद और मात्रा सही भरें!')

    const overstock = billItems.find((r) => {
      const cap = isEditMode ? r.available_qty + r.original_qty : r.available_qty
      return r.quantity > cap
    })
    if (overstock) {
      return toast.error('स्टॉक पर्याप्त नहीं है। मात्रा उपलब्ध बैच से अधिक नहीं हो सकती।')
    }

    if (billMode === 'udhaar' && billTargetType === 'farmer' && selectedFarmer) {
      const { outstanding, creditLimit } = getFarmerCreditDetails(selectedFarmer)
      if (creditLimit > 0 && (outstanding + totalBillValue) > creditLimit) {
        const remainingCredit = Math.max(0, creditLimit - outstanding)
        toast.error(
          `क्रेडिट लिमिट पार! लिमिट: ₹${formatINR(creditLimit)}, बकाया: ₹${formatINR(outstanding)}, शेष क्रेडिट: ₹${formatINR(remainingCredit)}, बिल: ₹${formatINR(totalBillValue)}`
        )
        return
      }
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('Session expired')

      const itemsPayload = billItems.map((bi) => {
        const prodObj = products.find((p) => p.id === bi.product_id)
        return {
          product_id: bi.product_id,
          quantity: bi.quantity,
          rate: bi.rate,
          product_name: prodObj?.product_name || bi.product_name || 'Product',
        }
      })

      const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_udhaar_sales_bill', {
        p_farmer_id: billTargetType === 'farmer' ? selectedFarmer?.id : null,
        p_group_id: billTargetType === 'group' ? selectedGroup?.id : null,
        p_bill_target_type: billTargetType,
        p_person_receiving: selectedFarmer?.farmer_name || '',
        p_items: itemsPayload,
        p_user_id: authData.user.id,
        p_bill_type: billMode,
        p_is_gst_bill: docType === 'gst',
      })

      if (rpcErr) throw new Error(rpcErr.message || 'Bill creation failed')

      const res = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
      const newBillId = res?.id || res?.bill_id || res?.sales_bill_id || ''

      const { data: savedBillData, error: fetchErr } = await supabase
        .from('sales_bills')
        .select(`
          id, bill_number, bill_date, total_amount, is_gst_bill, bill_type,
          farmer:farmers(farmer_name, farmer_id, father_name, village, mobile),
          sales_bill_items(
            id, product_name, batch_number, quantity, rate, total_amount, hsn_code, gst_percent,
            product:products(pack_size, pack_unit, company:companies(company_name))
          )
        `)
        .eq('id', newBillId)
        .single()

      if (fetchErr || !savedBillData) {
        throw new Error('Bill was saved, but details could not be retrieved.')
      }

      const farmerObj = Array.isArray(savedBillData.farmer) ? savedBillData.farmer[0] : savedBillData.farmer

      const createdObj: BillTemplateData = {
        bill_number: savedBillData.bill_number || 'N/A',
        bill_date: savedBillData.bill_date || new Date().toISOString(),
        total_amount: Number(savedBillData.total_amount || totalBillValue),
        is_gst_bill: savedBillData.is_gst_bill,
        bill_type: savedBillData.bill_type || billMode,
        farmer: farmerObj,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (savedBillData.sales_bill_items || []).map((item: any) => {
          const prod = Array.isArray(item.product) ? item.product[0] : item.product || null
          return {
            id: item.id,
            product_name: item.product_name || 'Product',
            batch_number: item.batch_number ?? null,
            quantity: Number(item.quantity || 0),
            rate: Number(item.rate || 0),
            total_amount: Number(item.total_amount || 0),
            hsn_code: item.hsn_code ?? null,
            gst_percent: Number(item.gst_percent || 0),
            pack_size: prod?.pack_size ?? null,
            pack_unit: prod?.pack_unit ?? null,
            company_name: prod?.company?.company_name ?? null,
          }
        }),
      }

      toast.success(docType === 'gst' ? 'GST Invoice Generated!' : 'Estimate Bill Generated!')

      if (isMounted.current) {
        setCreatedBill(createdObj)
        setShowPrintModal(true)
      }
      await loadBillingMasters()
    } catch (err: unknown) {
      if (isMounted.current) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown Error'
        toast.error('त्रुटि: ' + errorMsg)
      }
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setSaving(false)
    }
  }

  // ⭐ FIX #3: Physical file change — detect PDF via file.type
  const handlePhysicalFileChange = (file: File | null) => {
    setPhysicalFileError(null)
    if (!file) {
      setPhysicalFile(null)
      setPhysicalFilePreview(null)
      setPhysicalFileIsPdf(false)
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setPhysicalFileError('फ़ाइल 10MB से छोटी होनी चाहिए।')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setPhysicalFileError('केवल JPG, PNG, WEBP या PDF फ़ाइल अपलोड करें।')
      return
    }

    setPhysicalFile(file)
    setPhysicalFormErrors((prev) => ({ ...prev, file: '' }))

    if (file.type === 'application/pdf') {
      setPhysicalFileIsPdf(true)
      setPhysicalFilePreview(null) // show PDF badge, not img
    } else {
      setPhysicalFileIsPdf(false)
      const reader = new FileReader()
      reader.onload = (e) => setPhysicalFilePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const validatePhysicalForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!selectedFarmer) errors.farmer = 'किसान का चयन करना अनिवार्य है।'
    if (!physicalBillNumber.trim()) errors.billNumber = 'पर्ची/बिल नंबर दर्ज करें।'
    if (!physicalBillDate) errors.billDate = 'बिल की तारीख दर्ज करें।'

    const amt = parseFloat(physicalBillAmount)
    if (!physicalBillAmount || isNaN(amt) || amt <= 0) {
      errors.billAmount = 'वैध बिल राशि दर्ज करें (₹ > 0)'
    }
    if (!isEditMode && !physicalFile) {
      errors.file = 'बिल की फोटो या PDF अपलोड करना अनिवार्य है।'
    }

    setPhysicalFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFinalizePhysicalBill = async (e: FormEvent) => {
    e.preventDefault()
    if (isEditMode) {
      handlePrepareEditSubmit()
      return
    }
    setPhysicalSuccessData(null)

    if (!isAdmin) return toast.error('आपके पास बिलिंग की अनुमति नहीं है।')
    if (!validatePhysicalForm() || !selectedFarmer || !physicalFile) {
      return toast.error('कृपया सभी आवश्यक जानकारी और बिल फोटो भरें!')
    }

    const numericAmount = parseFloat(physicalBillAmount)

    if (billMode === 'udhaar' && selectedFarmer) {
      const { outstanding, creditLimit } = getFarmerCreditDetails(selectedFarmer)
      if (creditLimit > 0 && (outstanding + numericAmount) > creditLimit) {
        const remainingCredit = Math.max(0, creditLimit - outstanding)
        return toast.error(
          `क्रेडिट लिमिट पार! लिमिट: ₹${formatINR(creditLimit)}, बकाया: ₹${formatINR(outstanding)}, शेष क्रेडिट: ₹${formatINR(remainingCredit)}`
        )
      }
    }

    if (saveLockRef.current || physicalSaving) return
    saveLockRef.current = true
    setPhysicalSaving(true)

    let uploadedFilePath: string | null = null

    try {
      const { data: authData } = await supabase.auth.getUser()
      const cleanFileName = physicalFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${selectedFarmer.id}/${Date.now()}_${cleanFileName}`

      const { data: storageData, error: uploadError } = await supabase.storage
        .from('physical-bills')
        .upload(storagePath, physicalFile, { cacheControl: '3600', upsert: false })

      if (uploadError) throw new Error('फ़ाइल अपलोड करने में विफल: ' + uploadError.message)
      uploadedFilePath = storageData.path

      // ⭐ FIX #8: "No Bill" → unique with timestamp
      const finalBillNumber = physicalBillNumber.trim() === 'NO-BILL-NUMBER'
        ? `NO-BILL-${Date.now()}`
        : physicalBillNumber.trim()

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_physical_bill', {
        p_farmer_id: selectedFarmer.id,
        p_bill_type: docType,
        p_transaction_type: billMode,
        p_bill_number: finalBillNumber,
        p_bill_date: physicalBillDate,
        p_bill_amount: numericAmount,
        p_file_path: uploadedFilePath,
        p_file_name: physicalFile.name,
        p_file_type: physicalFile.type,
        p_file_size: physicalFile.size,
        p_notes: physicalNotes.trim() || null,
        p_user_id: authData?.user?.id || null,
      })

      if (rpcError) {
        if (uploadedFilePath) {
          await supabase.storage.from('physical-bills').remove([uploadedFilePath]).catch(() => {})
        }
        throw rpcError
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = rpcResult as any

      setPhysicalSuccessData({
        farmerName: selectedFarmer.farmer_name,
        billNumber: finalBillNumber,
        billType: docType,
        transactionType: billMode,
        billAmount: numericAmount,
        previousOutstanding: res?.previous_outstanding ?? 0,
        newOutstanding: res?.new_outstanding ?? 0,
      })

      toast.success('Physical Bill दर्ज हुआ!')

      setPhysicalBillNumber('')
      setPhysicalBillAmount('')
      setPhysicalNotes('')
      setPhysicalFile(null)
      setPhysicalFilePreview(null)
      setPhysicalFileIsPdf(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''

      await loadBillingMasters()
    } catch (err: unknown) {
      toast.error('त्रुटि: ' + getErrorMessage(err), { duration: 8000 })
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setPhysicalSaving(false)
    }
  }

  // ─── ⭐ FIX #5: HD PDF Generation (PrintableBill ki exact strategy) ───
  const buildPdfFilename = useCallback((): string => {
    const prefix = createdBill?.is_gst_bill ? 'GST' : 'EST'
    const cleanBillNumber = String(createdBill?.bill_number || 'BILL')
      .replace(/^SALES[-_]?/i, '')
      .replace(/^BILL[-_]?/i, '')
      .replace(/[^\w.-]+/g, '_')
    const paper = createdBill?.is_gst_bill ? 'A5L' : 'A5P'
    return `${prefix}_${cleanBillNumber}_${paper}.pdf`
  }, [createdBill])

  const generateBillPdfBlob = useCallback(async (): Promise<Blob> => {
    if (!createdBill) throw new Error('No bill selected.')

    const element = document.getElementById('pos-printable-area')
    if (!element) throw new Error('Printable area not found.')

    const originalStyle = element.getAttribute('style') || ''

    try {
      // Font + image ready
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ('fonts' in document && (document as any).fonts?.ready) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (document as any).fonts.ready
        } catch { /* ignore */ }
      }

      const imgs = Array.from(element.querySelectorAll('img'))
      await Promise.all(
        imgs.map(img => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve()
          return new Promise<void>(resolve => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
            setTimeout(() => resolve(), 3000)
          })
        })
      )

      const isGst = !!createdBill.is_gst_bill
      // A5 Landscape = 210mm × 148mm, A5 Portrait = 148mm × 210mm
      const pageWidthMm = isGst ? 210 : 148
      const pageWidthPx = Math.round(pageWidthMm * 3.7795275591)

      element.classList.add('pdf-export-mode')
      element.style.width = `${pageWidthMm}mm`
      element.style.maxWidth = `${pageWidthMm}mm`
      element.style.minWidth = '0'
      element.style.height = 'auto'
      element.style.minHeight = '0'
      element.style.overflow = 'visible'
      element.style.background = '#ffffff'

      void element.offsetHeight

      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const finalScale = Math.max(3, dpr * 3)

      const options = {
        margin: 0,
        filename: buildPdfFilename(),
        image: { type: 'png', quality: 1.0 },
        html2canvas: {
          scale: finalScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: pageWidthPx,
          windowWidth: pageWidthPx,
          windowHeight: Math.max(element.scrollHeight, 1000),
          imageTimeout: 15000,
          removeContainer: true,
          letterRendering: true,
          foreignObjectRendering: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a5',
          orientation: isGst ? 'landscape' : 'portrait',
          compress: true,
          precision: 16,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', '.no-break', '.bill-header', '.bill-footer'],
        },
        enableLinks: true,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBlob = await (html2pdf as any)()
        .set(options)
        .from(element)
        .output('blob')

      if (!rawBlob || rawBlob.size === 0) throw new Error('PDF generation failed')
      return new Blob([rawBlob], { type: 'application/pdf' })
    } finally {
      element.classList.remove('pdf-export-mode')
      element.setAttribute('style', originalStyle)
    }
  }, [createdBill, buildPdfFilename])

  const handleDownloadPDF = async () => {
    if (!createdBill) return
    setPdfProcessing(true)
    const tId = toast.loading('HD PDF बन रही है...')
    try {
      const blob = await generateBillPdfBlob()
      triggerBrowserDownload(blob, buildPdfFilename())
      toast.success('PDF सफलतापूर्वक डाउनलोड हो गई!', { id: tId })
    } catch (e: unknown) {
      toast.error('PDF generation failed: ' + getErrorMessage(e), { id: tId })
    } finally {
      if (isMounted.current) setPdfProcessing(false)
    }
  }

  // ⭐ FIX #7: WhatsApp share with signed URL (private bucket)
  const handleWhatsAppShare = async () => {
    if (!createdBill || !createdBill.farmer?.mobile) {
      return toast.error('किसान का मोबाइल नंबर नहीं मिला।')
    }

    const normalized = normalizeIndianMobile(createdBill.farmer.mobile)
    if (!normalized) return toast.error('Invalid WhatsApp number.')

    setPdfProcessing(true)
    const tId = toast.loading('व्हाट्सएप दस्तावेज तैयार किया जा रहा है...')

    try {
      const blob = await generateBillPdfBlob()
      const fileName = buildPdfFilename()
      const file = new File([blob], fileName, { type: 'application/pdf' })

      // 1) Native share with file (best path)
      const canShareFile =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: `SATGURU BEEJ BHANDAR Bill - ${createdBill.bill_number}`,
            text: `नमस्ते ${createdBill.farmer.farmer_name}, यहाँ आपका बिल (${createdBill.bill_number}) है।`,
          })
          toast.success('फ़ाइल सफलतापूर्वक साझा की गई!', { id: tId })
          return
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === 'AbortError') {
            toast.dismiss(tId)
            return
          }
          // fallthrough to signed URL
        }
      }

      // 2) Fallback: upload to private bucket + signed URL (1h)
      const storageFileName = `${createdBill.bill_number}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage
        .from('sales_bill_pdfs')
        .upload(storageFileName, blob, { contentType: 'application/pdf', cacheControl: '3600', upsert: true })
      if (upErr) throw new Error('Cloud Storage Error: ' + upErr.message)

      const { data: signed, error: signErr } = await supabase.storage
        .from('sales_bill_pdfs')
        .createSignedUrl(storageFileName, 60 * 60) // 1 hour

      if (signErr || !signed?.signedUrl) {
        throw new Error('Secure sharing link generate nahi ho payi')
      }

      const message =
        `*SATGURU BEEJ BHANDAR*\n\n` +
        `Hello ${createdBill.farmer.farmer_name},\n` +
        `Here is your ${createdBill.is_gst_bill ? 'GST Invoice' : 'Estimate Bill'} ` +
        `(${createdBill.bill_number}).\n\n` +
        `Amount: ₹${formatINR(createdBill.total_amount)}\n\n` +
        `Download PDF (valid 1 hour): ${signed.signedUrl}`

      window.open(
        `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
        '_blank',
        'noopener,noreferrer'
      )
      // Also download a local copy to be safe
      triggerBrowserDownload(blob, fileName)
      toast.success('WhatsApp लिंक भेज दिया गया + PDF डाउनलोड!', { id: tId, duration: 6000 })
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        toast.dismiss(tId)
      } else {
        toast.error('साझा करने में असमर्थ: ' + getErrorMessage(e), { id: tId })
      }
    } finally {
      if (isMounted.current) setPdfProcessing(false)
    }
  }

  const handleCloseModal = () => {
    setShowPrintModal(false)
    setCreatedBill(null)
    setBillItems([EMPTY_ROW()])
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl border border-rose-200 text-center shadow-sm">
        <ShieldAlert className="inline-block text-rose-600 mb-2" size={32} />
        <h1 className="text-base font-bold text-slate-800">Access Denied</h1>
        <p className="text-xs text-slate-500 mt-1">You do not have permission to view this page.</p>
      </div>
    )
  }

  const isBusy = saving || physicalSaving || editSaving

  const getResultFarmerName = (r: EditSearchResult) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (r as any).farmers || (r as any).farmer
    return f?.farmer_name || '—'
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ⭐ FIX #5: PrintableBill-style CSS for perfect PDF */}
      <style>{`
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }

        #pos-printable-area {
          box-sizing: border-box !important;
          display: block !important;
          position: relative;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          flex: none !important;
          float: none !important;
          transform: none !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        #pos-printable-area * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        #pos-printable-area > * {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          overflow: visible !important;
        }
        #pos-printable-area table {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed;
          border-collapse: collapse;
        }
        #pos-printable-area img {
          max-width: 100% !important;
          height: auto;
          object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
        }
        #pos-printable-area td,
        #pos-printable-area th {
          overflow-wrap: anywhere;
          word-break: normal;
        }
        #pos-printable-area tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        #pos-printable-area.pdf-export-mode {
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          background: #ffffff !important;
        }
        #pos-printable-area.pdf-export-mode * {
          max-width: 100% !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          text-shadow: none !important;
        }
        #pos-printable-area.pdf-export-mode table {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        @media print {
          @page { size: ${createdBill?.is_gst_bill ? 'A5 landscape' : 'A5 portrait'}; margin: 5mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow: visible !important; }
          body * { visibility: hidden; }
          #pos-printable-area, #pos-printable-area * { visibility: visible; }
          #pos-printable-area {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: ${createdBill?.is_gst_bill ? '210mm' : '148mm'} !important;
            max-width: ${createdBill?.is_gst_bill ? '210mm' : '148mm'} !important;
            background: #ffffff !important;
          }
          #pos-printable-area > * {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          #pos-printable-area table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
          }
          .print-hidden { display: none !important; }
          * { box-shadow: none !important; }
          tr { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4 space-y-4">
        {/* ── Header ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 print-hidden">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className={`p-2 rounded-lg shrink-0 ${isEditMode ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              <Receipt className={isEditMode ? 'text-amber-800' : 'text-emerald-700'} size={20} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                {isEditMode ? 'Bill Editing Console' : 'Billing & POS Counter'}
              </h1>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {isEditMode ? 'पूर्व निर्मित बिल में सुरक्षित संशोधन करें' : 'नकद/उधारी बिल एवं पर्ची बिल एंट्री'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setEditSearchOpen(true)}
                className="px-3.5 py-1.5 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Pencil size={13} /> Edit Bill (संशोधन)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              >
                <RotateCcw size={13} /> Cancel Edit
              </button>
            )}

            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1">
              <button
                type="button"
                onClick={() => handleModeToggle('standard')}
                disabled={isEditMode}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  posMode === 'standard'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 disabled:opacity-50'
                }`}
              >
                <Layers size={14} /> Standard Bill
              </button>
              <button
                type="button"
                onClick={() => handleModeToggle('physical')}
                disabled={isEditMode}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  posMode === 'physical'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 disabled:opacity-50'
                }`}
              >
                <Camera size={14} /> Physical Bill
              </button>
            </div>
          </div>
        </div>

        {/* ── Edit Mode Alert ── */}
        {isEditMode && originalBill && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 shadow-sm print-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase text-amber-950 tracking-wider">
                  ⚠️ EDIT MODE ACTIVE (संशोधन मोड चालू है)
                </h3>
              </div>
              <p className="text-[11px] text-amber-900 font-semibold mt-1">
                मूल बिल नंबर: <strong className="font-mono">{originalBill.billNumber}</strong> • किसान:{' '}
                <strong>{originalBill.farmerName}</strong> • पुराना कुल: <strong>₹{formatINR(originalBill.total)}</strong>{' '}
                • स्रोत: <strong className="uppercase">{editingBillSource}</strong>
              </p>
              <p className="text-[10px] text-amber-800 opacity-90 mt-0.5">
                * ध्यान दें: संपादन सबमिट करने पर पुराना स्टॉक/लेजर पहले स्वतः रीसेट होगा, फिर नए विवरण लागू होंगे।
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-[10px] font-bold text-amber-900 bg-amber-200/60 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-md"
            >
              Exit Edit Mode
            </button>
          </div>
        )}

        {/* ── Physical Success Banner ── */}
        {posMode === 'physical' && physicalSuccessData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4 shadow-sm print-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">
                    {physicalSuccessData.transactionType === 'udhaar'
                      ? 'Physical Udhaar Bill Added to Account!'
                      : 'Physical Cash Bill Recorded!'}
                  </h3>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    किसान: <strong>{physicalSuccessData.farmerName}</strong> • बिल: #{physicalSuccessData.billNumber}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2.5">
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Previous Due</p>
                      <p className="text-xs font-black text-slate-800 font-mono">
                        ₹{formatINR(physicalSuccessData.previousOutstanding)}
                      </p>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">
                        {physicalSuccessData.transactionType === 'udhaar' ? 'Added' : 'Cash'}
                      </p>
                      <p className="text-xs font-black text-emerald-700 font-mono">
                        ₹{formatINR(physicalSuccessData.billAmount)}
                      </p>
                    </div>
                    <div className="bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg">
                      <p className="text-[9px] text-emerald-200 uppercase font-bold">New Due</p>
                      <p className="text-xs font-black font-mono text-amber-300">
                        ₹{formatINR(physicalSuccessData.newOutstanding)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhysicalSuccessData(null)}
                className="text-emerald-600 hover:bg-emerald-100 p-1 rounded-md shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {mastersLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 print-hidden">
            <Loader2 className="animate-spin mb-2" size={28} />
            <p className="text-xs font-semibold">Loading masters data...</p>
          </div>
        ) : posMode === 'standard' ? (
          <form
            onSubmit={handleFinalizeStandardBill}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 print-hidden items-start"
          >
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      1. Bill Mode
                    </label>
                    <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setBillMode('udhaar')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                          billMode === 'udhaar'
                            ? 'bg-white shadow-sm text-amber-700 font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CreditCard size={13} /> उधारी (Credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillMode('cash')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                          billMode === 'cash'
                            ? 'bg-white shadow-sm text-emerald-700 font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Wallet size={13} /> नकद (Cash)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      2. Document Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setDocType('estimate')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                          docType === 'estimate'
                            ? 'bg-white shadow-sm text-rose-700 font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText size={13} /> Estimate
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocType('gst')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                          docType === 'gst'
                            ? 'bg-white shadow-sm text-blue-700 font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Receipt size={13} /> GST Bill
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      3. Customer Details
                    </label>
                    {!isEditMode && (
                      <div className="flex gap-2 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setBillTargetType('farmer')
                            setSelectedGroup(null)
                          }}
                          className={
                            billTargetType === 'farmer' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                          }
                        >
                          Individual
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setBillTargetType('group')
                            setSelectedFarmer(null)
                          }}
                          className={
                            billTargetType === 'group' ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                          }
                        >
                          Group
                        </button>
                      </div>
                    )}
                  </div>

                  {billTargetType === 'farmer' ? (
                    <div className="relative" ref={farmerSearchRef}>
                      {!selectedFarmer ? (
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                          <input
                            type="text"
                            placeholder="किसान का नाम, ID, मोबाइल, गांव से खोजें..."
                            value={farmerSearch}
                            onChange={(e) => {
                              setFarmerSearch(e.target.value)
                              setIsFarmerDropdownOpen(true)
                            }}
                            onFocus={() => setIsFarmerDropdownOpen(true)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                          />
                          {isFarmerDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                              {filteredFarmers.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-500">कोई किसान नहीं मिला</div>
                              ) : (
                                filteredFarmers.map((f) => {
                                  const { outstanding } = getFarmerCreditDetails(f)
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedFarmer(f)
                                        setIsFarmerDropdownOpen(false)
                                        setFarmerSearch('')
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 flex justify-between items-center text-xs"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-800 truncate">
                                          {f.farmer_name}{' '}
                                          <span className="text-slate-500 font-normal">S/O {f.father_name || '—'}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                          ID: {f.farmer_id} • {f.village || '—'} • {f.mobile || '—'}
                                        </p>
                                      </div>
                                      {outstanding > 0 && (
                                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0 ml-2">
                                          ₹{formatINR(outstanding)}
                                        </span>
                                      )}
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex justify-between items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-emerald-900 text-xs truncate">
                              {selectedFarmer.farmer_name}{' '}
                              <span className="text-slate-600 font-normal">
                                S/O {selectedFarmer.father_name || '—'}
                              </span>
                            </p>
                            <p className="text-[10px] text-emerald-700 truncate">
                              ID: {selectedFarmer.farmer_id} • {selectedFarmer.village || '—'} •{' '}
                              {selectedFarmer.mobile || '—'}
                            </p>
                          </div>
                          {!isEditMode && (
                            <button
                              type="button"
                              onClick={() => setSelectedFarmer(null)}
                              className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-700 font-bold text-[10px] rounded-md hover:bg-emerald-100 shrink-0"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedGroup?.id || ''}
                      onChange={(e) => setSelectedGroup(groups.find((g) => g.id === e.target.value) || null)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white"
                      disabled={saving}
                    >
                      <option value="">-- Choose Group --</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.group_name} - {g.group_id} (Limit: ₹{formatINR(g.credit_limit)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Products (उत्पाद)</h2>
                  <button
                    type="button"
                    onClick={addBillRow}
                    disabled={isBusy}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-md text-[11px] flex items-center gap-1 border border-emerald-200 disabled:opacity-50"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>

                <div className="space-y-2">
                  {billItems.map((item, idx) => {
                    const totalAvail = item.product_id ? getTotalAvailableForProduct(item.product_id) : 0
                    const effectiveMax = isEditMode
                      ? item.available_qty + item.original_qty
                      : item.available_qty
                    return (
                      <div
                        key={item._uid}
                        className="flex flex-col sm:flex-row gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 items-start sm:items-center"
                      >
                        <div className="flex-1 w-full min-w-0">
                          <select
                            required
                            value={item.product_id}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded-md font-semibold bg-white text-xs outline-none focus:border-emerald-500"
                            disabled={isBusy}
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => {
                              const avail = getTotalAvailableForProduct(p.id)
                              return (
                                <option key={p.id} value={p.id} disabled={avail === 0 && !isEditMode}>
                                  {p.product_name} ({p.company?.company_name || '—'}) {isEditMode ? '' : `— Stock: ${avail}`}
                                </option>
                              )
                            })}
                          </select>
                          {item.product_id && (
                            <p className="text-[9px] text-emerald-700 font-semibold mt-1 truncate">
                              {isEditMode
                                ? `Available on save: ${effectiveMax}`
                                : `उपलब्ध: ${totalAvail}`}
                              {' | '}Batch: {item.batch_number || '—'}
                              {docType === 'gst' && ` | GST: ${item.gst_percent}%`}
                            </p>
                          )}
                        </div>
                        <div className="w-full sm:w-20">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            max={effectiveMax || undefined}
                            required
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            className="w-full p-1.5 border border-slate-300 rounded-md font-bold text-center text-xs outline-none focus:border-emerald-500"
                            placeholder="Qty"
                            disabled={isBusy || !item.product_id}
                          />
                        </div>
                        <div className="flex items-center justify-between w-full sm:w-32 gap-2">
                          <div className="text-right flex-1">
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              ₹{formatINR(item.total_amount)}
                            </span>
                            {docType === 'gst' && item.gst_percent > 0 && (
                              <span className="block text-[9px] text-blue-600">
                                incl. ₹{formatINR(item.cgst_amount + item.sgst_amount)}
                              </span>
                            )}
                          </div>
                          {billItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBillRow(item._uid)}
                              disabled={isBusy}
                              className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-800 px-4 py-2.5 flex justify-between items-center">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Summary</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      billMode === 'cash' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {billMode === 'cash' ? 'Nagad' : 'Udhaar'}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {selectedFarmer ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                      <p className="font-bold text-slate-800 truncate">{selectedFarmer.farmer_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {selectedFarmer.farmer_id}</p>
                      {(() => {
                        const { outstanding, available } = getFarmerCreditDetails(selectedFarmer)
                        return (
                          <div className="pt-1.5 border-t border-slate-200 space-y-1 font-semibold">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Current Outstanding:</span>
                              <span className="text-rose-600 font-mono">₹{formatINR(outstanding)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Available Credit:</span>
                              <span className="text-emerald-600 font-mono">₹{formatINR(available)}</span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-center text-slate-400">
                      No Customer Selected
                    </div>
                  )}

                  {docType === 'gst' && (
                    <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span>Taxable Amount:</span>
                        <span>₹{formatINR(totalTaxable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Tax (GST):</span>
                        <span>₹{formatINR(totalTax)}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grand Total</p>
                    <p className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                      ₹{formatINR(totalBillValue)}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> प्रक्रिया में है...
                      </>
                    ) : isEditMode ? (
                      <>
                        <CheckCircle2 size={14} /> Save Modifications (संशोधन सहेजें)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Generate Standard Bill
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleFinalizePhysicalBill}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 print-hidden items-start"
          >
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    1. Select Farmer <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative" ref={farmerSearchRef}>
                    {!selectedFarmer ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="किसान का नाम, ID, मोबाइल, गांव से खोजें..."
                          value={farmerSearch}
                          onChange={(e) => {
                            setFarmerSearch(e.target.value)
                            setIsFarmerDropdownOpen(true)
                          }}
                          onFocus={() => setIsFarmerDropdownOpen(true)}
                          className={`w-full pl-9 pr-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white ${
                            physicalFormErrors.farmer ? 'border-rose-400' : 'border-slate-300 focus:border-emerald-500'
                          }`}
                        />
                        {isFarmerDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                            {filteredFarmers.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-500">कोई किसान नहीं मिला</div>
                            ) : (
                              filteredFarmers.map((f) => {
                                const { outstanding } = getFarmerCreditDetails(f)
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedFarmer(f)
                                      setIsFarmerDropdownOpen(false)
                                      setFarmerSearch('')
                                      setPhysicalFormErrors((prev) => ({ ...prev, farmer: '' }))
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 flex justify-between items-center text-xs"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-800 truncate">
                                        {f.farmer_name}{' '}
                                        <span className="text-slate-500 font-normal">S/O {f.father_name || '—'}</span>
                                      </p>
                                      <p className="text-[10px] text-slate-500 truncate">
                                        ID: {f.farmer_id} • {f.village || '—'} • {f.mobile || '—'}
                                      </p>
                                    </div>
                                    {outstanding > 0 && (
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0 ml-2">
                                        ₹{formatINR(outstanding)}
                                      </span>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-emerald-900 text-xs truncate">
                            {selectedFarmer.farmer_name}{' '}
                            <span className="text-slate-600 font-normal">S/O {selectedFarmer.father_name || '—'}</span>
                          </p>
                          <p className="text-[10px] text-emerald-700 truncate">
                            ID: {selectedFarmer.farmer_id} • {selectedFarmer.village || '—'} • {selectedFarmer.mobile || '—'}
                          </p>
                        </div>
                        {!isEditMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFarmer(null)
                              setFarmerSearch('')
                            }}
                            className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-700 font-bold text-[10px] rounded-md hover:bg-emerald-100 shrink-0"
                          >
                            Change
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {physicalFormErrors.farmer && (
                    <p className="text-[10px] text-rose-600 mt-1 font-medium">{physicalFormErrors.farmer}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      2. Transaction Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setBillMode('udhaar')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                          billMode === 'udhaar' ? 'bg-white shadow-sm text-amber-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        उधार (Udhaar)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillMode('cash')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                          billMode === 'cash' ? 'bg-white shadow-sm text-emerald-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        नकद (Cash)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      3. Document Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setDocType('estimate')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                          docType === 'estimate' ? 'bg-white shadow-sm text-rose-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        <FileText size={12} /> Estimate
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocType('gst')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                          docType === 'gst' ? 'bg-white shadow-sm text-blue-700 font-black' : 'text-slate-600'
                        }`}
                      >
                        <FileSpreadsheet size={12} /> GST
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      4. Bill Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        type="date"
                        value={physicalBillDate}
                        onChange={(e) => {
                          setPhysicalBillDate(e.target.value)
                          setPhysicalFormErrors((prev) => ({ ...prev, billDate: '' }))
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-emerald-500"
                      />
                    </div>
                    {physicalFormErrors.billDate && (
                      <p className="text-[10px] text-rose-600 mt-1">{physicalFormErrors.billDate}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        5. Bill No <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPhysicalBillNumber('NO-BILL-NUMBER')
                          setPhysicalFormErrors((prev) => ({ ...prev, billNumber: '' }))
                        }}
                        className="text-[9px] text-emerald-700 hover:underline font-bold"
                      >
                        No Bill
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="ABC-1025"
                      value={physicalBillNumber}
                      onChange={(e) => {
                        setPhysicalBillNumber(e.target.value)
                        setPhysicalFormErrors((prev) => ({ ...prev, billNumber: '' }))
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-emerald-500"
                    />
                    {physicalFormErrors.billNumber && (
                      <p className="text-[10px] text-rose-600 mt-1">{physicalFormErrors.billNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      6. Amount ₹ <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={physicalBillAmount}
                        onChange={(e) => {
                          setPhysicalBillAmount(e.target.value)
                          setPhysicalFormErrors((prev) => ({ ...prev, billAmount: '' }))
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                    {physicalFormErrors.billAmount && (
                      <p className="text-[10px] text-rose-600 mt-1">{physicalFormErrors.billAmount}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    7. Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="कीटनाशक दवाई / XYZ Agro का पुराना बिल"
                    value={physicalNotes}
                    onChange={(e) => setPhysicalNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    8. Upload Bill Photo / Document {!isEditMode && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                    className="hidden"
                    onChange={(e) => handlePhysicalFileChange(e.target.files?.[0] || null)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhysicalFileChange(e.target.files?.[0] || null)}
                  />

                  {!physicalFile && !physicalFilePreview && !physicalFileIsPdf ? (
                    <div className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-5 text-center bg-slate-50 hover:bg-emerald-50/30 transition">
                      <UploadCloud className="text-slate-400 mx-auto mb-2" size={28} />
                      <p className="text-xs font-bold text-slate-700 mb-0.5">पर्ची का फोटो या फाइल अपलोड करें</p>
                      <p className="text-[10px] text-slate-500 mb-3">JPG, PNG, WEBP या PDF (max 10MB)</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[11px] font-bold shadow-sm flex items-center gap-1.5"
                        >
                          <Camera size={13} /> Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <FileText size={13} /> Browse
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {physicalFileIsPdf ? (
                          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-md flex items-center justify-center font-bold text-[10px] border border-rose-200 shrink-0">
                            PDF
                          </div>
                        ) : physicalFilePreview ? (
                          <img
                            src={physicalFilePreview}
                            alt="Bill Preview"
                            className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-200 rounded-md shrink-0 flex items-center justify-center text-slate-500">
                            <FileText size={14} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {physicalFile ? physicalFile.name : 'Saved Attachment'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {physicalFile ? `${(physicalFile.size / 1024).toFixed(1)} KB` : 'Cloud Hosted File'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {physicalFilePreview && !physicalFileIsPdf && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDocUrl(physicalFilePreview)
                              setPreviewDocModalOpen(true)
                            }}
                            className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-md"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        {physicalFileIsPdf && physicalFilePreview && (
                          <a
                            href={physicalFilePreview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-md"
                            title="Open PDF"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        {!isEditMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhysicalFile(null)
                              setPhysicalFilePreview(null)
                              setPhysicalFileIsPdf(false)
                              if (fileInputRef.current) fileInputRef.current.value = ''
                              if (cameraInputRef.current) cameraInputRef.current.value = ''
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {physicalFileError && (
                    <p className="text-[10px] text-rose-600 mt-1 font-medium">{physicalFileError}</p>
                  )}
                  {physicalFormErrors.file && (
                    <p className="text-[10px] text-rose-600 mt-1 font-medium">{physicalFormErrors.file}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-800 px-4 py-2.5 flex justify-between items-center">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Voucher Summary</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      billMode === 'cash' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {billMode === 'cash' ? 'Nagad' : 'Udhaar'}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {selectedFarmer ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                      <p className="font-bold text-slate-800 truncate">{selectedFarmer.farmer_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {selectedFarmer.farmer_id}</p>
                      {(() => {
                        const { outstanding, available } = getFarmerCreditDetails(selectedFarmer)
                        return (
                          <div className="pt-1.5 border-t border-slate-200 space-y-1 font-semibold mt-2">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Current Due:</span>
                              <span className="text-rose-600 font-mono">₹{formatINR(outstanding)}</span>
                            </div>
                            {billMode === 'udhaar' && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Available Credit:</span>
                                <span className="text-emerald-600 font-mono">₹{formatINR(available)}</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-center text-slate-400">
                      No Customer Selected
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bill Amount</p>
                    <p className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                      ₹{formatINR(physicalBillAmount || 0)}
                    </p>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 text-[10px] text-emerald-800">
                    <p className="font-bold flex items-center gap-1 mb-0.5">
                      <CheckCircle2 size={11} /> Zero Stock Movement
                    </p>
                    <p className="opacity-90">इस बिल से डायरेक्ट बही खाता अपडेट होगा, स्टॉक नहीं।</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> सहेज रहे हैं...
                      </>
                    ) : isEditMode ? (
                      <>
                        <CheckCircle2 size={14} /> Update Physical Voucher
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Finalize Physical Bill
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Edit Search Modal */}
        {editSearchOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-3 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                  <Search size={16} className="text-slate-700" /> बिल खोजें और संपादित करें
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditSearchOpen(false)
                    setEditSearchResults([])
                    setEditSearchQuery('')
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded-md"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="किसान का नाम या बिल नंबर दर्ज करें..."
                  value={editSearchQuery}
                  onChange={(e) => handleEditSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-800 bg-slate-50 font-semibold"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-[250px] space-y-1.5 pr-1">
                {editSearching ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="animate-spin mb-1" size={20} />
                    <span className="text-[10px]">डेटाबेस से खोजा जा रहा है...</span>
                  </div>
                ) : editSearchResults.length === 0 ? (
                  <div className="text-center text-xs py-10 text-slate-400">
                    {editSearchQuery.trim() ? 'कोई बिल नहीं मिला!' : 'खोजने के लिए ऊपर इनपुट दर्ज करें।'}
                  </div>
                ) : (
                  editSearchResults.map((r) => (
                    <button
                      key={`${r.source}-${r.id}`}
                      type="button"
                      onClick={() => void handleLoadBillForEdit(r)}
                      className="w-full text-left p-3 hover:bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900">{r.bill_number}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              r.source === 'standard' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {r.source === 'standard' ? 'Standard' : 'Physical'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-bold mt-1">किसान: {getResultFarmerName(r)}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Date: {new Date(r.bill_date).toLocaleDateString('en-IN')} • Type:{' '}
                          <span className="uppercase font-semibold">{r.bill_type}</span>
                          {r.edit_count > 0 && ` • Edited x${r.edit_count}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800 font-mono">
                          ₹{formatINR(r.total_amount)}
                        </span>
                        <span className="block text-[8px] text-emerald-600 font-semibold">Click to Load</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Confirmation Modal */}
        {editConfirmOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-3 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="text-center">
                <div className="bg-amber-100 p-2 text-amber-800 rounded-full inline-block mb-2">
                  <ArrowLeftRight size={22} className="animate-spin-slow" />
                </div>
                <h3 className="font-black text-sm text-slate-800">क्या आप संशोधन सहेजना चाहते हैं?</h3>
                <p className="text-slate-500 text-[11px] mt-1">
                  पुराने बिल के लेनदेन निरस्त करके नए विवरण के आधार पर बकाया एवं स्टॉक स्वतः सुधारा जाएगा।
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1.5 font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-500">मूल बिल कुल:</span>
                  <span className="text-slate-700 font-mono">₹{formatINR(originalBill?.total)}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">नया संशोधित कुल:</span>
                  <span className="text-emerald-700 font-black font-mono">
                    ₹{formatINR(editingBillSource === 'standard' ? totalBillValue : safeNum(physicalBillAmount))}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5 text-xs font-bold">
                  <span className="text-slate-800">शुद्ध बकाया बदलाव:</span>
                  <span
                    className={
                      (editingBillSource === 'standard' ? totalBillValue : safeNum(physicalBillAmount)) -
                        safeNum(originalBill?.total) >=
                      0
                        ? 'text-rose-600 font-mono'
                        : 'text-emerald-600 font-mono'
                    }
                  >
                    {(editingBillSource === 'standard' ? totalBillValue : safeNum(physicalBillAmount)) -
                      safeNum(originalBill?.total) >=
                    0
                      ? '+'
                      : ''}
                    ₹{formatINR(
                      (editingBillSource === 'standard' ? totalBillValue : safeNum(physicalBillAmount)) -
                        safeNum(originalBill?.total)
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  संशोधन का कारण (Reason for edit) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. मात्रा सुधार / गलत उत्पाद दर्ज किया था"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold outline-none focus:border-slate-800 bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditConfirmOpen(false)}
                  disabled={editSaving}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  disabled={editSaving || !editNotes.trim()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs"
                >
                  {editSaving ? 'सहेज रहे हैं...' : 'हाँ, अपडेट करें'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attachment Preview Modal */}
        {previewDocModalOpen && previewDocUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4 space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Camera size={16} className="text-emerald-700" /> Attachment Preview
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewDocModalOpen(false)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto flex items-center justify-center bg-slate-100 rounded-lg p-2">
                <img src={previewDocUrl} alt="Preview" className="max-h-[70vh] object-contain rounded-md" />
              </div>
            </div>
          </div>
        )}

        {/* Print / Download / WhatsApp Modal */}
        {showPrintModal && createdBill && (
          <div className="fixed inset-0 bg-slate-900/70 z-[100] flex items-center justify-center p-3 backdrop-blur-sm print:hidden">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={18} /> Bill Generated
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200">
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Total Amount</p>
                <p className="text-3xl font-black text-slate-900 font-mono">₹{formatINR(createdBill.total_amount)}</p>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Bill: {createdBill.bill_number} • {createdBill.is_gst_bill ? 'GST' : 'ESTIMATE'} •{' '}
                  {(createdBill.bill_type || 'udhaar').toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 py-3 rounded-lg font-bold text-[11px] text-slate-700 transition"
                >
                  <Printer size={18} className="text-slate-600" /> Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={pdfProcessing}
                  className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 py-3 rounded-lg font-bold text-[11px] text-slate-700 disabled:opacity-50 transition"
                >
                  {pdfProcessing ? (
                    <Loader2 size={18} className="animate-spin text-slate-500" />
                  ) : (
                    <Download size={18} className="text-blue-600" />
                  )}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  disabled={pdfProcessing}
                  className="flex flex-col items-center justify-center gap-1 bg-white border border-slate-200 hover:border-green-300 hover:bg-green-50 py-3 rounded-lg font-bold text-[11px] text-slate-700 disabled:opacity-50 transition"
                >
                  {pdfProcessing ? (
                    <Loader2 size={18} className="animate-spin text-slate-500" />
                  ) : (
                    <Share2 size={18} className="text-green-600" />
                  )}
                  WhatsApp
                </button>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
              >
                Close & Create New Bill
              </button>
            </div>
          </div>
        )}

        {/* ⭐ FIX #5: Hidden capture area (PrintableBill style) */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            zIndex: -1000,
            pointerEvents: 'none',
            background: '#ffffff',
          }}
        >
          <div id="pos-printable-area" className="bg-white">
            {createdBill && <SalesBillTemplate bill={createdBill} />}
          </div>
        </div>
      </div>
    </div>
  )
}