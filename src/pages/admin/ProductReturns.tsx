// src/pages/admin/ProductReturns.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RotateCcw, Plus, Loader2, RefreshCw, ShieldAlert, Info, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Farmer {
  id: string
  farmer_name: string | null
  farmer_id: string | null
}

interface SalesBill {
  id: string
  bill_number: string | null
  bill_date: string | null
  total_amount: number
  bill_type?: string | null
  is_physical?: boolean
  notes?: string | null
}

interface SalesBillItem {
  id: string
  product_id: string | null
  batch_id: string | null
  product_name: string | null
  quantity: number
  rate: number
  purchase_rate?: number
  total_amount: number
  already_returned?: number
  remaining_returnable?: number
}

interface ReturnRow {
  id: string
  return_number: string | null
  return_date: string | null
  total_amount: number
  reason: string | null
  return_status: string | null
  farmer: {
    farmer_name: string | null
    farmer_id: string | null
  } | null
}

interface ReturnRpcResult {
  success?: boolean
  return_id: string
  return_number: string
  return_amount: number
  return_rate_used?: number
  return_quantity: number
  remaining_returnable_quantity: number
  new_batch_quantity: number
  outstanding_before?: number
  new_outstanding: number
  customer_credit?: number
  outstanding_reduced_by?: number
}

