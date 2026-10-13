// src/pages/admin/ProductMaster.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Package,
  Plus,
  Search,
  Edit,
  Tag,
  Layers,
  IndianRupee,
  Trash2,
  Loader2,
  Power,
  FileText,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CompanyOption {
  id: string
  company_name: string
}

interface CategoryOption {
  id: string
  category_name: string
}

interface UnitOption {
  id: string
  unit_name: string
  unit_abbr: string | null
}

interface ProductRow {
  id: string
  sku: string | null
  product_name: string
  company_id: string | null
  category_id: string | null
  unit_id: string | null
  pack_size: number | null
  pack_unit: string | null
  default_purchase_rate: number
  default_selling_rate: number
  reorder_level: number
  minimum_stock: number
  notes: string | null
  is_active: boolean
  hsn_code: string | null
  gst_percent: number
  company?: { company_name: string | null } | null
  category?: { category_name: string | null } | null
  unit?: { unit_name: string | null; unit_abbr: string | null } | null
}

interface ProductFormState {
  product_name: string
  company_id: string
  category_id: string
  unit_id: string
  pack_size: string
  pack_unit: string
  default_purchase_rate: string
  default_selling_rate: string
  reorder_level: string
  minimum_stock: string
  notes: string
  hsn_code: string
  gst_percent: string
}

const EMPTY_FORM: ProductFormState = {
  product_name: '',
  company_id: '',
  category_id: '',
  unit_id: '',
  pack_size: '',
  pack_unit: 'ml',
  default_purchase_rate: '',
  default_selling_rate: '',
  reorder_level: '10',
  minimum_stock: '5',
  notes: '',
  hsn_code: '',
  gst_percent: '0',
}

