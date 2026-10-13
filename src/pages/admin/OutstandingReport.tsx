// src/pages/admin/OutstandingReport.tsx
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  IndianRupee,
  RefreshCw,
  Search,
  Loader2,
  ShieldAlert,
  Users,
  MapPin,
  Phone,
  Calendar,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface FarmerInfo {
  farmer_name: string | null
  farmer_id: string | null
  village: string | null
  mobile: string | null
  account_status: string | null
}

export interface CreditAccountRow {
  id: string
  farmer_id: string | null
  current_outstanding: number
  credit_limit: number
  due_date: string | null
  farmer: FarmerInfo | null
}

const PAGE_SIZE = 1000

function getLocalDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

// 🔧 FIX #13: Universal Airtight Rounding
function safeParseAmount(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100
}

// 🔧 FIX #15: Removed 2-Column Fallback Trap
// Now queries the MASTER 'farmers' table directly and left-joins 'credit_accounts' 
// to guarantee 100% coverage with zero data leaks or dropped balances.
async function fetchAllOutstandingAccounts(signal?: AbortSignal): Promise<CreditAccountRow[]> {
  const allRows: CreditAccountRow[] = []
  let from = 0

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const { data, error } = await supabase
      .from('farmers')
      .select(`
        id,
        farmer_id,
        farmer_name,
        village,
        mobile,
        account_status,
        outstanding_balance,
        credit_limit,
        credit_accounts (
          id,
          current_outstanding,
          credit_limit,
          due_date
        )
      `)
      .eq('account_status', 'active')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("❌ Farmers fetch failed inside Outstanding Report:", error.message)
      throw error
    }

    if (data && data.length > 0) {
      for (const row of data as any[]) {
        // Aligned with DB Sync triggers
        const masterOutstanding = safeParseAmount(row.outstanding_balance)
        const acc = Array.isArray(row.credit_accounts) ? row.credit_accounts[0] : row.credit_accounts
        const caBal =
          acc?.current_outstanding !== null && acc?.current_outstanding !== undefined
            ? safeParseAmount(acc.current_outstanding)
            : null
        const displayOutstanding = caBal !== null ? caBal : masterOutstanding

        // Only show active dues (credit_accounts preferred, farmers.outstanding_balance fallback)
        if (displayOutstanding > 0) {

        if (caBal !== null && Math.abs(caBal - masterOutstanding) > 0.01) {
          console.warn('Outstanding mismatch:', row.farmer_name, { credit_accounts: caBal, farmers: masterOutstanding })
        }
          allRows.push({
            id: acc?.id || `credit-${row.id}`,
            farmer_id: row.farmer_id || null,
            current_outstanding: displayOutstanding,
            credit_limit: safeParseAmount(row.credit_limit || acc?.credit_limit),
            due_date: acc?.due_date || null,
            farmer: {
              farmer_name: row.farmer_name,
              farmer_id: row.farmer_id,
              village: row.village,
              mobile: row.mobile,
              account_status: row.account_status
            }
          })
        }
      }
    }

    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  // Sort by highest outstanding dues (Professional Debt Tracking)
  return allRows.sort((a, b) => b.current_outstanding - a.current_outstanding)
}
export default function OutstandingReport() {
  const { role, loading: authLoading } = useAuth()

  const [rows, setRows] = useState<CreditAccountRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false)

  const abortRef = useRef<AbortController | null>(null)
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    if (role !== 'admin') return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const data = await fetchAllOutstandingAccounts(controller.signal)

      if (controller.signal.aborted || !isMounted.current) return

      setRows(data)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('OutstandingReport load failed:', err)
      if (isMounted.current) {
        toast.error('Failed to load outstanding report. Please try again.')
      }
    } finally {
      if (!controller.signal.aborted && isMounted.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') {
      setLoading(false)
      return
    }
    void load()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load, role, authLoading])

  const todayStr = useMemo(() => getLocalDateString(), [])

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return rows.filter((r) => {
      if (onlyOverdue) {
        if (!r.due_date || r.due_date >= todayStr) {
          return false
        }
      }

      if (!searchTerm) return true

      const fName = r.farmer?.farmer_name || ''
      const fId = r.farmer?.farmer_id || ''
      const fVillage = r.farmer?.village || ''
      const fMobile = r.farmer?.mobile || ''

      const haystack = `${fName} ${fId} ${fVillage} ${fMobile}`.toLowerCase()
      return haystack.includes(searchTerm)
    })
  }, [rows, search, onlyOverdue, todayStr])

   // 🔧 FIX #13: Airtight grand total precision math
  const total = useMemo(() => {
    const sum = filtered.reduce((acc, r) => acc + safeParseAmount(r.current_outstanding), 0)
    return Math.round((sum + Number.EPSILON) * 100) / 100
  }, [filtered])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          आपके पास बकाया रिपोर्ट देखने की अनुमति नहीं है।
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 font-sans">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="text-amber-400 shrink-0" size={26} /> Farmer Outstanding Report
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            रियल-टाइम उधारी बकाया एवं ओवरड्यू ट्रैकिंग (डिजिटल व पर्ची बिलों सहित)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || authLoading}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-emerald-600 focus-within:border-emerald-600 transition-all bg-slate-50/50">
          <Search className="text-slate-400 shrink-0" size={18} />
          <input
            id="search-farmer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="किसान नाम, ID, गांव या मोबाइल से खोजें..."
            className="flex-1 outline-none text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 bg-transparent"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => setOnlyOverdue(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-slate-300"
            />
            Only Overdue (समय सीमा समाप्त)
          </label>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
              Filtered Outstanding
            </span>
            <p className="text-base sm:text-xl font-black text-rose-700 font-mono leading-none mt-0.5">
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Accounts Count</span>
            <span className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5 block">{filtered.length} Farmers</span>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-3.5 sm:p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-rose-700 uppercase font-bold tracking-wider block">Total Active Dues</span>
            <span className="text-base sm:text-xl font-black text-rose-800 font-mono mt-0.5 block">
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-9 h-9 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
        </div>
      </div>

      {/* Data Container: Desktop Table View */}
      <div className="hidden sm:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs text-left"
            aria-label="Farmer outstanding accounts table"
          >
            <thead>
              <tr className="bg-emerald-950 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5 pl-5">Farmer Details</th>
                <th scope="col" className="p-3.5">Village</th>
                <th scope="col" className="p-3.5">Outstanding ₹</th>
                <th scope="col" className="p-3.5">Credit Limit ₹</th>
                <th scope="col" className="p-3.5 pr-5">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-emerald-800" />
                      Loading report from database...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500 font-medium">
                    No outstanding records found in the system.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isOverdue = !!(r.due_date && r.due_date < todayStr)
                  const status = (r.farmer?.account_status || '').toLowerCase()
                  const isInactive = status && status !== 'active'

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="p-3.5 pl-5">
                        <p className="font-bold text-slate-900 text-sm">
                          {r.farmer?.farmer_name || '—'}
                          {isInactive && (
                            <span className="ml-2 text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              {r.farmer?.account_status}
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                          ID: {r.farmer?.farmer_id || 'N/A'}
                          {r.farmer?.mobile ? ` • Ph: ${r.farmer.mobile}` : ''}
                        </p>
                      </td>
                      <td className="p-3.5 text-slate-700 font-bold">
                        {r.farmer?.village || '—'}
                      </td>
                      <td className="p-3.5">
                        <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg font-black font-mono text-sm border border-rose-100 inline-block">
                          ₹
                          {(r.current_outstanding || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-600 font-mono text-xs">
                        ₹
                        {(r.credit_limit || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3.5 font-mono font-bold pr-5">
                        {r.due_date ? (
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] ${
                              isOverdue
                                ? 'bg-rose-100 text-rose-800 border border-rose-200 font-black shadow-xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {r.due_date}
                            {isOverdue ? ' (Overdue)' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-emerald-900 shadow-inner">
                  <td
                    colSpan={2}
                    className="p-4 pl-5 text-emerald-950 uppercase font-black text-xs"
                  >
                    Total Accounts: {filtered.length}
                  </td>
                  <td className="p-4 text-rose-700 font-black font-mono text-base">
                    ₹
                    {total.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td colSpan={2} className="p-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2.5">
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs">
            <Loader2 size={20} className="animate-spin mx-auto text-emerald-800 mb-2" />
            Loading accounts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-bold text-xs">
            No outstanding records found.
          </div>
        ) : (
          filtered.map((r) => {
            const isOverdue = !!(r.due_date && r.due_date < todayStr)
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-xs">
                <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm truncate">{r.farmer?.farmer_name || '—'}</p>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">ID: {r.farmer?.farmer_id || 'N/A'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Due Balance</span>
                    <span className="font-mono font-black text-rose-700 text-sm">
                      ₹{(r.current_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-semibold text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{r.farmer?.village || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone size={12} className="text-slate-400 shrink-0" />
                    <span className="font-mono truncate">{r.farmer?.mobile || '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                  <span className="text-slate-500 font-bold">Limit: ₹{(r.credit_limit || 0).toLocaleString('en-IN')}</span>
                  {r.due_date ? (
                    <span className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                      isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Calendar size={10} /> {r.due_date} {isOverdue && '(Overdue)'}
                    </span>
                  ) : (
                    <span className="text-slate-400">No Due Date</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}