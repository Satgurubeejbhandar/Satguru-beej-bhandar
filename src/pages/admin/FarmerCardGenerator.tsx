// src/pages/admin/FarmerCardGenerator.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Search,
  Download,
  Image as ImageIcon,
  RefreshCcw,
  MapPin,
  Phone,
  Leaf,
  Loader2,
  CreditCard,
  Users,
  Shield,
  Calendar,
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'

type Farmer = {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  mobile: string | null
  village: string | null
  photo_url: string | null
  aadhaar_number: string | null
  credit_limit: number | string | null
  repayment_days: number | string | null
}

const CARD_W = 400
const CARD_H = 252

function formatINR(value: number | string | null | undefined): string {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })
}

function maskAadhaar(aadhaar: string | null | undefined): string {
  const d = String(aadhaar || '').replace(/\D/g, '')
  if (d.length < 4) return 'XXXX-XXXX-XXXX'
  return `XXXX-XXXX-${d.slice(-4)}`
}

function safeText(v: string | null | undefined, fallback = 'N/A') {
  const t = (v || '').trim()
  return t || fallback
}

/* ───────────── FRONT CARD ───────────── */
function FrontCard({ farmer }: { farmer: Farmer }) {
  const qrData = `Farmer: ${safeText(farmer.farmer_name)}\nID: ${safeText(farmer.farmer_id)}\nLimit: ₹${formatINR(farmer.credit_limit)}`

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        minWidth: CARD_W,
        minHeight: CARD_H,
        maxWidth: CARD_W,
        maxHeight: CARD_H,
        boxSizing: 'border-box',
        borderRadius: 16,
        padding: '10px 12px 8px 12px',
        background: 'linear-gradient(145deg, #023c2e 0%, #065f46 55%, #047857 100%)',
        color: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #064e3b',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* 🌿 FRONT WATERMARK (Leaf) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.05,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <Leaf size={210} color="#ffffff" />
      </div>

      {/* 📜 STRAIGHT HORIZONTAL 20-ROW TEXT WATERMARK */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '6px 0',
          opacity: 0.1,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: 20 }).map((_, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              whiteSpace: 'nowrap',
              fontSize: 6,
              fontWeight: 400, // Not bold
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            <span>SATGURU BEEJ BHANDAR</span>
            <span>SATGURU BEEJ BHANDAR</span>
            <span>SATGURU BEEJ BHANDAR</span>
            <span>SATGURU BEEJ BHANDAR</span>
          </div>
        ))}
      </div>

      {/* 1. TOP HEADER */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
            <div
              style={{
                display: 'inline-block',
                background: '#b45309',
                color: '#fff7ed',
                fontSize: 7,
                fontWeight: 900,
                letterSpacing: 0.7,
                padding: '2px 7px',
                borderRadius: 999,
                lineHeight: 1,
              }}
            >
              OFFICIAL KISAN CARD
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 3, lineHeight: 1.1, color: '#ffffff' }}>
              सतगुरु बीज भंडार
            </div>
            <div style={{ fontSize: 8, color: '#a7f3d0', marginTop: 1.5, lineHeight: 1.1 }}>
              दल्लुसर, सरदारशहर (चूरू), राजस्थान
            </div>
          </div>

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 7,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            <QRCodeSVG value={qrData} size={34} level="M" includeMargin={false} />
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(167,243,208,0.3)', marginTop: 5 }} />
      </div>

      {/* 2. MIDDLE SECTION (Photo + Farmer Info) */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
        <div
          style={{
            width: 62,
            height: 76,
            borderRadius: 7,
            overflow: 'hidden',
            border: '2px solid #facc15',
            background: '#0ea5e9',
            flexShrink: 0,
          }}
        >
          {farmer.photo_url ? (
            <img
              src={farmer.photo_url}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 900,
                color: '#ffffff',
              }}
            >
              {(farmer.farmer_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>
            <span style={{ fontSize: 6.5, color: '#34d399', fontWeight: 800, lineHeight: 1 }}>FARMER ID: </span>
            <span style={{ fontSize: 12, color: '#facc15', fontWeight: 900, lineHeight: 1 }}>{safeText(farmer.farmer_id)}</span>
          </div>

          <div style={{ fontSize: 6.5, color: '#34d399', fontWeight: 800, lineHeight: 1, marginTop: 1 }}>FARMER NAME</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#ffffff',
              wordBreak: 'break-word',
            }}
          >
            {safeText(farmer.farmer_name)}
          </div>
          <div
            style={{
              fontSize: 8.5,
              color: '#d1fae5',
              lineHeight: 1.1,
              wordBreak: 'break-word',
            }}
          >
            S/O {safeText(farmer.father_name)}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginTop: 3,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 6, color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, lineHeight: 1 }}>
                <Phone size={7} /> MOBILE
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 1, lineHeight: 1 }}>{safeText(farmer.mobile)}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 6, color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, lineHeight: 1 }}>
                <MapPin size={7} /> VILLAGE
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  marginTop: 1,
                  lineHeight: 1,
                  wordBreak: 'break-word',
                }}
              >
                {safeText(farmer.village)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM BOXES (Credit Limit & Aadhaar) */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 7,
        }}
      >
        <div
          style={{
            background: 'rgba(2,44,34,0.75)',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 6,
            padding: '3px 7px',
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 6.5, color: '#6ee7b7', lineHeight: 1 }}>Credit Limit (क्रेडिट सीमा)</div>
          <div
            style={{
              fontSize: 11.5,
              color: '#facc15',
              fontWeight: 900,
              marginTop: 2,
              lineHeight: 1.1,
            }}
          >
            ₹{formatINR(farmer.credit_limit)}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(2,44,34,0.75)',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 6,
            padding: '3px 7px',
            textAlign: 'right',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 6.5,
              color: '#6ee7b7',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 3,
              lineHeight: 1,
            }}
          >
            <Shield size={8} /> Aadhaar (मास्क्ड)
          </div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 900,
              marginTop: 2,
              letterSpacing: 0.3,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            {maskAadhaar(farmer.aadhaar_number)}
          </div>
        </div>
      </div>

      {/* 4. FOOTER */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 7,
          color: '#a7f3d0',
          lineHeight: 1,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Calendar size={8} /> Repayment: {Number(farmer.repayment_days) || 90} Days
        </span>
        <span>Aapki Fasal, Hamari Saaf Niyat</span>
      </div>
    </div>
  )
}

