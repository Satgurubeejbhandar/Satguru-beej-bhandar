import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, UserCheck, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function UdhaarPublic() {
  const navigate = useNavigate()
  const entryRole = localStorage.getItem('website_entry_role') || 'guest'
  
  // States for Farmer PIN Login
  const [farmerId, setFarmerId] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  
  // States for Guest Scheme View
  const [slabs, setSlabs] = useState<any[]>([])
  const [fetchingSchemes, setFetchingSchemes] = useState(true)

  useEffect(() => {
    if (entryRole === 'guest') {
      async function loadSchemes() {
        setFetchingSchemes(true)
        const { data: schemes } = await supabase.from('credit_schemes').select('id').eq('scheme_type', 'individual').eq('is_active', true).maybeSingle()
        if (schemes) {
          const { data } = await supabase.from('scheme_slabs').select('*').eq('scheme_id', schemes.id).order('slab_order')
          setSlabs(data || [])
        }
        setFetchingSchemes(false)
      }
      loadSchemes()
    }
  }, [entryRole])

  const handleFarmerPinLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Check Farmer ID existence (Database is single source of truth)
      const { data: farmer, error } = await supabase
        .from('farmers')
        .select('id, farmer_id, farmer_name, account_status')
        .eq('farmer_id', farmerId.trim().toUpperCase())
        .maybeSingle()

      if (error || !farmer) {
        toast.error('Farmer ID System में नहीं मिली!')
        setLoading(false)
        return
      }

      if (farmer.account_status !== 'active') {
        toast.error('आपका खाता निष्क्रिय है। कृपया Admin से संपर्क करें।')
        setLoading(false)
        return
      }

      // 2. Verify Secure PIN via Backend RPC
      const { data: result, error: pinErr } = await supabase.rpc('verify_pin', {
        p_farmer_id: farmer.id,
        p_pin: pin,
      })

      if (pinErr) throw pinErr

      if (result?.success) {
        // 3. Secure session set for Private Portal
        sessionStorage.setItem('farmer_session', JSON.stringify({
          id: farmer.id,
          farmer_id: farmer.farmer_id,
          farmer_name: farmer.farmer_name,
        }))
        toast.success(`स्वागत है, ${farmer.farmer_name}!`)
        navigate('/farmer', { replace: true })
      } else {
        toast.error(result?.message || 'गलत PIN!')
      }
    } catch (err: any) {
      toast.error('सर्वर त्रुटि: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="bg-emerald-950 text-white rounded-3xl p-8 relative shadow-xl text-center">
        <div className="text-5xl mb-2">🌾</div>
        <h1 className="text-3xl font-black">KISAN UDHAAR CARD</h1>
        <p className="text-emerald-200 text-sm mt-2">SATGURU BEEJ BHANDAR — Daloosar, Sardarshahar</p>
      </div>

      {entryRole === 'farmer' ? (
        // ================= FARMER ID + PIN LOGIN =================
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserCheck size={32} />
            </div>
            <h2 className="text-xl font-black text-emerald-950">किसान उधार लॉगिन</h2>
            <p className="text-xs text-gray-500 mt-1 font-bold">अपना प्राइवेट खाता, बकाया और बिल देखें</p>
          </div>

          <form onSubmit={handleFarmerPinLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Farmer ID (किसान आईडी) *
              </label>
              <input
                type="text"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border-2 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 outline-none uppercase font-black text-gray-800 tracking-widest text-center text-lg"
                placeholder="SBB-001-01"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Transaction PIN (6-Digit) *
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-4 py-3 border-2 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 outline-none text-center font-black tracking-widest text-2xl"
                placeholder="••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-lg transition disabled:opacity-50 text-base"
            >
              {loading ? 'वेरिफाई किया जा रहा है...' : 'खाता खोलें (Open Portal)'}
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-2 font-bold uppercase flex items-center justify-center gap-1">
              <Shield size={12}/> Protected by Server RLS Security
            </p>
          </form>
        </div>
      ) : (
        // ================= GUEST READ-ONLY SCHEME VIEW =================
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border shadow-sm p-6 sm:p-8">
            <h2 className="font-black text-emerald-900 text-xl mb-4 text-center">📋 वर्तमान उधार योजना (Current Schemes)</h2>
            {fetchingSchemes ? (
              <p className="text-gray-500 text-center font-bold">डेटाबेस से दरें ली जा रही हैं...</p>
            ) : slabs.length === 0 ? (
              <p className="text-amber-700 text-center font-bold">कोई योजना उपलब्ध नहीं है।</p>
            ) : (
              <div className="space-y-2 text-sm max-w-lg mx-auto">
                {slabs.map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="font-bold text-gray-700">₹{fmt(Number(s.min_amount))} – ₹{fmt(Number(s.max_amount))}</span>
                    <span className="text-emerald-800 font-black text-base">{Number(s.interest_rate)}% / {s.repayment_days} दिन</span>
                  </div>
                ))}
                <div className="p-4 mt-4 rounded-xl bg-amber-50 border border-amber-200 font-black text-amber-900 text-center">
                  समूह (Group of 4 Farmers) → 10% फिक्स कैशबैक
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center max-w-lg mx-auto">
            <Lock className="text-slate-400 mx-auto mb-3" size={40} />
            <h3 className="text-lg font-black text-slate-800">Private Udhaar Portal Locked</h3>
            <p className="text-slate-600 text-sm mt-2 font-medium">
              Guest (अतिथि) केवल योजना की जानकारी देख सकते हैं। अपना व्यक्तिगत खाता और लेजर देखने के लिए वेबसाइट में <strong>FARMER</strong> के रूप में प्रवेश करें।
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl"
            >
              Change Role to Farmer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}