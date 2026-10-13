// src/pages/admin/AdvancedFarmerSearch.tsx
import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Search, Loader2, User, FileText, IndianRupee, AlertCircle, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface CreditAccount {
  id?: string
  current_outstanding?: number | string | null
  available_credit?: number | string | null
  credit_limit?: number | string | null
}

interface FarmerRecord {
  id: string
  farmer_id: string
  farmer_name: string
  father_name?: string | null
  mobile?: string | null
  village?: string | null
  credit_limit?: number | string | null
  outstanding_balance?: number | string | null
  matched_old_id?: string
  credit_accounts?: CreditAccount[] | CreditAccount | null
  bills?: BillRecord[]
  payments?: PaymentRecord[]
}

interface BillRecord {
  id?: string
  bill_number: string
  bill_date: string
  total_amount: number | string
  bill_status?: string
}

interface PaymentRecord {
  id?: string
  payment_number: string
  payment_date: string
  payment_amount: number | string
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[(),."\\%]/g, '').trim()
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export default function AdvancedFarmerSearch() {
  const { role, loading: authLoading } = useAuth()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [results, setResults] = useState<FarmerRecord[]>([])
  const [selected, setSelected] = useState<FarmerRecord | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (role !== 'admin') return

    const raw = q.trim()
    if (!raw) return

    const term = sanitizeSearchTerm(raw)
    if (!term) {
      toast.error('कृपया सही सर्च कीवर्ड दर्ज करें')
      return
    }

    setLoading(true)
    setSearchError(null)
    setSelected(null)

    try {
      const { data: byCurrent, error: currentError } = await supabase
        .from('farmers')
        .select('*, credit_accounts(*)')
        .or(
          `farmer_id.ilike.%${term}%,farmer_name.ilike.%${term}%,mobile.ilike.%${term}%,village.ilike.%${term}%`
        )
        .limit(30)

      if (currentError) throw currentError

      let fromHistory: FarmerRecord[] = []
      try {
        const { data: hist } = await supabase
          .from('farmer_id_history')
          .select('farmer_id, old_farmer_id')
          .ilike('old_farmer_id', `%${term}%`)
          .limit(20)

        if (hist && hist.length > 0) {
          const ids = hist.map((h) => h.farmer_id)
          const { data: histFarmers } = await supabase
            .from('farmers')
            .select('*, credit_accounts(*)')
            .in('id', ids)

          if (histFarmers) {
            fromHistory = histFarmers.map((f: any) => ({
              ...f,
              matched_old_id: hist.find((h) => h.farmer_id === f.id)?.old_farmer_id,
            }))
          }
        }
      } catch {
        // Non-blocking
      }

      if (!isMounted.current) return

      const map = new Map<string, FarmerRecord>()
      ;[...(byCurrent || []), ...fromHistory].forEach((item: any) => {
        if (item && item.id && !map.has(item.id)) {
          map.set(item.id, item as FarmerRecord)
        }
      })

      const finalResults = Array.from(map.values())
      setResults(finalResults)

      if (finalResults.length === 0) {
        toast('कोई किसान नहीं मिला', { icon: '🔍' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'सर्च में समस्या आई'
      if (isMounted.current) {
        setSearchError(msg)
        toast.error('Search Error: ' + msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }

  const openFarmer = async (f: FarmerRecord) => {
    if (role !== 'admin') return
    setDetailLoading(true)
    setSelected(null)

    try {
      const billsPromise = supabase
        .from('sales_bills')
        .select('id, bill_number, bill_date, total_amount, bill_status')
        .eq('farmer_id', f.id)
        .order('bill_date', { ascending: false })
        .limit(10)

      const paymentsPromise = supabase
        .from('payments')
        .select('id, payment_number, payment_date, payment_amount')
        .eq('farmer_id', f.id)
        .order('payment_date', { ascending: false })
        .limit(10)

      const [billsRes, paysRes] = await Promise.all([billsPromise, paymentsPromise])

      let billsList: BillRecord[] = []
      if (!billsRes.error && billsRes.data) {
        billsList = billsRes.data.map((b: any) => ({
          id: b.id,
          bill_number: b.bill_number || '—',
          bill_date: b.bill_date || '—',
          total_amount: b.total_amount || 0,
          bill_status: b.bill_status,
        }))
      }

      let paymentsList: PaymentRecord[] = []
      if (!paysRes.error && paysRes.data && paysRes.data.length > 0) {
        paymentsList = paysRes.data.map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number || '—',
          payment_date: p.payment_date || '—',
          payment_amount: p.payment_amount || 0,
        }))
      } else {
        // Fallback: check farmer_payments table
        const { data: fpData } = await supabase
          .from('farmer_payments')
          .select('id, payment_number, created_at, payment_amount')
          .eq('farmer_id', f.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (fpData) {
          paymentsList = fpData.map((fp: any) => ({
            id: fp.id,
            payment_number: fp.payment_number || '—',
            payment_date: fp.created_at ? fp.created_at.split('T')[0] : '—',
            payment_amount: fp.payment_amount || 0,
          }))
        }
      }

      if (isMounted.current) {
        setSelected({
          ...f,
          bills: billsList,
          payments: paymentsList,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Farmer details load नहीं हो सकीं'
      if (isMounted.current) {
        toast.error(msg)
      }
    } finally {
      if (isMounted.current) {
        setDetailLoading(false)
      }
    }
  }

  const getCreditInfo = (f: FarmerRecord) => {
    let creditAcc: CreditAccount | undefined

    if (Array.isArray(f.credit_accounts)) {
      creditAcc = f.credit_accounts[0]
    } else if (f.credit_accounts && typeof f.credit_accounts === 'object') {
      creditAcc = f.credit_accounts
    }

    const outstanding = safeNum(creditAcc?.current_outstanding ?? f.outstanding_balance ?? 0)
    const available = safeNum(creditAcc?.available_credit ?? f.credit_limit ?? 0)

    return { outstanding, available }
  }

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Advanced Farmer Search की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="text-amber-400" size={28} /> Advanced Farmer Search
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Farmer Name · Mobile · Village · Farmer ID · Old History ID
        </p>
      </div>

      <form
        onSubmit={search}
        className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex gap-2"
      >
        <div className="flex-1 flex items-center gap-2 px-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by Farmer ID / Old ID / Name / Mobile / Village..."
            className="w-full outline-none text-sm font-medium bg-transparent text-slate-800"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-800 text-xs font-bold">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{searchError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b font-bold text-sm flex items-center gap-2">
            <User size={14} className="text-emerald-700" />
            Results ({results.length})
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto text-xs">
            {results.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => openFarmer(f)}
                disabled={detailLoading}
                className={`w-full text-left p-3 hover:bg-emerald-50 transition-colors cursor-pointer ${
                  selected?.id === f.id ? 'bg-emerald-50 border-l-4 border-emerald-600 font-bold' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{f.farmer_name}</p>
                    <p className="font-mono text-emerald-800 font-bold">{f.farmer_id}</p>
                  </div>
                  {f.matched_old_id && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                      Old ID: {f.matched_old_id}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 mt-1">
                  {f.village || '—'} · {f.mobile || '—'}
                </p>
              </button>
            ))}
            {!loading && results.length === 0 && (
              <p className="p-8 text-center text-gray-400 font-medium">
                🔍 No farmers found. Enter search query above.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-xs min-h-[220px]">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="animate-spin text-emerald-600 mb-2" size={28} />
              <p className="font-bold">Loading farmer details...</p>
            </div>
          ) : !selected ? (
            <p className="text-gray-400 text-center py-16 font-medium">
              👈 Select a farmer from the results list to view ledger summary
            </p>
          ) : (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <h2 className="font-black text-lg text-emerald-950">
                  {selected.farmer_name}
                </h2>
                <p className="font-mono font-bold text-emerald-800">
                  Farmer ID: {selected.farmer_id}
                </p>
                <p className="text-gray-600 mt-1 font-medium">
                  S/O {selected.father_name || '—'} · Village: {selected.village || '—'} · Mobile: {selected.mobile || '—'}
                </p>
              </div>

              {(() => {
                const { outstanding, available } = getCreditInfo(selected)
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Total Outstanding</p>
                      <p className="font-black text-rose-700 text-base mt-0.5">
                        ₹{formatINR(outstanding)}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Available Credit</p>
                      <p className="font-black text-emerald-800 text-base mt-0.5">
                        ₹{formatINR(available)}
                      </p>
                    </div>
                  </div>
                )
              })()}

              <div className="pt-2">
                <p className="font-bold text-gray-900 mb-1.5 flex items-center gap-1 text-sm">
                  <FileText size={14} className="text-blue-600" /> Recent Bills (Last 10)
                </p>
                {(selected.bills || []).length === 0 ? (
                  <p className="text-gray-400 py-1">No sales bills found</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(selected.bills || []).map((b, idx) => (
                      <div key={b.id || `${b.bill_number}-${idx}`} className="text-gray-700 flex justify-between bg-gray-50 p-2 rounded-lg">
                        <span>
                          {b.bill_date} · <span className="font-mono font-bold text-gray-900">{b.bill_number}</span>
                        </span>
                        <span className="font-black text-gray-900">
                          ₹{formatINR(b.total_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <p className="font-bold text-gray-900 mb-1.5 flex items-center gap-1 text-sm">
                  <IndianRupee size={14} className="text-emerald-600" /> Recent Payments (Last 10)
                </p>
                {(selected.payments || []).length === 0 ? (
                  <p className="text-gray-400 py-1">No payment receipts found</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(selected.payments || []).map((p, idx) => (
                      <div key={p.id || `${p.payment_number}-${idx}`} className="text-gray-700 flex justify-between bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <span>
                          {p.payment_date} · <span className="font-mono font-bold text-emerald-950">{p.payment_number}</span>
                        </span>
                        <span className="font-black text-emerald-700">
                          ₹{formatINR(p.payment_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}