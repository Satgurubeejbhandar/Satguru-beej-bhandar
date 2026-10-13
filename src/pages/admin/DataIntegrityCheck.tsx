// src/pages/admin/DataIntegrityCheck.tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ShieldCheck, RefreshCw, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface CheckResult {
  status: string
  synced_farmers: number
  mismatched_balances: number
  timestamp: string
}

export default function DataIntegrityCheck() {
  const { role, loading: authLoading } = useAuth()
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRunIntegrityCheck = useCallback(async () => {
    if (role !== 'admin') return
    setRunning(true)
    toast.loading('डेटाबेस और खातों की स्वतः जांच जारी है...', { id: 'integrity-check' })

    try {
      const { data, error } = await supabase.rpc('run_data_integrity_check')

      if (error) throw error

      if (isMountedRef.current && data) {
        setResult(data as CheckResult)
        toast.success('डेटाबेस और बहीखाता पूरी तरह से सुरक्षित व सिंक है!', { id: 'integrity-check' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Integrity check failed'
      if (isMountedRef.current) {
        toast.error('जांच में त्रुटि: ' + msg, { id: 'integrity-check' })
      }
    } finally {
      if (isMountedRef.current) {
        setRunning(false)
      }
    }
  }, [role])

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Data Integrity tool chalane ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-amber-400" size={28} /> Data Integrity &amp; Self-Healing Tool
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          SATGURU BEEJ BHANDAR — खातों, स्टॉक एवं बहीखाता संतुलन की एक-क्लिक स्वचालित ऑडिट जांच
        </p>
      </div>

      {/* Action Card */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 text-center">
        <p className="text-xs text-gray-600 font-medium max-w-lg mx-auto leading-relaxed">
          यह टूल सभी किसानों की बिक्री, भुगतान एवं वापसी इतिहास को पुनः स्कैन करके `farmers`, `credit_accounts` और `farmer_ledger` में 100% गणितीय समानता सुनिश्चित करता है।
        </p>

        <button
          type="button"
          onClick={handleRunIntegrityCheck}
          disabled={running || authLoading}
          className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 text-sm inline-flex items-center gap-2 cursor-pointer"
        >
          {running ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              जांच व सिंक हो रहा है...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Run Full Audit &amp; Self-Healing Check
            </>
          )}
        </button>
      </div>

      {/* Result Display Card */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
            <CheckCircle2 size={20} className="text-emerald-600" />
            सिस्टम ऑडिट स्थिति: {result.status}
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs font-medium">
            <div className="p-3 bg-white rounded-xl border">
              <span className="text-gray-500 block text-[10px]">सिंक किए गए किसान खाते</span>
              <span className="text-base font-bold font-mono text-emerald-900">{result.synced_farmers}</span>
            </div>
            <div className="p-3 bg-white rounded-xl border">
              <span className="text-gray-500 block text-[10px]">असंतुलित खाते (Mismatched)</span>
              <span className="text-base font-bold font-mono text-emerald-900">{result.mismatched_balances}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-mono text-right">Last Verified: {result.timestamp}</p>
        </div>
      )}
    </div>
  )
}