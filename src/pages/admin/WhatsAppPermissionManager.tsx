// File: src/components/WhatsAppPermissionManager.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Share2,
  Shield,
  Loader2,
  Lock,
  ToggleLeft,
  ToggleRight,
  UserX,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────
   Type Definitions
   ────────────────────────────────────────────── */

export interface ProfileRow {
  id: string
  full_name: string | null
  role: string | null
  can_share_whatsapp_history: boolean
  is_active: boolean | null
}

const REFRESH_COOLDOWN_MS = 1000

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const WhatsAppPermissionManager: FC = () => {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)
  const abortRef = useRef<AbortController | null>(null)
  const cooldownRef = useRef<boolean>(false)

  // Track component lifecycle
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      abortRef.current?.abort()
    }
  }, [])

  /**
   * Fetches all profiles with WhatsApp permission fields
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
        .from('profiles')
        .select('id, full_name, role, can_share_whatsapp_history, is_active')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true })
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return

      if (error) throw error

      if (isMounted.current) {
        setRows((data as unknown as ProfileRow[]) ?? [])
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : 'Failed to load profiles.'
        toast.error(msg)
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  // Initial mount load
  useEffect(() => {
    load()
  }, [load])

  /**
   * Toggles WhatsApp history sharing permission.
   *
   * Business Rule:
   * - Farmers MUST always have `can_share_whatsapp_history = false`.
   *   This is enforced at the application layer AND should be enforced
   *   via Supabase RLS / database CHECK constraints.
   * - Admin/other roles can be toggled freely.
   */
    const toggle = async (row: ProfileRow) => {
    // Prevent concurrent toggles and spam
    if (togglingId !== null || cooldownRef.current) return

    // ── Business Rule: Farmer history share is permanently locked ──
    if (row.role === 'farmer') {
      // If already false, no DB write needed
      if (!row.can_share_whatsapp_history) {
        toast('Farmer WhatsApp history sharing is permanently disabled.', {
          icon: '🔒',
        })
        return
      }

      // If somehow a farmer has it set to true (data integrity issue), force it back to false
      setTogglingId(row.id)
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, REFRESH_COOLDOWN_MS)

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ can_share_whatsapp_history: false })
          .eq('id', row.id)

        if (error) throw error

        if (isMounted.current) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === row.id ? { ...r, can_share_whatsapp_history: false } : r
            )
          )
          toast.error('Corrected: Farmer history share forced to FALSE.')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Update rejected.'
        toast.error(msg)
      } finally {
        if (isMounted.current) setTogglingId(null)
      }
      return
    }

    // ── Standard toggle for non-farmer roles ──
    const nextState = !row.can_share_whatsapp_history

    setTogglingId(row.id)
    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, REFRESH_COOLDOWN_MS)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ can_share_whatsapp_history: nextState })
        .eq('id', row.id)

      if (error) throw error

      // Optimistic local update — no full table refetch needed
      if (isMounted.current) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, can_share_whatsapp_history: nextState } : r
          )
        )
        // ✅ FIXED: Changed r.full_name to row.full_name
        toast.success(
          `WhatsApp history sharing ${nextState ? 'enabled' : 'disabled'} for ${row.full_name || 'user'}.`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Permission update rejected.'
      toast.error(msg)
    } finally {
      if (isMounted.current) setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6 px-4 py-2 sm:px-0">
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Share2 className="text-amber-300" size={28} aria-hidden="true" />
          WhatsApp Permission Manager
        </h1>
        <p className="text-emerald-200 text-xs mt-1 font-medium flex items-center gap-1.5">
          <Shield size={12} aria-hidden="true" />
          Farmer history share permanently locked to FALSE · Admin toggles where authorized
        </p>
      </div>

      {/* ── Profiles Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs text-left min-w-[600px]"
            aria-label="WhatsApp sharing permissions by user"
          >
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wide">
                <th scope="col" className="p-3.5">Name</th>
                <th scope="col" className="p-3.5">Role</th>
                <th scope="col" className="p-3.5 text-center">WhatsApp History Share</th>
                <th scope="col" className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-10 text-center text-slate-500"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2
                      className="animate-spin mx-auto mb-2 text-emerald-600"
                      size={20}
                      aria-hidden="true"
                    />
                    Loading user permissions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-400">
                    <UserX
                      size={28}
                      className="mx-auto mb-2 text-slate-300"
                      aria-hidden="true"
                    />
                    No user profiles found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isFarmer = r.role === 'farmer'
                  const isToggling = togglingId === r.id
                  const isAnyToggling = togglingId !== null

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="p-3.5">
                        <span className="font-bold text-slate-900">
                          {r.full_name || r.id.slice(0, 8)}
                        </span>
                        {!r.is_active && (
                          <span className="ml-2 text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                            isFarmer
                              ? 'bg-amber-100 text-amber-800'
                              : r.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.role ?? 'unknown'}
                        </span>
                      </td>

                      {/* Permission Status */}
                      <td className="p-3.5 text-center">
                        {isFarmer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/50">
                            <Lock size={10} aria-hidden="true" />
                            Locked: FALSE
                          </span>
                        ) : r.can_share_whatsapp_history ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/50">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200/50">
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Toggle Action */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          disabled={isAnyToggling}
                          onClick={() => toggle(r)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                            isFarmer
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 cursor-default'
                              : r.can_share_whatsapp_history
                              ? 'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200/50'
                              : 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200/50'
                          }`}
                          aria-label={
                            isFarmer
                              ? `Farmer WhatsApp history sharing is locked`
                              : `${r.can_share_whatsapp_history ? 'Disable' : 'Enable'} WhatsApp history sharing for ${r.full_name || r.id.slice(0, 8)}`
                          }
                        >
                          {isToggling ? (
                            <Loader2 className="animate-spin" size={12} aria-hidden="true" />
                          ) : isFarmer ? (
                            <Lock size={12} aria-hidden="true" />
                          ) : r.can_share_whatsapp_history ? (
                            <ToggleLeft size={14} aria-hidden="true" />
                          ) : (
                            <ToggleRight size={14} aria-hidden="true" />
                          )}
                          {isToggling
                            ? 'Updating…'
                            : isFarmer
                            ? 'Locked'
                            : r.can_share_whatsapp_history
                            ? 'Disable'
                            : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && rows.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Shield size={11} className="text-slate-400" aria-hidden="true" />
            {rows.length} profile{rows.length !== 1 ? 's' : ''} · Farmer permissions are database-locked
          </div>
        )}
      </div>
    </div>
  )
}

export default WhatsAppPermissionManager