// src/pages/admin/DataResetTool.tsx
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

import {
  ShieldAlert,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Trash2,
  KeyRound,
  Lock,
  RefreshCw,
  Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BeforeCounts {
  farmers: number
  sales_bills: number
  sales_bill_items: number
  payments: number
  company_payments: number
  returns: number
  purchase_bills: number
  purchase_returns: number
  inventory_batches: number
  stock_ledger: number
  physical_bills: number
  farmer_ledger: number
  financial_transactions: number
}

interface ResetSummary {
  success: boolean
  reset_type: string
  before_counts: BeforeCounts
  counters_reset: boolean
  sequences_reset: boolean
  timestamp: string
}

const CONFIRMATION_STEPS = [
  'मैं समझता हूँ कि यह Test Data रीसेट है और सारा transaction व बहीखाता डेटा मिट जाएगा।',
  'मैं समझता हूँ कि Farmers, Sales, Payments, Ledger, Stock और Physical Bills सब डिलीट होंगे।',
  'Master data (Products, Companies, Categories, Units, Admin Account) सुरक्षित रहेंगे।',
  'डेटा रीसेट के बाद सभी बिल नंबर (Sales, Purchase, Payments) और Farmer ID 0001 से रीस्टार्ट होंगे।',
  'मैं इस Reset की पूरी ज़िम्मेदारी लेता हूँ। यह Undo (वापस) नहीं हो सकता।',
]

const REQUIRED_TYPED_CONFIRM = 'DELETE MY DATA'

export default function DataResetTool() {
  const { user, role, loading: authLoading } = useAuth()
  const [confirms, setConfirms] = useState<boolean[]>([false, false, false, false, false])
  const [password, setPassword] = useState('')
  const [typedConfirm, setTypedConfirm] = useState('')
  const [beforeCounts, setBeforeCounts] = useState<BeforeCounts | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [resetType, setResetType] = useState<'transaction' | 'full'>('transaction')
  const [completed, setCompleted] = useState(false)
  const [resetSummary, setResetSummary] = useState<ResetSummary | null>(null)

  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadCounts = async () => {
    setLoadingCounts(true)
    try {
      const [
        farmers, sales, sales_items, pays, cpays,
        ret, purch, prets, inv, stock, 
        pbills, fledger, fintx
      ] = await Promise.all([
        supabase.from('farmers').select('*', { count: 'exact', head: true }),
        supabase.from('sales_bills').select('*', { count: 'exact', head: true }),
        supabase.from('sales_bill_items').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }),
        supabase.from('company_payments').select('*', { count: 'exact', head: true }),
        supabase.from('returns').select('*', { count: 'exact', head: true }),
        supabase.from('purchase_bills').select('*', { count: 'exact', head: true }),
        supabase.from('purchase_returns').select('*', { count: 'exact', head: true }),
        supabase.from('inventory_batches').select('*', { count: 'exact', head: true }),
        supabase.from('stock_ledger').select('*', { count: 'exact', head: true }),
        supabase.from('physical_bills').select('*', { count: 'exact', head: true }),
        supabase.from('farmer_ledger').select('*', { count: 'exact', head: true }),
        supabase.from('financial_transactions').select('*', { count: 'exact', head: true }),
      ])

      if (isMounted.current) {
        setBeforeCounts({
          farmers: farmers.count || 0,
          sales_bills: sales.count || 0,
          sales_bill_items: sales_items.count || 0,
          payments: pays.count || 0,
          company_payments: cpays.count || 0,
          returns: ret.count || 0,
          purchase_bills: purch.count || 0,
          purchase_returns: prets.count || 0,
          inventory_batches: inv.count || 0,
          stock_ledger: stock.count || 0,
          physical_bills: pbills.count || 0,
          farmer_ledger: fledger.count || 0,
          financial_transactions: fintx.count || 0,
        })
      }
    } catch {
      toast.error('Failed to load record counts')
    } finally {
      if (isMounted.current) setLoadingCounts(false)
    }
  }

  useEffect(() => {
    if (role === 'admin') loadCounts()
  }, [role])

  const toggleConfirm = (idx: number) => {
    const next = [...confirms]
    next[idx] = !next[idx]
    setConfirms(next)
  }

  const allConfirmed = confirms.every((c) => c === true)
  const isTypedMatched = typedConfirm.trim() === REQUIRED_TYPED_CONFIRM
  const isReadyToReset = allConfirmed && password.trim().length > 0 && isTypedMatched

  const handleReset = async () => {
    if (!allConfirmed) return toast.error('कृपया सभी 5 confirmations चेक करें')
    if (!password.trim()) return toast.error('Admin password enter करें')
    if (!isTypedMatched) return toast.error(`कृपया ठीक "${REQUIRED_TYPED_CONFIRM}" टाइप करें`)
    if (!user?.email) return toast.error('User email नहीं मिला')

    setResetting(true)
    try {
      // 1. Re-verify password using Supabase Auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      })

      if (authErr) {
        toast.error('गलत Password! Reset रद्द कर दिया गया।')
        setResetting(false)
        return
      }

      // 2. Call server-side atomic RPC
      const { data, error: rpcErr } = await supabase.rpc('reset_business_data', {
        p_confirmation_code: 'RESET-CONFIRM-SATGURU',
        p_reset_type: resetType,
      })

      if (rpcErr) {
        console.error('Reset RPC Failed Details:', JSON.stringify(rpcErr, null, 2))
        throw new Error(rpcErr.message || rpcErr.details || 'Reset RPC call failed.')
      }

      toast.success('डेटा और बिल नंबर सीरीज सफलतापूर्वक 0001 से रिसेट हो गए!', { duration: 6000 })

      if (isMounted.current) {
        setCompleted(true)
        setResetSummary(data as unknown as ResetSummary)
        setPassword('')
        setTypedConfirm('')
        setConfirms([false, false, false, false, false])
      }

      await loadCounts()
    } catch (err: unknown) {
      console.error('Full Error:', err)
      const msg = err instanceof Error ? err.message : 'Reset failed'
      toast.error('Error: ' + msg, { duration: 8000 })
    } finally {
      if (isMounted.current) setResetting(false)
    }
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center mt-10">
        <ShieldAlert className="inline-block text-red-600 mb-2" size={40} />
        <h1 className="text-lg font-bold text-red-700">Access Denied: Admin Only Feature</h1>
      </div>
    )
  }

  const totalTx = beforeCounts
    ? Object.values(beforeCounts).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-rose-900 via-red-900 to-amber-950 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trash2 className="text-amber-400" size={28} /> Data & Sequence Reset Tool
            </h1>
            <p className="text-red-200 text-xs mt-1 flex items-center gap-1">
              <AlertTriangle size={14} className="text-amber-400" />
              ट्रांजैक्शन डेटा डिलीट + सभी बिल नंबर/Farmer ID 0001 से रीस्टार्ट
            </p>
          </div>
          <button
            onClick={loadCounts}
            disabled={loadingCounts || resetting}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs flex items-center gap-1 transition-all"
            title="Refresh Counts"
          >
            <RefreshCw size={14} className={loadingCounts ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Completion Banner ── */}
      {completed && (
        <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-2xl text-emerald-900 space-y-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
            डेटा और बिल नंबर सीरीज सफलतापूर्वक 0001 से रीसेट!
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed">
            नया Sales Bill <code className="bg-emerald-100 px-1 rounded">SALES-...-0001</code>,
            Purchase <code className="bg-emerald-100 px-1 rounded">PUR-...-0001</code>,
            Payment <code className="bg-emerald-100 px-1 rounded">PAY-...-0001</code>,
            Farmer ID <code className="bg-emerald-100 px-1 rounded">SBB-0001</code> से शुरू होगा।
          </p>
          {resetSummary && resetSummary.before_counts && (
            <details className="text-[11px] outline-none">
              <summary className="cursor-pointer text-emerald-800 font-semibold">
                📊 डिलीट किए गए रिकॉर्ड्स का विवरण देखें (Old Counts)
              </summary>
              <pre className="mt-2 bg-emerald-100/60 p-3 rounded-xl overflow-x-auto text-[10px] border border-emerald-200">
                {JSON.stringify(resetSummary.before_counts, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Live Counts ── */}
      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-3">
        <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center justify-between">
          <span>वर्तमान डेटा (Records in Database)</span>
          {beforeCounts && (
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Total Found: {totalTx} records
            </span>
          )}
        </h3>

        {loadingCounts ? (
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2 py-10 bg-slate-50 rounded-xl">
            <Loader2 className="animate-spin text-rose-500" size={18} /> डेटा गिना जा रहा है...
          </p>
        ) : beforeCounts ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <CountCard label="Farmers" count={beforeCounts.farmers} />
            <CountCard label="Sales Bills" count={beforeCounts.sales_bills} />
            <CountCard label="Physical Bills" count={beforeCounts.physical_bills} />
            <CountCard label="Payments" count={beforeCounts.payments} />
            <CountCard label="Financial Tx" count={beforeCounts.financial_transactions} />
            <CountCard label="Farmer Ledger" count={beforeCounts.farmer_ledger} />
            <CountCard label="Stock Ledger" count={beforeCounts.stock_ledger} />
            <CountCard label="Inventory Batches" count={beforeCounts.inventory_batches} />
            <CountCard label="Purchase Bills" count={beforeCounts.purchase_bills} />
            <CountCard label="Company Payments" count={beforeCounts.company_payments} />
            <CountCard label="Returns" count={beforeCounts.returns} />
            <CountCard label="Purchase Returns" count={beforeCounts.purchase_returns} />
          </div>
        ) : null}
      </div>

      {/* ── Numbering Guarantee ── */}
      <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl text-xs space-y-1.5 text-amber-900">
        <div className="font-bold flex items-center gap-1.5 text-amber-950">
          <Hash size={14} className="text-amber-700" /> Reset के बाद Numbering Sequences:
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1 list-disc pl-4 text-[11px] text-amber-800">
          <li>Sales: <code className="font-bold">SALES-...-0001</code></li>
          <li>Physical: <code className="font-bold">EST/GST-...-0001</code></li>
          <li>Purchase: <code className="font-bold">PUR-...-0001</code></li>
          <li>Farmer Pay: <code className="font-bold">PAY-...-0001</code></li>
          <li>Company Pay: <code className="font-bold">CPAY-...-0001</code></li>
          <li>Farmer ID: <code className="font-bold">FAR-0001</code></li>
        </ul>
      </div>

      {/* ── Reset Type ── */}
      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-3">
        <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider">Reset Mode</h3>
        <label
          className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            resetType === 'transaction'
              ? 'border-amber-500 bg-amber-50/50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-2">
            <input
              type="radio"
              checked={resetType === 'transaction'}
              onChange={() => setResetType('transaction')}
              className="mt-0.5 w-4 h-4 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <b className="text-xs text-gray-900">Reset Transaction Data (Recommended)</b>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Farmers, Sales, Physical Bills, Payments, Ledger, Returns, Stock डिलीट। <br/>
                Products, Companies, Categories, Units सुरक्षित रहेंगे।
              </p>
            </div>
          </div>
        </label>

        <label
          className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            resetType === 'full'
              ? 'border-rose-600 bg-rose-50/50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-2">
            <input
              type="radio"
              checked={resetType === 'full'}
              onChange={() => setResetType('full')}
              className="mt-0.5 w-4 h-4 text-rose-600 focus:ring-rose-500"
            />
            <div>
              <b className="text-xs text-rose-800">Full Business Reset (Extremely Dangerous)</b>
              <p className="text-[11px] text-gray-600 mt-0.5">
                ऊपर वाले सभी + Products + Companies भी डिलीट हो जाएंगे।
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* ── 5 Confirmations ── */}
      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-3">
        <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
          पाँच Confirmations (सभी अनिवार्य)
        </h3>
        {CONFIRMATION_STEPS.map((text, idx) => (
          <label
            key={idx}
            className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              confirms[idx]
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <input
              type="checkbox"
              checked={confirms[idx]}
              onChange={() => toggleConfirm(idx)}
              className="mt-0.5 w-4 h-4 shrink-0 rounded text-emerald-600 focus:ring-emerald-500"
              disabled={resetting}
            />
            <span className="text-xs text-gray-800 font-medium leading-relaxed">
              <b className={confirms[idx] ? 'text-emerald-700' : 'text-gray-500'}>
                Step {idx + 1}:
              </b> {text}
            </span>
          </label>
        ))}
      </div>

      {/* ── Password & Typed Authorization ── */}
      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <KeyRound size={14} /> Admin Password (Supabase Auth verify) <span className="text-rose-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={resetting}
            placeholder="अपना Admin Password दर्ज करें"
            className="w-full p-3 border border-gray-300 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14} /> ऑथराइजेशन कोड टाइप करें <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={typedConfirm}
            onChange={(e) => setTypedConfirm(e.target.value)}
            disabled={resetting}
            placeholder="DELETE MY DATA"
            className={`w-full p-3 border rounded-xl font-mono text-sm font-bold uppercase tracking-wider outline-none transition-all ${
              isTypedMatched
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 focus:ring-2 focus:ring-emerald-500'
                : 'border-rose-300 bg-rose-50 focus:ring-2 focus:ring-rose-500'
            }`}
          />
          <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
            <Lock size={10} /> ठीक <strong>DELETE MY DATA</strong> टाइप करें।
          </p>
        </div>
      </div>

      {/* ── Final Reset Button ── */}
      <button
        type="button"
        onClick={handleReset}
        disabled={!isReadyToReset || resetting || authLoading}
        className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-black rounded-2xl text-base shadow-xl transition-all flex items-center justify-center gap-2"
      >
        {resetting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Database Format किया जा रहा है...
          </>
        ) : (
          <>
            <Trash2 size={18} />
            {resetType === 'full'
              ? 'FULL RESET करें (0001 से शुरू)'
              : 'TRANSACTION RESET करें (0001 से शुरू)'}
          </>
        )}
      </button>

      <p className="text-[11px] text-gray-400 text-center leading-relaxed px-4 pb-10">
        * Server-side PostgreSQL RPC `TRUNCATE CASCADE` द्वारा atomic execute। सभी tables, counters और sequences एक साथ 0 पर reset होंगे।
      </p>
    </div>
  )
}

// Small sub-component for cleanly showing the counts
function CountCard({ label, count }: { label: string; count: number }) {
  const isHigh = count > 0
  return (
    <div className={`p-3 border rounded-xl transition-all ${isHigh ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
      <span className="text-gray-500 block text-[9px] uppercase font-semibold mb-0.5">{label}</span>
      <b className={`text-base font-mono ${isHigh ? 'text-rose-700' : 'text-emerald-700'}`}>
        {count.toLocaleString('en-IN')}
      </b>
    </div>
  )
}