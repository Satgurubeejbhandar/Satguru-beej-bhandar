import React from 'react'
import { Handshake, MapPin, Layers, ShieldCheck, GraduationCap, Building2 } from 'lucide-react'

interface HandoverDetailItem {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const METADATA_ITEMS: HandoverDetailItem[] = [
  {
    label: 'Owner',
    value: 'SATGURU BEEJ BHANDAR',
    icon: Building2,
  },
  {
    label: 'Location',
    value: 'Daloosar, Sardarshahar (Churu), Rajasthan',
    icon: MapPin,
  },
  {
    label: 'Stack',
    value: 'React + TypeScript + Vite + Supabase',
    icon: Layers,
  },
]

const RULES_HONORED = [
  'No hardcoded admin password',
  'DB truth pattern strictly implemented',
  'Farmer WhatsApp history blocked for privacy',
  'Stock atomic deduct enabled on transactional commits',
  'Selling rate calculated on purchase + autofetch on bill',
]

export default function ProjectHandover() {
  return (
    <section 
      aria-label="Project Handover & Governance"
      className="max-w-xl mx-auto space-y-6 px-4 py-2"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl border border-emerald-850">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Handshake className="text-amber-400 animate-pulse" size={28} aria-hidden="true" />
          Project Handover
        </h1>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {/* Core Metadata Description List */}
        <dl className="p-6 space-y-4">
          {METADATA_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div 
                key={item.label} 
                className="flex items-start gap-3 text-sm"
              >
                <dt className="mt-0.5 text-slate-400" aria-label={item.label}>
                  <Icon size={18} aria-hidden="true" />
                </dt>
                <dd className="space-y-0.5">
                  <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {item.label}
                  </span>
                  <span className="block text-sm font-semibold text-slate-800">
                    {item.value}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        {/* System Invariants & Rules */}
        <div className="p-6 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-2 text-emerald-950">
            <ShieldCheck className="text-emerald-700" size={18} aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wider">System Invariants &amp; Rules</h2>
          </div>
          <ul className="space-y-2 pl-7 list-disc text-xs text-slate-600 font-medium leading-relaxed">
            {RULES_HONORED.map((rule, idx) => (
              <li key={idx} className="marker:text-emerald-600">
                {rule}
              </li>
            ))}
          </ul>
        </div>

        {/* Training & Operations Slogan */}
        <div className="p-6 bg-amber-50/40 flex items-start gap-3">
          <div className="mt-0.5 text-amber-600">
            <GraduationCap size={18} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Training Blueprint
            </h3>
            <p className="text-xs text-slate-600 font-semibold">
              Train staff sequence on:{' '}
              <span className="inline-flex items-center gap-1 font-extrabold text-slate-800">
                Stock In <span className="text-amber-600">&rarr;</span> Bill <span className="text-amber-600">&rarr;</span> Payment <span className="text-amber-600">&rarr;</span> Reports
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}