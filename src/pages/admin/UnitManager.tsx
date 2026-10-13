// File: src/components/UnitManager.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { useState, useEffect, useRef, useCallback, type FC, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Ruler, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────
   Type Definitions & Config
   ────────────────────────────────────────────── */

export interface ProductUnit {
  id: string | number
  unit_name: string
  unit_abbr: string
  is_active: boolean
  created_at?: string
}

const REFRESH_COOLDOWN_MS = 1000

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const UnitManager: FC = () => {
  const [rows, setRows] = useState<ProductUnit[]>([])
  const [unitName, setUnitName] = useState<string>('')
  const [abbr, setAbbr] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [togglingId, setTogglingId] = useState<ProductUnit['id'] | null>(null)

  const isMounted = useRef<boolean>(true)
  const abortRef = useRef<AbortController | null>(null)
  const cooldownRef = useRef<boolean>(false)

  // Track component lifecycle
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
   * Fetches product units from the database
   */
  const load = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('product_units')
        .select('*')
        .order('unit_name', { ascending: true })
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return

      if (error) throw error

      setRows((data as ProductUnit[]) ?? [])
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      const msg = err instanceof Error ? err.message : 'Failed to load product units.'
      toast.error(msg)
    } finally {
      if (!controller.signal.aborted && isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  // Initial mount load
  useEffect(() => {
    load()
  }, [load])

  /**
   * Validates and registers a new product unit
   */
  const add = async (e: FormEvent) => {
    e.preventDefault()

    const sanitizedName = unitName.trim()
    const sanitizedAbbr = abbr.trim().toLowerCase()

    if (!sanitizedName || !sanitizedAbbr) {
      toast.error('Both unit name and abbreviation are required.')
      return
    }

    // Local check to prevent unnecessary roundtrips
    const alreadyExists = rows.some(
      (r) =>
        r.unit_name.toLowerCase() === sanitizedName.toLowerCase() ||
        r.unit_abbr.toLowerCase() === sanitizedAbbr
    )

    if (alreadyExists) {
      toast.error('A unit with this name or abbreviation already exists.')
      return
    }

    setSaving(true)

    try {
      const { data, error } = await supabase
        .from('product_units')
        .insert([
          { unit_name: sanitizedName, unit_abbr: sanitizedAbbr, is_active: true },
        ])
        .select() // Return the inserted rows to avoid extra GET refetch queries

      if (error) throw error

      toast.success('Unit added successfully!')
      setUnitName('')
      setAbbr('')

      // Inject the newly created unit directly to state to prevent database refetch overhead
      if (data && data.length > 0 && isMounted.current) {
        setRows((prev) =>
          [...prev, data[0] as ProductUnit].sort((a, b) =>
            a.unit_name.localeCompare(b.unit_name, undefined, { sensitivity: 'base' })
          )
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database rejection.'
      toast.error(msg)
    } finally {
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  /**
   * Safely toggles active status with state locks
   */
  const toggle = async (row: ProductUnit) => {
    if (togglingId !== null || cooldownRef.current) return

    setTogglingId(row.id)
    cooldownRef.current = true

    // Cooldown prevents double tap spamming on toggle inputs
    setTimeout(() => {
      cooldownRef.current = false
    }, REFRESH_COOLDOWN_MS)

    const nextState = !row.is_active

    try {
      const { error } = await supabase
        .from('product_units')
        .update({ is_active: nextState })
        .eq('id', row.id)

      if (error) throw error

      // Optimistic update of local row state to avoid full DB fetch
      if (isMounted.current) {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, is_active: nextState } : r))
        )
        toast.success(`Unit ${nextState ? 'enabled' : 'disabled'}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation rejected.'
      toast.error(msg)
    } finally {
      if (isMounted.current) {
        setTogglingId(null)
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl px-4 py-2 sm:px-0">
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ruler className="text-amber-300" size={28} aria-hidden="true" />
          Product Units
        </h1>
        <p className="text-emerald-200 text-xs mt-1 font-medium">
          Manage system measurements: mg, gm, kg, ml, litre, packet, bottle…
        </p>
      </div>

      {/* ── Add Unit Form ── */}
      <form
        onSubmit={add}
        className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <label htmlFor="unit-name-input" className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Unit Name
          </label>
          <input
            id="unit-name-input"
            required
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            disabled={saving}
            placeholder="E.g., Litre"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="unit-abbr-input" className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Abbreviation
          </label>
          <input
            id="unit-abbr-input"
            required
            type="text"
            value={abbr}
            onChange={(e) => setAbbr(e.target.value)}
            disabled={saving}
            placeholder="E.g., ltr"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors h-[38px] shadow-sm"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={14} aria-hidden="true" />
          ) : (
            <Plus size={14} aria-hidden="true" />
          )}
          {saving ? 'Adding…' : 'Add Unit'}
        </button>
      </form>

      {/* ── Units List Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[500px]" aria-label="Registered product units">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wide">
                <th scope="col" className="p-3.5">Unit</th>
                <th scope="col" className="p-3.5">Abbr</th>
                <th scope="col" className="p-3.5">Status</th>
                <th scope="col" className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-500" role="status" aria-live="polite">
                    <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" size={20} aria-hidden="true" />
                    Loading system product units…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-500">
                    No units registered yet. Complete the form above to add one.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isCurrentToggling = togglingId === r.id
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-950">{r.unit_name}</td>
                      <td className="p-3.5 font-mono text-slate-600 bg-slate-50/50 max-w-[80px] px-2 rounded-lg">
                        {r.unit_abbr}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase ${
                            r.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          disabled={togglingId !== null}
                          onClick={() => toggle(r)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                            r.is_active
                              ? 'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200/50'
                              : 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200/50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          aria-label={`${r.is_active ? 'Disable' : 'Enable'} unit ${r.unit_name}`}
                        >
                          {isCurrentToggling ? (
                            <Loader2 className="animate-spin" size={12} aria-hidden="true" />
                          ) : r.is_active ? (
                            <ToggleLeft size={14} aria-hidden="true" />
                          ) : (
                            <ToggleRight size={14} aria-hidden="true" />
                          )}
                          {isCurrentToggling ? 'Processing…' : r.is_active ? 'Disable' : 'Enable'}
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

export default UnitManager