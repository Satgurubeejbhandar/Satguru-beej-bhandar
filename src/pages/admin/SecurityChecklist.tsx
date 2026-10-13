import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  Search,
  RotateCcw,
  CheckSquare,
  Copy,
  Lock,
  Shield,
  Eye,
  Database,
  KeyRound,
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

export interface SecurityRequirement {
  id: string
  num: number
  title: string
  category: Exclude<CategoryType, 'All'>
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const SECURITY_REQUIREMENTS: SecurityRequirement[] = [
  {
    id: 'sec-1',
    num: 1,
    title: 'Admin auth via Supabase Auth only (no hardcoded password)',
    category: 'Auth & PIN',
    icon: KeyRound,
  },
  {
    id: 'sec-2',
    num: 2,
    title: 'Farmer PIN hashed with bcrypt (hash_pin / verify_pin RPC)',
    category: 'Auth & PIN',
    icon: Lock,
  },
  {
    id: 'sec-3',
    num: 3,
    title: 'PIN lockout after 3 fails / 10 minutes (server-side enforced)',
    category: 'Auth & PIN',
    icon: Shield,
  },
  {
    id: 'sec-4',
    num: 4,
    title: 'Row Level Security (RLS) enabled on all business tables',
    category: 'RLS & Access',
    icon: Database,
  },
  {
    id: 'sec-5',
    num: 5,
    title: 'Farmer can access only own portal session data',
    category: 'RLS & Access',
    icon: Eye,
  },
  {
    id: 'sec-6',
    num: 6,
    title: 'Guest: public site + udhaar scheme only; private portal locked',
    category: 'RLS & Access',
    icon: Lock,
  },
  {
    id: 'sec-7',
    num: 7,
    title: 'Inventory / purchase / company bills: Admin role only',
    category: 'RLS & Access',
    icon: Shield,
  },
  {
    id: 'sec-8',
    num: 8,
    title: 'No WhatsApp history share on Farmer Portal for privacy',
    category: 'Privacy & Data',
    icon: Eye,
  },
  {
    id: 'sec-9',
    num: 9,
    title: 'Admin WhatsApp bill/payment share only (no Aadhaar numbers)',
    category: 'Privacy & Data',
    icon: Eye,
  },
  {
    id: 'sec-10',
    num: 10,
    title: 'Stock deduction via deduct_stock RPC (FOR UPDATE lock enabled)',
    category: 'Financial & Stock',
    icon: Database,
  },
  {
    id: 'sec-11',
    num: 11,
    title: 'Financial history not overwritten — void/return/adjust only',
    category: 'Financial & Stock',
    icon: Database,
  },
  {
    id: 'sec-12',
    num: 12,
    title: 'Farmer ID change keeps UUID + history + audit intact',
    category: 'Financial & Stock',
    icon: Database,
  },
  {
    id: 'sec-13',
    num: 13,
    title: 'Aadhaar masked in UI (XXXX-XXXX-1234)',
    category: 'Privacy & Data',
    icon: Eye,
  },
  {
    id: 'sec-14',
    num: 14,
    title: 'Service role key never in frontend bundle (.env safety)',
    category: 'Audit & Infra',
    icon: KeyRound,
  },
  {
    id: 'sec-15',
    num: 15,
    title: 'Audit logs triggered for sensitive admin actions',
    category: 'Audit & Infra',
    icon: Shield,
  },
]

const STORAGE_KEY = 'satguru_security_checklist_v2'

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

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedMap))
    } catch (e) {
      console.error('Failed to save checklist state:', e)
    }
  }, [checkedMap])

  // Toggle individual item
  const toggleItem = useCallback((id: string) => {
    setCheckedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }, [])

  // Check all / Reset all
  const checkAll = useCallback(() => {
    const allChecked: Record<string, boolean> = {}
    SECURITY_REQUIREMENTS.forEach((item) => {
      allChecked[item.id] = true
    })
    setCheckedMap(allChecked)
    toast.success('सभी सुरक्षा नियम चेक कर दिए गए हैं!')
  }, [])

  const resetAll = useCallback(() => {
    if (window.confirm('क्या आप चेकलिस्ट की स्थिति रीसेट करना चाहते हैं?')) {
      setCheckedMap({})
      toast.success('चेकलिस्ट रीसेट कर दी गई है!')
    }
  }, [])

  // Copy Summary to Clipboard
  const copyAuditSummary = useCallback(() => {
    const verifiedCount = Object.values(checkedMap).filter(Boolean).length
    const total = SECURITY_REQUIREMENTS.length
    const text = `SATGURU BEEJ BHANDAR - Production Security Audit Summary:\nProgress: ${verifiedCount}/${total} Rules Verified (${Math.round(
      (verifiedCount / total) * 100
    )}% Complete)\nDate: ${new Date().toLocaleDateString('en-IN')}`

    navigator.clipboard.writeText(text)
    toast.success('सुरक्षा ऑडिट रिपोर्ट कॉपी हो गई!')
  }, [checkedMap])

  // Filtered List
  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()

    return SECURITY_REQUIREMENTS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory

      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        String(item.num).includes(query)

      return matchesCategory && matchesSearch
    })
  }, [searchTerm, selectedCategory])

  // Calculations
  const totalCount = SECURITY_REQUIREMENTS.length
  const checkedCount = useMemo(
    () => SECURITY_REQUIREMENTS.filter((item) => checkedMap[item.id]).length,
    [checkedMap]
  )
  const percentage = Math.round((checkedCount / totalCount) * 100)

  const categories: CategoryType[] = [
    'All',
    'Auth & PIN',
    'RLS & Access',
    'Privacy & Data',
    'Financial & Stock',
    'Audit & Infra',
  ]

  return (
    <section 
      aria-label="Production Security Audit Checklist"
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <ShieldCheck className="text-amber-400 shrink-0" size={28} aria-hidden="true" />
              Security Checklist (102-step)
            </h1>
            <p className="text-emerald-200 text-xs mt-1">
              Production readiness checklist — verify manually in Supabase + application
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

        {/* Progress Bar & Percentage */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-emerald-200">Production Audit Readiness</span>
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
      </div>

      {/* Toolbar: Search & Category Tabs */}
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

        {/* Category Pills */}
        <div 
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs hide-scrollbar"
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
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Requirements Checklist */}
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
                  isChecked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Checkbox Icon */}
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 size={18} className="text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle size={18} className="text-slate-300 hover:text-slate-400 transition-colors" />
                  )}
                </div>

                {/* Requirement Number */}
                <span className="font-black text-emerald-900 font-mono text-xs w-6 shrink-0 mt-0.5">
                  {item.num}.
                </span>

                {/* Title & Category Badge */}
                <div className="flex-1 space-y-1">
                  <p
                    className={`text-xs font-semibold leading-relaxed transition-all ${
                      isChecked ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {item.title}
                  </p>

                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>

                {/* Context Icon */}
                <div className="shrink-0 mt-0.5">
                  <Icon
                    size={16}
                    className={isChecked ? 'text-emerald-600' : 'text-slate-300'}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}