/* ───────────── BACK CARD ───────────── */
function BackCard() {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        minWidth: CARD_W,
        minHeight: CARD_H,
        maxWidth: CARD_W,
        maxHeight: CARD_H,
        boxSizing: 'border-box',
        borderRadius: 16,
        padding: '12px 14px',
        background: '#ffffff',
        border: '1px solid #d1d5db',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 🌿 BACK WATERMARK */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.05,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <Leaf size={210} color="#064e3b" />
      </div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div
          style={{
            width: 24,
            height: 24,
            margin: '0 auto 2px',
            borderRadius: 6,
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669',
          }}
        >
          <Leaf size={14} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#022c22', letterSpacing: 0.4, lineHeight: 1.1 }}>
          SATGURU BEEJ BHANDAR
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 3,
            border: '1px solid #fcd34d',
            background: '#fffbeb',
            color: '#b45309',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 8,
            fontWeight: 800,
            lineHeight: 1,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          उच्च गुणवत्ता बीज, खाद एवं कीटनाशक विक्रेता
        </div>
      </div>

      {/* Contacts Box */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'rgba(248, 250, 252, 0.85)',
        }}
      >
        {[
          ['Rajpal Verma', '7988950257'],
          ['Satpal Verma', '9166514441'],
          ['Ramesh Kumar', '7414085050'],
        ].map(([name, phone], idx) => (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 10px',
              borderBottom: idx < 2 ? '1px solid #e5e7eb' : 'none',
              fontSize: 9.5,
              lineHeight: 1.2,
            }}
          >
            <span style={{ color: '#334155', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={10} color="#64748b" /> {name}
            </span>
            <span style={{ color: '#064e3b', fontWeight: 900, fontFamily: 'monospace', letterSpacing: 0.4 }}>
              {phone}
            </span>
          </div>
        ))}
      </div>

      {/* Address & License */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 8.5, color: '#475569', lineHeight: 1.3, flex: 1 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            <MapPin size={10} color="#059669" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>Shop Address</div>
              <div>Daloosar, Sardarshahar</div>
              <div>(Churu), Rajasthan</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 8.5, color: '#334155', textAlign: 'right', lineHeight: 1.3, flex: 1 }}>
          <div><b>GSTIN:</b> 08KFBK9580K1Z0</div>
          <div><b>Seed Lic:</b> 31692</div>
          <div><b>Firm:</b> 1072</div>
          <div><b>Fert Lic:</b> 2784</div>
        </div>
      </div>

      {/* Footer Tagline */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 7.5, color: '#059669', fontWeight: 700, lineHeight: 1 }}>
          Aapki Fasal, Hamari Saaf Niyat, Salah aur Suraksha
        </div>
        <div style={{ fontSize: 11, color: '#022c22', fontWeight: 900, letterSpacing: 1, marginTop: 2, lineHeight: 1 }}>
          JAI JAWAN JAI KISAN
        </div>
      </div>
    </div>
  )
}

