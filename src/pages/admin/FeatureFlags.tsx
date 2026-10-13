import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { ToggleLeft, Save, Loader2, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Flag Definitions ──
const FLAGS = [
  { key: 'flag_group_udhaar', label: 'Group Udhaar Module', def: 'true' },
  { key: 'flag_cashback', label: 'Cashback Tracking', def: 'true' },
  { key: 'flag_late_interest', label: 'Late Interest Engine', def: 'true' },
  { key: 'flag_admin_whatsapp', label: 'Admin WhatsApp Share UI', def: 'true' },
] as const

type FlagKey = (typeof FLAGS)[number]['key']
type FlagMap = Record<FlagKey, string>

interface SettingItem {
  setting_key: string
  setting_value: string
}

export default function FeatureFlags() {
  const [map, setMap] = useState<FlagMap>(() => {
    const initial = {} as FlagMap
    FLAGS.forEach((f) => {
      initial[f.key] = f.def
    })
    return initial
  })

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 1. Fetch Flags from Supabase
  const loadFlags = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', FLAGS.map((f) => f.key))

      if (error) throw error

      if (isMountedRef.current) {
        const m = {} as FlagMap
        const settings = (data as SettingItem[]) || []

        FLAGS.forEach((f) => {
          const found = settings.find((d) => d.setting_key === f.key)
          m[f.key] = found?.setting_value ?? f.def
        })

        setMap(m)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load feature flags'
      if (isMountedRef.current) {
        setFetchError(msg)
        toast.error('Failed to load settings: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadFlags()
  }, [loadFlags])

  // 2. Save Flags using Verified Schema Columns
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const now = new Date().toISOString()

      // Payload matching app_settings schema: (setting_key, setting_value, updated_at)
      const payload = FLAGS.map((f) => ({
        setting_key: f.key,
        setting_value: map[f.key] ?? f.def,
        updated_at: now,
      }))

      const { error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'setting_key' })

      if (error) throw error

      if (isMountedRef.current) {
        toast.success('Feature flags saved successfully!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving settings'
      if (isMountedRef.current) {
        toast.error('Save failed: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
        <span className="text-xs font-bold">Loading feature flags...</span>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ToggleLeft className="text-amber-400" size={28} /> Feature Flags
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          System Module Toggles · Stored in app_settings
        </p>
      </div>

      {/* Fetch Error Alert */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-bold" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            {fetchError}
          </span>
          <button
            type="button"
            onClick={loadFlags}
            className="underline hover:text-rose-950 font-bold flex items-center gap-1"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={save} className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3 shadow-sm text-xs">
        {FLAGS.map((f) => {
          const isOn = (map[f.key] ?? f.def) === 'true'
          return (
            <div
              key={f.key}
              className="flex items-center justify-between gap-3 font-bold p-3.5 rounded-2xl hover:bg-slate-50 transition-colors border border-slate-100"
            >
              <span className="flex items-center gap-2 text-slate-800">
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    isOn ? 'bg-emerald-500 shadow-xs shadow-emerald-500' : 'bg-rose-400'
                  }`}
                  aria-hidden="true"
                />
                {f.label}
              </span>
              <select
                value={map[f.key] ?? f.def}
                onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}
                aria-label={`Toggle ${f.label}`}
                className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer bg-white text-slate-900"
              >
                <option value="true">ON</option>
                <option value="false">OFF</option>
              </select>
            </div>
          )
        })}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all mt-4 cursor-pointer shadow-md text-xs"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving Changes...
            </>
          ) : (
            <>
              <Save size={16} /> Save Flags
            </>
          )}
        </button>
      </form>
    </div>
  )
}