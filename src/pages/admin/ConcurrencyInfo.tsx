import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldCheck,
  Lock,
  Database,
  Copy,
  Check,
  Terminal,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── POSTGRESQL STORED PROCEDURE TEMPLATE (VERIFY YOUR SCHEMA BEFORE RUNNING) ───────────
const DEDUCT_STOCK_SQL = `-- =========================================================
-- SECURE STOCK DEDUCTION WITH PESSIMISTIC LOCKING
-- Prevents Negative Inventory & Race Conditions in Concurrent Sales
-- =========================================================

CREATE OR REPLACE FUNCTION public.deduct_stock(
  p_batch_id UUID,
  p_quantity NUMERIC,
  p_reference_type VARCHAR DEFAULT 'sales_bill',
  p_reference_id UUID DEFAULT NULL,
  p_reference_number VARCHAR DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated DB privilege
SET search_path = public
AS $$
DECLARE
  v_available_qty NUMERIC;
  v_expiry_date DATE;
  v_is_expired BOOLEAN;
  v_product_id UUID;
  v_company_id UUID;
  v_new_qty NUMERIC;
BEGIN
  -- Reject invalid quantities before touching inventory.
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY');
  END IF;

  -- 1. PESSIMISTIC ROW-LEVEL LOCK (Blocks concurrent transactions on this batch)
  SELECT 
    quantity_available, 
    expiry_date, 
    COALESCE(is_expired, FALSE), 
    product_id,
    company_id
  INTO 
    v_available_qty, 
    v_expiry_date, 
    v_is_expired, 
    v_product_id,
    v_company_id
  FROM public.inventory_batches
  WHERE id = p_batch_id
  FOR UPDATE; -- <--- CRITICAL: Exclusive lock until transaction commits

  -- 2. VALIDATION CHECKS
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'BATCH_NOT_FOUND');
  END IF;

  IF v_is_expired OR (v_expiry_date IS NOT NULL AND v_expiry_date <= CURRENT_DATE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BATCH_EXPIRED');
  END IF;

  IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INSUFFICIENT_STOCK',
      'available', v_available_qty,
      'requested', p_quantity
    );
  END IF;

  v_new_qty := v_available_qty - p_quantity;

  -- 3. ATOMIC DEDUCTION
  UPDATE public.inventory_batches
  SET 
    quantity_available = v_new_qty,
    quantity_sold = COALESCE(quantity_sold, 0) + p_quantity,
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- 4. IMMUTABLE AUDIT LOG ENTRY (STOCK LEDGER)
  INSERT INTO public.stock_ledger (
    product_id,
    company_id,
    batch_id,
    movement_type,
    quantity_in,
    quantity_out,
    balance_after,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by,
    created_at
  ) VALUES (
    v_product_id,
    v_company_id,
    p_batch_id,
    'SALE',
    0,
    p_quantity,
    v_new_qty,
    p_reference_type,
    p_reference_id,
    p_reference_number,
    'Automated POS Stock Deduct',
    p_user_id,
    NOW()
  );

  -- 5. RETURN SUCCESS
  RETURN jsonb_build_object(
    'success', true,
    'deducted_quantity', p_quantity,
    'remaining_stock', v_new_qty
  );
END;
$$;

-- Restrict RPC execution to signed-in Supabase users.
-- Add a stricter role/ownership check inside the function if only admins may sell.
REVOKE ALL ON FUNCTION public.deduct_stock(UUID, NUMERIC, VARCHAR, UUID, VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_stock(UUID, NUMERIC, VARCHAR, UUID, VARCHAR, UUID) TO authenticated;`

