import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  UserCog,
  LogOut,
  Loader2,
  ShieldCheck,
  Laptop,
  Smartphone,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import {
  getOrCreateSessionToken,
  getDeviceDescription,
  useAdminSessionGuard,
} from '../../lib/useAdminSessionGuard'

interface ActiveSessionItem {
  session_id: string
  session_token?: string
  user_email: string
  device_info: string
  created_at: string
  last_active_at: string
}

function formatSessionTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminSessionInfo() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  
  // Activate automatic background heartbeat guard
  useAdminSessionGuard()

  const [loggingOut, setLoggingOut] = useState(false)
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)

  // Token used to identify current device in active sessions
  const currentToken = getOrCreateSessionToken()

  // ── Load Active Admin Sessions ──────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true)
      setSessionError(null)

      const { data, error } = await supabase.rpc('get_active_admin_sessions')

      if (error) {
        throw error
      }

      if (isMounted.current) {
        setActiveSessions((data as ActiveSessionItem[]) || [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सत्र डेटा लोड करने में समस्या आई'
      if (isMounted.current) {
        console.error('Error fetching sessions:', err)
        setSessionError(msg)
        setActiveSessions([])
      }
    } finally {
      if (isMounted.current) {
        setLoadingSessions(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    loadSessions()

    return () => {
      isMounted.current = false
    }
  }, [loadSessions])

  // ── Revoke / Kick Session ───────────────────────────────────────

  const handleRevokeSession = async (session: ActiveSessionItem) => {
    const isCurrentDevice = session.session_token === currentToken

    const confirmKick = window.confirm(
      isCurrentDevice
        ? 'क्या आप इसी डिवाइस का एडमिन सत्र समाप्त (Logout) करना चाहते हैं?'
        : 'क्या आप इस डिवाइस का एडमिन सत्र समाप्त करना चाहते हैं?'
    )
    if (!confirmKick) return

    try {
      setRevokingId(session.session_id)
      const { error } = await supabase.rpc('revoke_admin_session', {
        p_session_id: session.session_id,
      })

      if (error) throw error

      toast.success('डिवाइस सत्र सफलतापूर्वक समाप्त कर दिया गया')

      if (isCurrentDevice) {
        await logout()
      } else {
        await loadSessions()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सत्र हटाने में त्रुटि'
      toast.error(msg)
    } finally {
      if (isMounted.current) {
        setRevokingId(null)
      }
    }
  }

  // ── Logout Current User ─────────────────────────────────────────────────

  const logout = async () => {
    try {
      setLoggingOut(true)

      // 1. Revoke remote session record if current token exists
      if (currentToken) {
        try {
          await supabase.rpc('revoke_admin_session_by_token', {
            p_session_token: currentToken,
          })
        } catch {
          // Non-blocking cleanup
        }
      }

      // 2. Remove local storage token
      localStorage.removeItem('satguru_admin_session_token')

      // 3. Complete Auth Signout
      await signOut()
      toast.success('सफलतापूर्वक लॉगआउट हो गया')
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'लॉगआउट करने में समस्या आई'
      toast.error(msg)
      navigate('/login')
    } finally {
      if (isMounted.current) {
        setLoggingOut(false)
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="text-amber-400" size={28} /> Admin Session
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            सुरक्षित एडमिन एक्सेस एवं लाइव डिवाइस प्रबंधन
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-800 border border-emerald-600 rounded-full text-xs font-bold text-emerald-200">
            <ShieldCheck size={14} className="text-emerald-400" />
            Max 2 Sessions Allowed
          </span>
        </div>
      </div>

      {/* Active Slots Status Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
              सक्रिय एडमिन सत्र (Active Slots: {activeSessions.length}/2)
            </h2>
            <p className="text-xs text-gray-500">
              सुरक्षा कारणों से एक समय में केवल 2 डिवाइस सक्रिय रह सकते हैं।
            </p>
          </div>
          <button
            type="button"
            onClick={loadSessions}
            disabled={loadingSessions}
            className="p-2 text-gray-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
            title="रिफ्रेश करें"
            aria-label="Refresh sessions"
          >
            <RefreshCw size={16} className={loadingSessions ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error Banner */}
        {sessionError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>{sessionError}</span>
            </div>
            <button
              onClick={loadSessions}
              className="text-xs font-bold text-amber-900 underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-3">
          {loadingSessions ? (
            <div className="py-6 text-center text-xs text-gray-400 font-bold flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-700" />
              सत्र लोड हो रहे हैं...
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
              कोई सक्रिय सत्र नहीं मिला
            </div>
          ) : (
            activeSessions.map((sess, idx) => {
              const isMobile = (sess.device_info || '').toLowerCase().includes('mobile')
              const isThisDevice = sess.session_token === currentToken

              return (
                <div
                  key={sess.session_id}
                  className={`p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                    isThisDevice
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white rounded-xl shadow-xs border border-gray-200 text-emerald-800">
                      {isMobile ? <Smartphone size={20} /> : <Laptop size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-gray-900">
                          {sess.device_info || 'Unknown Device'}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                          Slot {idx + 1}
                        </span>
                        {isThisDevice && (
                          <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-bold rounded-md">
                            This Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {sess.user_email || user?.email} • सक्रिय:{' '}
                        {formatSessionTime(sess.last_active_at)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeSession(sess)}
                    disabled={revokingId === sess.session_id}
                    className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 self-end sm:self-auto disabled:opacity-50"
                  >
                    {revokingId === sess.session_id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    लॉगआउट करें
                  </button>
                </div>
              )
            })
          )}
        </div>

        {activeSessions.length >= 2 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-bold">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>
              दोनों एडमिन स्लॉट भरे हुए हैं। कोई नया एडमिन लॉगिन करने पर सबसे पुराना सत्र समाप्त हो जाएगा।
            </span>
          </div>
        )}
      </div>

      {/* Current User Session Info Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 text-sm">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">
            वर्तमान उपकरण विवरण (Current Device)
          </h2>
          {currentToken && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={12} /> Active Device
            </span>
          )}
        </div>

        <div className="space-y-3">
          <p className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">Email:</span>
            <span className="font-black text-gray-900">{user?.email || '—'}</span>
          </p>

          <p className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">User ID:</span>
            <span className="font-mono text-xs text-gray-700 break-all">
              {user?.id || '—'}
            </span>
          </p>

          <p className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">Role:</span>
            <span className="font-black uppercase text-emerald-800">{role || '—'}</span>
          </p>

          <p className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-gray-50">
            <span className="font-bold text-gray-500">Device Signature:</span>
            <span className="font-mono text-xs text-gray-600">
              {getDeviceDescription()}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="w-full mt-4 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          {loggingOut ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Logging out...
            </>
          ) : (
            <>
              <LogOut size={16} /> इस डिवाइस से लॉगआउट करें
            </>
          )}
        </button>
      </div>
    </div>
  )
}