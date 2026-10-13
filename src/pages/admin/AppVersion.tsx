import { useState, useEffect, useRef } from 'react'
import { Tag, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const FEATURES = [
  'Auth + RLS Architecture & Data Security',
  'Farmers, Groups, Companies & Product Management',
  'SARA SAMAN + Purchase (Purchase & Selling Rate)',
  'Billing POS (Auto-Rate + Instant Stock Deduct)',
  'Payments, Ledger History, Returns & Void Bills',
  'Reports, Low-Stock Alerts, Expiry & Audit Logs',
  'Private Farmer Portal (Security & Privacy First)',
]

const DEFAULT_BUSINESS_NAME = 'SATGURU BEEJ BHANDAR PRO'

export default function AppVersion() {
  const [businessName, setBusinessName] = useState<string>(DEFAULT_BUSINESS_NAME)
  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    isMounted.current = true

    async function loadName() {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'business_name')
          .maybeSingle()

        if (data?.setting_value && isMounted.current) {
          setBusinessName(`${data.setting_value} PRO`)
        }
      } catch {
        // Non-blocking fallback
      }
    }

    loadName()

    return () => {
      isMounted.current = false
    }
  }, [])

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="text-amber-400" size={26} /> App Version
          </h1>
          <span className="bg-emerald-800 text-emerald-200 text-xs font-mono font-bold px-2.5 py-1 rounded-full border border-emerald-700/60 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-400" /> Stable
          </span>
        </div>
        <p className="text-emerald-200 text-xs mt-1">
          System release notes & feature foundation
        </p>
      </div>

      {/* Version Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="font-black text-emerald-950 text-lg">
              {businessName}
            </h2>
            <p className="font-mono text-xs font-bold text-emerald-700 mt-0.5">
              v1.0.0 · Steps 1–102 Foundation
            </p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* Feature List */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Core Modules & Features
          </p>
          <div className="space-y-2.5">
            {FEATURES.map((feat) => (
              <div
                key={feat}
                className="flex items-center gap-2.5 text-xs text-gray-700 font-medium"
              >
                <CheckCircle2
                  size={15}
                  className="text-emerald-600 shrink-0"
                />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-400 font-medium">
          <span>Release: Production v1.0.0</span>
          <span className="font-black text-slate-700 tracking-wider">JAI JAWAN JAI KISAN</span>
        </div>
      </div>
    </div>
  )
}