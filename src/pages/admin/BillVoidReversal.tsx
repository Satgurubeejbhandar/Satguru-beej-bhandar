// src/pages/admin/BillVoidReversal.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Ban, Loader2, AlertTriangle, RefreshCw, ShieldAlert, FileText, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

interface UnifiedBill {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number | string
  bill_status: string
  farmer_id: string | null
  farmer_name: string
  farmer_code: string
  is_physical: boolean
  transaction_type?: string
}

interface UnifiedBill {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number | string
  bill_status: string
  farmer_id: string | null
  farmer_name: string
  farmer_code: string
  is_physical: boolean
  transaction_type?: string
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

export default function BillVoidReversal() {
  const { role, loading: authLoading } = useAuth()
  const [bills, setBills] = useState<UnifiedBill[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [reason, setReason] = useState<string>('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)

  const loadBills = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)

      // Fetch Active Digital Sales Bills
      const { data: salesData, error: salesErr } = await supabase
        .from('sales_bills')
        .select('id, bill_number, bill_date, total_amount, bill_status, farmer_id, farmer:farmers(farmer_name, farmer_id)')
        .eq('bill_status', 'active')
        .order('created_at', { ascending: false })
        .limit(30)

      if (salesErr) throw salesErr

      // Fetch Active Physical Paper Bills
      const { data: physicalData, error: physicalErr } = await supabase
        .from('physical_bills')
        .select('id, bill_number, bill_date, bill_amount, status, farmer_id, transaction_type, farmer:farmers(farmer_name, farmer_id)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30)
      
      if (physicalErr) throw physicalErr

      if (isMounted.current) {
        const combined: UnifiedBill[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(salesData || []).forEach((s: any) => {
          const farmerObj = Array.isArray(s.farmer) ? s.farmer[0] : s.farmer
          combined.push({
            id: s.id,
            bill_number: s.bill_number,
            bill_date: s.bill_date,
            total_amount: safeNum(s.total_amount),
            bill_status: s.bill_status,
            farmer_id: s.farmer_id,
            farmer_name: farmerObj?.farmer_name || 'Group / Other',
            farmer_code: farmerObj?.farmer_id || '—',
            is_physical: false
          })
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(physicalData || []).forEach((pb: any) => {
          const farmerObj = Array.isArray(pb.farmer) ? pb.farmer[0] : pb.farmer
          combined.push({
            id: pb.id,
            bill_number: pb.bill_number,
            bill_date: pb.bill_date,
            total_amount: safeNum(pb.bill_amount),
            bill_status: pb.status,
            farmer_id: pb.farmer_id,
            farmer_name: farmerObj?.farmer_name || 'Farmer',
            farmer_code: farmerObj?.farmer_id || '—',
            is_physical: true,
            transaction_type: pb.transaction_type
          })
        })

        // Sort combined array by bill_date
        combined.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime())
        setBills(combined)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bills लोड करने में समस्या आई'
      if (isMounted.current) {
        toast.error(msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      loadBills()
    }
    return () => {
      isMounted.current = false
    }
  }, [loadBills, role, authLoading])

  const voidBill = async (bill: UnifiedBill) => {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      toast.error('Void का कारण लिखना ज़रूरी है!')
      return
    }

    const typeMsg = bill.is_physical ? 'फिजिकल पर्ची बिल' : 'डिजिटल इन्वेंट्री बिल'
    
    const ok = window.confirm(
      `⚠️ ${typeMsg} ${bill.bill_number} को VOID करना चाहते हैं?\n\n` +
        (!bill.is_physical ? `• स्टॉक वापस इन्वेंटरी में जुड़ेगा\n` : '') +
        `• किसान का क्रेडिट रिवर्स होगा\n` +
        `• मूल बिल इतिहास में void मार्क होगा\n\n` +
        `यह क्रिया वापस नहीं हो सकती!`
    )
    if (!ok) return

    setBusyId(bill.id)

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user) throw new Error('User authentication check failed')
      const user = authData.user

      if (bill.is_physical) {
        // Void Physical Bill
        const { error: rpcErr } = await supabase.rpc('void_physical_bill', {
          p_bill_id: bill.id,
          p_reason: trimmedReason,
          p_user_id: user.id,
        })
        if (rpcErr) throw new Error(rpcErr.message || 'Database transaction failed during physical void operation')
      } else {
        // Void Digital Bill
        const { error: rpcErr } = await supabase.rpc('void_sales_bill', {
          p_bill_id: bill.id,
          p_reason: trimmedReason,
          p_user_id: user.id,
        })
        if (rpcErr) throw new Error(rpcErr.message || 'Database transaction failed during digital void operation')
      }

      toast.success(`बिल ${bill.bill_number} सफलतापूर्वक Void हो गया। इतिहास और लेजर सुरक्षित हैं।`, {
        duration: 5000,
      })

      if (isMounted.current) setReason('')
      await loadBills()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Void करने में समस्या आई'
      if (isMounted.current) {
        toast.error('Void failed: ' + msg, { duration: 6000 })
      }
    } finally {
      if (isMounted.current) setBusyId(null)
    }
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Bill Void ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Ban className="text-amber-400 shrink-0" size={26} /> Bill Void / Reversal
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Digital & Physical Bills — Safe Reversal with Audit Trail
          </p>
        </div>
        <button
          type="button"
          onClick={loadBills}
          disabled={loading || busyId !== null}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh List
        </button>
      </div>

      {/* Reason Input Card */}
      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 space-y-2 shadow-xs">
        <label className="block text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle size={14} /> Void Reason (Required — Audit Trail में रिकॉर्ड होगा)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Wrong product billed, Customer returned goods, Duplicate entry..."
          className="w-full border border-rose-300 rounded-xl px-4 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          disabled={busyId !== null}
        />
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[640px]" aria-label="Active bills eligible for voiding">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5 pl-5">Bill</th>
                <th scope="col" className="p-3.5">Farmer</th>
                <th scope="col" className="p-3.5">Amount</th>
                <th scope="col" className="p-3.5">Date</th>
                <th scope="col" className="p-3.5 text-center pr-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500 font-medium">
                    <Loader2 className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
                    Loading active bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500 font-medium">
                    No active bills found for voiding.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      busyId === b.id ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <td className="p-3.5 pl-5 font-mono font-bold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {b.is_physical ? <Camera size={14} className="text-amber-600" /> : <FileText size={14} className="text-blue-600" />}
                        {b.bill_number}
                        {b.is_physical && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded ml-1">PHY</span>}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-gray-900">
                        {b.farmer_name}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500">
                        {b.farmer_code}
                      </p>
                    </td>
                    <td className="p-3.5 font-black text-emerald-950 font-mono text-sm">
                      ₹{formatINR(b.total_amount)}
                    </td>
                    <td className="p-3.5 font-mono text-gray-700 font-semibold">{b.bill_date}</td>
                    <td className="p-3.5 text-center pr-5">
                      <button
                        type="button"
                        disabled={busyId !== null || !reason.trim()}
                        onClick={() => voidBill(b)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {busyId === b.id ? (
                          <>
                            <Loader2 className="animate-spin" size={12} /> Voiding...
                          </>
                        ) : (
                          <>
                            <Ban size={12} /> Void Bill
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
             <Loader2 className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
             Loading bills...
          </div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
            No active bills found.
          </div>
        ) : (
          bills.map((b) => (
            <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                 <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 text-sm">
                   {b.is_physical ? <Camera size={14} className="text-amber-600 shrink-0" /> : <FileText size={14} className="text-blue-600 shrink-0" />}
                   <span className="truncate">{b.bill_number}</span>
                   {b.is_physical && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded shrink-0">PHY</span>}
                 </div>
                 <span className="font-black text-emerald-950 font-mono shrink-0">₹{formatINR(b.total_amount)}</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{b.farmer_name}</p>
                <div className="flex justify-between items-center text-xs mt-1 text-slate-500">
                  <span className="font-mono">{b.farmer_code}</span>
                  <span className="font-mono font-semibold text-slate-700">{b.bill_date}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={busyId !== null || !reason.trim()}
                onClick={() => voidBill(b)}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                {busyId === b.id ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Voiding...
                  </>
                ) : (
                  <>
                    <Ban size={14} /> Void Bill
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] text-gray-500 font-medium text-center">
        Void करने पर बिल डिलीट नहीं होता — (डिजिटल बिल में) स्टॉक वापस जुड़ता है, क्रेडिट रिवर्स होता है और ऑडिट लॉग बनता है।
      </p>
    </div>
  )
}