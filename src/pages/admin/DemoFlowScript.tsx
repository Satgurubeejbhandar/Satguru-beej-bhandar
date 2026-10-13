import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ListOrdered, CheckCircle2, Circle, RotateCcw, Copy, Check, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

type Step = {
  id: number
  title: string
  detail: string
  copyableData?: string
}

const DEMO_STEPS: Step[] = [
  {
    id: 1,
    title: 'Company → Product Creation',
    detail: 'Set selling rate to ₹520',
    copyableData: '520',
  },
  {
    id: 2,
    title: 'Inventory Purchase Entry',
    detail: 'Purchase 100 pcs for Batch B1 (Expiry set to future date)',
    copyableData: 'B1',
  },
  {
    id: 3,
    title: 'Verify Master Stock (SARA SAMAN)',
    detail: 'Ensure stock shows 100 pcs along with updated rates',
  },
  {
    id: 4,
    title: 'Setup Farmer Account & Security',
    detail: 'Credit Limit: 50,000 | PIN: 123456',
    copyableData: '123456',
  },
  {
    id: 5,
    title: 'Generate Sales Bill',
    detail: 'Bill 5 pcs → Verify stock drops to 95 & outstanding increases',
  },
  {
    id: 6,
    title: 'Process Payment Entry',
    detail: 'Receive ₹1,000 payment → Verify outstanding drops & ledger credited',
    copyableData: '1000',
  },
  {
    id: 7,
    title: 'Farmer Self-Service Login',
    detail: 'Farmer sees profile card/history (WhatsApp share option hidden)',
  },
  {
    id: 8,
    title: 'Admin WhatsApp Bill Sharing',
    detail: 'Admin shares bill via WhatsApp (Aadhaar number hidden/masked)',
  },
]

const STORAGE_KEY = 'demo_flow_completed_v1'

const getInitialCompletedSteps = (): number[] => {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to parse demo flow storage:', err)
    return []
  }
}

export default function DemoFlowScript() {
  const [completedSteps, setCompletedSteps] = useState<number[]>(getInitialCompletedSteps)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedSteps))
    } catch (err) {
      console.error('Failed to save demo flow storage:', err)
    }
  }, [completedSteps])

  const toggleStep = useCallback((id: number) => {
    setCompletedSteps((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }, [])

  const resetFlow = useCallback(() => {
    setCompletedSteps([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.error('Failed to clear storage:', err)
    }
    toast.success('Demo progress reset')
  }, [])

  // Copy with Unmount Guard
  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      if (isMountedRef.current) {
        setCopiedText(text)
        toast.success(`Copied: ${text}`)
        setTimeout(() => {
          if (isMountedRef.current) setCopiedText(null)
        }, 2000)
      }
    } catch {
      toast.error('Failed to copy text')
    }
  }

  const progressPercentage = Math.round(
    (completedSteps.length / DEMO_STEPS.length) * 100
  )

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListOrdered className="text-amber-400" size={28} /> Demo Flow Script
          </h1>
          <button
            type="button"
            onClick={resetFlow}
            className="p-2 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Reset Progress"
            aria-label="Reset Progress"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Live Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-emerald-200 font-semibold">
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-400" />
              Demo Walkthrough Progress
            </span>
            <span className="font-mono">
              {completedSteps.length} of {DEMO_STEPS.length} Steps ({progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-emerald-950/80 rounded-full h-2 overflow-hidden border border-emerald-800/50">
            <div
              className="bg-amber-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        {DEMO_STEPS.map((step) => {
          const isDone = completedSteps.includes(step.id)
          return (
            <div
              key={step.id}
              role="checkbox"
              aria-checked={isDone}
              tabIndex={0}
              onClick={() => toggleStep(step.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleStep(step.id)
                }
              }}
              className={`group flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                isDone
                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 text-slate-900'
              }`}
            >
              <div className="mt-0.5 shrink-0 text-emerald-600">
                {isDone ? (
                  <CheckCircle2 className="text-emerald-600 fill-emerald-100" size={20} />
                ) : (
                  <Circle className="text-slate-300 group-hover:text-slate-400" size={20} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-black uppercase tracking-wide ${
                      isDone ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    Step {step.id}: {step.title}
                  </span>

                  {step.copyableData && (
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(step.copyableData!, e)}
                      className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0"
                      title="Copy test parameter"
                      aria-label={`Copy parameter ${step.copyableData}`}
                    >
                      {copiedText === step.copyableData ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} className="text-slate-500" />
                      )}
                      <code>{step.copyableData}</code>
                    </button>
                  )}
                </div>

                <p
                  className={`text-xs font-medium mt-0.5 leading-relaxed ${
                    isDone ? 'text-slate-400 line-through' : 'text-slate-600'
                  }`}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}