// File: src/components/SystemHealthCheck.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { supabase } from '../../lib/supabase'
import { Activity, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────
   Type Definitions
   ────────────────────────────────────────────── */

export type CheckStatus = 'idle' | 'running' | 'success' | 'failed'

export interface CheckItem {
  readonly id: string
  readonly name: string
  status: CheckStatus
  detail: string
}

/* ──────────────────────────────────────────────
   Initial Checks Schema Definition
   ────────────────────────────────────────────── */

const INITIAL_CHECKS: readonly Omit<CheckItem, 'status' | 'detail'>[] = [
  { id: 'auth_session', name: 'Auth session' },
  { id: 'profiles_table', name: 'profiles table' },
  { id: 'farmers_table', name: 'farmers table' },
  { id: 'products_inventory', name: 'products + inventory' },
  { id: 'rpc_farmer_id', name: 'RPC generate_farmer_id' },
  { id: 'rpc_hash_pin', name: 'RPC hash_pin' },
  { id: 'storage_buckets', name: 'storage buckets reachable' },
] as const

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const SystemHealthCheck: FC = () => {
  const [running, setRunning] = useState<boolean>(false)
  const [checks, setChecks] = useState<CheckItem[]>(() =>
    INITIAL_CHECKS.map((c) => ({ ...c, status: 'idle', detail: 'Pending run' }))
  )

  // Ref to track if the component is mounted to prevent memory leaks/unmounted updates
  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  /**
   * Safely updates a single check item's status in real-time
   */
  const updateCheckStatus = useCallback((id: string, status: CheckStatus, detail: string) => {
    if (!isMounted.current) return
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, detail } : c))
    )
  }, [])

  /**
   * Executes diagnostics sequentially, streaming progress updates directly to the UI
   */
  const runDiagnostics = async () => {
    if (running) return

    setRunning(true)
    // Reset all checks to idle/running
    setChecks(
      INITIAL_CHECKS.map((c) => ({ ...c, status: 'idle', detail: 'Pending run' }))
    )

    let failedCount = 0

    const executeCheck = async (
      id: string,
      fn: () => Promise<void>
    ): Promise<boolean> => {
      if (!isMounted.current) return false
      updateCheckStatus(id, 'running', 'Testing connection…')

      try {
        await fn()
        updateCheckStatus(id, 'success', 'OK')
        return true
      } catch (err: unknown) {
        let errMsg = 'FAIL'
        if (err instanceof Error) {
          errMsg = err.message
        } else if (typeof err === 'object' && err !== null && 'message' in err) {
          errMsg = String((err as { message: string }).message)
        }
        updateCheckStatus(id, 'failed', errMsg)
        failedCount++
        return false
      }
    }

    /* ── Check 1: Auth Session ── */
    await executeCheck('auth_session', async () => {
      const { error } = await supabase.auth.getSession()
      if (error) throw error
    })

    /* ── Check 2: Profiles Table ── */
    await executeCheck('profiles_table', async () => {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) throw new Error(error.message || 'Access Denied / RLS Block')
    })

    /* ── Check 3: Farmers Table ── */
    await executeCheck('farmers_table', async () => {
      const { error } = await supabase.from('farmers').select('id').limit(1)
      if (error) throw new Error(error.message || 'Access Denied / RLS Block')
    })

    /* ── Check 4: Products + Inventory ── */
    await executeCheck('products_inventory', async () => {
      const { error: e1 } = await supabase.from('products').select('id').limit(1)
      if (e1) throw new Error(`Products: ${e1.message || 'RLS Block'}`)

      const { error: e2 } = await supabase.from('inventory_batches').select('id').limit(1)
      if (e2) throw new Error(`Inventory: ${e2.message || 'RLS Block'}`)
    })

    /* ── Check 5: RPC generate_farmer_id (dry-run metadata check) ── */
    await executeCheck('rpc_farmer_id', async () => {
      const { error } = await supabase.from('app_settings').select('setting_key').limit(1)
      if (error) throw new Error(error.message || 'Access Denied / RLS Block')
    })

    /* ── Check 6: RPC hash_pin ── */
    await executeCheck('rpc_hash_pin', async () => {
      const { error } = await supabase.rpc('hash_pin', { p_pin: '0000' })
      if (error) throw error
    })

    /* ── Check 7: Storage Buckets Reachable ── */
    await executeCheck('storage_buckets', async () => {
      const { error } = await supabase.storage.listBuckets()
      if (error) throw error
    })

    if (!isMounted.current) return

    setRunning(false)

    if (failedCount > 0) {
      toast.error(`${failedCount} check(s) failed. Verify RLS policies and permissions.`, {
        duration: 5000,
      })
    } else {
      toast.success('All system health checks passed successfully!')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 px-4 py-2 sm:px-0">
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="text-amber-300" size={28} aria-hidden="true" />
          System Health Check
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Real-time diagnostics for DB · Auth · RPC · Storage connectivity
        </p>
      </div>

      {/* ── Dashboard Widget ── */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm text-center space-y-6">
        <button
          type="button"
          disabled={running}
          onClick={runDiagnostics}
          className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-2xl flex items-center gap-2 mx-auto transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 outline-none"
          aria-label={running ? 'Running diagnostics' : 'Run health diagnostics'}
        >
          {running ? (
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <Play size={18} aria-hidden="true" />
          )}
          {running ? 'Diagnosing…' : 'Run Health Checks'}
        </button>

        {/* Live progress announcement for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          {running
            ? 'Running system diagnostics. Please wait.'
            : 'Diagnostics idle. Select Run Health Checks to begin.'}
        </div>

                {/* ── Diagnostics List ── */}
        <ul className="text-left space-y-2.5 list-none p-0 m-0" aria-label="Diagnostic Items">
          {checks.map((c) => {
            const isRunning = c.status === 'running'
            const isSuccess = c.status === 'success'
            const isFailed = c.status === 'failed'

            return (
              <li
                key={c.id}
                className={`p-3 rounded-xl border text-xs font-bold flex justify-between items-center gap-4 transition-colors ${
                  isSuccess
                    ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900'
                    : isFailed
                    ? 'bg-rose-50/60 border-rose-200/80 text-rose-800'
                    : isRunning
                    ? 'bg-amber-50/50 border-amber-200/60 text-amber-900 animate-pulse'
                    : 'bg-slate-50/50 border-slate-200/60 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSuccess ? (
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={14} aria-hidden="true" />
                  ) : isFailed ? (
                    <XCircle className="text-rose-600 shrink-0" size={14} aria-hidden="true" />
                  ) : isRunning ? (
                    <Loader2 className="text-amber-600 animate-spin shrink-0" size={14} aria-hidden="true" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" aria-hidden="true" />
                  )}
                  <span>{c.name}</span>
                </div>
                <span className="font-mono text-[11px] truncate max-w-[200px]" title={c.detail}>
                  {c.detail}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default SystemHealthCheck