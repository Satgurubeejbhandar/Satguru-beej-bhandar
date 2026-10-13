// src/pages/admin/DamageProduct.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  AlertTriangle,
  Camera,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Search,
  Calendar,
  Filter,
  X,
  ImageIcon,
  Package,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Company {
  id: string
  company_name: string
}

interface Product {
  id: string
  product_name: string
  company_id?: string | null
}

interface Batch {
  id: string
  product_id: string
  batch_number: string
  quantity_available: number
  purchase_rate: number
}

interface DamagePhoto {
  id: string
  photo_url: string
  storage_path?: string | null
}

interface DamageRecord {
  id: string
  created_at: string
  damage_number: string
  quantity: number
  unit_price: number
  damage_type: string
  description: string
  product: { product_name: string } | null
  company: { company_name: string } | null
  batch: { batch_number: string } | null
  photos: DamagePhoto[]
}

function safeNum(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

export default function DamageProduct() {
  const { role, loading: authLoading } = useAuth()

  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [masterLoading, setMasterLoading] = useState(true)

  const [companyId, setCompanyId] = useState('')
  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [damageType, setDamageType] = useState('leaking_broken')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const saveLockRef = useRef(false)
  const deleteLockRef = useRef(false)
  const isMounted = useRef(true)

  const [history, setHistory] = useState<DamageRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewPhotos, setViewPhotos] = useState<string[]>([])

  const loadMasters = useCallback(async () => {
    try {
      setMasterLoading(true)
      const [cRes, pRes, bRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_name')
          .eq('account_status', 'active')
          .order('company_name'),
        supabase
          .from('products')
          .select('id, product_name, company_id')
          .eq('is_active', true)
          .order('product_name'),
        supabase
          .from('inventory_batches')
          .select('id, product_id, batch_number, quantity_available, purchase_rate'),
      ])
      if (isMounted.current) {
        setCompanies((cRes.data as Company[]) || [])
        setProducts((pRes.data as Product[]) || [])
        setBatches((bRes.data as Batch[]) || [])
      }
    } catch {
      toast.error('Masters load failed')
    } finally {
      if (isMounted.current) setMasterLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)

      let query = supabase
        .from('damage_reports')
        .select(
          `
          id, created_at, damage_number, quantity, unit_price, damage_type, description,
          product:products(product_name),
          company:companies(company_name),
          batch:inventory_batches(batch_number),
          photos:damage_photos(id, photo_url, storage_path)
        `
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (filterProduct !== 'all') {
        query = query.eq('product_id', filterProduct)
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`)
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`)
      }

      const { data, error } = await query
      if (error) throw error

      if (isMounted.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHistory((data as any[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'History load failed'
      if (isMounted.current) toast.error('History load failed: ' + msg)
    } finally {
      if (isMounted.current) setHistoryLoading(false)
    }
  }, [filterProduct, dateFrom, dateTo])

  useEffect(() => {
    isMounted.current = true
    if (role === 'admin') {
      void loadMasters()
      void loadHistory()
    }
    return () => {
      isMounted.current = false
    }
  }, [loadMasters, loadHistory, role])

  const availableCompanyProducts = useMemo(() => {
    if (!companyId) return []
    return products.filter((p) => p.company_id === companyId)
  }, [products, companyId])

  const handleCompanyChange = (cId: string) => {
    setCompanyId(cId)
    setProductId('')
    setBatchId('')
    setUnitPrice('0')
  }

  const handleProductChange = (pId: string) => {
    setProductId(pId)
    const availableBatch = batches.find((b) => b.product_id === pId)
    if (availableBatch) {
      setBatchId(availableBatch.id)
      setUnitPrice(String(availableBatch.purchase_rate || 0))
    } else {
      setBatchId('')
      setUnitPrice('0')
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      toast.error('अधिकतम 5 तस्वीरें ही अपलोड की जा सकती हैं!')
      return
    }
    setPhotos((prev) => [...prev, ...files].slice(0, 5))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = safeNum(quantity)

    if (!companyId || !productId || qty <= 0) {
      toast.error('सभी आवश्यक फ़ील्ड भरें (Company, Product, Qty > 0)!')
      return
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    const uploadedUrls: string[] = []
    const uploadedPaths: string[] = []

    try {
      const { data: authData } = await supabase.auth.getUser()

      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        const path = `damages/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`
        const { error: upErr } = await supabase.storage.from('damage-photos').upload(path, file)

        if (!upErr) {
          const { data: urlData } = supabase.storage.from('damage-photos').getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
          uploadedPaths.push(path)
        }
      }

      const { error } = await supabase.rpc('record_damage_product', {
        p_company_id: companyId,
        p_product_id: productId,
        p_batch_id: batchId || null,
        p_quantity: qty,
        p_unit_price: safeNum(unitPrice),
        p_damage_type: damageType,
        p_description: description.trim(),
        p_user_id: authData?.user?.id || null,
        p_photo_urls: uploadedUrls,
        p_storage_paths: uploadedPaths,
      })

      if (error) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('damage-photos').remove(uploadedPaths).catch(() => {})
        }
        throw error
      }

      toast.success('Damage record successfully saved! (Inventory stock is unchanged)')

      setDescription('')
      setPhotos([])
      setQuantity('1')
      setProductId('')
      setBatchId('')
      setUnitPrice('0')

      await loadHistory()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Error recording damage: ' + msg)
    } finally {
      saveLockRef.current = false
      if (isMounted.current) setSaving(false)
    }
  }

  // FIXED: Rely 100% on the atomic Database RPC for secure cascading deletion
  const handleDelete = async (row: DamageRecord) => {
    const ok = window.confirm(
      `क्या आप damage record "${row.damage_number}" को हमेशा के लिए मिटाना चाहते हैं?\n\n` +
        `यह सिर्फ damage register से हटेगा।\nInventory stock पर कोई असर नहीं पड़ेगा।`
    )
    if (!ok) return

    if (deleteLockRef.current) return
    deleteLockRef.current = true
    setDeletingId(row.id)

    try {
      const { data, error } = await supabase.rpc('delete_damage_record', {
        p_damage_id: row.id,
      })

      if (error) throw error

      // Clean up storage from transactional RPC returned paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paths = (data as any)?.storage_paths as string[] | undefined
      if (paths && paths.length > 0) {
        await supabase.storage.from('damage-photos').remove(paths).catch(() => {})
      }

      toast.success(`Damage record ${row.damage_number} deleted successfully.`)
      if (isMounted.current) {
        setHistory((prev) => prev.filter((h) => h.id !== row.id))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast.error('Delete failed: ' + msg)
    } finally {
      deleteLockRef.current = false
      if (isMounted.current) setDeletingId(null)
    }
  }

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return history
    return history.filter(
      (r) =>
        (r.product?.product_name || '').toLowerCase().includes(q) ||
        (r.company?.company_name || '').toLowerCase().includes(q) ||
        (r.damage_number || '').toLowerCase().includes(q) ||
        (r.batch?.batch_number || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.damage_type || '').toLowerCase().includes(q)
    )
  }, [history, search])

  const totals = useMemo(() => {
    return filteredHistory.reduce(
      (acc, row) => {
        acc.qty += safeNum(row.quantity)
        acc.value += safeNum(row.quantity) * safeNum(row.unit_price)
        return acc
      },
      { qty: 0, value: 0 }
    )
  }, [filteredHistory])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline text-red-600 mb-2" size={32} />
        <h1 className="font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Damage Register की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="text-amber-400" size={28} /> Damage Product Register
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Historical logging of damaged goods (Does NOT deduct inventory stock)
        </p>
      </div>

      {/* FORM */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b p-4">
          <h2 className="font-black text-slate-800 text-sm flex items-center gap-2">
            <Package size={16} className="text-emerald-700" /> New Damage Record
          </h2>
        </div>

        {masterLoading ? (
          <div className="p-10 text-center">
            <Loader2 className="animate-spin mx-auto text-emerald-800 mb-3" size={24} />
            <p className="text-xs text-slate-500 font-bold">Loading master data…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
            <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-xl font-bold flex items-start gap-2">
              <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <p>
                यह फॉर्म केवल डैमेज का रिकॉर्ड/रजिस्टर मेन्टेन करेगा। इसे सबमिट करने से आपका लाइव
                इन्वेंट्री स्टॉक कम नहीं होगा।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">सप्लायर कंपनी *</label>
                <select
                  required
                  disabled={saving}
                  value={companyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Supplier Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">उत्पाद (Product) *</label>
                <select
                  required
                  disabled={saving || !companyId}
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {!companyId ? '-- पहले सप्लायर कंपनी चुनें --' : '-- Select Product --'}
                  </option>
                  {availableCompanyProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2 lg:col-span-1">
                <label className="block font-bold text-gray-700 mb-1">स्टॉक बैच</label>
                <select
                  value={batchId}
                  disabled={saving || !productId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">-- No Batch / Unknown --</option>
                  {batches
                    .filter((b) => b.product_id === productId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_number} (Rate: ₹{b.purchase_rate})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">डैमेज मात्रा (Qty) *</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  disabled={saving}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-black text-center outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">खरीद दर (Rate ₹)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={saving}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="block font-bold text-gray-700 mb-1">खराबी का प्रकार</label>
                <select
                  value={damageType}
                  disabled={saving}
                  onChange={(e) => setDamageType(e.target.value)}
                  className="w-full p-2.5 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="leaking_broken">बोतल लीक / पैकेट टूटा (Leaking)</option>
                  <option value="seal_damaged">सील टूटी (Seal Damaged)</option>
                  <option value="expired_on_arrival">आवक पर एक्सपायर (Expired)</option>
                  <option value="transport_damage">परिवहन क्षति (Transport)</option>
                  <option value="other">अन्य खराबी (Other)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">विवरण (Description / Reason)</label>
                <textarea
                  rows={2}
                  value={description}
                  disabled={saving}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Found 2 bottles leaking inside the transport carton"
                  className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-xs"
                />
              </div>

              <div className="border border-dashed border-emerald-300 p-3 rounded-2xl bg-emerald-50/50">
                <label className="block font-bold text-emerald-900 text-xs flex items-center gap-1.5 mb-2">
                  <Camera size={14} /> सबूत तस्वीरें (Max 5 Photos)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={saving}
                  onChange={handlePhotoSelect}
                  className="w-full text-[11px] cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {photos.length > 0 && (
                  <p className="text-[10px] font-bold text-emerald-700 mt-2 text-right">
                    {photos.length} Photo(s) attached
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !productId}
                className="w-full sm:w-auto px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 ml-auto cursor-pointer"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {saving ? 'Recording Log...' : 'Record Damaged Stock 🚨'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* HISTORY */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="font-black text-slate-800 text-sm flex items-center gap-2">
            <FileText size={16} className="text-emerald-700" /> Damage Product History
          </h2>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="px-3 py-1.5 bg-white border shadow-sm text-xs font-bold rounded-lg text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Records</p>
              <p className="text-base font-black text-slate-800 font-mono mt-0.5">
                {filteredHistory.length}
              </p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-rose-600">Damaged Qty</p>
              <p className="text-base font-black text-rose-700 font-mono mt-0.5">
                {safeNum(totals.qty).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-amber-700">Total Value</p>
              <p className="text-base font-black text-amber-800 font-mono mt-0.5">
                ₹{formatINR(totals.value)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search record, batch, type..."
                className="w-full pl-8 pr-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
            </div>

            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white text-xs cursor-pointer"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 border rounded-xl outline-none font-mono text-[10px]"
            />
            <div className="flex items-center gap-1">
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-2 border rounded-xl outline-none font-mono text-[10px]"
              />
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="p-2 bg-emerald-700 text-white rounded-xl shadow-sm cursor-pointer"
              >
                <Filter size={14} />
              </button>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:block border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-100 font-bold text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date &amp; No</th>
                    <th className="p-3">Product &amp; Company</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Damage Type &amp; Notes</th>
                    <th className="p-3 text-center">Photos</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-slate-700">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        <Loader2 className="animate-spin inline mr-2" /> Loading...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No damage records found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <p className="font-mono text-emerald-800 font-bold">{r.damage_number}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatDate(r.created_at)}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{r.product?.product_name}</p>
                          <p className="text-[10px] text-slate-500">{r.company?.company_name}</p>
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {r.batch?.batch_number || '—'}
                        </td>
                        <td className="p-3 text-right font-black text-rose-600 font-mono">
                          {r.quantity}
                        </td>
                        <td className="p-3 text-right font-mono">₹{formatINR(r.unit_price)}</td>
                        <td className="p-3 text-right font-bold text-emerald-900 font-mono">
                          ₹{formatINR(r.quantity * r.unit_price)}
                        </td>
                        <td className="p-3">
                          <p className="uppercase text-[9px] font-bold text-amber-700 bg-amber-50 inline-block px-1.5 py-0.5 rounded border border-amber-200">
                            {r.damage_type.replace(/_/g, ' ')}
                          </p>
                          <p
                            className="text-[10px] text-slate-500 mt-1 truncate max-w-[150px]"
                            title={r.description}
                          >
                            {r.description || '—'}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          {r.photos && r.photos.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setViewPhotos(r.photos.map((p) => p.photo_url))}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <ImageIcon size={12} /> {r.photos.length}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">None</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => void handleDelete(r)}
                            disabled={deletingId === r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                            title="Delete damage record only"
                          >
                            {deletingId === r.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {historyLoading ? (
              <div className="p-8 text-center text-slate-500">
                <Loader2 className="animate-spin inline mr-2" /> Loading...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border rounded-2xl">
                No damage records found.
              </div>
            ) : (
              filteredHistory.map((r) => (
                <div key={r.id} className="bg-white border rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-emerald-800 text-xs">
                        {r.damage_number}
                      </p>
                      <p className="font-bold text-sm text-slate-900 mt-1">
                        {r.product?.product_name}
                      </p>
                      <p className="text-[10px] text-slate-500">{r.company?.company_name}</p>
                    </div>
                    <span className="uppercase text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                      {r.damage_type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border text-[10px]">
                    <div>
                      <p className="text-slate-500">Qty</p>
                      <p className="font-black font-mono text-rose-600">{r.quantity}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Rate</p>
                      <p className="font-bold font-mono">₹{formatINR(r.unit_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Value</p>
                      <p className="font-black font-mono text-emerald-900">
                        ₹{formatINR(r.quantity * r.unit_price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] gap-2">
                    <span className="text-slate-400 font-mono">
                      <Calendar size={10} className="inline mr-1" />
                      {formatDate(r.created_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.photos && r.photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewPhotos(r.photos.map((p) => p.photo_url))}
                          className="font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          <ImageIcon size={12} /> {r.photos.length}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(r)}
                        disabled={deletingId === r.id}
                        className="font-bold text-rose-700 flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === r.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {viewPhotos.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setViewPhotos([])}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition cursor-pointer"
          >
            <X size={24} />
          </button>
          <div className="w-full max-w-3xl flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4">
            {viewPhotos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Damage Proof ${i + 1}`}
                className="w-full max-h-[85vh] object-contain snap-center shrink-0 rounded-lg shadow-2xl bg-black/50"
              />
            ))}
          </div>
          <p className="text-white font-mono text-xs mt-2">
            {viewPhotos.length} Photo(s) Attached
          </p>
        </div>
      )}
    </div>
  )
}