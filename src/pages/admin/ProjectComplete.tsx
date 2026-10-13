import React from 'react'
import { PartyPopper, LayoutDashboard, CheckSquare, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'

interface QuickActionLink {
  to: string
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  variant: 'primary' | 'secondary'
}

const ACTION_LINKS: QuickActionLink[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    variant: 'primary',
  },
  {
    to: '/admin/e2e',
    label: 'E2E Checklist',
    icon: CheckSquare,
    variant: 'secondary',
  },
  {
    to: '/admin/golive',
    label: 'Go-Live',
    icon: Rocket,
    variant: 'secondary',
  },
]

export default function ProjectComplete() {
  return (
    <section 
      aria-label="Project Status & Milestones"
      className="max-w-xl mx-auto space-y-6 text-center px-4 py-6"
    >
      {/* Milestone Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-10 rounded-3xl shadow-xl space-y-4 border border-emerald-800/40">
        <div className="inline-flex p-3 bg-emerald-800/50 rounded-2xl border border-emerald-700/50 shadow-inner">
          <PartyPopper 
            aria-hidden="true"
            className="text-amber-400 animate-bounce" 
            size={40} 
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          PART 102 COMPLETE
        </h1>

        <div className="space-y-1">
          <p className="text-emerald-200 text-xs sm:text-sm font-semibold tracking-wide">
            SATGURU BEEJ BHANDAR — Daloosar, Sardarshahar (Churu), Rajasthan
          </p>
          <p className="text-amber-300 font-bold text-xs sm:text-sm">
            Production-ready business management foundation delivered
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div 
          className="flex flex-wrap justify-center items-center gap-2.5 pt-4"
          role="navigation"
          aria-label="Quick Actions"
        >
          {ACTION_LINKS.map((action) => {
            const Icon = action.icon

            if (action.variant === 'primary') {
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                >
                  {Icon && <Icon size={14} className="text-slate-950" />}
                  <span>{action.label}</span>
                </Link>
              )
            }

            return (
              <Link
                key={action.to}
                to={action.to}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800/90 hover:bg-emerald-700 active:bg-emerald-900 border border-emerald-600/80 font-bold text-emerald-50 rounded-xl text-xs transition-all duration-200 shadow-sm hover:shadow active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
              >
                {Icon && <Icon size={14} className="text-emerald-300" />}
                <span>{action.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer Branding Slogan */}
      <footer className="space-y-1">
        <p className="text-xs text-slate-500 font-bold tracking-wider uppercase">
          JAI JAWAN JAI KISAN · Aapki Fasal, Hamari Saaf Niyat
        </p>
      </footer>
    </section>
  )
}