// src/pages/admin/FarmersMaster.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Search,
  Plus,
  Edit,
  Camera,
  Shield,
  CreditCard,
  KeyRound,
  History,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Trash2,
  Power,
  Edit3
} from 'lucide-react'
import toast from 'react-hot-toast'
import FarmerCardModal from '../../components/admin/FarmerCardModal'

type CreditAccountLite = {
  current_outstanding?: number | string | null
}

type Farmer = {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  mobile: string | null
  village: string | null
  aadhaar_number: string | null
  credit_limit: number | string | null
  outstanding_balance?: number | string | null
  opening_balance?: number | string | null
  opening_balance_date?: string | null
  photo_url: string | null
  account_status: string
  tehsil?: string | null
  district?: string | null
  farm_area?: number | string | null
  crop_type?: string | null
  repayment_days?: number | string | null
  credit_accounts?: CreditAccountLite[] | CreditAccountLite | null
}

type IdHistoryRow = {
  id?: string
  old_farmer_id: string
  new_farmer_id: string
  reason?: string | null
  changed_at?: string
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function getOutstanding(farmer: Farmer): number {
  let caOutstanding: number | undefined
  const acc = farmer.credit_accounts

  if (Array.isArray(acc) && acc.length > 0) {
    caOutstanding = safeNum(acc[0]?.current_outstanding)
  } else if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
    caOutstanding = safeNum(acc.current_outstanding)
  }

  if (caOutstanding !== undefined && !isNaN(caOutstanding)) {
    return caOutstanding
  }

  const directBalance = safeNum(farmer.outstanding_balance)
  if (!isNaN(directBalance)) {
    return directBalance
  }

  return 0
}

