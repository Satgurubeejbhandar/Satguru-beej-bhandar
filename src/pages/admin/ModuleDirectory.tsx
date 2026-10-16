import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  // Core / Header
  LayoutGrid, Search, ChevronRight, ShieldCheck, X,
  // Main
   Store, Rocket, BookMarked, BookOpen,
  // Farmers
  Users, FileText, UserX, CreditCard, Gauge, IndianRupee,
  Percent, Sparkles, RefreshCw, KeyRound, MapPin, TrendingUp, Download,
  // Companies
  Building2, Wallet, Truck, FileSignature, Landmark,
  // Inventory
  Package, Ruler, Award, PieChart, ListOrdered, AlertTriangle, RotateCcw, Clock, Skull,
  // Billing
  Receipt, ScrollText, Ban, Hash, Share2, FileWarning, Printer, CalendarClock, ClipboardCheck,
  // Reports
  Clipboard, CalendarDays, CalendarRange, PackageSearch, Calculator, BarChart3,
  // Communication
  Bell, Megaphone, Mail, MessageCircle, FolderOpen,
  // Security
  UserCog, TableProperties, ScanSearch, GitBranch, Archive,
  // Settings
  ToggleLeft, Construction, Table2, Activity, BadgeCheck, Map, Settings, Tag,
  // Help
  Info, Phone, Keyboard, WifiOff, DatabaseBackup, Bug, Handshake, ListChecks,
  Flag, PartyPopper,
  // Danger
  Trash2,
  // Search icon
  Search as SearchIcon,
  type LucideIcon,
} from 'lucide-react'

// ── Module Type ──
type Category =
  | 'Main'
  | 'Farmers & Udhaar'
  | 'Companies'
  | 'Products & Inventory'
  | 'Billing & Payments'
  | 'Sales & Purchase Reports'
  | 'Communication'
  | 'System & Security'
  | 'System / Settings'
  | 'Help / Information'
  | 'Danger Zone'

interface ModuleLink {
  to: string
  label: string
  category: Category
  icon: LucideIcon
  badge?: string
}

