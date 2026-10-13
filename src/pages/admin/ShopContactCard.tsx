import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Phone,
  MessageCircle,
  MapPin,
  Building2,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ShopDetails {
  name: string
  phone: string
  whatsapp: string
  address: string
  gstin: string
  licence: string
}

const DEFAULT_SHOP: ShopDetails = {
  name: 'SATGURU BEEJ BHANDAR',
  phone: '+91 7988950257',
  whatsapp: '917988950257',
  address: 'Daloosar, Sardarshahar (Churu), Rajasthan - 331403',
  gstin: '08KFBK9508K1Z0',
  licence: 'FIRM LICENCE 1072',
}

export default function ShopContactCard() {
  const [shop, setShop] = useState<ShopDetails>(DEFAULT_SHOP)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Fetch Live Shop Settings from Supabase
  useEffect(() => {
    async function loadShopSettings() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'business_name',
            'shop_name',
            'shop_phone',
            'shop_whatsapp',
            'business_address',
            'shop_address',
            'shop_gstin',
            'shop_licence',
          ])

        if (error) throw error

        if (data && data.length > 0 && isMountedRef.current) {
          const map: Record<string, string> = {}
          data.forEach((row) => {
            if (row.setting_key && row.setting_value) {
              map[row.setting_key] = row.setting_value
            }
          })

          setShop({
            name: map['business_name'] || map['shop_name'] || DEFAULT_SHOP.name,
            phone: map['shop_phone'] || DEFAULT_SHOP.phone,
            whatsapp: map['shop_whatsapp'] || DEFAULT_SHOP.whatsapp,
            address: map['business_address'] || map['shop_address'] || DEFAULT_SHOP.address,
            gstin: map['shop_gstin'] || DEFAULT_SHOP.gstin,
            licence: map['shop_licence'] || DEFAULT_SHOP.licence,
          })
        }
      } catch (err: unknown) {
        console.error('Failed to load shop contact settings', err)
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    loadShopSettings()
  }, [])

  // Copy details to clipboard securely
  const handleCopy = async () => {
    const text = `${shop.name}\n📍 ${shop.address}\n📞 Phone: ${shop.phone}\n💬 WhatsApp: https://wa.me/${shop.whatsapp}`
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text)
        if (isMountedRef.current) {
          setCopied(true)
          toast.success('Contact info copied to clipboard!')
          setTimeout(() => {
            if (isMountedRef.current) setCopied(false)
          }, 2000)
        }
      } else {
        throw new Error('Clipboard API unavailable')
      }
    } catch {
      toast.error('Could not copy automatically')
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="text-amber-400" size={26} /> Shop Contact Card
          </h1>
          <p className="text-emerald-200 text-xs mt-1">Official Krishi Kendra Info &amp; Helpline</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="p-2.5 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 rounded-xl transition border border-emerald-700 cursor-pointer shadow-xs active:scale-95"
          title="Copy Info"
          aria-label="Copy contact details"
        >
          {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
        </button>
      </div>

      {/* Main Digital Visiting Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-6 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-emerald-700" size={28} />
          </div>
        )}

        {/* Brand Logo & Name */}
        <div className="text-center space-y-1.5 pb-4 border-b border-slate-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner" role="img" aria-label="Wheat logo">
            🌾
          </div>
          <h2 className="text-2xl font-black text-emerald-950 tracking-tight mt-2">
            {shop.name}
          </h2>
          <p className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
            उच्च गुणवत्ता बीज, खाद एवं कीटनाशक विक्रेता
          </p>
        </div>

        {/* Info Rows */}
        <div className="space-y-3 text-xs font-semibold text-slate-700">
          {/* Address */}
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <MapPin className="text-emerald-700 shrink-0 mt-0.5" size={18} />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Shop Location
              </span>
              <span className="text-slate-900 font-bold">{shop.address}</span>
            </div>
          </div>

          {/* Licenses & GSTIN */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2">
              <Building2 className="text-slate-500 shrink-0" size={16} />
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  GSTIN No.
                </span>
                <span className="text-slate-800 font-mono text-[11px]">{shop.gstin}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2">
              <ShieldCheck className="text-emerald-600 shrink-0" size={16} />
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  Seed License
                </span>
                <span className="text-slate-800 font-mono text-[11px]">{shop.licence}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Call & WhatsApp */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Direct Phone Call */}
          <a
            href={`tel:${shop.phone.replace(/\s+/g, '')}`}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            <Phone size={16} />
            <span>Call Shop</span>
          </a>

          {/* WhatsApp Direct Chat */}
          <a
            href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}?text=Namaste%20Satguru%20Beej%20Bhandar`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            <MessageCircle size={16} />
            <span>WhatsApp</span>
          </a>
        </div>

        {/* Footer Slogan */}
        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs font-black text-emerald-800 tracking-wider">
            🇮🇳 जय जवान, जय किसान · समृद्ध किसान, हमारी शान 🌾
          </p>
        </div>
      </div>
    </div>
  )
}