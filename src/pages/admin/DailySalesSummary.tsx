// src/pages/admin/DailySalesSummary.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Calendar,
  RefreshCw,
  TrendingUp,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Camera,
  Layers,
  RotateCcw,
  IndianRupee,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DailySaleBill {
  id: string
  bill_number: string
  bill_type: string
  total_amount: number
  bill_date: string
  farmer_name: string
  is_physical?: boolean
  file_path?: string | null
}

interface DailyPayment {
  id: string
  payment_number: string
  payment_amount: number
  payment_mode: string
  farmer_name: string
}

interface DailyReturn {
  id: string
  return_number: string
  total_amount: number
  return_date: string
  reason: string | null
  farmer_name: string
  original_bill_number?: string | null
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Always use IST for billing date default
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default function DailySalesSummary() {
  const { role, loading: authLoading } = useAuth()
  const [selectedDate, setSelectedDate] = useState<string>(todayIST)
  const [salesBills, setSalesBills] = useState<DailySaleBill[]>([])
  const [physicalBills, setPhysicalBills] = useState<DailySaleBill[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const [returnsList, setReturnsList] = useState<DailyReturn[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const isMountedRef = useRef<boolean>(true)

  const loadDailySummary = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)

      const startTimeIST = `${selectedDate}T00:00:00+05:30`
      const endTimeIST = `${selectedDate}T23:59:59+05:30`

      const [
        salesRes,
        physicalSalesRes,
        paymentsRes,
        stdPaymentsRes,
        returnsRes,
      ] = await Promise.all([
        supabase
          .from('sales_bills')
          .select(
            'id, bill_number, bill_type, total_amount, bill_date, farmer:farmers(farmer_name)'
          )
          .eq('bill_date', selectedDate)
          .eq('bill_status', 'active'),

        supabase
          .from('physical_bills')
          .select(
            'id, bill_number, bill_type, transaction_type, bill_amount, bill_date, file_path, farmer:farmers(farmer_name)'
          )
          .eq('bill_date', selectedDate)
          .eq('status', 'active'),

        supabase
          .from('farmer_payments')
          .select(
            'id, payment_number, payment_amount, payment_mode, created_at, farmer:farmers(farmer_name)'
          )
          .gte('created_at', startTimeIST)
          .lte('created_at', endTimeIST),

        supabase
          .from('payments')
          .select(
            'id, payment_number, payment_amount, payment_mode, payment_date, farmer:farmers(farmer_name)'
          )
          .eq('payment_date', selectedDate),

        // 🟢 Farmer product returns for the day
        supabase
          .from('returns')
          .select(
            `
            id,
            return_number,
            total_amount,
            return_date,
            reason,
            return_status,
            farmer:farmers(farmer_name, farmer_id),
            original_bill:sales_bills(bill_number)
          `
          )
          .eq('return_date', selectedDate),
      ])

      if (salesRes.error) throw salesRes.error
      if (physicalSalesRes.error) throw physicalSalesRes.error
      if (paymentsRes.error) throw paymentsRes.error
      if (stdPaymentsRes.error) throw stdPaymentsRes.error
      // returns error soft-handle (table always exists now, but keep safe)
      if (returnsRes.error) {
        console.warn('Returns fetch warning:', returnsRes.error)
      }

      if (isMountedRef.current) {
        // Digital Sales Bills
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSalesBills(
          (salesRes.data || []).map((s: any) => ({
            id: s.id,
            bill_number: s.bill_number,
            bill_type: s.bill_type || 'udhaar',
            total_amount: safeNum(s.total_amount),
            bill_date: s.bill_date,
            farmer_name:
              (Array.isArray(s.farmer) ? s.farmer[0]?.farmer_name : s.farmer?.farmer_name) ||
              'Customer/Group',
            is_physical: false,
          }))
        )

        // Physical Paper Bills
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPhysicalBills(
          (physicalSalesRes.data || []).map((pb: any) => ({
            id: pb.id,
            bill_number: pb.bill_number,
            bill_type: pb.transaction_type || pb.bill_type || 'udhaar',
            total_amount: safeNum(pb.bill_amount),
            bill_date: pb.bill_date,
            farmer_name:
              (Array.isArray(pb.farmer) ? pb.farmer[0]?.farmer_name : pb.farmer?.farmer_name) ||
              'Farmer',
            is_physical: true,
            file_path: pb.file_path,
          }))
        )

        // Unified deduplicated payments
        const mergedPayments: DailyPayment[] = []
        const seenNumbers = new Set<string>()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw1 = (paymentsRes.data || []).map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number,
          payment_amount: safeNum(p.payment_amount),
          payment_mode: p.payment_mode || 'cash',
          farmer_name:
            (Array.isArray(p.farmer) ? p.farmer[0]?.farmer_name : p.farmer?.farmer_name) ||
            'Farmer',
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw2 = (stdPaymentsRes.data || []).map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number,
          payment_amount: safeNum(p.payment_amount),
          payment_mode: p.payment_mode || 'cash',
          farmer_name:
            (Array.isArray(p.farmer) ? p.farmer[0]?.farmer_name : p.farmer?.farmer_name) ||
            'Farmer',
        }))

