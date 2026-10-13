// File: src/components/StepsIndex.tsx (or wherever this file lives in your project)

import { ListChecks } from 'lucide-react'
import { type FC } from 'react'

/**
 * Phase descriptions for the 102-step project plan.
 * Each entry maps to a phase grouping of steps.
 */
interface Phase {
  readonly label: string
  readonly steps: string
}

const PHASES: readonly Phase[] = [
  { steps: '1–4', label: 'Foundation, schema, RLS, layout' },
  { steps: '5–9', label: 'Farmers, groups, company, product' },
  { steps: '10–15', label: 'SARA SAMAN, purchase, batch, billing, payment' },
  { steps: '16–20', label: 'Ledger, interest, cashback, farmer portal, settings' },
  { steps: '21–30', label: 'Notifications, reports, audit, returns, villages…' },
  { steps: '31–40', label: 'Registers, status, credit limit, void, alerts, search' },
  { steps: '41–50', label: 'Schemes, categories, units, due engine, print, health' },
  { steps: '51–65', label: 'Sales reports, expiry, reorder, valuation, E2E' },
  { steps: '66–82', label: 'Integrity, export, access matrix, go-live, map' },
  { steps: '83–102', label: 'Closeout, flags, handover, quality gate' },
] as const

/**
 * StepsIndex — Renders a read-only index of all 102 project implementation steps,
 * grouped by phase. Purely presentational; no user input or API calls.
 */
const StepsIndex: FC = () => {
  return (
    <section
      className="max-w-xl mx-auto space-y-6 px-4 py-6 sm:px-6"
      aria-labelledby="steps-index-heading"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1
          id="steps-index-heading"
          className="text-2xl font-bold flex items-center gap-2"
        >
          <ListChecks
            className="text-amber-300"
            size={28}
            aria-hidden="true"
          />
          <span>102 Steps Index</span>
        </h1>
      </div>

      {/* Phase list */}
      {PHASES.length > 0 ? (
        <ol
          className="bg-white rounded-3xl border divide-y list-none p-0 m-0"
          role="list"
          aria-label="Project phases"
        >
          {PHASES.map((phase, index) => (
            <li
              key={phase.steps}
              className="p-4 text-sm font-medium flex gap-3 items-baseline"
            >
              <span
                className="font-black text-emerald-800 shrink-0 min-w-[2rem] text-right"
                aria-hidden="true"
              >
                {index + 1}.
              </span>
              <span className="sr-only">
                {`Phase ${index + 1}: Steps ${phase.steps}.`}
              </span>
              <span aria-hidden="true">
                <span className="text-emerald-700 font-semibold">
                  {phase.steps}
                </span>
                {' '}
                {phase.label}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div
          className="bg-white rounded-3xl border p-8 text-center text-gray-500"
          role="status"
        >
          No phases defined yet.
        </div>
      )}
    </section>
  )
}

export default StepsIndex