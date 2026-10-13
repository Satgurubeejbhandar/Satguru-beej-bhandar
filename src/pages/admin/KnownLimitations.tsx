import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  KeyRound,
  MessageSquare,
  Database,
  Lock,
  Search,
  X,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

// ── Structured Limitation Items with Severity & Category ──
interface LimitationItem {
  id: string
  title: string
  detail: string
  category: 'Security' | 'Auth' | 'Integration' | 'Data & State'
  severity: 'HIGH' | 'MEDIUM' | 'INFO'
  icon: LucideIcon
}

const LIMITATIONS: LimitationItem[] = [
  {
    id: 'wa_api',
    title: 'WhatsApp / SMS Live Delivery',
    detail: 'Automated direct WhatsApp messages require WhatsApp Business API credentials & Edge Functions. Current admin share button generates pre-filled wa.me web links.',
    category: 'Integration',
    severity: 'MEDIUM',
    icon: MessageSquare,
  },
  {
    id: 'farmer_pin_storage',
    title: 'Farmer Auth Session Management',
    detail: 'Farmer portal auth uses bcrypt PIN verification + sessionStorage. Phone OTP upgrade is planned for future multi-factor auth phases.',
    category: 'Auth',
    severity: 'HIGH',
    icon: KeyRound,
  },
  {
    id: 'storage_bucket_privacy',
    title: 'Supabase Storage Bucket Security',
    detail: 'Private buckets (farmer-documents) use 60-second time-limited signed URLs generated via DocumentViewer. Public photo buckets store non-sensitive profile thumbnails only.',
    category: 'Security',
    severity: 'HIGH',
    icon: ShieldAlert,
  },
  {
    id: 'group_balance_sync',
    title: 'Group Member Usage Recalculation',
    detail: 'Individual member usage re-syncs via group billing transactions. Recalculations can be triggered manually via Group Balance Sync module.',
    category: 'Data & State',
    severity: 'MEDIUM',
    icon: Database,
  },
  {
    id: 'maintenance_lock',
    title: 'Maintenance Mode Screen Lock',
    detail: 'Maintenance mode flag is persisted in app_settings. System-wide maintenance lock overlay can be toggled under Maintenance Mode module.',
    category: 'Security',
    severity: 'INFO',
    icon: Lock,
  },
]

const HIGH_SEVERITY_COUNT = LIMITATIONS.filter((i) => i.severity === 'HIGH').length

export default function KnownLimitations() {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter limitations
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return LIMITATIONS
    const term = searchTerm.toLowerCase().trim()
    return LIMITATIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.detail.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.severity.toLowerCase().includes(term)
    )
  }, [searchTerm])

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-amber-400 shrink-0" size={28} /> Known Limitations
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Technical debt audit &amp; architectural caveats
          </p>
        </div>
        <div className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold shrink-0 font-mono">
          {HIGH_SEVERITY_COUNT} High Priority
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search limitations by keyword (e.g. 'WhatsApp', 'Bucket', 'HIGH')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search known limitations"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 shrink-0 cursor-pointer p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Structured Limitations List */}
      <div className="space-y-3" role="list" aria-label="Known technical limitations list">
        {filteredItems.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-semibold">
            No limitations found matching "{searchTerm}"
          </div>
        ) : (
          filteredItems.map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.id}
                role="listitem"
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-shadow"
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl ${
                        item.severity === 'HIGH'
                          ? 'bg-rose-50 text-rose-700'
                          : item.severity === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>

                  {/* Severity Badge */}
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border font-mono ${
                      item.severity === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : item.severity === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.severity} SEVERITY
                  </span>
                </div>

                {/* Title & Detail Description */}
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                  <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}