export default function FarmersMaster() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)

  const [showEditIdModal, setShowEditIdModal] = useState(false)
  const [editFarmerTarget, setEditFarmerTarget] = useState<Farmer | null>(null)
  const [newFarmerIdInput, setNewFarmerIdInput] = useState('')
  const [editReason, setEditFarmerReason] = useState('')
  const [idHistory, setIdHistory] = useState<IdHistoryRow[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null)

  const [formData, setFormData] = useState({
    farmer_name: '',
    father_name: '',
    mobile: '',
    aadhaar_number: '',
    kcc_number: '',
    village: '',
    tehsil: 'Sardarshahar',
    district: 'Churu',
    farm_area: '',
    crop_type: '',
    credit_limit: '25000',
    opening_balance: '0',
    opening_balance_date: new Date().toISOString().split('T')[0],
    repayment_days: '90',
    pin: '',
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [kccFile, setKccFile] = useState<File | null>(null)

  const isMountedRef = useRef<boolean>(true)
  const saveLockRef = useRef<boolean>(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchFarmers = useCallback(async () => {
    try {
      setLoading(true)
      const all: Farmer[] = []
      let page = 0
      const size = 1000
      let more = true

      while (more && isMountedRef.current) {
        const from = page * size
        const to = from + size - 1
        const { data, error } = await supabase
          .from('farmers')
          .select('*, credit_accounts(current_outstanding)')
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) throw error
        if (!isMountedRef.current) break

        const chunk = (data || []) as unknown as Farmer[]
        all.push(...chunk)
        more = chunk.length === size
        page++
      }

      if (isMountedRef.current) {
        setFarmers(all)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load farmers'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchFarmers()
  }, [fetchFarmers])

  const handleSyncBalances = async () => {
    setSyncing(true)
    toast.loading('Synchronizing all accounts...', { id: 'sync-all' })
    try {
      const { data: farmerList } = await supabase.from('farmers').select('id')
      if (farmerList) {
        for (const f of farmerList) {
          await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: f.id })
        }
      }
      toast.success('All Balances synced successfully!', { id: 'sync-all' })
      await fetchFarmers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      if (isMountedRef.current) {
        toast.error('Sync failed: ' + msg, { id: 'sync-all' })
      }
    } finally {
      if (isMountedRef.current) {
        setSyncing(false)
      }
    }
  }

  const resetAddForm = () => {
    setFormData({
      farmer_name: '',
      father_name: '',
      mobile: '',
      aadhaar_number: '',
      kcc_number: '',
      village: '',
      tehsil: 'Sardarshahar',
      district: 'Churu',
      farm_area: '',
      crop_type: '',
      credit_limit: '25000',
      opening_balance: '0',
      opening_balance_date: new Date().toISOString().split('T')[0],
      repayment_days: '90',
      pin: '',
    })
    setEditingFarmer(null)
    setPhotoFile(null)
    setAadhaarFile(null)
    setKccFile(null)
  }

  const openEditModal = (f: Farmer) => {
    setFormData({
      farmer_name: f.farmer_name || '',
      father_name: f.father_name || '',
      mobile: f.mobile || '',
      aadhaar_number: f.aadhaar_number || '',
      kcc_number: '',
      village: f.village || '',
      tehsil: f.tehsil || 'Sardarshahar',
      district: f.district || 'Churu',
      farm_area: f.farm_area ? String(f.farm_area) : '',
      crop_type: f.crop_type || '',
      credit_limit: f.credit_limit ? String(f.credit_limit) : '25000',
      opening_balance: f.opening_balance ? String(f.opening_balance) : '0',
      opening_balance_date: f.opening_balance_date || new Date().toISOString().split('T')[0],
      repayment_days: f.repayment_days ? String(f.repayment_days) : '90',
      pin: '',
    })
    setEditingFarmer(f)
    setShowAddModal(true)
  }

  const handleAddOrEditFarmer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.mobile.length !== 10) {
      toast.error('मोबाइल नंबर 10 अंकों का होना आवश्यक है')
      return
    }

    if (formData.aadhaar_number && formData.aadhaar_number.length !== 12) {
      toast.error('आधार नंबर 12 अंकों का होना चाहिए')
      return
    }

    if (!editingFarmer) {
      const pin = formData.pin.trim()
      if (!/^[0-9]{4,6}$/.test(pin)) {
        toast.error('PIN 4 से 6 अंकों की संख्या होनी चाहिए')
        return
      }
      const weak = new Set([
        '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
        '1234', '1212', '1122', '123456', '654321', '000000', '111111',
      ])
      if (weak.has(pin)) {
        toast.error('कमजोर PIN (Weak PIN) की अनुमति नहीं है')
        return
      }
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const limitVal = safeNum(formData.credit_limit || 25000)
      const openingVal = safeNum(formData.opening_balance || 0)
      const openingDate = formData.opening_balance_date || new Date().toISOString().split('T')[0]

      if (editingFarmer) {
        // Safe Atomic Update with verified re-sync
        const { error: updateErr } = await supabase
          .from('farmers')
          .update({
            farmer_name: formData.farmer_name.trim(),
            father_name: formData.father_name.trim(),
            mobile: formData.mobile.trim(),
            aadhaar_number: formData.aadhaar_number.trim() || null,
            village: formData.village.trim(),
            tehsil: formData.tehsil.trim(),
            district: formData.district.trim(),
            farm_area: formData.farm_area ? safeNum(formData.farm_area) : null,
            crop_type: formData.crop_type.trim() || null,
            credit_limit: limitVal,
            opening_balance: openingVal,
            opening_balance_date: openingDate,
            repayment_days: safeNum(formData.repayment_days || 90),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingFarmer.id)

        if (updateErr) throw new Error('Update failed: ' + updateErr.message)

        await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: editingFarmer.id })
        toast.success('किसान विवरण एवं प्रारंभिक शेष (Opening Balance) अपडेट हो गया!')

      } else {
        const pin = formData.pin.trim()

        const { data: newFarmerId, error: fnError } = await supabase.rpc('generate_farmer_id')
        if (fnError || !newFarmerId) throw new Error('ID generation failed')

        let uploadedPhotoUrl = ''
        if (photoFile) {
          const ext = photoFile.name.split('.').pop() || 'jpg'
          const path = `photos/${newFarmerId}-${Date.now()}.${ext}`
          const { error: pErr } = await supabase.storage
            .from('farmer-photos')
            .upload(path, photoFile, { upsert: true })
          if (!pErr) {
            const { data: pUrl } = supabase.storage.from('farmer-photos').getPublicUrl(path)
            uploadedPhotoUrl = pUrl.publicUrl
          }
        }

        // Transaction Guarded Registration Sequence
        const { data: insertedFarmer, error: insertError } = await supabase
          .from('farmers')
          .insert([
            {
              farmer_id: newFarmerId,
              farmer_name: formData.farmer_name.trim(),
              father_name: formData.father_name.trim(),
              mobile: formData.mobile.trim(),
              aadhaar_number: formData.aadhaar_number.trim() || null,
              village: formData.village.trim(),
              tehsil: formData.tehsil.trim(),
              district: formData.district.trim(),
              farm_area: formData.farm_area ? safeNum(formData.farm_area) : null,
              crop_type: formData.crop_type.trim() || null,
              photo_url: uploadedPhotoUrl || null,
              credit_limit: limitVal,
              opening_balance: openingVal,
              opening_balance_date: openingDate,
              repayment_days: safeNum(formData.repayment_days || 90),
              account_status: 'active',
              created_by: authData?.user?.id || null,
            },
          ])
          .select()
          .single()

        if (insertError || !insertedFarmer) {
          throw new Error('Registration failed: ' + (insertError?.message || 'No record inserted'))
        }

        // PIN Assignment (Guarded)
        const { error: pinErr } = await supabase.rpc('admin_reset_farmer_pin', {
          p_farmer_id: insertedFarmer.id,
          p_pin: pin,
          p_reason: 'Initial PIN set during registration',
          p_user_id: authData?.user?.id || null,
        })

        if (pinErr) {
          // Attempt rollback if PIN creation fails to prevent broken accounts
          await supabase.from('farmers').delete().eq('id', insertedFarmer.id)
          throw new Error('PIN set failed: ' + pinErr.message)
        }

        // Credit Account Sync (Guarded)
        await supabase.rpc('sync_farmer_credit_account', { p_farmer_id: insertedFarmer.id })

        if (aadhaarFile) {
          const path = `${insertedFarmer.id}/aadhaar-${Date.now()}`
          const { error: upErr } = await supabase.storage
            .from('farmer-documents')
            .upload(path, aadhaarFile, { upsert: true })
          if (!upErr) {
            await supabase.from('farmer_documents').insert([
              {
                farmer_id: insertedFarmer.id,
                document_type: 'aadhaar',
                storage_path: path,
                file_name: aadhaarFile.name,
              },
            ])
          }
        }

        if (kccFile) {
          const path = `${insertedFarmer.id}/kcc-${Date.now()}`
          const { error: upErr } = await supabase.storage
            .from('farmer-documents')
            .upload(path, kccFile, { upsert: true })
          if (!upErr) {
            await supabase.from('farmer_documents').insert([
              {
                farmer_id: insertedFarmer.id,
                document_type: 'kcc',
                storage_path: path,
                file_name: kccFile.name,
              },
            ])
          }
        }

        toast.success('नया किसान खाता सफलतापूर्वक बन गया!')
      }

      if (isMountedRef.current) {
        setShowAddModal(false)
        resetAddForm()
      }
      await fetchFarmers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      if (isMountedRef.current) toast.error('त्रुटि: ' + msg)
    } finally {
      saveLockRef.current = false
      if (isMountedRef.current) setSaving(false)
    }
  }

  const handleToggleStatus = async (farmer: Farmer) => {
    const isDeactivating = farmer.account_status === 'active'
    
    if (isDeactivating) {
      const outstanding = getOutstanding(farmer)
      if (outstanding > 0) {
        toast.error(`❌ खाते में ₹${formatINR(outstanding)} का बकाया है।\nपहले हिसाब चुकता करें, फिर खाता बंद करें।`, { duration: 6000 })
        return
      }
    }

    const action = isDeactivating ? 'निष्क्रिय (Inactive)' : 'सक्रिय (Active)'
    const ok = window.confirm(`क्या आप वाकई "${farmer.farmer_name}" का खाता ${action} करना चाहते हैं?`)
    if (!ok) return

    try {
      const { error } = await supabase
        .from('farmers')
        .update({ 
          account_status: isDeactivating ? 'inactive' : 'active', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', farmer.id)

      if (error) throw error
      toast.success(`किसान खाता ${action} कर दिया गया!`)
      await fetchFarmers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed'
      if (isMountedRef.current) toast.error(msg)
    }
  }

  const handleHardDelete = async (farmer: Farmer) => {
    const outstanding = getOutstanding(farmer)
    let warning = `🚨 खतरनाक चेतावनी (PERMANENT HARD DELETE) 🚨\n\n`
    warning += `"${farmer.farmer_name}" का पूरा डेटा (बिल, लेजर, पेमेंट) हमेशा के लिए मिट जाएगा।\n`
    
    if (outstanding > 0) {
      warning += `\n⚠️ ध्यान दें: इस किसान का ₹${formatINR(outstanding)} बकाया है! डिलीट करने से यह पैसा सिस्टम से गायब हो जाएगा।\n`
    }
    
    warning += `\nकन्फर्म करने के लिए 'DELETE' टाइप करें:`

    const confirmText = window.prompt(warning)
    if (confirmText !== 'DELETE') return

    try {
      setDeletingId(farmer.id)
      const { error } = await supabase.from('farmers').delete().eq('id', farmer.id)
      
      if (error) {
        if (error.code === '23503') {
          throw new Error('इस किसान के सक्रिय बिल या वित्तीय रिकॉर्ड्स मौजूद हैं। कृपया पहले बिलों को निरस्त (Void) करें या डेटा-रीसेट टूल का उपयोग करें।')
        }
        throw error
      }
      
      toast.success(`"${farmer.farmer_name}" का खाता जड़ से मिटा दिया गया!`)
      if (isMountedRef.current) {
        setFarmers(prev => prev.filter(f => f.id !== farmer.id))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      if (isMountedRef.current) toast.error(msg, { duration: 6000 })
    } finally {
      if (isMountedRef.current) setDeletingId(null)
    }
  }

  const openEditIdModal = async (farmer: Farmer) => {
    setEditFarmerTarget(farmer)
    setNewFarmerIdInput(farmer.farmer_id)
    setEditFarmerReason('')

    try {
      const { data: hist, error } = await supabase
        .from('farmer_id_history')
        .select('*')
        .eq('farmer_id', farmer.id)
        .order('changed_at', { ascending: false })

      if (error) throw error
      if (isMountedRef.current) setIdHistory((hist || []) as IdHistoryRow[])
    } catch {
      if (isMountedRef.current) setIdHistory([])
    }

    if (isMountedRef.current) setShowEditIdModal(true)
  }

  const handleSaveEditedId = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editFarmerTarget) return

    const newId = newFarmerIdInput.trim().toUpperCase()
    if (!newId || newId === editFarmerTarget.farmer_id || !editReason.trim()) {
      toast.error('New ID and Reason are required')
      return
    }

    try {
      setSaving(true)
      const { error: histErr } = await supabase.from('farmer_id_history').insert([{
        farmer_id: editFarmerTarget.id,
        old_farmer_id: editFarmerTarget.farmer_id,
        new_farmer_id: newId,
        reason: editReason.trim(),
      }])
      if (histErr) throw histErr

      const { error: updateErr } = await supabase
        .from('farmers')
        .update({ farmer_id: newId, updated_at: new Date().toISOString() })
        .eq('id', editFarmerTarget.id)

      if (updateErr) throw updateErr

      toast.success('Farmer ID सफलतापूर्वक अपडेट हो गई!')
      if (isMountedRef.current) setShowEditIdModal(false)
      await fetchFarmers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      if (isMountedRef.current) toast.error('Update Fail: ' + msg)
    } finally {
      if (isMountedRef.current) setSaving(false)
    }
  }

  const filteredFarmers = farmers.filter((f) => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    return (
      f.farmer_name?.toLowerCase().includes(q) ||
      f.farmer_id?.toLowerCase().includes(q) ||
      (f.mobile || '').includes(q) ||
      (f.village || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">
            Farmer Master (किसान मास्टर)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage farmer identity, credit accounts, security PINs, and documents.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSyncBalances}
            disabled={syncing}
            className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50 text-xs shadow-xs cursor-pointer"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync Balances</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetAddForm()
              setShowAddModal(true)
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg text-xs cursor-pointer"
          >
            <Plus size={18} />
            <span>Add New Farmer</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3">
        <Search className="text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by Name, Farmer ID, Mobile or Village..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-xs font-semibold text-gray-800 placeholder-gray-400 bg-transparent"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-emerald-50/80 text-emerald-900 border-b text-xs uppercase font-extrabold tracking-wider">
                <th className="p-4 whitespace-nowrap">Farmer ID</th>
                <th className="p-4">Farmer Info</th>
                <th className="p-4">Contact &amp; Village</th>
                <th className="p-4 text-right">Credit Limit</th>
                <th className="p-4 text-right">Opening Bal</th>
                <th className="p-4 text-right">Outstanding</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 font-bold">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading farmers...
                  </td>
                </tr>
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 font-medium">
                    No farmers found.
                  </td>
                </tr>
              ) : (
                filteredFarmers.map((f) => {
                  const outstanding = getOutstanding(f)
                  const opening = safeNum(f.opening_balance)
                  const isInactive = f.account_status !== 'active'
                  const isDeleting = deletingId === f.id

                  return (
                    <tr key={f.id} className={`hover:bg-slate-50/80 transition ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {f.farmer_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditIdModal(f)}
                            className="text-gray-400 hover:text-emerald-700 p-1 cursor-pointer"
                            title="Edit Farmer ID"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center overflow-hidden border border-emerald-200 shrink-0">
                            {f.photo_url ? (
                              <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              f.farmer_name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div>
                            <p className={`font-bold text-gray-900 text-sm ${isInactive ? 'line-through opacity-60' : ''}`}>
                              {f.farmer_name}
                            </p>
                            <p className="text-[11px] text-gray-500">S/O {f.father_name || '—'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-gray-800 font-mono">{f.mobile || '—'}</p>
                        <p className="text-xs text-gray-500">{f.village || '—'}</p>
                      </td>

                      <td className="p-4 font-bold text-gray-900 text-right font-mono">
                        ₹{formatINR(f.credit_limit)}
                      </td>

                      <td className="p-4 font-bold text-amber-900 text-right font-mono">
                        ₹{formatINR(opening)}
                      </td>

                      <td className="p-4 font-black text-rose-700 text-right font-mono">
                        ₹{formatINR(outstanding)}
                      </td>

                      <td className="p-4 text-center">
                        {isInactive ? (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full inline-block">
                            Inactive
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full inline-block">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setSelectedFarmer(f); setShowCardModal(true) }}
                            className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] flex items-center gap-1 border border-emerald-200 shadow-xs cursor-pointer"
                            title="Print Card"
                          >
                            <CreditCard size={14} /> Card
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => openEditModal(f)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Details / Opening Balance"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(f)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isInactive ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50'}`}
                            title={isInactive ? "Reactivate" : "Deactivate"}
                          >
                            <Power size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleHardDelete(f)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 bg-rose-50 rounded-lg transition-colors border border-rose-100 cursor-pointer"
                            title="Hard Delete"
                          >
                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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

      {/* ADD / EDIT FARMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editingFarmer ? 'किसान विवरण एवं प्रारंभिक शेष अपडेट करें' : 'नया किसान खाता बनाएं (New Farmer)'}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-emerald-200 hover:text-white text-2xl font-bold leading-none p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddOrEditFarmer} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">किसान का नाम *</label>
                  <input type="text" required value={formData.farmer_name} onChange={e => setFormData({ ...formData, farmer_name: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">पिता का नाम *</label>
                  <input type="text" required value={formData.father_name} onChange={e => setFormData({ ...formData, father_name: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">मोबाइल (10 digits) *</label>
                  <input type="tel" required pattern="[0-9]{10}" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">आधार नंबर (12 digits)</label>
                  <input type="text" maxLength={12} value={formData.aadhaar_number} onChange={e => setFormData({ ...formData, aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} className="w-full px-4 py-2.5 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">गाँव *</label>
                  <input type="text" required value={formData.village} onChange={e => setFormData({ ...formData, village: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">क्रेडिट लिमिट ₹ *</label>
                  <input type="number" required min={0} value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-900" />
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">
                    प्रारंभिक शेष (Opening Balance ₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={e => setFormData({ ...formData, opening_balance: e.target.value })}
                    className="w-full px-4 py-2.5 border border-amber-300 bg-amber-50/80 rounded-xl font-mono font-bold text-amber-950 outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 5000 (पुराना बकाया)"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    प्रारंभिक शेष तिथि (Opening Date)
                  </label>
                  <input
                    type="date"
                    value={formData.opening_balance_date}
                    onChange={e => setFormData({ ...formData, opening_balance_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-mono text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {!editingFarmer && (
                  <>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <KeyRound size={14} className="text-emerald-700" /> Transaction PIN (4–6 digits) *
                      </label>
                      <input type="password" inputMode="numeric" required minLength={4} maxLength={6} value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="w-full px-4 py-2.5 border rounded-xl text-center font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••" />
                    </div>

                    <div className="col-span-1 md:col-span-2 border-t pt-3 mt-1">
                      <p className="font-bold text-gray-800 mb-2 flex items-center gap-1.5 text-xs">
                        <Camera size={16} className="text-emerald-700" /> फोटो व दस्तावेज़ अपलोड
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="border border-dashed p-2.5 rounded-xl text-center bg-gray-50">
                          <p className="font-bold mb-1 text-[11px]">1. किसान फोटो</p>
                          <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="w-full text-[10px]" />
                        </div>
                        <div className="border border-dashed p-2.5 rounded-xl text-center bg-gray-50">
                          <p className="font-bold mb-1 text-[11px]">2. आधार फोटो</p>
                          <input type="file" accept="image/*" onChange={e => setAadhaarFile(e.target.files?.[0] || null)} className="w-full text-[10px]" />
                        </div>
                        <div className="border border-dashed p-2.5 rounded-xl text-center bg-gray-50">
                          <p className="font-bold mb-1 text-[11px]">3. KCC फोटो</p>
                          <input type="file" accept="image/*" onChange={e => setKccFile(e.target.files?.[0] || null)} className="w-full text-[10px]" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="col-span-1 md:col-span-2 mt-2 flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {editingFarmer ? 'Update Details & Opening Balance' : 'Save Farmer (खाता खोलें)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FARMER ID MODAL */}
      {showEditIdModal && editFarmerTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-amber-500 text-slate-950 p-5 flex justify-between items-center font-bold">
              <h3 className="text-base flex items-center gap-2">
                <Shield size={18} /> Edit Farmer ID
              </h3>
              <button type="button" onClick={() => setShowEditIdModal(false)} className="text-xl leading-none p-1 cursor-pointer">×</button>
            </div>

            <form onSubmit={handleSaveEditedId} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Current Farmer ID</label>
                <p className="font-mono font-bold text-emerald-800 bg-gray-100 p-2.5 rounded-xl border border-gray-200">
                  {editFarmerTarget.farmer_id}
                </p>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">New Farmer ID *</label>
                <input type="text" required value={newFarmerIdInput} onChange={e => setNewFarmerIdInput(e.target.value.toUpperCase())} className="w-full px-4 py-2.5 border rounded-xl font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason *</label>
                <input type="text" required value={editReason} onChange={e => setEditFarmerReason(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500" />
              </div>

              {idHistory.length > 0 && (
                <div className="mt-2 border-t pt-3">
                  <p className="font-bold text-xs text-gray-600 mb-2 flex items-center gap-1">
                    <History size={14} /> ID Change History
                  </p>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-xs bg-gray-50 p-2 rounded-xl border border-gray-200 font-mono">
                    {idHistory.map((h, i) => (
                      <p key={h.id || i} className="text-gray-600">
                        <span className="line-through text-red-500">{h.old_farmer_id}</span> {' → '}
                        <strong className="text-emerald-700">{h.new_farmer_id}</strong>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowEditIdModal(false)} disabled={saving} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-sm cursor-pointer">
                  {saving ? 'Updating...' : 'Confirm & Update ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARD MODAL */}
      {showCardModal && selectedFarmer && (
        <FarmerCardModal farmer={selectedFarmer as any} onClose={() => setShowCardModal(false)} />
      )}
    </div>
  )
}