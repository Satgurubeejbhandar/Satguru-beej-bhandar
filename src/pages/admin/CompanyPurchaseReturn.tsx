import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  ArrowLeft,
  Package,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Eye,
  Ban,
  ClipboardList,
  Truck,
  ShieldAlert,
  RefreshCw,
  History,
  IndianRupee,
} from 'lucide-react'

// ─────────────────────────────────────────────────────
// TYPES — KEEPING PRODUCTION SCHEMA
// ─────────────────────────────────────────────────────

interface Company {
  id: string
  company_name: string
  mobile: string | null
  gst_number: string | null
  gstin: string | null
  opening_balance: number
  opening_balance_type: string
  is_active: boolean
}

interface PurchaseBill {
  id: string
  bill_number: string
  vendor_bill_number: string | null
  bill_date: string
  total_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  payment_status: string
  purchase_status: string
  notes: string | null
}

interface ReturnItemState {
  purchase_bill_item_id: string
  product_id: string
  batch_id: string | null
  product_name: string
  sku: string
  unit_name: string
  batch_number: string | null
  lot_number: string | null
  original_qty: number
  already_returned: number
  current_batch_stock: number
  max_returnable: number
  return_quantity: number
  purchase_rate: number
  gst_percent: number
  return_taxable: number
  return_gst: number
  return_total: number
  expiry_date: string | null
}

interface PurchaseReturnRecord {
  id: string
  return_number: string
  purchase_bill_id: string
  company_id: string
  company_name: string
  bill_number: string
  return_date: string
  subtotal: number
  tax_amount: number
  total_amount: number
  reason: string | null
  return_status: string
  created_at: string
  items?: any[]
}

type ViewMode = 'form' | 'history' | 'detail'

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount || 0)

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-'

  const d = new Date(dateStr)

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────

