// src/components/admin/FarmerCardModal.tsx
import { useRef, useState, useEffect } from 'react'
import { X, Download, Printer, Loader2, CreditCard } from 'lucide-react'
import { toJpeg } from 'html-to-image'
import toast from 'react-hot-toast'

type Farmer = {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  mobile: string | null
  village: string | null
  aadhaar_number: string | null
  credit_limit: number | string | null
  photo_url: string | null
  tehsil?: string | null
  district?: string | null
  repayment_days?: number | string | null
}

interface Props {
  farmer: Farmer
  onClose: () => void
}

function formatINR(amount: number | string | null | undefined): string {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount || 0))
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXX-XXXX-XXXX'
  return `XXXX-XXXX-${aadhaar.slice(-4)}`
}

export default function FarmerCardModal({ farmer, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(1)

  // Responsive scale setup for mobile preview (ensures the real DOM node stays actual size for HD capture)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 480) {
        setScale(window.innerWidth / 480)
      } else {
        setScale(1)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const repaymentDays = farmer.repayment_days ? String(farmer.repayment_days) : '90'

  const handleDownloadJPG = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    toast.loading('HD Card तैयार हो रहा है...', { id: 'card-dl' })

    try {
      const images = cardRef.current.querySelectorAll('img')
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve()
              else {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              }
            })
        )
      )

      // Temporary disable transform for clean capture
      const originalTransform = cardRef.current.style.transform
      cardRef.current.style.transform = 'none'

      const dataUrl = await toJpeg(cardRef.current, {
        quality: 1.0,
        pixelRatio: 4, // 4x Ultra HD quality for sharp printing
        backgroundColor: '#ffffff',
        cacheBust: true,
      })

      cardRef.current.style.transform = originalTransform

      const safeName = (farmer.farmer_name || 'Farmer').replace(/\s+/g, '_')
      const link = document.createElement('a')
      link.download = `KisanCard-${farmer.farmer_id}-${safeName}.jpg`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('HD Card डाउनलोड हो गया! ✓', { id: 'card-dl' })
    } catch (err) {
      console.error(err)
      toast.error('डाउनलोड में समस्या हुई', { id: 'card-dl' })
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    const frontEl = document.getElementById('card-front')
    const backEl = document.getElementById('card-back')
    if (!frontEl || !backEl) return

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups.')
      return
    }

    // Explicitly enforce 8.56cm x 5.40cm in Print CSS
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Kisan Card</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; background: #fff; font-family: sans-serif; }
            
            .print-card {
              width: 8.56cm !important;
              height: 5.40cm !important;
              overflow: hidden;
              border-radius: 8px;
              border: 1px solid #ccc;
              page-break-inside: avoid;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              position: relative;
            }
            
            @media print {
              body { margin: 0; padding: 1cm; gap: 1cm; }
              @page { size: A4; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-card">${frontEl.innerHTML}</div>
          <div class="print-card">${backEl.innerHTML}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  const qrData = encodeURIComponent(
    JSON.stringify({
      id: farmer.farmer_id,
      name: farmer.farmer_name,
      mobile: farmer.mobile,
    })
  )
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=0a2e1a&bgcolor=ffffff&data=${qrData}`

  // Standard CR80 Size Ratio Proportions (8.56 x 5.40)
  // Scaling it by 50 for pure pixel clarity on web (428px x 270px)
  const cardStyle = {
    width: '428px',
    height: '270px',
    background: 'linear-gradient(160deg, #0a2e1a 0%, #0d3d24 40%, #0a2818 100%)',
    border: '2.5px solid #c9a84c',
    fontFamily: "'Segoe UI', 'Noto Sans Devanagari', system-ui, sans-serif",
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-2 sm:p-6 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* ── Modal Header ── */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
            <CreditCard size={20} className="text-amber-400" />
            Kisan Udhaar Card Preview
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJPG}
              disabled={downloading}
              className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs px-3 py-1.5 rounded-full transition disabled:opacity-60 cursor-pointer shadow"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden sm:inline">Save JPG</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-emerald-200 hover:text-white p-1 rounded-full hover:bg-emerald-700 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Card Preview Area ── */}
        <div className="flex-1 overflow-y-auto bg-slate-100 flex flex-col items-center py-6 px-2">
          
          {/* Capture Wrapper */}
          <div 
            ref={cardRef} 
            className="flex flex-col gap-5 p-4 bg-white rounded-xl shadow-sm"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            
            {/* ================= FRONT SIDE ================= */}
            <div id="card-front" className="rounded-xl overflow-hidden relative shadow-lg shrink-0" style={cardStyle}>
              {/* Top Section */}
              <div className="px-5 pt-3 pb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full mb-1.5" style={{ background: '#c9a84c', color: '#0a2e1a' }}>
                    OFFICIAL KISAN CARD
                  </span>
                  <h1 className="text-white font-black leading-tight" style={{ fontSize: '17px' }}>
                    सतगुरु बीज भंडार
                  </h1>
                  <p className="text-emerald-300 text-[9px] mt-0.5 font-medium">
                    दलूसर, सरदारशहर (चूरू), राजस्थान
                  </p>
                </div>
                <div className="shrink-0 rounded p-1 bg-white shadow-sm" style={{ width: 56, height: 56 }}>
                  <img src={qrUrl} alt="QR" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(201,168,76,0.3)', margin: '0 20px' }} />

              {/* Middle: Photo + Details */}
              <div className="px-5 py-3 flex gap-4 items-start">
                <div className="shrink-0 rounded-lg overflow-hidden border-2 shadow-md" style={{ width: 75, height: 95, borderColor: '#c9a84c', background: '#0d3d24' }}>
                  {farmer.photo_url ? (
                    <img src={farmer.photo_url} alt="Photo" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-400 text-3xl font-black">
                      {(farmer.farmer_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider">FARMER ID</p>
                    <p className="font-black text-base leading-tight" style={{ color: '#f5c842' }}>{farmer.farmer_id}</p>
                  </div>
                  <div>
                    <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider">FARMER NAME</p>
                    <p className="text-white font-bold text-sm leading-tight truncate">{farmer.farmer_name}</p>
                    <p className="text-emerald-300 text-[10px]">S/O {farmer.father_name || '—'}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider flex items-center gap-1">📞 MOBILE</p>
                      <p className="text-white font-bold text-[11px] font-mono">{farmer.mobile || '—'}</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider flex items-center gap-1">📍 VILLAGE</p>
                      <p className="text-white font-bold text-[11px] truncate">{farmer.village || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Stats */}
              <div className="mx-4 mb-2 rounded-lg overflow-hidden flex" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(201,168,76,0.25)' }}>
                <div className="flex-1 px-3 py-2">
                  <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider">Credit Limit (क्रेडिट सीमा)</p>
                  <p className="font-black text-sm" style={{ color: '#f5c842' }}>₹{formatINR(farmer.credit_limit)}</p>
                </div>
                <div style={{ width: 1, background: 'rgba(201,168,76,0.25)' }} />
                <div className="flex-1 px-3 py-2">
                  <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-wider">🔒 Aadhaar (मास्क्ड)</p>
                  <p className="text-white font-bold text-xs font-mono mt-0.5">{maskAadhaar(farmer.aadhaar_number)}</p>
                </div>
              </div>

              {/* Footer Strip */}
              <div className="absolute bottom-0 w-full px-5 py-1.5 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <p className="text-emerald-400 text-[8px] font-medium">📅 Repayment: {repaymentDays} Days</p>
                <p className="text-emerald-500 text-[8px] italic">Aapki Fasal, Hamari Saaf Niyat</p>
              </div>
            </div>


            {/* ================= BACK SIDE ================= */}
            <div id="card-back" className="rounded-xl overflow-hidden relative shadow-lg shrink-0 flex flex-col" style={cardStyle}>
              
              <div className="px-5 py-4">
                <h3 className="font-black text-sm uppercase tracking-wide border-b pb-1 mb-2 inline-block" style={{ color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)' }}>
                  नियम एवं शर्तें (T&C)
                </h3>
                <ul className="text-[9px] space-y-1.5 text-emerald-100 font-medium list-disc pl-3 marker:text-emerald-500">
                  <li>यह कार्ड केवल <strong>सतगुरु बीज भंडार</strong> पर खरीदारी के लिए मान्य है।</li>
                  <li>लेनदेन और खाता विवरण के लिए खरीदारी के समय इस कार्ड को प्रस्तुत करना अनिवार्य है।</li>
                  <li>निर्धारित समय ({repaymentDays} दिन) के भीतर भुगतान करना आवश्यक है।</li>
                  <li>कार्ड खो जाने या खराब होने पर तुरंत प्रतिष्ठान से संपर्क करें।</li>
                  <li>यह कार्ड अहस्तांतरणीय (Non-transferable) है।</li>
                </ul>
              </div>

              <div className="mt-auto px-5 py-3 w-full flex items-end justify-between" style={{ background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(201,168,76,0.25)' }}>
                {/* Contact List */}
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#c9a84c' }}>📞 सम्पर्क सूत्र (Contact Us)</p>
                  <p className="text-white text-[9px] font-medium">
                    <span className="text-emerald-300 w-16 inline-block">Satpal Verma:</span> 
                    <span className="font-mono font-bold tracking-wide">91665 14441</span>
                  </p>
                  <p className="text-white text-[9px] font-medium">
                    <span className="text-emerald-300 w-16 inline-block">Rajpal Verma:</span> 
                    <span className="font-mono font-bold tracking-wide">79889 50257</span>
                  </p>
                  <p className="text-white text-[9px] font-medium">
                    <span className="text-emerald-300 w-16 inline-block">Ramesh Kumar:</span> 
                    <span className="font-mono font-bold tracking-wide">74140 85050</span>
                  </p>
                </div>

                {/* Signature Block */}
                <div className="text-center pb-1">
                  <div className="w-24 border-b border-dashed mb-1" style={{ borderColor: 'rgba(201,168,76,0.8)' }}></div>
                  <p className="text-emerald-400 text-[7px] font-bold uppercase tracking-widest">
                    Authorized Signatory
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ── Bottom Action Bar ── */}
        <div className="px-5 py-4 bg-white border-t flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-emerald-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Printer size={18} /> Print Card
          </button>
          <button
            type="button"
            onClick={handleDownloadJPG}
            disabled={downloading}
            className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer shadow-md"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {downloading ? 'Saving...' : 'Download JPG'}
          </button>
        </div>
      </div>
    </div>
  )
}