const formatINR = (value: number) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function safeQty(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

export default function ProductReturns() {
  const { role, loading: authLoading } = useAuth()

  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [bills, setBills] = useState<SalesBill[]>([])
  const [billItems, setBillItems] = useState<SalesBillItem[]>([])
  const [returnsList, setReturnsList] = useState<ReturnRow[]>([])

  const [farmerId, setFarmerId] = useState('')
  const [billId, setBillId] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [customRate, setCustomRate] = useState<string>('')
  const [reason, setReason] = useState('')
  const [currentOs, setCurrentOs] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadingBills, setLoadingBills] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const isMounted = useRef(true)
  const saveLockRef = useRef(false)
  const farmersReq = useRef(0)
  const billsReq = useRef(0)
  const itemsReq = useRef(0)

  const selectedItem = useMemo(
    () => billItems.find((item) => item.id === itemId) || null,
    [billItems, itemId]
  )

  const selectedBill = useMemo(
    () => bills.find((b) => b.id === billId) || null,
    [bills, billId]
  )

  const isCashBill = selectedBill?.bill_type === 'cash'

  const remainingForSelected = selectedItem
    ? safeQty(selectedItem.remaining_returnable ?? selectedItem.quantity)
    : 0

  // When selectedItem changes, default the custom return rate to purchase_rate or sale_rate
  useEffect(() => {
    if (selectedItem) {
      const rateToUse = selectedItem.purchase_rate && selectedItem.purchase_rate > 0 
        ? selectedItem.purchase_rate 
        : selectedItem.rate
      setCustomRate(String(rateToUse || ''))
    } else {
      setCustomRate('')
    }
  }, [selectedItem])

  const loadFarmerOs = useCallback(async (fid: string) => {
    if (!fid) {
      setCurrentOs(null)
      return
    }
    try {
      await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: fid })
      const { data } = await supabase
        .from('credit_accounts')
        .select('current_outstanding')
        .eq('farmer_id', fid)
        .maybeSingle()
      if (isMounted.current) {
        setCurrentOs(safeQty(data?.current_outstanding))
      }
    } catch {
      if (isMounted.current) setCurrentOs(null)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    if (role !== 'admin') return
    const req = ++farmersReq.current

    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in again.')
        return
      }

      const [farmersResult, returnsResult] = await Promise.all([
        supabase
          .from('farmers')
          .select('id, farmer_name, farmer_id')
          .eq('account_status', 'active')
          .order('farmer_name', { ascending: true }),
        supabase
          .from('returns')
          .select(
            `
            id,
            return_number,
            return_date,
            total_amount,
            reason,
            return_status,
            farmer:farmers(farmer_name, farmer_id)
          `
          )
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (req !== farmersReq.current || !isMounted.current) return
      if (farmersResult.error) throw farmersResult.error
      if (returnsResult.error) throw returnsResult.error

      setFarmers(
        (farmersResult.data || []).map((farmer) => ({
          id: farmer.id,
          farmer_name: farmer.farmer_name ?? null,
          farmer_id: farmer.farmer_id ?? null,
        }))
      )

      setReturnsList(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (returnsResult.data || []).map((row: any) => ({
          id: row.id,
          return_number: row.return_number ?? null,
          return_date: row.return_date ?? null,
          total_amount: Number(row.total_amount || 0),
          reason: row.reason ?? null,
          return_status: row.return_status ?? null,
          farmer: Array.isArray(row.farmer) ? row.farmer[0] || null : row.farmer || null,
        }))
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load return data.'
      toast.error(message)
    } finally {
      if (isMounted.current && req === farmersReq.current) setLoading(false)
    }
  }, [role])

  const loadBillsForFarmer = useCallback(async (selectedFarmerId: string) => {
    const req = ++billsReq.current
    setBills([])
    setBillItems([])
    setBillId('')
    setItemId('')
    if (!selectedFarmerId) return

    try {
      setLoadingBills(true)
      
      const [salesRes, physicalRes] = await Promise.all([
        supabase
          .from('sales_bills')
          .select('id, bill_number, bill_date, total_amount, bill_type')
          .eq('farmer_id', selectedFarmerId)
          .eq('bill_status', 'active')
          .order('bill_date', { ascending: false })
          .limit(100),
        supabase
          .from('physical_bills')
          .select('id, bill_number, bill_date, bill_amount, transaction_type, notes')
          .eq('farmer_id', selectedFarmerId)
          .eq('status', 'active')
          .order('bill_date', { ascending: false })
          .limit(100)
      ])

      if (req !== billsReq.current || !isMounted.current) return
      if (salesRes.error) throw salesRes.error
      if (physicalRes.error) throw physicalRes.error

      const mappedSales = (salesRes.data || []).map((bill) => ({
        id: bill.id,
        bill_number: bill.bill_number ?? null,
        bill_date: bill.bill_date ?? null,
        total_amount: Number(bill.total_amount || 0),
        bill_type: bill.bill_type ?? null,
        is_physical: false,
      }))

      const mappedPhysical = (physicalRes.data || []).map((pb) => ({
        id: pb.id,
        bill_number: pb.bill_number ?? null,
        bill_date: pb.bill_date ?? null,
        total_amount: Number(pb.bill_amount || 0),
        bill_type: pb.transaction_type ?? null,
        is_physical: true,
        notes: pb.notes
      }))

      const combined = [...mappedSales, ...mappedPhysical].sort((a, b) =>
        (b.bill_date || '').localeCompare(a.bill_date || '')
      )

      setBills(combined)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load farmer bills.')
    } finally {
      if (isMounted.current && req === billsReq.current) setLoadingBills(false)
    }
  }, [])

  const loadItemsForBill = useCallback(async (selectedBillId: string) => {
    const req = ++itemsReq.current
    setBillItems([])
    setItemId('')
    if (!selectedBillId) return

    try {
      setLoadingItems(true)

      const targetBill = bills.find((b) => b.id === selectedBillId)
      if (targetBill?.is_physical) {
        const { data: retRows, error: retErr } = await supabase
          .from('returns')
          .select('total_amount')
          .eq('original_bill_id', selectedBillId)
          .in('return_status', ['approved', 'completed'])

        if (retErr) throw retErr

        const already = (retRows || []).reduce((sum, r) => sum + safeQty(r.total_amount), 0)
        const remaining = Math.max(0, Number((targetBill.total_amount - already).toFixed(2)))

        if (req !== itemsReq.current || !isMounted.current) return

        setBillItems([
          {
            id: targetBill.id,
            product_id: null,
            batch_id: 'PHYSICAL_BATCH_BYPASS',
            product_name: `पर्ची बिल वापसी (Physical Bill Return) ${targetBill.notes ? ' - ' + targetBill.notes : ''}`,
            quantity: 1,
            rate: targetBill.total_amount,
            purchase_rate: targetBill.total_amount,
            total_amount: targetBill.total_amount,
            already_returned: already,
            remaining_returnable: remaining,
          },
        ])
        setItemId(targetBill.id)
        return
      }

      // Load digital bill items with batch purchase_rate
      const { data, error } = await supabase
        .from('sales_bill_items')
        .select('id, product_id, batch_id, product_name, quantity, rate, total_amount')
        .eq('sales_bill_id', selectedBillId)
        .order('created_at', { ascending: true })

      if (req !== itemsReq.current || !isMounted.current) return
      if (error) throw error

      const items = data || []
      const itemIds = items.map((i) => i.id)
      const batchIds = items.map((i) => i.batch_id).filter(Boolean) as string[]

      // Fetch batch purchase rates
      let batchRateMap: Record<string, number> = {}
      if (batchIds.length > 0) {
        const { data: batchData } = await supabase
          .from('inventory_batches')
          .select('id, purchase_rate')
          .in('id', batchIds)

        for (const b of batchData || []) {
          if (b.id) batchRateMap[b.id] = safeQty(b.purchase_rate)
        }
      }

      let returnedMap: Record<string, number> = {}
      if (itemIds.length > 0) {
        const { data: retRows } = await supabase
          .from('return_items')
          .select('original_bill_item_id, quantity, return:returns!inner(return_status)')
          .in('original_bill_item_id', itemIds)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of (retRows as any[]) || []) {
          const st = row.return?.return_status
          if (st && !['approved', 'completed', 'pending'].includes(st)) continue
          const id = row.original_bill_item_id
          if (!id) continue
          returnedMap[id] = (returnedMap[id] || 0) + safeQty(row.quantity)
        }
      }

      if (req !== itemsReq.current || !isMounted.current) return

      setBillItems(
        items.map((item) => {
          const already = returnedMap[item.id] || 0
          const qty = safeQty(item.quantity)
          const pRate = item.batch_id ? batchRateMap[item.batch_id] : 0
          return {
            id: item.id,
            product_id: item.product_id ?? null,
            batch_id: item.batch_id ?? null,
            product_name: item.product_name ?? null,
            quantity: qty,
            rate: safeQty(item.rate),
            purchase_rate: pRate > 0 ? pRate : safeQty(item.rate),
            total_amount: safeQty(item.total_amount),
            already_returned: already,
            remaining_returnable: Math.max(0, Number((qty - already).toFixed(3))),
          }
        })
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bill items.')
    } finally {
      if (isMounted.current && req === itemsReq.current) setLoadingItems(false)
    }
  }, [bills])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') void loadInitialData()
    return () => {
      isMounted.current = false
      farmersReq.current += 1
      billsReq.current += 1
      itemsReq.current += 1
    }
  }, [loadInitialData, role, authLoading])

  const handleFarmerChange = (value: string) => {
    setFarmerId(value)
    void loadBillsForFarmer(value)
    void loadFarmerOs(value)
  }

  const handleBillChange = (value: string) => {
    setBillId(value)
    void loadItemsForBill(value)
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (saveLockRef.current || saving) return

    if (!farmerId || !billId || !itemId) {
      toast.error('Farmer, Bill और Item select करें.')
      return
    }

    if (!reason.trim()) {
      toast.error('Return reason दर्ज करें.')
      return
    }

    const returnQty = safeQty(qty)
    const isPhysicalReturn = selectedBill?.is_physical === true

    if (
      !Number.isFinite(returnQty) ||
      returnQty <= 0 ||
      (!isPhysicalReturn && !Number.isSafeInteger(returnQty))
    ) {
      toast.error(
        isPhysicalReturn
          ? 'Valid return amount दर्ज करें.'
          : 'Return quantity केवल पूर्ण संख्या में दर्ज करें (1, 2, 3...).'
      )
      return
    }
    if (!selectedItem) {
      toast.error('Selected bill item नहीं मिला.')
      return
    }

    const isPhysical = selectedBill?.is_physical === true
    if (!isPhysical && !selectedItem.batch_id) {
      toast.error('इस bill item का batch available नहीं है। Stock-safe return process नहीं हो सकता.')
      return
    }

    if (isPhysical) {
      if (returnQty > remainingForSelected) {
        toast.error(`Return राशि शेष सीमा (₹${formatINR(remainingForSelected)}) से अधिक नहीं हो सकती!`)
        return
      }
    } else {
      if (returnQty > remainingForSelected) {
        toast.error(
          `Return मात्रा शेष returnable qty (${remainingForSelected}) से अधिक नहीं हो सकती!`
        )
        return
      }
    }

    saveLockRef.current = true
    setSaving(true)

    try {
      let rpcName = 'process_product_return'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any = {
        p_farmer_id: farmerId,
        p_bill_id: billId,
        p_bill_item_id: itemId,
        p_quantity: returnQty,
        p_reason: reason.trim(),
        p_return_rate: safeQty(customRate) > 0 ? safeQty(customRate) : null,
      }

      if (isPhysical) {
        rpcName = 'process_physical_return'
        payload = {
          p_farmer_id: farmerId,
          p_physical_bill_id: billId,
          p_return_amount: returnQty,
          p_reason: reason.trim(),
        }
      }

      const { data, error } = await supabase.rpc(rpcName, payload)
      if (error) throw error

      const result = data as ReturnRpcResult
      const osAfter = safeQty(result.new_outstanding)
      const osBefore = safeQty(result.outstanding_before)
      const credit = safeQty(result.customer_credit)
      const reduced = safeQty(result.outstanding_reduced_by)

      let msg = `Return ${result.return_number} saved. Amount ₹${formatINR(safeQty(result.return_amount))}.`
      
      if (isCashBill) {
        msg += ' स्टॉक रीस्टोर हो गया। नकद (Cash) बिल होने के कारण खाता अपरिवर्तित रहा।'
      } else {
        msg += ` Outstanding: ₹${formatINR(osBefore)} → ₹${formatINR(osAfter)}.`
        if (osBefore <= 0 || reduced === 0) {
          msg += ' (Fully paid / zero OS — outstanding not reduced below ₹0.)'
        }
        if (credit > 0) {
          msg += ` Customer credit position ₹${formatINR(credit)}.`
        }
      }

      toast.success(msg, { duration: 6000 })

      setQty('1')
      setReason('')
      setItemId('')

      await Promise.all([
        loadInitialData(),
        loadBillsForFarmer(farmerId),
        loadItemsForBill(billId),
        loadFarmerOs(farmerId),
      ])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Return process failed.')
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setSaving(false)
    }
  }

  const filteredReturns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return returnsList
    return returnsList.filter((row) => {
      const farmerName = (row.farmer?.farmer_name || '').toLowerCase()
      const farmerCode = (row.farmer?.farmer_id || '').toLowerCase()
      const retNo = (row.return_number || '').toLowerCase()
      const reasonText = (row.reason || '').toLowerCase()
      
      return (
        farmerName.includes(q) ||
        farmerCode.includes(q) ||
        retNo.includes(q) ||
        reasonText.includes(q)
      )
    })
  }, [returnsList, searchQuery])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Product Returns ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="text-amber-400" size={28} />
            Product Returns (सामान वापसी काउंटर)
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Original bill + stock restore + safe outstanding (never below ₹0)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadInitialData()}
          disabled={loading || saving}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3 text-xs text-amber-900 space-y-1">
        <p className="flex gap-2 font-semibold">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            <strong>Outstanding rule:</strong> Return stock hamesha restore hoga. Return calculation company purchase rate par hoti hai.
          </span>
        </p>
      </div>

      {isCashBill && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
          <Info className="text-amber-700 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-bold text-amber-900 text-sm">नकद बिल रिटर्न (Cash Bill Return)</p>
            <p className="mt-1 font-semibold">यह एक नकद (CASH) बिल है। सामान वापस करने पर स्टॉक (Inventory) बढ़ जाएगा, लेकिन उधारी खाता (Outstanding Balance) कम नहीं होगा।</p>
          </div>
        </div>
      )}

      {authLoading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin text-emerald-800 mx-auto" />
        </div>
      ) : (
        <form onSubmit={handleReturn} className="bg-white p-4 sm:p-6 rounded-3xl border shadow-sm space-y-4 text-xs sm:text-sm">
          {farmerId && currentOs !== null && (
            <div className="bg-slate-50 border rounded-xl p-3 flex justify-between text-xs font-bold">
              <span className="text-slate-600">Current Outstanding (before return)</span>
              <span className={`font-mono ${currentOs > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                ₹{formatINR(currentOs)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="return-farmer" className="block font-bold text-gray-700 mb-1">
                Farmer *
              </label>
              <select
                id="return-farmer"
                required
                value={farmerId}
                disabled={loading || saving}
                onChange={(e) => handleFarmerChange(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl bg-white font-bold disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
              >
                <option value="">-- Select Farmer --</option>
                {farmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.farmer_name || 'Unnamed'} ({farmer.farmer_id || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="return-bill" className="block font-bold text-gray-700 mb-1">
                Original Bill (Digital / Physical) *
              </label>
              <select
                id="return-bill"
                required
                value={billId}
                disabled={!farmerId || loadingBills || saving}
                onChange={(e) => handleBillChange(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl bg-white font-bold disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
              >
                <option value="">{loadingBills ? 'Loading bills...' : '-- Select Bill --'}</option>
                {bills.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {`${bill.is_physical ? '📝 ' : '💻 '}${bill.bill_number || 'N/A'} | ${bill.bill_date || '—'} | ₹${formatINR(bill.total_amount)}${bill.bill_type ? ' | ' + bill.bill_type.toUpperCase() : ''}${bill.is_physical ? ' (PHYSICAL)' : ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="return-item" className="block font-bold text-gray-700 mb-1">
                Bill Item / Return Line *
              </label>
              <select
                id="return-item"
                required
                value={itemId}
                disabled={!billId || loadingItems || saving}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl bg-white font-bold disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
              >
                <option value="">
                  {loadingItems ? 'Loading bill items...' : '-- Select Item --'}
                </option>
                {billItems.map((item) => (
                  <option key={item.id} value={item.id} disabled={(item.remaining_returnable || 0) <= 0}>
                    {`${item.product_name || 'Product'}${selectedBill?.is_physical ? '' : ' | Sold Qty: ' + item.quantity} | Remaining: ${selectedBill?.is_physical ? '₹' + formatINR(item.remaining_returnable || 0) : item.remaining_returnable}${(item.remaining_returnable || 0) <= 0 ? ' | FULLY RETURNED' : ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="return-qty" className="block font-bold text-gray-700 mb-1">
                {selectedBill?.is_physical ? 'Return Amount (₹ रुपये) *' : 'Return Quantity *'}
              </label>
              <input
                id="return-qty"
                type="number"
                step={selectedBill?.is_physical ? '0.01' : '1'}
                min={selectedBill?.is_physical ? '0.01' : '1'}
                required
                value={qty}
                disabled={saving}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    !selectedBill?.is_physical &&
                    ['.', ',', 'e', 'E', '+', '-'].includes(e.key)
                  ) {
                    e.preventDefault()
                  }
                }}
                className="w-full p-2.5 border border-gray-200 rounded-xl font-black disabled:opacity-50 text-xs sm:text-sm"
              />
            </div>

            {!selectedBill?.is_physical && selectedItem && (
              <div>
                <label htmlFor="return-rate" className="block font-bold text-emerald-800 mb-1">
                  Return Rate per unit (₹) *
                  <span className="text-[10px] text-gray-500 font-normal ml-1">
                    (Default: Company Purchase Cost)
                  </span>
                </label>
                <input
                  id="return-rate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={customRate}
                  disabled={saving}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-full p-2.5 border border-emerald-300 rounded-xl font-black bg-emerald-50/50 text-emerald-950 text-xs sm:text-sm"
                />
                <div className="text-[11px] text-gray-500 mt-1 space-y-0.5 font-semibold">
                  <p>
                    Selling Price: <strong>₹{formatINR(selectedItem.rate)}</strong> | Company Cost:{' '}
                    <strong className="text-emerald-700">₹{formatINR(selectedItem.purchase_rate || 0)}</strong>
                  </p>
                  <p className="text-emerald-800 font-bold">
                    Est. Total Return Credit: ₹{formatINR(safeQty(qty) * safeQty(customRate))}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="return-reason" className="block font-bold text-gray-700 mb-1">
              Reason *
            </label>
            <input
              id="return-reason"
              type="text"
              required
              maxLength={500}
              value={reason}
              disabled={saving}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-xl disabled:opacity-50 text-xs sm:text-sm font-semibold"
              placeholder="Damaged / Wrong item / Farmer return"
            />
          </div>

          <button
            type="submit"
            disabled={
              saving ||
              loading ||
              loadingBills ||
              loadingItems ||
              !farmerId ||
              !billId ||
              !itemId ||
              remainingForSelected <= 0
            }
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-xs sm:text-sm"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing Secure Return...
              </>
            ) : (
              <>
                <Plus size={16} />
                Process Return
              </>
            )}
          </button>
        </form>
      )}

      {/* Return History Table */}
      <div className="bg-white rounded-3xl border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <RotateCcw size={16} className="text-emerald-700" />
              Recent Returns History
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Showing {filteredReturns.length} of {returnsList.length} returns
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by farmer, return no, reason..."
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 text-gray-500 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" aria-label="Recent product returns">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold">
                <th className="p-3">Return No</th>
                <th className="p-3">Farmer</th>
                <th className="p-3">Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Loader2 size={16} className="animate-spin inline mr-2" />
                    Loading returns...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {searchQuery
                      ? `No returns match "${searchQuery}".`
                      : 'No product returns found.'}
                  </td>
                </tr>
              ) : (
                filteredReturns.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold">{row.return_number || '—'}</td>
                    <td className="p-3">
                      <p className="font-bold">{row.farmer?.farmer_name || '—'}</p>
                      <p className="text-[10px] font-mono text-gray-500">
                        {row.farmer?.farmer_id || ''}
                      </p>
                    </td>
                    <td className="p-3 font-mono">{row.return_date || '—'}</td>
                    <td className="p-3 font-black text-emerald-800">
                      ₹{formatINR(row.total_amount)}
                    </td>
                    <td className="p-3 text-gray-600 max-w-[150px] truncate" title={row.reason || ''}>
                      {row.reason || '—'}
                    </td>
                    <td className="p-3 uppercase text-emerald-800 font-bold">
                      {row.return_status || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}