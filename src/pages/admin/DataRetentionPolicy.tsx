import { Archive, Shield, Info, ShieldCheck, ShieldAlert } from 'lucide-react'

interface RetentionRule {
  id: string
  entity: string
  policy: string
  enforced: boolean
}

const RETENTION_RULES: RetentionRule[] = [
  {
    id: 'bills',
    entity: 'Bills & Invoices',
    policy: 'Void / Reverse status change only. Hard deletion of bill history is blocked by database RLS.',
    enforced: true,
  },
  {
    id: 'payments',
    entity: 'Payments & Receipts',
    policy: 'Immutable transaction records. Financial corrections allowed only via ledger adjustment entries.',
    enforced: true,
  },
  {
    id: 'stock',
    entity: 'Inventory & Stock Ledger',
    policy: 'Stock movements recorded via stock_ledger. Quantities are never silently overwritten.',
    enforced: true,
  },
  {
    id: 'farmers',
    entity: 'Farmer Master Profiles',
    policy: 'Account status set to inactive. Master profile records and historical ledgers are preserved.',
    enforced: true,
  },
  {
    id: 'farmer-id',
    entity: 'Farmer ID Migration History',
    policy: 'Mapped via farmer_id_history table sharing the same UUID. Former IDs preserved for audit search.',
    enforced: true,
  },
  {
    id: 'audit',
    entity: 'Audit Trail Logs',
    policy: 'Append-only audit trail. Database RLS blocks UPDATE and DELETE queries from application roles.',
    enforced: true,
  },
  {
    id: 'admin-delete',
    entity: 'Admin Automated Purge',
    policy: 'Automated policy-based archiving for non-financial temporary session logs after legal hold expiry.',
    enforced: false,
  },
]

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function DataRetentionPolicy() {
  const enforcedCount = RETENTION_RULES.filter((r) => r.enforced).length
  const lastReviewDate = formatDate('2025-03-22')

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Archive className="text-amber-400" size={28} />
          Data Retention Policy
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Business history is preserved. Corrections are reversible, accountable, and auditable.
        </p>
      </div>

      {/* Primary Principle Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
          <Shield className="text-emerald-700 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-black text-emerald-950 text-sm">
              System does NOT hard-delete business history.
            </p>
            <p className="text-emerald-800/90 text-xs mt-1 leading-relaxed font-medium">
              Operational mistakes are fixed with void/reverse/adjust/deactivate workflows —
              never by erasing database rows that financial ledgers or inventory reports depend on.
            </p>
          </div>
        </div>

        {/* Retention Rules List */}
        <div className="space-y-2.5" role="list" aria-label="Data retention rules">
          {RETENTION_RULES.map((rule) => (
            <div
              key={rule.id}
              role="listitem"
              className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900">{rule.entity}</p>
                <p className="text-xs font-medium text-gray-600 mt-0.5 leading-relaxed">
                  {rule.policy}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  rule.enforced
                    ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                    : 'bg-amber-100 border-amber-200 text-amber-900'
                }`}
              >
                {rule.enforced ? (
                  <>
                    <ShieldCheck size={12} className="text-emerald-600" />
                    Enforced
                  </>
                ) : (
                  <>
                    <ShieldAlert size={12} className="text-amber-600" />
                    Planned
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Footer Metadata */}
        <div className="flex items-start gap-2 text-xs text-gray-500 pt-3 border-t border-gray-100 font-medium">
          <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
          <p className="leading-relaxed">
            <strong className="text-gray-800">{enforcedCount}/{RETENTION_RULES.length} rules</strong> enforced in active codebase.
            Policy Version <span className="font-bold text-gray-700">1.0</span>
            {' · '}
            Last Review <span className="font-bold text-gray-700">{lastReviewDate}</span>.
            Deletion rules are enforced at database level via Supabase Row Level Security (RLS).
          </p>
        </div>
      </div>
    </div>
  )
}