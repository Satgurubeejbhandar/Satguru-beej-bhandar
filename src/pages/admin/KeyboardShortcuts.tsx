import { useState, useMemo } from 'react'
import { Keyboard, Search, Zap, Command, Layers, X, ShieldCheck } from 'lucide-react'

interface ShortcutItem {
  id: string
  keys: string[]
  action: string
  category: 'Billing' | 'Navigation' | 'System'
}

const SHORTCUTS: ShortcutItem[] = [
  // 🧾 Billing & Sales
  { id: 'new_bill', keys: ['Alt', 'N'], action: 'Create New Sale / Udhaar Bill', category: 'Billing' },
  { id: 'search_product', keys: ['F2'], action: 'Focus Product Search Bar', category: 'Billing' },
  { id: 'save_bill', keys: ['Ctrl', 'Enter'], action: 'Save & Print Current Bill', category: 'Billing' },
  { id: 'cancel_modal', keys: ['Esc'], action: 'Close Modal / Cancel Action', category: 'Billing' },

  // 🧭 Navigation
  { id: 'quick_actions', keys: ['Alt', 'Q'], action: 'Open Mobile Quick Actions Menu', category: 'Navigation' },
  { id: 'farmer_search', keys: ['Alt', 'F'], action: 'Open Farmer Master Search', category: 'Navigation' },
  { id: 'stock_view', keys: ['Alt', 'S'], action: 'Check Live Stock (Sara Saman)', category: 'Navigation' },

  // ⚙️ System & Browser
  { id: 'hard_refresh', keys: ['Ctrl', 'Shift', 'R'], action: 'Hard Refresh Page (Clear Cache)', category: 'System' },
  { id: 'toggle_sidebar', keys: ['Ctrl', 'B'], action: 'Collapse / Expand Navigation Sidebar', category: 'System' },
]

export default function KeyboardShortcuts() {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter shortcuts by search query
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

  // Group by category
  const categories = useMemo(() => ['Billing', 'Navigation', 'System'] as const, [])

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Keyboard className="text-amber-400 shrink-0" size={28} /> Shortcuts &amp; Hotkeys
          </h1>
          <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Speed up daily billing, POS, and stock operations
          </p>
        </div>
        <div className="p-3 bg-emerald-800/80 rounded-2xl border border-emerald-700 hidden sm:block shadow-xs">
          <Command size={22} className="text-amber-400" />
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="text"
          placeholder="Search shortcut by key or action (e.g. 'F2', 'Bill', 'Alt')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search keyboard shortcuts"
          className="w-full text-xs font-semibold text-slate-800 outline-none placeholder-slate-400 bg-transparent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="Clear shortcut search"
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 shrink-0 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Categories & Shortcuts List */}
      <div className="space-y-5">
        {filteredShortcuts.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-semibold">
            No shortcuts found matching "{searchTerm}"
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = filteredShortcuts.filter((s) => s.category === cat)
            if (catItems.length === 0) return null

            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-1.5 px-2">
                  {cat === 'Billing' && <Zap size={14} className="text-amber-500 shrink-0" />}
                  {cat === 'Navigation' && <Layers size={14} className="text-emerald-600 shrink-0" />}
                  {cat === 'System' && <Command size={14} className="text-blue-500 shrink-0" />}
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    {cat} Shortcuts
                  </h2>
                </div>

                <div 
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden"
                  role="list"
                  aria-label={`${cat} shortcuts list`}
                >
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      role="listitem"
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-800 flex-1">
                        {item.action}
                      </span>

                      {/* Styled KBD Key Badges */}
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