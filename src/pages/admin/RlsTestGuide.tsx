import { useState } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  Lock,
  Users,
  EyeOff,
  ShieldAlert,
  FileKey,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Type Definitions & Security Test Guidelines                        */
/* ------------------------------------------------------------------ */

interface SecurityTestRule {
  id: string
  rule: string
  category: 'RLS' | 'Auth' | 'Privacy' | 'Storage'
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const RLS_SECURITY_RULES: SecurityTestRule[] = [
  {
    id: 'admin-village-access',
    rule: 'Login as Admin → Verify access to farmers of all villages',
    category: 'RLS',
    icon: Users,
  },
  {
    id: 'farmer-data-isolation',
    rule: 'Login with Farmer PIN → Verify isolation to ONLY own bills & payments',
    category: 'RLS',
    icon: Lock,
  },
  {
    id: 'farmer-route-guard',
    rule: 'Farmer Role → Verify automatic redirect away from /admin routes',
    category: 'Auth',
    icon: ShieldAlert,
  },
  {
    id: 'guest-api-block',
    rule: 'Unauthenticated Guest → Verify blocked access to inventory & sales APIs',
    category: 'Auth',
    icon: EyeOff,
  },
  {
    id: 'whatsapp-privacy',
    rule: 'Farmer Portal → Verify zero control or exposure of admin WhatsApp history',
    category: 'Privacy',
    icon: Lock,
  },
  {
    id: 'private-docs-protection',
    rule: 'Signed / Private Documents → Verify strict storage RLS (no public indexing)',
    category: 'Storage',
    icon: FileKey,
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RlsTestGuide() {
  const [verifiedRules, setVerifiedRules] = useState<Record<string, boolean>>({})

  const toggleRuleVerification = (id: string) => {
    setVerifiedRules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const completedCount = Object.values(verifiedRules).filter(Boolean).length

  return (
    <section 
      aria-label="RLS Security Test Guide" 
      className="max-w-xl mx-auto space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-amber-400" size={28} aria-hidden="true" />
            RLS Test Guide
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Row Level Security &amp; Authorization Verification Checklist
          </p>
        </div>

        {/* Verification Progress Badge */}
        <div className="shrink-0 bg-emerald-800/80 border border-emerald-700/60 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 shadow-inner">
          {completedCount} / {RLS_SECURITY_RULES.length} Verified
        </div>
      </div>

      {/* Interactive Verification List */}
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100"
        role="group"
        aria-label="Security Test Checklist"
      >
        {RLS_SECURITY_RULES.map((item, idx) => {
          const Icon = item.icon
          const isVerified = !!verifiedRules[item.id]

          return (
            <div
              key={item.id}
              onClick={() => toggleRuleVerification(item.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  toggleRuleVerification(item.id)
                }
              }}
              tabIndex={0}
              role="checkbox"
              aria-checked={isVerified}
              aria-label={`Rule ${idx + 1}: ${item.rule}`}
              className={`p-4 flex items-start gap-3 text-sm cursor-pointer transition-colors select-none focus:outline-none focus-visible:bg-slate-100 ${
                isVerified ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
              }`}
            >
              {/* Checkbox Icon */}
              <div className="mt-0.5 shrink-0 text-emerald-700">
                {isVerified ? (
                  <CheckCircle2 size={18} className="text-emerald-600 fill-emerald-100" />
                ) : (
                  <Circle size={18} className="text-slate-300 hover:text-slate-400 transition-colors" />
                )}
              </div>

              {/* Rule Number */}
              <span className="font-black text-emerald-800 font-mono text-xs w-4 shrink-0 mt-0.5">
                {idx + 1}.
              </span>

              {/* Rule Title */}
              <p
                className={`text-xs font-semibold leading-relaxed flex-1 ${
                  isVerified ? 'line-through text-slate-400' : 'text-slate-800'
                }`}
              >
                {item.rule}
              </p>

              {/* Contextual Icon Badge */}
              <div className="shrink-0 mt-0.5">
                <Icon
                  size={16}
                  className={isVerified ? 'text-emerald-600' : 'text-slate-400'}
                  aria-hidden="true"
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}