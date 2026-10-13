// src/pages/admin/Letterpad.tsx
import { useState, useEffect, useCallback, FC } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  FileSignature, Plus, Trash2, Download, Clock, History,
  FileText, ShieldAlert, CheckCircle2, RotateCcw, Building2,
  Eye, X, MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Company {
  id: string
  company_name: string
  gstin?: string | null
  address?: string | null
}

interface LetterpadItem {
  id: string
  productName: string
  size: string
  quantity: string
}

interface LetterpadEntry {
  id: string
  type: 'ORDER' | 'RETURN'
  reference_no: string
  company_name?: string | null
  company_id?: string | null
  company_address?: string | null
  company_gstin?: string | null
  items: Omit<LetterpadItem, 'id'>[]
  created_at: string
  companies?: {
    address?: string | null
    gstin?: string | null
  } | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Letterpad: FC = () => {
  const { role, user, loading: authLoading } = useAuth()

  const [activeTab, setActiveTab] = useState<'CREATE' | 'HISTORY'>('CREATE')
  const [padType, setPadType] = useState<'ORDER' | 'RETURN'>('ORDER')

  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  const [items, setItems] = useState<LetterpadItem[]>([
    { id: crypto.randomUUID(), productName: '', size: '', quantity: '' },
  ])
  const [saving, setSaving] = useState(false)

  const [history, setHistory] = useState<LetterpadEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewData, setPreviewData] = useState<{
    type: 'ORDER' | 'RETURN'
    refNo: string
    dateStr: string
    companyName: string
    companyAddress: string
    companyGstin: string
    itemsList: { productName: string; size: string; quantity: string }[]
  } | null>(null)

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getKolkataTime = () =>
    new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

