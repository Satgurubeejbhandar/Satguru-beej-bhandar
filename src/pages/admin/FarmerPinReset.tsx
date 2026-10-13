// src/pages/admin/FarmerPinReset.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { KeyRound, Shield, Loader2, ShieldCheck, CheckCircle2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

type FarmerOption = {
  id: string
  farmer_id: string
  farmer_name: string
  village: string | null
}

const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '1212', '1122', '123456', '654321', '000000', '111111',
])

function isValidPin(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin) && !WEAK_PINS.has(pin)
}

export default function FarmerPinReset() {
  const { role, loading: authLoading } = useAuth()
  const [farmers, setFarmers] = useState<FarmerOption[]>([])
  const [farmerId, setFarmerId] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [reason, setReason] = useState('')
  const [loadingFarmers, setLoadingFarmers] = useState(true)
  const [saving, setSaving] = useState(false)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // ─── Load Farmers Catalogue ──────────────────────────────────────────────

  const loadFarmers = useCallback(async () => {
    if (role !== 'admin') return

    setLoadingFarmers(true)
    try {
      const pageSize = 1000
      let page = 0
      const all: FarmerOption[] = []
      let hasMore = true

      while (hasMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1
        const { data, error } = await supabase
          .from('farmers')
          .select('id, farmer_id, farmer_name, village')
          .eq('account_status', 'active')
          .order('farmer_name')
          .range(from, to)

        if (error) throw error
        if (!isMountedRef.current) break

        const chunk = (data || []) as unknown as FarmerOption[]
        all.push(...chunk)
        hasMore = chunk.length === pageSize
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
        setLoadingFarmers(false)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadFarmers()
    }
  }, [loadFarmers, role, authLoading])

  // ─── Reset PIN Handler ───────────────────────────────────────────────────

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!farmerId) {
      toast.error('Farmer select karna zaroori hai')
      return
    }
    if (!isValidPin(newPin)) {
      toast.error('PIN 4–6 digits honi chahiye, weak PIN allowed nahi')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('PIN confirm match nahi karti')
      return
    }
    if (reason.trim().length < 3) {
      toast.error('Reason required')
      return
    }

    const farmer = farmers.find((f) => f.id === farmerId)
    const ok = window.confirm(
      `Reset transaction PIN for ${farmer?.farmer_name || 'farmer'} (${farmer?.farmer_id || ''})?\n\nThis will unlock the account and invalidate the old PIN.`
    )
    if (!ok) return

    setSaving(true)
    try {
      const { data: authData } = await supabase.auth.getUser()

      // Single atomic RPC call
      const { data, error } = await supabase.rpc('admin_reset_farmer_pin', {
        p_farmer_id: farmerId,
        p_pin: newPin,
        p_reason: reason.trim(),
        p_user_id: authData?.user?.id || null,
      })

      if (error) throw error

      const rawObj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
      const isSuccess = data === true || rawObj.success === true

      if (!isSuccess && rawObj.message) {
        throw new Error(String(rawObj.message))
      }

      toast.success('Transaction PIN reset successful! Account unlocked.')
      if (isMountedRef.current) {
        setNewPin('')
        setConfirmPin('')
        setReason('')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PIN reset failed'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Farmer PIN Reset की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="text-amber-400" size={28} /> Farmer PIN Reset
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Admin-only · PIN hashed server-side · Unlock + audit in one transaction
        </p>
      </div>

      <form
        onSubmit={handleReset}
        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-sm"
      >
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 font-bold flex gap-2">
          <Shield size={16} className="shrink-0 text-amber-600" />
          <span>PIN plaintext store nahi hota. Client par hash bhi nahi aata — sirf secure RPC se process hota hai.</span>
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1 text-xs">
            Farmer *
          </label>
          <select
            required
            value={farmerId}
            disabled={loadingFarmers || saving}
            onChange={(e) => setFarmerId(e.target.value)}
            aria-label="Select farmer for PIN reset"
            className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold disabled:opacity-50 text-xs focus:ring-2 focus:ring-emerald-600 outline-none cursor-pointer"
          >
            <option value="">
              {loadingFarmers ? 'Loading farmers catalogue...' : '-- Select Farmer --'}
            </option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.farmer_name} ({f.farmer_id}) {f.village ? `— ${f.village}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1 text-xs">
            New Transaction PIN *
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={6}
            pattern="[0-9]{4,6}"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-center tracking-widest font-black text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
            placeholder="4–6 digits"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1 text-xs">
            Confirm PIN *
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={6}
            pattern="[0-9]{4,6}"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-center tracking-widest font-black text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
            placeholder="Re-enter PIN"
            disabled={saving}
          />
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1 text-xs">
            Reason *
          </label>
          <input
            type="text"
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-600 outline-none"
            placeholder="e.g. Farmer forgot PIN / Admin unlock reset"
            disabled={saving}
          />
        </div>

        <button
          type="submit"
          disabled={saving || loadingFarmers || !farmerId || !newPin || !confirmPin}
          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition-all text-xs cursor-pointer active:scale-95"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Resetting PIN…
            </>
          ) : (
            <>
              <CheckCircle2 size={16} /> Reset Transaction PIN
            </>
          )}
        </button>
      </form>
    </div>
  )
}