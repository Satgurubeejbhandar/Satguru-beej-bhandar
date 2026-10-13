// File: src/components/UniquenessChecker.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { useState, useEffect, useRef, type FC, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Hash, Search, Loader2, CheckCircle2, AlertTriangle, History } from 'lucide-react'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────
   Type Definitions
   ────────────────────────────────────────────── */

export type CheckerState = 'idle' | 'checking' | 'available' | 'exists' | 'history_taken' | 'error'

export interface ValidationResult {
  state: CheckerState
  message: string
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const UniquenessChecker: FC = () => {
  const [sku, setSku] = useState<string>('')
  const [farmerId, setFarmerId] = useState<string>('')

  const [skuResult, setSkuResult] = useState<ValidationResult | null>(null)
  const [fidResult, setFidResult] = useState<ValidationResult | null>(null)

  const [skuLoading, setSkuLoading] = useState<boolean>(false)
  const [fidLoading, setFidLoading] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)
  const skuAbortRef = useRef<AbortController | null>(null)
  const fidAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (skuAbortRef.current) skuAbortRef.current.abort()
      if (fidAbortRef.current) fidAbortRef.current.abort()
    }
  }, [])

  /**
   * Evaluates if a Product SKU is unique
   */
  const checkSku = async (e: FormEvent) => {
    e.preventDefault()
    const cleanSku = sku.trim().toUpperCase()

    if (!cleanSku) {
      toast.error('Please enter a product SKU to check.')
      return
    }

    if (skuAbortRef.current) {
      skuAbortRef.current.abort()
    }
    const controller = new AbortController()
    skuAbortRef.current = controller

    setSkuLoading(true)
    setSkuResult(null)

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, sku')
        .eq('sku', cleanSku)
        .limit(1)
        .abortSignal(controller.signal)

      if (!isMounted.current || controller.signal.aborted) return

      if (error) {
        setSkuResult({
          state: 'error',
          message: error.message || 'Verification failed due to a database exception.',
        })
        toast.error(error.message)
        return
      }

      if (data && data.length > 0) {
        setSkuResult({
          state: 'exists',
          message: `SKU Taken: Currently assigned to "${data[0].product_name}"`,
        })
      } else {
        setSkuResult({
          state: 'available',
          message: 'SKU Available: Not currently used by any product.',
        })
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : 'System communication error'
        setSkuResult({ state: 'error', message: msg })
        toast.error(msg)
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setSkuLoading(false)
      }
    }
  }

  /**
   * Evaluates if a Farmer ID is unique, including a fallback history check
   */
  const checkFid = async (e: FormEvent) => {
    e.preventDefault()
    const cleanFid = farmerId.trim().toUpperCase()

    if (!cleanFid) {
      toast.error('Please enter a Farmer ID to check.')
      return
    }

    if (fidAbortRef.current) {
      fidAbortRef.current.abort()
    }
    const controller = new AbortController()
    fidAbortRef.current = controller

    setFidLoading(true)
    setFidResult(null)

    try {
      // 1st Step: Check against the active farmers table
      const { data, error } = await supabase
        .from('farmers')
        .select('id, farmer_name, farmer_id')
        .eq('farmer_id', cleanFid)
        .limit(1)
        .abortSignal(controller.signal)

      if (!isMounted.current || controller.signal.aborted) return

      if (error) {
        setFidResult({
          state: 'error',
          message: error.message || 'Lookup failed on farmers directory.',
        })
        toast.error(error.message)
        return
      }

      if (data && data.length > 0) {
        setFidResult({
          state: 'exists',
          message: `ID Taken: Active account exists for "${data[0].farmer_name}"`,
        })
        return
      }

      // 2nd Step: Check history log tables for retired/migrated IDs
      const { data: hist, error: histError } = await supabase
        .from('farmer_id_history')
        .select('old_farmer_id, new_farmer_id')
        .eq('old_farmer_id', cleanFid)
        .limit(1)
        .abortSignal(controller.signal)

      if (!isMounted.current || controller.signal.aborted) return

      if (histError) {
        setFidResult({
          state: 'error',
          message: `Partial Check: Not active, but history lookup failed (${histError.message})`,
        })
        return
      }

      if (hist && hist.length > 0) {
        setFidResult({
          state: 'history_taken',
          message: `ID Migrated: Formerly used by account. Active ID is now "${hist[0].new_farmer_id}"`,
        })
      } else {
        setFidResult({
          state: 'available',
          message: 'Farmer ID Available: Ready for registration.',
        })
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : 'System communication error'
        setFidResult({ state: 'error', message: msg })
        toast.error(msg)
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setFidLoading(false)
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 px-4 py-2 sm:px-0">
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Hash className="text-amber-300" size={28} aria-hidden="true" /> Uniqueness Checker
        </h1>
        <p className="text-emerald-200 text-xs mt-1 font-medium">
          Verify product SKU availability & active/historical Farmer IDs in real time
        </p>
      </div>

      {/* ── Section 1: SKU Validator Form ── */}
      <section aria-labelledby="sku-form-title">
        <form
          onSubmit={checkSku}
          className="bg-white p-5 rounded-3xl border shadow-sm space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="sku-input"
              id="sku-form-title"
              className="text-xs font-black text-slate-700 tracking-wide uppercase block"
            >
              Product SKU
            </label>
            <input
              id="sku-input"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={skuLoading}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              placeholder="E.g., SBB-INS-00001"
              aria-describedby="sku-live-feedback"
            />
          </div>

          <button
            type="submit"
            disabled={skuLoading}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase transition-colors shadow-sm"
          >
            {skuLoading ? (
              <Loader2 className="animate-spin" size={14} aria-hidden="true" />
            ) : (
              <Search size={14} aria-hidden="true" />
            )}
            {skuLoading ? 'Verifying SKU…' : 'Check SKU'}
          </button>

          {/* Accessible, Styled SKU Results Indicator */}
          <div
            id="sku-live-feedback"
            role="status"
            aria-live="polite"
            className="transition-all duration-200"
          >
            {skuResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-bold leading-relaxed ${
                  skuResult.state === 'available'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : skuResult.state === 'exists'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {skuResult.state === 'available' ? (
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={14} aria-hidden="true" />
                ) : (
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={14} aria-hidden="true" />
                )}
                <span>{skuResult.message}</span>
              </div>
            )}
          </div>
        </form>
      </section>

      {/* ── Section 2: Farmer ID Validator Form ── */}
      <section aria-labelledby="fid-form-title">
        <form
          onSubmit={checkFid}
          className="bg-white p-5 rounded-3xl border shadow-sm space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="fid-input"
              id="fid-form-title"
              className="text-xs font-black text-slate-700 tracking-wide uppercase block"
            >
              Farmer ID
            </label>
            <input
              id="fid-input"
              type="text"
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value.toUpperCase())}
              disabled={fidLoading}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              placeholder="E.g., SBB-001-01"
              aria-describedby="fid-live-feedback"
            />
          </div>

          <button
            type="submit"
            disabled={fidLoading}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase transition-colors shadow-sm"
          >
            {fidLoading ? (
              <Loader2 className="animate-spin" size={14} aria-hidden="true" />
            ) : (
              <Search size={14} aria-hidden="true" />
            )}
            {fidLoading ? 'Verifying ID…' : 'Check Farmer ID'}
          </button>

          {/* Accessible, Styled Farmer ID Results Indicator */}
          <div
            id="fid-live-feedback"
            role="status"
            aria-live="polite"
            className="transition-all duration-200"
          >
            {fidResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-bold leading-relaxed ${
                  fidResult.state === 'available'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : fidResult.state === 'exists'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : fidResult.state === 'history_taken'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {fidResult.state === 'available' ? (
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={14} aria-hidden="true" />
                ) : fidResult.state === 'history_taken' ? (
                  <History className="text-amber-600 shrink-0 mt-0.5" size={14} aria-hidden="true" />
                ) : (
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={14} aria-hidden="true" />
                )}
                <span>{fidResult.message}</span>
              </div>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}

export default UniquenessChecker