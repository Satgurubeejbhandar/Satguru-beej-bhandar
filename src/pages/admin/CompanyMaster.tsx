// src/pages/admin/CompanyMaster.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Building2, Plus, Search, Edit3, Trash2, Loader2, Phone, Mail, MapPin, FileText,
  X, CheckCircle2, RotateCcw, ShieldCheck, Power, AlertTriangle, ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions                                                   */
/* ------------------------------------------------------------------ */

interface Company {
  id: string
  company_name: string
  contact_person?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  gst_number?: string | null
  gstin?: string | null
  pan_number?: string | null
  opening_balance: number
  opening_balance_type: 'payable' | 'receivable'
  account_status: 'active' | 'inactive' | 'suspended'
  notes?: string | null
  created_at: string
}

interface CompanyFormData {
  company_name: string
  contact_person: string
  mobile: string
  email: string
  address: string
  gst_number: string
  pan_number: string
  opening_balance: string
  opening_balance_type: 'payable' | 'receivable'
  notes: string
}

type FormErrors = Partial<Record<keyof CompanyFormData, string>>

const EMPTY_FORM: CompanyFormData = {
  company_name: '',
  contact_person: '',
  mobile: '',
  email: '',
  address: '',
  gst_number: '',
  pan_number: '',
  opening_balance: '0',
  opening_balance_type: 'payable',
  notes: '',
}

function safeNum(val: unknown): number {
  return Number.isFinite(Number(val)) ? Number(val) : 0
}

