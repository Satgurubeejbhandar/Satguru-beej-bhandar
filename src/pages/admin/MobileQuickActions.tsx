import { Link, useLocation } from 'react-router-dom'
import {
  Receipt,
  Wallet,
  Truck,
  Package,
  Users,
  Search,
  AlertTriangle,
  UserPlus,
  Zap,
  ShieldCheck,
} from 'lucide-react'

const ACTIONS = [
  {
    to: '/admin/bills',
    label: 'New Udhaar Bill',
    desc: 'Create credit / cash bill',
    icon: Receipt,
    color: 'bg-amber-500 text-slate-950 shadow-amber-500/25',
  },
  {
    to: '/admin/payments',
    label: 'Take Payment',
    desc: 'Collect farmer payment',
    icon: Wallet,
    color: 'bg-emerald-600 text-white shadow-emerald-600/25',
  },
  {
    to: '/admin/purchase',
    label: 'Stock In',
    desc: 'Purchase / batch entry',
    icon: Truck,
    color: 'bg-blue-600 text-white shadow-blue-600/25',
  },
  {
    to: '/admin/sara-saman',
    label: 'SARA SAMAN',
    desc: 'Live stock overview',
    icon: Package,
    color: 'bg-slate-800 text-white shadow-slate-800/25',
  },
  {
    to: '/admin/farmers',
    label: 'Add / Farmers',
    desc: 'Register farmer',
    icon: UserPlus,
    color: 'bg-emerald-800 text-white shadow-emerald-800/25',
  },
  {
    to: '/admin/farmer-search',
    label: 'Find Farmer',
    desc: 'Search by name / ID',
    icon: Search,
    color: 'bg-indigo-600 text-white shadow-indigo-600/25',
  },
  {
    to: '/admin/groups',
    label: 'Groups',
    desc: '4-farmer group udhaar',
    icon: Users,
    color: 'bg-purple-700 text-white shadow-purple-700/25',
  },
  {
    to: '/admin/alerts',
    label: 'Alerts',
    desc: 'Expiry & low stock',
    icon: AlertTriangle,
    color: 'bg-rose-600 text-white shadow-rose-600/25',
  },
] as const

export default function MobileQuickActions() {
  const location = useLocation()

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-8 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Zap className="text-amber-400 shrink-0" size={26} />
          Mobile Quick Actions
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Large touch buttons for shop floor &amp; mobile counter use
        </p>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-3" role="list" aria-label="Quick action touch buttons">
        {ACTIONS.map((a) => {
          const Icon = a.icon
          const isActive =
            location.pathname === a.to ||
            location.pathname.startsWith(a.to + '/')

          return (
            <Link
              key={a.to}
              to={a.to}
              role="listitem"
              aria-label={a.label}
              aria-current={isActive ? 'page' : undefined}
              className={[
                a.color,
                'rounded-3xl p-5 min-h-[118px] flex flex-col justify-between',
                'shadow-lg transition-all duration-150',
                'active:scale-[0.97] active:brightness-95',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60',
                'touch-manipulation select-none',
                isActive ? 'ring-4 ring-white/50 brightness-110' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon size={28} strokeWidth={2.25} />
                {isActive && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full font-mono">
                    Open
                  </span>
                )}
              </div>
              <div>
                <span className="font-black text-sm leading-tight block">
                  {a.label}
                </span>
                <span className="text-[10px] font-semibold opacity-80 leading-tight block mt-0.5">
                  {a.desc}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Helper note */}
      <p className="text-center text-[11px] text-slate-500 font-medium px-4 leading-relaxed">
        Tip: Use these big buttons on mobile devices while billing at the counter. Admin
        routes are protected by auth session guards.
      </p>
    </div>
  )
}