const MODULES: ModuleLink[] = [
  // 🏠 Main
  { to: '/admin', label: 'Dashboard', category: 'Main', icon: Store },
  { to: '/admin/quick', label: 'Quick Actions', category: 'Main', icon: Rocket },
  { to: '/admin/getting-started', label: 'Getting Started', category: 'Main', icon: BookMarked },
  { to: '/admin/bahi-khata', label: 'डेली बही खाता', category: 'Main', icon: BookOpen },

  // 👨‍🌾 Farmers & Udhaar
  { to: '/admin/farmers', label: 'Farmers & Udhaar', category: 'Farmers & Udhaar', icon: Users },
  { to: '/admin/groups', label: 'Group Udhaar', category: 'Farmers & Udhaar', icon: Users },
  { to: '/admin/ledger', label: 'Farmer Ledger', category: 'Farmers & Udhaar', icon: FileText },
  { to: '/admin/farmer-status', label: 'Farmer Status', category: 'Farmers & Udhaar', icon: UserX },
  { to: '/admin/farmer-cards', label: 'Farmer Card', category: 'Farmers & Udhaar', icon: CreditCard },
  { to: '/admin/credit-limit', label: 'Credit Limit', category: 'Farmers & Udhaar', icon: Gauge },
  { to: '/admin/outstanding', label: 'Outstanding Report', category: 'Farmers & Udhaar', icon: IndianRupee },
  { to: '/admin/farmer-search', label: 'Farmer Search', category: 'Farmers & Udhaar', icon: SearchIcon },
  { to: '/admin/interest-report', label: 'Interest Report', category: 'Farmers & Udhaar', icon: Percent },
  { to: '/admin/cashback-report', label: 'Cashback Report', category: 'Farmers & Udhaar', icon: Sparkles },
  { to: '/admin/group-usage', label: 'Group Usage', category: 'Farmers & Udhaar', icon: Users },
  { to: '/admin/group-sync', label: 'Group Balance Sync', category: 'Farmers & Udhaar', icon: RefreshCw },
  { to: '/admin/pin-reset', label: 'PIN Reset', category: 'Farmers & Udhaar', icon: KeyRound },
  { to: '/admin/villages', label: 'Village-wise', category: 'Farmers & Udhaar', icon: MapPin },
  { to: '/admin/farmer-sales', label: 'Farmer-wise Sales', category: 'Farmers & Udhaar', icon: TrendingUp },
  { to: '/admin/export-farmers', label: 'Export Farmers CSV', category: 'Farmers & Udhaar', icon: Download },

  // 🏢 Companies
  { to: '/admin/companies', label: 'Companies', category: 'Companies', icon: Building2 },
  { to: '/admin/company-ledger', label: 'Company Ledger', category: 'Companies', icon: FileText },
  { to: '/admin/company-payment', label: 'Company Payment', category: 'Companies', icon: Wallet },
  { to: '/admin/company-summary', label: 'Company Summary', category: 'Companies', icon: Building2 },
  { to: '/admin/company-purchase-return', label: 'Purchase Return', category: 'Companies', icon: Truck },
  { to: '/admin/letterpad', label: 'Letterpads', category: 'Companies', icon: FileSignature, badge: 'New' },
  { to: '/admin/bank-accounts', label: 'Bank Accounts', category: 'Companies', icon: Landmark, badge: 'New' },

  // 📦 Products & Inventory
  { to: '/admin/products', label: 'Products', category: 'Products & Inventory', icon: Package },
  { to: '/admin/units', label: 'Units', category: 'Products & Inventory', icon: Ruler },
  { to: '/admin/schemes', label: 'Schemes / Slabs', category: 'Products & Inventory', icon: Award },
  { to: '/admin/sara-saman', label: 'SARA SAMAN', category: 'Products & Inventory', icon: Package, badge: 'Stock' },
  { to: '/admin/purchase', label: 'Purchase / Stock In', category: 'Products & Inventory', icon: Truck },
  { to: '/admin/batches', label: 'Batches / FEFO', category: 'Products & Inventory', icon: Package },
  { to: '/admin/stock-ledger', label: 'Stock Ledger', category: 'Products & Inventory', icon: BookOpen },
  { to: '/admin/stock-register', label: 'Stock Register', category: 'Products & Inventory', icon: BookOpen },
  { to: '/admin/valuation', label: 'Stock Valuation', category: 'Products & Inventory', icon: PieChart },
  { to: '/admin/reorder', label: 'Reorder List', category: 'Products & Inventory', icon: ListOrdered },
  { to: '/admin/damage-product', label: 'Damage Product', category: 'Products & Inventory', icon: AlertTriangle, badge: 'Stock' },
  { to: '/admin/returns', label: 'Returns', category: 'Products & Inventory', icon: RotateCcw },
  { to: '/admin/expiry-report', label: 'Expiry Report', category: 'Products & Inventory', icon: Clock },
  { to: '/admin/expired-writeoff', label: 'Expired Write-off', category: 'Products & Inventory', icon: Skull },

  // 🧾 Billing & Payments
  { to: '/admin/bills', label: 'Billing POS', category: 'Billing & Payments', icon: Receipt },
  { to: '/admin/payments', label: 'Payments', category: 'Billing & Payments', icon: IndianRupee },
  { to: '/admin/payment-history', label: 'Payment History', category: 'Billing & Payments', icon: ScrollText },
  { to: '/admin/payment-register', label: 'Payment Register', category: 'Billing & Payments', icon: Wallet },
  { to: '/admin/bill-void', label: 'Bill Void', category: 'Billing & Payments', icon: Ban },
  { to: '/admin/bill-series', label: 'Bill Series', category: 'Billing & Payments', icon: Hash },
  { to: '/admin/bill-whatsapp', label: 'Bill WhatsApp', category: 'Billing & Payments', icon: Share2 },
  { to: '/admin/bill-warning', label: 'Bill Warning Editor', category: 'Billing & Payments', icon: FileWarning },
  { to: '/admin/print-bill', label: 'Printable Bill', category: 'Billing & Payments', icon: Printer },
  { to: '/admin/due-engine', label: 'Due Date Engine', category: 'Billing & Payments', icon: CalendarClock },
  { to: '/admin/rate-audit', label: 'Rate Override Audit', category: 'Billing & Payments', icon: ClipboardCheck },

  // 📊 Sales & Purchase Reports
  { to: '/admin/purchase-register', label: 'Purchase Register', category: 'Sales & Purchase Reports', icon: Clipboard },
  { to: '/admin/today-payment-sales', label: 'Today Payment Sales', category: 'Sales & Purchase Reports', icon: IndianRupee },
  { to: '/admin/sales-register', label: 'Sales Register', category: 'Sales & Purchase Reports', icon: ScrollText },
  { to: '/admin/daily-sales', label: 'Daily Sales', category: 'Sales & Purchase Reports', icon: CalendarDays },
  { to: '/admin/monthly-sales', label: 'Monthly Sales', category: 'Sales & Purchase Reports', icon: CalendarRange },
  { to: '/admin/product-sales', label: 'Product Sales', category: 'Sales & Purchase Reports', icon: PackageSearch },
  { to: '/admin/gst-calculation', label: 'GST Calculation', category: 'Sales & Purchase Reports', icon: Calculator },
  { to: '/admin/reports', label: 'Reports Hub', category: 'Sales & Purchase Reports', icon: BarChart3 },

  // 📢 Communication
  { to: '/admin/notifications', label: 'Notifications', category: 'Communication', icon: Bell },
  { to: '/admin/reminders', label: 'Reminders', category: 'Communication', icon: Megaphone },
  { to: '/admin/notif-templates', label: 'Notif Templates', category: 'Communication', icon: Mail },
  { to: '/admin/whatsapp-permission', label: 'WhatsApp Permission', category: 'Communication', icon: MessageCircle },
  { to: '/admin/documents', label: 'Documents', category: 'Communication', icon: FolderOpen },
  { to: '/admin/alerts', label: 'Live Alerts', category: 'Communication', icon: AlertTriangle },

  // 🛠️ System & Security
  { to: '/admin/session', label: 'Admin Session', category: 'System & Security', icon: UserCog },
  { to: '/admin/access-matrix', label: 'Access Matrix', category: 'System & Security', icon: TableProperties },
  { to: '/admin/audit', label: 'Audit Logs', category: 'System & Security', icon: ShieldCheck },
  { to: '/admin/security', label: 'Security Checklist', category: 'System & Security', icon: ShieldCheck },
  { to: '/admin/rls-guide', label: 'RLS Guide', category: 'System & Security', icon: ShieldCheck },
  { to: '/admin/integrity', label: 'Integrity Check', category: 'System & Security', icon: ScanSearch },
  { to: '/admin/uniqueness', label: 'Uniqueness Check', category: 'System & Security', icon: Hash },
  { to: '/admin/concurrency', label: 'Concurrency Info', category: 'System & Security', icon: GitBranch },
  { to: '/admin/security-signoff', label: 'Security Sign-off', category: 'System & Security', icon: ShieldCheck },
  { to: '/admin/retention', label: 'Data Retention', category: 'System & Security', icon: Archive },

  // ⚙️ System / Settings
  { to: '/admin/modules', label: 'Module Directory', category: 'System / Settings', icon: LayoutGrid },
  { to: '/admin/feature-flags', label: 'Feature Flags', category: 'System / Settings', icon: ToggleLeft },
  { to: '/admin/maintenance', label: 'Maintenance', category: 'System / Settings', icon: Construction },
  { to: '/admin/table-counts', label: 'Table Counts', category: 'System / Settings', icon: Table2 },
  { to: '/admin/health', label: 'System Health', category: 'System / Settings', icon: Activity },
  { to: '/admin/performance', label: 'Performance', category: 'System / Settings', icon: Gauge },
  { to: '/admin/quality-gate', label: 'Quality Gate', category: 'System / Settings', icon: BadgeCheck },
  { to: '/admin/system-map', label: 'System Map', category: 'System / Settings', icon: Map },
  { to: '/admin/settings', label: 'Settings', category: 'System / Settings', icon: Settings },
  { to: '/admin/version', label: 'Version', category: 'System / Settings', icon: Tag },

  // 📚 Help / Information
  { to: '/admin/about', label: 'About Business', category: 'Help / Information', icon: Info },
  { to: '/admin/shop-contact', label: 'Shop Contact', category: 'Help / Information', icon: Phone },
  { to: '/admin/shortcuts', label: 'Shortcuts', category: 'Help / Information', icon: Keyboard },
  { to: '/admin/print-help', label: 'Print Help', category: 'Help / Information', icon: Printer },
  { to: '/admin/mobile-tips', label: 'Mobile Tips', category: 'Help / Information', icon: WifiOff },
  { to: '/admin/backup', label: 'Backup Tips', category: 'Help / Information', icon: DatabaseBackup },
  { to: '/admin/debug-tips', label: 'Debug Tips', category: 'Help / Information', icon: Bug },
  { to: '/admin/limitations', label: 'Limitations', category: 'Help / Information', icon: AlertTriangle },
  { to: '/admin/handover', label: 'Handover', category: 'Help / Information', icon: Handshake },
  { to: '/admin/steps-index', label: 'Steps Index', category: 'Help / Information', icon: ListChecks },
  { to: '/admin/e2e', label: 'E2E Checklist', category: 'Help / Information', icon: ListChecks },
  { to: '/admin/golive', label: 'Go-Live Score', category: 'Help / Information', icon: Flag },
  { to: '/admin/demo-flow', label: 'Demo Flow', category: 'Help / Information', icon: ListOrdered },
  { to: '/admin/complete', label: 'COMPLETE', category: 'Help / Information', icon: PartyPopper },

  // ⚠️ Danger Zone
  { to: '/admin/data-reset', label: 'Reset Data', category: 'Danger Zone', icon: Trash2 },
]

