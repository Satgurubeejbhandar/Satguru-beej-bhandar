// src/pages/admin/MaintenanceMode.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Construction, Loader2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MaintenanceMode() {
  const [value, setValue] = useState<'true' | 'false'>('false')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 1. Fetch current maintenance status safely
  const loadMaintenanceStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .maybeSingle()

      if (fetchErr) throw fetchErr

      if (isMountedRef.current) {
        if (data?.setting_value === 'true' || data?.setting_value === 'false') {
          setValue(data.setting_value)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load settings'
      if (isMountedRef.current) {
        setError(msg)
        toast.error('Maintenance status load fail: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadMaintenanceStatus()
  }, [loadMaintenanceStatus])

  // 2. Atomic Save using Clean Supabase UPSERT (Verified Schema Columns Only)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const now = new Date().toISOString()

      const { error: upsertErr } = await supabase
        .from('app_settings')
        .upsert(
          [
            {
              setting_key: 'maintenance_mode',
              setting_value: value,
              updated_at: now,
            },
          ],
          { onConflict: 'setting_key' }
        )

      if (upsertErr) throw upsertErr

      if (isMountedRef.current) {
        if (value === 'true') {
          toast.error('⚠️ Maintenance Mode is now ENABLED! Farmers are locked out.')
        } else {
          toast.success('✅ System is NORMAL & Online!')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings'
      if (isMountedRef.current) {
        toast.error('Saving failed: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  const isMaintenanceOn = value === 'true'

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Construction className="text-amber-400 shrink-0" size={28} /> Maintenance Mode
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Global system lock flag stored in app_settings
          </p>
        </div>

        {/* Live Status Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider flex items-center gap-1.5 shrink-0 font-mono ${
            isMaintenanceOn
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isMaintenanceOn ? 'bg-rose-500' : 'bg-emerald-400'
            }`}
          />
          {isMaintenanceOn ? 'MAINTENANCE ON' : 'SYSTEM ONLINE'}
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-600" /> {error}
          </span>
          <button
            type="button"
            onClick={loadMaintenanceStatus}
            className="underline hover:text-rose-950 font-bold flex items-center gap-1"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Warning Notice Banner when ON */}
      {isMaintenanceOn && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs font-semibold shadow-xs">
          <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm text-rose-950 mb-0.5">
              Warning: System Maintenance Active
            </span>
            Farmers and non-admin users will immediately be logged out and blocked from logging in. Admins will remain unaffected.
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={save} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <label htmlFor="maintenance-status-select" className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            System Operational Status
          </label>
          <select
            id="maintenance-status-select"
            disabled={loading || saving}
            value={value}
            onChange={(e) => setValue(e.target.value as 'true' | 'false')}
            aria-label="Select system operational status"
            className={`w-full border rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 cursor-pointer transition-all ${
              isMaintenanceOn
                ? 'border-rose-300 bg-rose-50/30 text-rose-950 focus:ring-rose-500'
                : 'border-slate-200 bg-white text-slate-800 focus:ring-emerald-500'
            }`}
          >
            <option value="false">🟢 OFF — System Normal (All Features Active)</option>
            <option value="true">🚨 ON — Maintenance Mode (Block Farmers & Force Logout)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || saving}
          className={`w-full py-3.5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
            isMaintenanceOn
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving Status...
            </>
          ) : (
            <>
              {isMaintenanceOn ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              {isMaintenanceOn ? 'Enable Maintenance Mode' : 'Keep System Normal'}
            </>
          )}
        </button>
      </form>
    </div>
  )
}