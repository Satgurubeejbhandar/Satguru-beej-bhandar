import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Layers,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CreditScheme {
  id: string
  scheme_name: string
  scheme_type: string | null
  is_active: boolean
}

interface SchemeSlab {
  id: string
  scheme_id: string
  min_amount: number
  max_amount: number
  interest_rate: number
  repayment_days: number
  slab_order: number
  _isNew?: boolean
  _isDeleted?: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toNumber(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function createEmptySlab(schemeId: string, order: number): SchemeSlab {
  return {
    id: `new-${crypto.randomUUID()}`,
    scheme_id: schemeId,
    min_amount: 0,
    max_amount: 0,
    interest_rate: 0,
    repayment_days: 90,
    slab_order: order,
    _isNew: true,
  }
}

/**
 * Validate slabs for:
 *  - max > min
 *  - non-negative values
 *  - no overlapping ranges
 *  - sensible interest / days
 * Returns error string or null if OK.
 */
function validateSlabs(slabs: SchemeSlab[]): string | null {
  const active = slabs
    .filter((s) => !s._isDeleted)
    .sort((a, b) => a.slab_order - b.slab_order || a.min_amount - b.min_amount)

  if (active.length === 0) {
    return 'कम से कम एक slab ज़रूरी है'
  }

  for (let i = 0; i < active.length; i++) {
    const s = active[i]
    const label = `Slab #${i + 1} (Order ${s.slab_order})`

    if (s.min_amount < 0) return `${label}: Min Amount ऋणात्मक नहीं हो सकता`
    if (s.max_amount <= s.min_amount) {
      return `${label}: Max Amount (₹${s.max_amount}) > Min Amount (₹${s.min_amount}) होना चाहिए`
    }
    if (s.interest_rate < 0 || s.interest_rate > 100) {
      return `${label}: Interest Rate 0–100% के बीच होना चाहिए`
    }
    if (s.repayment_days < 1 || s.repayment_days > 3650) {
      return `${label}: Repayment Days 1–3650 के बीच होना चाहिए`
    }
  }

  // Overlap check — compare every pair
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      // Ranges overlap if a.min < b.max AND b.min < a.max
      // Using half-open logic: [min, max) would be cleaner, but table uses inclusive max
      const overlaps = a.min_amount < b.max_amount && b.min_amount < a.max_amount
      if (overlaps) {
        return (
          `Slab Order ${a.slab_order} (₹${a.min_amount}–₹${a.max_amount}) और ` +
          `Order ${b.slab_order} (₹${b.min_amount}–₹${b.max_amount}) overlap कर रहे हैं`
        )
      }
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SchemeSlabsEditor() {
  const [schemes, setSchemes] = useState<CreditScheme[]>([])
  const [schemeId, setSchemeId] = useState('')
  const [slabs, setSlabs] = useState<SchemeSlab[]>([])
  const [loading, setLoading] = useState(true)
  const [slabsLoading, setSlabsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const isMountedRef = useRef(true)
  const originalSlabsRef = useRef<string>('')

  /* ---- Load Schemes ---- */

  const loadSchemes = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('credit_schemes')
        .select('id, scheme_name, scheme_type, is_active')
        .eq('is_active', true)
        .order('scheme_name')

      if (error) throw error
      if (!isMountedRef.current) return

      const list = (data as unknown as CreditScheme[]) || []
      setSchemes(list)

      if (list.length > 0) {
        setSchemeId((prev) => prev || list[0].id)
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Schemes लोड नहीं हो सकीं'
      toast.error(msg)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [])

  /* ---- Load Slabs for selected scheme ---- */

  const loadSlabs = useCallback(async (id: string) => {
    if (!id) return
    try {
      setSlabsLoading(true)
      const { data, error } = await supabase
        .from('scheme_slabs')
        .select('id, scheme_id, min_amount, max_amount, interest_rate, repayment_days, slab_order')
        .eq('scheme_id', id)
        .order('slab_order')

      if (error) throw error
      if (!isMountedRef.current) return

      const list: SchemeSlab[] = ((data as unknown as SchemeSlab[]) || []).map((s) => ({
        id: s.id,
        scheme_id: s.scheme_id,
        min_amount: toNumber(s.min_amount),
        max_amount: toNumber(s.max_amount),
        interest_rate: toNumber(s.interest_rate),
        repayment_days: toNumber(s.repayment_days),
        slab_order: toNumber(s.slab_order),
      }))

      setSlabs(list)
      originalSlabsRef.current = JSON.stringify(list)
      setDirty(false)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Slabs लोड नहीं हो सकीं'
      toast.error(msg)
    } finally {
      if (isMountedRef.current) setSlabsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadSchemes()
    return () => {
      isMountedRef.current = false
    }
  }, [loadSchemes])

  useEffect(() => {
    if (schemeId) {
      if (dirty) {
        const ok = window.confirm(
          'आपके unsaved changes खो जाएंगे। Scheme बदलें?'
        )
        if (!ok) return
      }
      loadSlabs(schemeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemeId, loadSlabs])

  /* ---- Mark dirty helper ---- */

  const markDirty = useCallback((next: SchemeSlab[]) => {
    setSlabs(next)
    setDirty(JSON.stringify(next.filter((s) => !s._isDeleted)) !== originalSlabsRef.current)
  }, [])

  /* ---- Row Operations ---- */

  const addRow = useCallback(() => {
    if (!schemeId) {
      toast.error('पहले एक Scheme चुनें')
      return
    }
    const active = slabs.filter((s) => !s._isDeleted)
    const nextOrder =
      active.length > 0
        ? Math.max(...active.map((s) => s.slab_order)) + 1
        : 1
    markDirty([...slabs, createEmptySlab(schemeId, nextOrder)])
  }, [schemeId, slabs, markDirty])

  const updateRow = useCallback(
    (idx: number, field: keyof SchemeSlab, rawValue: string) => {
      const next = [...slabs]
      const numericFields: (keyof SchemeSlab)[] = [
        'min_amount',
        'max_amount',
        'interest_rate',
        'repayment_days',
        'slab_order',
      ]

      if (numericFields.includes(field)) {
        next[idx] = { ...next[idx], [field]: toNumber(rawValue) }
      } else {
        next[idx] = { ...next[idx], [field]: rawValue }
      }
      markDirty(next)
    },
    [slabs, markDirty]
  )

  const removeRow = useCallback(
    (idx: number) => {
      const row = slabs[idx]
      if (!row) return

      // Confirm before deleting persisted rows
      if (!row._isNew) {
        const ok = window.confirm(
          `Slab Order ${row.slab_order} (₹${row.min_amount}–₹${row.max_amount}) हटाना चाहते हैं?\n\nSave All दबाने पर यह स्थायी रूप से delete हो जाएगा।`
        )
        if (!ok) return
      }

      if (row._isNew) {
        // Not yet in DB — just remove from local state
        markDirty(slabs.filter((_, i) => i !== idx))
      } else {
        // Mark for deletion on next save (soft-delete in UI)
        const next = [...slabs]
        next[idx] = { ...next[idx], _isDeleted: true }
        markDirty(next)
      }
    },
    [slabs, markDirty]
  )

  /* ---- Save All (with validation) ---- */

  const saveAll = useCallback(async () => {
    if (!schemeId || saving) return

    const activeSlabs = slabs.filter((s) => !s._isDeleted)
    const validationError = validateSlabs(activeSlabs)
    if (validationError) {
      toast.error(validationError, { duration: 5000 })
      return
    }

    // Auth check
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      toast.error('सत्र समाप्त हो गया। कृपया फिर से लॉगिन करें।')
      return
    }

    setSaving(true)

    try {
      // 1. Delete marked rows first
      const toDelete = slabs.filter((s) => s._isDeleted && !s._isNew)
      for (const s of toDelete) {
        const { error } = await supabase
          .from('scheme_slabs')
          .delete()
          .eq('id', s.id)
        if (error) throw new Error(`Delete failed: ${error.message}`)
      }

      // 2. Insert new / Update existing
      for (const s of activeSlabs) {
        const payload = {
          scheme_id: schemeId,
          min_amount: s.min_amount,
          max_amount: s.max_amount,
          interest_rate: s.interest_rate,
          repayment_days: s.repayment_days,
          slab_order: s.slab_order,
        }

        if (s._isNew) {
          const { error } = await supabase.from('scheme_slabs').insert([payload])
          if (error) throw new Error(`Insert failed: ${error.message}`)
        } else {
          const { error } = await supabase
            .from('scheme_slabs')
            .update(payload)
            .eq('id', s.id)
          if (error) throw new Error(`Update failed: ${error.message}`)
        }
      }

      // 3. Audit log (non-blocking — warn if fails)
      try {
        await supabase.rpc('create_audit_log', {
          p_action: 'SCHEME_SLABS_UPDATED',
          p_entity_type: 'credit_scheme',
          p_entity_id: schemeId,
          p_reason: 'Admin updated udhaar slabs',
        })
      } catch {
        console.warn('[SchemeSlabsEditor] Audit log failed — slabs still saved')
      }

      toast.success('Scheme slabs saved (DB is source of truth)')
      await loadSlabs(schemeId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(msg, { duration: 5000 })
    } finally {
      if (isMountedRef.current) setSaving(false)
    }
  }, [schemeId, slabs, saving, loadSlabs])

  /* ---- Visible slabs (hide deleted) ---- */

  const visibleSlabs = useMemo(
    () => slabs.filter((s) => !s._isDeleted),
    [slabs]
  )

  const selectedSchemeName = useMemo(
    () => schemes.find((s) => s.id === schemeId)?.scheme_name || '',
    [schemes, schemeId]
  )

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="text-amber-400" size={28} aria-hidden="true" />
            Udhaar Scheme Slabs
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            No frontend hardcode — rates live in <code className="text-amber-300">scheme_slabs</code> table
          </p>
        </div>
        {dirty && (
          <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider">
            Unsaved Changes
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label htmlFor="scheme-select" className="sr-only">
            Select Credit Scheme
          </label>
          <select
            id="scheme-select"
            value={schemeId}
            onChange={(e) => setSchemeId(e.target.value)}
            disabled={loading || saving}
            className="w-full sm:w-auto min-w-[200px] px-4 py-2.5 border border-slate-300 rounded-xl font-bold bg-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
          >
            {schemes.length === 0 && (
              <option value="">— No active schemes —</option>
            )}
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.scheme_name}
                {s.scheme_type ? ` (${s.scheme_type})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => schemeId && loadSlabs(schemeId)}
            disabled={loading || slabsLoading || saving || !schemeId}
            aria-label="Reload slabs"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={slabsLoading ? 'animate-spin' : ''} />
            Reload
          </button>
          <button
            type="button"
            onClick={addRow}
            disabled={!schemeId || saving}
            aria-label="Add new slab"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
          >
            <Plus size={14} /> Add Slab
          </button>
          <button
            type="button"
            disabled={saving || !dirty || !schemeId}
            onClick={saveAll}
            aria-label="Save all slabs"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      {selectedSchemeName && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-2 text-xs text-slate-600">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Editing slabs for <strong className="text-emerald-900">{selectedSchemeName}</strong>.
            Ranges must not overlap. Max must be greater than Min.
            Changes apply only after <strong>Save All</strong>.
          </p>
        </div>
      )}

      {/* Slabs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs text-left"
            role="table"
            aria-label="Scheme slabs editor"
          >
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3 w-12 text-center">#</th>
                <th scope="col" className="p-3">Order</th>
                <th scope="col" className="p-3">Min ₹</th>
                <th scope="col" className="p-3">Max ₹</th>
                <th scope="col" className="p-3">Rate %</th>
                <th scope="col" className="p-3">Days</th>
                <th scope="col" className="p-3 text-center">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading || slabsLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-emerald-700" />
                      <span className="font-bold">Loading slabs…</span>
                    </div>
                  </td>
                </tr>
              ) : visibleSlabs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-medium">
                    {schemeId
                      ? 'No slabs yet. Click “Add Slab” to create one.'
                      : 'Select a scheme first.'}
                  </td>
                </tr>
              ) : (
                visibleSlabs.map((s, idx) => {
                  // Find real index in full slabs array (including deleted)
                  const realIdx = slabs.findIndex((x) => x.id === s.id)
                  const rangeInvalid = s.max_amount <= s.min_amount && s.max_amount !== 0

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        s._isNew ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-2 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={s.slab_order}
                          onChange={(e) =>
                            updateRow(realIdx, 'slab_order', e.target.value)
                          }
                          disabled={saving}
                          aria-label={`Slab ${idx + 1} order`}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={s.min_amount}
                          onChange={(e) =>
                            updateRow(realIdx, 'min_amount', e.target.value)
                          }
                          disabled={saving}
                          aria-label={`Slab ${idx + 1} min amount`}
                          className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={s.max_amount}
                          onChange={(e) =>
                            updateRow(realIdx, 'max_amount', e.target.value)
                          }
                          disabled={saving}
                          aria-label={`Slab ${idx + 1} max amount`}
                          className={`w-28 border rounded-lg px-2 py-1.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 ${
                            rangeInvalid
                              ? 'border-rose-400 bg-rose-50'
                              : 'border-slate-300'
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={s.interest_rate}
                          onChange={(e) =>
                            updateRow(realIdx, 'interest_rate', e.target.value)
                          }
                          disabled={saving}
                          aria-label={`Slab ${idx + 1} interest rate`}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 font-black text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={s.repayment_days}
                          onChange={(e) =>
                            updateRow(realIdx, 'repayment_days', e.target.value)
                          }
                          disabled={saving}
                          aria-label={`Slab ${idx + 1} repayment days`}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(realIdx)}
                          disabled={saving}
                          aria-label={`Delete slab ${idx + 1}`}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
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

      {/* Footer summary */}
      {!loading && !slabsLoading && visibleSlabs.length > 0 && (
        <p className="text-[11px] text-slate-500 font-medium text-center">
          {visibleSlabs.length} slab{visibleSlabs.length !== 1 ? 's' : ''}
          {dirty ? ' · Unsaved changes pending' : ' · In sync with DB'}
        </p>
      )}
    </div>
  )
}