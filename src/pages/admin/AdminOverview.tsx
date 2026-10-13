// src/pages/admin/AdminOverview.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  IndianRupee,
  Package,
  TrendingUp,
  Users,
  AlertTriangle,
  Clock,
  Group,
  Layers,
  Loader2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface DashboardStats {
  totalOutstanding: number
  totalStockValue: number
  todaySales: number
  todayPayments: number
  lowStockCount: number
  expiringCount: number
  activeFarmers: number
  activeGroups: number
}

const INITIAL_STATS: DashboardStats = {
  totalOutstanding: 0,
  totalStockValue: 0,
  todaySales: 0,
  todayPayments: 0,
  lowStockCount: 0,
  expiringCount: 0,
  activeFarmers: 0,
  activeGroups: 0,
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function AdminOverview() {
  const { role, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef<boolean>(true)

  const loadFallbackStats = useCallback(async () => {
    if (isMounted.current) {
      setError('मुख्य सांख्यिकी लोड नहीं हो सकीं। कृपया रीफ़्रेश दबाकर पुनः प्रयास करें।')
      setStats(INITIAL_STATS)
    }
  }, [])

  const loadDashboardStats = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoading(true)
      setError(null)

      // Fetch normal stats RPC
      const { data, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats')

      // Fetch Today's Physical Bills
      const today = new Date().toISOString().split('T')[0]
      const { data: physicalData } = await supabase
        .from('physical_bills')
        .select('bill_amount')
        .eq('bill_date', today)
        .eq('status', 'active')

      let physicalSalesSum = 0
      if (physicalData && physicalData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        physicalSalesSum = physicalData.reduce((sum, b: any) => sum + safeNum(b.bill_amount), 0)
      }

      if (rpcError || !data) {
        console.warn('RPC Execution Warning:', rpcError?.message || 'No data')
        await loadFallbackStats()
        return
      }

      if (isMounted.current && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let raw: Record<string, any> = {}
        if (Array.isArray(data) && data.length > 0) {
          raw = data[0]
        } else if (typeof data === 'object' && data !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          raw = data as Record<string, any>
        }

        setStats({
          totalOutstanding: safeNum(raw.totalOutstanding ?? raw.total_outstanding),
          totalStockValue: safeNum(raw.totalStockValue ?? raw.total_stock_value),
          // Merge Digital + Physical Sales for today
          todaySales: safeNum(raw.todaySales ?? raw.today_sales) + physicalSalesSum,
          todayPayments: safeNum(raw.todayPayments ?? raw.today_payments),
          lowStockCount: safeNum(raw.lowStockCount ?? raw.low_stock_count),
          expiringCount: safeNum(raw.expiringCount ?? raw.expiring_count),
          activeFarmers: safeNum(raw.activeFarmers ?? raw.active_farmers),
          activeGroups: safeNum(raw.activeGroups ?? raw.active_groups),
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dashboard stats load failed'
      console.error(err)
      if (isMounted.current) {
        setError(msg)
        toast.error('डैशबोर्ड डेटा लोड करने में त्रुटि: ' + msg)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [loadFallbackStats, role])

  useEffect(() => {
    isMounted.current = true
    if (!authLoading && role === 'admin') {
      loadDashboardStats()
    }

    return () => {
      isMounted.current = false
    }
  }, [loadDashboardStats, role, authLoading])

  const cards = [
    {
      title: 'Total Outstanding (कुल उधारी)',
      value: formatINR(stats.totalOutstanding),
      icon: IndianRupee,
      color: 'border-l-4 border-red-500 bg-white text-red-700',
    },
    {
      title: 'Total Stock Value (कुल स्टॉक मूल्य)',
      value: formatINR(stats.totalStockValue),
      icon: Package,
      color: 'border-l-4 border-emerald-500 bg-white text-emerald-700',
    },
    {
      title: "Today's Sales (आज की बिक्री)",
      value: formatINR(stats.todaySales),
      icon: TrendingUp,
      color: 'border-l-4 border-blue-500 bg-white text-blue-700',
    },
    {
      title: "Today's Payments (आज की रिकवरी)",
      value: formatINR(stats.todayPayments),
      icon: Layers,
      color: 'border-l-4 border-teal-500 bg-white text-teal-700',
    },
    {
      title: 'Low Stock Alert (कम स्टॉक)',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: 'border-l-4 border-amber-500 bg-white text-amber-700',
    },
    {
      title: 'Expiring in 60 Days (एक्सपायरी अलर्ट)',
      value: stats.expiringCount.toString(),
      icon: Clock,
      color: 'border-l-4 border-rose-500 bg-white text-rose-700',
    },
    {
      title: 'Active Farmers (सक्रिय किसान)',
      value: stats.activeFarmers.toString(),
      icon: Users,
      color: 'border-l-4 border-indigo-500 bg-white text-indigo-700',
    },
    {
      title: 'Active Groups (सक्रिय समूह)',
      value: stats.activeGroups.toString(),
      icon: Group,
      color: 'border-l-4 border-purple-500 bg-white text-purple-700',
    },
  ]

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 font-sans">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas dashboard overview dekhne ki anumati nahi hai.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto font-sans">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            SATGURU BEEJ BHANDAR — Admin Portal
          </h1>
          <p className="text-emerald-300 text-sm mt-1">
            Daloosar, Sardarshahar (Churu), Rajasthan · Overview & Dashboard
          </p>
        </div>
        <button
          onClick={loadDashboardStats}
          disabled={loading}
          aria-label="Refresh dashboard metrics"
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          ताज़ा करें (Refresh)
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboardStats}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`p-5 rounded-2xl shadow-sm border transition-all hover:shadow-md flex justify-between items-center ${card.color}`}
            >
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-xl font-black mt-1">
                  {loading ? (
                    <span className="inline-block animate-pulse text-gray-300">...</span>
                  ) : (
                    card.value
                  )}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl text-gray-700 flex-shrink-0">
                <Icon size={22} />
              </div>
            </div>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-emerald-800 text-xs gap-2 font-bold">
          <Loader2 size={16} className="animate-spin" />
          <span>ताज़ा आंकड़े लोड हो रहे हैं...</span>
        </div>
      )}
    </div>
  )
}