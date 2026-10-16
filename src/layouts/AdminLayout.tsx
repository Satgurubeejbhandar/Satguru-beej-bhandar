// src/layouts/AdminLayout.tsx
import { useState, useEffect, useRef, useMemo, useCallback, type FC } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAdminSessionGuard } from '../lib/useAdminSessionGuard'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { UserSearch } from 'lucide-react';
import {
  Users, Receipt, Package, Truck, BarChart3, Settings, ShieldCheck,
  LogOut, Menu, X, Bell, AlertTriangle, Store, Building2, IndianRupee,
  FileText, RotateCcw, MapPin, BookOpen, Clock, Sparkles, Megaphone,
  Share2, KeyRound, ScrollText, UserX, Gauge, Ban, Search, Clipboard,
  Wallet, CalendarDays, CalendarRange, PackageSearch, Skull, ListOrdered,
  PieChart, Mail, FolderOpen, UserCog, ListChecks, Percent, Download,
  ScanSearch, Hash, Info, TableProperties, Rocket, Archive, Flag, Map,
  DatabaseBackup, Phone, Keyboard, Tag, Printer, WifiOff, Bug, ToggleLeft,
  Construction, Table2, LayoutGrid, Trash2, Handshake, BadgeCheck,
  PartyPopper, Calculator, Home, HelpCircle, ChevronDown, Landmark,
  Activity, MessageCircle, GitBranch, ClipboardCheck, BookMarked, Ruler, Award, FileWarning, CalendarClock, RefreshCw,
  TrendingUp, FileSignature,
  CreditCard
} from 'lucide-react'
import toast from 'react-hot-toast'

interface NavItem {
  readonly name: string
  readonly path: string
  readonly icon: React.ComponentType<{ size?: number; className?: string }>
  readonly exact?: boolean
  readonly badge?: string
}

interface NavCategory {
  readonly id: string
  readonly label: string
  readonly shortLabel: string
  readonly emoji: string
  readonly icon: React.ComponentType<{ size?: number; className?: string }>
  readonly items: readonly NavItem[]
  readonly isDanger?: boolean
}

