// File: src/components/TableCounts.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { supabase } from '../../lib/supabase'
import { Table2, Play, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────
   Type Definitions & Config
   ────────────────────────────────────────────── */

const TABLES = [
  'farmers',
  'companies',
  'products',
  'inventory_batches',
  'sales_bills',
  'payments',
  'purchase_bills',
  'farmer_groups',
  'audit_logs',
  'notifications',
] as const

export interface TableCountItem {
  readonly table: string
  count: number | null
  error: string | null
  status: 'idle' | 'counting' | 'success' | 'failed'
}

const REFRESH_COOLDOWN_MS = 1500

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const TableCounts: FC = () => {
  const [rows, setRows] = useState<TableCountItem[]>(() =>
    TABLES.map((t) => ({ table: t, count: null, error: null, status: 'idle' }))
  )
  const [running, setRunning] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)
  const abortRef = useRef<AbortController | null>(null)
  const cooldownRef = useRef<boolean>(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  /**
   * Runs count requests for all tables concurrently (Parallel Execution)
   */
  const runCounts = useCallback(async () => {
    if (running) return

    if (cooldownRef.current) {
      toast('Please wait a moment before counting again.', { icon: '⏳' })
      return
    }

    // Cancel any previous active counting processes
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setRunning(true)
    cooldownRef.current = true

    // Cooldown reset
    setTimeout(() => {
      cooldownRef.current = false
    }, REFRESH_COOLDOWN_MS)

    // Set all tables to counting status
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: 'counting', error: null }))
    )

    try {
      // Execute all head-queries in parallel
      const promises = TABLES.map(async (tableName): Promise<TableCountItem> => {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .abortSignal(controller.signal)

          if (error) {
            // Handle standard Supabase database / RLS error responses
            let displayError = 'Error'
            if (error.code === '42501') {
              displayError = 'Restricted (RLS)'
            } else if (error.message) {
              displayError = error.message.includes('policy')
                ? 'Restricted (RLS)'
                : 'Failed'
            }
            return { table: tableName, count: null, error: displayError, status: 'failed' }
          }

          return {
            table: tableName,
            count: count ?? 0,
            error: null,
            status: 'success',
          }
        } catch (err: unknown) {
          const isAbort = err instanceof DOMException && err.name === 'AbortError'
          return {
            table: tableName,
            count: null,
            error: isAbort ? null : 'Network Fail',
            status: isAbort ? 'idle' : 'failed',
          }
        }
      })

      const results = await Promise.all(promises)

      if (!isMounted.current || controller.signal.aborted) return

      setRows(results)

      const totalFailed = results.filter((r) => r.status === 'failed').length
      if (totalFailed > 0) {
        toast.error(`Completed. ${totalFailed} table(s) returned access errors.`)
      } else {
        toast.success('All table counts loaded successfully!')
      }
    } catch (globalErr: unknown) {
      if (isMounted.current && !controller.signal.aborted) {
        const msg = globalErr instanceof Error ? globalErr.message : 'Failed to query database.'
        toast.error(msg)
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setRunning(false)
      }
    }
  }, [running])

  return (
    <section
      className="max-w-lg mx-auto space-y-6 px-4 py-2 sm:px-0"
      aria-labelledby="table-counts-heading"
    >
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1
          id="table-counts-heading"
          className="text-2xl font-bold flex items-center gap-2"
        >
          <Table2 className="text-amber-300" size={28} aria-hidden="true" />
          <span>Table Counts</span>
        </h1>
        <p className="text-emerald-200 text-xs mt-1 font-medium">
          Accurate counts using metadata-only SQL head-queries
        </p>
      </div>

      {/* ── Counting Widget Card ── */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-5">
        <button
          type="button"
          disabled={running}
          onClick={runCounts}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 outline-none"
          aria-label={running ? 'Counting table records' : 'Count main database tables'}
        >
          {running ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          {running ? 'Counting...' : 'Count Main Tables'}
        </button>

        {/* Live progress announcement for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          {running
            ? 'Running database table queries in parallel.'
            : 'Counting complete or ready.'}
        </div>

        {/* ── Table Items List ── */}
        <ul
          className="divide-y divide-slate-100 text-xs font-bold list-none p-0 m-0"
          aria-label="Database Tables List"
        >
          {rows.map((r) => {
            const isIdle = r.status === 'idle'
            const isCounting = r.status === 'counting'
            const isFailed = r.status === 'failed'

            return (
              <li
                key={r.table}
                className="py-3 flex justify-between items-center gap-4 hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
              >
                <span className="font-mono text-slate-700 tracking-tight">
                  {r.table}
                </span>

                <div className="flex items-center gap-1.5 font-mono">
                  {isCounting ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Loader2 className="animate-spin" size={12} aria-hidden="true" />
                      counting…
                    </span>
                  ) : isFailed ? (
                    <span className="text-rose-600 flex items-center gap-1 text-[11px] bg-rose-50 px-2 py-0.5 rounded">
                      <AlertCircle size={10} aria-hidden="true" />
                      {r.error}
                    </span>
                  ) : isIdle ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className="text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded text-xs font-black">
                      {r.count?.toLocaleString('en-IN') ?? 0}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default TableCounts