// Category emojis for visual hierarchy
const CATEGORY_META: Record<Category, { emoji: string; color: string }> = {
  'Main': { emoji: '🏠', color: 'text-emerald-600' },
  'Farmers & Udhaar': { emoji: '👨‍🌾', color: 'text-emerald-600' },
  'Companies': { emoji: '🏢', color: 'text-blue-600' },
  'Products & Inventory': { emoji: '📦', color: 'text-amber-600' },
  'Billing & Payments': { emoji: '🧾', color: 'text-purple-600' },
  'Sales & Purchase Reports': { emoji: '📊', color: 'text-indigo-600' },
  'Communication': { emoji: '📢', color: 'text-pink-600' },
  'System & Security': { emoji: '🛡️', color: 'text-slate-600' },
  'System / Settings': { emoji: '⚙️', color: 'text-slate-600' },
  'Help / Information': { emoji: '📚', color: 'text-cyan-600' },
  'Danger Zone': { emoji: '⚠️', color: 'text-rose-600' },
}

const CATEGORY_ORDER: readonly Category[] = [
  'Main',
  'Farmers & Udhaar',
  'Companies',
  'Products & Inventory',
  'Billing & Payments',
  'Sales & Purchase Reports',
  'Communication',
  'System & Security',
  'System / Settings',
  'Help / Information',
  'Danger Zone',
] as const

