// src/pages/admin/CashbackManager.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Sparkles, CheckCircle2, Wallet, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface FarmerInfo {
  id?: string
  farmer_name: string
  farmer_id: string
}

interface GroupInfo {
  id?: string
  group_name: string
  group_id: string
}

interface CashbackRecord {
  id: string
  farmer_id?: string | null
  group_id?: string | null
  eligible_amount: number | string
  cashback_rate: number | string
  cashback_earned: number | string
  cashback_released: number | string
  cashback_pending: number | string
  released_date?: string | null
  created_at: string
  farmer?: FarmerInfo | null
  group?: GroupInfo | null
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function CashbackManager() {
  const [cashbackList, setCashbackList] = useState<CashbackRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)

  const loadCashback = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cashback_records')
        .select('*, farmer:farmers(id, farmer_name, farmer_id), group:farmer_groups(id, group_name, group_id)')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (isMounted.current) {
        setCashbackList((data as unknown as CashbackRecord[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cashback data लोड करने में समस्या आई'
      if (isMounted.current) {
        toast.error('Cashback data load error: ' + msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    void loadCashback()

    return () => {
      isMounted.current = false
    }
  }, [loadCashback])

  const handleReleaseCashback = async (record: CashbackRecord) => {
    // 🟢 FIX: Agar pehle se koi release chal raha hai toh dobara mat chalao
    if (releasingId !== null) return

    const pendingAmount =
      record.cashback_pending !== null && record.cashback_pending !== undefined
        ? safeNum(record.cashback_pending)
        : safeNum(record.cashback_earned)

    if (pendingAmount <= 0) {
      toast.error('रिलीज करने के लिए कोई pending कैशबैक नहीं है')
      return
    }

    const targetName = record.group?.group_name || record.farmer?.farmer_name || 'Unknown'
    const confirmed = window.confirm(
      `क्या आप ₹${formatINR(pendingAmount)} कैशबैक "${targetName}" को रिलीज करना चाहते हैं?\n\n` +
        `यह राशि खाते में सुरक्षित रूप से जमा हो जाएगी और लेजर अपडेट होगा।`
    )
    if (!confirmed) return

    setReleasingId(record.id)

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user) throw new Error('User authentication check failed')
      const currentUser = authData.user

      const targetFarmerId = record.farmer_id || record.farmer?.id || null

      if (targetFarmerId) {
        // 🔧 FIX: Safe RPC Call (No unused variable warnings)
        const { error: rpcErr } = await supabase.rpc('process_farmer_cashback', {
          p_farmer_id: targetFarmerId,
          p_cashback_amount: pendingAmount,
          p_notes: `Cashback Released - Record #${record.id.slice(0, 8)}`,
          p_user_id: currentUser.id,
        })

        if (rpcErr) throw rpcErr
      }

      // 🔧 Update Cashback Record State
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const { error: updateErr } = await supabase
        .from('cashback_records')
        .update({
          cashback_released: safeNum(record.cashback_earned),
          cashback_pending: 0,
          released_date: todayStr,
        })
        .eq('id', record.id)

      if (updateErr) throw updateErr

      toast.success(`कैशबैक ₹${formatINR(pendingAmount)} "${targetName}" को सफलतापूर्वक रिलीज हो गया!`, {
        duration: 5000,
      })
      await loadCashback()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cashback release में समस्या आई'
      if (isMounted.current) {
        toast.error('Cashback release failed: ' + msg, { duration: 6000 })
      }
    } finally {
      if (isMounted.current) {
        setReleasingId(null)
      }
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-amber-400" size={28} /> Group Cashback Manager
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            4 किसानों के समूह पर 10% फिक्स कैशबैक पात्रता व रिलीज रिकॉर्ड
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCashback()}
          disabled={loading || releasingId !== null}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]" aria-label="Cashback records table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5">Farmer / Group</th>
                <th scope="col" className="p-3.5">Eligible Purchase</th>
                <th scope="col" className="p-3.5">Rate</th>
                <th scope="col" className="p-3.5">Earned</th>
                <th scope="col" className="p-3.5">Status</th>
                <th scope="col" className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    <Loader2 className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
                    Cashback Data Loading...
                  </td>
                </tr>
              ) : cashbackList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-medium">
                    कोई कैशबैक रिकॉर्ड नहीं मिला।
                  </td>
                </tr>
              ) : (
                cashbackList.map((c) => {
                  const pendingVal = safeNum(c.cashback_pending)
                  const isReleased =
                    pendingVal === 0 &&
                    (safeNum(c.cashback_released) > 0 || safeNum(c.cashback_earned) > 0)
                  const isBusy = releasingId === c.id

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50 transition-colors ${isBusy ? 'opacity-50' : ''}`}
                    >
                      <td className="p-3.5">
                        <p className="font-bold text-gray-900">
                          {c.group?.group_name || c.farmer?.farmer_name || '—'}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          ID: {c.group?.group_id || c.farmer?.farmer_id || '—'}
                        </p>
                      </td>
                      <td className="p-3.5 font-bold text-gray-900">
                        ₹{formatINR(c.eligible_amount)}
                      </td>
                      <td className="p-3.5 font-bold text-emerald-800">{c.cashback_rate}%</td>
                      <td className="p-3.5 font-black text-amber-600 text-sm">
                        ₹{formatINR(c.cashback_earned)}
                      </td>
                      <td className="p-3.5">
                        {isReleased ? (
                          <span className="px-2.5 py-1 bg-green-100 text-green-800 font-bold rounded-full text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> Released
                            {c.released_date && (
                              <span className="text-green-600 ml-1">({c.released_date})</span>
                            )}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold rounded-full text-[10px] inline-flex items-center gap-1">
                            <Wallet size={12} /> Pending ₹{formatINR(pendingVal || c.cashback_earned)}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {!isReleased && (
                          <button
                            type="button"
                            disabled={releasingId !== null}
                            onClick={() => void handleReleaseCashback(c)}
                            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="animate-spin" size={12} /> Releasing...
                              </>
                            ) : (
                              <>
                                <Wallet size={12} /> Release
                              </>
                            )}
                          </button>
                        )}
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