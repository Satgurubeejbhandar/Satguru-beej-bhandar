// src/pages/admin/GroupUdhaarMaster.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Users,
  Plus,
  Search,
  UsersRound,
  KeyRound,
  Crown,
  CreditCard,
  Printer,
  Sparkles,
  X,
  Loader2,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Strict Type Definitions ──
interface FarmerOption {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  village: string | null
  mobile: string | null
  is_group_member?: boolean | null
}

interface GroupMember {
  id: string
  group_id: string
  farmer_id: string
  individual_limit: number | string
  individual_used: number | string
  individual_remaining: number | string
  is_leader: boolean
  farmer?: FarmerOption | null
}

interface LeaderInfo {
  farmer_name: string
  farmer_id: string
  mobile: string | null
}

interface FarmerGroup {
  id: string
  group_id: string
  group_name: string
  leader_farmer_id?: string | null
  credit_limit: number | string
  total_used: number | string
  total_remaining: number | string
  cashback_percent?: number | string | null
  account_status: string
  created_at: string
  leader?: LeaderInfo | null
  group_members?: GroupMember[] | null
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

export default function GroupUdhaarMaster() {
  const { role, loading: authLoading } = useAuth()
  const [groups, setGroups] = useState<FarmerGroup[]>([])
  const [activeFarmers, setActiveFarmers] = useState<FarmerOption[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Create Group Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [groupName, setGroupName] = useState<string>('')
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<string[]>(['', '', '', ''])
  const [leaderIndex, setLeaderIndex] = useState<number>(0)
  const [groupCreditLimit, setGroupCreditLimit] = useState<string>('100000')
  const [groupPin, setGroupPin] = useState<string>('123456')
  const [saving, setSaving] = useState<boolean>(false)

  // Selected Group Card Preview Modal
  const [selectedGroup, setSelectedGroup] = useState<FarmerGroup | null>(null)
  const [showCardModal, setShowCardModal] = useState<boolean>(false)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const resetCreateForm = () => {
    setGroupName('')
    setSelectedFarmerIds(['', '', '', ''])
    setLeaderIndex(0)
    setGroupCreditLimit('100000')
    setGroupPin('123456')
    setShowAddModal(false)
  }

  // ── Fetch Groups & Active Farmers ─────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)

      const [farmerRes, groupRes] = await Promise.all([
        supabase
          .from('farmers')
          .select('id, farmer_id, farmer_name, father_name, village, mobile, is_group_member')
          .eq('account_status', 'active')
          .order('farmer_name', { ascending: true }),

        supabase
          .from('farmer_groups')
          .select(`
            *,
            leader:farmers!farmer_groups_leader_farmer_id_fkey(farmer_name, farmer_id, mobile),
            group_members(
              id,
              individual_limit,
              individual_used,
              individual_remaining,
              is_leader,
              farmer:farmers(id, farmer_id, farmer_name, father_name, village, mobile)
            )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (farmerRes.error) throw farmerRes.error
      if (groupRes.error) throw groupRes.error

      if (isMountedRef.current) {
        setActiveFarmers((farmerRes.data as FarmerOption[]) || [])
        setGroups((groupRes.data as unknown as FarmerGroup[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (isMountedRef.current) {
        toast.error('डेटा लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadData()
    }
  }, [loadData, role, authLoading])

  const handleFarmerSelectChange = (index: number, farmerUuid: string) => {
    const updated = [...selectedFarmerIds]
    updated[index] = farmerUuid
    setSelectedFarmerIds(updated)
  }

  // ── Create Group Handler ──────────────────────────────────────────────────

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()

    const uniqueIds = Array.from(new Set(selectedFarmerIds.filter((id) => id !== '')))
    if (uniqueIds.length < 4) {
      toast.error('समूह बनाने के लिए 4 अलग-अलग किसान चुनना अनिवार्य है!')
      return
    }

    if (!/^\d{6}$/.test(groupPin || '')) {
      toast.error('Group PIN exactly 6 digits का होना चाहिए!')
      return
    }

    const alreadyInGroup = activeFarmers.filter(
      (f) => uniqueIds.includes(f.id) && f.is_group_member
    )
    if (alreadyInGroup.length > 0) {
      toast.error(`किसान ${alreadyInGroup[0].farmer_name} पहले से ही किसी समूह का सदस्य है!`)
      return
    }

    const totalLimit = safeNum(groupCreditLimit)
    if (totalLimit < 10000 || totalLimit > 400000) {
      toast.error('Group limit ₹10,000 से ₹4,00,000 के बीच होनी चाहिए!')
      return
    }

    const leaderFarmerUuid = selectedFarmerIds[leaderIndex]
    if (!leaderFarmerUuid || !uniqueIds.includes(leaderFarmerUuid)) {
      toast.error('वैध समूह अध्यक्ष का चयन करें!')
      return
    }

    setSaving(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      // Execute atomic transaction on the database side
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_farmer_group', {
        p_group_name: groupName.trim() || 'Kisan Group',
        p_leader_farmer_id: leaderFarmerUuid,
        p_credit_limit: totalLimit,
        p_farmer_ids: selectedFarmerIds,
        p_leader_index: leaderIndex,
        p_pin: groupPin,
        p_user_id: user?.id || null,
      })

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Database transaction rejected group creation.')
      }

      const rawObj = (rpcRes && typeof rpcRes === 'object' ? rpcRes : {}) as Record<string, unknown>
      const generatedCode = String(rawObj.group_id || 'GRP')
      
      toast.success(`समूह ${generatedCode} (10% कैशबैक योजना) सफलतापूर्वक बन गया!`, {
        duration: 5000,
      })
      
      if (isMountedRef.current) {
        resetCreateForm()
      }
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (isMountedRef.current) {
        toast.error('समूह बनाने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  const filteredGroups = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.group_name?.toLowerCase().includes(q) ||
        g.group_id?.toLowerCase().includes(q) ||
        g.leader?.farmer_name?.toLowerCase().includes(q)
    )
  }, [groups, searchTerm])

  const getFarmerOptions = (index: number) =>
    activeFarmers.filter((f) => {
      const selectedElsewhere =
        selectedFarmerIds.includes(f.id) && selectedFarmerIds[index] !== f.id
      if (selectedElsewhere) return false
      if (f.is_group_member && selectedFarmerIds[index] !== f.id) return false
      return true
    })

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Group Udhaar Master ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Top Banner Header */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900 flex items-center gap-2">
            <UsersRound className="text-emerald-700" size={28} /> Group Udhaar Master (किसान समूह योजना)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            4 किसानों का समूह बनाएं — 10% फिक्स कैशबैक और संयुक्त क्रेडिट सीमा का लाभ दें।
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition text-xs shrink-0"
        >
          <Plus size={18} />
          <span>+ Create New 4-Farmer Group</span>
        </button>
      </div>

      {/* Scheme Highlight Banner */}
      <div className="print:hidden bg-gradient-to-r from-amber-50 to-emerald-50 border-2 border-amber-300/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-slate-950 font-black rounded-xl shadow-xs shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="font-extrabold text-amber-900 text-xs sm:text-sm">
              GROUP SCHEME BENEFIT (10% CASHBACK)
            </p>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              4 किसानों के समूह पर <strong>10% फिक्स कैशबैक</strong> मिलता है (उदा: ₹1,00,000 की खरीदारी पर ₹10,000 का सीधा लाभ)।
            </p>
          </div>
        </div>
        <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-3 py-1.5 rounded-full border border-amber-300 shrink-0 font-mono">
          Max Limit: ₹4,00,000
        </span>
      </div>

      {/* Search Input */}
      <div className="print:hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
        <Search className="text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by Group ID, Group Name or Leader Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search groups"
          className="flex-1 outline-none text-xs font-semibold text-gray-800 placeholder-gray-400 bg-transparent"
        />
      </div>

      {/* Group Cards Grid */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading ? (
          <div className="col-span-2 p-12 text-center text-gray-500 font-bold flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-600" size={22} />
            Loading Farmer Groups...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-gray-500 bg-white rounded-2xl border border-slate-200 text-xs font-medium">
            कोई किसान समूह नहीं मिला। "+ Create New 4-Farmer Group" बटन पर क्लिक करके नया समूह बनाएं।
          </div>
        ) : (
          filteredGroups.map((group) => {
            const limitVal = safeNum(group.credit_limit)
            const usedVal = safeNum(group.total_used)
            const remainingVal = safeNum(group.total_remaining)
            const usedPercent = Math.min(100, Math.round((usedVal / (limitVal || 1)) * 100))

            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl shadow-sm border border-emerald-100 hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div className="bg-emerald-900 text-white p-4 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded uppercase">
                      {group.group_id}
                    </span>
                    <h3 className="font-bold text-sm text-white mt-1">{group.group_name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group)
                      setShowCardModal(true)
                    }}
                    className="p-2 bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded-xl transition border border-emerald-700"
                    title="View / Print Group Card"
                    aria-label={`View group card for ${group.group_name}`}
                  >
                    <CreditCard size={18} />
                  </button>
                </div>

                <div className="p-4 space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-gray-500">Group Limit Usage</span>
                      <span className="text-emerald-900 font-mono">
                        ₹{formatINR(usedVal)} / ₹{formatINR(limitVal)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          usedPercent > 85 ? 'bg-rose-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="text-amber-600 shrink-0" size={16} />
                      <div>
                        <p className="text-[10px] text-amber-800 font-bold uppercase">
                          Group Leader (समूह अध्यक्ष)
                        </p>
                        <p className="font-bold text-gray-900 text-xs">
                          {group.leader?.farmer_name || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-gray-600 text-[11px]">
                      {group.leader?.mobile || '—'}
                    </span>
                  </div>

                  <div>
                    <p className="font-bold text-gray-700 mb-2 flex items-center gap-1">
                      <Users size={14} className="text-emerald-700" /> 4 Members Breakdown:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(group.group_members || []).map((gm) => (
                        <div
                          key={gm.id}
                          className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] flex flex-col justify-between"
                        >
                          <p className="font-bold text-gray-800 truncate">
                            {gm.is_leader && '👑 '}
                            {gm.farmer?.farmer_name || 'Member'}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            S/O {gm.farmer?.father_name || '—'}
                          </p>
                          <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between font-mono font-semibold text-[10px]">
                            <span className="text-gray-500">
                              Used: ₹{formatINR(gm.individual_used)}
                            </span>
                            <span className="text-emerald-700">
                              Limit: ₹{formatINR(gm.individual_limit)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center text-[11px] font-bold text-gray-600">
                  <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✨ 10% Cashback Active
                  </span>
                  <span className="text-gray-500 font-mono">
                    Remaining: ₹{formatINR(remainingVal)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* CREATE NEW GROUP MODAL */}
      {showAddModal && (
        <div className="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UsersRound className="text-amber-400" size={22} /> नया 4-किसान समूह बनाएं
              </h2>
              <button
                type="button"
                onClick={resetCreateForm}
                className="text-emerald-200 hover:text-white p-1"
                aria-label="Close modal"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  समूह का नाम (Group Name)
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Daloosar Jai Kisan Group"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-xs"
                />
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="font-bold text-emerald-900 mb-2 flex items-center gap-1">
                  <Users size={16} /> 4 किसानों का चयन करें (Select 4 Active Farmers) *
                </p>

                <div className="space-y-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between"
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-gray-700 text-xs">
                          {idx === leaderIndex ? '👑 Group Leader' : `Farmer ${idx + 1}`}
                        </span>
                      </div>

                      <select
                        required
                        value={selectedFarmerIds[idx]}
                        onChange={(e) => handleFarmerSelectChange(idx, e.target.value)}
                        className="flex-1 w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- Select Farmer --</option>
                        {getFarmerOptions(idx).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.farmer_name} S/O {f.father_name || '—'} ({f.village || '—'}) - ID:{' '}
                            {f.farmer_id}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setLeaderIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          leaderIndex === idx
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        Make Leader
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Group Credit Limit (कुल समूह सीमा ₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={10000}
                    max={400000}
                    value={groupCreditLimit}
                    onChange={(e) => setGroupCreditLimit(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1 font-mono">
                    प्रत्येक kisan की व्यक्तिगत सीमा = ₹{formatINR(safeNum(groupCreditLimit) / 4)}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <KeyRound size={14} className="text-emerald-700" /> Group Transaction PIN (6 Digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={groupPin}
                    onChange={(e) =>
                      setGroupPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-center font-mono font-bold tracking-widest focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  disabled={saving}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl disabled:opacity-50 transition shadow flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Creating Group...
                    </>
                  ) : (
                    'Save Group (समूह बनाएं)'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT GROUP CARD MODAL */}
      {showCardModal && selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:bg-white print:p-0 print:static print:inset-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-w-none">
            <div className="print:hidden bg-emerald-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <CreditCard className="text-amber-400" size={20} /> Group Udhaar Card
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCardModal(false)
                    setSelectedGroup(null)
                  }}
                  className="text-emerald-200 hover:text-white p-1"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-100 flex justify-center print:bg-white print:p-0">
              <div className="w-full bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 shadow-2xl border-2 border-amber-500/40 space-y-4 print:text-black print:bg-white print:border-black print:shadow-none">
                <div className="border-b border-emerald-800 print:border-gray-300 pb-3 flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded print:border print:border-black">
                      {selectedGroup.group_id}
                    </span>
                    <h2 className="text-base font-black text-white print:text-black mt-1">
                      {selectedGroup.group_name}
                    </h2>
                    <p className="text-[10px] text-emerald-300 print:text-gray-600">
                      SATGURU BEEJ BHANDAR — Daloosar
                    </p>
                  </div>
                  <span className="text-xs font-black text-amber-400 bg-emerald-900/80 px-2.5 py-1 rounded-xl border border-amber-500/40 print:text-black print:border-black print:bg-white">
                    10% CASHBACK
                  </span>
                </div>

                <div className="bg-emerald-900/80 print:bg-gray-50 p-3 rounded-2xl border border-emerald-800 print:border-gray-300 flex justify-between text-xs font-bold">
                  <div>
                    <p className="text-[10px] text-emerald-300 print:text-gray-500">
                      Total Group Limit
                    </p>
                    <p className="text-amber-400 print:text-black text-base font-mono">
                      ₹{formatINR(selectedGroup.credit_limit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-300 print:text-gray-500">
                      Group Leader
                    </p>
                    <p className="text-white print:text-black text-xs">
                      {selectedGroup.leader?.farmer_name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-emerald-300 print:text-gray-700 text-[11px]">
                    4 Group Members:
                  </p>
                  {(selectedGroup.group_members || []).map((gm) => (
                    <div
                      key={gm.id}
                      className="p-2 bg-emerald-900/40 print:bg-gray-50 rounded-xl flex justify-between items-center text-[11px] print:border print:border-gray-200 font-mono"
                    >
                      <span className="font-sans">
                        {gm.is_leader && '👑 '}
                        {gm.farmer?.farmer_name || 'Member'}
                      </span>
                      <span className="text-emerald-200 print:text-gray-700 font-bold">
                        Limit: ₹{formatINR(gm.individual_limit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}