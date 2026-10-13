import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ShieldCheck, UserCheck, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'admin' | 'farmer'>('farmer')

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  // Farmer Login State
  const [farmerId, setFarmerId] = useState('')
  const [farmerPin, setFarmerPin] = useState('')
  const [farmerLoading, setFarmerLoading] = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminLoading(true)

    const { error } = await signIn(adminEmail, adminPassword)

    if (error) {
      toast.error('Admin Login Failed: ' + error.message)
    } else {
      toast.success('Admin Login Successful!')
      navigate('/admin')
    }

    setAdminLoading(false)
  }

  // Handle Farmer Login (PIN & Clean ID Verification)
  const handleFarmerLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFarmerLoading(true)

    // Clean brackets and spaces from input
    const cleanId = farmerId.replace(/[()\[\]\s]/g, '').trim().toUpperCase()

    if (!cleanId) {
      toast.error('कृपया सही Farmer ID दर्ज करें!')
      setFarmerLoading(false)
      return
    }

    try {
      // Direct Database RPC call
      const { data: res, error: rpcErr } = await supabase.rpc('verify_farmer_login', {
        p_farmer_id: cleanId,
        p_pin: farmerPin.trim()
      })

      if (rpcErr) throw rpcErr

      const payload = Array.isArray(res) ? res[0] : res
      if (payload?.success) {
        const farmerObj = payload.farmer ?? payload
        const farmerUuid = typeof farmerObj?.id === 'string' ? farmerObj.id.trim() : ''
        const uuidOk =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmerUuid)

        if (!uuidOk) {
          toast.error('लॉगिन सफल हुआ लेकिन किसान UUID नहीं मिला। Admin से संपर्क करें।')
          return
        }

        sessionStorage.setItem('farmer_session', JSON.stringify({ id: farmerUuid }))
        toast.success(`स्वागत है, ${farmerObj.farmer_name || 'किसान'}!`)
        navigate('/farmer', { replace: true })
      } else {
        toast.error(payload?.message || 'लॉगिन विफल! सही ID व PIN दर्ज करें।')
      }
    } catch (err: any) {
      toast.error('लॉगिन त्रुटि: ' + err.message)
    } finally {
      setFarmerLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-emerald-800/30">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white p-6 text-center relative">
          
          {/* UPDATED BACK BUTTON WITH CLEAR TEXT */}
          <button 
            onClick={() => navigate('/')} 
            className="absolute left-3 top-4 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-emerald-500/40 shadow-sm"
            title="वेबसाइट पर वापस जाएं"
          >
            <ArrowLeft size={16} />
            <span>वेबसाइट देखें</span>
          </button>

          <span className="text-4xl block mt-2">🌾</span>
          <h1 className="text-xl font-bold mt-1">सतगुरु बीज भंडार</h1>
          <p className="text-emerald-200 text-xs mt-0.5">Daloosar, Sardarshahar (Churu), Rajasthan</p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('farmer')}
            className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'farmer'
                ? 'border-amber-500 text-amber-900 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <UserCheck size={18} />
            <span>किसान उधार लॉगिन</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'admin'
                ? 'border-emerald-600 text-emerald-900 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck size={18} />
            <span>Admin Login</span>
          </button>
        </div>

        <div className="p-6">
          {/* FARMER LOGIN FORM */}
          {activeTab === 'farmer' && (
            <form onSubmit={handleFarmerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Farmer ID (किसान आईडी) *
                </label>
                <input
                  type="text"
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-amber-500 outline-none font-black text-gray-800 tracking-wider text-center text-lg uppercase"
                  placeholder="SBB-001-01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Transaction PIN (6-Digit PIN) *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={farmerPin}
                  onChange={(e) => setFarmerPin(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-amber-500 outline-none text-center font-black tracking-widest text-lg"
                  placeholder="••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={farmerLoading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-lg transition disabled:opacity-50 text-base"
              >
                {farmerLoading ? 'जांच की जा रही है...' : 'किसान पोर्टल खोलें (Login)'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-2">
                🔒 Protected by 3-Attempt Security Lockout
              </p>
            </form>
          )}

          {/* ADMIN LOGIN FORM */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Admin Email *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="admin@satguru.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {adminLoading ? 'Logging in...' : 'Admin Portal Open (Login)'}
              </button>
            </form>
          )}

          {/* Bottom Guest Option Link */}
          <div className="mt-5 text-center pt-2 border-t">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-emerald-800 font-bold hover:underline"
            >
              ← Guest की तरह वेबसाइट देखें (बिना लॉगिन)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}