function formatINR(val: number): string {
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function validateForm(data: CompanyFormData): FormErrors {
  const errors: FormErrors = {}

  if (!data.company_name.trim()) {
    errors.company_name = 'कंपनी का नाम ज़रूरी है'
  } else if (data.company_name.trim().length < 2) {
    errors.company_name = 'नाम कम से कम 2 अक्षर का हो'
  }

  if (data.mobile.trim()) {
    const clean = data.mobile.replace(/\D/g, '')
    if (clean.length !== 10) errors.mobile = 'मोबाइल 10 अंक का हो'
  }

  if (data.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errors.email = 'सही ईमेल डालें'
    }
  }

  if (data.gst_number.trim()) {
    const gst = data.gst_number.trim().toUpperCase()
    if (gst.length !== 15) errors.gst_number = 'GST 15 अक्षर का होना चाहिए'
  }

  if (data.pan_number.trim()) {
    const pan = data.pan_number.trim().toUpperCase()
    if (pan.length !== 10) errors.pan_number = 'PAN 10 अक्षर का होना चाहिए'
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      errors.pan_number = 'PAN फॉर्मेट सही नहीं है (ABCDE1234F)'
    }
  }

  return errors
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CompanyMaster() {
  const { role, loading: authLoading } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showInactive, setShowInactive] = useState<boolean>(false)

  const [showModal, setShowModal] = useState<boolean>(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [formData, setFormData] = useState<CompanyFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  /* ---- Load Companies ----
   *
   * Best Practice optimization: 
   * We retrieve ALL records from the database once. 
   * This handles toggles instantaneously on the client side without database re-fetches.
   */
  const loadCompanies = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('company_name', { ascending: true })

      if (error) throw error

      if (isMountedRef.current) {
        setCompanies((data as unknown as Company[]) || [])
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Companies लोड नहीं हो सकीं'
      toast.error('लोडिंग एरर: ' + msg)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadCompanies()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [loadCompanies, role, authLoading])

  /* ---- Lock body scroll when modal is open ---- */

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => firstInputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showModal])

  /* ---- Escape key to close modal ---- */

  useEffect(() => {
    if (!showModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        closeModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, saving])

  /* ---- Filtered List (Memoized) ----
   *
   * Handles UI slicing dynamically:
   * 1. Status Filter: Only active if showInactive is false; all if showInactive is true.
   * 2. Search Filter: Fuzzy match across multiple attributes.
   */
  const filtered = useMemo(() => {
    // Layer 1: Client-side Status Filter
    const statusFiltered = showInactive
      ? companies
      : companies.filter((c) => c.account_status === 'active')

    // Layer 2: Search Query Filter
    const q = searchQuery.trim().toLowerCase()
    if (!q) return statusFiltered

    return statusFiltered.filter((c) => {
      const name = (c.company_name || '').toLowerCase()
      const contact = (c.contact_person || '').toLowerCase()
      const mobile = (c.mobile || '').toLowerCase()
      const gst = (c.gst_number || c.gstin || '').toLowerCase()
      return name.includes(q) || contact.includes(q) || mobile.includes(q) || gst.includes(q)
    })
  }, [companies, searchQuery, showInactive])

  /* ---- Modal Handlers ---- */

  const openAdd = useCallback(() => {
    setEditingCompany(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setShowModal(true)
  }, [])

  const openEdit = useCallback((c: Company) => {
    setEditingCompany(c)
    setFormData({
      company_name: c.company_name || '',
      contact_person: c.contact_person || '',
      mobile: c.mobile || '',
      email: c.email || '',
      address: c.address || '',
      gst_number: c.gst_number || c.gstin || '',
      pan_number: c.pan_number || '',
      opening_balance: String(c.opening_balance || 0),
      opening_balance_type: c.opening_balance_type || 'payable',
      notes: c.notes || '',
    })
    setFormErrors({})
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    if (saving) return
    setShowModal(false)
    setEditingCompany(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }, [saving])

  const handleChange = useCallback(
    (field: keyof CompanyFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      if (formErrors[field]) {
        setFormErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      }
    },
    [formErrors]
  )

  /* ---- Save Handler ---- */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error('फॉर्म में गलतियाँ हैं!')
      return
    }

    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()

      const payload: Record<string, unknown> = {
        company_name: formData.company_name.trim(),
        contact_person: formData.contact_person.trim() || null,
        mobile: formData.mobile.replace(/\D/g, '') || null,
        email: formData.email.trim().toLowerCase() || null,
        address: formData.address.trim() || null,
        gstin: formData.gst_number.trim().toUpperCase() || null,
        pan_number: formData.pan_number.trim().toUpperCase() || null,
        notes: formData.notes.trim() || null,
        opening_balance: safeNum(formData.opening_balance),
        opening_balance_type: formData.opening_balance_type
      }

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(payload)
          .eq('id', editingCompany.id)

        if (error) throw new Error('Update failed: ' + error.message)
        toast.success(`"${payload.company_name}" अपडेट हो गई!`)

        if (isMountedRef.current) {
          await loadCompanies()
        }
      } else {
        const { error } = await supabase
          .from('companies')
          .insert([
            { ...payload, account_status: 'active', created_by: authData?.user?.id || null },
          ])

        if (error) {
          if (error.code === '23505') {
            throw new Error('इस नाम की कंपनी पहले से मौजूद है!')
          }
          throw new Error('Insert failed: ' + error.message)
        }

        toast.success(`"${payload.company_name}" जोड़ दी गई!`)

        if (isMountedRef.current) {
          await loadCompanies()
        }
      }

      if (isMountedRef.current) {
        closeModal()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सेव करने में समस्या आई'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  /* ---- SOFT DELETE (Deactivate / Reactivate) ---- */
  const handleToggleStatus = async (c: Company) => {
    const isDeactivating = c.account_status === 'active'
    const actionText = isDeactivating ? 'इनएक्टिव' : 'एक्टिव'

    if (
      !window.confirm(
        `⚠️ "${c.company_name}" को ${actionText} (Soft Delete) करना चाहते हैं?\n\n(पुराने प्रोडक्ट्स, बिल और खरीदारी का डेटा सुरक्षित रहेगा)`
      )
    )
      return

    try {
      const targetStatus: Company['account_status'] = isDeactivating ? 'inactive' : 'active'
      const { error } = await supabase
        .from('companies')
        .update({ account_status: targetStatus })
        .eq('id', c.id)

      if (error) throw error

      toast.success(`"${c.company_name}" ${actionText} कर दी गई!`)

      if (isMountedRef.current) {
        await loadCompanies()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'स्टेटस बदलने में समस्या आई'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    }
  }

  /* ---- HARD DELETE (Permanent — DANGEROUS) ---- */

  const handleHardDelete = async (c: Company) => {
    try {
      const [prodCheck, purchCheck] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id),
        supabase
          .from('purchase_bills')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id),
      ])

      const productCount = prodCheck.count || 0
      const purchaseCount = purchCheck.count || 0

      // 🟢 FIX: Safety Block - Agar bill ya product hain toh Delete permanently BLOCK karo
      if (purchaseCount > 0 || productCount > 0) {
        toast.error(
          `डिलीट रोक दिया गया! "${c.company_name}" के ${purchaseCount} खरीद बिल और ${productCount} प्रोडक्ट्स बने हुए हैं। पहले उन्हें हटाएँ या कंपनी को 'Inactive' करें।`,
          { duration: 6000 }
        )
        return
      }

      let warningMsg = `🚨 खतरनाक चेतावनी (PERMANENT HARD DELETE) 🚨\n\n"${c.company_name}" को हमेशा के लिए मिटाने वाले हैं!\n\n`

      warningMsg += `कन्फर्म करने के लिए नीचे 'DELETE' टाइप करें:`

      const confirmText = window.prompt(warningMsg)
      if (confirmText !== 'DELETE') {
        toast('Delete cancelled', { icon: '❌' })
        return
      }

      setDeletingId(c.id)

      const { error } = await supabase.from('companies').delete().eq('id', c.id)
      if (error) throw error

      toast.success(`"${c.company_name}" पूरी तरह मिटा दी गई!`, { duration: 4000 })

      if (isMountedRef.current) {
        await loadCompanies()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete में समस्या आई'
      if (isMountedRef.current) {
        toast.error(
          'Delete Failed: ' +
            msg +
            '\n(Database में ON DELETE CASCADE Foreign Key लगाना ज़रूरी है)',
          { duration: 6000 }
        )
      }
    } finally {
      if (isMountedRef.current) {
        setDeletingId(null)
      }
    }
  }

  /* ---- Render Field ---- */

  const renderField = (
    field: keyof CompanyFormData,
    label: string,
    type: string = 'text',
    placeholder: string = '',
    customClass: string = ''
  ) => {
    const isError = Boolean(formErrors[field])
    const baseClass = `w-full p-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
      field === 'company_name' ? 'font-bold' : 'font-medium'
    } ${customClass} ${
      isError ? 'border-rose-400 bg-rose-50' : 'border-gray-300 bg-white'
    }`

    return (
      <div>
        <label
          htmlFor={`company-${field}`}
          className="block font-bold text-gray-700 mb-1 text-xs"
        >
          {label}
          {field === 'company_name' && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {type === 'textarea' ? (
          <textarea
            id={`company-${field}`}
            value={formData[field]}
            onChange={(e) => handleChange(field, e.target.value)}
            className={`${baseClass} resize-none`}
            rows={2}
            placeholder={placeholder}
            disabled={saving}
          />
        ) : (
          <input
            id={`company-${field}`}
            ref={field === 'company_name' ? firstInputRef : undefined}
            type={type}
            value={formData[field]}
            onChange={(e) => handleChange(field, e.target.value)}
            className={baseClass}
            placeholder={placeholder}
            disabled={saving}
          />
        )}
        {isError && (
          <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
            <X size={10} /> {formErrors[field]}
          </p>
        )}
      </div>
    )
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Company Master ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-amber-400" size={28} aria-hidden="true" />
            Company Management
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            दवाई और बीज सप्लायर्स कंपनियाँ (Master Catalogue)
          </p>
        </div>
        <div className="flex gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setShowInactive((prev) => !prev)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              showInactive
                ? 'bg-emerald-800 text-emerald-100 border border-emerald-600'
                : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-800'
            }`}
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          <button
            type="button"
            onClick={openAdd}
            aria-label="Add new company"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition-all shrink-0 cursor-pointer"
          >
            <Plus size={16} /> Add Company
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="text-gray-400 shrink-0" size={18} aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by company name, contact person, mobile, or GST..."
          aria-label="Search companies"
          className="flex-1 outline-none text-sm font-medium bg-transparent"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="text-gray-400 hover:text-gray-600 p-1 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
        {searchQuery && (
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold shrink-0">
            {filtered.length} / {companies.length}
          </span>
        )}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="animate-spin text-emerald-700 mb-3" size={36} />
          <p className="font-bold">Companies Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-10 text-center text-gray-500 font-medium">
          {searchQuery ? 'कोई कंपनी नहीं मिली इस खोज में।' : 'अभी कोई कंपनी नहीं जोड़ी गई।'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const isInactive = c.account_status === 'inactive'
            const isDeleting = deletingId === c.id
            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border p-5 space-y-3 transition-shadow hover:shadow-md ${
                  isInactive ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200 shadow-sm'
                } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isInactive
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-gray-900 text-sm leading-tight truncate flex items-center gap-1.5">
                        <span className={isInactive ? 'line-through opacity-60' : ''}>
                          {c.company_name}
                        </span>
                        {isInactive && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                            Inactive
                          </span>
                        )}
                      </h3>
                      {c.contact_person && (
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                          <FileText size={10} /> {c.contact_person}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      aria-label={`Edit ${c.company_name}`}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Company"
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* SOFT DELETE / REACTIVATE */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c)}
                      aria-label={
                        isInactive
                          ? `Reactivate ${c.company_name}`
                          : `Deactivate ${c.company_name}`
                      }
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isInactive
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-amber-600 hover:bg-amber-50'
                      }`}
                      title={isInactive ? 'Reactivate (Soft)' : 'Deactivate (Soft Delete)'}
                    >
                      {isInactive ? <RotateCcw size={14} /> : <Power size={14} />}
                    </button>

                    {/* HARD DELETE (Permanent) */}
                    <button
                      type="button"
                      onClick={() => handleHardDelete(c)}
                      disabled={isDeleting}
                      aria-label={`Permanently delete ${c.company_name}`}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                      title="Hard Delete (Permanent — Dangerous!)"
                    >
                      {isDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 border-t pt-2">
                  {c.mobile && (
                    <p className="flex items-center gap-2">
                      <Phone size={12} className="text-gray-400 shrink-0" /> {c.mobile}
                    </p>
                  )}
                  {c.email && (
                    <p className="flex items-center gap-2 truncate">
                      <Mail size={12} className="text-gray-400 shrink-0" /> {c.email}
                    </p>
                  )}
                  {(c.gst_number || c.gstin) && (
                    <p className="flex items-center gap-2 font-mono">
                      <FileText size={12} className="text-gray-400 shrink-0" /> GST:{' '}
                      {c.gst_number || c.gstin}
                    </p>
                  )}
                  {c.pan_number && (
                    <p className="flex items-center gap-2 font-mono">
                      <FileText size={12} className="text-gray-400 shrink-0" /> PAN:{' '}
                      {c.pan_number}
                    </p>
                  )}
                  {c.address && (
                    <p className="flex items-center gap-2">
                      <MapPin size={12} className="text-gray-400 shrink-0" /> {c.address}
                    </p>
                  )}
                  <p className="flex justify-between items-center bg-amber-50/50 p-2 rounded-lg mt-2">
                    <span className="font-bold text-amber-950">Opening Balance:</span>
                    <span className="font-mono font-black text-amber-900">₹{formatINR(c.opening_balance)} {c.opening_balance_type === 'payable' ? 'Cr' : 'Dr'}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Danger Zone Info Banner */}
      {companies.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-rose-800">
            <p className="font-black mb-1">Delete Buttons Guide:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>
                <b>Power (Amber):</b> Soft Delete — कंपनी Inactive होगी, डेटा सुरक्षित।
              </li>
              <li>
                <b>Trash (Red):</b> Hard Delete — कंपनी और सारा जुड़ा डेटा हमेशा के लिए मिट
                जाएगा (अगर DB में CASCADE लगा हो)।
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-modal-title"
        >
          <div
            ref={modalRef}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl flex justify-between items-center z-10">
              <h2
                id="company-modal-title"
                className="font-black text-emerald-950 text-lg flex items-center gap-2"
              >
                <Building2 size={20} className="text-emerald-700" />
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 text-sm">
              {renderField('company_name', 'कंपनी का नाम', 'text', 'e.g. Syngenta India Pvt Ltd')}

              {renderField('contact_person', 'Contact Person', 'text', 'Sales Rep Name')}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderField('mobile', 'Mobile', 'tel', '10 digit')}
                {renderField('email', 'Email', 'email', 'email@company.com')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderField(
                  'gst_number',
                  'GST Number',
                  'text',
                  '22AAAAA0000A1Z5',
                  'font-mono font-bold'
                )}
                {renderField(
                  'pan_number',
                  'PAN Number',
                  'text',
                  'ABCDE1234F',
                  'font-mono font-bold'
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <label className="block font-bold text-amber-950 text-xs mb-1">Opening Balance (₹)</label>
                  <input type="number" step="0.01" value={formData.opening_balance} onChange={e => handleChange('opening_balance', e.target.value)} className="w-full p-2 border rounded-lg font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block font-bold text-amber-950 text-xs mb-1">Bal Type</label>
                  <select value={formData.opening_balance_type} onChange={e => handleChange('opening_balance_type', e.target.value)} className="w-full p-2 border rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                    <option value="payable">Payable (Cr)</option>
                    <option value="receivable">Receivable (Dr)</option>
                  </select>
                </div>
              </div>

              {renderField('address', 'Address', 'textarea', 'Full address')}
              {renderField('notes', 'Notes', 'textarea', 'Supplier terms or remarks...')}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl transition-colors disabled:opacity-50 text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {editingCompany ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}