// src/pages/ContentLoginPage.tsx
// सिर्फ Website Content Admin — उधार / ERP login से अलग
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShieldCheck, Lock, Mail, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContentLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Email और Password डालें')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      if (!data.user) throw new Error('Login fail')

      // ✅ सिर्फ content_admins टेबल वाले को अनुमति (उधार admin यहाँ reject)
      const { data: row, error: roleErr } = await supabase
        .from('content_admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (roleErr) throw roleErr

      if (!row) {
        await supabase.auth.signOut()
        toast.error('यह अकाउंट Website Admin नहीं है। उधार/ERP वाला ID यहाँ नहीं चलेगा।')
        return
      }

      // अलग फ्लैग — उधार session से mix न हो conceptually
      sessionStorage.setItem('content_admin', '1')
      toast.success('Website Admin Login सफल!')
      navigate('/') // public site — Disease आदि पर Edit
    } catch (err: any) {
      toast.error(err?.message || 'गलत Email/Password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pine-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-cream/70 hover:text-gold-400 text-sm font-bold"
        >
          <ArrowLeft size={16} /> वापस होम
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-700 to-amber-900 p-6 text-center">
            <div className="mx-auto w-14 h-14 bg-gold-400 rounded-full flex items-center justify-center mb-3">
              <ShieldCheck className="text-pine-950" size={28} />
            </div>
            <h1 className="text-2xl font-black text-white">Website Admin</h1>
            <p className="text-amber-100 text-sm mt-1">
              सिर्फ साइट कंटेंट Edit (रोग, उत्पाद…)
            </p>
            <p className="text-[11px] text-amber-200/80 mt-2">
              उधार कार्ड / ERP लॉगिन इससे अलग है
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="content@satguru.com"
                  className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-amber-600"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-amber-600"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> लॉगिन…</>
              ) : (
                <><ShieldCheck size={18} /> Content Admin Login</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}