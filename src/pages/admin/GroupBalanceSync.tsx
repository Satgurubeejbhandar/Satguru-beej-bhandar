// src/pages/admin/GroupBalanceSync.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Users, RefreshCw, Loader2, AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface GroupMember {
  id: string
  group_id: string
  member_name?: string
  individual_limit: number | string
  individual_used: number | string
  individual_remaining: number | string
}

interface FarmerGroup {
  id: string
  group_id: string
  group_name: string
  credit_limit: number | string
  total_used: number | string
  total_remaining: number | string
  account_status: 'active' | 'inactive'
  group_members?: GroupMember[]
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

export default function GroupBalanceSync() {
  const { role, loading: authLoading } = useAuth()
  const [groups, setGroups] = useState<FarmerGroup[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [syncing, setSyncing] = useState<boolean>(false)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadGroups = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('farmer_groups')
        .select('*, group_members(*)')
        .eq('account_status', 'active')
        .order('group_name', { ascending: true })

      if (error) throw error

      if (isMountedRef.current) {
        setGroups((data as FarmerGroup[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load groups'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadGroups()
    }
  }, [loadGroups, role, authLoading])

  // ── ATOMIC SYNCHRONIZATION VIA DATABASE RPC ONLY ──
  // Removed insecure client-side fallback query that caused double-counting on payment tables.
  const handleSyncAll = async () => {
    setSyncing(true)
    const toastId = toast.loading('समूह उधारी खातों का पुनर्गणना सिंक चल रहा है...')
    try {
      const { error: rpcErr } = await supabase.rpc('sync_all_farmer_group_balances')

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Database RPC rejected balance synchronization')
      }

      toast.success('समूह उधारी खाते सफलतापूर्वक सिंक हो गए हैं!', { id: toastId })
      await loadGroups()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      if (isMountedRef.current) {
        toast.error('सिंक विफल: ' + msg, { id: toastId })
      }
    } finally {
      if (isMountedRef.current) {
        setSyncing(false)
      }
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Group Balance Sync ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-amber-400 shrink-0" size={28} /> Group Balance Sync
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Recalculate live net udhaar usage (Sales - Payments - Returns)
          </p>
        </div>
        <button
          type="button"
          disabled={syncing || loading}
          onClick={handleSyncAll}
          aria-label="Sync all group balances"
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing DB...' : 'Sync All Balances'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[640px]" aria-label="Group balance sync status table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase text-[11px] tracking-wider">
                <th scope="col" className="p-4">Group Info</th>
                <th scope="col" className="p-4 text-right">Total Credit Limit</th>
                <th scope="col" className="p-4 text-right">Total Used (Net Udhaar)</th>
                <th scope="col" className="p-4 text-right">Remaining Limit</th>
                <th scope="col" className="p-4 text-center">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2 font-medium">
                      <Loader2 className="animate-spin text-emerald-600" size={20} />
                      Fetching group balances...
                    </div>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2 py-4">
                      <AlertCircle size={24} className="text-slate-300" />
                      <span>No active farmer groups found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                groups.map((g) => {
                  const limit = safeNum(g.credit_limit)
                  const used = safeNum(g.total_used)
                  const remaining = safeNum(g.total_remaining)
                  const memberCount = g.group_members?.length || 0

                  return (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 text-sm">{g.group_name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{g.group_id}</p>
                      </td>
                      <td className="p-4 font-bold text-slate-700 text-right font-mono">
                        ₹{formatINR(limit)}
                      </td>
                      <td className="p-4 font-black text-rose-600 text-right font-mono">
                        ₹{formatINR(used)}
                      </td>
                      <td className="p-4 font-black text-emerald-700 text-right font-mono">
                        ₹{formatINR(remaining)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-extrabold text-[11px] font-mono">
                          {memberCount}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}