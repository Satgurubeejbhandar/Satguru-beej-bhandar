import { TableProperties, ShieldCheck, Lock, Eye, AlertTriangle } from 'lucide-react'

interface AccessRow {
  area: string
  guest: string
  farmer: string
  admin: string
  category?: string
}

const ACCESS_ROWS: AccessRow[] = [
  { area: 'Public website (Home/Mandi/…)', guest: 'YES', farmer: 'YES', admin: 'YES' },
  { area: 'Udhaar scheme rates (public)', guest: 'YES', farmer: 'YES', admin: 'YES' },
  { area: 'Private Udhaar portal', guest: 'NO', farmer: 'OWN ONLY', admin: 'ALL' },
  { area: 'Inventory / SARA SAMAN', guest: 'NO', farmer: 'NO', admin: 'YES' },
  { area: 'Company bills / purchase', guest: 'NO', farmer: 'NO', admin: 'YES' },
  { area: 'WhatsApp full history share', guest: 'NO', farmer: 'NO', admin: 'YES*' },
  { area: 'Aadhaar full number', guest: 'NO', farmer: 'MASKED', admin: 'CAREFUL' },
  { area: 'Edit bills/payments', guest: 'NO', farmer: 'NO', admin: 'VOID/RETURN only' },
]

export default function AccessMatrix() {
  const renderBadge = (value: string) => {
    const uppercaseVal = value.toUpperCase()
    
    if (uppercaseVal === 'YES' || uppercaseVal === 'ALL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <ShieldCheck size={12} className="text-emerald-600" />
          {value}
        </span>
      )
    }

    if (uppercaseVal === 'NO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <Lock size={12} className="text-rose-500" />
          {value}
        </span>
      )
    }

    if (uppercaseVal.includes('OWN ONLY') || uppercaseVal.includes('MASKED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Eye size={12} className="text-blue-600" />
          {value}
        </span>
      )
    }

    // Conditional / Warning cases (CAREFUL, VOID/RETURN only, YES*)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
        <AlertTriangle size={12} className="text-amber-600" />
        {value}
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TableProperties className="text-amber-400" size={28} /> Access Control Matrix
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Role-Based Access Control (RBAC) Architecture · Guest · Farmer · Admin Reference
        </p>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[600px]" aria-label="System Access Control Matrix">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-4 rounded-tl-3xl">System Area / Feature</th>
                <th scope="col" className="p-4 text-center">Guest Access</th>
                <th scope="col" className="p-4 text-center">Farmer Access</th>
                <th scope="col" className="p-4 text-center rounded-tr-3xl">Admin Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
              {ACCESS_ROWS.map((row) => (
                <tr key={row.area} className="hover:bg-slate-50 transition-colors">
                  <th scope="row" className="p-4 font-bold text-gray-900 text-left">
                    {row.area}
                  </th>
                  <td className="p-4 text-center align-middle">
                    {renderBadge(row.guest)}
                  </td>
                  <td className="p-4 text-center align-middle">
                    {renderBadge(row.farmer)}
                  </td>
                  <td className="p-4 text-center align-middle">
                    {renderBadge(row.admin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnote Notice */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs text-gray-600 font-medium space-y-1">
        <p>
          <strong className="text-gray-900">* Admin WhatsApp Policy:</strong> Includes billing and payment receipt summary shares only. Does not export raw Aadhaar identifiers or full internal farmer portal account logs.
        </p>
        <p className="text-[11px] text-gray-400">
          Enforced via Supabase Row-Level Security (RLS) policies and Auth Role Middleware.
        </p>
      </div>
    </div>
  )
}