const PACK_UNITS = ['ml', 'litre', 'gm', 'kg', 'piece', 'packet', 'bottle', 'bag'] as const

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toNonNegNumber(value: string, fallback = 0): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function formatINR(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ProductMaster() {
  const { role, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [formData, setFormData] = useState<ProductFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  const isMounted = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  const loadMasterData = useCallback(async () => {
    if (role !== 'admin') return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const [compRes, catRes, unitRes, prodRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_name')
          .eq('account_status', 'active')
          .order('company_name'),
        supabase
          .from('product_categories')
          .select('id, category_name')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('product_units')
          .select('id, unit_name, unit_abbr')
          .eq('is_active', true)
          .order('unit_name'),
        supabase
          .from('products')
          .select(
            `
            id,
            sku,
            product_name,
            company_id,
            category_id,
            unit_id,
            pack_size,
            pack_unit,
            default_purchase_rate,
            default_selling_rate,
            reorder_level,
            minimum_stock,
            notes,
            is_active,
            hsn_code,
            gst_percent,
            company:companies(company_name),
            category:product_categories(category_name),
            unit:product_units(unit_name, unit_abbr)
          `
          )
          .order('created_at', { ascending: false })
          .limit(1000),
      ])

      if (controller.signal.aborted) return

      if (compRes.error) throw compRes.error
      if (catRes.error) throw catRes.error
      if (unitRes.error) throw unitRes.error
      if (prodRes.error) throw prodRes.error

      const normalizedProducts: ProductRow[] = (prodRes.data || []).map((p: any) => ({
        id: p.id,
        sku: p.sku ?? null,
        product_name: p.product_name || '',
        company_id: p.company_id ?? null,
        category_id: p.category_id ?? null,
        unit_id: p.unit_id ?? null,
        pack_size: p.pack_size == null ? null : Number(p.pack_size),
        pack_unit: p.pack_unit ?? 'ml',
        default_purchase_rate: Number(p.default_purchase_rate || 0),
        default_selling_rate: Number(p.default_selling_rate || 0),
        reorder_level: Number(p.reorder_level || 0),
        minimum_stock: Number(p.minimum_stock || 0),
        notes: p.notes ?? null,
        is_active: p.is_active !== false,
        hsn_code: p.hsn_code ?? null,
        gst_percent: Number(p.gst_percent || 0),
        company: Array.isArray(p.company) ? p.company[0] || null : p.company || null,
        category: Array.isArray(p.category) ? p.category[0] || null : p.category || null,
        unit: Array.isArray(p.unit) ? p.unit[0] || null : p.unit || null,
      }))

      if (!isMounted.current) return

      setCompanies(compRes.data || [])
      setCategories(catRes.data || [])
      setUnits(unitRes.data || [])
      setProducts(normalizedProducts)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('डेटा लोड करने में त्रुटि: ' + msg)
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      loadMasterData()
    }
    return () => {
      isMounted.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [loadMasterData, role, authLoading])

  useEffect(() => {
    if (!showModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setShowModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showModal, saving])

  const openModal = (prod: ProductRow | null = null) => {
    if (prod) {
      setEditingProduct(prod)
      setFormData({
        product_name: prod.product_name || '',
        company_id: prod.company_id || '',
        category_id: prod.category_id || '',
        unit_id: prod.unit_id || '',
        pack_size: prod.pack_size != null ? String(prod.pack_size) : '',
        pack_unit: prod.pack_unit || 'ml',
        default_purchase_rate:
          prod.default_purchase_rate != null ? String(prod.default_purchase_rate) : '',
        default_selling_rate:
          prod.default_selling_rate != null ? String(prod.default_selling_rate) : '',
        reorder_level: prod.reorder_level != null ? String(prod.reorder_level) : '10',
        minimum_stock: prod.minimum_stock != null ? String(prod.minimum_stock) : '5',
        notes: prod.notes || '',
        hsn_code: prod.hsn_code || '',
        gst_percent: prod.gst_percent != null ? String(prod.gst_percent) : '0',
      })
    } else {
      setEditingProduct(null)
      setFormData({
        ...EMPTY_FORM,
        company_id: companies[0]?.id || '',
        category_id: categories[0]?.id || '',
        unit_id: units[0]?.id || '',
      })
    }
    setShowModal(true)
  }

  const validateForm = (): string | null => {
    if (!formData.product_name.trim()) return 'कृपया उत्पाद का नाम दर्ज करें!'
    if (!formData.company_id) return 'कृपया कंपनी चुनें!'
    if (!formData.category_id) return 'कृपया श्रेणी (Category) चुनें!'

    const sell = Number(formData.default_selling_rate)
    if (!Number.isFinite(sell) || sell <= 0) {
      return 'वैध बिक्री दर (Selling Rate) दर्ज करें!'
    }

    const purchase = Number(formData.default_purchase_rate)
    if (!Number.isFinite(purchase) || purchase <= 0) {
      return 'वैध खरीद दर (Purchase Rate) दर्ज करें — 0 या खाली नहीं हो सकती!'
    }

    if (formData.pack_size.trim() !== '') {
      const pack = Number(formData.pack_size)
      if (!Number.isFinite(pack) || pack < 0) return 'Pack size अमान्य है!'
    }

    const reorder = Number(formData.reorder_level || 0)
    const minStock = Number(formData.minimum_stock || 0)
    if (!Number.isFinite(reorder) || reorder < 0) return 'Reorder level अमान्य है!'
    if (!Number.isFinite(minStock) || minStock < 0) return 'Minimum stock अमान्य है!'

    return null
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const payload = {
        product_name: formData.product_name.trim(),
        company_id: formData.company_id,
        category_id: formData.category_id || null,
        unit_id: formData.unit_id || null,
        pack_size: toNumberOrNull(formData.pack_size),
        pack_unit: formData.pack_unit || 'ml',
        default_purchase_rate: toNonNegNumber(formData.default_purchase_rate, 0),
        default_selling_rate: toNonNegNumber(formData.default_selling_rate, 0),
        reorder_level: toNonNegNumber(formData.reorder_level, 10),
        minimum_stock: toNonNegNumber(formData.minimum_stock, 5),
        notes: formData.notes.trim() || null,
        hsn_code: formData.hsn_code.trim() || null,
        gst_percent: toNonNegNumber(formData.gst_percent, 0),
        updated_at: new Date().toISOString(),
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)

        if (error) throw error
        toast.success('उत्पाद जानकारी अपडेट हो गई!')
      } else {
        const catObj = categories.find((c) => c.id === formData.category_id)
        const catName = catObj?.category_name || 'GEN'

        const { data: newSku, error: skuErr } = await supabase.rpc('generate_sku', {
          p_category: catName,
        })
        if (skuErr) throw skuErr
        if (!newSku) throw new Error('SKU generate नहीं हो सका')

        const { error: insertErr } = await supabase.from('products').insert([
          {
            ...payload,
            sku: newSku,
            is_active: true,
          },
        ])

        if (insertErr) throw insertErr
        toast.success(`नया उत्पाद जुड़ा! SKU: ${newSku}`)
      }

      setShowModal(false)
      setEditingProduct(null)
      setFormData(EMPTY_FORM)
      await loadMasterData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('सेव करने में त्रुटि: ' + msg)
    } finally {
      if (isMounted.current) setSaving(false)
    }
  }

  const checkProductDependencies = async (productId: string): Promise<boolean> => {
    const checks = await Promise.all([
      supabase
        .from('sales_bill_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
      supabase
        .from('purchase_bill_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
      supabase
        .from('inventory_batches')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
      supabase
        .from('stock_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
    ])

    for (const res of checks) {
      if (res.error) {
        console.warn('Dependency check error:', res.error.message)
        return true
      }
      if ((res.count || 0) > 0) return true
    }
    return false
  }

  // FIXED: Completely removed 'FORCE DELETE' override.
  // Standardised on deactivating products with prior histories to safeguard historical ledger invariants.
  const handleDeleteProduct = async (product: ProductRow) => {
    if (rowBusyId) return

    try {
      setRowBusyId(product.id)
      const hasDeps = await checkProductDependencies(product.id)

      if (hasDeps) {
        toast.error(`❌ डिलीट करना प्रतिबंधित है: यह उत्पाद पहले ही पुराने बिलों या स्टॉक लेजर में इस्तेमाल हो चुका है!\nइतिहास की सुरक्षा के लिए कृपया इसे निष्क्रिय (Deactivate) करें।`, {
          duration: 6000
        })
        setRowBusyId(null)
        return
      }

      const normal = window.confirm(
        `क्या आप उत्पाद "${product.product_name}" को हमेशा के लिए हटाना चाहते हैं?`
      )
      if (!normal) {
        setRowBusyId(null)
        return
      }

      const { error } = await supabase.from('products').delete().eq('id', product.id)
      if (error) throw error
      toast.success('उत्पाद डिलीट हो गया!')
      await loadMasterData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('उत्पाद डिलीट नहीं हो सका: ' + msg)
    } finally {
      if (isMounted.current) setRowBusyId(null)
    }
  }

  const toggleProductStatus = async (prod: ProductRow) => {
    if (rowBusyId) return
    try {
      setRowBusyId(prod.id)
      const newStatus = !prod.is_active
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', prod.id)

      if (error) throw error
      toast.success(`उत्पाद स्टेटस: ${newStatus ? 'ACTIVE' : 'INACTIVE'}`)
      await loadMasterData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('स्टेटस अपडेट त्रुटि: ' + msg)
    } finally {
      if (isMounted.current) setRowBusyId(null)
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return products.filter((p) => {
      if (!showInactive && !p.is_active) return false
      if (!q) return true
      const hay = `${p.product_name || ''} ${p.sku || ''} ${p.hsn_code || ''} ${p.company?.company_name || ''} ${p.category?.category_name || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, searchTerm, showInactive])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Product Master ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900 flex items-center gap-2">
            <Package className="text-emerald-700" size={28} /> Product Master (उत्पाद मास्टर)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            कंपनी-वार बीज, दवाई और खाद के उत्पाद मास्टर व उनकी ऑटो-फैच दरें।
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal(null)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition cursor-pointer"
        >
          <Plus size={20} />
          <span>+ Add New Product</span>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            type="text"
            placeholder="Search by SKU, HSN, Product Name, Company, or Category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-gray-700 font-medium placeholder-gray-400"
            aria-label="Search products"
          />
        </div>
        <label className="text-xs font-bold text-gray-700 flex items-center gap-2 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
          />
          Show Inactive
        </label>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]" aria-label="Product master table">
            <thead>
              <tr className="bg-emerald-50/80 text-emerald-900 border-b text-xs uppercase font-extrabold tracking-wider">
                <th scope="col" className="p-4">SKU / HSN Code</th>
                <th scope="col" className="p-4">Product Name & Pack</th>
                <th scope="col" className="p-4">Company</th>
                <th scope="col" className="p-4">Category</th>
                <th scope="col" className="p-4 text-center">GST %</th>
                <th scope="col" className="p-4 text-right">Default Purchase Rate</th>
                <th scope="col" className="p-4 text-right">Selling Rate (Auto-Fetch)</th>
                <th scope="col" className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-emerald-700" size={18} />
                      Loading Product Master...
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    कोई उत्पाद नहीं मिला। "+ Add New Product" पर क्लिक करके नया उत्पाद जोड़ें।
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const busy = rowBusyId === p.id
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 block w-max mb-1">
                          {p.sku || '—'}
                        </span>
                        {p.hsn_code && (
                          <span className="text-[10px] font-mono text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded border flex items-center gap-1 w-max">
                            <FileText size={10} /> HSN: {p.hsn_code}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <p className={`font-bold text-gray-900 text-base ${!p.is_active ? 'line-through text-gray-400' : ''}`}>{p.product_name}</p>
                        {p.pack_size != null && (
                          <p className="text-xs text-gray-500 font-medium">
                            Pack: {p.pack_size} {p.pack_unit || ''}
                          </p>
                        )}
                      </td>

                      <td className="p-4 font-bold text-gray-800">
                        {p.company?.company_name || '—'}
                      </td>

                      <td className="p-4">
                        {p.category?.category_name ? (
                          <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border inline-flex items-center gap-1 w-max">
                            <Tag size={10} className="text-emerald-700" /> {p.category.category_name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-4 text-center">
                         <span className={`text-xs font-black px-2 py-1 rounded-full ${p.gst_percent > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.gst_percent}%
                        </span>
                      </td>

                      <td className="p-4 font-semibold text-gray-700 font-mono text-right">
                        ₹{formatINR(p.default_purchase_rate || 0)}
                      </td>

                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-0.5 font-mono font-black text-emerald-800 bg-emerald-50/50 px-2 py-1 rounded border border-emerald-100">
                          <IndianRupee size={14} className="text-emerald-700" />
                          {formatINR(p.default_selling_rate || 0)}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openModal(p)}
                            disabled={busy || saving}
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition disabled:opacity-50 cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit size={18} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => toggleProductStatus(p)}
                            disabled={busy || saving}
                            className={`p-2 rounded-xl transition disabled:opacity-50 cursor-pointer ${p.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
                            title={p.is_active ? 'Deactivate (Soft Delete)' : 'Reactivate'}
                          >
                            <Power size={18} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            disabled={busy || saving}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-50 cursor-pointer"
                            title="Delete Product (Hard Delete)"
                          >
                            {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!saving) setShowModal(false)
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? 'Edit product' : 'Add product'}
          >
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="text-amber-400" size={24} />
                {editingProduct ? 'उत्पाद एडिट करें' : 'नया उत्पाद मास्टर जोड़ें'}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setShowModal(false)}
                className="text-emerald-200 hover:text-white text-2xl font-bold leading-none cursor-pointer"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 text-sm">
              <div>
                <label htmlFor="product_name" className="block font-bold text-gray-700 mb-1">
                  उत्पाद का नाम (Product Name) *
                </label>
                <input
                  id="product_name"
                  type="text"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="e.g. Coragen / Fame / Chlorpyrifos 50% EC"
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company_id" className="block font-bold text-gray-700 mb-1">
                    कंपनी (Company Name) *
                  </label>
                  <select
                    id="company_id"
                    required
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-xs cursor-pointer"
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="category_id" className="block font-bold text-gray-700 mb-1">
                    श्रेणी (Category) *
                  </label>
                  <select
                    id="category_id"
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-xs cursor-pointer"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Taxation & Packing */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t pt-3">
                <div className="col-span-2">
                  <label htmlFor="hsn_code" className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <FileText size={14}/> HSN Code (Taxation)
                  </label>
                  <input
                    id="hsn_code"
                    type="text"
                    value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    placeholder="e.g. 3105"
                    className="w-full px-4 py-2.5 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="gst_percent" className="block font-bold text-indigo-800 mb-1">
                    GST Percentage (%)
                  </label>
                  <select
                    id="gst_percent"
                    value={formData.gst_percent}
                    onChange={(e) => setFormData({ ...formData, gst_percent: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-indigo-200 rounded-xl bg-indigo-50 font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 text-xs cursor-pointer"
                  >
                    <option value="0">0% (Tax Free)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-3">
                <div>
                  <label htmlFor="pack_size" className="block font-bold text-gray-700 mb-1">
                    पैक साइज (Pack Size)
                  </label>
                  <input
                    id="pack_size"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pack_size}
                    onChange={(e) => setFormData({ ...formData, pack_size: e.target.value })}
                    placeholder="e.g. 100, 500, 1"
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="pack_unit" className="block font-bold text-gray-700 mb-1">
                    पैक यूनिट (Pack Unit)
                  </label>
                  <select
                    id="pack_unit"
                    value={formData.pack_unit}
                    onChange={(e) => setFormData({ ...formData, pack_unit: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-xs cursor-pointer"
                  >
                    {PACK_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="unit_id" className="block font-bold text-gray-700 mb-1">
                    इकाई (Measurement Unit)
                  </label>
                  <select
                    id="unit_id"
                    value={formData.unit_id}
                    onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                    className="w-full px-4 py-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-xs cursor-pointer"
                  >
                    <option value="">-- Select Unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name}
                        {u.unit_abbr ? ` (${u.unit_abbr})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Default Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                <div>
                  <label htmlFor="default_purchase_rate" className="block font-bold text-gray-800 mb-1 text-xs">
                    डिफ़ॉल्ट खरीद दर (Default Purchase Rate ₹)
                  </label>
                  <input
                    id="default_purchase_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.default_purchase_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, default_purchase_rate: e.target.value })
                    }
                    placeholder="e.g. 450"
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold bg-white text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="default_selling_rate"
                    className="block font-bold text-emerald-900 mb-1 flex items-center gap-1 text-xs"
                  >
                    <Layers size={14} className="text-emerald-700" /> डिफ़ॉल्ट बिक्री दर (Selling Rate ₹) *
                  </label>
                  <input
                    id="default_selling_rate"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.default_selling_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, default_selling_rate: e.target.value })
                    }
                    placeholder="e.g. 520 (Auto-fetched in Bill)"
                    className="w-full px-4 py-2.5 border-2 border-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-emerald-950 bg-white text-xs"
                  />
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">
                    ⚡  किसान का बिल काटते समय यह दर अपने-यार आ जाएगी!
                  </p>
                </div>
              </div>

              {/* Reorder Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reorder_level" className="block font-bold text-gray-700 mb-1">
                    रीऑर्डर लेवल (Reorder Level Quantity)
                  </label>
                  <input
                    id="reorder_level"
                    type="number"
                    min="0"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    placeholder="Default 10"
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="minimum_stock" className="block font-bold text-gray-700 mb-1">
                    न्यूनतम स्टॉक (Minimum Stock)
                  </label>
                  <input
                    id="minimum_stock"
                    type="number"
                    min="0"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                    placeholder="Default 5"
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block font-bold text-gray-700 mb-1">
                  Notes / टिप्पणी
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional product notes..."
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl disabled:opacity-50 transition shadow inline-flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : editingProduct ? (
                    'Update Product'
                  ) : (
                    'Save Product (उत्पाद जोड़ें)'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}