  const generateRefNo = (type: 'ORDER' | 'RETURN') => {
    const prefix = type === 'ORDER' ? 'ORD' : 'RET'
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00'
    return `${prefix}-${get('day')}${get('month')}${get('year')}-${get('hour')}${get('minute')}`
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || null

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id)
    const company = companies.find((c) => c.id === id)
    setCompanyAddress(company?.address?.trim() || '')
  }

  // ─── Load Companies (Fixed TS Error) ───────────────────────────────────────

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_name, gstin, address')
        .eq('account_status', 'active')
        .order('company_name')

      if (error) throw error
      setCompanies((data as Company[]) || [])
    } catch {
      // Fallback agar address column DB me na ho
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('companies')
          .select('id, company_name, gstin')
          .eq('account_status', 'active')
          .order('company_name')

        if (fallbackError) throw fallbackError
        setCompanies((fallbackData as Company[]) || [])
      } catch {
        toast.error('Companies load failed')
      }
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') void loadCompanies()
  }, [role, loadCompanies])

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), productName: '', size: '', quantity: '' }])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return toast.error('Kam se kam 1 item hona zaroori hai')
    setItems(items.filter((item) => item.id !== id))
  }

  const handleItemChange = (id: string, field: keyof LetterpadItem, value: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  // ─── PDF Engine ────────────────────────────────────────────────────────────

  const generatePDF = (data: {
    type: 'ORDER' | 'RETURN'
    refNo: string
    dateStr: string
    companyName: string
    companyAddress?: string | null
    companyGstin?: string | null
    itemsList: { productName: string; size: string; quantity: string }[]
  }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Watermark
    const watermarkText = data.type === 'ORDER' ? 'SATGURU ORDER' : 'RETURN'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(60)

    let usedOpacity = false
    try {
      const GState = (doc as any).GState
      if (typeof GState === 'function') {
        doc.saveGraphicsState?.()
        doc.setGState?.(new GState({ opacity: 0.12 }))
        usedOpacity = true
      }
    } catch {
      usedOpacity = false
    }

    doc.setTextColor(usedOpacity ? 6 : 210, usedOpacity ? 78 : 220, usedOpacity ? 59 : 215)

    ;[
      { x: pageWidth * 0.5, y: pageHeight * 0.32 },
      { x: pageWidth * 0.5, y: pageHeight * 0.52 },
      { x: pageWidth * 0.5, y: pageHeight * 0.72 },
    ].forEach((pos) => {
      doc.text(watermarkText, pos.x, pos.y, { angle: 30, align: 'center', baseline: 'middle' })
    })

    try {
      if (usedOpacity) doc.restoreGraphicsState?.()
    } catch { /* ignore */ }

    // Header
    doc.setTextColor(6, 78, 59)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('SATGURU BEEJ BHANDAR', pageWidth / 2, 18, { align: 'center' })

    doc.setTextColor(71, 85, 105)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Daloosar, Sardarshahar (Churu), Rajasthan', pageWidth / 2, 25, { align: 'center' })

    doc.setDrawColor(6, 78, 59)
    doc.setLineWidth(0.6)
    doc.line(15, 30, pageWidth - 15, 30)

    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text(data.type === 'ORDER' ? 'PURCHASE ORDER' : 'GOODS RETURN NOTE', 15, 39)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Reference No: ${data.refNo}`, 15, 45)
    doc.text(`Date & Time: ${data.dateStr}`, pageWidth - 15, 45, { align: 'right' })

    // Company block
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(6, 78, 59)
    doc.text('Company / Supplier:', 15, 53)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11)
    doc.text(data.companyName || '—', 54, 53)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)

    let dynamicY = 58
    if (data.companyAddress?.trim()) {
      const lines = doc.splitTextToSize(`Address: ${data.companyAddress.trim()}`, pageWidth - 70)
      doc.text(lines, 54, dynamicY)
      dynamicY += lines.length * 4.5 + 1
    }
    if (data.companyGstin?.trim()) {
      doc.text(`GSTIN: ${data.companyGstin.trim()}`, 54, dynamicY)
      dynamicY += 5
    }

    const tableStartY = Math.max(dynamicY + 3, 62)

    autoTable(doc, {
      startY: tableStartY,
      head: [['S.No.', 'Product Name', 'Size / Variant', 'Quantity']],
      body: data.itemsList.map((item, index) => [
        index + 1,
        item.productName,
        item.size || '—',
        item.quantity,
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: data.type === 'ORDER' ? [6, 78, 59] : [159, 18, 57],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40 },
        3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 15, right: 15 },
    })

    // Footer
    doc.setFontSize(9)
    doc.setTextColor(190, 18, 60)
    doc.setFont('helvetica', 'bold')
    doc.text('IMPORTANT DISCLAIMER:', 15, pageHeight - 42)

    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text('Any purchase or return order processed without the authorized signature', 15, pageHeight - 36)
    doc.text("and official stamp of SATGURU BEEJ BHANDAR shall be at the company's own risk.", 15, pageHeight - 31)
    doc.text('SATGURU BEEJ BHANDAR shall not be responsible or liable for any such', 15, pageHeight - 26)
    doc.text('purchase or return order.', 15, pageHeight - 21)

    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.4)
    doc.line(pageWidth - 70, pageHeight - 25, pageWidth - 15, pageHeight - 25)

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Authorized Signatory / Seal', pageWidth - 42.5, pageHeight - 18, { align: 'center' })

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('SATGURU BEEJ BHANDAR — Official Letterpad', pageWidth / 2, pageHeight - 8, {
      align: 'center',
    })

    doc.save(`${data.refNo}.pdf`)
  }

  // ─── Validate ──────────────────────────────────────────────────────────────

  const validateForm = () => {
    if (!selectedCompanyId || !selectedCompany) {
      toast.error('Pehle Company select karein')
      return false
    }
    const invalid = items.some((i) => !i.productName.trim() || !i.quantity.trim())
    if (invalid) {
      toast.error('Sabhi products ka naam aur quantity bharna zaroori hai.')
      return false
    }
    return true
  }

  const handlePreview = () => {
    if (!validateForm() || !selectedCompany) return

    setPreviewData({
      type: padType,
      refNo: generateRefNo(padType),
      dateStr: getKolkataTime(),
      companyName: selectedCompany.company_name,
      companyAddress: companyAddress.trim(),
      companyGstin: selectedCompany.gstin || '',
      itemsList: items.map(({ productName, size, quantity }) => ({
        productName: productName.trim(),
        size: size.trim(),
        quantity: quantity.trim(),
      })),
    })
    setShowPreviewModal(true)
  }

  // ─── Finalize ──────────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    if (!validateForm() || !selectedCompany) return

    setSaving(true)
    const refNo = generateRefNo(padType)
    const dateStr = getKolkataTime()
    const cleanItems = items.map(({ productName, size, quantity }) => ({
      productName: productName.trim(),
      size: size.trim(),
      quantity: quantity.trim(),
    }))

    try {
      const { error } = await supabase.from('letterpads').insert([
        {
          type: padType,
          reference_no: refNo,
          company_id: selectedCompanyId,
          company_name: selectedCompany.company_name,
          company_address: companyAddress.trim() || null,
          company_gstin: selectedCompany.gstin || null,
          items: cleanItems,
          created_by: user?.id || null,
        },
      ])

      if (error) throw error

      generatePDF({
        type: padType,
        refNo,
        dateStr,
        companyName: selectedCompany.company_name,
        companyAddress: companyAddress.trim(),
        companyGstin: selectedCompany.gstin,
        itemsList: cleanItems,
      })

      toast.success('Letterpad Saved & PDF Downloaded!')
      setItems([{ id: crypto.randomUUID(), productName: '', size: '', quantity: '' }])
      fetchHistory()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ─── History ───────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('letterpads')
        .select(`
          id, type, reference_no, items, company_id, company_name,
          company_address, company_gstin, created_at,
          companies ( address, gstin )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        const fb = await supabase
          .from('letterpads')
          .select('id, type, reference_no, items, company_id, company_name, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (fb.error) throw fb.error
        setHistory((fb.data as LetterpadEntry[]) || [])
      } else {
        setHistory((data as unknown as LetterpadEntry[]) || [])
      }
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'HISTORY') fetchHistory()
  }, [activeTab, fetchHistory])

  // ─── Access Gate ───────────────────────────────────────────────────────────

  if (!authLoading && role !== 'admin') {
    return (
      <div className="flex justify-center p-8">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex items-center gap-3">
          <ShieldAlert size={28} />
          <p className="font-bold">Access Denied. Only Admins can access Letterpads.</p>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3">
          <FileSignature size={32} className="text-emerald-300" />
          Official Letterpads
        </h1>
        <p className="text-emerald-100 text-sm mt-1">
          Order / Return notes with Company address, watermark &amp; instant preview
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200 max-w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('CREATE')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'CREATE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Plus size={16} /> Create New
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <History size={16} /> View History
        </button>
      </div>

      {/* CREATE */}
      {activeTab === 'CREATE' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          {/* Type */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label
              className={`flex-1 border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                padType === 'ORDER' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" className="hidden" checked={padType === 'ORDER'} onChange={() => setPadType('ORDER')} />
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${padType === 'ORDER' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className={`font-bold ${padType === 'ORDER' ? 'text-emerald-900' : 'text-slate-700'}`}>Satguru Order</h3>
                  <p className="text-xs text-slate-500">Watermark: SATGURU ORDER</p>
                </div>
              </div>
            </label>

            <label
              className={`flex-1 border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                padType === 'RETURN' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" className="hidden" checked={padType === 'RETURN'} onChange={() => setPadType('RETURN')} />
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${padType === 'RETURN' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className={`font-bold ${padType === 'RETURN' ? 'text-rose-900' : 'text-slate-700'}`}>Goods Return</h3>
                  <p className="text-xs text-slate-500">Watermark: SATGURU RETURN</p>
                </div>
              </div>
            </label>
          </div>

          {/* Company Select */}
          <div className="space-y-2">
            <label className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5 ml-1">
              <Building2 size={14} className="text-emerald-500" />
              Company / Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={loadingCompanies}
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full appearance-none px-4 py-3.5 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
            >
              <option value="">-- Select Company for this {padType === 'ORDER' ? 'Order' : 'Return'} --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}{c.gstin ? ` (GST: ${c.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Company Address Input Field */}
          <div className="space-y-2">
            <label className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5 ml-1">
              <MapPin size={14} className="text-emerald-500" />
              Company Address
              <span className="text-slate-400 normal-case tracking-normal font-semibold">(PDF me print hoga)</span>
            </label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Company ka address yahan likhein... (Auto-filled if available in companies table)"
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 rounded-2xl font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-y min-h-[80px]"
            />
            {selectedCompany?.gstin && (
              <p className="text-[11px] text-slate-500 font-semibold ml-1">
                GSTIN: <span className="text-slate-700">{selectedCompany.gstin}</span>
              </p>
            )}
          </div>

          {/* Items */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-700">Add Products</h3>
              <p className="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                <Clock size={12} className="inline mr-1" /> {getKolkataTime()}
              </p>
            </div>

            <div className="hidden sm:grid grid-cols-[40px_1fr_140px_120px_44px] gap-3 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>#</span>
              <span>Product Name</span>
              <span>Size</span>
              <span>Quantity</span>
              <span />
            </div>

            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col sm:grid sm:grid-cols-[40px_1fr_140px_120px_44px] gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
              >
                <div className="w-8 h-10 flex items-center justify-center font-bold text-slate-300 bg-slate-50 rounded-lg text-sm">
                  {index + 1}
                </div>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={item.productName}
                  onChange={(e) => handleItemChange(item.id, 'productName', e.target.value)}
                  className="bg-slate-50 border-none outline-none focus:ring-2 ring-emerald-500 rounded-lg px-4 py-2 font-semibold text-slate-700 text-sm"
                />
                <input
                  type="text"
                  placeholder="Size (e.g., 10g / 1kg)"
                  value={item.size}
                  onChange={(e) => handleItemChange(item.id, 'size', e.target.value)}
                  className="bg-slate-50 border-none outline-none focus:ring-2 ring-emerald-500 rounded-lg px-4 py-2 text-slate-700 text-sm"
                />
                <input
                  type="text"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  className="bg-slate-50 border-none outline-none focus:ring-2 ring-emerald-500 rounded-lg px-4 py-2 font-bold text-slate-700 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 text-emerald-600 bg-emerald-100 hover:bg-emerald-200 font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Plus size={16} /> Add Product
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={handlePreview}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95"
            >
              <Eye size={20} />
              Preview PDF
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-70"
            >
              {saving ? <RotateCcw className="animate-spin" size={20} /> : <Download size={20} />}
              {saving ? 'Processing...' : 'Finalize & Download'}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date &amp; Time</th>
                  <th className="px-6 py-4">Ref No.</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Loading history...</td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  history.map((record) => {
                    const addr = record.company_address || record.companies?.address || ''
                    const gst = record.company_gstin || record.companies?.gstin || ''

                    const pdfPayload = {
                      type: record.type,
                      refNo: record.reference_no,
                      dateStr: new Date(record.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      }),
                      companyName: record.company_name || '—',
                      companyAddress: addr,
                      companyGstin: gst,
                      itemsList: record.items || [],
                    }

                    return (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono text-slate-600 text-xs">
                          {pdfPayload.dateStr}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800 font-mono text-xs">
                          {record.reference_no}
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <div className="font-semibold text-slate-700 text-xs truncate">
                            {record.company_name || '—'}
                          </div>
                          {addr && (
                            <div className="text-[10px] text-slate-400 truncate">{addr}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase ${
                              record.type === 'ORDER'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {record.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600">
                          {record.items?.length || 0}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewData(pdfPayload)
                              setShowPreviewModal(true)
                            }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors inline-flex"
                            title="Preview Letterpad"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => generatePDF(pdfPayload)}
                            className="p-2 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 rounded-xl transition-colors inline-flex"
                            title="Download PDF"
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── LIVE HTML LETTERPAD PREVIEW MODAL (CSP FREE & INSTANT) ─── */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-800 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="text-emerald-400" size={20} />
                  Letterpad Live Preview
                </h3>
                <p className="text-xs text-slate-400">Ye bilkul waise hi print hoga jaise yahan dikh raha hai.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* A4 Preview Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-800">
              <div className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-2xl rounded-sm relative flex flex-col justify-between select-none">
                
                {/* Watermark Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-emerald-950/[0.06] text-6xl sm:text-7xl font-black rotate-[-30deg] tracking-widest uppercase">
                    {previewData.type === 'ORDER' ? 'SATGURU ORDER' : 'RETURN'}
                  </span>
                </div>

                {/* Letterpad Content */}
                <div className="space-y-6 relative z-10">
                  {/* Header */}
                  <div className="text-center pb-4 border-b-2 border-emerald-800">
                    <h1 className="text-2xl sm:text-3xl font-black text-emerald-900 tracking-wide">
                      SATGURU BEEJ BHANDAR
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                      Daloosar, Sardarshahar (Churu), Rajasthan
                    </p>
                  </div>

                  {/* Title & Reference Info */}
                  <div className="flex justify-between items-start text-xs sm:text-sm pt-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                        {previewData.type === 'ORDER' ? 'PURCHASE ORDER' : 'GOODS RETURN NOTE'}
                      </h2>
                      <p className="text-slate-600 mt-1">Ref No: <span className="font-bold text-slate-800">{previewData.refNo}</span></p>
                    </div>
                    <div className="text-right text-slate-600">
                      <p>Date &amp; Time:</p>
                      <p className="font-semibold text-slate-800">{previewData.dateStr}</p>
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
                    <div className="flex gap-2">
                      <span className="font-bold text-emerald-800 w-36 shrink-0">Company / Supplier:</span>
                      <span className="font-bold text-slate-900">{previewData.companyName}</span>
                    </div>
                    {previewData.companyAddress && (
                      <div className="flex gap-2 text-slate-600">
                        <span className="font-medium text-slate-500 w-36 shrink-0">Address:</span>
                        <span>{previewData.companyAddress}</span>
                      </div>
                    )}
                    {previewData.companyGstin && (
                      <div className="flex gap-2 text-slate-600">
                        <span className="font-medium text-slate-500 w-36 shrink-0">GSTIN:</span>
                        <span>{previewData.companyGstin}</span>
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className={previewData.type === 'ORDER' ? 'bg-emerald-800 text-white' : 'bg-rose-800 text-white'}>
                          <th className="p-3 w-12 text-center border-r border-emerald-700">#</th>
                          <th className="p-3 border-r border-emerald-700">Product Name</th>
                          <th className="p-3 w-32 border-r border-emerald-700">Size / Variant</th>
                          <th className="p-3 w-28 text-center">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.itemsList.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="p-3 text-center border-r border-slate-200 font-semibold text-slate-400">{index + 1}</td>
                            <td className="p-3 border-r border-slate-200 font-medium text-slate-800">{item.productName}</td>
                            <td className="p-3 border-r border-slate-200 text-slate-600">{item.size || '—'}</td>
                            <td className="p-3 text-center font-bold text-slate-900">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="pt-8 space-y-6 relative z-10 border-t border-slate-200 mt-8">
                  <div className="flex justify-between items-end">
                    <div className="max-w-md text-[10px] sm:text-xs text-slate-500 space-y-1">
                      <p className="font-bold text-rose-600 uppercase">IMPORTANT DISCLAIMER:</p>
                      <p>
                        Any purchase or return order processed without the authorized signature
                        and official stamp of SATGURU BEEJ BHANDAR shall be entirely at the
                        company&apos;s own risk. SATGURU BEEJ BHANDAR shall not be held
                        responsible or liable for any such purchase or return order.
                      </p>
                    </div>

                    <div className="text-center w-48">
                      <div className="border-b border-slate-800 mb-2 h-10"></div>
                      <p className="text-xs font-bold text-slate-800">Authorized Signatory / Seal</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-slate-400 pt-2">
                    SATGURU BEEJ BHANDAR — Official Letterpad
                  </p>
                </div>

              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  generatePDF(previewData)
                  setShowPreviewModal(false)
                }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Download size={16} /> Download PDF Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Letterpad