export default function ModuleDirectory() {
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All')

  // Filter by search + category
  const filteredModules = useMemo(() => {
    let result = MODULES

    if (activeCategory !== 'All') {
      result = result.filter((m) => m.category === activeCategory)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.label.toLowerCase().includes(term) ||
          m.category.toLowerCase().includes(term) ||
          m.to.toLowerCase().includes(term)
      )
    }

    return result
  }, [searchTerm, activeCategory])

  // Count per category (based on search filter only)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: MODULES.length }
    CATEGORY_ORDER.forEach((cat) => {
      counts[cat] = MODULES.filter((m) => m.category === cat).length
    })
    return counts
  }, [])

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="text-amber-400 shrink-0" size={28} /> Module Directory
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            Complete sitemap — all {MODULES.length} admin modules
          </p>
        </div>
        <span className="text-xs font-extrabold bg-emerald-800/80 px-3 py-1.5 rounded-full border border-emerald-700 shrink-0 font-mono">
          {filteredModules.length} / {MODULES.length}
        </span>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, category, or URL (e.g. 'Billing', 'Stock', 'ledger')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search module sitemap"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          type="button"
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all shrink-0 ${
            activeCategory === 'All'
              ? 'bg-emerald-900 text-white shadow'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All ({categoryCounts['All']})
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat]
          const isActive = activeCategory === cat
          const isDanger = cat === 'Danger Zone'

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1 ${
                isActive
                  ? isDanger
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-emerald-900 text-white shadow'
                  : isDanger
                    ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{cat.split(' ')[0]}</span>
              <span className="text-[9px] opacity-75 font-mono">({categoryCounts[cat]})</span>
            </button>
          )
        })}
      </div>

      {/* Categorized Module Sections */}
      <div className="space-y-6">
        {filteredModules.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-semibold">
            No modules found matching "{searchTerm}"
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const catModules = filteredModules.filter((m) => m.category === cat)
            if (catModules.length === 0) return null

            const meta = CATEGORY_META[cat]
            const isDanger = cat === 'Danger Zone'

            return (
              <div key={cat} className="space-y-2.5">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1 flex items-center gap-1.5">
                  <span className="text-sm">{meta.emoji}</span>
                  {cat}
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {catModules.length}
                  </span>
                </h2>

                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                  role="list"
                  aria-label={`${cat} modules`}
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
                        className={`group p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[95px] shadow-xs active:scale-[0.98] relative ${
                          isActive
                            ? isDanger
                              ? 'bg-rose-600 border-rose-700 text-white shadow-md'
                              : 'bg-emerald-900 border-emerald-900 text-white shadow-md'
                            : isDanger
                              ? 'bg-white border-rose-200 text-rose-800 hover:border-rose-400 hover:bg-rose-50'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                      >
                        {m.badge && (
                          <span className="absolute top-1.5 right-1.5 text-[8px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-full uppercase shadow-sm">
                            {m.badge}
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          <div
                            className={`p-2 rounded-xl transition-colors ${
                              isActive
                                ? isDanger
                                  ? 'bg-rose-700 text-amber-200'
                                  : 'bg-emerald-800 text-amber-400'
                                : isDanger
                                  ? 'bg-rose-100 group-hover:bg-rose-200 text-rose-600'
                                  : 'bg-slate-100 group-hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <ChevronRight
                            size={14}
                            className={`transition-transform group-hover:translate-x-0.5 ${
                              isActive
                                ? 'text-white/70'
                                : isDanger
                                  ? 'text-rose-300 group-hover:text-rose-500'
                                  : 'text-slate-300 group-hover:text-emerald-600'
                            }`}
                          />
                        </div>

                        <div>
                          <span
                            className={`font-bold text-[11px] block leading-tight ${
                              isActive ? 'text-white' : isDanger ? 'text-rose-900' : 'text-slate-900'
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

      {/* Footer Stats */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
        <p className="text-[11px] text-slate-500 font-medium">
          Total <strong className="text-emerald-800">{MODULES.length} modules</strong> across{' '}
          <strong className="text-emerald-800">{CATEGORY_ORDER.length} categories</strong>
          {' · '}
          Showing <strong>{filteredModules.length}</strong>
          {activeCategory !== 'All' && (
            <>
              {' · '}filter: <strong className="text-emerald-800">{activeCategory}</strong>
            </>
          )}
        </p>
      </div>
    </div>
  )
}