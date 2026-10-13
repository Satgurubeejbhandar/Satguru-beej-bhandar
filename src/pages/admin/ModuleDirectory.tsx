import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Search,
  Rocket,
  Zap,
  Users,
  Building2,
  Package,
  Truck,
  Boxes,
  Receipt,
  Wallet,
  BarChart3,
  Bell,
  Settings,
  CheckSquare,
  Flag,
  Map,
  Activity,
  ChevronRight,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react'

// ── Categorized Module Definitions ──
interface ModuleLink {
  to: string
  label: string
  category: 'Operations' | 'Setup & Inventory' | 'Audit & Health' | 'Quick Tools'
  icon: LucideIcon
}

const MODULES: ModuleLink[] = [
  // ⚡ Quick Tools
  { to: '/admin/getting-started', label: 'Getting Started', category: 'Quick Tools', icon: Rocket },
  { to: '/admin/quick', label: 'Quick Actions', category: 'Quick Tools', icon: Zap },

  // 🧾 Operations
  { to: '/admin/bills', label: 'Billing POS', category: 'Operations', icon: Receipt },
  { to: '/admin/payments', label: 'Payments', category: 'Operations', icon: Wallet },
  { to: '/admin/farmers', label: 'Farmers', category: 'Operations', icon: Users },
  { to: '/admin/reports', label: 'Reports Hub', category: 'Operations', icon: BarChart3 },
  { to: '/admin/alerts', label: 'Alerts', category: 'Operations', icon: Bell },

  // 📦 Setup & Inventory
  { to: '/admin/companies', label: 'Companies', category: 'Setup & Inventory', icon: Building2 },
  { to: '/admin/products', label: 'Products', category: 'Setup & Inventory', icon: Package },
  { to: '/admin/purchase', label: 'Stock In', category: 'Setup & Inventory', icon: Truck },
  { to: '/admin/sara-saman', label: 'SARA SAMAN', category: 'Setup & Inventory', icon: Boxes },

  // 🛠️ Audit & Health
  { to: '/admin/settings', label: 'Settings', category: 'Audit & Health', icon: Settings },
  { to: '/admin/e2e', label: 'E2E Checklist', category: 'Audit & Health', icon: CheckSquare },
  { to: '/admin/golive', label: 'Go-Live Score', category: 'Audit & Health', icon: Flag },
  { to: '/admin/system-map', label: 'System Map', category: 'Audit & Health', icon: Map },
  { to: '/admin/health', label: 'Health Check', category: 'Audit & Health', icon: Activity },
]

export default function ModuleDirectory() {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')

  // Search Filter
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return MODULES
    const term = searchTerm.toLowerCase().trim()
    return MODULES.filter(
      (m) =>
        m.label.toLowerCase().includes(term) ||
        m.category.toLowerCase().includes(term) ||
        m.to.toLowerCase().includes(term)
    )
  }, [searchTerm])

  const categories = useMemo(
    () => ['Quick Tools', 'Operations', 'Setup & Inventory', 'Audit & Health'] as const,
    []
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="text-amber-400 shrink-0" size={28} /> Module Directory
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Complete sitemap and navigation entry points
          </p>
        </div>
        <span className="text-xs font-extrabold bg-emerald-800/80 px-3 py-1.5 rounded-full border border-emerald-700 shrink-0 font-mono">
          {MODULES.length} Modules
        </span>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search modules by name or category (e.g. 'Billing', 'Stock', 'Health')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search module sitemap"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear module search"
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 shrink-0 cursor-pointer p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Categorized Module Sections */}
      <div className="space-y-6">
        {filteredModules.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-semibold">
            No modules found matching "{searchTerm}"
          </div>
        ) : (
          categories.map((cat) => {
            const catModules = filteredModules.filter((m) => m.category === cat)
            if (catModules.length === 0) return null

            return (
              <div key={cat} className="space-y-2.5">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  {cat} ({catModules.length})
                </h2>

                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                  role="list"
                  aria-label={`${cat} navigation modules`}
                >
                  {catModules.map((m) => {
                    const Icon = m.icon
                    const isActive = location.pathname === m.to

                    return (
                      <Link
                        key={m.to}
                        to={m.to}
                        role="listitem"
                        aria-label={m.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[90px] shadow-xs active:scale-[0.98] ${
                          isActive
                            ? 'bg-emerald-900 border-emerald-900 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={`p-2 rounded-xl transition-colors ${
                              isActive
                                ? 'bg-emerald-800 text-amber-400'
                                : 'bg-slate-100 group-hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <ChevronRight
                            size={14}
                            className={`transition-transform group-hover:translate-x-0.5 ${
                              isActive ? 'text-emerald-300' : 'text-slate-300 group-hover:text-emerald-600'
                            }`}
                          />
                        </div>

                        <div>
                          <span
                            className={`font-bold text-xs block leading-tight ${
                              isActive ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {m.label}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}