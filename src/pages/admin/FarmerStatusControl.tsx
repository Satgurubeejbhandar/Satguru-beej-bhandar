// src/pages/admin/FarmerStatusControl.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { UserX, UserCheck, Search, Loader2, ShieldAlert, X, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

type CreditAccountRelation = {
  current_outstanding: number | string | null
}

type Farmer = {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  village: string | null
  mobile: string | null
  account_status: string
  outstanding_balance?: number | string | null
  credit_accounts?: CreditAccountRelation[] | CreditAccountRelation | null
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

// HARDENED: Check credit_accounts first, fallback to farmers.outstanding_balance
function getOutstanding(f: Farmer): number {
  let caOutstanding: number | undefined
  const acc = f.credit_accounts

  if (Array.isArray(acc) && acc.length > 0) {
    caOutstanding = safeNum(acc[0]?.current_outstanding)
  } else if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
    caOutstanding = safeNum(acc.current_outstanding)
  }

  if (caOutstanding !== undefined && !isNaN(caOutstanding) && caOutstanding !== 0) {
    return caOutstanding
  }

  const directBalance = safeNum(f.outstanding_balance)
  if (!isNaN(directBalance)) {
    return directBalance
  }

  return 0
}

export default function FarmerStatusControl() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [targetFarmer, setTargetFarmer] = useState<Farmer | null>(null)
  const [reasonModalInput, setReasonModalInput] = useState('')

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadFarmers = useCallback(async () => {
    try {
      setLoading(true)
      const all: Farmer[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await supabase
          .from('farmers')
          .select('id, farmer_id, farmer_name, father_name, village, mobile, account_status, outstanding_balance, credit_accounts(current_outstanding)')
          .order('farmer_name', { ascending: true })
          .range(from, to)

        if (error) throw error
        if (!isMountedRef.current) break

        if (data && data.length > 0) {
          all.push(...(data as unknown as Farmer[]))
        }

        hasMore = (data?.length ?? 0) === pageSize
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
    loadFarmers()
  }, [loadFarmers])

  const openActionModal = (f: Farmer) => {
    setTargetFarmer(f)
    setReasonModalInput('')
  }

  const handleConfirmToggle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetFarmer) return

    const trimmedReason = reasonModalInput.trim()
    if (trimmedReason.length < 3) {
      toast.error('Reason is required (min 3 characters)')
      return
    }

    const isDeactivating = targetFarmer.account_status === 'active'
    const outstanding = getOutstanding(targetFarmer)

    if (isDeactivating && outstanding > 0) {
      const ok = window.confirm(
        `Warning: ${targetFarmer.farmer_name} has outstanding dues of ₹${formatINR(outstanding)}.\nAre you sure you want to deactivate this account?`
      )
      if (!ok) return
    }

    setBusyId(targetFarmer.id)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      const { data, error: rpcErr } = await supabase.rpc('toggle_farmer_status', {
        p_farmer_id: targetFarmer.id,
        p_reason: trimmedReason,
        p_user_id: user?.id || null,
      })

      if (!rpcErr) {
        const rawObj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
        const newStatus = String(rawObj.new_status || (isDeactivating ? 'inactive' : 'active'))
        toast.success(`Farmer account marked as ${newStatus}`)
        if (isMountedRef.current) {
          setTargetFarmer(null)
        }
        await loadFarmers()
        return
      }

      console.warn('Atomic RPC unavailable or failed, executing client fallback:', rpcErr.message)

      const nextStatus = isDeactivating ? 'inactive' : 'active'
      const { error: upErr } = await supabase
        .from('farmers')
        .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', targetFarmer.id)

      if (upErr) throw upErr

      try {
        await supabase.from('audit_logs').insert([
          {
            action: isDeactivating ? 'FARMER_DEACTIVATED' : 'FARMER_ACTIVATED',
            entity_type: 'farmer',
            entity_id: targetFarmer.id,
            user_role: 'admin',
            reason: trimmedReason,
            performed_by: user?.id,
          },
        ])
      } catch {
        // Non-blocking
      }

      toast.success(`Farmer account marked as ${nextStatus}`)
      if (isMountedRef.current) {
        setTargetFarmer(null)
      }
      await loadFarmers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setBusyId(null)
      }
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return farmers

    return farmers.filter((f) => {
      const name = (f.farmer_name || '').toLowerCase()
      const code = (f.farmer_id || '').toLowerCase()
      const village = (f.village || '').toLowerCase()
      const mobile = f.mobile || ''
      return name.includes(q) || code.includes(q) || village.includes(q) || mobile.includes(q)
    })
  }, [farmers, search])

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Farmer Status Control (खाता स्थिति नियंत्रण)
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Controlled status toggle · Requires mandatory audit reason · No hard deletes
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="text-slate-400 shrink-0" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Farmer Name, ID, Village or Mobile..."
          aria-label="Search farmers for status control"
          className="flex-1 outline-none text-xs font-semibold text-slate-800 placeholder-slate-400 bg-transparent"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[640px]" aria-label="Farmer status control table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                <th scope="col" className="p-3.5">Farmer Info</th>
                <th scope="col" className="p-3.5">Village</th>
                <th scope="col" className="p-3.5 text-right">Outstanding (₹)</th>
                <th scope="col" className="p-3.5 text-center">Status</th>
                <th scope="col" className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading farmers master list...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 font-bold">
                    No farmers found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((f) => {
                  const outstanding = getOutstanding(f)
                  const isActive = f.account_status === 'active'
                  const isBusy = busyId === f.id

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{f.farmer_name}</p>
                        <p className="text-[10px] font-mono text-slate-500">
                          {f.farmer_id} {f.mobile ? `· ${f.mobile}` : ''}
                        </p>
                      </td>
                      <td className="p-3.5 text-slate-700">{f.village || '—'}</td>
                      <td className="p-3.5 text-right font-black text-rose-700 font-mono">
                        ₹{formatINR(outstanding)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {f.account_status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openActionModal(f)}
                          aria-label={`${isActive ? 'Deactivate' : 'Activate'} farmer ${f.farmer_name}`}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 mx-auto transition-all active:scale-95 disabled:opacity-50 shadow-xs ${
                            isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          {isActive ? 'Deactivate' : 'Activate'}
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

      {targetFarmer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-400" />
                {targetFarmer.account_status === 'active' ? 'Deactivate Account' : 'Activate Account'}
              </h3>
              <button
                type="button"
                onClick={() => setTargetFarmer(null)}
                aria-label="Close modal"
                className="text-emerald-200 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmToggle} className="p-6 space-y-4 text-xs font-semibold">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-slate-800">
                <p className="font-bold text-sm text-slate-900">{targetFarmer.farmer_name}</p>
                <p className="text-slate-500 font-mono">ID: {targetFarmer.farmer_id} | Village: {targetFarmer.village || 'N/A'}</p>
                <p className="text-rose-600 font-bold font-mono">
                  Current Dues: ₹{formatINR(getOutstanding(targetFarmer))}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for {targetFarmer.account_status === 'active' ? 'Deactivation' : 'Activation'} *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reasonModalInput}
                  onChange={(e) => setReasonModalInput(e.target.value)}
                  placeholder="Enter audit reason (e.g. Requested by farmer, Account duplicate, Dues cleared...)"
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-normal text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetFarmer(null)}
                  disabled={busyId === targetFarmer.id}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === targetFarmer.id}
                  className={`flex-1 py-2.5 text-white font-bold rounded-xl shadow-md transition-all ${
                    targetFarmer.account_status === 'active'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {busyId === targetFarmer.id ? 'Processing...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}