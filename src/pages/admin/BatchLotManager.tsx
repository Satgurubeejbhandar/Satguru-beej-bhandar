// src/pages/admin/BatchLotManager.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Layers, RefreshCw, Loader2, AlertTriangle, X, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  product_name: string
  sku: string
}

interface Company {
  company_name: string
}

interface Batch {
  id: string
  product_id: string
  company_id: string
  batch_number: string
  lot_number: string
  quantity_available: number
  purchase_rate: number
  selling_rate: number
  expiry_date: string
  is_expired?: boolean
  product?: Product | null
  company?: Company | null
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

export default function BatchLotManager() {
  const { role, loading: authLoading } = useAuth()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [expiryRunning, setExpiryRunning] = useState<boolean>(false)

  const [adjustModal, setAdjustModal] = useState<boolean>(false)
  const [targetBatch, setTargetBatch] = useState<Batch | null>(null)
  const [adjType, setAdjType] = useState<string>('damage')
  const [adjQty, setAdjQty] = useState<string>('1')
  const [adjReason, setAdjReason] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)

  // Paginated Batch Fetcher to bypass 1,000-row truncation
  const loadBatches = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)
      const all: Batch[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore && isMounted.current) {
        const { data, error } = await supabase
          .from('inventory_batches')
          .select('*, product:products(product_name, sku), company:companies(company_name)')
          .gt('quantity_available', 0)
          .order('expiry_date', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!isMounted.current) return

        if (data && data.length > 0) {
          all.push(...(data as Batch[]))
        }

        hasMore = (data?.length ?? 0) === pageSize
        from += pageSize
      }

      if (isMounted.current) {
        setBatches(all)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batches लोड करने में समस्या आई'
      if (isMounted.current) {
        toast.error('Batches load error: ' + msg)
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
      loadBatches()
    }

    return () => {
      isMounted.current = false
    }
  }, [loadBatches, role, authLoading])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAdjustModal(false)
    }
    if (adjustModal) {
      window.addEventListener('keydown', handleEsc)
    }
    return () => window.removeEventListener('keydown', handleEsc)
  }, [adjustModal])

  const getDaysUntilExpiry = (dateStr: string): number => {
    if (!dateStr) return 999
    const exp = new Date(dateStr)
    if (Number.isNaN(exp.getTime())) return 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    exp.setHours(0, 0, 0, 0)
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryColor = (dateStr: string) => {
    const daysLeft = getDaysUntilExpiry(dateStr)
    if (daysLeft <= 0) return 'text-rose-700 font-black bg-rose-50 px-1.5 py-0.5 rounded'
    if (daysLeft <= 30) return 'text-rose-600 font-black'
    if (daysLeft <= 90) return 'text-amber-600 font-bold'
    return 'text-gray-700 font-mono'
  }

  const getExpiryLabel = (dateStr: string) => {
    const daysLeft = getDaysUntilExpiry(dateStr)
    if (daysLeft <= 0) return ' ⚠ EXPIRED'
    if (daysLeft <= 30) return ` (${daysLeft}d)`
    return ''
  }

  const handleRunExpiryCheck = async () => {
    try {
      setExpiryRunning(true)
      const { data, error } = await supabase.rpc('check_and_mark_expired')

      if (error) throw error
      toast.success(`Expiry Engine Done! ${data || 0} batches marked expired.`)
      await loadBatches()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Expiry check में समस्या आई'
      if (isMounted.current) {
        toast.error('Expiry check failed: ' + msg)
      }
    } finally {
      if (isMounted.current) {
        setExpiryRunning(false)
      }
    }
  }

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetBatch) return

    const qty = parseInt(adjQty, 10)
    const currentAvail = safeNum(targetBatch.quantity_available)

    if (isNaN(qty) || qty <= 0) {
      toast.error('कृपया सही मात्रा डालें (1 या अधिक)')
      return
    }
    if (qty > currentAvail) {
      toast.error('एडजस्टमेंट मात्रा उपलब्ध स्टॉक से अधिक नहीं हो सकती!')
      return
    }
    if (!adjReason.trim()) {
      toast.error('कारण (Reason) लिखना ज़रूरी है')
      return
    }

    setSaving(true)

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('User authentication check failed')

      // ATOMIC TRANSACTION VIA DATABASE RPC ONLY: Prevents partial updates or untracked stock losses
      const { error: rpcErr } = await supabase.rpc('adjust_batch_stock', {
        p_batch_id: targetBatch.id,
        p_deduct_qty: qty,
        p_adjustment_type: adjType,
        p_reason: adjReason.trim(),
        p_user_id: user.id,
      })

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Database rejected stock adjustment.')
      }

      toast.success('स्टॉक एडजस्टमेंट सफलतापूर्वक हो गया!')
      if (isMounted.current) {
        setAdjustModal(false)
        setAdjQty('1')
        setAdjReason('')
        setAdjType('damage')
        setTargetBatch(null)
      }
      await loadBatches()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'एडजस्टमेंट में समस्या आई'
      if (isMounted.current) {
        toast.error(msg)
      }
    } finally {
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  const openAdjust = (b: Batch) => {
    setTargetBatch(b)
    setAdjQty('1')
    setAdjReason('')
    setAdjType('damage')
    setAdjustModal(true)
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Batch &amp; FEFO Management की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="text-amber-400" size={28} /> Batch, Lot &amp; FEFO Management
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            First Expiry First Out (FEFO) ऑटो-सिलेक्शन व स्टॉक एडजस्टमेंट
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunExpiryCheck}
          disabled={expiryRunning}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition-all shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={expiryRunning ? 'animate-spin' : ''} />
          {expiryRunning ? 'Running...' : 'Run Auto Expiry Check'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]" aria-label="Inventory Batches Table">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5">Product</th>
                <th scope="col" className="p-3.5">Company</th>
                <th scope="col" className="p-3.5">Batch / Lot</th>
                <th scope="col" className="p-3.5 text-center">Qty</th>
                <th scope="col" className="p-3.5 text-right">Purchase Rate</th>
                <th scope="col" className="p-3.5 text-right">Selling Rate</th>
                <th scope="col" className="p-3.5">Expiry Date</th>
                <th scope="col" className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500 font-medium">
                    <Loader2 className="animate-spin inline-block mr-2 text-emerald-700" size={16} />
                    Batches Loading...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500 font-medium">
                    No active batches found.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-gray-900">
                      {b.product?.product_name || '—'}
                      <span className="block text-[10px] text-gray-400 font-mono">
                        {b.product?.sku || ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-emerald-900 font-bold">
                      {b.company?.company_name || '—'}
                    </td>
                    <td className="p-3.5 font-mono text-gray-700">
                      B: {b.batch_number || '—'} | L: {b.lot_number || '—'}
                    </td>
                    <td className="p-3.5 font-black text-sm text-gray-900 text-center font-mono">
                      {b.quantity_available}
                    </td>
                    <td className="p-3.5 font-bold text-gray-700 text-right font-mono">
                      ₹{formatINR(b.purchase_rate)}
                    </td>
                    <td className="p-3.5 font-black text-emerald-900 text-right font-mono">
                      ₹{formatINR(b.selling_rate)}
                    </td>
                    <td className={`p-3.5 ${getExpiryColor(b.expiry_date)}`}>
                      {b.expiry_date || '—'}
                      <span className="text-[10px]">{getExpiryLabel(b.expiry_date)}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => openAdjust(b)}
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-700 font-bold border border-rose-200 rounded-lg hover:bg-rose-100 active:scale-95 transition-all text-[11px] cursor-pointer shadow-xs"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adjustModal && targetBatch && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdjustModal(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-modal-title"
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setAdjustModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-2">
              <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 id="adjust-modal-title" className="font-bold text-lg text-emerald-900">Stock Adjustment</h3>
                <p className="text-xs text-gray-600 font-medium">
                  {targetBatch.product?.product_name} · Batch: {targetBatch.batch_number} · Available: {targetBatch.quantity_available}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason / Type</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={saving}
                >
                  <option value="damage">Physical Damage (खराब माल)</option>
                  <option value="expired">Expired Stock (एक्सपायरी)</option>
                  <option value="loss">Inventory Mismatch (अंतर)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Quantity to Deduct (Max: {targetBatch.quantity_available})
                </label>
                <input
                  type="number"
                  min="1"
                  max={targetBatch.quantity_available}
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-black focus:outline-none focus:ring-2 focus:ring-rose-500"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Notes / Reason *</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Why is this stock being deducted?"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={saving}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModal(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl transition-colors text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Adjusting...
                    </>
                  ) : (
                    'Confirm Deduction'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}