const CompanyPurchaseReturn: React.FC = () => {
  const navigate = useNavigate()
  const submitLockRef = useRef(false)

  // ─────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────

  const [user, setUser] = useState<any>(null)

  const [profile, setProfile] = useState<{
    role: string
    is_active: boolean
  } | null>(null)

  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        setUser(currentUser)

        if (currentUser) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('id', currentUser.id)
            .single()

          setProfile(prof)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoadingAuth(false)
      }
    }

    initAuth()
  }, [])

  const isAdmin =
    profile?.role === 'admin' &&
    profile?.is_active === true

  // ─────────────────────────────────────────────────
  // VIEW
  // ─────────────────────────────────────────────────

  const [viewMode, setViewMode] = useState<ViewMode>('form')

  // ─────────────────────────────────────────────────
  // COMPANY
  // ─────────────────────────────────────────────────

  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] =
    useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  // ─────────────────────────────────────────────────
  // PURCHASE BILLS
  // ─────────────────────────────────────────────────

  const [purchaseBills, setPurchaseBills] = useState<
    PurchaseBill[]
  >([])

  const [selectedBillId, setSelectedBillId] = useState('')
  const [loadingBills, setLoadingBills] = useState(false)

  // ─────────────────────────────────────────────────
  // RETURN ITEMS
  // ─────────────────────────────────────────────────

  const [returnItems, setReturnItems] = useState<
    ReturnItemState[]
  >([])

  const [loadingItems, setLoadingItems] = useState(false)

  // ─────────────────────────────────────────────────
  // RETURN META
  // ─────────────────────────────────────────────────

  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [returnReason, setReturnReason] =
    useState('Excess stock')

  const [customReason, setCustomReason] = useState('')

  // ─────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────

  const [showConfirmation, setShowConfirmation] =
    useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    data?: any
    error?: string
  } | null>(null)

  // ─────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────

  const [returnHistory, setReturnHistory] = useState<
    PurchaseReturnRecord[]
  >([])

  const [loadingHistory, setLoadingHistory] = useState(false)

  const [historySearch, setHistorySearch] = useState('')

  const [historyStatusFilter, setHistoryStatusFilter] =
    useState('')

  const [selectedReturnDetail, setSelectedReturnDetail] =
    useState<PurchaseReturnRecord | null>(null)

  const [loadingDetail, setLoadingDetail] = useState(false)

  // ─────────────────────────────────────────────────
  // LAST RETURN
  // ─────────────────────────────────────────────────

  const [lastReturn, setLastReturn] =
    useState<PurchaseReturnRecord | null>(null)

  const [loadingLastReturn, setLoadingLastReturn] =
    useState(false)

  // ─────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────

  const [showCancelModal, setShowCancelModal] =
    useState(false)

  const [cancelTargetId, setCancelTargetId] =
    useState<string | null>(null)

  const [cancelReasonText, setCancelReasonText] =
    useState('')

  const [cancelling, setCancelling] = useState(false)

  // ─────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null)

  // ─────────────────────────────────────────────────
  // LOAD COMPANIES
  // ─────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)

    try {
      const { data, error } = await supabase
        .from('companies')
        .select(
          'id, company_name, mobile, gst_number, gstin, opening_balance, opening_balance_type, is_active'
        )
        .eq('is_active', true)
        .order('company_name')

      if (error) throw error

      setCompanies(data || [])
    } catch (err: any) {
      setErrorMsg(
        'Failed to load companies: ' +
          (err?.message || 'Unknown error')
      )
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies()
    }
  }, [isAdmin, fetchCompanies])

  // ─────────────────────────────────────────────────
  // LAST RETURN
  // ─────────────────────────────────────────────────

  const fetchLastReturn = useCallback(async () => {
    setLoadingLastReturn(true)

    try {
      const { data, error } = await supabase
        .from('purchase_returns')
        .select(`
          id,
          return_number,
          purchase_bill_id,
          company_id,
          return_date,
          subtotal,
          tax_amount,
          total_amount,
          reason,
          return_status,
          created_at,
          companies:company_id (
            company_name
          ),
          purchase_bills:purchase_bill_id (
            bill_number
          )
        `)
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setLastReturn({
          id: data.id,
          return_number: data.return_number,
          purchase_bill_id: data.purchase_bill_id,
          company_id: data.company_id,
          company_name:
            (data as any).companies?.company_name ||
            'Unknown Company',
          bill_number:
            (data as any).purchase_bills?.bill_number ||
            'N/A',
          return_date: data.return_date,
          subtotal: Number(data.subtotal) || 0,
          tax_amount: Number(data.tax_amount) || 0,
          total_amount: Number(data.total_amount) || 0,
          reason: data.reason,
          return_status:
            data.return_status || 'completed',
          created_at: data.created_at,
        })
      } else {
        setLastReturn(null)
      }
    } catch (err: any) {
      console.error(
        'Failed to load last return:',
        err?.message
      )
    } finally {
      setLoadingLastReturn(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin && viewMode === 'form') {
      fetchLastReturn()
    }
  }, [
    isAdmin,
    viewMode,
    fetchLastReturn,
    submitResult,
  ])

  // ─────────────────────────────────────────────────
  // LOAD PURCHASE BILLS
  // ─────────────────────────────────────────────────

  const fetchCompanyBills = useCallback(
    async (companyId: string) => {
      setLoadingBills(true)
      setPurchaseBills([])
      setSelectedBillId('')
      setReturnItems([])

      try {
        const { data, error } = await supabase
          .from('purchase_bills')
          .select(`
            id,
            bill_number,
            vendor_bill_number,
            bill_date,
            total_amount,
            taxable_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            payment_status,
            purchase_status,
            notes
          `)
          .eq('company_id', companyId)
          .eq('purchase_status', 'active')
          .order('bill_date', {
            ascending: false,
          })

        if (error) throw error

        setPurchaseBills(data || [])
      } catch (err: any) {
        setErrorMsg(
          'Failed to load purchase bills: ' +
            (err?.message || 'Unknown error')
        )
      } finally {
        setLoadingBills(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyBills(selectedCompanyId)
    }
  }, [selectedCompanyId, fetchCompanyBills])

  // ─────────────────────────────────────────────────
  // LOAD BILL ITEMS
  // ─────────────────────────────────────────────────

  const fetchBillItems = useCallback(
    async (billId: string) => {
      setLoadingItems(true)
      setReturnItems([])

      try {
        const { data, error } = await supabase
          .from('purchase_bill_items')
          .select(`
            id,
            purchase_bill_id,
            product_id,
            batch_id,
            quantity,
            returned_quantity,
            purchase_rate,
            selling_rate,
            total_amount,
            taxable_amount,
            gst_percent,
            batch_number,
            lot_number,
            manufacturing_date,
            expiry_date,
            unit_name,
            products:product_id (
              product_name,
              sku
            ),
            inventory_batches:batch_id (
              quantity_available
            )
          `)
          .eq('purchase_bill_id', billId)

        if (error) throw error

        const items: ReturnItemState[] =
          (data || []).map((row: any) => {
            const originalQty =
              Number(row.quantity) || 0

            const alreadyReturned =
              Number(row.returned_quantity) || 0

            const currentBatchStock =
              row.inventory_batches
                ? Number(
                    row.inventory_batches
                      .quantity_available
                  ) || 0
                : originalQty

            const remainingBillQty = Math.max(
              0,
              originalQty - alreadyReturned
            )

            const maxReturnable = Math.min(
              remainingBillQty,
              currentBatchStock
            )

            return {
              purchase_bill_item_id: row.id,
              product_id: row.product_id,
              batch_id: row.batch_id,
              product_name:
                row.products?.product_name ||
                'Unknown Item',
              sku: row.products?.sku || '',
              unit_name:
                row.unit_name || 'Units',
              batch_number:
                row.batch_number || null,
              lot_number:
                row.lot_number || null,
              original_qty: originalQty,
              already_returned: alreadyReturned,
              current_batch_stock:
                currentBatchStock,
              max_returnable: maxReturnable,
              return_quantity: 0,
              purchase_rate:
                Number(row.purchase_rate) || 0,
              gst_percent:
                Number(row.gst_percent) || 0,
              return_taxable: 0,
              return_gst: 0,
              return_total: 0,
              expiry_date:
                row.expiry_date || null,
            }
          })

        setReturnItems(items)
      } catch (err: any) {
        setErrorMsg(
          'Failed to load bill items: ' +
            (err?.message || 'Unknown error')
        )
      } finally {
        setLoadingItems(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedBillId) {
      fetchBillItems(selectedBillId)
    }
  }, [selectedBillId, fetchBillItems])

  // ─────────────────────────────────────────────────
  // QUANTITY
  // ─────────────────────────────────────────────────

  const handleQuantityChange = (
    index: number,
    value: string
  ) => {
    setReturnItems((prev) => {
      const updated = [...prev]
      const item = { ...updated[index] }

      let qty = parseFloat(value) || 0

      if (qty < 0) qty = 0

      if (qty > item.max_returnable) {
        qty = item.max_returnable
      }

      item.return_quantity = qty

      item.return_taxable = parseFloat(
        (qty * item.purchase_rate).toFixed(2)
      )

      item.return_gst = parseFloat(
        (
          (item.return_taxable *
            item.gst_percent) /
          100
        ).toFixed(2)
      )

      item.return_total = parseFloat(
        (
          item.return_taxable +
          item.return_gst
        ).toFixed(2)
      )

      updated[index] = item

      return updated
    })
  }

  // ─────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────

  const selectedCompany = useMemo(
    () =>
      companies.find(
        (company) =>
          company.id === selectedCompanyId
      ),
    [companies, selectedCompanyId]
  )

  const selectedBill = useMemo(
    () =>
      purchaseBills.find(
        (bill) => bill.id === selectedBillId
      ),
    [purchaseBills, selectedBillId]
  )

  const activeReturnRows = useMemo(
    () =>
      returnItems.filter(
        (item) => item.return_quantity > 0
      ),
    [returnItems]
  )

  const returnTotals = useMemo(() => {
    const subtotal =
      activeReturnRows.reduce(
        (sum, item) =>
          sum + item.return_taxable,
        0
      )

    const gstTotal =
      activeReturnRows.reduce(
        (sum, item) =>
          sum + item.return_gst,
        0
      )

    const grandTotal =
      activeReturnRows.reduce(
        (sum, item) =>
          sum + item.return_total,
        0
      )

    const totalQty =
      activeReturnRows.reduce(
        (sum, item) =>
          sum + item.return_quantity,
        0
      )

    return {
      count: activeReturnRows.length,
      totalQty,
      subtotal: parseFloat(
        subtotal.toFixed(2)
      ),
      gstTotal: parseFloat(
        gstTotal.toFixed(2)
      ),
      grandTotal: parseFloat(
        grandTotal.toFixed(2)
      ),
    }
  }, [activeReturnRows])

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) {
      return companies
    }

    const q = companySearch.toLowerCase()

    return companies.filter(
      (company) =>
        company.company_name
          .toLowerCase()
          .includes(q) ||
        (company.gst_number &&
          company.gst_number
            .toLowerCase()
            .includes(q)) ||
        (company.mobile &&
          company.mobile.includes(q))
    )
  }, [companies, companySearch])

  const handleCompanySearchClick = () => {
    setShowCompanyDropdown(true)

    if (
      companySearch.trim() &&
      filteredCompanies.length === 1
    ) {
      const company =
        filteredCompanies[0]

      setSelectedCompanyId(company.id)
      setCompanySearch('')
      setShowCompanyDropdown(false)
    }
  }

  // ─────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────

  const handleSubmitReturn = async () => {
    if (submitLockRef.current) return

    submitLockRef.current = true
    setSubmitting(true)
    setSubmitResult(null)

    try {
      if (!user?.id) {
        throw new Error(
          'Not authenticated.'
        )
      }

      if (!selectedCompanyId) {
        throw new Error(
          'Please select a company.'
        )
      }

      if (!selectedBillId) {
        throw new Error(
          'Please select a purchase bill.'
        )
      }

      if (activeReturnRows.length === 0) {
        throw new Error(
          'Please specify a return quantity for at least one item.'
        )
      }

      const finalReason =
        returnReason === 'Other'
          ? customReason.trim()
          : returnReason

      if (!finalReason) {
        throw new Error(
          'Please provide a reason for return.'
        )
      }

      const itemsPayload =
        activeReturnRows.map((item) => ({
          purchase_bill_item_id:
            item.purchase_bill_item_id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          return_quantity:
            item.return_quantity,
          purchase_rate:
            item.purchase_rate,
          gst_percent:
            item.gst_percent,
        }))

      const { data, error } =
        await supabase.rpc(
          'process_purchase_return',
          {
            p_company_id:
              selectedCompanyId,
            p_purchase_bill_id:
              selectedBillId,
            p_return_date:
              returnDate,
            p_reason:
              finalReason,
            p_items:
              itemsPayload,
            p_user_id:
              user.id,
          }
        )

      if (error) throw error

      if (data?.success) {
        setSubmitResult({
          success: true,
          data,
        })

        setShowConfirmation(false)
      } else {
        throw new Error(
          data?.error ||
            'Return submission failed.'
        )
      }
    } catch (err: any) {
      setSubmitResult({
        success: false,
        error:
          err?.message ||
          'Error occurred.',
      })
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
    }
  }

  // ─────────────────────────────────────────────────
  // RESET FORM — UI STATE ONLY
  // ─────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedCompanyId('')
    setSelectedBillId('')
    setPurchaseBills([])
    setReturnItems([])
    setReturnReason('Excess stock')
    setCustomReason('')
    setReturnDate(
      new Date()
        .toISOString()
        .split('T')[0]
    )
    setShowConfirmation(false)
    setSubmitResult(null)
    setErrorMsg(null)
    setCompanySearch('')
    setShowCompanyDropdown(false)
  }

  // ─────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────

  const fetchReturnHistory =
    useCallback(async () => {
      setLoadingHistory(true)

      try {
        let query = supabase
          .from('purchase_returns')
          .select(`
            id,
            return_number,
            purchase_bill_id,
            company_id,
            return_date,
            subtotal,
            tax_amount,
            total_amount,
            reason,
            return_status,
            created_at,
            companies:company_id (
              company_name
            ),
            purchase_bills:purchase_bill_id (
              bill_number
            )
          `)
          .order('created_at', {
            ascending: false,
          })

        if (historyStatusFilter) {
          query = query.eq(
            'return_status',
            historyStatusFilter
          )
        }

        const { data, error } =
          await query.limit(100)

        if (error) throw error

        const records: PurchaseReturnRecord[] =
          (data || []).map(
            (row: any) => ({
              id: row.id,
              return_number:
                row.return_number,
              purchase_bill_id:
                row.purchase_bill_id,
              company_id:
                row.company_id,
              company_name:
                row.companies
                  ?.company_name ||
                'Unknown Company',
              bill_number:
                row.purchase_bills
                  ?.bill_number ||
                'N/A',
              return_date:
                row.return_date,
              subtotal:
                Number(row.subtotal) ||
                0,
              tax_amount:
                Number(row.tax_amount) ||
                0,
              total_amount:
                Number(row.total_amount) ||
                0,
              reason: row.reason,
              return_status:
                row.return_status ||
                'completed',
              created_at:
                row.created_at,
            })
          )

        let filtered = records

        if (historySearch.trim()) {
          const q =
            historySearch.toLowerCase()

          filtered = filtered.filter(
            (record) =>
              record.return_number
                .toLowerCase()
                .includes(q) ||
              record.company_name
                .toLowerCase()
                .includes(q) ||
              record.bill_number
                .toLowerCase()
                .includes(q)
          )
        }

        setReturnHistory(filtered)
      } catch (err: any) {
        setErrorMsg(
          'Failed to load history: ' +
            (err?.message ||
              'Unknown error')
        )
      } finally {
        setLoadingHistory(false)
      }
    }, [
      historySearch,
      historyStatusFilter,
    ])

  useEffect(() => {
    if (viewMode === 'history') {
      fetchReturnHistory()
    }
  }, [
    viewMode,
    fetchReturnHistory,
  ])

  // ─────────────────────────────────────────────────
  // DETAIL
  // ─────────────────────────────────────────────────

  const fetchReturnDetail = async (
    record: PurchaseReturnRecord
  ) => {
    setSelectedReturnDetail(record)
    setViewMode('detail')
    setLoadingDetail(true)

    try {
      const { data, error } =
        await supabase
          .from('purchase_return_items')
          .select(`
            id,
            product_id,
            batch_id,
            quantity,
            purchase_rate,
            taxable_amount,
            gst_percent,
            gst_amount,
            total_amount,
            products:product_id (
              product_name,
              sku
            ),
            inventory_batches:batch_id (
              batch_number
            )
          `)
          .eq(
            'purchase_return_id',
            record.id
          )

      if (error) throw error

      setSelectedReturnDetail({
        ...record,
        items: (data || []).map(
          (item: any) => ({
            id: item.id,
            product_name:
              item.products
                ?.product_name ||
              'Unknown',
            sku:
              item.products?.sku ||
              '',
            batch_number:
              item.inventory_batches
                ?.batch_number ||
              '-',
            quantity:
              Number(item.quantity) ||
              0,
            purchase_rate:
              Number(
                item.purchase_rate
              ) || 0,
            taxable_amount:
              Number(
                item.taxable_amount
              ) || 0,
            gst_percent:
              Number(
                item.gst_percent
              ) || 0,
            gst_amount:
              Number(
                item.gst_amount
              ) || 0,
            total_amount:
              Number(
                item.total_amount
              ) || 0,
          })
        ),
      })
    } catch (err: any) {
      setErrorMsg(
        'Failed to load return items: ' +
          (err?.message ||
            'Unknown error')
      )
    } finally {
      setLoadingDetail(false)
    }
  }

  // ─────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────

  const handleExecuteCancel =
    async () => {
      if (
        !cancelTargetId ||
        !user?.id
      ) {
        return
      }

      setCancelling(true)

      try {
        const { data, error } =
          await supabase.rpc(
            'cancel_purchase_return',
            {
              p_return_id:
                cancelTargetId,
              p_cancellation_reason:
                cancelReasonText.trim() ||
                'Admin Reversal',
              p_user_id: user.id,
            }
          )

        if (error) throw error

        if (data?.success) {
          setShowCancelModal(false)
          setCancelTargetId(null)
          setCancelReasonText('')

          if (
            viewMode === 'detail' &&
            selectedReturnDetail
          ) {
            setSelectedReturnDetail(
              (previous) =>
                previous
                  ? {
                      ...previous,
                      return_status:
                        'cancelled',
                    }
                  : null
            )
          }

          fetchReturnHistory()
        }
      } catch (err: any) {
        setErrorMsg(
          'Cancellation failed: ' +
            (err?.message ||
              'Unknown error')
        )
      } finally {
        setCancelling(false)
      }
    }

  // ─────────────────────────────────────────────────
  // AUTH LOADING
  // ─────────────────────────────────────────────────

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // ADMIN GUARD
  // ─────────────────────────────────────────────────

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center border border-red-200">
          <ShieldAlert className="w-14 h-14 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />

          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            Restricted Access
          </h2>

          <p className="text-sm sm:text-base text-gray-600 mb-6">
            Only active administrators are authorized to process Company Purchase Returns.
          </p>

          <button
            onClick={() =>
              navigate('/')
            }
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // SUCCESS
  // ─────────────────────────────────────────────────

  if (submitResult?.success) {
    const result =
      submitResult.data

    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8 max-w-xl w-full text-center border border-green-200">
          <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 mx-auto mb-4" />

          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Purchase Return Confirmed!
          </h2>

          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Stock ledger updated with RETURN_OUT and company balance adjusted.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 sm:p-6 mt-5 text-left space-y-3 border text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-gray-500">
                Return Reference:
              </span>
              <span className="font-bold text-blue-700 break-all">
                {result.return_number}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-gray-500">
                Company:
              </span>
              <span className="font-semibold">
                {result.company_name}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-gray-500">
                Original Bill:
              </span>
              <span className="font-semibold">
                {result.bill_number}
              </span>
            </div>

            <hr />

            <div className="flex justify-between">
              <span className="text-gray-500">
                Taxable Subtotal:
              </span>
              <span>
                {formatINR(
                  result.subtotal
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Tax Reversal (GST):
              </span>
              <span>
                {formatINR(
                  result.tax_amount
                )}
              </span>
            </div>

            <div className="flex justify-between text-base font-bold text-green-700">
              <span>
                Total Return Value:
              </span>
              <span>
                {formatINR(
                  result.total_amount
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 sm:mt-8">
            <button
              onClick={resetForm}
              className="w-full px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              New Return
            </button>

            <button
              onClick={() => {
                resetForm()
                setViewMode('history')
              }}
              className="w-full px-5 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2 font-medium"
            >
              <ClipboardList className="w-4 h-4" />
              View History
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────

  if (
    viewMode === 'detail' &&
    selectedReturnDetail
  ) {
    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-8">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() =>
                  setViewMode('history')
                }
                className="shrink-0 p-2.5 rounded-xl bg-white border hover:bg-slate-50"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>

              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-800 break-words">
                  Return Detail:{' '}
                  {
                    selectedReturnDetail.return_number
                  }
                </h1>

                <p className="text-xs text-gray-500">
                  Recorded on{' '}
                  {formatDate(
                    selectedReturnDetail.return_date
                  )}
                </p>
              </div>
            </div>

            <span
              className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold uppercase ${
                selectedReturnDetail.return_status ===
                'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {
                selectedReturnDetail.return_status
              }
            </span>
          </div>

          {/* HEADER CARD */}

          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="min-w-0">
              <span className="text-gray-400 block text-xs uppercase">
                Company
              </span>
              <span className="font-semibold text-gray-800 break-words">
                {
                  selectedReturnDetail.company_name
                }
              </span>
            </div>

            <div>
              <span className="text-gray-400 block text-xs uppercase">
                Purchase Bill
              </span>
              <span className="font-semibold text-gray-800">
                {
                  selectedReturnDetail.bill_number
                }
              </span>
            </div>

            <div>
              <span className="text-gray-400 block text-xs uppercase">
                Return Reason
              </span>
              <span className="font-semibold text-gray-800 break-words">
                {
                  selectedReturnDetail.reason ||
                  'N/A'
                }
              </span>
            </div>

            <div>
              <span className="text-gray-400 block text-xs uppercase">
                Total Amount
              </span>
              <span className="font-bold text-green-700 text-base">
                {formatINR(
                  selectedReturnDetail.total_amount
                )}
              </span>
            </div>
          </div>

          {/* ITEMS */}

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-semibold text-gray-700 text-sm">
              Returned Line Items
            </div>

            {loadingDetail ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                <span className="text-sm text-gray-500">
                  Loading item breakdown...
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[850px]">
                  <thead className="bg-slate-50 text-gray-600 text-xs uppercase border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left">
                        Batch
                      </th>
                      <th className="px-4 py-3 text-right">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right">
                        Taxable
                      </th>
                      <th className="px-4 py-3 text-right">
                        GST %
                      </th>
                      <th className="px-4 py-3 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {selectedReturnDetail.items?.map(
                      (item: any) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium">
                            {item.product_name}

                            {item.sku && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({item.sku})
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-gray-500">
                            {item.batch_number}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-blue-700">
                            {item.quantity}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {formatINR(
                              item.purchase_rate
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {formatINR(
                              item.taxable_amount
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {item.gst_percent}%
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {formatINR(
                              item.total_amount
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-right text-gray-600"
                      >
                        Subtotal:
                      </td>

                      <td className="px-4 py-3 text-right">
                        {formatINR(
                          selectedReturnDetail.subtotal
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-right text-gray-600"
                      >
                        Tax Amount:
                      </td>

                      <td className="px-4 py-3 text-right">
                        {formatINR(
                          selectedReturnDetail.tax_amount
                        )}
                      </td>
                    </tr>

                    <tr className="text-base text-green-700">
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-right"
                      >
                        Grand Total:
                      </td>

                      <td className="px-4 py-3 text-right font-bold">
                        {formatINR(
                          selectedReturnDetail.total_amount
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {selectedReturnDetail.return_status ===
            'completed' && (
            <div className="flex justify-stretch sm:justify-end">
              <button
                onClick={() => {
                  setCancelTargetId(
                    selectedReturnDetail.id
                  )
                  setShowCancelModal(true)
                }}
                className="w-full sm:w-auto px-5 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 flex items-center justify-center gap-2 font-medium"
              >
                <Ban className="w-4 h-4" />
                Cancel & Reverse This Return
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // HISTORY VIEW
  // ─────────────────────────────────────────────────

  if (viewMode === 'history') {
    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* HEADER */}

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setViewMode('form')
                }
                className="shrink-0 p-2.5 rounded-xl bg-white border hover:bg-slate-50"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Company Return History
                </h1>

                <p className="text-xs text-gray-500">
                  Track all outward stock returns to companies
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2">
              <button
                onClick={
                  fetchReturnHistory
                }
                className="p-2.5 rounded-xl bg-white border hover:bg-slate-50 text-gray-700 flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() =>
                  setViewMode('form')
                }
                className="px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                New Return
              </button>
            </div>
          </div>

          {/* FILTERS */}

          <div className="bg-white rounded-2xl shadow-sm border p-3 sm:p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={historySearch}
                onChange={(e) =>
                  setHistorySearch(
                    e.target.value
                  )
                }
                placeholder="Search return #, company, bill #..."
                className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>

            <select
              value={
                historyStatusFilter
              }
              onChange={(e) =>
                setHistoryStatusFilter(
                  e.target.value
                )
              }
              className="w-full md:w-auto border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="">
                All Statuses
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </div>

          {/* HISTORY */}

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {loadingHistory ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />

                <p className="text-sm text-gray-500">
                  Loading purchase return history...
                </p>
              </div>
            ) : returnHistory.length ===
              0 ? (
              <div className="p-12 sm:p-16 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />

                <p className="text-gray-500 font-medium">
                  No purchase return records found.
                </p>
              </div>
            ) : (
              <>
                {/* MOBILE CARDS */}

                <div className="block md:hidden divide-y">
                  {returnHistory.map(
                    (record) => (
                      <div
                        key={record.id}
                        onClick={() =>
                          fetchReturnDetail(
                            record
                          )
                        }
                        className="p-4 active:bg-blue-50 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-blue-700 text-sm break-all">
                              {
                                record.return_number
                              }
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(
                                record.return_date
                              )}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              record.return_status ===
                              'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {
                              record.return_status
                            }
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-500">
                              Company
                            </span>
                            <span className="font-medium text-gray-800 text-right">
                              {
                                record.company_name
                              }
                            </span>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="text-gray-500">
                              Bill
                            </span>
                            <span className="text-gray-700">
                              {
                                record.bill_number
                              }
                            </span>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="text-gray-500">
                              Return Value
                            </span>
                            <span className="font-bold text-green-700">
                              {formatINR(
                                record.total_amount
                              )}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation()
                            fetchReturnDetail(
                              record
                            )
                          }}
                          className="mt-3 w-full py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* DESKTOP TABLE */}

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-gray-600 text-xs uppercase border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          Return #
                        </th>
                        <th className="px-4 py-3 text-left">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left">
                          Company
                        </th>
                        <th className="px-4 py-3 text-left">
                          Bill #
                        </th>
                        <th className="px-4 py-3 text-right">
                          Taxable
                        </th>
                        <th className="px-4 py-3 text-right">
                          Tax
                        </th>
                        <th className="px-4 py-3 text-right">
                          Total Value
                        </th>
                        <th className="px-4 py-3 text-center">
                          Status
                        </th>
                        <th className="px-4 py-3 text-center">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {returnHistory.map(
                        (record) => (
                          <tr
                            key={record.id}
                            onClick={() =>
                              fetchReturnDetail(
                                record
                              )
                            }
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-blue-700">
                              {
                                record.return_number
                              }
                            </td>

                            <td className="px-4 py-3 text-gray-600">
                              {formatDate(
                                record.return_date
                              )}
                            </td>

                            <td className="px-4 py-3 font-medium text-gray-800">
                              {
                                record.company_name
                              }
                            </td>

                            <td className="px-4 py-3 text-gray-600">
                              {
                                record.bill_number
                              }
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatINR(
                                record.subtotal
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatINR(
                                record.tax_amount
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-bold text-green-700">
                              {formatINR(
                                record.total_amount
                              )}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                  record.return_status ===
                                  'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {
                                  record.return_status
                                }
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(
                                  event
                                ) => {
                                  event.stopPropagation()
                                  fetchReturnDetail(
                                    record
                                  )
                                }}
                                className="p-2 rounded-lg text-blue-600 hover:bg-blue-100"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────
  // MAIN FORM
  // ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-orange-100 rounded-2xl shrink-0">
              <Truck className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                Company Stock Return
              </h1>

              <p className="text-xs text-gray-500">
                Return purchased stock to suppliers & adjust stock/outstanding
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              onClick={() =>
                setViewMode('history')
              }
              className="px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-gray-700 shadow-sm"
            >
              <ClipboardList className="w-4 h-4 text-blue-600" />
              Return History
            </button>

            <button
              onClick={resetForm}
              className="px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-gray-700 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Form
            </button>
          </div>
        </div>

        {/* ERROR */}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4 flex items-start gap-3 text-red-700 text-sm">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />

            <span className="flex-1 break-words">
              {errorMsg}
            </span>

            <button
              onClick={() =>
                setErrorMsg(null)
              }
              className="text-red-400 hover:text-red-600 font-bold text-lg"
            >
              ×
            </button>
          </div>
        )}

        {/* STEP 1 */}

        <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>
              1. Select Company / Vendor
            </span>
          </div>

          <div className="relative max-w-xl">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  type="text"
                  value={
                    selectedCompanyId
                      ? selectedCompany
                          ?.company_name ||
                        ''
                      : companySearch
                  }
                  onChange={(event) => {
                    setCompanySearch(
                      event.target.value
                    )

                    setSelectedCompanyId(
                      ''
                    )

                    setShowCompanyDropdown(
                      true
                    )
                  }}
                  onFocus={() =>
                    setShowCompanyDropdown(
                      true
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      event.preventDefault()
                      handleCompanySearchClick()
                    }
                  }}
                  placeholder="Search supplier by name, GSTIN, mobile..."
                  className="w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                />

                {selectedCompanyId && (
                  <button
                    onClick={() => {
                      setSelectedCompanyId(
                        ''
                      )
                      setCompanySearch('')
                      setPurchaseBills([])
                      setSelectedBillId('')
                      setReturnItems([])
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                onClick={
                  handleCompanySearchClick
                }
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-semibold shadow-sm"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {showCompanyDropdown &&
              !selectedCompanyId && (
                <div className="absolute z-30 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y">
                  {loadingCompanies ? (
                    <div className="p-5 text-center text-sm text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </div>
                  ) : filteredCompanies.length ===
                    0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No active companies found
                    </div>
                  ) : (
                    filteredCompanies.map(
                      (company) => (
                        <button
                          key={
                            company.id
                          }
                          onClick={() => {
                            setSelectedCompanyId(
                              company.id
                            )
                            setCompanySearch(
                              ''
                            )
                            setShowCompanyDropdown(
                              false
                            )
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50/60 active:bg-blue-100 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">
                              {
                                company.company_name
                              }
                            </p>

                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {company.gst_number ||
                                company.gstin ||
                                'No GST'}

                              {company.mobile &&
                                ` • ${company.mobile}`}
                            </p>
                          </div>
                        </button>
                      )
                    )
                  )}
                </div>
              )}
          </div>
        </div>

        {/* STEP 2 */}

        {selectedCompanyId && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
              <FileText className="w-5 h-5 text-green-600" />
              <span>
                2. Select Original Purchase Bill
              </span>
            </div>

            {loadingBills ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Fetching supplier bills...
                </p>
              </div>
            ) : purchaseBills.length ===
              0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-gray-500 text-sm">
                No active purchase bills recorded for this company.
              </div>
            ) : (
              <>
                {/* MOBILE BILL CARDS */}

                <div className="block md:hidden space-y-3">
                  {purchaseBills.map(
                    (bill) => (
                      <button
                        key={bill.id}
                        onClick={() =>
                          setSelectedBillId(
                            bill.id
                          )
                        }
                        className={`w-full text-left p-4 rounded-xl border transition ${
                          selectedBillId ===
                          bill.id
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="radio"
                              name="purchase_bill_mobile"
                              checked={
                                selectedBillId ===
                                bill.id
                              }
                              onChange={() =>
                                setSelectedBillId(
                                  bill.id
                                )
                              }
                              onClick={(event) =>
                                event.stopPropagation()
                              }
                              className="mt-1 text-blue-600"
                            />

                            <div className="min-w-0">
                              <p className="font-bold text-blue-700 break-all">
                                {
                                  bill.bill_number
                                }
                              </p>

                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(
                                  bill.bill_date
                                )}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 uppercase">
                            {
                              bill.purchase_status
                            }
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t">
                          <div>
                            <p className="text-[10px] uppercase text-gray-400">
                              Taxable
                            </p>
                            <p className="font-semibold text-gray-800 text-sm">
                              {formatINR(
                                bill.taxable_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase text-gray-400">
                              Total
                            </p>
                            <p className="font-bold text-gray-900 text-sm">
                              {formatINR(
                                bill.total_amount
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>

                {/* DESKTOP BILL TABLE */}

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-gray-600 text-xs uppercase border-b">
                      <tr>
                        <th className="px-3 py-2.5 text-left w-10" />
                        <th className="px-3 py-2.5 text-left">
                          Bill Number
                        </th>
                        <th className="px-3 py-2.5 text-left">
                          Date
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Taxable
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Total Amount
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {purchaseBills.map(
                        (bill) => (
                          <tr
                            key={bill.id}
                            onClick={() =>
                              setSelectedBillId(
                                bill.id
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedBillId ===
                              bill.id
                                ? 'bg-blue-50/80 font-medium'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <input
                                type="radio"
                                name="purchase_bill"
                                checked={
                                  selectedBillId ===
                                  bill.id
                                }
                                onChange={() =>
                                  setSelectedBillId(
                                    bill.id
                                  )
                                }
                                className="text-blue-600"
                              />
                            </td>

                            <td className="px-3 py-2.5 text-blue-700 font-semibold">
                              {
                                bill.bill_number
                              }
                            </td>

                            <td className="px-3 py-2.5 text-gray-600">
                              {formatDate(
                                bill.bill_date
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              {formatINR(
                                bill.taxable_amount
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-right font-semibold">
                              {formatINR(
                                bill.total_amount
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 uppercase">
                                {
                                  bill.purchase_status
                                }
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 */}

        {selectedBillId && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
                <Package className="w-5 h-5 text-orange-600" />
                <span>
                  3. Enter Return Quantities
                </span>
              </div>

              <span className="text-xs text-gray-500">
                Return Qty ≤ min(Remaining on Bill, Current Batch Stock)
              </span>
            </div>

            {loadingItems ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                <span className="text-sm text-gray-500">
                  Loading bill items & stock status...
                </span>
              </div>
            ) : returnItems.length ===
              0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-gray-500 text-sm">
                No returnable items found on this bill.
              </div>
            ) : (
              <>
                {/* MOBILE ITEM CARDS */}

                <div className="block md:hidden space-y-3">
                  {returnItems.map(
                    (item, index) => (
                      <div
                        key={
                          item.purchase_bill_item_id
                        }
                        className={`rounded-xl border p-4 ${
                          item.return_quantity >
                          0
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 break-words">
                              {
                                item.product_name
                              }

                              {item.sku && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({item.sku})
                                </span>
                              )}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              Batch/Lot:{' '}
                              {item.batch_number ||
                                item.lot_number ||
                                '-'}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs font-semibold text-gray-500">
                            {item.unit_name}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="bg-slate-50 rounded-lg p-2.5">
                            <p className="text-[10px] uppercase text-gray-400">
                              Purchased
                            </p>
                            <p className="font-bold">
                              {
                                item.original_qty
                              }
                            </p>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-2.5">
                            <p className="text-[10px] uppercase text-gray-400">
                              Prev. Returned
                            </p>
                            <p className="font-bold text-red-600">
                              {item.already_returned >
                              0
                                ? item.already_returned
                                : '-'}
                            </p>
                          </div>

                          <div className="bg-blue-50 rounded-lg p-2.5">
                            <p className="text-[10px] uppercase text-blue-500">
                              Batch Stock
                            </p>
                            <p className="font-bold text-blue-700">
                              {
                                item.current_batch_stock
                              }
                            </p>
                          </div>

                          <div className="bg-green-50 rounded-lg p-2.5">
                            <p className="text-[10px] uppercase text-green-600">
                              Eligible
                            </p>
                            <p className="font-bold text-green-700">
                              {
                                item.max_returnable
                              }
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-gray-500">
                              Return Qty
                            </label>

                            <input
                              type="number"
                              min="0"
                              max={
                                item.max_returnable
                              }
                              step="any"
                              value={
                                item.return_quantity ||
                                ''
                              }
                              onChange={(
                                event
                              ) =>
                                handleQuantityChange(
                                  index,
                                  event.target
                                    .value
                                )
                              }
                              disabled={
                                item.max_returnable <=
                                0
                              }
                              placeholder="0"
                              className="mt-1 w-full px-3 py-2.5 border rounded-xl text-center font-bold text-orange-700 focus:ring-2 focus:ring-orange-300 outline-none disabled:bg-gray-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-semibold text-gray-500">
                              Return Value
                            </label>

                            <div className="mt-1 px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-gray-800 text-center">
                              {item.return_total >
                              0
                                ? formatINR(
                                    item.return_total
                                  )
                                : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between text-xs mt-3 pt-3 border-t text-gray-500">
                          <span>
                            Rate:{' '}
                            {formatINR(
                              item.purchase_rate
                            )}
                          </span>

                          <span>
                            GST:{' '}
                            {
                              item.gst_percent
                            }
                            %
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* DESKTOP ITEM TABLE */}

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead className="bg-slate-50 text-gray-600 text-xs uppercase border-b">
                      <tr>
                        <th className="px-3 py-2.5 text-left">
                          Product
                        </th>
                        <th className="px-3 py-2.5 text-left">
                          Batch / Lot
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Purchased
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Prev. Returned
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Batch Stock
                        </th>
                        <th className="px-3 py-2.5 text-right font-bold text-green-700">
                          Eligible
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Return Qty
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Rate
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          GST %
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Return Value
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {returnItems.map(
                        (item, index) => (
                          <tr
                            key={
                              item.purchase_bill_item_id
                            }
                            className={
                              item.return_quantity >
                              0
                                ? 'bg-orange-50/50'
                                : 'hover:bg-slate-50'
                            }
                          >
                            <td className="px-3 py-2.5 font-medium">
                              {
                                item.product_name
                              }

                              {item.sku && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({item.sku})
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-gray-500 text-xs">
                              {item.batch_number ||
                                item.lot_number ||
                                '-'}
                            </td>

                            <td className="px-3 py-2.5 text-right text-gray-600">
                              {
                                item.original_qty
                              }
                            </td>

                            <td className="px-3 py-2.5 text-right text-red-600">
                              {item.already_returned >
                              0
                                ? item.already_returned
                                : '-'}
                            </td>

                            <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                              {
                                item.current_batch_stock
                              }
                            </td>

                            <td className="px-3 py-2.5 text-right font-bold text-green-700">
                              {
                                item.max_returnable
                              }
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                max={
                                  item.max_returnable
                                }
                                step="any"
                                value={
                                  item.return_quantity ||
                                  ''
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleQuantityChange(
                                    index,
                                    event.target
                                      .value
                                  )
                                }
                                disabled={
                                  item.max_returnable <=
                                  0
                                }
                                placeholder="0"
                                className="w-24 px-2 py-1.5 border rounded-lg text-center font-bold text-orange-700 focus:ring-2 focus:ring-orange-300 outline-none disabled:bg-gray-100"
                              />
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              {formatINR(
                                item.purchase_rate
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              {
                                item.gst_percent
                              }
                              %
                            </td>

                            <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                              {item.return_total >
                              0
                                ? formatINR(
                                    item.return_total
                                  )
                                : '-'}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL BAR */}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs uppercase text-blue-600 font-semibold">
                      Total Products
                    </p>

                    <p className="text-lg sm:text-xl font-bold text-blue-800 mt-1">
                      {
                        returnTotals.count
                      }
                    </p>

                    <p className="text-[10px] sm:text-xs text-blue-500 mt-1">
                      {
                        returnTotals.totalQty
                      }{' '}
                      total units
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs uppercase text-slate-600 font-semibold">
                      Taxable Amount
                    </p>

                    <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1 break-all">
                      {formatINR(
                        returnTotals.subtotal
                      )}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs uppercase text-purple-600 font-semibold">
                      GST Reversal
                    </p>

                    <p className="text-lg sm:text-xl font-bold text-purple-800 mt-1 break-all">
                      {formatINR(
                        returnTotals.gstTotal
                      )}
                    </p>
                  </div>

                  <div className="col-span-2 lg:col-span-1 bg-green-50 border-2 border-green-300 rounded-xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs uppercase text-green-700 font-semibold flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" />
                      Total Return Amount
                    </p>

                    <p className="text-xl sm:text-2xl font-bold text-green-800 mt-1 break-all">
                      {formatINR(
                        returnTotals.grandTotal
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4 */}

        {returnTotals.count > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Return Date *
                </label>

                <input
                  type="date"
                  value={returnDate}
                  onChange={(event) =>
                    setReturnDate(
                      event.target.value
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Return Reason *
                </label>

                <select
                  value={returnReason}
                  onChange={(event) =>
                    setReturnReason(
                      event.target.value
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                >
                  <option value="Excess stock">
                    Excess stock
                  </option>
                  <option value="Damaged goods">
                    Damaged goods
                  </option>
                  <option value="Expired products">
                    Expired products
                  </option>
                  <option value="Wrong items received">
                    Wrong items received
                  </option>
                  <option value="Quality issue">
                    Quality issue
                  </option>
                  <option value="Rate difference">
                    Rate difference
                  </option>
                  <option value="Company recall">
                    Company recall
                  </option>
                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {returnReason ===
                'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Specify Reason *
                  </label>

                  <input
                    type="text"
                    value={
                      customReason
                    }
                    onChange={(event) =>
                      setCustomReason(
                        event.target
                          .value
                      )
                    }
                    placeholder="Enter custom reason..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                </div>
              )}
            </div>

            {/* SUMMARY */}

            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="space-y-1 text-sm">
                <p className="text-gray-500">
                  Returning{' '}
                  <strong className="text-gray-800">
                    {
                      returnTotals.count
                    }{' '}
                    items
                  </strong>{' '}
                  (
                  {
                    returnTotals.totalQty
                  }{' '}
                  total units)
                </p>

                <p className="text-gray-500 text-xs sm:text-sm">
                  Taxable:{' '}
                  {formatINR(
                    returnTotals.subtotal
                  )}{' '}
                  | GST Reversal:{' '}
                  {formatINR(
                    returnTotals.gstTotal
                  )}
                </p>
              </div>

              <div className="text-left md:text-right">
                <span className="text-xs uppercase text-gray-400 block font-semibold">
                  Total Return Value
                </span>

                <span className="text-2xl font-bold text-green-700">
                  {formatINR(
                    returnTotals.grandTotal
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:justify-end gap-3">
              <button
                onClick={resetForm}
                className="w-full md:w-auto px-5 py-2.5 bg-slate-100 text-gray-700 rounded-xl hover:bg-slate-200 font-medium"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  setShowConfirmation(
                    true
                  )
                }
                className="w-full md:w-auto px-6 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Review & Confirm Return
              </button>
            </div>
          </div>
        )}

        {/* LAST RETURN */}

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <History className="w-5 h-5 text-blue-600 shrink-0" />

              <h3 className="font-semibold text-gray-800 text-sm">
                Last Purchase Return
              </h3>
            </div>

            <button
              onClick={() =>
                setViewMode('history')
              }
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0"
            >
              View All
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </button>
          </div>

          {loadingLastReturn ? (
            <div className="p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
            </div>
          ) : !lastReturn ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No previous returns recorded yet.
            </div>
          ) : (
            <div
              onClick={() =>
                fetchReturnDetail(
                  lastReturn
                )
              }
              className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              {/* MOBILE */}

              <div className="block md:hidden">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase font-semibold">
                      Return #
                    </p>

                    <p className="font-bold text-blue-700 text-sm break-all mt-0.5">
                      {
                        lastReturn.return_number
                      }
                    </p>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      lastReturn.return_status ===
                      'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {
                      lastReturn.return_status
                    }
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">
                      Date
                    </p>

                    <p className="text-sm text-gray-700 mt-0.5">
                      {formatDate(
                        lastReturn.return_date
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">
                      Bill #
                    </p>

                    <p className="text-sm text-gray-700 mt-0.5">
                      {
                        lastReturn.bill_number
                      }
                    </p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase font-semibold">
                      Company
                    </p>

                    <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">
                      {
                        lastReturn.company_name
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">
                      Total Amount
                    </p>

                    <p className="text-sm font-bold text-green-700 mt-0.5">
                      {formatINR(
                        lastReturn.total_amount
                      )}
                    </p>
                  </div>

                  <div className="flex justify-end items-end">
                    <button
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation()

                        fetchReturnDetail(
                          lastReturn
                        )
                      }}
                      className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* DESKTOP */}

              <div className="hidden md:grid grid-cols-6 gap-4 items-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    Return #
                  </p>

                  <p className="font-bold text-blue-700 text-sm mt-0.5">
                    {
                      lastReturn.return_number
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    Date
                  </p>

                  <p className="text-sm text-gray-700 mt-0.5">
                    {formatDate(
                      lastReturn.return_date
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    Company
                  </p>

                  <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">
                    {
                      lastReturn.company_name
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    Bill #
                  </p>

                  <p className="text-sm text-gray-700 mt-0.5">
                    {
                      lastReturn.bill_number
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    Total Amount
                  </p>

                  <p className="text-sm font-bold text-green-700 mt-0.5">
                    {formatINR(
                      lastReturn.total_amount
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      lastReturn.return_status ===
                      'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {
                      lastReturn.return_status
                    }
                  </span>

                  <button
                    onClick={(
                      event
                    ) => {
                      event.stopPropagation()

                      fetchReturnDetail(
                        lastReturn
                      )
                    }}
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {lastReturn.reason && (
                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  <span className="font-semibold">
                    Reason:
                  </span>{' '}
                  {lastReturn.reason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONFIRM MODAL */}

        {showConfirmation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="flex items-center gap-3 text-orange-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />

                <h3 className="text-lg font-bold text-gray-800">
                  Confirm Purchase Return
                </h3>
              </div>

              <div className="bg-orange-50/60 rounded-xl p-4 border border-orange-200 text-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-gray-600">
                    Company:
                  </span>

                  <span className="font-semibold sm:text-right">
                    {
                      selectedCompany?.company_name
                    }
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-gray-600">
                    Purchase Bill:
                  </span>

                  <span className="font-semibold">
                    {
                      selectedBill?.bill_number
                    }
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-gray-600">
                    Reason:
                  </span>

                  <span className="font-semibold sm:text-right break-words">
                    {returnReason ===
                    'Other'
                      ? customReason
                      : returnReason}
                  </span>
                </div>

                <div className="flex justify-between gap-3 font-bold text-green-800 pt-2 border-t border-orange-200">
                  <span>
                    Grand Total:
                  </span>

                  <span className="text-right">
                    {formatINR(
                      returnTotals.grandTotal
                    )}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                ⚠️ Confirming will automatically deduct inventory via a{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-orange-600">
                  RETURN_OUT
                </code>{' '}
                movement and reduce the vendor's outstanding ledger balance atomically.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() =>
                    setShowConfirmation(
                      false
                    )
                  }
                  disabled={submitting}
                  className="w-full px-5 py-3 bg-slate-100 text-gray-700 rounded-xl hover:bg-slate-200 font-medium"
                >
                  Go Back
                </button>

                <button
                  onClick={
                    handleSubmitReturn
                  }
                  disabled={submitting}
                  className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Confirm & Process Return'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CANCEL MODAL */}

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />

                <h3 className="text-lg font-bold text-gray-800">
                  Cancel Purchase Return
                </h3>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                This will reverse all stock deductions via STOCK_IN and reinstate the company payable.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Reason for Cancellation *
                </label>

                <input
                  type="text"
                  value={
                    cancelReasonText
                  }
                  onChange={(event) =>
                    setCancelReasonText(
                      event.target.value
                    )
                  }
                  placeholder="Enter cancellation reason..."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCancelModal(
                      false
                    )
                    setCancelTargetId(
                      null
                    )
                  }}
                  disabled={cancelling}
                  className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-slate-200"
                >
                  Dismiss
                </button>

                <button
                  onClick={
                    handleExecuteCancel
                  }
                  disabled={
                    cancelling ||
                    !cancelReasonText.trim()
                  }
                  className="w-full px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelling && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  Confirm Reversal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DROPDOWN OUTSIDE CLICK */}

        {showCompanyDropdown && (
          <div
            className="fixed inset-0 z-20"
            onClick={() =>
              setShowCompanyDropdown(
                false
              )
            }
          />
        )}
      </div>
    </div>
  )
}

export default CompanyPurchaseReturn