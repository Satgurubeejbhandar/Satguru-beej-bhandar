// src/pages/admin/AdminSettings.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Settings, Save, ShieldCheck, Loader2, Store, Hash, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface AppSettingRow {
  setting_key: string
  setting_value: string
}

const DEFAULT_SETTINGS: Record<string, string> = {
  business_name: 'SATGURU BEEJ BHANDAR',
  business_address: 'Daloosar, Sardarshahar (Churu), Rajasthan',
  late_interest_rate: '18',
  expiry_alert_days: '60',
  repayment_min_days: '30',
  repayment_max_days: '210',
  farmer_id_prefix: 'SBB',
  bill_prefix: 'BILL',
  purchase_prefix: 'PUR',
}

export default function AdminSettings() {
  const { role, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const isMounted = useRef<boolean>(true)
  const saveLockRef = useRef<boolean>(false)

  // ── Load System Settings ───────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')

      if (error) throw error

      if (isMounted.current) {
        const map: Record<string, string> = { ...DEFAULT_SETTINGS }
        if (data) {
          ;(data as AppSettingRow[]).forEach((item) => {
            if (item.setting_key && item.setting_value !== undefined) {
              map[item.setting_key] = item.setting_value
            }
          })
        }
        setSettings(map)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सेटिंग्स लोड नहीं हो सकीं'
      if (isMounted.current) {
        toast.error('सेटिंग्स लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      loadSettings()
    }
    return () => {
      isMounted.current = false
    }
  }, [loadSettings, role, authLoading])

  const handleChange = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }))
  }

  // ── Strict Validation & Save Handler ───────────────────────────────────────────

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()

    // Enforce strictly constrained financial, period bounds & alphanumeric prefix validations on client-side
    const lateInterest = parseFloat(settings.late_interest_rate || '0')
    if (isNaN(lateInterest) || lateInterest < 0 || lateInterest > 100) {
      toast.error('ब्याज दर (Late Interest Rate) 0% से 100% के बीच होनी चाहिए')
      return
    }

    const minDays = parseInt(settings.repayment_min_days || '0', 10)
    const maxDays = parseInt(settings.repayment_max_days || '0', 10)

    if (isNaN(minDays) || minDays < 1 || minDays > 365) {
      toast.error('न्यूनतम रिपेमेंट अवधि 1 से 365 दिनों के बीच होनी चाहिए')
      return
    }

    if (isNaN(maxDays) || maxDays < minDays || maxDays > 365) {
      toast.error('अधिकतम रिपेमेंट अवधि न्यूनतम दिनों से कम नहीं हो सकती तथा 365 दिन से अधिक नहीं हो सकती')
      return
    }

    const expiryAlert = parseInt(settings.expiry_alert_days || '0', 10)
    if (isNaN(expiryAlert) || expiryAlert < 1 || expiryAlert > 365) {
      toast.error('एक्सपायरी अलर्ट दिन 1 से 365 दिनों के बीच होना चाहिए')
      return
    }

    const alphaRegex = /^[A-Z0-9]{1,10}$/
    if (
      !alphaRegex.test(settings.farmer_id_prefix || '') ||
      !alphaRegex.test(settings.bill_prefix || '') ||
      !alphaRegex.test(settings.purchase_prefix || '')
    ) {
      toast.error('सभी सीरियल प्रीफिक्स (Prefix) केवल अल्फ़ान्यूमेरिक (A-Z, 0-9) और 1 से 10 अक्षरों के होने चाहिए')
      return
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const now = new Date().toISOString()

      // Prepare records for UPSERT
      const payload = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_at: now,
      }))

      const { error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'setting_key' })

      if (error) throw error

      toast.success('सिस्टम सेटिंग्स सफलतापूर्वक अपडेट हो गईं!')
      await loadSettings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सेटिंग्स सेव नहीं हो सकीं'
      if (isMounted.current) {
        toast.error('सेटिंग्स सेव करने में त्रुटि: ' + msg)
      }
    } finally {
      saveLockRef.current = false // Release lock
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas System Settings की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl font-sans">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="text-amber-400" size={28} /> System Settings & Business Config
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          व्यापार जानकारी, उधार ब्याज दर, रिपेमेंट अवधि एवं बिल प्रीफिक्स कंट्रोल
        </p>
      </div>

      <form
        onSubmit={handleSaveSettings}
        className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6 text-sm font-sans"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="animate-spin text-emerald-600 mb-2" size={32} />
            <p className="font-bold">Settings Loading...</p>
          </div>
        ) : (
          <>
            {/* Business Details Section */}
            <div className="space-y-4">
              <h2 className="font-bold text-emerald-900 border-b pb-2 flex items-center gap-1.5 text-base">
                <Store size={18} className="text-emerald-600" /> Business Information (दुकान जानकारी)
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Business Name (दुकान का नाम)
                  </label>
                  <input
                    type="text"
                    value={settings.business_name || ''}
                    onChange={(e) => handleChange('business_name', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Business Address (पता)
                  </label>
                  <input
                    type="text"
                    value={settings.business_address || ''}
                    onChange={(e) => handleChange('business_address', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Financial & Expiry Rules */}
            <div className="space-y-4 border-t pt-4">
              <h2 className="font-bold text-emerald-900 border-b pb-2 flex items-center gap-1.5 text-base">
                <ShieldCheck size={18} className="text-emerald-600" /> Financial & Expiry Rules (वित्तीय नियम)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Late Interest Rate (% Per Year)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={settings.late_interest_rate || '18'}
                    onChange={(e) => handleChange('late_interest_rate', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Expiry Alert Days (Alert Before)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.expiry_alert_days || '60'}
                    onChange={(e) => handleChange('expiry_alert_days', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Min Repayment Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.repayment_min_days || '30'}
                    onChange={(e) => handleChange('repayment_min_days', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Max Repayment Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.repayment_max_days || '210'}
                    onChange={(e) => handleChange('repayment_max_days', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Serial Prefixes Section */}
            <div className="space-y-4 border-t pt-4">
              <h2 className="font-bold text-emerald-900 border-b pb-2 flex items-center gap-1.5 text-base">
                <Hash size={18} className="text-emerald-600" /> Serial Prefix Configurations
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">
                    Farmer ID Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.farmer_id_prefix || 'SBB'}
                    onChange={(e) =>
                      handleChange('farmer_id_prefix', e.target.value.toUpperCase().trim())
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">
                    Bill Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.bill_prefix || 'BILL'}
                    onChange={(e) =>
                      handleChange('bill_prefix', e.target.value.toUpperCase().trim())
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">
                    Purchase Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.purchase_prefix || 'PUR'}
                    onChange={(e) =>
                      handleChange('purchase_prefix', e.target.value.toUpperCase().trim())
                    }
                    className="w-full p-2.5 border border-gray-300 rounded-xl uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Saving Settings...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save All Settings (सेटिंग्स सेव करें)
                </>
              )}
            </button>
          </>
        )}
      </form>
    </div>
  )
}