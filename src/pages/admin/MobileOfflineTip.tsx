import { useState, useEffect, useRef } from 'react'
import {
  Wifi,
  WifiOff,
  Database,
  Lock,
  Camera,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

interface NetworkTip {
  id: string
  title: string
  description: string
  category: 'Network' | 'Database' | 'Mobile & Camera' | 'UX Safety'
  icon: LucideIcon
}

const NETWORK_TIPS: NetworkTip[] = [
  {
    id: 'db_truth',
    title: 'Online Billing Source of Truth',
    description: 'Finalize bills and payments only when online. Database server is the final source of truth for stock and ledgers.',
    category: 'Network',
    icon: Database,
  },
  {
    id: 'double_submit',
    title: 'Double-Submit Protection on Weak Network',
    description: 'On weak 2G/3G connections, avoid pressing save multiple times. Wait for the button saving spinner to complete.',
    category: 'UX Safety',
    icon: Lock,
  },
  {
    id: 'stock_concurrency',
    title: 'RPC Server-Side Stock Locking',
    description: 'Stock deduction uses atomic RPC functions on the server to prevent two operators from billing the last item simultaneously.',
    category: 'Database',
    icon: Smartphone,
  },
  {
    id: 'camera_https',
    title: 'HTTPS Required for Camera Capture',
    description: 'Scanning barcodes or capturing document photos requires a secure HTTPS context on mobile browsers.',
    category: 'Mobile & Camera',
    icon: Camera,
  },
]

export default function MobileOfflineTip() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  )

  const isMountedRef = useRef<boolean>(true)

  // Live Network Status Detector with Mount Guard
  useEffect(() => {
    isMountedRef.current = true

    const handleOnline = () => {
      if (isMountedRef.current) setIsOnline(true)
    }
    const handleOffline = () => {
      if (isMountedRef.current) setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      isMountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner with Live Network Badge */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            {isOnline ? (
              <Wifi className="text-emerald-400 shrink-0" size={28} />
            ) : (
              <WifiOff className="text-rose-400 animate-pulse shrink-0" size={28} />
            )}
            Mobile &amp; Network Tips
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Guidelines for weak connections &amp; offline safety
          </p>
        </div>

        {/* Live Network Status Badge */}
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-black border flex items-center gap-1.5 shrink-0 font-mono ${
            isOnline
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
          />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      {/* Offline Alert Warning Banner */}
      {!isOnline && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-900 text-xs font-bold animate-in fade-in duration-300 shadow-xs"
          role="alert"
        >
          <AlertCircle size={20} className="text-rose-600 shrink-0" />
          <span>
            You are currently OFFLINE! Avoid creating new bills until internet connection is restored.
          </span>
        </div>
      )}

      {/* Tips Cards List */}
      <div className="space-y-3" role="list" aria-label="Mobile and network operational tips">
        {NETWORK_TIPS.map((tip) => {
          const Icon = tip.icon

          return (
            <div
              key={tip.id}
              role="listitem"
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    {tip.category}
                  </span>
                </div>
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-900">{tip.title}</h2>
                <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                  {tip.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}