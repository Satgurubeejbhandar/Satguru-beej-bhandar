// File: src/components/SystemMap.tsx
// (Adjust relative import paths as appropriate for your directory layout)

import { Map as MapIcon, ArrowRight } from 'lucide-react'
import { type FC } from 'react'

/* ──────────────────────────────────────────────
   Type Definitions & Architectural Data
   ────────────────────────────────────────────── */

interface SystemFlowItem {
  readonly id: string
  readonly from: string
  readonly to: string
}

const SYSTEM_FLOWS: readonly SystemFlowItem[] = [
  { id: 'public-guest', from: 'Public site', to: 'Guest' },
  { id: 'login-auth', from: 'Login', to: 'Admin (Auth) / Farmer (PIN session)' },
  { id: 'admin-masters', from: 'Admin', to: 'Masters (Company, Product, Farmer, Group)' },
  { id: 'purchase-flow', from: 'Purchase', to: 'inventory_batches + stock_ledger + selling_rate' },
  { id: 'billing-fefo', from: 'Billing', to: 'FEFO batch + auto selling rate + deduct_stock RPC' },
  { id: 'payment-ledger', from: 'Payment', to: 'credit_accounts + farmer_ledger' },
  { id: 'returns-void', from: 'Returns/Void', to: 'restore stock + reverse credit + keep history' },
  { id: 'reports-db', from: 'Reports', to: 'DB aggregates only' },
  { id: 'farmer-portal', from: 'Farmer portal', to: 'read-only, no WhatsApp history' },
  { id: 'settings-schemes', from: 'Settings/Schemes', to: 'configurable, audited' },
] as const

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const SystemMap: FC = () => {
  return (
    <section
      className="max-w-xl mx-auto space-y-6 px-4 py-4 sm:px-0"
      aria-labelledby="system-map-heading"
    >
      {/* ── Banner Header ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1
          id="system-map-heading"
          className="text-2xl font-bold flex items-center gap-2"
        >
          <MapIcon className="text-amber-300" size={28} aria-hidden="true" />
          <span>System Map (Parts 1–82)</span>
        </h1>
        <p className="text-emerald-200 text-xs mt-1 font-medium">
          Architectural data flows and boundary transitions
        </p>
      </div>

      {/* ── Flow List ── */}
      {SYSTEM_FLOWS.length > 0 ? (
        <ol
          className="bg-white rounded-3xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 list-none p-0 m-0 overflow-hidden"
          role="list"
          aria-label="System architectural flows"
        >
          {SYSTEM_FLOWS.map((item, index) => (
            <li
              key={item.id}
              className="p-4 text-xs sm:text-sm font-medium flex items-start sm:items-center gap-3.5 hover:bg-slate-50/70 transition-colors"
            >
              {/* Step Index Badge */}
              <span
                className="font-black text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg text-xs shrink-0 min-w-[28px] text-center"
                aria-hidden="true"
              >
                {index + 1}
              </span>

              {/* Accessible text for screen readers */}
              <span className="sr-only">
                {`Flow step ${index + 1}: ${item.from} leads to ${item.to}.`}
              </span>

              {/* Visual Workflow Flow */}
              <div
                className="flex flex-wrap items-center gap-1.5 min-w-0"
                aria-hidden="true"
              >
                <span className="font-bold text-slate-900 shrink-0">
                  {item.from}
                </span>

                <ArrowRight
                  size={14}
                  className="text-emerald-600 shrink-0 mx-0.5"
                  aria-hidden="true"
                />

                <span className="text-slate-600 font-mono text-[11px] sm:text-xs">
                  {item.to}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div
          className="bg-white rounded-3xl border p-8 text-center text-slate-500 text-xs"
          role="status"
        >
          No system mapping data available.
        </div>
      )}
    </section>
  )
}

export default SystemMap