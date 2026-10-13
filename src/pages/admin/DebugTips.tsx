import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Bug, Terminal, Database, Code2, Trash2, Check, ExternalLink, Wifi, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOrCreateSessionToken } from '../../lib/useAdminSessionGuard'

type DebugTip = {
  category: 'browser' | 'backend' | 'typescript'
  title: string
  code?: string
  description: string
}

const TIPS: DebugTip[] = [
  {
    category: 'browser',
    title: 'Console Runtime Errors',
    code: 'F12 → Console',
    description: 'Check for unhandled promises, network failures, or React state update crashes.',
  },
  {
    category: 'backend',
    title: 'Supabase API & RLS Logs',
    code: 'Dashboard → Logs',
    description: 'If data is not loading or saving fails silently, check Row Level Security (RLS) denials.',
  },
  {
    category: 'typescript',
    title: 'Unused Import Warning',
    code: 'Yellow underline',
    description: 'Safe to remove or cleanup. Does not break build.',
  },
  {
    category: 'typescript',
    title: 'TS2307: Cannot Find Module',
    code: 'Red TS2307',
    description: 'Incorrect file path, case-sensitivity issue, or file missing in project.',
  },
  {
    category: 'typescript',
    title: 'TS6133: Variable Declared But Unused',
    code: 'Red TS6133',
    description: 'Variable or parameter created but never read in code.',
  },
]

export default function DebugTips() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true

    const handleOnline = () => { if (isMountedRef.current) setIsOnline(true) }
    const handleOffline = () => { if (isMountedRef.current) setIsOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      isMountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(code)
        if (isMountedRef.current) {
          setCopiedCode(code)
          toast.success(`Copied: ${code}`)
          setTimeout(() => {
            if (isMountedRef.current) setCopiedCode(null)
          }, 2000)
        }
      } else {
        throw new Error('Clipboard API unavailable')
      }
    } catch {
      toast.error(`Copy manually: ${code}`)
    }
  }

  const handleClearCache = useCallback(async () => {
    if (window.confirm('Clear local storage & session data? You may be logged out.')) {
      try {
        const currentToken = getOrCreateSessionToken()
        if (currentToken) {
          try {
            await supabase.rpc('revoke_admin_session_by_token', {
              p_session_token: currentToken,
            })
          } catch {
            // Non-blocking cleanup
          }
        }

        localStorage.clear()
        sessionStorage.clear()
        toast.success('Local storage & session cleared')
        
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } catch {
        localStorage.clear()
        sessionStorage.clear()
        window.location.reload()
      }
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="text-amber-400" size={28} /> Debugging Guide &amp; Quick Tools
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Internal troubleshooting references &amp; developer shortcuts
        </p>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Wifi size={16} className={isOnline ? 'text-emerald-600' : 'text-rose-600'} />
          <span>Network: {isOnline ? 'Online' : 'Offline'}</span>
          <span className="text-slate-300">|</span>
          <span>Env: {import.meta.env.MODE || 'production'}</span>
        </div>

        <button
          type="button"
          onClick={handleClearCache}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-xl border border-rose-200 transition-colors shadow-xs"
        >
          <Trash2 size={14} /> Clear App Cache
        </button>
      </div>

      {/* Structured Tips List */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
          Common Diagnostics
        </h2>

        <div className="space-y-3" role="list" aria-label="Troubleshooting tips">
          {TIPS.map((tip, idx) => (
            <div
              key={idx}
              role="listitem"
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {tip.category === 'browser' && <Terminal size={16} className="text-indigo-600 shrink-0" />}
                  {tip.category === 'backend' && <Database size={16} className="text-amber-600 shrink-0" />}
                  {tip.category === 'typescript' && <Code2 size={16} className="text-sky-600 shrink-0" />}
                  <span className="text-xs font-bold text-slate-900">{tip.title}</span>
                </div>

                {tip.code && (
                  <button
                    type="button"
                    onClick={() => handleCopy(tip.code!)}
                    className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-200/70 text-slate-800 hover:bg-slate-300 transition-colors shrink-0"
                    title="Click to copy"
                    aria-label={`Copy code ${tip.code}`}
                  >
                    {copiedCode === tip.code ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <ExternalLink size={12} className="text-slate-500" />
                    )}
                    <code>{tip.code}</code>
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed pl-6">
                {tip.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}