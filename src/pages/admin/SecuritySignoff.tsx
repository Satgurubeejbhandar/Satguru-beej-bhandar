import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  Circle,
  Copy,
  RotateCcw,
  Award,
  Calendar,
  UserCheck,
  Lock,
  Key,
  Database,
  EyeOff,
  FileCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Type Definitions & Dataset                                         */
/* ------------------------------------------------------------------ */

export interface SignoffItem {
  id: string
  title: string
  detail: string
  category: 'Secrets' | 'Auth' | 'Data Privacy' | 'Audit'
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const SIGNOFF_ITEMS: SignoffItem[] = [
  {
    id: 'signoff-1',
    title: 'No secrets in frontend env except anon key',
    detail: 'Vite bundle checked; service role or database credentials not exposed in client build.',
    category: 'Secrets',
    icon: Key,
  },
  {
    id: 'signoff-2',
    title: 'Service role key only server-side (never Vite)',
    detail: 'Supabase admin client used strictly in Supabase RPCs / Edge functions or secure backends.',
    category: 'Secrets',
    icon: Lock,
  },
  {
    id: 'signoff-3',
    title: 'Admin password only in Supabase Auth',
    detail: 'Zero plain-text admin passwords in code, database columns, or localStorage.',
    category: 'Auth',
    icon: ShieldCheck,
  },
  {
    id: 'signoff-4',
    title: 'Farmer PIN hashed',
    detail: 'Farmer portal PINs hashed using bcrypt via hash_pin/verify_pin RPCs with 3-fail lockout.',
    category: 'Auth',
    icon: Lock,
  },
  {
    id: 'signoff-5',
    title: 'RLS policies reviewed',
    detail: 'Row Level Security enabled and verified on all business tables (SELECT, INSERT, UPDATE, DELETE).',
    category: 'Data Privacy',
    icon: Database,
  },
  {
    id: 'signoff-6',
    title: 'Guest locked from private udhaar data',
    detail: 'Unauthenticated users can only view public catalog & scheme rates, not farmer ledgers.',
    category: 'Data Privacy',
    icon: EyeOff,
  },
  {
    id: 'signoff-7',
    title: 'Farmer cannot share ledger on WhatsApp',
    detail: 'Farmer portal blocked from triggering WhatsApp broadcasts or modifying chat history.',
    category: 'Data Privacy',
    icon: EyeOff,
  },
  {
    id: 'signoff-8',
    title: 'Audit on ID/limit/PIN/void/scheme changes',
    detail: 'All sensitive admin overrides trigger records in audit_logs with timestamp & performed_by.',
    category: 'Audit',
    icon: FileCheck,
  },
]

const STORAGE_CHECK_KEY = 'satguru_security_signoff_items_v2'
const STORAGE_META_KEY = 'satguru_security_signoff_meta_v2'

interface SignoffMeta {
  auditorName: string
  signedAt: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SecuritySignoff() {
  // Checkbox State with LocalStorage Persistence
  const [okMap, setOkMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHECK_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Signoff Certificate Meta State
  const [meta, setMeta] = useState<SignoffMeta | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_META_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [auditorInput, setAuditorNameInput] = useState('')

  // Save checks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHECK_KEY, JSON.stringify(okMap))
    } catch (e) {
      console.error('Failed to save signoff items state:', e)
    }
  }, [okMap])

