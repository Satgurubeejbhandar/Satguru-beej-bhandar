// File: src/pages/admin/FarmersMaster.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Search,
  Plus,
  UserX,
  Edit,
  UserCheck,
  Camera,
  Shield,
  CreditCard,
  KeyRound,
  History,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import FarmerCardModal from '../../components/admin/FarmerCardModal'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Farmer {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string
  mobile: string
  aadhaar_number?: string
  village: string
  photo_url?: string
  credit_limit: number
  repayment_days: number
  account_status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

interface FarmerIdHistoryEntry {
  id: string
  farmer_id: string
  old_farmer_id: string
  new_farmer_id: string
  reason: string
  changed_at: string
}

interface FarmerFormData {
  farmer_name: string
  father_name: string
  mobile: string
  aadhaar_number: string
  village: string
  credit_limit: string
  repayment_days: string
  pin: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_FORM_DATA: FarmerFormData = {
  farmer_name: '',
  father_name: '',
  mobile: '',
  aadhaar_number: '',
  village: '',
  credit_limit: '',
  repayment_days: '90',
  pin: '',
}

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function maskAadhaar(raw?: string): string {
  if (!raw || raw.length < 4) return '—'
  const digitsOnly = raw.replace(/\D/g, '')
  const last4 = digitsOnly.slice(-4)
  if (last4.length !== 4) return '—'
  return `XXXX-XXXX-${last4}`
}

function sanitize(value?: string | number | null): string {
  if (value === null || value === undefined) return ''
  // Strip control characters, preserve Hindi/Unicode
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

function isSafeImageUrl(url?: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function validateFile(file: File | null, label: string): string | null {
  if (!file) return null
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${label}: Only JPEG, PNG, WebP and HEIC images are allowed.`
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${label}: File size must be under ${MAX_FILE_SIZE_MB}MB.`
  }
  return null
}

function generateUploadPath(prefix: string, farmerId: string, ext: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `${prefix}/${farmerId}-${Date.now()}-${randomSuffix}.${ext}`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FarmersMaster() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Selected Farmer for Card Preview
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)

  // Edit Farmer ID State
  const [showEditIdModal, setShowEditIdModal] = useState(false)
  const [editFarmerTarget, setEditFarmerTarget] = useState<Farmer | null>(null)
  const [newFarmerIdInput, setNewFarmerIdInput] = useState('')
  const [editReason, setEditFarmerReason] = useState('')
  const [idHistory, setIdHistory] = useState<FarmerIdHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Add Farmer Form State
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState<FarmerFormData>({ ...INITIAL_FORM_DATA })

  // Document File States
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [kccFile, setKccFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // Refs for resetting file inputs
  const photoInputRef = useRef<HTMLInputElement>(null)
  const aadhaarInputRef = useRef<HTMLInputElement>(null)
  const kccInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch All Farmers ────────────────────────────────────────────────────────
  // Explicitly select columns to NEVER send full aadhaar_number to client
  // If your DB schema requires it, create a view or use RLS to mask it.
  // For now, we still select aadhaar_number but only ever display it masked.

  const fetchFarmers = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('farmers')
        .select(
          'id, farmer_id, farmer_name, father_name, mobile, aadhaar_number, village, photo_url, credit_limit, repayment_days, account_status, created_at, updated_at'
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      setFarmers((data as Farmer[]) || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch farmers'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFarmers()
  }, [fetchFarmers])

  // ── Keyboard handler for modals ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCardModal) {
          setShowCardModal(false)
          return
        }
        if (showEditIdModal) {
          if (!saving) setShowEditIdModal(false)
          return
        }
        if (showAddModal) {
          if (!saving) setShowAddModal(false)
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showCardModal, showEditIdModal, showAddModal, saving])

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyModalOpen = showAddModal || showEditIdModal || showCardModal
    if (anyModalOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [showAddModal, showEditIdModal, showCardModal])

  // ── Upload file helper ───────────────────────────────────────────────────────

  const uploadFile = async (bucket: string, path: string, file: File): Promise<string> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw new Error(`Upload failed (${bucket}): ${error.message}`)

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
    return urlData.publicUrl
  }

  // ── Reset add form ──────────────────────────────────────────────────────────

  const resetAddForm = useCallback(() => {
    setFormData({ ...INITIAL_FORM_DATA })
    setPhotoFile(null)
    setAadhaarFile(null)
    setKccFile(null)
    // Reset file input DOM elements
    if (photoInputRef.current) photoInputRef.current.value = ''
    if (aadhaarInputRef.current) aadhaarInputRef.current.value = ''
    if (kccInputRef.current) kccInputRef.current.value = ''
  }, [])

  // ── Handle Add New Farmer ────────────────────────────────────────────────────

  const handleAddFarmer = async (e: React.FormEvent) => {
    e.preventDefault()

    // ── Client-side validations ──
    const trimmedName = sanitize(formData.farmer_name)
    const trimmedFather = sanitize(formData.father_name)
    const trimmedMobile = formData.mobile.replace(/\D/g, '')
    const trimmedAadhaar = formData.aadhaar_number.replace(/\D/g, '')
    const trimmedVillage = sanitize(formData.village)
    const trimmedPin = formData.pin.replace(/\D/g, '')
    const creditLimitNum = Number(formData.credit_limit)
    const repaymentDaysNum = Number(formData.repayment_days)

    if (!trimmedName) {
      toast.error('किसान का नाम भरें')
      return
    }
    if (!trimmedFather) {
      toast.error('पिता का नाम भरें')
      return
    }
    if (trimmedMobile.length !== 10) {
      toast.error('मोबाइल नंबर 10 अंकों का होना चाहिए')
      return
    }
    if (trimmedAadhaar && trimmedAadhaar.length !== 12) {
      toast.error('आधार नंबर 12 अंकों का होना चाहिए')
      return
    }
    if (!trimmedVillage) {
      toast.error('गाँव का नाम भरें')
      return
    }
    if (isNaN(creditLimitNum) || creditLimitNum < 0) {
      toast.error('क्रेडिट लिमिट सही भरें')
      return
    }
    if (isNaN(repaymentDaysNum) || repaymentDaysNum < 30 || repaymentDaysNum > 210) {
      toast.error('Repayment days 30-210 के बीच होने चाहिए')
      return
    }
    if (trimmedPin.length !== 6) {
      toast.error('Transaction PIN 6 अंकों का होना चाहिए')
      return
    }

    // ── File validations ──
    const photoErr = validateFile(photoFile, 'Farmer Photo')
    if (photoErr) { toast.error(photoErr); return }
    const aadhaarErr = validateFile(aadhaarFile, 'Aadhaar Card')
    if (aadhaarErr) { toast.error(aadhaarErr); return }
    const kccErr = validateFile(kccFile, 'KCC Document')
    if (kccErr) { toast.error(kccErr); return }

    setSaving(true)

    try {
      // 1. Generate unique Farmer ID server-side
      const { data: newFarmerId, error: fnError } = await supabase.rpc('generate_farmer_id')
      if (fnError) throw new Error(`ID generation failed: ${fnError.message}`)
      if (!newFarmerId) throw new Error('Failed to generate Farmer ID')

      let uploadedPhotoUrl = ''

      // 2. Upload Photo if selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'jpg'
        const photoPath = generateUploadPath('photos', String(newFarmerId), fileExt)
        uploadedPhotoUrl = await uploadFile('farmer-photos', photoPath, photoFile)
      }

      // 3. Insert Farmer Record
      const { data: insertedFarmer, error: insertError } = await supabase
        .from('farmers')
        .insert([
          {
            farmer_id: newFarmerId,
            farmer_name: trimmedName,
            father_name: trimmedFather,
            mobile: trimmedMobile,
            aadhaar_number: trimmedAadhaar || null,
            village: trimmedVillage,
            photo_url: uploadedPhotoUrl || null,
            credit_limit: creditLimitNum,
            repayment_days: repaymentDaysNum,
            account_status: 'active',
          },
        ])
        .select()
        .single()

      if (insertError) throw new Error(`Farmer insert failed: ${insertError.message}`)
      if (!insertedFarmer) throw new Error('Farmer insert returned no data')

      // 4. Create Credit Account Record
      const { error: creditError } = await supabase.from('credit_accounts').insert([
        {
          farmer_id: insertedFarmer.id,
          credit_limit: creditLimitNum,
          available_credit: creditLimitNum,
          current_outstanding: 0,
        },
      ])
      if (creditError) {
        console.error('Credit account creation failed:', creditError.message)
        toast.error('Warning: Credit account creation failed. Contact support.')
        // Don't throw — farmer is already created; this can be fixed manually
      }

      // 5. Upload Aadhaar & KCC documents if provided
      if (aadhaarFile) {
        try {
          const ext = aadhaarFile.name.split('.').pop() || 'jpg'
          const path = generateUploadPath(`${insertedFarmer.id}/aadhaar`, 'doc', ext)
          const url = await uploadFile('farmer-documents', path, aadhaarFile)
          const { error: docError } = await supabase.from('farmer_documents').insert([
            {
              farmer_id: insertedFarmer.id,
              document_type: 'aadhaar',
              storage_path: url,
              file_name: sanitize(aadhaarFile.name),
            },
          ])
          if (docError) console.error('Aadhaar doc record insert failed:', docError.message)
        } catch (docErr) {
          console.error('Aadhaar upload failed:', docErr)
          toast.error('Warning: Aadhaar document upload failed.')
        }
      }

      if (kccFile) {
        try {
          const ext = kccFile.name.split('.').pop() || 'jpg'
          const path = generateUploadPath(`${insertedFarmer.id}/kcc`, 'doc', ext)
          const url = await uploadFile('farmer-documents', path, kccFile)
          const { error: docError } = await supabase.from('farmer_documents').insert([
            {
              farmer_id: insertedFarmer.id,
              document_type: 'kcc',
              storage_path: url,
              file_name: sanitize(kccFile.name),
            },
          ])
          if (docError) console.error('KCC doc record insert failed:', docError.message)
        } catch (docErr) {
          console.error('KCC upload failed:', docErr)
          toast.error('Warning: KCC document upload failed.')
        }
      }

      // 6. Set Farmer Security Transaction PIN
      try {
        const { data: pinHash, error: pinHashError } = await supabase.rpc('hash_pin', {
          p_pin: trimmedPin,
        })
        if (pinHashError) throw pinHashError
        if (!pinHash) throw new Error('PIN hash returned empty')

        const { error: secError } = await supabase.from('farmer_security').insert([
          {
            farmer_id: insertedFarmer.id,
            pin_hash: pinHash,
            failed_attempts: 0,
          },
        ])
        if (secError) throw secError
      } catch (pinErr) {
        console.error('Security PIN setup failed:', pinErr)
        toast.error('Warning: Transaction PIN setup failed. Farmer can reset later.')
      }

      // 7. Audit Log (best-effort, don't block on failure)
      try {
        await supabase.rpc('create_audit_log', {
          p_action: 'FARMER_CREATED',
          p_entity_type: 'farmer',
          p_entity_id: insertedFarmer.id,
          p_new_values: { farmer_id: newFarmerId, name: trimmedName },
        })
      } catch (auditErr) {
        console.error('Audit log failed:', auditErr)
      }

      toast.success('किसान का खाता व Udhaar Card सफलतापूर्वक बन गया!', { duration: 5000 })

      resetAddForm()
      setShowAddModal(false)
      fetchFarmers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error('त्रुटि: ' + message)
    } finally {
      setSaving(false)
    }
  }

  // ── Open Edit Farmer ID Modal ────────────────────────────────────────────────

  const openEditIdModal = useCallback(async (farmer: Farmer) => {
    setEditFarmerTarget(farmer)
    setNewFarmerIdInput(farmer.farmer_id)
    setEditFarmerReason('')
    setShowEditIdModal(true)
    setLoadingHistory(true)

    try {
      const { data: hist, error } = await supabase
        .from('farmer_id_history')
        .select('*')
        .eq('farmer_id', farmer.id)
        .order('changed_at', { ascending: false })

      if (error) throw error
      setIdHistory((hist as FarmerIdHistoryEntry[]) || [])
    } catch (err) {
      console.error('Failed to load ID history:', err)
      setIdHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // ── Handle Farmer ID Change ──────────────────────────────────────────────────

  const handleSaveEditedId = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editFarmerTarget) return

    const newId = newFarmerIdInput.trim().toUpperCase()

    if (!newId) {
      toast.error('New Farmer ID cannot be empty')
      return
    }

    if (newId === editFarmerTarget.farmer_id) {
      toast.error('Farmer ID पहले से ही यही है!')
      return
    }

    const trimmedReason = editReason.trim()
    if (!trimmedReason) {
      toast.error('कृपया बदलने का कारण लिखें')
      return
    }

    setSaving(true)

    try {
      // 1. Check uniqueness
      const { data: check, error: checkError } = await supabase
        .from('farmers')
        .select('id')
        .eq('farmer_id', newId)
        .maybeSingle()

      if (checkError) throw new Error(`Uniqueness check failed: ${checkError.message}`)

      if (check) {
        toast.error('यह Farmer ID पहले से मौजूद है! दूसरी चुनें।')
        setSaving(false)
        return
      }

      // 2. Save history
      const { error: histError } = await supabase.from('farmer_id_history').insert([
        {
          farmer_id: editFarmerTarget.id,
          old_farmer_id: editFarmerTarget.farmer_id,
          new_farmer_id: newId,
          reason: sanitize(trimmedReason) || 'Admin Update',
        },
      ])
      if (histError) throw new Error(`History save failed: ${histError.message}`)

      // 3. Update Farmer Record (UUID stays intact!)
      const { error: updateErr } = await supabase
        .from('farmers')
        .update({ farmer_id: newId, updated_at: new Date().toISOString() })
        .eq('id', editFarmerTarget.id)

      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`)

      // 4. Audit Log (best-effort)
      try {
        await supabase.rpc('create_audit_log', {
          p_action: 'FARMER_ID_CHANGED',
          p_entity_type: 'farmer',
          p_entity_id: editFarmerTarget.id,
          p_old_values: { farmer_id: editFarmerTarget.farmer_id },
          p_new_values: { farmer_id: newId },
          p_reason: trimmedReason,
        })
      } catch (auditErr) {
        console.error('Audit log failed:', auditErr)
      }

      toast.success('Farmer ID सफलतापूर्वक अपडेट हो गई!')
      setShowEditIdModal(false)
      setEditFarmerTarget(null)
      fetchFarmers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed'
      toast.error('Update Fail: ' + message)
    } finally {
      setSaving(false)
    }
  }

  // ── Filtered & Memoized List ─────────────────────────────────────────────────

  const filteredFarmers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return farmers

    return farmers.filter(
      (f) =>
        (f.farmer_name && f.farmer_name.toLowerCase().includes(term)) ||
        (f.farmer_id && f.farmer_id.toLowerCase().includes(term)) ||
        (f.mobile && f.mobile.includes(term)) ||
        (f.village && f.village.toLowerCase().includes(term))
    )
  }, [farmers, searchTerm])

  // ── Form field handler ───────────────────────────────────────────────────────

  const updateFormField = useCallback(
    (field: keyof FarmerFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Farmer Master (किसान मास्टर)</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage farmer identity, credit accounts, and documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetAddForm()
            setShowAddModal(true)
          }}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Plus size={20} aria-hidden="true" />
          <span>+ Add New Farmer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-3">
        <Search className="text-gray-400 shrink-0" size={20} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search by Name, Farmer ID, Mobile or Village..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-gray-700 placeholder-gray-400 font-medium"
          aria-label="Search farmers"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold px-2"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Farmers Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-emerald-50/80 text-emerald-900 border-b text-xs uppercase font-extrabold tracking-wider">
                <th className="p-4" scope="col">Farmer ID</th>
                <th className="p-4" scope="col">Farmer Info</th>
                <th className="p-4" scope="col">Contact & Village</th>
                <th className="p-4" scope="col">Aadhaar (Masked)</th>
                <th className="p-4" scope="col">Credit Limit</th>
                <th className="p-4" scope="col">Status</th>
                <th className="p-4 text-center" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Loading farmers...
                    </div>
                  </td>
                </tr>
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    {searchTerm
                      ? `No farmers found matching "${searchTerm}"`
                      : 'No farmers registered yet. Click "+ Add New Farmer" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredFarmers.map((f) => {
                  const maskedAadhaarDisplay = maskAadhaar(f.aadhaar_number)
                  const safePhotoUrl = isSafeImageUrl(f.photo_url) ? f.photo_url : null

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {sanitize(f.farmer_id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditIdModal(f)}
                            className="text-gray-400 hover:text-emerald-700 p-1 focus:outline-none focus:ring-2 focus:ring-emerald-300 rounded"
                            title="Edit Farmer ID"
                            aria-label={`Edit Farmer ID for ${f.farmer_name}`}
                          >
                            <Edit size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center overflow-hidden border border-emerald-200 shrink-0">
                            {safePhotoUrl ? (
                              <img
                                src={safePhotoUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              sanitize(f.farmer_name)?.[0] || '👨‍🌾'
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{sanitize(f.farmer_name)}</p>
                            {f.father_name && (
                              <p className="text-xs text-gray-500">S/O {sanitize(f.father_name)}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{sanitize(f.mobile) || '—'}</p>
                        <p className="text-xs text-gray-500">{sanitize(f.village) || '—'}</p>
                      </td>

                      <td className="p-4 font-mono text-xs font-semibold text-gray-600">
                        {maskedAadhaarDisplay}
                      </td>

                      <td className="p-4 font-black text-gray-900">
                        ₹{Number(f.credit_limit || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-4">
                        {f.account_status === 'active' ? (
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                            <UserCheck size={12} aria-hidden="true" /> Active
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                            <UserX size={12} aria-hidden="true" /> Inactive
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFarmer(f)
                              setShowCardModal(true)
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1 border border-emerald-200 transition focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            title="View / Print Udhaar Card"
                            aria-label={`View card for ${f.farmer_name}`}
                          >
                            <CreditCard size={14} aria-hidden="true" /> Card
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

        {/* Result count footer */}
        {!loading && farmers.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
            <span>
              Showing {filteredFarmers.length} of {farmers.length} farmers
            </span>
            {searchTerm && (
              <span>
                Search: &ldquo;{searchTerm}&rdquo;
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1. ADD FARMER MODAL                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add New Farmer"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowAddModal(false)
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span aria-hidden="true">🌾</span> नया किसान खाता बनाएं (Farmer Registration)
              </h2>
              <button
                type="button"
                onClick={() => { if (!saving) setShowAddModal(false) }}
                disabled={saving}
                aria-label="Close add farmer modal"
                className="text-emerald-200 hover:text-white text-2xl font-bold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 rounded"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddFarmer} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div>
                  <label htmlFor="add-farmer-name" className="block font-bold text-gray-700 mb-1">
                    किसान का नाम (Name) *
                  </label>
                  <input
                    id="add-farmer-name"
                    type="text"
                    required
                    value={formData.farmer_name}
                    onChange={(e) => updateFormField('farmer_name', e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Full Name"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="add-father-name" className="block font-bold text-gray-700 mb-1">
                    पिता का नाम (Father&apos;s Name) *
                  </label>
                  <input
                    id="add-father-name"
                    type="text"
                    required
                    value={formData.father_name}
                    onChange={(e) => updateFormField('father_name', e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Father Name"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="add-mobile" className="block font-bold text-gray-700 mb-1">
                    मोबाइल नंबर (10 Digits) *
                  </label>
                  <input
                    id="add-mobile"
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
                      updateFormField('mobile', digitsOnly)
                    }}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Mobile Number"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="add-aadhaar" className="block font-bold text-gray-700 mb-1">
                    आधार नंबर (Aadhaar Number)
                  </label>
                  <input
                    id="add-aadhaar"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={formData.aadhaar_number}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12)
                      updateFormField('aadhaar_number', digitsOnly)
                    }}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="12 Digit Aadhaar"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="add-village" className="block font-bold text-gray-700 mb-1">
                    गाँव (Village) *
                  </label>
                  <input
                    id="add-village"
                    type="text"
                    required
                    value={formData.village}
                    onChange={(e) => updateFormField('village', e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Village Name"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="add-credit-limit" className="block font-bold text-gray-700 mb-1">
                    क्रेडिट लिमिट (Credit Limit ₹) *
                  </label>
                  <input
                    id="add-credit-limit"
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={formData.credit_limit}
                    onChange={(e) => updateFormField('credit_limit', e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                    placeholder="e.g. 50000"
                  />
                </div>

                <div>
                  <label htmlFor="add-repayment-days" className="block font-bold text-gray-700 mb-1">
                    Repayment Days (30 - 210)
                  </label>
                  <input
                    id="add-repayment-days"
                    type="number"
                    required
                    min="30"
                    max="210"
                    step="1"
                    value={formData.repayment_days}
                    onChange={(e) => updateFormField('repayment_days', e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="add-pin" className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <KeyRound size={14} aria-hidden="true" /> Transaction PIN (6 Digits) *
                  </label>
                  <input
                    id="add-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    minLength={6}
                    required
                    value={formData.pin}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6)
                      updateFormField('pin', digitsOnly)
                    }}
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold tracking-widest"
                    placeholder="••••••"
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    किसान को यह PIN याद रखना होगा। बाद में रीसेट संभव है।
                  </p>
                </div>

                {/* Camera / Document Uploads Section */}
                <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                  <p className="font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                    <Camera size={16} className="text-emerald-700" aria-hidden="true" /> Upload
                    Documents (Camera / Gallery Support)
                  </p>
                  <p className="text-[10px] text-gray-400 mb-3">
                    Max {MAX_FILE_SIZE_MB}MB per file. Accepted: JPEG, PNG, WebP, HEIC.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="border border-dashed p-3 rounded-xl text-center bg-gray-50">
                      <p className="font-bold mb-1">Farmer Photo</p>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        capture="user"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px]"
                        aria-label="Upload farmer photo"
                      />
                    </div>
                    <div className="border border-dashed p-3 rounded-xl text-center bg-gray-50">
                      <p className="font-bold mb-1">Aadhaar Card</p>
                      <input
                        ref={aadhaarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        capture="environment"
                        onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px]"
                        aria-label="Upload Aadhaar card document"
                      />
                    </div>
                    <div className="border border-dashed p-3 rounded-xl text-center bg-gray-50">
                      <p className="font-bold mb-1">KCC Document</p>
                      <input
                        ref={kccInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        capture="environment"
                        onChange={(e) => setKccFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px]"
                        aria-label="Upload KCC document"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => { if (!saving) setShowAddModal(false) }}
                    disabled={saving}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Creating Farmer...
                      </>
                    ) : (
                      'Save Farmer (खाता खोलें)'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 2. CONTROLLED FARMER ID EDIT MODAL                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showEditIdModal && editFarmerTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Farmer ID"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowEditIdModal(false)
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-amber-500 text-slate-950 p-5 flex justify-between items-center font-bold">
              <h3 className="text-lg flex items-center gap-2">
                <Shield size={20} aria-hidden="true" /> Edit Farmer ID (Controlled Operation)
              </h3>
              <button
                type="button"
                onClick={() => { if (!saving) setShowEditIdModal(false) }}
                disabled={saving}
                aria-label="Close edit ID modal"
                className="text-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-300 rounded"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEditedId} className="p-6 space-y-4 text-sm">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Security Notice:</p>
                  <p>
                    Farmer ID बदलने पर Internal Database UUID नहीं बदलेगा। पुराना इतिहास रिकॉर्ड
                    रहेगा।
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Current Farmer ID</label>
                <p className="font-mono font-bold text-emerald-800 bg-gray-100 p-2.5 rounded-xl border">
                  {sanitize(editFarmerTarget.farmer_id)}
                </p>
              </div>

              <div>
                <label htmlFor="edit-new-farmer-id" className="block font-bold text-gray-700 mb-1">
                  New Farmer ID *
                </label>
                <input
                  id="edit-new-farmer-id"
                  type="text"
                  required
                  value={newFarmerIdInput}
                  onChange={(e) => setNewFarmerIdInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 border rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="SBB-XXX-XX"
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="edit-reason" className="block font-bold text-gray-700 mb-1">
                  Reason for Changing *
                </label>
                <input
                  id="edit-reason"
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditFarmerReason(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g. Sequence correction by Admin"
                  autoComplete="off"
                />
              </div>

              {/* ID Change History */}
              <div className="mt-2 border-t pt-3">
                <p className="font-bold text-xs text-gray-600 mb-2 flex items-center gap-1">
                  <History size={14} aria-hidden="true" /> ID Change History
                </p>
                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                    <Loader2 className="animate-spin" size={14} />
                    Loading history...
                  </div>
                ) : idHistory.length > 0 ? (
                  <div className="space-y-1 max-h-24 overflow-y-auto text-xs bg-gray-50 p-2 rounded-xl border">
                    {idHistory.map((h) => (
                      <p key={h.id || `${h.old_farmer_id}-${h.changed_at}`} className="text-gray-600">
                        <span className="line-through text-red-500">
                          {sanitize(h.old_farmer_id)}
                        </span>{' '}
                        →{' '}
                        <strong className="text-emerald-700">
                          {sanitize(h.new_farmer_id)}
                        </strong>{' '}
                        (
                        {h.changed_at
                          ? new Date(h.changed_at).toLocaleDateString('en-IN')
                          : '—'}
                        )
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-xl border">
                    No previous ID changes recorded.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { if (!saving) setShowEditIdModal(false) }}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Updating...
                    </>
                  ) : (
                    'Confirm & Update ID'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 3. KISAN CARD PRINT MODAL                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showCardModal && selectedFarmer && (
        <FarmerCardModal
          farmer={selectedFarmer}
          onClose={() => {
            setShowCardModal(false)
            setSelectedFarmer(null)
          }}
        />
      )}
    </div>
  )
}