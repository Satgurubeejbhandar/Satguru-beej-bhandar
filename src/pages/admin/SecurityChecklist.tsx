import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck, CheckCircle2, Circle, Search, RotateCcw, CheckSquare,
  Copy, Lock, Shield, Eye, Database, KeyRound, FileText, Users,
  Receipt, Package, AlertTriangle, Clock, Wifi, Server, GitBranch,
  UserCheck, Trash2, Download, Upload, Globe, Smartphone, Printer,
  Bell, MessageSquare, Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions & Checklist Dataset                              */
/* ------------------------------------------------------------------ */

export type CategoryType =
  | 'All'
  | 'Auth & PIN'
  | 'RLS & Access'
  | 'Privacy & Data'
  | 'Financial & Stock'
  | 'Audit & Infra'
  | 'Communication'
  | 'Backup & Recovery'
  | 'UI & Session'
  | 'Compliance'

export interface SecurityRequirement {
  id: string
  num: number
  title: string
  category: Exclude<CategoryType, 'All'>
  icon: React.ComponentType<{ size?: number; className?: string }>
  critical?: boolean
}

const SECURITY_REQUIREMENTS: SecurityRequirement[] = [
  /* ═══════════════════ AUTH & PIN (12 rules) ═══════════════════ */
  { id: 'sec-1', num: 1, title: 'Admin auth via Supabase Auth only (no hardcoded password)', category: 'Auth & PIN', icon: KeyRound, critical: true },
  { id: 'sec-2', num: 2, title: 'Farmer PIN hashed with bcrypt (hash_pin / verify_pin RPC)', category: 'Auth & PIN', icon: Lock, critical: true },
  { id: 'sec-3', num: 3, title: 'PIN lockout after 3 fails / 10 minutes (server-side enforced)', category: 'Auth & PIN', icon: Shield, critical: true },
  { id: 'sec-4', num: 4, title: 'Admin password minimum 12 chars with complexity rules', category: 'Auth & PIN', icon: KeyRound },
  { id: 'sec-5', num: 5, title: 'Password reset flow via secure email link (no SMS tokens)', category: 'Auth & PIN', icon: Mail },
  { id: 'sec-6', num: 6, title: 'Session timeout: Admin 2 hours, Farmer 30 minutes', category: 'Auth & PIN', icon: Clock, critical: true },
  { id: 'sec-7', num: 7, title: 'JWT token refresh handled securely by Supabase client', category: 'Auth & PIN', icon: KeyRound },
  { id: 'sec-8', num: 8, title: 'Multi-device login allowed but logged in audit', category: 'Auth & PIN', icon: Smartphone },
  { id: 'sec-9', num: 9, title: 'Logout clears all localStorage/sessionStorage + Supabase session', category: 'Auth & PIN', icon: Lock },
  { id: 'sec-10', num: 10, title: 'Failed login attempts logged with IP + timestamp', category: 'Auth & PIN', icon: AlertTriangle },
  { id: 'sec-11', num: 11, title: 'Farmer PIN never stored in plaintext (DB or logs)', category: 'Auth & PIN', icon: Lock, critical: true },
  { id: 'sec-12', num: 12, title: 'Admin role verified from backend (not localStorage trust)', category: 'Auth & PIN', icon: UserCheck, critical: true },

  /* ═══════════════════ RLS & ACCESS (14 rules) ═══════════════════ */
  { id: 'sec-13', num: 13, title: 'Row Level Security (RLS) enabled on all business tables', category: 'RLS & Access', icon: Database, critical: true },
  { id: 'sec-14', num: 14, title: 'Farmer can access only own portal session data', category: 'RLS & Access', icon: Eye, critical: true },
  { id: 'sec-15', num: 15, title: 'Guest: public site + udhaar scheme only; private portal locked', category: 'RLS & Access', icon: Lock },
  { id: 'sec-16', num: 16, title: 'Inventory / purchase / company bills: Admin role only', category: 'RLS & Access', icon: Shield, critical: true },
  { id: 'sec-17', num: 17, title: 'Billing POS write access: Admin role only', category: 'RLS & Access', icon: Receipt, critical: true },
  { id: 'sec-18', num: 18, title: 'Payment entry/edit: Admin role only (RLS verified)', category: 'RLS & Access', icon: Shield, critical: true },
  { id: 'sec-19', num: 19, title: 'Group Udhaar: members cannot view other members data', category: 'RLS & Access', icon: Users },
  { id: 'sec-20', num: 20, title: 'Stock ledger: Admin read/write; farmers no access', category: 'RLS & Access', icon: Package },
  { id: 'sec-21', num: 21, title: 'Audit logs: Admin read-only; no DELETE possible', category: 'RLS & Access', icon: Shield, critical: true },
  { id: 'sec-22', num: 22, title: 'Company master data: Admin role only (CRUD)', category: 'RLS & Access', icon: Database },
  { id: 'sec-23', num: 23, title: 'Bank accounts: Admin role only; masked in listings', category: 'RLS & Access', icon: Lock },
  { id: 'sec-24', num: 24, title: 'Public endpoints (mandi, schemes, MSP) read-only, no auth', category: 'RLS & Access', icon: Globe },
  { id: 'sec-25', num: 25, title: 'Farmer portal uses sessionStorage (not localStorage) for PIN session', category: 'RLS & Access', icon: Smartphone },
  { id: 'sec-26', num: 26, title: 'RPC functions use SECURITY DEFINER only where justified', category: 'RLS & Access', icon: Server, critical: true },

  /* ═══════════════════ PRIVACY & DATA (12 rules) ═══════════════════ */
  { id: 'sec-27', num: 27, title: 'No WhatsApp history share on Farmer Portal for privacy', category: 'Privacy & Data', icon: Eye },
  { id: 'sec-28', num: 28, title: 'Admin WhatsApp bill/payment share only (no Aadhaar numbers)', category: 'Privacy & Data', icon: Eye, critical: true },
  { id: 'sec-29', num: 29, title: 'Aadhaar masked in UI (XXXX-XXXX-1234)', category: 'Privacy & Data', icon: Eye, critical: true },
  { id: 'sec-30', num: 30, title: 'Mobile numbers masked in exports/reports (optional admin override)', category: 'Privacy & Data', icon: Eye },
  { id: 'sec-31', num: 31, title: 'Farmer address not shared in bulk exports without consent', category: 'Privacy & Data', icon: FileText },
  { id: 'sec-32', num: 32, title: 'PII fields excluded from error logs & console output', category: 'Privacy & Data', icon: Eye, critical: true },
  { id: 'sec-33', num: 33, title: 'Farmer card QR contains only farmer_id (no sensitive data)', category: 'Privacy & Data', icon: Smartphone },
  { id: 'sec-34', num: 34, title: 'Bill printouts for farmer show only their own data', category: 'Privacy & Data', icon: Printer },
  { id: 'sec-35', num: 35, title: 'CSV exports require admin confirmation + logged', category: 'Privacy & Data', icon: Download },
  { id: 'sec-36', num: 36, title: 'Data deletion requests: soft-delete with audit trail', category: 'Privacy & Data', icon: Trash2 },
  { id: 'sec-37', num: 37, title: 'No third-party analytics tracking farmer personal data', category: 'Privacy & Data', icon: Globe },
  { id: 'sec-38', num: 38, title: 'Browser dev tools do not expose JWT/service keys', category: 'Privacy & Data', icon: Eye, critical: true },

  /* ═══════════════════ FINANCIAL & STOCK (14 rules) ═══════════════════ */
  { id: 'sec-39', num: 39, title: 'Stock deduction via deduct_stock RPC (FOR UPDATE lock enabled)', category: 'Financial & Stock', icon: Database, critical: true },
  { id: 'sec-40', num: 40, title: 'Financial history not overwritten — void/return/adjust only', category: 'Financial & Stock', icon: Database, critical: true },
  { id: 'sec-41', num: 41, title: 'Farmer ID change keeps UUID + history + audit intact', category: 'Financial & Stock', icon: Database, critical: true },
  { id: 'sec-42', num: 42, title: 'Bill void requires admin reason + logged to audit_logs', category: 'Financial & Stock', icon: AlertTriangle, critical: true },
  { id: 'sec-43', num: 43, title: 'Payment entry immutable after 24 hours (admin reversal only)', category: 'Financial & Stock', icon: Lock },
  { id: 'sec-44', num: 44, title: 'Credit limit enforced server-side (not frontend only)', category: 'Financial & Stock', icon: Shield, critical: true },
  { id: 'sec-45', num: 45, title: 'Interest calculation uses server-side RPC (consistent rules)', category: 'Financial & Stock', icon: Database },
  { id: 'sec-46', num: 46, title: 'Cashback credits logged with source bill reference', category: 'Financial & Stock', icon: FileText },
  { id: 'sec-47', num: 47, title: 'Bill numbers follow strict sequence (no gaps or duplicates)', category: 'Financial & Stock', icon: Receipt, critical: true },
  { id: 'sec-48', num: 48, title: 'Rate override requires reason + logged in rate_override_logs', category: 'Financial & Stock', icon: AlertTriangle },
  { id: 'sec-49', num: 49, title: 'Batch/FEFO logic prevents expired stock sale', category: 'Financial & Stock', icon: Package, critical: true },
  { id: 'sec-50', num: 50, title: 'Group Udhaar balance sync automated with reconciliation check', category: 'Financial & Stock', icon: Users },
  { id: 'sec-51', num: 51, title: 'Opening balance edits locked after FY start', category: 'Financial & Stock', icon: Lock },
  { id: 'sec-52', num: 52, title: 'Negative stock prevented at RPC level (not frontend validation)', category: 'Financial & Stock', icon: Shield, critical: true },

  /* ═══════════════════ AUDIT & INFRA (12 rules) ═══════════════════ */
  { id: 'sec-53', num: 53, title: 'Service role key never in frontend bundle (.env safety)', category: 'Audit & Infra', icon: KeyRound, critical: true },
  { id: 'sec-54', num: 54, title: 'Audit logs triggered for sensitive admin actions', category: 'Audit & Infra', icon: Shield, critical: true },
  { id: 'sec-55', num: 55, title: 'Environment variables (.env) not committed to Git', category: 'Audit & Infra', icon: GitBranch, critical: true },
  { id: 'sec-56', num: 56, title: 'HTTPS enforced on all production endpoints', category: 'Audit & Infra', icon: Lock, critical: true },
  { id: 'sec-57', num: 57, title: 'CORS configured to allow only trusted domains', category: 'Audit & Infra', icon: Globe },
  { id: 'sec-58', num: 58, title: 'Supabase Edge Functions use proper auth checks', category: 'Audit & Infra', icon: Server },
  { id: 'sec-59', num: 59, title: 'Database connection pool limited (prevents DoS)', category: 'Audit & Infra', icon: Database },
  { id: 'sec-60', num: 60, title: 'Rate limiting on auth endpoints (login, PIN verify)', category: 'Audit & Infra', icon: Shield, critical: true },
  { id: 'sec-61', num: 61, title: 'npm dependencies audited (no known CVEs)', category: 'Audit & Infra', icon: Package },
  { id: 'sec-62', num: 62, title: 'Audit logs retained minimum 2 years (legal requirement)', category: 'Audit & Infra', icon: Clock },
  { id: 'sec-63', num: 63, title: 'Supabase project API URL + anon key only in frontend', category: 'Audit & Infra', icon: KeyRound },
  { id: 'sec-64', num: 64, title: 'Row count limits on queries (max 500 rows per fetch)', category: 'Audit & Infra', icon: Database },

  /* ═══════════════════ COMMUNICATION (8 rules) ═══════════════════ */
  { id: 'sec-65', num: 65, title: 'WhatsApp opt-in consent recorded per farmer', category: 'Communication', icon: MessageSquare, critical: true },
  { id: 'sec-66', num: 66, title: 'Notification templates reviewed (no PII leaks)', category: 'Communication', icon: Bell },
  { id: 'sec-67', num: 67, title: 'SMS/WhatsApp provider credentials in backend only', category: 'Communication', icon: Lock, critical: true },
  { id: 'sec-68', num: 68, title: 'Bulk notification sends throttled (prevent spam flag)', category: 'Communication', icon: Clock },
  { id: 'sec-69', num: 69, title: 'Unsubscribe link in all marketing notifications', category: 'Communication', icon: Mail },
  { id: 'sec-70', num: 70, title: 'Payment receipt SMS does not contain full account numbers', category: 'Communication', icon: Eye },
  { id: 'sec-71', num: 71, title: 'Notification delivery status logged for audit', category: 'Communication', icon: FileText },
  { id: 'sec-72', num: 72, title: 'Failed delivery retries max 3 attempts, then logged', category: 'Communication', icon: AlertTriangle },

  /* ═══════════════════ BACKUP & RECOVERY (8 rules) ═══════════════════ */
  { id: 'sec-73', num: 73, title: 'Daily automated DB backup enabled in Supabase', category: 'Backup & Recovery', icon: Database, critical: true },
  { id: 'sec-74', num: 74, title: 'Point-in-time recovery (PITR) tested quarterly', category: 'Backup & Recovery', icon: Clock, critical: true },
  { id: 'sec-75', num: 75, title: 'Weekly manual CSV export backup (farmers, bills, payments)', category: 'Backup & Recovery', icon: Download },
  { id: 'sec-76', num: 76, title: 'Backup files stored in separate secure location', category: 'Backup & Recovery', icon: Server },
  { id: 'sec-77', num: 77, title: 'Backup restoration tested at least once per year', category: 'Backup & Recovery', icon: Upload },
  { id: 'sec-78', num: 78, title: 'Disaster recovery plan documented & accessible', category: 'Backup & Recovery', icon: FileText },
  { id: 'sec-79', num: 79, title: 'Database schema migrations version controlled', category: 'Backup & Recovery', icon: GitBranch },
  { id: 'sec-80', num: 80, title: 'Backup encryption at rest + in transit', category: 'Backup & Recovery', icon: Lock, critical: true },

  /* ═══════════════════ UI & SESSION (10 rules) ═══════════════════ */
  { id: 'sec-81', num: 81, title: 'Admin session guard redirects unauthorized to /login', category: 'UI & Session', icon: Shield, critical: true },
  { id: 'sec-82', num: 82, title: 'Idle timeout warning before auto-logout', category: 'UI & Session', icon: Clock },
  { id: 'sec-83', num: 83, title: 'CSRF protection via Supabase (anti-forgery tokens)', category: 'UI & Session', icon: Shield, critical: true },
  { id: 'sec-84', num: 84, title: 'XSS prevention: all user input sanitized (React auto-escape)', category: 'UI & Session', icon: Shield, critical: true },
  { id: 'sec-85', num: 85, title: 'Content Security Policy (CSP) headers configured', category: 'UI & Session', icon: Globe },
  { id: 'sec-86', num: 86, title: 'Click-jacking prevention: X-Frame-Options: DENY', category: 'UI & Session', icon: Shield },
  { id: 'sec-87', num: 87, title: 'Auto-logout on browser tab close (admin session)', category: 'UI & Session', icon: Lock },
  { id: 'sec-88', num: 88, title: 'Loading states prevent duplicate form submissions', category: 'UI & Session', icon: Clock },
  { id: 'sec-89', num: 89, title: 'Error messages do not leak system internals (stack traces)', category: 'UI & Session', icon: Eye, critical: true },
  { id: 'sec-90', num: 90, title: 'Offline detection shows user-friendly warning', category: 'UI & Session', icon: Wifi },

  /* ═══════════════════ COMPLIANCE (12 rules) ═══════════════════ */
  { id: 'sec-91', num: 91, title: 'Data retention policy documented (farmer, bills, logs)', category: 'Compliance', icon: FileText, critical: true },
  { id: 'sec-92', num: 92, title: 'Right to erasure process defined (farmer deletion request)', category: 'Compliance', icon: Trash2 },
  { id: 'sec-93', num: 93, title: 'Terms of service + privacy policy published on public site', category: 'Compliance', icon: FileText, critical: true },
  { id: 'sec-94', num: 94, title: 'Farmer consent recorded for data processing', category: 'Compliance', icon: UserCheck, critical: true },
  { id: 'sec-95', num: 95, title: 'GST compliance: invoice format + GSTIN validation', category: 'Compliance', icon: Receipt },
  { id: 'sec-96', num: 96, title: 'Fertilizer/pesticide license number on relevant bills', category: 'Compliance', icon: FileText },
  { id: 'sec-97', num: 97, title: 'Batch/expiry tracking per fertilizer regulations', category: 'Compliance', icon: Package, critical: true },
  { id: 'sec-98', num: 98, title: 'Shop ownership documents accessible for audit', category: 'Compliance', icon: FileText },
  { id: 'sec-99', num: 99, title: 'Annual security audit scheduled & documented', category: 'Compliance', icon: ShieldCheck, critical: true },
  { id: 'sec-100', num: 100, title: 'Staff training on data handling + security best practices', category: 'Compliance', icon: Users },
  { id: 'sec-101', num: 101, title: 'Incident response plan documented (data breach protocol)', category: 'Compliance', icon: AlertTriangle, critical: true },
  { id: 'sec-102', num: 102, title: 'Final sign-off by owner before production go-live', category: 'Compliance', icon: CheckCircle2, critical: true },
]