/* ───────────── PAGE COMPONENT ───────────── */
export default function FarmerCardGenerator() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isExporting, setIsExporting] = useState<'pdf' | 'jpg' | null>(null)

  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const fetchFarmers = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('farmers')
        .select(
          'id, farmer_id, farmer_name, father_name, mobile, village, photo_url, aadhaar_number, credit_limit, repayment_days'
        )
        .eq('account_status', 'active')
        .order('farmer_name', { ascending: true })

      if (error) throw error
      setFarmers((data || []) as Farmer[])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load farmers'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFarmers()
  }, [fetchFarmers])

  const filteredFarmers = farmers.filter((f) => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    return (
      f.farmer_name?.toLowerCase().includes(q) ||
      f.farmer_id?.toLowerCase().includes(q) ||
      (f.mobile || '').includes(q) ||
      (f.village || '').toLowerCase().includes(q)
    )
  })

  const captureNode = async (node: HTMLElement): Promise<HTMLCanvasElement> => {
    const card = node.firstElementChild as HTMLElement | null
    if (!card) throw new Error('Card element not found for export')

    const stage = document.createElement('div')
    stage.setAttribute('aria-hidden', 'true')
    Object.assign(stage.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${CARD_W}px`,
      height: `${CARD_H}px`,
      margin: '0',
      padding: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '2147483647',
      background: '#ffffff',
      opacity: '1',
      transform: 'none',
    })

    const clone = card.cloneNode(true) as HTMLElement
    Object.assign(clone.style, {
      width: `${CARD_W}px`,
      height: `${CARD_H}px`,
      minWidth: `${CARD_W}px`,
      minHeight: `${CARD_H}px`,
      maxWidth: `${CARD_W}px`,
      maxHeight: `${CARD_H}px`,
      margin: '0',
      transform: 'none',
      opacity: '1',
      visibility: 'visible',
      position: 'relative',
      left: '0',
      top: '0',
      boxSizing: 'border-box',
      overflow: 'hidden',
    })

    stage.appendChild(clone)
    document.body.appendChild(stage)

    try {
      if (document.fonts?.ready) await document.fonts.ready

      const images = Array.from(clone.querySelectorAll('img'))
      await Promise.all(
        images.map(async (img) => {
          try {
            if (!img.complete) {
              await new Promise<void>((resolve) => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
            }
            if ('decode' in img && typeof img.decode === 'function') {
              await img.decode().catch(() => undefined)
            }
          } catch {
            // ignore
          }
        })
      )

      await new Promise((r) => setTimeout(r, 200))

      return await html2canvas(clone, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: CARD_W,
        height: CARD_H,
        windowWidth: CARD_W,
        windowHeight: CARD_H,
        scrollX: 0,
        scrollY: 0,
      })
    } finally {
      stage.remove()
    }
  }

  const handleDownloadJPG = async () => {
    if (!selectedFarmer || !frontRef.current || !backRef.current) return
    setIsExporting('jpg')
    try {
      const frontCanvas = await captureNode(frontRef.current)
      const backCanvas = await captureNode(backRef.current)

      const gap = 24
      const width = Math.max(frontCanvas.width, backCanvas.width)
      const height = frontCanvas.height + backCanvas.height + gap
      const merged = document.createElement('canvas')
      merged.width = width
      merged.height = height
      const ctx = merged.getContext('2d')
      if (!ctx) throw new Error('Canvas context failed')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(frontCanvas, 0, 0)
      ctx.drawImage(backCanvas, 0, frontCanvas.height + gap)

      const link = document.createElement('a')
      link.download = `SATGURU_CARD_${selectedFarmer.farmer_id}.jpg`
      link.href = merged.toDataURL('image/jpeg', 0.95)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('JPG downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('JPG download failed. Check photo CORS.')
    } finally {
      setIsExporting(null)
    }
  }

  const handleDownloadPDF = async () => {
    if (!selectedFarmer || !frontRef.current || !backRef.current) return
    setIsExporting('pdf')
    try {
      const frontCanvas = await captureNode(frontRef.current)
      const backCanvas = await captureNode(backRef.current)

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98],
        compress: true,
      })

      pdf.addImage(frontCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 53.98)
      pdf.addPage([85.6, 53.98], 'landscape')
      pdf.addImage(backCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 85.6, 53.98)

      pdf.save(`SATGURU_CARD_${selectedFarmer.farmer_id}.pdf`)
      toast.success('PDF downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('PDF download failed. Check photo CORS.')
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center gap-4">
        <div className="p-3 bg-amber-500 text-emerald-950 rounded-2xl">
          <CreditCard size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Farmer Udhaar Card Generator</h1>
          <p className="text-emerald-200 text-sm mt-1">
            Search farmer → Flip card → Download JPG/PDF (85.6 × 53.98 mm)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search name, mobile or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[420px] flex flex-col">
            <div className="bg-emerald-50 p-3 border-b text-xs font-bold text-emerald-900 flex justify-between">
              <span>Farmers List</span>
              <span>{filteredFarmers.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading...
                </div>
              ) : filteredFarmers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No farmers found.</div>
              ) : (
                filteredFarmers.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedFarmer(f)
                      setIsFlipped(false)
                    }}
                    className={`w-full text-left p-3 rounded-xl transition border ${
                      selectedFarmer?.id === f.id
                        ? 'bg-emerald-100 border-emerald-400'
                        : 'hover:bg-slate-50 border-transparent'
                    }`}
                  >
                    <p className="font-bold text-sm text-slate-900">{f.farmer_name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {f.farmer_id} · {f.village || '—'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedFarmer ? (
            <div className="bg-white rounded-3xl border shadow-sm flex flex-col overflow-hidden">
              <div className="bg-emerald-900 text-white p-4 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2">
                  <CreditCard size={18} className="text-amber-400" /> Card Preview
                </h2>
                <span className="text-xs bg-emerald-800 px-2 py-1 rounded text-emerald-200 font-mono">
                  85.6 mm × 53.98 mm
                </span>
              </div>

              <div className="p-6 bg-slate-100 flex flex-col items-center overflow-hidden">
                <div
                  style={{ perspective: 1200, width: CARD_W, height: CARD_H }}
                  className="cursor-pointer max-sm:scale-[0.85] max-sm:origin-top"
                  onClick={() => setIsFlipped((v) => !v)}
                >
                  <div
                    className="relative w-full h-full transition-transform duration-700 shadow-xl rounded-xl"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                      <FrontCard farmer={selectedFarmer} />
                    </div>
                    <div
                      className="absolute inset-0 rounded-xl overflow-hidden"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <BackCard />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-bold mt-6 flex items-center gap-1.5 max-sm:mt-0">
                  <RefreshCcw size={14} className="text-emerald-600" />
                  Click card to view {isFlipped ? 'Front' : 'Back'}
                </p>
              </div>

              <div className="p-4 border-t bg-slate-50 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setIsFlipped((v) => !v)}
                  className="py-3 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={18} /> Flip
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadJPG()}
                  disabled={isExporting !== null}
                  className="py-3 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting === 'jpg' ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                  <span className="hidden sm:inline">Download JPG</span>
                  <span className="sm:hidden">JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadPDF()}
                  disabled={isExporting !== null}
                  className="py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  <span className="hidden sm:inline">Download PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 min-h-[420px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Users size={64} className="text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-600">Select a Farmer</h3>
              <p className="text-sm mt-1">Left list से किसान चुनें</p>
            </div>
          )}
        </div>
      </div>

      {/* OFFSCREEN CLEAN EXPORT NODES */}
      {selectedFarmer && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <div ref={frontRef}>
            <FrontCard farmer={selectedFarmer} />
          </div>
          <div ref={backRef} style={{ marginTop: 20 }}>
            <BackCard />
          </div>
        </div>
      )}
    </div>
  )
}