// src/pages/admin/BankAccountsMaster.tsx
import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Landmark, Plus, Loader2, ShieldAlert, Edit3, Trash2, X,
  CheckCircle2, Star
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_number: string
  ifsc_code: string
  branch_name?: string | null
  account_type?: string | null
  upi_id?: string | null
  is_primary: boolean
  is_active: boolean
  notes?: string | null
}

const EMPTY: Omit<BankAccount, 'id'> = {
  bank_name: '',
  account_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  account_type: 'current',
  upi_id: '',
  is_primary: false,
  is_active: true,
  notes: '',
}

export default function BankAccountsMaster() {
  const { role, loading: authLoading } = useAuth()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [form, setForm] = useState<Omit<BankAccount, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('business_bank_accounts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('bank_name')
      if (error) throw error
      if (isMounted.current) setAccounts((data as BankAccount[]) || [])
    } catch (err) {
      toast.error('Bank accounts load failed: ' + (err as Error).message)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    if (role === 'admin') void load()
    return () => { isMounted.current = false }
  }, [role, load])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  const openEdit = (a: BankAccount) => {
    setEditing(a)
    setForm({
      bank_name: a.bank_name,
      account_name: a.account_name,
      account_number: a.account_number,
      ifsc_code: a.ifsc_code,
      branch_name: a.branch_name || '',
      account_type: a.account_type || 'current',
      upi_id: a.upi_id || '',
      is_primary: a.is_primary,
      is_active: a.is_active,
      notes: a.notes || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.bank_name.trim() || !form.account_name.trim() ||
        !form.account_number.trim() || !form.ifsc_code.trim()) {
      toast.error('Required fields missing')
      return
    }
    setSaving(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const payload = {
        ...form,
        bank_name: form.bank_name.trim(),
        account_name: form.account_name.trim(),
        account_number: form.account_number.trim(),
        ifsc_code: form.ifsc_code.trim().toUpperCase(),
        branch_name: form.branch_name?.trim() || null,
        upi_id: form.upi_id?.trim() || null,
        notes: form.notes?.trim() || null,
      }

      // If marking as primary, unset other primaries first
      if (form.is_primary) {
        await supabase
          .from('business_bank_accounts')
          .update({ is_primary: false })
          .neq('id', editing?.id || '00000000-0000-0000-0000-000000000000')
      }

      if (editing) {
        const { error } = await supabase
          .from('business_bank_accounts')
          .update(payload)
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Bank account updated')
      } else {
        const { error } = await supabase
          .from('business_bank_accounts')
          .insert([{ ...payload, created_by: authData?.user?.id }])
        if (error) throw error
        toast.success('Bank account added')
      }
      setShowModal(false)
      await load()
    } catch (err) {
      toast.error('Save failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (a: BankAccount) => {
    if (!window.confirm(`Delete "${a.bank_name} — ${a.account_number}"?`)) return
    try {
      const { error } = await supabase
        .from('business_bank_accounts')
        .update({ is_active: false })
        .eq('id', a.id)
      if (error) throw error
      toast.success('Bank account deactivated')
      await load()
    } catch (err) {
      toast.error('Delete failed: ' + (err as Error).message)
    }
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center">
        <ShieldAlert className="inline text-red-600 mb-2" size={32} />
        <h1 className="font-bold text-red-700">Access Denied</h1>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="text-amber-400" size={28} /> Business Bank Accounts
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Satguru Beej Bhandar — Own bank accounts (used for supplier payment receipts)
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
        >
          <Plus size={16} /> Add Bank Account
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <Loader2 className="animate-spin mx-auto text-emerald-700" size={28} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border text-center text-slate-500 font-medium text-sm">
          कोई bank account नहीं जोड़ा गया।
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((a) => (
            <div key={a.id} className={`bg-white p-5 rounded-2xl border shadow-sm ${a.is_primary ? 'border-amber-400' : 'border-slate-200'} ${!a.is_active ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-sm">{a.bank_name}</h3>
                    {a.is_primary && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black flex items-center gap-1">
                        <Star size={9} /> PRIMARY
                      </span>
                    )}
                    {!a.is_active && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-900 rounded text-[9px] font-black">INACTIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{a.account_name}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(a)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-700 font-medium border-t pt-2">
                <div className="flex justify-between"><span className="text-slate-500">A/C No:</span><span className="font-mono font-bold">{a.account_number}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">IFSC:</span><span className="font-mono font-bold">{a.ifsc_code}</span></div>
                {a.branch_name && <div className="flex justify-between"><span className="text-slate-500">Branch:</span><span>{a.branch_name}</span></div>}
                {a.upi_id && <div className="flex justify-between"><span className="text-slate-500">UPI:</span><span className="font-mono">{a.upi_id}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="font-black text-emerald-950 text-lg flex items-center gap-2">
                <Landmark size={20} /> {editing ? 'Edit' : 'Add'} Bank Account
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-3 text-sm">
              <div>
                <label className="block font-bold text-xs mb-1">Bank Name *</label>
                <input required value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="State Bank of India" />
              </div>
              <div>
                <label className="block font-bold text-xs mb-1">Account Name *</label>
                <input required value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Satguru Beej Bhandar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs mb-1">Account Number *</label>
                  <input required value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className="w-full p-2.5 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block font-bold text-xs mb-1">IFSC *</label>
                  <input required value={form.ifsc_code} onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} className="w-full p-2.5 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs mb-1">Branch</label>
                  <input value={form.branch_name || ''} onChange={e => setForm({ ...form, branch_name: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block font-bold text-xs mb-1">A/C Type</label>
                  <select value={form.account_type || 'current'} onChange={e => setForm({ ...form, account_type: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                    <option value="cc">Cash Credit</option>
                    <option value="od">Overdraft</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-xs mb-1">UPI ID (optional)</label>
                <input value={form.upi_id || ''} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="satguru@okhdfc" className="w-full p-2.5 border rounded-xl font-mono outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })} className="w-4 h-4" />
                  Primary Account
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                  Active
                </label>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}