import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Hash, RefreshCw, AlertCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

// 1. Interfaces & Types defined strictly
interface SalesBill {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number
}

interface PurchaseBill {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number
}

interface Payment {
  id: string
  payment_number: string
  payment_date: string
  payment_amount: number
}

const LIMIT = 20

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    }).format(d)
  } catch {
    return '—'
  }
}

export default function BillSeriesViewer() {
  const [sales, setSales] = useState<SalesBill[]>([])
  const [purchases, setPurchases] = useState<PurchaseBill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const isMounted = useRef(true)

  // ─── Fetch Document Series ──────────────────────────────────────────────

  const load = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      // 1. Sales Bills Query
      const salesQuery = supabase
        .from('sales_bills')
        .select('id, bill_number, bill_date, total_amount')
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      // 2. Purchase Bills Query
      const purchaseQuery = supabase
        .from('purchase_bills')
        .select('id, bill_number, bill_date, total_amount')
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      // 3. Payment Register Query (Primary)
      const paymentRegisterQuery = supabase
        .from('payments')
        .select('id, payment_number, payment_date, payment_amount')
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      // Use Promise.allSettled so a single missing table doesn't block the rest
      const [salesRes, purchaseRes, paymentRes] = await Promise.allSettled([
        salesQuery,
        purchaseQuery,
        paymentRegisterQuery,
      ])

      if (currentRequestId !== requestIdRef.current || !isMounted.current) return

      let loadedSales: SalesBill[] = []
      let loadedPurchases: PurchaseBill[] = []
      let loadedPayments: Payment[] = []

      // Unpack Sales Bills
      if (salesRes.status === 'fulfilled' && !salesRes.value.error && salesRes.value.data) {
        loadedSales = salesRes.value.data.map((s: any) => ({
          id: s.id,
          bill_number: s.bill_number || '—',
          bill_date: s.bill_date || '',
          total_amount: safeNum(s.total_amount),
        }))
      }

      // Unpack Purchase Bills
      if (purchaseRes.status === 'fulfilled' && !purchaseRes.value.error && purchaseRes.value.data) {
        loadedPurchases = purchaseRes.value.data.map((p: any) => ({
          id: p.id,
          bill_number: p.bill_number || '—',
          bill_date: p.bill_date || '',
          total_amount: safeNum(p.total_amount),
        }))
      }

      // Unpack Payments (`payments.payment_amount`)
      if (paymentRes.status === 'fulfilled' && !paymentRes.value.error && paymentRes.value.data && paymentRes.value.data.length > 0) {
        loadedPayments = paymentRes.value.data.map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number || '—',
          payment_date: p.payment_date || '',
          payment_amount: safeNum(p.payment_amount ?? p.amount),
        }))
      } else {
        // Fallback check on 'payments' table
        try {
          const { data: legacyPayments } = await supabase
            .from('payments')
            .select('id, payment_number, payment_date, payment_amount')
            .order('created_at', { ascending: false })
            .limit(LIMIT)

          if (legacyPayments && legacyPayments.length > 0) {
            loadedPayments = legacyPayments.map((p: any) => ({
              id: p.id,
              payment_number: p.payment_number || '—',
              payment_date: p.payment_date || '',
              payment_amount: safeNum(p.payment_amount),
            }))
          }
        } catch {
          // Non-blocking fallback
        }
      }

      setSales(loadedSales)
      setPurchases(loadedPurchases)
      setPayments(loadedPayments)
    } catch (err: unknown) {
      if (currentRequestId === requestIdRef.current && isMounted.current) {
        const errorMsg = err instanceof Error ? err.message : 'Something went wrong while fetching document series'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } finally {
      if (currentRequestId === requestIdRef.current && isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    load()

    return () => {
      isMounted.current = false
    }
  }, [load])

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header section */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hash className="text-amber-400 shrink-0" size={28} /> Document Number Series
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Latest BILL / PUR / PAY numbers across active registers
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-60 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Main content body */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-md mx-auto">
          <AlertCircle className="text-rose-500 mx-auto mb-3" size={32} />
          <h3 className="font-bold text-rose-950 text-sm mb-1">Failed to Load Documents</h3>
          <p className="text-xs text-rose-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        /* Premium Skeleton Loader */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm animate-pulse">
              <div className="bg-slate-100 h-10 w-full" />
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="bg-slate-100 h-4 w-1/3 rounded" />
                    <div className="bg-slate-100 h-4 w-1/4 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          
          {/* Column 1: Sales Bills */}
          <DocumentSection title="Sales Bills" count={sales.length}>
            {sales.map((b, idx) => (
              <div key={b.id || `${b.bill_number}-${idx}`} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono font-bold text-slate-800">{b.bill_number}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(b.bill_date)}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatINR(b.total_amount)}</span>
              </div>
            ))}
          </DocumentSection>

          {/* Column 2: Purchase Bills */}
          <DocumentSection title="Purchase Bills" count={purchases.length}>
            {purchases.map((b, idx) => (
              <div key={b.id || `${b.bill_number}-${idx}`} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono font-bold text-slate-800">{b.bill_number}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(b.bill_date)}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatINR(b.total_amount)}</span>
              </div>
            ))}
          </DocumentSection>

          {/* Column 3: Payments */}
          <DocumentSection title="Payments" count={payments.length}>
            {payments.map((b, idx) => (
              <div key={b.id || `${b.payment_number}-${idx}`} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono font-bold text-slate-800">{b.payment_number}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(b.payment_date)}</span>
                </div>
                <span className="font-semibold text-emerald-700">{formatINR(b.payment_amount)}</span>
              </div>
            ))}
          </DocumentSection>
          
        </div>
      )}
    </div>
  )
}

// DRY UI helper subcomponent for listing cards
interface SectionProps {
  title: string
  count: number
  children: React.ReactNode
}

function DocumentSection({ title, count, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-96">
      <div className="bg-emerald-800 text-white px-4 py-3 font-bold flex justify-between items-center">
        <span>{title}</span>
        <span className="text-[10px] font-normal bg-emerald-950/40 px-2 py-0.5 rounded-full font-mono">
          Latest {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
            <FileText size={24} className="opacity-40 mb-1" />
            <span className="font-medium text-[11px]">No documents found</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}