        ;[...raw1, ...raw2].forEach((pay) => {
          if (pay.payment_number && !seenNumbers.has(pay.payment_number)) {
            seenNumbers.add(pay.payment_number)
            mergedPayments.push(pay)
          } else if (!pay.payment_number) {
            // fallback unique by id
            mergedPayments.push(pay)
          }
        })

        setPayments(mergedPayments)

        // Farmer returns (exclude void/cancelled)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedReturns: DailyReturn[] = (returnsRes.data || [])
          .map((r: any) => {
            const st = String(r.return_status || 'completed').toLowerCase()
            if (st === 'void' || st === 'cancelled' || st === 'canceled') return null

            const farmerName =
              (Array.isArray(r.farmer) ? r.farmer[0]?.farmer_name : r.farmer?.farmer_name) ||
              'Farmer'

            const originalBillNo = Array.isArray(r.original_bill)
              ? r.original_bill[0]?.bill_number
              : r.original_bill?.bill_number

            return {
              id: r.id,
              return_number: r.return_number,
              total_amount: safeNum(r.total_amount),
              return_date: r.return_date,
              reason: r.reason || null,
              farmer_name: farmerName,
              original_bill_number: originalBillNo || null,
            } as DailyReturn
          })
          .filter(Boolean) as DailyReturn[]

