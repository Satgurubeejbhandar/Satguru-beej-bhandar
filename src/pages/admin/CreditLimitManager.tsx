// src/pages/admin/CreditLimitManager.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Gauge,
  UserCheck,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Search,
  CheckCircle2,
  Info,
  X,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CreditAccountInfo {
  id?: string
  credit_limit: number
  current_outstanding: number
  available_credit: number
}

interface FarmerRecord {
  id: string
  farmer_id: string
  farmer_name: string
  village: string | null
  mobile: string | null
  credit_limit: number
  credit_accounts: CreditAccountInfo[] | CreditAccountInfo | null
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
}

export default function CreditLimitManager() {
  const { role, loading: authLoading } = useAuth()
  const [farmers, setFarmers] = useState<FarmerRecord[]>([])
  const [farmerId, setFarmerId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [newLimitInput, setNewLimitInput] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    name: string
    oldLimit: number
    newLimit: number
    available: number
  } | null>(null)

  const isMountedRef = useRef<boolean>(true)

  const loadFarmers = useCallback(async () => {
    if (role !== 'admin') return

    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('farmers')
        .select(`
          id,
          farmer_id,
          farmer_name,
          village,
          mobile,
          credit_limit,
          credit_accounts (
            id,
            credit_limit,
            current_outstanding,
            available_credit
          )
        `)
        .eq('account_status', 'active')
        .order('farmer_name', { ascending: true })

      if (fetchError) throw fetchError

      if (isMountedRef.current) {
        setFarmers((data as unknown as FarmerRecord[]) ?? [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'किसान सूची लोड करने में असमर्थ'
      if (isMountedRef.current) {
        setError(msg)
        toast.error('डेटा लोड करने में त्रुटि')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadFarmers()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [loadFarmers, role, authLoading])

  const selectedFarmer = useMemo(() => {
    if (!farmerId) return null
    return farmers.find((f) => f.id === farmerId) || null
  }, [farmers, farmerId])

  const accountData: CreditAccountInfo = useMemo(() => {
    if (!selectedFarmer) {
      return { credit_limit: 0, current_outstanding: 0, available_credit: 0 }
    }
    const acc = Array.isArray(selectedFarmer.credit_accounts)
      ? selectedFarmer.credit_accounts[0]
      : selectedFarmer.credit_accounts

    const limit = safeNum(acc?.credit_limit ?? selectedFarmer.credit_limit)
    const outstanding = safeNum(acc?.current_outstanding)
    const available = safeNum(acc?.available_credit ?? Math.max(0, limit - outstanding))

    return { credit_limit: limit, current_outstanding: outstanding, available_credit: available }
  }, [selectedFarmer])

  const handleFarmerChange = (id: string) => {
    setFarmerId(id)
    setSuccessInfo(null)
    const f = farmers.find((x) => x.id === id)
    if (f) {
      const acc = Array.isArray(f.credit_accounts) ? f.credit_accounts[0] : f.credit_accounts
      const currentLim = safeNum(acc?.credit_limit ?? f.credit_limit)
      setNewLimitInput(String(currentLim))
    } else {
      setNewLimitInput('')
    }
  }

  const filteredFarmers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return farmers
    return farmers.filter(
      (f) =>
        f.farmer_name.toLowerCase().includes(q) ||
        f.farmer_id.toLowerCase().includes(q) ||
        (f.village && f.village.toLowerCase().includes(q)) ||
        (f.mobile && f.mobile.includes(q))
    )
  }, [farmers, searchTerm])

  const parsedNewLimit = safeNum(newLimitInput)
  const projectedAvailable = Math.max(0, parsedNewLimit - accountData.current_outstanding)
  const isLimitBelowOutstanding = selectedFarmer !== null && parsedNewLimit < accountData.current_outstanding
  const isDirty = selectedFarmer !== null && parsedNewLimit !== accountData.credit_limit

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (role !== 'admin') {
      toast.error('Aapke paas settings badalne ki anumati nahi hai.')
      return
    }

    if (!farmerId || !selectedFarmer) {
      toast.error('कृपया एक किसान का चयन करें')
      return
    }

    if (parsedNewLimit < 0) {
      toast.error('क्रेडिट लिमिट अमान्य है')
      return
    }

    if (isLimitBelowOutstanding) {
      toast.error(
        `क्रेडिट लिमिट वर्तमान बकाया (${formatINR(accountData.current_outstanding)}) से कम नहीं हो सकती`
      )
      return
    }

    const trimmedReason = reason.trim()
    if (trimmedReason.length < 5) {
      toast.error('कृपया लिमिट बदलने का स्पष्ट कारण लिखें (कम से कम 5 अक्षर)')
      return
    }

    const oldLimitSnapshot = accountData.credit_limit
    const farmerNameSnapshot = selectedFarmer.farmer_name

    setSaving(true)
    setSuccessInfo(null)

    try {
      // 100% TRANSACTIONAL AND ATOMIC: Exclusively run the RPC update to prevent split-ledger desynchronisation
      const { data: rpcRes, error: rpcError } = await supabase.rpc(
        'update_farmer_credit_limit',
        {
          p_farmer_id: farmerId,
          p_new_limit: parsedNewLimit,
          p_reason: trimmedReason,
        }
      )

      if (rpcError) throw rpcError

      const response = rpcRes as {
        success: boolean
        message?: string
        new_limit?: number
        available_credit?: number
        outstanding?: number
      }

      if (!response || !response.success) {
        throw new Error(response?.message || 'Database rejected credit limit change.')
      }

      toast.success('क्रेडिट लिमिट सफलतापूर्वक अपडेट हो गई!')

      if (isMountedRef.current) {
        setReason('')
        setFarmers((prev) =>
          prev.map((f) => {
            if (f.id === farmerId) {
              return {
                ...f,
                credit_limit: parsedNewLimit,
                credit_accounts: [
                  {
                    credit_limit: parsedNewLimit,
                    current_outstanding: response.outstanding ?? accountData.current_outstanding,
                    available_credit: response.available_credit ?? projectedAvailable,
                  },
                ],
              }
            }
            return f
          })
        )
        setSuccessInfo({
          name: farmerNameSnapshot,
          oldLimit: oldLimitSnapshot,
          newLimit: parsedNewLimit,
          available: response.available_credit ?? projectedAvailable,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सर्वर एरर: लिमिट अपडेट नहीं हो सकी'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  const dropdownFarmers = useMemo(() => {
    return filteredFarmers
  }, [filteredFarmers])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Credit Limit Manager की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
            <Gauge className="text-amber-400 shrink-0" size={24} />
            Credit Limit Manager
          </h1>
          <p className="text-emerald-200 text-[11px] sm:text-xs mt-1 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            <span className="leading-tight">Admin Authorized · Atomic Locked · Fully Audit Logged</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-rose-800 font-bold">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </span>
          <button onClick={loadFarmers} className="underline hover:text-rose-950 self-end sm:self-auto cursor-pointer font-bold">
            Retry
          </button>
        </div>
      )}

      {successInfo && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="p-1.5 bg-emerald-600 rounded-full shrink-0">
                <CheckCircle2 size={16} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-emerald-900">
                  ✅ क्रेडिट लिमिट सफलतापूर्वक अपडेट हो गई!
                </p>
                <p className="text-xs text-emerald-800 font-semibold mt-0.5 truncate">
                  Farmer: <span className="font-bold">{successInfo.name}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  <div className="bg-white border border-emerald-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Old Limit</p>
                    <p className="text-xs font-black text-slate-700 mt-0.5">
                      {formatINR(successInfo.oldLimit)}
                    </p>
                  </div>
                  <div className="bg-white border border-emerald-300 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">New Limit</p>
                    <p className="text-xs font-black text-emerald-800 mt-0.5">
                      {formatINR(successInfo.newLimit)}
                    </p>
                  </div>
                  <div className="bg-white border border-emerald-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Available</p>
                    <p className="text-xs font-black text-emerald-700 mt-0.5">
                      {formatINR(successInfo.available)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="p-1 hover:bg-emerald-100 rounded-full transition-colors shrink-0 cursor-pointer"
              aria-label="Dismiss success message"
            >
              <X size={16} className="text-emerald-700" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-5 text-xs"
      >
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Active Farmer (किसान चुनें) *
          </label>

          <div className="relative mb-2">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name, ID, village, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search farmers catalogue"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X size={13} className="text-slate-500" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
              <Loader2 className="animate-spin mr-2" size={15} /> Loading Farmers Catalogue...
            </div>
          ) : (
            <>
              <select
                required
                value={dropdownFarmers.some((f) => f.id === farmerId) ? farmerId : ''}
                onChange={(e) => handleFarmerChange(e.target.value)}
                disabled={saving}
                aria-label="Select farmer"
                className="w-full p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 transition-all cursor-pointer"
              >
                <option value="">
                  -- Choose a farmer ({dropdownFarmers.length} {searchTerm ? 'match' : 'available'}) --
                </option>
                {dropdownFarmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmer_name} ({f.farmer_id}) {f.village ? `— ${f.village}` : ''}
                  </option>
                ))}
              </select>

              {searchTerm && dropdownFarmers.length === 0 && (
                <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                  No farmer matches "{searchTerm}". Clear search to see all farmers.
                </p>
              )}

              {searchTerm && selectedFarmer && !dropdownFarmers.some((f) => f.id === farmerId) && (
                <p className="text-[11px] text-blue-700 font-semibold bg-blue-50 border border-blue-200 rounded-lg p-2 mt-1">
                  Currently selected: <strong>{selectedFarmer.farmer_name}</strong> (hidden by filter)
                </p>
              )}
            </>
          )}
        </div>

        {selectedFarmer && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2 gap-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 min-w-0">
                <UserCheck size={14} className="text-emerald-700 shrink-0" />
                <span className="truncate">{selectedFarmer.farmer_name}</span>
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold self-start sm:self-auto">
                ID: {selectedFarmer.farmer_id}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-1 font-sans">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                <p className="text-[10px] uppercase font-bold text-slate-400">Current Limit</p>
                <p className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                  {formatINR(accountData.credit_limit)}
                </p>
              </div>

              <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl shadow-xs">
                <p className="text-[10px] uppercase font-bold text-rose-600">Outstanding (बकाया)</p>
                <p className="text-sm font-black text-rose-700 mt-0.5 font-mono">
                  {formatINR(accountData.current_outstanding)}
                </p>
              </div>

              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-xs">
                <p className="text-[10px] uppercase font-bold text-emerald-700">Available Credit</p>
                <p className="text-sm font-black text-emerald-800 mt-0.5 font-mono">
                  {formatINR(accountData.available_credit)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
            New Credit Limit (नई क्रेडिट सीमा ₹) *
          </label>
          <input
            type="number"
            min="0"
            step="500"
            inputMode="numeric"
            required
            disabled={!selectedFarmer || saving}
            value={newLimitInput}
            onChange={(e) => setNewLimitInput(e.target.value)}
            placeholder="Enter amount in ₹ (e.g. 50000)"
            className={`w-full p-3 border rounded-xl font-mono text-base font-black outline-none transition-all ${
              isLimitBelowOutstanding
                ? 'border-rose-300 focus:ring-2 focus:ring-rose-500 bg-rose-50/30'
                : 'border-slate-200 focus:ring-2 focus:ring-emerald-600 bg-white'
            } disabled:bg-slate-50 disabled:cursor-not-allowed`}
          />

          {selectedFarmer && !isLimitBelowOutstanding && isDirty && (
            <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>
                New Available Balance will be:{' '}
                <strong>{formatINR(projectedAvailable)}</strong>
              </span>
            </div>
          )}

          {isLimitBelowOutstanding && (
            <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <AlertCircle size={14} className="shrink-0" />
              <span>
                लिमिट बकाया राशि ({formatINR(accountData.current_outstanding)}) से
                कम नहीं हो सकती।
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
            Reason for Change (परिवर्तन का कारण - Audit Record) *
          </label>
          <input
            type="text"
            required
            maxLength={150}
            disabled={!selectedFarmer || saving}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-600 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            placeholder="e.g. Good repayment history / Crop season expansion"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            This entry will be permanently written to the compliance audit log.
          </span>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={
              !selectedFarmer ||
              !isDirty ||
              isLimitBelowOutstanding ||
              saving ||
              reason.trim().length < 5
            }
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Verifying &amp; Committing...
              </>
            ) : (
              'Authorize & Update Limit'
            )}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-start sm:items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
          <Info size={13} className="shrink-0 text-slate-500 mt-0.5 sm:mt-0" />
          <span>PostgreSQL Row-Lock prevents multi-counter race conditions during active sales.</span>
        </div>
      </form>
    </div>
  )
}