  // Save meta to localStorage
  useEffect(() => {
    try {
      if (meta) {
        localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta))
      } else {
        localStorage.removeItem(STORAGE_META_KEY)
      }
    } catch (e) {
      console.error('Failed to save signoff meta:', e)
    }
  }, [meta])

  // Calculations
  const totalCount = SIGNOFF_ITEMS.length
  const confirmedCount = useMemo(
    () => SIGNOFF_ITEMS.filter((item) => okMap[item.id]).length,
    [okMap]
  )
  const isFullyConfirmed = confirmedCount === totalCount
  const percentage = Math.round((confirmedCount / totalCount) * 100)

  // Handlers
  const toggleItem = useCallback((id: string) => {
    setOkMap((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      // If unchecking after completing, clear the signed certificate meta
      if (Object.values(next).filter(Boolean).length < totalCount) {
        setMeta(null)
      }
      return next
    })
  }, [totalCount])

  const handleCompleteSignoff = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isFullyConfirmed) {
        toast.error('पहले सभी 8 सुरक्षा नियमों की पुष्टि करें!')
        return
      }
      if (!auditorInput.trim()) {
        toast.error('साइन-ऑफ के लिए एडमिन/ऑडिटर का नाम दर्ज करें!')
        return
      }

      const newMeta: SignoffMeta = {
        auditorName: auditorInput.trim(),
        signedAt: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      }

      setMeta(newMeta)
      toast.success('सुरक्षा साइन-ऑफ प्रमाण-पत्र सफलतापूर्वक जारी किया गया!')
    },
    [isFullyConfirmed, auditorInput]
  )

  const resetAll = useCallback(() => {
    if (window.confirm('क्या आप सभी सुरक्षा कन्फर्मेशन और डिजिटल साइन-ऑफ रीसेट करना चाहते हैं?')) {
      setOkMap({})
      setMeta(null)
      setAuditorNameInput('')
      toast.success('सुरक्षा साइन-ऑफ रीसेट कर दिया गया!')
    }
  }, [])

  const copyCertificateSummary = useCallback(() => {
    if (!meta) return
    const text = `SATGURU BEEJ BHANDAR - OFFICIAL SECURITY SIGNOFF\nAuditor: ${meta.auditorName}\nSigned At: ${meta.signedAt}\nStatus: 102-Step Production Security Requirements Fully Verified (8/8)`
    navigator.clipboard.writeText(text)
    toast.success('डिजिटल साइन-ऑफ सर्टिफिकेट कॉपी हो गया!')
  }, [meta])

  return (
    <section
      aria-label="Security Signoff Audit Section"
      className="max-w-xl mx-auto space-y-6"
    >
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div className="flex justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <ShieldCheck className="text-amber-400 shrink-0" size={28} aria-hidden="true" />
              Security Sign-off
            </h1>
            <p className="text-emerald-200 text-xs mt-1">
              Final pre-launch production security verification &amp; approval
            </p>
          </div>

          <button
            type="button"
            onClick={resetAll}
            aria-label="Reset Security Sign-off"
            title="Reset Sign-off"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-all active:scale-95 shrink-0"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Progress Bar & Counter */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-emerald-200">Confirmation Progress</span>
            <span className="font-black text-amber-300 font-mono">
              {confirmedCount} / {totalCount} confirmed ({percentage}%)
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

      {/* Completed Certificate Banner (When Meta Exists) */}
      {meta && (
        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900">
              <Award size={24} className="text-amber-600 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider">
                  Official Security Sign-off Completed
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Production Deployment Approved
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyCertificateSummary}
              className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm shrink-0"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-2xl border border-amber-200/60 font-medium">
            <div className="flex items-center gap-2 text-slate-700">
              <UserCheck size={16} className="text-emerald-700 shrink-0" />
              <span>
                Auditor: <strong className="text-slate-900">{meta.auditorName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar size={16} className="text-emerald-700 shrink-0" />
              <span>
                Timestamp: <strong className="text-slate-900 font-mono">{meta.signedAt}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Items Checklist */}
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100"
        role="group"
        aria-label="Security Sign-off Items"
      >
        {SIGNOFF_ITEMS.map((item, idx) => {
          const isChecked = !!okMap[item.id]
          const Icon = item.icon
          const inputId = `signoff-checkbox-${item.id}`

          return (
            <div
              key={item.id}
              className={`p-4 transition-colors ${
                isChecked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
              }`}
            >
              <label
                htmlFor={inputId}
                className="flex items-start gap-3 text-sm font-medium cursor-pointer select-none"
              >
                {/* Hidden Native Checkbox for Screen Readers & Focus */}
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleItem(item.id)}
                  className="sr-only focus-visible:ring-2 focus-visible:ring-emerald-500"
                />

                {/* Styled Custom Checkbox */}
                <div className="mt-0.5 shrink-0 text-emerald-700">
                  {isChecked ? (
                    <CheckCircle2 size={20} className="text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle size={20} className="text-slate-300 hover:text-slate-400 transition-colors" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold transition-all ${
                        isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      <span className="text-emerald-800 font-mono mr-1.5">{idx + 1}.</span>
                      {item.title}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                      {item.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                    {item.detail}
                  </p>
                </div>

                {/* Context Icon */}
                <div className="shrink-0 mt-0.5">
                  <Icon
                    size={16}
                    className={isChecked ? 'text-emerald-600' : 'text-slate-300'}
                    aria-hidden="true"
                  />
                </div>
              </label>
            </div>
          )
        })}
      </div>

      {/* Sign-off Author Action Form (Appears when 100% checked & not yet signed) */}
      {isFullyConfirmed && !meta && (
        <form
          onSubmit={handleCompleteSignoff}
          className="bg-white p-5 rounded-3xl border border-emerald-300 shadow-lg space-y-3 animate-fade-in"
        >
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
            <Award className="text-amber-500" size={18} />
            <span>Complete Digital Security Sign-off</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={auditorInput}
              onChange={(e) => setAuditorNameInput(e.target.value)}
              placeholder="Enter Sign-off Admin / Auditor Name..."
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all active:scale-95 shadow-md shrink-0"
            >
              Sign &amp; Approve Launch 🚀
            </button>
          </div>
        </form>
      )}
    </section>
  )
}