        setReturnsList(mappedReturns)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Daily summary load failed'
      if (isMountedRef.current) {
        toast.error('दैनिक बिक्री समरी लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [selectedDate, role])

  useEffect(() => {
    isMountedRef.current = true
    if (!authLoading && role === 'admin') {
      loadDailySummary()
    }
    return () => {
      isMountedRef.current = false
    }
  }, [loadDailySummary, role, authLoading])

  const totals = useMemo(() => {
    let digitalSales = 0
    let digitalCash = 0
    let digitalUdhaar = 0

    let physicalSales = 0
    let physicalCash = 0
    let physicalUdhaar = 0

    let totalRecovery = 0
    let totalReturns = 0

    salesBills.forEach((b) => {
      digitalSales += b.total_amount
      if (String(b.bill_type).toLowerCase() === 'cash') digitalCash += b.total_amount
      else digitalUdhaar += b.total_amount
    })

    physicalBills.forEach((pb) => {
      physicalSales += pb.total_amount
      if (String(pb.bill_type).toLowerCase() === 'cash') physicalCash += pb.total_amount
      else physicalUdhaar += pb.total_amount
    })

    payments.forEach((p) => {
      totalRecovery += p.payment_amount
    })

    returnsList.forEach((r) => {
      totalReturns += r.total_amount
    })

    const grossSales = digitalSales + physicalSales
    const netSales = Math.max(0, grossSales - totalReturns)
    const grandTotalCash = digitalCash + physicalCash
    const grandTotalUdhaar = digitalUdhaar + physicalUdhaar

    // Net credit exposure approximation for the day:
    // Udhaar sales remain, but returns reduce net billed value.
    // (Returns are usually against prior/current udhaar bills.)
    const netUdhaarAfterReturns = Math.max(0, grandTotalUdhaar - totalReturns)

    return {
      digitalSales,
      physicalSales,
      grossSales,
      totalReturns,
      netSales,
      grandTotalCash,
      grandTotalUdhaar,
      netUdhaarAfterReturns,
      totalRecovery,
      returnsCount: returnsList.length,
      digitalCount: salesBills.length,
      physicalCount: physicalBills.length,
      paymentsCount: payments.length,
    }
  }, [salesBills, physicalBills, payments, returnsList])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">आपके पास दैनिक बिक्री समरी देखने की अनुमति नहीं है।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 bg-slate-50/30 min-h-screen font-sans">
      {/* Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 rounded-xl border border-emerald-700/50">
              <TrendingUp className="text-amber-400 shrink-0" size={24} />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight">
              Daily Sales &amp; Recovery Summary
            </h1>
          </div>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 flex-wrap">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            Digital + Physical sales − Farmer returns + Payment recovery
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-emerald-850 hover:bg-emerald-800 transition border border-emerald-700/40 px-3 py-2.5 rounded-xl text-xs font-bold w-full sm:w-auto">
            <Calendar size={16} className="text-amber-300 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white outline-none w-full sm:w-auto font-mono text-center cursor-pointer font-bold"
            />
          </div>
          <button
            type="button"
            onClick={loadDailySummary}
            disabled={loading}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-slate-500 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Sales</p>
            <p className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
              ₹{formatINR(totals.grossSales)}
            </p>
          </div>
          <div className="flex justify-between items-center mt-2 text-[9px] font-bold text-slate-500">
            <span>DIG ₹{formatINR(totals.digitalSales)}</span>
            <span>PHY ₹{formatINR(totals.physicalSales)}</span>
          </div>
        </div>

        {/* Farmer Returns */}
        <div className="bg-rose-50 p-4 sm:p-5 rounded-2xl shadow-sm border border-rose-100 border-l-4 border-l-rose-600 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Farmer Returns</p>
            <p className="text-lg sm:text-xl font-black text-rose-800 font-mono mt-1">
              − ₹{formatINR(totals.totalReturns)}
            </p>
          </div>
          <span className="text-[9px] font-bold text-rose-700 bg-rose-100 self-start px-1.5 py-0.5 rounded-md mt-2">
            {totals.returnsCount} return(s)
          </span>
        </div>

        {/* Net Sales */}
        <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100 border-l-4 border-l-emerald-600 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Net Sales</p>
            <p className="text-lg sm:text-xl font-black text-emerald-950 font-mono mt-1">
              ₹{formatINR(totals.netSales)}
            </p>
          </div>
          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 self-start px-1.5 py-0.5 rounded-md mt-2">
            Gross − Returns
          </span>
        </div>

        {/* Cash Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-600 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cash Sales</p>
            <p className="text-lg sm:text-xl font-black text-blue-900 font-mono mt-1">
              ₹{formatINR(totals.grandTotalCash)}
            </p>
          </div>
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 self-start px-1.5 py-0.5 rounded-md mt-2">
            नकद बिल
          </span>
        </div>

        {/* Recovery */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-teal-600 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Recovery</p>
            <p className="text-lg sm:text-xl font-black text-teal-900 font-mono mt-1">
              ₹{formatINR(totals.totalRecovery)}
            </p>
          </div>
          <span className="text-[9px] font-bold text-teal-600 bg-teal-50 self-start px-1.5 py-0.5 rounded-md mt-2">
            पेमेंट रिकवरी
          </span>
        </div>
      </div>

      {/* Secondary strip: udhaar view */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <p className="font-bold text-slate-600">
          Credit (Udhaar) billed today:{' '}
          <span className="font-mono text-amber-700">₹{formatINR(totals.grandTotalUdhaar)}</span>
        </p>
        <p className="font-bold text-slate-600">
          After returns (approx net credit):{' '}
          <span className="font-mono text-emerald-800">₹{formatINR(totals.netUdhaarAfterReturns)}</span>
        </p>
      </div>

      {/* Four Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-5">
        {/* 1. Digital Sales Bills */}
        <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 bg-emerald-950 text-white font-bold text-xs sm:text-sm flex justify-between items-center border-b border-emerald-900">
            <span className="flex items-center gap-1.5">
              <Layers size={16} className="text-amber-400 shrink-0" />
              Digital Bills ({salesBills.length})
            </span>
            <span className="font-mono text-amber-300 text-sm">₹{formatINR(totals.digitalSales)}</span>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                <Loader2 size={20} className="animate-spin mx-auto text-emerald-800" />
                <p className="text-xs">लोड हो रहा है...</p>
              </div>
            ) : salesBills.length === 0 ? (
              <p className="p-8 text-center text-slate-400 font-medium text-xs">कोई डिजिटल बिल नहीं है।</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {salesBills.map((b) => (
                  <div key={b.id} className="p-3.5 hover:bg-slate-50/50 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-bold text-emerald-950">{b.bill_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          b.bill_type === 'cash'
                            ? 'bg-blue-50 text-blue-800 border border-blue-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}
                      >
                        {b.bill_type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-slate-700 pt-1">
                      <span className="font-bold truncate">{b.farmer_name}</span>
                      <span className="font-black font-mono text-slate-900">
                        ₹{formatINR(b.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Physical Paper Bills */}
        <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 bg-amber-950 text-white font-bold text-xs sm:text-sm flex justify-between items-center border-b border-amber-900">
            <span className="flex items-center gap-1.5">
              <Camera size={16} className="text-amber-400 shrink-0" />
              Physical Bills ({physicalBills.length})
            </span>
            <span className="font-mono text-amber-300 text-sm">₹{formatINR(totals.physicalSales)}</span>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                <Loader2 size={20} className="animate-spin mx-auto text-amber-800" />
                <p className="text-xs">लोड हो रहा है...</p>
              </div>
            ) : physicalBills.length === 0 ? (
              <p className="p-8 text-center text-slate-400 font-medium text-xs">
                कोई फिजिकल पर्ची बिल नहीं है।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {physicalBills.map((pb) => (
                  <div key={pb.id} className="p-3.5 hover:bg-slate-50/50 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-bold text-amber-950">#{pb.bill_number}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          pb.bill_type === 'cash'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border border-rose-100'
                        }`}
                      >
                        {pb.bill_type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-slate-700 pt-1">
                      <span className="font-bold truncate">{pb.farmer_name}</span>
                      <span className="font-black font-mono text-amber-900">
                        ₹{formatINR(pb.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Farmer Returns */}
        <div className="bg-white rounded-3xl border border-rose-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 bg-rose-900 text-white font-bold text-xs sm:text-sm flex justify-between items-center border-b border-rose-800">
            <span className="flex items-center gap-1.5">
              <RotateCcw size={16} className="text-amber-300 shrink-0" />
              Returns ({returnsList.length})
            </span>
            <span className="font-mono text-amber-200 text-sm">− ₹{formatINR(totals.totalReturns)}</span>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                <Loader2 size={20} className="animate-spin mx-auto text-rose-700" />
                <p className="text-xs">लोड हो रहा है...</p>
              </div>
            ) : returnsList.length === 0 ? (
              <p className="p-8 text-center text-slate-400 font-medium text-xs">आज कोई रिटर्न नहीं।</p>
            ) : (
              <div className="divide-y divide-rose-50 max-h-[480px] overflow-y-auto">
                {returnsList.map((r) => (
                  <div key={r.id} className="p-3.5 hover:bg-rose-50/40 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-bold text-rose-900">{r.return_number}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                        RETURN
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-slate-700 pt-1">
                      <span className="font-bold truncate">{r.farmer_name}</span>
                      <span className="font-black font-mono text-rose-700">
                        − ₹{formatINR(r.total_amount)}
                      </span>
                    </div>
                    {(r.original_bill_number || r.reason) && (
                      <p className="text-[10px] text-slate-500 truncate">
                        {r.original_bill_number ? `Bill: ${r.original_bill_number}` : ''}
                        {r.original_bill_number && r.reason ? ' · ' : ''}
                        {r.reason ? `Reason: ${r.reason}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Payments Received */}
        <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 bg-teal-950 text-white font-bold text-xs sm:text-sm flex justify-between items-center border-b border-teal-900">
            <span className="flex items-center gap-1.5">
              <Wallet size={16} className="text-amber-400 shrink-0" />
              Payments ({payments.length})
            </span>
            <span className="font-mono text-amber-300 text-sm">₹{formatINR(totals.totalRecovery)}</span>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold space-y-2">
                <Loader2 size={20} className="animate-spin mx-auto text-teal-850" />
                <p className="text-xs">लोड हो रहा है...</p>
              </div>
            ) : payments.length === 0 ? (
              <p className="p-8 text-center text-slate-400 font-medium text-xs">कोई रिकवरी नहीं हुई।</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="p-3.5 hover:bg-slate-50/50 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-bold text-teal-950">{p.payment_number}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-teal-50 text-teal-800 border border-teal-100">
                        {p.payment_mode}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-slate-700 pt-1">
                      <span className="font-bold truncate">{p.farmer_name}</span>
                      <span className="font-black font-mono text-teal-900">
                        ₹{formatINR(p.payment_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer formula note */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 flex items-start gap-2">
        <IndianRupee size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-800">Net Sales formula:</strong>{' '}
          Digital Sales (₹{formatINR(totals.digitalSales)}) + Physical Sales (₹{formatINR(totals.physicalSales)}) − Farmer Returns (₹{formatINR(totals.totalReturns)}) ={' '}
          <strong className="text-emerald-800 font-mono">₹{formatINR(totals.netSales)}</strong>
        </p>
      </div>
    </div>
  )
}