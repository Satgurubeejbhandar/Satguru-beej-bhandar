import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import toast from 'react-hot-toast'
import { ShieldCheck, UserCheck, User, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function EntryPage() {
  const [view, setView] = useState<'select' | 'admin'>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    
    if (error) {
      toast.error('Admin Login Failed: ' + error.message)
      setLoading(false)
    } else {
      toast.success('Admin Logged In! Opening Website...')
      localStorage.setItem('website_entry_role', 'admin')
      // Redirects directly to the main website homepage
      navigate('/home', { replace: true })
    }
  }

  const enterAsRole = (role: 'farmer' | 'guest') => {
    localStorage.setItem('website_entry_role', role)
    toast.success(`Entered as ${role.toUpperCase()}`)
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-emerald-800/30 relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white p-8 text-center">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-black tracking-wide">SATGURU BEEJ BHANDAR</h1>
          <p className="text-emerald-200 text-sm mt-1 font-medium">Business Management System</p>
        </div>

        <AnimatePresence mode="wait">
          {view === 'select' ? (
            <motion.div 
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-8 space-y-4"
            >
              <h2 className="text-center font-bold text-gray-500 mb-6 text-sm uppercase tracking-widest">
                Select Your Role To Enter
              </h2>

              <button
                onClick={() => setView('admin')}
                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-3 text-lg"
              >
                <ShieldCheck size={24} /> ADMIN LOGIN
              </button>

              <button
                onClick={() => enterAsRole('farmer')}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-3 text-lg"
              >
                <UserCheck size={24} /> FARMER
              </button>

              <button
                onClick={() => enterAsRole('guest')}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl border-2 border-slate-200 transition flex items-center justify-center gap-3 text-lg"
              >
                <User size={24} /> GUEST
              </button>

              <p className="text-center text-[10px] text-gray-400 mt-6 font-bold uppercase">
                Single Source of Truth · Live Database
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <button 
                onClick={() => setView('select')}
                className="text-emerald-700 font-bold text-sm flex items-center gap-1 mb-6 hover:text-emerald-900"
              >
                <ArrowLeft size={16} /> Back to Entry Select
              </button>

              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none font-bold text-gray-800"
                    placeholder="admin@satguru.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Secure Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none font-bold text-gray-800"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-lg transition disabled:opacity-50 mt-2 text-base uppercase tracking-wider"
                >
                  {loading ? 'Authenticating...' : 'Login & Open Website'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}