export default function ConcurrencyInfo() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'simulator' | 'sql'>('pipeline')

  // Simulator State
  const [simStock, setSimStock] = useState(10)
  const [admin1Status, setAdmin1Status] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [admin2Status, setAdmin2Status] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [simLog, setSimLog] = useState<string[]>([])

  const isMountedRef = useRef(true)
  const simTimersRef = useRef<number[]>([])

  // Clear pending simulation timers safely
  const clearSimTimers = useCallback(() => {
    simTimersRef.current.forEach((t) => clearTimeout(t))
    simTimersRef.current = []
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearSimTimers()
    }
  }, [clearSimTimers])

  // Copy SQL handler with safe fallback
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(DEDUCT_STOCK_SQL)
        if (isMountedRef.current) {
          setCopied(true)
          toast.success('PostgreSQL RPC SQL copied to clipboard!')
          setTimeout(() => {
            if (isMountedRef.current) setCopied(false)
          }, 2000)
        }
      } else {
        throw new Error('Clipboard API not supported in this context')
      }
    } catch {
      toast.error('Could not auto-copy. Please select and copy manually.')
    }
  }

  // Reset Simulation State
  const resetSimulation = useCallback(() => {
    clearSimTimers()
    if (isMountedRef.current) {
      setSimStock(10)
      setAdmin1Status('idle')
      setAdmin2Status('idle')
      setSimLog([])
    }
  }, [clearSimTimers])

  // Interactive Concurrency Simulation with Timer Protection
  const runSimulation = () => {
    clearSimTimers()
    setSimStock(10)
    setAdmin1Status('running')
    setAdmin2Status('running')
    setSimLog(['[00ms] DEMO ONLY: two simulated requests attempt to sell 10 units from an initial stock of 10.'])

    if (!isMountedRef.current) return

    // Timer 1: Request A acquires lock
    const t1 = window.setTimeout(() => {
      if (!isMountedRef.current) return
      setSimLog((prev) => [
        ...prev,
        '[15ms] Request A obtains the batch row lock (SELECT ... FOR UPDATE).',
        '[25ms] Request B waits in database queue for Lock release...',
      ])
    }, 400)

    // Timer 2: Request A completes transaction
    const t2 = window.setTimeout(() => {
      if (!isMountedRef.current) return
      setSimStock(0)
      setAdmin1Status('success')
      setSimLog((prev) => [
        ...prev,
        '[45ms] Simulated Request A deducts 10 units. Stock is now 0. Simulated ledger entry written; lock released.',
      ])
    }, 1000)

    // Timer 3: Request B executes & fails safely
    const t3 = window.setTimeout(() => {
      if (!isMountedRef.current) return
      setAdmin2Status('failed')
      setSimLog((prev) => [
        ...prev,
        '[55ms] Simulated Request B acquires lock -> available: 0 -> requested: 10.',
        '[60ms] ❌ Request B REJECTED: "INSUFFICIENT_STOCK" (Negative stock prevented!)',
      ])
    }, 1600)

    simTimersRef.current.push(t1, t2, t3)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* ── Header Banner ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-700/50 text-amber-300 text-[11px] font-bold mb-3">
            <Lock size={12} /> Database Integrity Architecture
          </div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-amber-400 shrink-0" size={28} />
            Stock Concurrency &amp; Race-Condition Defense
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Database-side locking pattern to prevent negative stock. The simulator below is illustrative only.
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            clearSimTimers()
            setActiveTab('pipeline')
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'bg-emerald-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Transaction Pipeline
        </button>
        <button
          type="button"
          onClick={() => {
            clearSimTimers()
            setActiveTab('simulator')
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-emerald-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Live Race Simulator
        </button>
        <button
          type="button"
          onClick={() => {
            clearSimTimers()
            setActiveTab('sql')
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'sql'
              ? 'bg-emerald-900 text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          PostgreSQL RPC Definition
        </button>
      </div>

      {/* ── TAB 1: TRANSACTION PIPELINE ── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Step 1 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  STEP 01
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-2 flex items-center gap-1.5">
                  <Lock size={15} className="text-emerald-700" /> Row Lock
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Queries batch row with <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">FOR UPDATE</code>. Other concurrent queries pause.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-emerald-800 font-bold">
                Pessimistic Lock
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  STEP 02
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-2 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-blue-700" /> Guard Checks
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Verifies available quantity, expiry date, and blocked status inside locked context.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-blue-800 font-bold">
                3-Layer Validation
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  STEP 03
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-2 flex items-center gap-1.5">
                  <Database size={15} className="text-purple-700" /> Stock Deduct
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Batch inventory quantity is decremented atomically in the current transaction.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-purple-800 font-bold">
                Atomic Mutation
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  STEP 04
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-2 flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-700" /> Ledger Audit
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Writes immutable audit row in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">stock_ledger</code> before committing transaction.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-emerald-800 font-bold">
                Immutable Ledger
              </div>
            </div>
          </div>

          <div className="bg-emerald-950 text-white p-5 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Why frontend-only stock deduction is dangerous:</p>
              <p className="text-emerald-200 leading-relaxed">
                If two billing counters fetch stock at the same millisecond, both will read 10 units. Without <code className="text-amber-300 font-mono">FOR UPDATE</code> on PostgreSQL, both would succeed, leaving stock at <strong>-10</strong> and causing physical inventory mismatch and GST compliance violations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE RACE SIMULATOR ── */}
      {activeTab === 'simulator' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Simultaneous Sale Simulation</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Demo only: two simulated counters each request 10 units from an initial stock of 10. This does not connect to or test your live database.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runSimulation}
                disabled={admin1Status === 'running' || admin2Status === 'running'}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow"
              >
                <Play size={14} /> Run Race Test
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                disabled={admin1Status === 'running' || admin2Status === 'running'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Live Inventory Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Batch Stock
              </span>
              <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{simStock} Units</p>
            </div>

            {/* Counter 1 */}
            <div className={`p-4 border rounded-2xl transition-all ${
              admin1Status === 'success' ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                <span>Counter 1 (Admin A)</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded">Wants 10 units</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {admin1Status === 'idle' && <span className="text-xs text-slate-400 font-medium">Ready</span>}
                {admin1Status === 'running' && <span className="text-xs text-amber-600 font-bold animate-pulse">Acquiring Lock...</span>}
                {admin1Status === 'success' && (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 size={14} /> Bill Finalized (10 Sold)
                  </span>
                )}
              </div>
            </div>

            {/* Counter 2 */}
            <div className={`p-4 border rounded-2xl transition-all ${
              admin2Status === 'failed' ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                <span>Counter 2 (Admin B)</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded">Wants 10 units</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {admin2Status === 'idle' && <span className="text-xs text-slate-400 font-medium">Ready</span>}
                {admin2Status === 'running' && <span className="text-xs text-amber-600 font-bold animate-pulse">Waiting for Lock...</span>}
                {admin2Status === 'failed' && (
                  <span className="text-xs text-red-600 font-bold flex items-center gap-1">
                    <XCircle size={14} /> Blocked: Insufficient Stock
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Terminal Log */}
          <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-xs space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-400 text-[11px]">
              <Terminal size={13} />
              <span>Simulated Lock Log (not live PostgreSQL output)</span>
            </div>
            {simLog.length === 0 ? (
              <p className="text-slate-600 italic py-2">Click "Run Race Test" to simulate concurrent transactions...</p>
            ) : (
              simLog.map((log, index) => (
                <p key={index} className={log.includes('❌') ? 'text-red-400 font-bold' : log.includes('Lock') ? 'text-amber-300' : 'text-emerald-300'}>
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: SQL DEFINITION ── */}
      {activeTab === 'sql' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Terminal className="text-amber-400" size={16} />
              <span className="font-mono text-xs font-bold">deduct_stock.sql (PostgreSQL RPC)</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-slate-700"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
            </button>
          </div>
          <div className="px-5 pt-4 text-xs text-amber-800 bg-amber-50">
            Review table columns, constraints, RLS, and existing RPC callers before running this SQL in production. The simulator is not a live database test.
          </div>
          <pre className="p-5 text-[11px] font-mono leading-relaxed bg-slate-950 text-emerald-300 overflow-x-auto max-h-[480px]">
            <code>{DEDUCT_STOCK_SQL}</code>
          </pre>
        </div>
      )}
    </div>
  )
}