import { useState, useMemo } from 'react'
import {
  Keyboard, Search, Zap, Command, Layers, X,
  ShieldCheck, CheckCircle2, Info
} from 'lucide-react'

interface ShortcutItem {
  id: string
  keys: string[]
  action: string
  category: 'Billing' | 'Navigation' | 'System'
  active: boolean  // ← kya yeh shortcut actually kaam karta hai?
}

const SHORTCUTS: ShortcutItem[] = [
  // 🧾 Billing & Sales
  { id: 'new_bill', keys: ['Alt', 'N'], action: 'Open Billing POS (New Bill)', category: 'Billing', active: true },
  { id: 'save_bill', keys: ['Ctrl', 'Enter'], action: 'Save & Print Bill (on Billing page)', category: 'Billing', active: false },
  { id: 'cancel_modal', keys: ['Esc'], action: 'Go Back to Dashboard / Close Modal', category: 'Billing', active: true },

  // 🧭 Navigation
  { id: 'dashboard', keys: ['Alt', 'D'], action: 'Go to Dashboard', category: 'Navigation', active: true },
  { id: 'quick_actions', keys: ['Alt', 'Q'], action: 'Open Quick Actions', category: 'Navigation', active: true },
  { id: 'farmer_search', keys: ['Alt', 'F'], action: 'Open Farmer Search', category: 'Navigation', active: true },
  { id: 'stock_view', keys: ['Alt', 'S'], action: 'Open Sara Saman (Stock)', category: 'Navigation', active: true },
  { id: 'ledger', keys: ['Alt', 'L'], action: 'Open Farmer Ledger', category: 'Navigation', active: true },
  { id: 'payments', keys: ['Alt', 'P'], action: 'Open Payments', category: 'Navigation', active: true },
  { id: 'reports', keys: ['Alt', 'R'], action: 'Open Reports Hub', category: 'Navigation', active: true },
  { id: 'ctrl_k', keys: ['Ctrl', 'K'], action: 'Quick Search (Farmer Search)', category: 'Navigation', active: true },

  // ⚙️ System
  { id: 'hard_refresh', keys: ['Ctrl', 'Shift', 'R'], action: 'Hard Refresh Page (Clear Cache)', category: 'System', active: true },
]

export default function KeyboardShortcuts() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredShortcuts = useMemo(() => {
    if (!searchTerm.trim()) return SHORTCUTS
    const term = searchTerm.toLowerCase().trim()
    return SHORTCUTS.filter(
      (s) =>
        s.action.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        s.keys.some((k) => k.toLowerCase().includes(term))
    )
  }, [searchTerm])

  const categories = useMemo(() => ['Billing', 'Navigation', 'System'] as const, [])

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Keyboard className="text-amber-400 shrink-0" size={28} /> Shortcuts & Hotkeys
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Global keyboard shortcuts — kisi bhi admin page pe kaam karte hain
          </p>
        </div>
        <div className="p-3 bg-emerald-800/80 rounded-2xl border border-emerald-700 hidden sm:block">
          <Command size={22} className="text-amber-400" />
        </div>
      </div>

      {/* Active Info Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2">
        <Info size={16} className="text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-[11px] text-emerald-800 font-medium">
          <strong>Active</strong> shortcuts globally kaam karte hain (jab aap input field mein type nahi kar rahe hote).
          <strong> Coming Soon</strong> shortcuts sirf specific pages pe kaam karenge.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search shortcut (e.g. 'Alt', 'Bill', 'Stock')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search keyboard shortcuts"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Shortcuts List */}
      <div className="space-y-5">
        {filteredShortcuts.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border text-center text-slate-400 text-xs font-semibold">
            No shortcuts found matching "{searchTerm}"
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = filteredShortcuts.filter((s) => s.category === cat)
            if (catItems.length === 0) return null

            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-1.5 px-2">
                  {cat === 'Billing' && <Zap size={14} className="text-amber-500" />}
                  {cat === 'Navigation' && <Layers size={14} className="text-emerald-600" />}
                  {cat === 'System' && <Command size={14} className="text-blue-500" />}
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    {cat}
                  </h2>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.active ? (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                            SOON
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {item.action}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono">
                        {item.keys.map((k, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-mono font-black text-slate-800 shadow-[0_2px_0_0_rgba(0,0,0,0.1)]">
                              {k}
                            </kbd>
                            {idx < item.keys.length - 1 && (
                              <span className="text-slate-300 font-bold text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}