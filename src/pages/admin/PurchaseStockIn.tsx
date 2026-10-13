// src/pages/admin/PurchaseStockIn.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Truck, Plus, Trash2, Camera, ShieldAlert,
  Building2, Package, AlertTriangle, Loader2,
  CreditCard, Wallet, CheckCircle2, Calculator
} from 'lucide-react'
import toast from 'react-hot-toast'
import { round2 as roundMoney, safeNum } from '../../lib/round'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface Company {
  id: string
  company_name: string
  gstin?: string | null
}

interface Product {
  id: string
  sku: string | null
  product_name: string
  company_id: string | null
  default_purchase_rate: number | string | null
  default_selling_rate: number | string | null
  category_id: string | null
  unit_id: string | null
  hsn_code?: string
  gst_percent?: number
}

interface PurchaseItem {
  _uid: string
  product_id: string
  quantity: number
  purchase_rate: number
  selling_rate: number
  batch_number: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  hsn_code: string
  gst_percent: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  total_amount: number
}

/* ------------------------------------------------------------------ */
/*  Constants & Helpers                                                */
/* ------------------------------------------------------------------ */

const MAX_FILE_SIZE_MB = 5
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

function createEmptyItem(): PurchaseItem {
  return {
    _uid: crypto.randomUUID(),
    product_id: '',
    quantity: 1,
    purchase_rate: 0,
    selling_rate: 0,
    batch_number: '',
    lot_number: '',
    manufacturing_date: '',
    expiry_date: '',
    hsn_code: '',
    gst_percent: 0,
    taxable_amount: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    total_amount: 0,
  }
}

function toNumber(val: number | string | null | undefined): number {
  return safeNum(val)
}