const STORAGE_KEY = 'satguru_security_checklist_v3'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SecurityChecklist() {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All')
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedMap))
    } catch (e) {
      console.error('Failed to save checklist state:', e)
    }
  }, [checkedMap])

  const toggleItem = useCallback((id: string) => {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const checkAll = useCallback(() => {
    const allChecked: Record<string, boolean> = {}
    SECURITY_REQUIREMENTS.forEach((item) => { allChecked[item.id] = true })
    setCheckedMap(allChecked)
    toast.success('सभी 102 सुरक्षा नियम चेक कर दिए गए हैं!')
  }, [])

  const checkCriticalOnly = useCallback(() => {
    const criticalChecked: Record<string, boolean> = { ...checkedMap }
    SECURITY_REQUIREMENTS.filter((i) => i.critical).forEach((item) => {
      criticalChecked[item.id] = true
    })
    setCheckedMap(criticalChecked)
    toast.success('सभी CRITICAL नियम verify कर दिए गए!')
  }, [checkedMap])

  const resetAll = useCallback(() => {
    if (window.confirm('क्या आप पूरी checklist रीसेट करना चाहते हैं? यह undo नहीं हो सकता।')) {
      setCheckedMap({})
      toast.success('चेकलिस्ट रीसेट कर दी गई है!')
    }
  }, [])

  const copyAuditSummary = useCallback(() => {
    const verifiedCount = Object.values(checkedMap).filter(Boolean).length
    const total = SECURITY_REQUIREMENTS.length
    const critical = SECURITY_REQUIREMENTS.filter((i) => i.critical)
    const criticalChecked = critical.filter((i) => checkedMap[i.id]).length

    const text = `SATGURU BEEJ BHANDAR — Production Security Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Overall Progress: ${verifiedCount}/${total} (${Math.round((verifiedCount / total) * 100)}%)
🚨 Critical Rules:  ${criticalChecked}/${critical.length} (${Math.round((criticalChecked / critical.length) * 100)}%)
📅 Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

    navigator.clipboard.writeText(text)
    toast.success('सुरक्षा ऑडिट रिपोर्ट कॉपी हो गई!')
  }, [checkedMap])

  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()
    return SECURITY_REQUIREMENTS.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        String(item.num).includes(query)
      const matchesCritical = !showCriticalOnly || item.critical
      return matchesCategory && matchesSearch && matchesCritical
    })
  }, [searchTerm, selectedCategory, showCriticalOnly])

  const totalCount = SECURITY_REQUIREMENTS.length
  const checkedCount = useMemo(
    () => SECURITY_REQUIREMENTS.filter((item) => checkedMap[item.id]).length,
    [checkedMap]
  )
  const percentage = Math.round((checkedCount / totalCount) * 100)

  const criticalItems = useMemo(() => SECURITY_REQUIREMENTS.filter((i) => i.critical), [])
  const criticalChecked = useMemo(
    () => criticalItems.filter((i) => checkedMap[i.id]).length,
    [checkedMap, criticalItems]
  )
  const criticalPct = Math.round((criticalChecked / criticalItems.length) * 100)

  const categories: CategoryType[] = [
    'All',
    'Auth & PIN',
    'RLS & Access',
    'Privacy & Data',
    'Financial & Stock',
    'Audit & Infra',
    'Communication',
    'Backup & Recovery',
    'UI & Session',
    'Compliance',
  ]

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: totalCount }
    categories.forEach((cat) => {
      if (cat === 'All') return
      counts[cat] = SECURITY_REQUIREMENTS.filter((i) => i.category === cat).length
    })
    return counts
  }, [totalCount])

  return (
    <section
      aria-label="Production Security Audit Checklist"
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <ShieldCheck className="text-amber-400 shrink-0" size={28} aria-hidden="true" />
              Security Checklist (102-step)
            </h1>
            <p className="text-emerald-200 text-xs mt-1">
              Complete production readiness audit — verify in Supabase + application
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={copyAuditSummary}
              className="px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-600/50 flex items-center gap-1.5 transition-all active:scale-95"
              title="Copy Summary"
            >
              <Copy size={14} aria-hidden="true" />
              <span>Summary</span>
            </button>
            <button
              type="button"
              onClick={checkCriticalOnly}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95"
              title="Verify all Critical rules"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Critical</span>
            </button>
            <button
              type="button"
              onClick={checkAll}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95"
              title="Verify All Rules"
            >
              <CheckSquare size={14} aria-hidden="true" />
              <span>Verify All</span>
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-all active:scale-95"
              title="Reset Checklist"
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-emerald-200">Overall Audit Readiness</span>
            <span className="font-black text-amber-300 font-mono">
              {checkedCount} / {totalCount} ({percentage}%)
            </span>
          </div>
          <div className="w-full bg-emerald-950/80 h-2.5 rounded-full overflow-hidden border border-emerald-800/50">
            <div
              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Critical Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-rose-200 flex items-center gap-1">
              <AlertTriangle size={12} className="text-rose-300" />
              Critical Rules (must verify before go-live)
            </span>
            <span className="font-black text-rose-200 font-mono">
              {criticalChecked} / {criticalItems.length} ({criticalPct}%)
            </span>
          </div>
          <div className="w-full bg-rose-950/80 h-2 rounded-full overflow-hidden border border-rose-800/50">
            <div
              className="bg-gradient-to-r from-rose-500 to-rose-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${criticalPct}%` }}
              role="progressbar"
              aria-valuenow={criticalPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* Toolbar: Search + Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
          <Search className="text-slate-400 shrink-0" size={16} aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search security rules, category, or number..."
            aria-label="Search security checklist"
            className="w-full outline-none text-xs font-medium bg-transparent text-slate-800"
          />
        </div>

        {/* Critical Only Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={showCriticalOnly}
            onChange={(e) => setShowCriticalOnly(e.target.checked)}
            className="w-4 h-4 accent-rose-600 cursor-pointer"
          />
          <AlertTriangle size={12} className="text-rose-600" />
          Show Critical Rules Only ({criticalItems.length} rules)
        </label>

        {/* Category Pills */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs"
          role="tablist"
          aria-label="Security Categories"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 ${
                selectedCategory === cat
                  ? 'bg-emerald-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{cat}</span>
              <span className="text-[9px] opacity-75 font-mono">({categoryCounts[cat]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100"
        role="group"
        aria-label="Security Requirements Checklist"
      >
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-medium text-xs">
            कोई सुरक्षा नियम आपकी खोज के अनुसार नहीं मिला।
          </div>
        ) : (
          filteredItems.map((item) => {
            const isChecked = !!checkedMap[item.id]
            const Icon = item.icon

            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    toggleItem(item.id)
                  }
                }}
                tabIndex={0}
                role="checkbox"
                aria-checked={isChecked}
                aria-label={`Rule ${item.num}: ${item.title}`}
                className={`p-4 flex items-start gap-3 text-sm cursor-pointer transition-colors select-none focus:outline-none focus-visible:bg-slate-100 ${
                  isChecked
                    ? 'bg-emerald-50/50'
                    : item.critical
                      ? 'hover:bg-rose-50/30'
                      : 'hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 size={18} className="text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle
                      size={18}
                      className={
                        item.critical
                          ? 'text-rose-400 hover:text-rose-500 transition-colors'
                          : 'text-slate-300 hover:text-slate-400 transition-colors'
                      }
                    />
                  )}
                </div>

                <span className="font-black text-emerald-900 font-mono text-xs w-7 shrink-0 mt-0.5">
                  {item.num}.
                </span>

                <div className="flex-1 space-y-1 min-w-0">
                  <p
                    className={`text-xs font-semibold leading-relaxed transition-all ${
                      isChecked ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {item.title}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    {item.critical && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded">
                        <AlertTriangle size={9} />
                        Critical
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 mt-0.5">
                  <Icon
                    size={16}
                    className={
                      isChecked
                        ? 'text-emerald-600'
                        : item.critical
                          ? 'text-rose-400'
                          : 'text-slate-300'
                    }
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-1">
        <p className="text-[11px] text-slate-600 font-medium">
          <strong className="text-emerald-800">{totalCount} total rules</strong> across{' '}
          <strong className="text-emerald-800">{categories.length - 1} categories</strong>
          {' · '}
          <strong className="text-rose-700">{criticalItems.length} critical</strong>
          {' · '}
          Showing <strong>{filteredItems.length}</strong>
        </p>
        <p className="text-[10px] text-slate-400 font-medium">
          Audit progress auto-saved to browser · Use "Summary" to copy report for records
        </p>
      </div>
    </section>
  )
}