import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Info, RefreshCw, AlertCircle } from 'lucide-react'

interface AppSetting {
  setting_key: string
  setting_value: string
}

const DEFAULT_BUSINESS_NAME = 'SATGURU BEEJ BHANDAR'
const DEFAULT_BUSINESS_ADDRESS = 'Daloosar, Sardarshahar (Churu), Rajasthan'

export default function AboutBusiness() {
  const [name, setName] = useState<string>(DEFAULT_BUSINESS_NAME)
  const [address, setAddress] = useState<string>(DEFAULT_BUSINESS_ADDRESS)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBusinessSettings = async (isMounted: () => boolean) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['business_name', 'business_address'])

      if (fetchError) {
        throw fetchError
      }

      if (data && isMounted()) {
        const settings = data as AppSetting[]
        const fetchedName = settings.find((s) => s.setting_key === 'business_name')?.setting_value
        const fetchedAddress = settings.find((s) => s.setting_key === 'business_address')?.setting_value

        if (fetchedName) setName(fetchedName)
        if (fetchedAddress) setAddress(fetchedAddress)
      }
    } catch (err: any) {
      if (isMounted()) {
        console.error('Failed to load business settings:', err?.message || err)
        setError('Unable to load updated business details. Showing default details.')
      }
    } finally {
      if (isMounted()) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let mounted = true
    const isMounted = () => mounted

    fetchBusinessSettings(isMounted)

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Info className="text-amber-400" size={28} /> About Business
        </h1>
        {loading && (
          <RefreshCw className="animate-spin text-emerald-300" size={20} role="status" aria-label="Loading" />
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Business Details Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center space-y-3">
        <p className="text-4xl" role="img" aria-label="Wheat Seed Icon">🌾</p>
        
        {loading ? (
          <div className="space-y-2 py-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-100 rounded w-5/6 mx-auto"></div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black text-emerald-950">{name}</h2>
            <p className="text-sm text-gray-600 font-medium">{address}</p>
          </>
        )}

        <div className="pt-4 border-t border-gray-100 space-y-1">
          <p className="text-xs text-gray-400">Business Management System · PRO v1.0</p>
          <p className="text-xs font-bold text-emerald-800">
            Aapki Fasal, Hamari Saaf Niyat, Salah aur Suraksha
          </p>
          <p className="text-xs font-black text-slate-700 tracking-wider">JAI JAWAN JAI KISAN</p>
        </div>
      </div>
    </div>
  )
}