function round2(num: number): number {
  return roundMoney(num)
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function todayISO(): string {
  // 🟢 FIX: Always use India/Kolkata date (IST), not UTC
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function validateItem(item: PurchaseItem, index: number): string | null {
  if (!item.product_id) return `Item #${index + 1}: उत्पाद चुनें (Select Product)`
  if (item.quantity <= 0) return `Item #${index + 1}: मात्रा 1 या अधिक होनी चाहिए (Qty ≥ 1)`
  if (item.purchase_rate <= 0) return `Item #${index + 1}: खरीद दर 0 नहीं हो सकती — वैध दर दर्ज करें`
  if (item.selling_rate <= 0) return `Item #${index + 1}: बिक्री दर 0 नहीं हो सकती — वैध दर दर्ज करें`
  if (!item.batch_number.trim()) return `Item #${index + 1}: बैच नंबर दर्ज करें`
  if (!item.expiry_date) return `Item #${index + 1}: एक्सपायरी तारीख दर्ज करें`
  if (item.expiry_date && item.expiry_date < todayISO()) {
    return `Item #${index + 1}: एक्सपायरी तारीख बीत चुकी है`
  }
  return null
}

function findDuplicateBatch(items: PurchaseItem[]): string | null {
  const seen = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    if (!items[i].product_id || !items[i].batch_number.trim()) continue
    const key = `${items[i].product_id}::${items[i].batch_number.trim().toUpperCase()}`
    if (seen.has(key)) {
      return `Item #${i + 1}: यह उत्पाद + बैच पहले से जोड़ा गया है`
    }
    seen.add(key)
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PurchaseStockIn() {
  const { role, loading: authLoading } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [companyId, setCompanyId] = useState('')
  const [companyBillNo, setCompanyBillNo] = useState('')
  const [billDate, setBillDate] = useState(todayISO)
  const [billType, setBillType] = useState<'udhaar' | 'cash'>('udhaar')
  const [isGstPurchase, setIsGstPurchase] = useState(true)
  const [billPhoto, setBillPhoto] = useState<File | null>(null)
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState<PurchaseItem[]>([createEmptyItem()])

  const isMountedRef = useRef(true)
  const saveLockRef = useRef<boolean>(false)

  /* ---- Load Reference Data ---- */

  useEffect(() => {
    isMountedRef.current = true
    if (authLoading || role !== 'admin') {
      setDataLoading(false)
      return
    }

    async function loadData() {
      try {
        const [compResult, prodResult] = await Promise.all([
          supabase
            .from('companies')
            .select('id, company_name, gstin')
            .eq('account_status', 'active')
            .order('company_name'),
          supabase
            .from('products')
            .select('id, sku, product_name, company_id, default_purchase_rate, default_selling_rate, category_id, unit_id, hsn_code, gst_percent')
            .eq('is_active', true)
            .order('product_name'),
        ])

        if (!isMountedRef.current) return

        if (compResult.error) throw compResult.error
        if (prodResult.error) throw prodResult.error

        setCompanies((compResult.data as Company[]) || [])
        setProducts((prodResult.data as Product[]) || [])
      } catch (err: unknown) {
        if (!isMountedRef.current) return
        const msg = err instanceof Error ? err.message : 'Failed to load reference data'
        toast.error(msg)
      } finally {
        if (isMountedRef.current) setDataLoading(false)
      }
    }

    loadData()

    return () => {
      isMountedRef.current = false
    }
  }, [role, authLoading])

  /* ---- Derived Data ---- */

  const availableCompanyProducts = useMemo(
    () =>
      companyId
        ? products.filter((p) => p.company_id === companyId)
        : products,
    [products, companyId]
  )

  /* ---- Handlers ---- */

  const handleCompanyChange = useCallback(
    (newCompanyId: string) => {
      setCompanyId(newCompanyId)

      if (newCompanyId) {
        const validProductIds = new Set(
          products
            .filter((p) => p.company_id === newCompanyId)
            .map((p) => p.id)
        )
        setItems((prev) =>
          prev.map((item) =>
            item.product_id && !validProductIds.has(item.product_id)
              ? { ...item, product_id: '', purchase_rate: 0, selling_rate: 0, gst_percent: 0, hsn_code: '' }
              : item
          )
        )
      }
    },
    [products]
  )

  const calcLine = useCallback((it: PurchaseItem, gstActive: boolean): PurchaseItem => {
    const qty = toNumber(it.quantity)
    const rate = toNumber(it.purchase_rate)
    const taxable = round2(qty * rate)
    const gstPct = toNumber(it.gst_percent)

      // 🟢 FIX: CGST first, SGST = remainder (avoids 1-paisa mismatch on odd amounts)
    const totalGst = gstActive ? round2((taxable * gstPct) / 100) : 0
    const cgst = gstActive ? round2(totalGst / 2) : 0
    const sgst = gstActive ? round2(totalGst - cgst) : 0

    return {
      ...it,
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: round2(taxable + totalGst),
    }
  }, [])

  const handleProductChange = useCallback(
    (index: number, prodId: string) => {
      const selectedProd = products.find((p) => p.id === prodId)
      setItems((prev) => {
        const updated = [...prev]
        let row = updated[index]
        
        row = {
          ...row,
          product_id: prodId,
          purchase_rate: selectedProd ? toNumber(selectedProd.default_purchase_rate) : 0,
          selling_rate: selectedProd ? toNumber(selectedProd.default_selling_rate) : 0,
          hsn_code: selectedProd?.hsn_code || '',
          gst_percent: selectedProd ? toNumber(selectedProd.gst_percent) : 0,
        }
        
        updated[index] = calcLine(row, isGstPurchase)
        return updated
      })
    },
    [products, isGstPurchase, calcLine]
  )

  const addItemRow = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()])
  }, [])

  const removeItemRow = useCallback((uid: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item._uid !== uid)))
  }, [])

  const handleItemFieldChange = useCallback(
    (index: number, field: keyof PurchaseItem, value: string | number) => {
      setItems((prev) => {
        const updated = [...prev]
        const row = { ...updated[index], [field]: value }
        updated[index] = calcLine(row, isGstPurchase)
        return updated
      })
    },
    [isGstPurchase, calcLine]
  )

  // Recalculate all lines when GST toggle changes
  useEffect(() => {
    setItems(prev => prev.map(it => calcLine(it, isGstPurchase)))
  }, [isGstPurchase, calcLine])

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setBillPhoto(null)
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('केवल JPEG, PNG, WebP या HEIC फोटो अपलोड करें')
      e.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`फोटो ${MAX_FILE_SIZE_MB}MB से छोटी होनी चाहिए`)
      e.target.value = ''
      return
    }

    setBillPhoto(file)
  }, [])

  // Precision Totals Compiler
  const totals = useMemo(() => {
    const raw = items.reduce(
      (acc, it) => ({
        taxable: acc.taxable + toNumber(it.taxable_amount),
        cgst: acc.cgst + toNumber(it.cgst_amount),
        sgst: acc.sgst + toNumber(it.sgst_amount),
        grandTotal: acc.grandTotal + toNumber(it.total_amount),
      }),
      { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 }
    )

    return {
      taxable: round2(raw.taxable),
      cgst: round2(raw.cgst),
      sgst: round2(raw.sgst),
      grandTotal: round2(raw.grandTotal),
    }
  }, [items])

  /* ---- Save Handler ---- */

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault()

    if (role !== 'admin') {
      toast.error('Aapke paas stock-in ki permission nahi hai.')
      return
    }

    if (!companyId) {
      toast.error('कंपनी चुनें!')
      return
    }
    if (!companyBillNo.trim()) {
      toast.error('कंपनी का बिल नंबर दर्ज करें!')
      return
    }
    if (!billDate) {
      toast.error('बिल तारीख चुनें!')
      return
    }

    // Persistent Double-Submit Guard
    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      for (let i = 0; i < items.length; i++) {
        const itemError = validateItem(items[i], i)
        if (itemError) {
          toast.error(itemError, { duration: 4000 })
          saveLockRef.current = false
          setSaving(false)
          return
        }
      }

      const dupError = findDuplicateBatch(items)
      if (dupError) {
        toast.error(dupError, { duration: 4000 })
        saveLockRef.current = false
        setSaving(false)
        return
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('सत्र समाप्त हो गया। कृपया फिर से लॉगिन करें।')
        saveLockRef.current = false
        setSaving(false)
        return
      }

      let photoUrl = ''
      if (billPhoto) {
        const safeExt = billPhoto.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
        const path = `company-bills/${companyBillNo.trim()}-${Date.now()}.${safeExt}`
        const { error: upErr } = await supabase.storage
          .from('company-bills')
          .upload(path, billPhoto, {
            contentType: billPhoto.type,
            upsert: false,
          })
        if (upErr) {
          toast.error('फोटो अपलोड विफल: ' + upErr.message)
        } else {
          photoUrl = supabase.storage.from('company-bills').getPublicUrl(path).data.publicUrl
        }
      }

      const payload = items.map((it) => ({
        product_id: it.product_id,
        quantity: toNumber(it.quantity),
        purchase_rate: toNumber(it.purchase_rate),
        selling_rate: toNumber(it.selling_rate),
        batch_number: it.batch_number.trim().toUpperCase(),
        lot_number: it.lot_number.trim().toUpperCase(),
        manufacturing_date: it.manufacturing_date || null,
        expiry_date: it.expiry_date || null,
        hsn_code: it.hsn_code,
        gst_percent: it.gst_percent,
        taxable_amount: it.taxable_amount,
        cgst_amount: it.cgst_amount,
        sgst_amount: it.sgst_amount,
        igst_amount: 0,
        total_amount: it.total_amount,
      }))

      const { data, error: rpcError } = await supabase.rpc('purchase_stock_in', {
        p_company_id: companyId,
        p_vendor_bill_no: companyBillNo.trim(),
        p_bill_date: billDate,
        p_total_amount: totals.grandTotal,
        p_total_items: items.length,
        p_photo_url: photoUrl,
        p_notes: notes.trim(),
        p_user_id: user.id,
        p_items: payload,
        p_bill_type: billType,
        p_is_gst_purchase: isGstPurchase,
        p_discount_amount: 0,
        p_taxable_amount: totals.taxable,
        p_cgst_amount: totals.cgst,
        p_sgst_amount: totals.sgst,
        p_igst_amount: 0,
      })

      if (rpcError) throw rpcError

      toast.success(`Purchase Bill ${data?.bill_number || ''} recorded successfully!`, { duration: 5000 })

      setCompanyBillNo('')
      setNotes('')
      setBillPhoto(null)
      setBillDate(todayISO())
      setItems([createEmptyItem()])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'अज्ञान त्रुटि'
      toast.error('माल चढ़ाने में त्रुटि: ' + message, { duration: 6000 })
    } finally {
      saveLockRef.current = false
      if (isMountedRef.current) setSaving(false)
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Purchase Stock-In ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="text-amber-400" size={28} aria-hidden="true" />
          Purchase / Stock In (कंपनी से माल चढ़ाना)
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          कंपनी बिल एंट्री, बैच/लॉट नंबर, पर-पीस खरीद दर और पर-पीस बिक्री दर प्रबंधन
        </p>
      </div>

      {dataLoading ? (
        <div className="bg-white p-10 rounded-3xl border text-center">
          <Loader2 className="animate-spin mx-auto text-emerald-800 mb-3" size={32} />
          <p className="text-sm text-slate-500 font-medium">कंपनी और उत्पाद लोड हो रहे हैं…</p>
        </div>
      ) : (
        <form onSubmit={handleSavePurchase} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Purchase Type */}
              <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
                <p className="font-bold text-xs text-gray-700 uppercase tracking-wider">Purchase Payment Mode *</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillType('udhaar')}
                    className={`p-4 rounded-2xl border-2 font-bold text-xs text-left flex items-center gap-3 cursor-pointer transition-colors ${
                      billType === 'udhaar' ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className={billType === 'udhaar' ? 'text-amber-600' : 'text-gray-400'} size={24} />
                    <div>
                      <p className="text-slate-900 font-black text-sm">उधारी (Credit)</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold">Supplier Payable में जुड़ेगा</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillType('cash')}
                    className={`p-4 rounded-2xl border-2 font-bold text-xs text-left flex items-center gap-3 cursor-pointer transition-colors ${
                      billType === 'cash' ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet className={billType === 'cash' ? 'text-emerald-600' : 'text-gray-400'} size={24} />
                    <div>
                      <p className="text-slate-900 font-black text-sm">नकद (Cash)</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 uppercase font-bold">तुरंत भुगतान दर्ज होगा</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Company & Bill Details */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-base font-bold text-emerald-900 border-b pb-2 flex items-center gap-2">
                  <Building2 size={18} aria-hidden="true" /> Company &amp; Bill Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label htmlFor="company-select" className="block font-bold text-gray-700 mb-1 text-xs">
                      कंपनी (Select Company) *
                    </label>
                    <select
                      id="company-select"
                      required
                      value={companyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                    >
                      <option value="">-- Choose Company --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name} {c.gstin ? `(GST: ${c.gstin})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="vendor-bill-no" className="block font-bold text-gray-700 mb-1 text-xs">
                      कंपनी बिल नंबर (Bill No) *
                    </label>
                    <input
                      id="vendor-bill-no"
                      type="text"
                      required
                      maxLength={50}
                      value={companyBillNo}
                      onChange={(e) => setCompanyBillNo(e.target.value.toUpperCase())}
                      placeholder="e.g. INV-2025-987"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="bill-date" className="block font-bold text-gray-700 mb-1 text-xs">
                      बिल तारीख (Bill Date) *
                    </label>
                    <input
                      id="bill-date"
                      type="date"
                      required
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
                  <div>
                    <label htmlFor="bill-photo" className="block font-bold text-gray-700 mb-1 flex items-center gap-1 text-xs">
                      <Camera size={14} aria-hidden="true" /> Upload Company Bill Photo
                    </label>
                    <input
                      id="bill-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      onChange={handlePhotoChange}
                      className="w-full border border-slate-300 p-2 rounded-xl text-xs bg-gray-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 transition-all cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">Max {MAX_FILE_SIZE_MB}MB · JPEG, PNG, WebP</p>
                  </div>

                  <div>
                    <label htmlFor="bill-notes" className="block font-bold text-gray-700 mb-1 text-xs">
                      नोट्स (Notes / Reference)
                    </label>
                    <input
                      id="bill-notes"
                      type="text"
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Transport / Vehicle / Payment notes"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Product & Batch Entry */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                    <Package size={18} aria-hidden="true" /> Products &amp; Batch Entry
                  </h2>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={16} /> + NEW ITEM
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div
                      key={item._uid}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 relative space-y-3 text-xs"
                    >
                      <div className="flex justify-between items-center font-bold text-emerald-900 border-b pb-2">
                        <span>Item #{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {item.product_id && item.quantity > 0 && item.purchase_rate > 0 && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                              ₹{formatINR(toNumber(item.quantity) * toNumber(item.purchase_rate))}
                            </span>
                          )}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(item._uid)}
                              className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-100 transition-colors cursor-pointer"
                              aria-label={`Remove item ${idx + 1}`}
                              title="Remove Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block font-bold text-gray-700 mb-1">
                            उत्पाद चुनें (Select Product) *
                          </label>
                          <select
                            required
                            value={item.product_id}
                            onChange={(e) => handleProductChange(idx, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          >
                            <option value="">-- Select Product --</option>
                            {availableCompanyProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name} ({p.sku || 'N/A'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            मात्रा (Quantity) *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                        <div className="col-span-1">
                          <label className="block font-bold text-gray-800 mb-1 text-[10px] uppercase">
                            Purchase ₹ *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.purchase_rate}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'purchase_rate', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-2 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block font-bold text-emerald-950 mb-1 text-[10px] uppercase">
                            Selling ₹ *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.selling_rate}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'selling_rate', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-2 py-2 border-2 border-emerald-400 rounded-lg font-black text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-600 outline-none transition-all font-mono"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block font-bold text-gray-800 mb-1 text-[10px] uppercase">
                            GST %
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.gst_percent}
                            onChange={(e) => handleItemFieldChange(idx, 'gst_percent', toNumber(e.target.value))}
                            className="w-full px-2 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block font-bold text-gray-700 mb-1 text-[10px] uppercase">
                            Batch Number *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={30}
                            value={item.batch_number}
                            onChange={(e) => handleItemFieldChange(idx, 'batch_number', e.target.value.toUpperCase())}
                            placeholder="e.g. B2025-01"
                            className="w-full px-2 py-2 border border-slate-300 rounded-lg uppercase font-mono bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block font-bold text-gray-700 mb-1 text-[10px] uppercase">
                            Lot
                          </label>
                          <input
                            type="text"
                            maxLength={30}
                            value={item.lot_number}
                            onChange={(e) => handleItemFieldChange(idx, 'lot_number', e.target.value.toUpperCase())}
                            placeholder="e.g. L-88"
                            className="w-full px-2 py-2 border border-slate-300 rounded-lg uppercase font-mono bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Manufacturing Date
                          </label>
                          <input
                            type="date"
                            value={item.manufacturing_date}
                            max={todayISO()}
                            onChange={(e) => handleItemFieldChange(idx, 'manufacturing_date', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Expiry Date *
                          </label>
                          <input
                            type="date"
                            required
                            value={item.expiry_date}
                            onChange={(e) => handleItemFieldChange(idx, 'expiry_date', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-rose-700 focus:ring-2 focus:ring-rose-400 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Summary Panel & Submit */}
            <div className="space-y-4">
              <div className="bg-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4 text-sm sticky top-6">
                
                <label className="flex items-center gap-3 font-bold text-emerald-100 cursor-pointer bg-emerald-900 p-4 rounded-2xl border border-emerald-800 transition-colors hover:bg-emerald-800/80">
                  <input
                    type="checkbox"
                    checked={isGstPurchase}
                    onChange={(e) => setIsGstPurchase(e.target.checked)}
                    className="w-5 h-5 rounded border-emerald-500 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  This is a GST Invoice (Calculate ITC)
                </label>

                {isGstPurchase && (
                  <div className="p-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl text-[10px] text-emerald-300 flex gap-2 items-start font-medium leading-relaxed">
                    <Calculator size={14} className="shrink-0 text-amber-500 mt-0.5"/> 
                    <p>अगर यह GST बिल है, तो आइटम की खरीद दर के आधार पर CGST/SGST अपने आप जुड़ जाएगा।</p>
                  </div>
                )}

                <h3 className="font-black text-amber-400 text-xs uppercase tracking-wider mt-4 border-b border-emerald-800 pb-2">Bill Summary</h3>
                <div className="space-y-2.5 bg-emerald-900/60 p-5 rounded-2xl border border-emerald-800">
                  <div className="flex justify-between text-emerald-100">
                    <span className="font-bold text-xs uppercase">Taxable Value:</span>
                    <span className="font-mono font-bold">₹{formatINR(totals.taxable)}</span>
                  </div>
                  {isGstPurchase && (
                    <>
                      <div className="flex justify-between text-emerald-300">
                        <span className="font-bold text-xs uppercase">CGST:</span>
                        <span className="font-mono font-bold">₹{formatINR(totals.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-300">
                        <span className="font-bold text-xs uppercase">SGST:</span>
                        <span className="font-mono font-bold">₹{formatINR(totals.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="pt-3 border-t border-emerald-700/50 flex justify-between font-black text-base text-amber-400">
                    <span className="uppercase text-sm mt-1">Grand Total:</span>
                    <span className="font-mono text-lg">₹{formatINR(totals.grandTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || dataLoading}
                  className="w-full py-4 mt-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing Entry…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> Accept &amp; Save Voucher
                    </>
                  )}
                </button>
              </div>

              {/* Data Integrity Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
                <p className="font-bold leading-relaxed">
                  ध्यान दें: एक बार स्टॉक चढ़ाने के बाद, बैच/मात्रा बदलने के लिए
                  Stock Adjustment या Purchase Return का उपयोग करें। सीधे डिलीट न करें।
                </p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}