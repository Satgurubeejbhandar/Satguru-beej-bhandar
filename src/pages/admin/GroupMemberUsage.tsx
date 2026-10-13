import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, RefreshCw, Loader2, Crown, AlertCircle, Phone, MapPin, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

// ── TypeScript Models ──
interface Farmer {
  farmer_name: string
  farmer_id: string
  village?: string | null
  mobile?: string | null
}

interface GroupMember {
  id: string
  group_id: string
  farmer_id: string
  is_leader: boolean
  individual_limit: number | string
  individual_used: number | string
  individual_remaining: number | string
  farmer?: Farmer | null
}

interface FarmerGroup {
  id: string
  group_id: string
  group_name: string
  credit_limit: number | string
  total_used: number | string
  total_remaining: number | string
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

export default function GroupMemberUsage() {
  const [groups, setGroups] = useState<FarmerGroup[]>([])
  const [groupId, setGroupId] = useState<string>('')
  const [members, setMembers] = useState<GroupMember[]>([])
  
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true)
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Load Groups List
  const loadGroups = useCallback(async () => {
    try {
      setLoadingGroups(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('farmer_groups')
        .select('id, group_id, group_name, credit_limit, total_used, total_remaining')
        .eq('account_status', 'active')
        .order('group_name', { ascending: true })

      if (fetchErr) throw fetchErr

      if (isMountedRef.current) {
        setGroups((data as FarmerGroup[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load groups'
      if (isMountedRef.current) {
        setError(msg)
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingGroups(false)
      }
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  // Fetch Members for Selected Group
  const loadMembers = async (id: string) => {
    setGroupId(id)
    if (!id) {
      setMembers([])
      return
    }

    setLoadingMembers(true)
    setError(null)
    try {
      const { data, error: memberErr } = await supabase
        .from('group_members')
        .select('*, farmer:farmers(farmer_name, farmer_id, village, mobile)')
        .eq('group_id', id)
        .order('is_leader', { ascending: false })

      if (memberErr) throw memberErr

      if (isMountedRef.current) {
        setMembers((data as GroupMember[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load members'
      if (isMountedRef.current) {
        setError(msg)
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMembers(false)
      }
    }
  }

  // Reload both Group Totals & Members together
  const handleReload = async () => {
    await loadGroups()
    if (groupId) {
      await loadMembers(groupId)
    }
    if (isMountedRef.current) {
      toast.success('Data refreshed! 🔄')
    }
  }

  const selectedGroup = groups.find((x) => x.id === groupId)

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-amber-400" size={28} /> Group Member Usage
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Monitor member-wise credit limits, current usage, and available balance
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" /> {error}
          </span>
          <button onClick={handleReload} className="underline hover:text-rose-950 font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Group Selector & Reload Action */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <select
            value={groupId}
            disabled={loadingGroups}
            onChange={(e) => loadMembers(e.target.value)}
            aria-label="Select farmer group"
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">-- Select Farmer Group --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_name} ({g.group_id})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={loadingGroups || loadingMembers}
          onClick={handleReload}
          aria-label="Reload group data"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <RefreshCw size={14} className={loadingGroups || loadingMembers ? 'animate-spin' : ''} />
          {loadingMembers ? 'Loading...' : 'Reload Data'}
        </button>
      </div>

      {/* Selected Group Summary Cards */}
      {selectedGroup && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Group Credit Limit
            </span>
            <span className="text-xl font-black text-slate-800 font-mono">
              ₹{formatINR(selectedGroup.credit_limit)}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Total Group Used
            </span>
            <span className="text-xl font-black text-rose-600 font-mono">
              ₹{formatINR(selectedGroup.total_used)}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Remaining Limit
            </span>
            <span className="text-xl font-black text-emerald-700 font-mono">
              ₹{formatINR(selectedGroup.total_remaining)}
            </span>
          </div>
        </div>
      )}

      {/* Members Usage Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[640px]" aria-label="Group members credit usage table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase text-[11px] tracking-wider">
                <th scope="col" className="p-4">Farmer Member</th>
                <th scope="col" className="p-4 text-center">Role</th>
                <th scope="col" className="p-4 text-right">Individual Limit</th>
                <th scope="col" className="p-4 text-right">Used Amount</th>
                <th scope="col" className="p-4 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loadingMembers ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2 font-medium">
                      <Loader2 className="animate-spin text-emerald-600" size={20} />
                      Fetching group members...
                    </div>
                  </td>
                </tr>
              ) : !groupId ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-1 py-4">
                      <Users size={24} className="text-slate-300 mb-1" />
                      <span>Please select a group from the dropdown to view member credit usage.</span>
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-1 py-4">
                      <AlertCircle size={24} className="text-amber-400 mb-1" />
                      <span>No members found in this group.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const farmerName = m.farmer?.farmer_name || 'Unknown Farmer'
                  const farmerCode = m.farmer?.farmer_id || 'N/A'
                  const limit = safeNum(m.individual_limit)
                  const used = safeNum(m.individual_used)
                  const remaining = safeNum(m.individual_remaining)

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 text-sm">{farmerName}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-emerald-700 font-semibold">{farmerCode}</span>
                          {m.farmer?.village && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {m.farmer.village}
                            </span>
                          )}
                          {m.farmer?.mobile && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone size={10} /> {m.farmer.mobile}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {m.is_leader ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-black text-[10px] border border-amber-300">
                            <Crown size={12} className="text-amber-600 fill-amber-500" /> LEADER
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-semibold">Member</span>
                        )}
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