const NAV_CATEGORIES: readonly NavCategory[] = [
  {
    id: 'main',
    label: 'Main',
    shortLabel: 'Main',
    emoji: '🏠',
    icon: Home,
    items: [
      { name: 'Dashboard', path: '/admin', icon: Store, exact: true },
      { name: 'Quick Actions', path: '/admin/quick', icon: Rocket },
      { name: 'Module Directory', path: '/admin/modules', icon: LayoutGrid },
      { name: 'Getting Started', path: '/admin/getting-started', icon: BookMarked },
      { name: 'डेली बही खाता', path: '/admin/bahi-khata', icon: BookOpen },
    ],
  },
  {
    id: 'farmers',
    label: 'Farmers & Udhaar',
    shortLabel: 'Farmers',
    emoji: '👨‍🌾',
    icon: Users,
    items: [
      { name: 'Farmers & Udhaar', path: '/admin/farmers', icon: Users },
      { name: 'Group Udhaar', path: '/admin/groups', icon: Users },
      { name: 'Farmer Ledger', path: '/admin/ledger', icon: FileText },
      { name: 'Farmer Status', path: '/admin/farmer-status', icon: UserX },
      { name: 'Farmer Card', path: '/admin/farmer-cards', icon: CreditCard },
      { name: 'Credit Limit', path: '/admin/credit-limit', icon: Gauge },
      { name: 'Outstanding Report', path: '/admin/outstanding', icon: IndianRupee },
      { name: 'Farmer Search', path: '/admin/farmer-search', icon: Search },
      { name: 'Interest Report', path: '/admin/interest-report', icon: Percent },
      { name: 'Cashback Report', path: '/admin/cashback-report', icon: Sparkles },
      { name: 'Group Usage', path: '/admin/group-usage', icon: Users },
      { name: 'Group Balance Sync', path: '/admin/group-sync', icon: RefreshCw },
      { name: 'PIN Reset', path: '/admin/pin-reset', icon: KeyRound },
      { name: 'Village-wise', path: '/admin/villages', icon: MapPin },
      { name: 'Farmer-wise Sales', path: '/admin/farmer-sales', icon: TrendingUp },
      { name: 'Export Farmers CSV', path: '/admin/export-farmers', icon: Download },
    ],
  },
  {
    id: 'companies',
    label: 'Companies',
    shortLabel: 'Companies',
    emoji: '🏢',
    icon: Building2,
    items: [
      { name: 'Companies', path: '/admin/companies', icon: Building2 },
      { name: 'Company Ledger', path: '/admin/company-ledger', icon: FileText },
      { name: 'Company Payment', path: '/admin/company-payment', icon: Wallet },
      { name: 'Company Summary', path: '/admin/company-summary', icon: Building2 },
      { name: 'Purchase Return', path: '/admin/company-purchase-return', icon: Truck },
      { name: 'Letterpads', path: '/admin/letterpad', icon: FileSignature, badge: 'New' },
      { name: 'Bank Accounts', path: '/admin/bank-accounts', icon: Landmark, badge: 'New' },
    ],
  },
  {
    id: 'inventory',
    label: 'Products & Inventory',
    shortLabel: 'Inventory',
    emoji: '📦',
    icon: Package,
    items: [
      { name: 'Products', path: '/admin/products', icon: Package },
      { name: 'Units', path: '/admin/units', icon: Ruler },
      { name: 'Schemes / Slabs', path: '/admin/schemes', icon: Award },
      { name: 'SARA SAMAN', path: '/admin/sara-saman', icon: Package, badge: 'Stock' },
      { name: 'Purchase / Stock In', path: '/admin/purchase', icon: Truck },
      { name: 'Batches / FEFO', path: '/admin/batches', icon: Package },
      { name: 'Stock Ledger', path: '/admin/stock-ledger', icon: BookOpen },
      { name: 'Stock Register', path: '/admin/stock-register', icon: BookOpen },
      { name: 'Stock Valuation', path: '/admin/valuation', icon: PieChart },
      { name: 'Reorder List', path: '/admin/reorder', icon: ListOrdered },
      { name: 'Damage Product', path: '/admin/damage-product', icon: AlertTriangle, badge: 'Stock' },
      { name: 'Returns', path: '/admin/returns', icon: RotateCcw },
      { name: 'Expiry Report', path: '/admin/expiry-report', icon: Clock },
      { name: 'Expired Write-off', path: '/admin/expired-writeoff', icon: Skull },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Payments',
    shortLabel: 'Billing',
    emoji: '🧾',
    icon: Receipt,
    items: [
      { name: 'Billing POS', path: '/admin/bills', icon: Receipt },
      { name: 'Payments', path: '/admin/payments', icon: IndianRupee },
      { name: 'Payment History', path: '/admin/payment-history', icon: ScrollText },
      { name: 'Payment Register', path: '/admin/payment-register', icon: Wallet },
      { name: 'Bill Void', path: '/admin/bill-void', icon: Ban },
      { name: 'Bill Series', path: '/admin/bill-series', icon: Hash },
      { name: 'Bill WhatsApp', path: '/admin/bill-whatsapp', icon: Share2 },
      { name: 'Bill Warning Editor', path: '/admin/bill-warning', icon: FileWarning },
      { name: 'Printable Bill', path: '/admin/print-bill', icon: Printer },
      { name: 'Due Date Engine', path: '/admin/due-engine', icon: CalendarClock },
      { name: 'Rate Override Audit', path: '/admin/rate-audit', icon: ClipboardCheck },
    ],
  },
  {
    id: 'reports',
    label: 'Sales & Purchase Reports',
    shortLabel: 'Reports',
    emoji: '📊',
    icon: BarChart3,
    items: [
      { name: 'Purchase Register', path: '/admin/purchase-register', icon: Clipboard },
      { name: 'Today Payment Sales', path: '/admin/today-payment-sales', icon: IndianRupee },
      { name: 'Sales Register', path: '/admin/sales-register', icon: ScrollText },
      { name: 'Daily Sales', path: '/admin/daily-sales', icon: CalendarDays },
      { name: 'Monthly Sales', path: '/admin/monthly-sales', icon: CalendarRange },
      { name: 'Product Sales', path: '/admin/product-sales', icon: PackageSearch },
      { name: 'GST Calculation', path: '/admin/gst-calculation', icon: Calculator },
      { name: 'Reports Hub', path: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    shortLabel: 'Comm',
    emoji: '📢',
    icon: Megaphone,
    items: [
      { name: 'Notifications', path: '/admin/notifications', icon: Bell },
      { name: 'Reminders', path: '/admin/reminders', icon: Megaphone },
      { name: 'Notif Templates', path: '/admin/notif-templates', icon: Mail },
      { name: 'WhatsApp Permission', path: '/admin/whatsapp-permission', icon: MessageCircle },
      { name: 'Documents', path: '/admin/documents', icon: FolderOpen },
      { name: 'Live Alerts', path: '/admin/alerts', icon: AlertTriangle },
    ],
  },
  {
    id: 'security',
    label: 'System & Security',
    shortLabel: 'Security',
    emoji: '🛠️',
    icon: ShieldCheck,
    items: [
      { name: 'Admin Session', path: '/admin/session', icon: UserCog },
      { name: 'Access Matrix', path: '/admin/access-matrix', icon: TableProperties },
      { name: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
      { name: 'Security Checklist', path: '/admin/security', icon: ShieldCheck },
      { name: 'RLS Guide', path: '/admin/rls-guide', icon: ShieldCheck },
      { name: 'Integrity Check', path: '/admin/integrity', icon: ScanSearch },
      { name: 'Uniqueness Check', path: '/admin/uniqueness', icon: Hash },
      { name: 'Concurrency Info', path: '/admin/concurrency', icon: GitBranch },
      { name: 'Security Sign-off', path: '/admin/security-signoff', icon: ShieldCheck },
      { name: 'Data Retention', path: '/admin/retention', icon: Archive },
    ],
  },
  {
    id: 'settings',
    label: 'System / Settings',
    shortLabel: 'Settings',
    emoji: '⚙️',
    icon: Settings,
    items: [
      { name: 'Feature Flags', path: '/admin/feature-flags', icon: ToggleLeft },
      { name: 'Maintenance', path: '/admin/maintenance', icon: Construction },
      { name: 'Table Counts', path: '/admin/table-counts', icon: Table2 },
      { name: 'System Health', path: '/admin/health', icon: Activity },
      { name: 'Performance', path: '/admin/performance', icon: Gauge },
      { name: 'Quality Gate', path: '/admin/quality-gate', icon: BadgeCheck },
      { name: 'System Map', path: '/admin/system-map', icon: Map },
      { name: 'Settings', path: '/admin/settings', icon: Settings },
      { name: 'Version', path: '/admin/version', icon: Tag },
    ],
  },
  {
    id: 'help',
    label: 'Help / Information',
    shortLabel: 'Help',
    emoji: '📚',
    icon: HelpCircle,
    items: [
      { name: 'About Business', path: '/admin/about', icon: Info },
      { name: 'Shop Contact', path: '/admin/shop-contact', icon: Phone },
      { name: 'Shortcuts', path: '/admin/shortcuts', icon: Keyboard },
      { name: 'Print Help', path: '/admin/print-help', icon: Printer },
      { name: 'Mobile Tips', path: '/admin/mobile-tips', icon: WifiOff },
      { name: 'Backup Tips', path: '/admin/backup', icon: DatabaseBackup },
      { name: 'Debug Tips', path: '/admin/debug-tips', icon: Bug },
      { name: 'Limitations', path: '/admin/limitations', icon: AlertTriangle },
      { name: 'Handover', path: '/admin/handover', icon: Handshake },
      { name: 'Steps Index', path: '/admin/steps-index', icon: ListChecks },
      { name: 'E2E Checklist', path: '/admin/e2e', icon: ListChecks },
      { name: 'Go-Live Score', path: '/admin/golive', icon: Flag },
      { name: 'Demo Flow', path: '/admin/demo-flow', icon: ListOrdered },
      { name: 'COMPLETE', path: '/admin/complete', icon: PartyPopper },
    ],
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    shortLabel: 'Danger',
    emoji: '⚠️',
    icon: Trash2,
    isDanger: true,
    items: [
      { name: 'Reset Data', path: '/admin/data-reset', icon: Trash2 },
    ],
  },
]

const AdminLayout: FC = () => {
  const { signOut, user, role, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)
  const [mobileOpenCategoryId, setMobileOpenCategoryId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)

  const isMounted = useRef(true)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useAdminSessionGuard()
  useKeyboardShortcuts()

  // Auth guard
  useEffect(() => {
    if (!loading && role !== 'admin') {
      toast.error('Admin access required. Redirecting...', { id: 'auth_redirect' })
      navigate('/login', { replace: true })
    }
  }, [role, loading, navigate])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // Close desktop dropdown on route change
  useEffect(() => {
    setOpenCategoryId(null)
    setDropdownPos(null)
    setMobileMenuOpen(false)
    setMobileOpenCategoryId(null)
  }, [location.pathname])

  // Outside click (desktop dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedButton = Object.values(buttonRefs.current).some(
        (btn) => btn && btn.contains(target)
      )
      const clickedDropdown = dropdownRef.current?.contains(target)
      if (!clickedButton && !clickedDropdown) {
        setOpenCategoryId(null)
        setDropdownPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenCategoryId(null)
        setDropdownPos(null)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Reposition desktop dropdown on resize
  useEffect(() => {
    if (!openCategoryId) return
    const updatePos = () => {
      const btn = buttonRefs.current[openCategoryId]
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const dropdownWidth = 280
      let left = rect.left
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8
      }
      if (left < 8) left = 8
      setDropdownPos({ top: rect.bottom + 4, left })
    }
    window.addEventListener('resize', updatePos)
    return () => window.removeEventListener('resize', updatePos)
  }, [openCategoryId])

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    setOpenCategoryId(null)
    setDropdownPos(null)
    const logoutToastId = toast.loading('Signing out safely…')
    try {
      await signOut()
      if (isMounted.current) {
        toast.success('Signed out successfully', { id: logoutToastId })
        navigate('/login')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error signing out.'
      toast.error(msg, { id: logoutToastId })
      navigate('/login')
    }
  }

  const totalModules = useMemo(
    () => NAV_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0),
    []
  )

  const activeCategoryId = useMemo(() => {
    const currentPath = location.pathname
    for (const cat of NAV_CATEGORIES) {
      for (const item of cat.items) {
        if (item.exact) {
          if (currentPath === item.path) return cat.id
        } else if (
          currentPath === item.path ||
          currentPath.startsWith(item.path + '/')
        ) {
          return cat.id
        }
      }
    }
    return null
  }, [location.pathname])

  const openCategory = openCategoryId
    ? NAV_CATEGORIES.find((c) => c.id === openCategoryId) || null
    : null

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      const cat = NAV_CATEGORIES.find((c) => c.id === categoryId)
      if (!cat) return

      // Single danger item → navigate directly
      if (cat.isDanger && cat.items.length === 1) {
        navigate(cat.items[0].path)
        setOpenCategoryId(null)
        setDropdownPos(null)
        return
      }

      if (openCategoryId === categoryId) {
        setOpenCategoryId(null)
        setDropdownPos(null)
        return
      }

      const btn = buttonRefs.current[categoryId]
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const dropdownWidth = 280
        let left = rect.left
        if (left + dropdownWidth > window.innerWidth - 8) {
          left = window.innerWidth - dropdownWidth - 8
        }
        if (left < 8) left = 8
        setDropdownPos({ top: rect.bottom + 4, left })
      }
      setOpenCategoryId(categoryId)
    },
    [navigate, openCategoryId]
  )

  const handleItemClick = useCallback(() => {
    setOpenCategoryId(null)
    setDropdownPos(null)
    setMobileMenuOpen(false)
    setMobileOpenCategoryId(null)
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-100 z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading SATGURU BEEJ BHANDAR...</p>
        </div>
      </div>
    )
  }

  if (role !== 'admin') {
    return null
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col bg-slate-100 font-sans">

      {/* ═══════════════════════ TOP HEADER ═══════════════════════ */}
      <header className="bg-white border-b shrink-0 z-40 shadow-sm">
        {/* Row 1: Logo + Admin */}
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-black text-base shadow shrink-0">
              🌾
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-[11px] sm:text-xs md:text-sm text-emerald-950 leading-tight uppercase tracking-wide truncate">
                SATGURU BEEJ BHANDAR
              </h1>
              <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium truncate">
                Daloosar, Sardarshahar (Churu)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="hidden lg:inline-flex px-2 py-0.5 bg-amber-100 text-amber-950 text-[9px] font-black rounded border border-amber-200 uppercase">
              PROv1.0 Elite (Made by Md verma)
            </span>

            <div className="hidden sm:flex items-center gap-1 px-1.5 py-1 bg-amber-50 text-amber-900 text-[9px] font-bold rounded-md border border-amber-200">
              <AlertTriangle size={10} className="text-amber-600" />
              <span>60D</span>
            </div>

            <button
  type="button"
  onClick={() => navigate('/admin/notifications')}
  className="p-2 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 relative outline-none transition-colors"
  aria-label="Notifications"
  title="Notifications Center"
>
  <Bell size={16} />
  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 border border-white rounded-full" />
</button>
{/* Desktop admin info */}
<div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-200">
  
  {/* ⬇️ नया बटन यहाँ जोड़ा गया है ⬇️ */}
  <button
    type="button"
    onClick={() => navigate('/admin/farmer-view')}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-all font-bold text-[10px] mr-1"
  >
    <UserSearch size={14} />
    Farmer Ledger
  </button>
  {/* ⬆️ ----------------------- ⬆️ */}

  <div className="text-right">
    <p className="font-bold text-[10px] text-emerald-950">Admin</p>
    <p
      className="text-[8px] text-slate-500 truncate max-w-[110px]"
      title={user?.email ?? undefined}
    >
      {user?.email ?? 'session'}
    </p>
  </div>
  <button
    type="button"
    onClick={handleLogout}
    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg outline-none"
    title="Log Out"
    aria-label="Log Out"
  >
    <LogOut size={15} />
  </button>
</div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2.5 text-emerald-800 hover:bg-emerald-50 rounded-xl outline-none active:bg-emerald-100"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Row 2: Desktop category bar */}
        <div className="hidden md:block bg-emerald-900 border-t border-emerald-800">
          <div className="px-2 py-1 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
              {NAV_CATEGORIES.map((category) => {
                const CategoryIcon = category.icon
                const isActive = activeCategoryId === category.id
                const isOpen = openCategoryId === category.id

                let buttonClass =
                  'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap outline-none '
                if (isActive) {
                  buttonClass += category.isDanger
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-amber-500 text-emerald-950 shadow'
                } else if (isOpen) {
                  buttonClass += category.isDanger
                    ? 'bg-rose-800 text-white'
                    : 'bg-emerald-700 text-amber-200'
                } else {
                  buttonClass += category.isDanger
                    ? 'text-rose-200 hover:bg-rose-900 hover:text-rose-100'
                    : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
                }

                return (
                  <button
                    key={category.id}
                    ref={(el) => {
                      buttonRefs.current[category.id] = el
                    }}
                    type="button"
                    onClick={() => handleCategoryClick(category.id)}
                    className={buttonClass}
                    aria-expanded={isOpen}
                    aria-haspopup={category.items.length > 1}
                  >
                    <span className="text-xs leading-none">{category.emoji}</span>
                    <CategoryIcon size={11} />
                    <span>{category.shortLabel}</span>
                    {category.items.length > 1 && (
                      <ChevronDown
                        size={10}
                        className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                    <span
                      className={`text-[8px] font-mono px-1 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : category.isDanger
                            ? 'bg-rose-950 text-rose-300'
                            : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {category.items.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ DESKTOP FIXED DROPDOWN ═══════════════ */}
      {openCategory && dropdownPos && openCategory.items.length > 1 && (
        <div
          ref={dropdownRef}
          className={`fixed z-[100] w-[280px] rounded-xl shadow-2xl border overflow-hidden bg-white ${
            openCategory.isDanger ? 'border-rose-200' : 'border-emerald-200'
          }`}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          role="menu"
        >
          <div
            className={`px-3 py-2 border-b flex items-center gap-2 ${
              openCategory.isDanger
                ? 'bg-rose-50 border-rose-100'
                : 'bg-emerald-50 border-emerald-100'
            }`}
          >
            <span className="text-sm">{openCategory.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-[10px] font-black uppercase tracking-wider truncate ${
                  openCategory.isDanger ? 'text-rose-800' : 'text-emerald-900'
                }`}
              >
                {openCategory.label}
              </h3>
              <p className="text-[8px] text-slate-500 font-medium">
                {openCategory.items.length} modules
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenCategoryId(null)
                setDropdownPos(null)
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {openCategory.items.map((item) => {
              const ItemIcon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={handleItemClick}
                  className={({ isActive: itemActive }) => {
                    const base =
                      'flex items-center justify-between gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors border-l-4'
                    if (itemActive) {
                      return openCategory.isDanger
                        ? `${base} bg-rose-100 text-rose-900 font-bold border-rose-600`
                        : `${base} bg-emerald-100 text-emerald-950 font-bold border-emerald-600`
                    }
                    return openCategory.isDanger
                      ? `${base} text-rose-700 hover:bg-rose-50 border-transparent`
                      : `${base} text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 border-transparent`
                  }}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ItemIcon
                      size={14}
                      className={`shrink-0 ${
                        openCategory.isDanger ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[8px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded-full border border-amber-200 uppercase shrink-0">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ MOBILE DRAWER ═══════════════ */}
      {/* Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel — slides from LEFT, full height */}
      <div
        className={`
          md:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px]
          bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="bg-emerald-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-black text-sm text-white truncate">SATGURU BEEJ BHANDAR</p>
            <p className="text-[10px] text-emerald-300 truncate">
              {user?.email ?? 'Admin'} · {totalModules} modules
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="p-2.5 bg-rose-600 active:bg-rose-700 text-white rounded-xl"
              title="Log Out"
              aria-label="Log Out"
            >
              <LogOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 text-emerald-200 active:bg-emerald-800 rounded-xl"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer body — scrollable accordion */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <nav className="p-2 space-y-1.5 pb-8" aria-label="Mobile Navigation">
            {NAV_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon
              const isOpen = mobileOpenCategoryId === category.id
              const isActive = activeCategoryId === category.id
              const isSingle = category.items.length === 1

              let headerClass =
                'w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-colors '
              if (isActive) {
                headerClass += category.isDanger
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500 text-emerald-950'
              } else if (category.isDanger) {
                headerClass += 'bg-rose-50 text-rose-800 active:bg-rose-100'
              } else {
                headerClass += 'bg-slate-50 text-emerald-900 active:bg-emerald-50'
              }

              return (
                <div
                  key={category.id}
                  className={`rounded-xl overflow-hidden border ${
                    category.isDanger ? 'border-rose-200' : 'border-slate-200'
                  }`}
                >
                  {/* Category header button — large touch target */}
                  <button
                    type="button"
                    onClick={() => {
                      if (category.isDanger && isSingle) {
                        navigate(category.items[0].path)
                        setMobileMenuOpen(false)
                        return
                      }
                      setMobileOpenCategoryId(isOpen ? null : category.id)
                    }}
                    className={headerClass}
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">{category.emoji}</span>
                      <CategoryIcon size={16} className="shrink-0" />
                      <span className="truncate text-[13px]">{category.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : category.isDanger
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {category.items.length}
                      </span>
                      {!isSingle && (
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isOpen && !isSingle && (
                    <div className="bg-white border-t border-slate-100">
                      {category.items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.exact}
                            onClick={handleItemClick}
                            className={({ isActive: itemActive }) => {
                              const base =
                                'flex items-center justify-between px-4 py-3.5 text-[13px] font-medium border-l-4 transition-colors active:bg-slate-50'
                              if (itemActive) {
                                return category.isDanger
                                  ? `${base} bg-rose-50 text-rose-900 font-bold border-rose-600`
                                  : `${base} bg-emerald-50 text-emerald-950 font-bold border-emerald-600`
                              }
                              return `${base} text-slate-700 border-transparent`
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <ItemIcon
                                size={16}
                                className={`shrink-0 ${
                                  category.isDanger ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {item.badge && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ═══════════════ PAGE CONTENT ═══════════════ */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-5 bg-slate-50">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout