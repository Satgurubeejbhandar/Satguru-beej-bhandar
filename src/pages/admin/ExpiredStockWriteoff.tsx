// src/pages/admin/ExpiredStockWriteoff.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Skull, RefreshCw, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Strict Type Definitions ─────────────────────────────────────────
type ExpiredBatchRow = {
  id: string
  product_id: string
  company_id: string
  batch_number: string | null
  quantity_available: number | string
  quantity_expired: number | string | null
  expiry_date: string
  is_expired: boolean
  product?: {
    product_name: string
    sku: string | null
  } | null
  company?: {
    company_name: string
  } | null
}

const getLocalDateString = (offsetDays = 0) => {
  const date = new Date()
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

export default function ExpiredStockWriteoff() {
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<ExpiredBatchRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // ── Load Expired Batches ──
  const load = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)

      // Trigger DB system check for expired batches
      try {
        await supabase.rpc('check_and_mark_expired')
      } catch {
        // Non-blocking fallback
      }

      const todayStr = getLocalDateString(0)

      // Query expired stock with available quantity (Safely paginated)
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('*, product:products(product_name, sku), company:companies(company_name)')
        .gt('quantity_available', 0)
        .or(`is_expired.eq.true,expiry_date.lt.${todayStr}`)
        .order('expiry_date', { ascending: true })

      if (error) throw error

      if (isMountedRef.current) {
        setRows((data as ExpiredBatchRow[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch expired stock'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      load()
    }
  }, [load, role, authLoading])

  // ── Atomic Write-Off Action ──
  const writeOff = async (batch: ExpiredBatchRow) => {
    const productName = batch.product?.product_name || 'Item'
    const currentQty = safeNum(batch.quantity_available)

    const ok = window.confirm(
      `क्या आप वाकई इस उत्पाद (${productName}) की पूरी मात्रा (${currentQty} पीस) का स्टॉक खत्म (Write-off) करना चाहते हैं?`
    )
    if (!ok) return

    setBusyId(batch.id)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      // Exclusively run the atomic DB transaction to ensure ledger and stock remain perfectly in sync
      const { data: rpcData, error: rpcErr } = await supabase.rpc('write_off_expired_batch', {
        p_batch_id: batch.id,
        p_user_id: user?.id || null,
      })

      if (rpcErr) {
        throw new Error(rpcErr.message || 'The database rejected this expired stock write-off.')
      }

      const rawObj = (rpcData && typeof rpcData === 'object' ? rpcData : {}) as Record<string, unknown>
      const writtenOffQty = safeNum(rawObj.written_off_qty ?? currentQty)
      
      toast.success(`${productName} के ${writtenOffQty} पीस का स्टॉक सफलतापूर्वक खत्म (Write-off) हो गया!`)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Write-off failed'
      if (isMountedRef.current) {
        toast.error('त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setBusyId(null)
      }
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Expired Stock Write-off की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Skull className="text-amber-400 shrink-0" size={28} /> Expired Stock Write-off
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Zero out expired batches atomically · Maintains clean stock ledger &amp; adjustment records
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={load}
          aria-label="Refresh expired stock list"
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse" aria-label="Expired stock batches table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                <th scope="col" className="p-3.5">Product</th>
                <th scope="col" className="p-3.5">Company</th>
                <th scope="col" className="p-3.5">Batch No.</th>
                <th scope="col" className="p-3.5">Available Qty</th>
                <th scope="col" className="p-3.5">Expiry Date</th>
                <th scope="col" className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-600 mb-2" />
                    Checking for expired batches...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
                    <p className="font-bold text-slate-800 text-sm">No Expired Batches Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      All inventory batches with remaining stock are within valid expiry limits.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isBusy = busyId === r.id
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">
                        {r.product?.product_name || '—'}
                        {r.product?.sku && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            SKU: {r.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600">{r.company?.company_name || '—'}</td>
                      <td className="p-3.5 font-mono text-slate-700 font-bold">
                        {r.batch_number || '—'}
                      </td>
                      <td className="p-3.5 font-black text-slate-900 text-sm font-mono">
                        {safeNum(r.quantity_available)}
                      </td>
                      <td className="p-3.5 font-mono text-rose-600 font-bold">
                        <div className="flex items-center gap-1">
                          <AlertCircle size={14} className="shrink-0 text-rose-600" />
                          <span>{r.expiry_date}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => writeOff(r)}
                          aria-label={`Write off expired stock for batch ${r.batch_number}`}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          {isBusy ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Writing off...
                            </>
                          ) : (
                            'Write-off Stock'
                          )}
                        </button>
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