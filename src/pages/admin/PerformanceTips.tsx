// src/pages/admin/PerformanceTips.tsx
import { useAuth } from '../../lib/auth'
import {
  Gauge,
  CheckCircle,
  Database,
  Filter,
  Search,
  Layers,
  ShieldAlert,
  Loader2,
} from 'lucide-react'

export default function PerformanceTips() {
  const { role, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="max-w-xl mx-auto p-12 bg-white rounded-3xl border text-center flex items-center justify-center gap-2 text-gray-500">
        <Loader2 size={18} className="animate-spin text-emerald-800" />
        Authenticating session...
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas performance guidelines dekhne ki anumati nahi hai.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="text-amber-400" size={28} /> Performance Tips
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Database & Client Optimization Guidelines
          </p>
        </div>
        <span className="bg-emerald-800/80 text-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-700 font-mono">
          System Active
        </span>
      </div>

      {/* Recommendations Card */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <CheckCircle className="text-emerald-600" size={18} />
          <h2 className="text-sm font-bold text-gray-900">
            Active System Optimization Rules
          </h2>
        </div>

        <ul
          className="space-y-3.5 text-xs font-medium text-gray-800"
          aria-label="Performance tips list"
        >
          <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Database className="text-emerald-700 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-bold text-gray-900">Database Indexing</p>
              <p className="text-gray-600 mt-0.5">
                • Indexes already on farmer_id, mobile, sku, expiry, bill dates
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="text-emerald-700 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-bold text-gray-900">Browser Data Fetching</p>
              <p className="text-gray-600 mt-0.5">
                • Lists use limit + filters — don’t load full DB in browser
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Search className="text-emerald-700 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-bold text-gray-900">Query Pattern</p>
              <p className="text-gray-600 mt-0.5">
                • Search server-side with ilike / eq
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Layers className="text-emerald-700 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-bold text-gray-900">Scaling Strategy</p>
              <p className="text-gray-600 mt-0.5">
                • Paginate later if lakhs of rows
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}