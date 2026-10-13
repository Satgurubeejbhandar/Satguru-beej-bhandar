// File: src/components/FarmerCardModal.tsx

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, ShieldCheck, Phone, MapPin, Calendar, CreditCard } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Farmer {
  farmer_id: string | number
  farmer_name: string
  father_name?: string
  mobile?: string
  village?: string
  aadhaar_number?: string
  credit_limit?: number
  repayment_days?: number
  photo_url?: string
}

interface FarmerCardModalProps {
  farmer: Farmer
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Masks an Aadhaar number so only the last 4 digits are visible.
 * Input must be exactly 12 digits; otherwise returns a safe fallback.
 */
function maskAadhaar(raw?: string): string {
  if (!raw || raw.length < 4) return 'Not Provided'
  // Only use last 4 digits — never expose more on the client
  const last4 = raw.replace(/\D/g, '').slice(-4)
  if (last4.length !== 4) return 'Not Provided'
  return `XXXX-XXXX-${last4}`
}

/**
 * Basic URL validation to prevent javascript: or data: URI injection
 * in user-supplied photo URLs.
 */
function isSafeImageUrl(url?: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Sanitise a plain-text string for safe rendering.
 * Strips control characters but preserves Hindi/Unicode.
 */
function sanitize(value?: string | number | null): string {
  if (value === null || value === undefined) return ''
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FarmerCardModal({ farmer, onClose }: FarmerCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // ── Derived values (safe) ──────────────────────────────────────────────────

  const maskedAadhaar = useMemo(() => maskAadhaar(farmer?.aadhaar_number), [farmer?.aadhaar_number])

  const farmerName = sanitize(farmer?.farmer_name) || 'Unknown'
  const fatherName = sanitize(farmer?.father_name)
  const farmerId = sanitize(farmer?.farmer_id) || '—'
  const mobile = sanitize(farmer?.mobile) || 'Not Provided'
  const village = sanitize(farmer?.village) || 'Not Provided'
  const creditLimit = Number(farmer?.credit_limit) || 0
  const repaymentDays = Number(farmer?.repayment_days) || 90

  /**
   * QR code payload — intentionally contains only the farmer ID and name,
   * NEVER the Aadhaar number or other sensitive PII.
   */
  const qrValue = useMemo(() => {
    try {
      return JSON.stringify({
        id: farmerId,
        name: farmerName,
        village,
      })
    } catch {
      return farmerId
    }
  }, [farmerId, farmerName, village])

  const safePhotoUrl = isSafeImageUrl(farmer?.photo_url) ? farmer.photo_url : null

  // ── Keyboard & focus-trap ──────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)

    // Prevent body scroll while modal is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [handleKeyDown])

  // ── Print handler ──────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ── Backdrop click ─────────────────────────────────────────────────────────

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Close only when clicking the backdrop itself, not child elements
      if (e.target === modalRef.current) {
        onClose()
      }
    },
    [onClose],
  )

  // ── Guard: if farmer data is somehow missing, don't render a broken card ──

  if (!farmer) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-sm">
          <p className="text-red-600 font-semibold mb-4">Farmer data is unavailable.</p>
          <button
            onClick={onClose}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-6 py-2 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print-only stylesheet — scoped via @media print */}
      <style>{`
        @media print {
          body > *:not(.farmer-card-print-root) {
            display: none !important;
          }
          .farmer-card-print-root {
            position: static !important;
            background: transparent !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .farmer-card-print-root .farmer-card-print-area {
            display: flex !important;
            justify-content: center !important;
            padding: 0 !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* Modal Overlay */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Farmer Kisan Card Preview"
        className="farmer-card-print-root fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Modal Header — hidden when printing */}
          <div className="bg-emerald-900 text-white px-6 py-4 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-2">
              <CreditCard className="text-amber-400" size={22} aria-hidden="true" />
              <h2 className="text-lg font-bold">Kisan Udhaar Card Preview</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <Printer size={16} aria-hidden="true" /> Print Card
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="text-emerald-200 hover:text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300 rounded"
              >
                ×
              </button>
            </div>
          </div>

          {/* Printable Card Area */}
          <div className="farmer-card-print-area p-6 overflow-y-auto bg-slate-100 flex justify-center">
            <div
              ref={cardRef}
              className="w-full max-w-md bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 shadow-2xl border-2 border-amber-500/40 relative overflow-hidden print:m-0 print:shadow-none"
            >
              {/* Background Decorative Circles */}
              <div
                className="absolute -right-12 -top-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="absolute -left-12 -bottom-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"
                aria-hidden="true"
              />

              {/* Header */}
              <div className="flex justify-between items-start border-b border-emerald-800/80 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                    OFFICIAL KISAN CARD
                  </span>
                  <h3 className="text-xl font-black text-white mt-1 tracking-wide">
                    सतगुरु बीज भंडार
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    दल्लुसर, सरदारशहर (चूरू), राजस्थान
                  </p>
                </div>
                <div className="bg-white p-1.5 rounded-xl shadow-md flex-shrink-0">
                  <QRCodeSVG
                    value={qrValue}
                    size={58}
                    level="M"
                  />
                </div>
              </div>

              {/* Card Body */}
              <div className="grid grid-cols-3 gap-4 items-center">
                {/* Photo */}
                <div className="col-span-1">
                  <div className="w-24 h-28 rounded-2xl bg-emerald-800/60 border-2 border-amber-400/60 overflow-hidden shadow-inner flex items-center justify-center text-amber-200 text-2xl font-bold">
                    {safePhotoUrl ? (
                      <img
                        src={safePhotoUrl}
                        alt={`Photo of ${farmerName}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // If the image fails to load, hide it and show the fallback
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <span aria-label={`Initial of ${farmerName}`}>
                        {farmerName[0] || '👨‍🌾'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="col-span-2 space-y-2 text-xs">
                  <div>
                    <p className="text-[10px] text-emerald-300/80 font-semibold uppercase">
                      Farmer ID
                    </p>
                    <p className="font-mono font-black text-amber-400 text-base tracking-wider">
                      {farmerId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-300/80 font-semibold uppercase">
                      Farmer Name
                    </p>
                    <p className="font-bold text-sm text-white">{farmerName}</p>
                    {fatherName && (
                      <p className="text-[11px] text-emerald-200/80">S/O {fatherName}</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[10px] text-emerald-300/80 font-semibold uppercase flex items-center gap-1">
                        <Phone size={10} aria-hidden="true" /> Mobile
                      </p>
                      <p className="font-semibold text-white">{mobile}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-300/80 font-semibold uppercase flex items-center gap-1">
                        <MapPin size={10} aria-hidden="true" /> Village
                      </p>
                      <p className="font-semibold text-white">{village}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Limits Grid */}
              <div className="mt-5 grid grid-cols-2 gap-2 bg-emerald-900/60 p-3 rounded-2xl border border-emerald-800/80 text-xs">
                <div>
                  <p className="text-[10px] text-emerald-300 font-medium">
                    Credit Limit (क्रेडिट सीमा)
                  </p>
                  <p className="font-black text-amber-400 text-sm">
                    ₹{creditLimit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-300 font-medium flex items-center gap-1">
                    <ShieldCheck size={10} className="text-emerald-400" aria-hidden="true" /> Aadhaar
                    (मास्क्ड)
                  </p>
                  <p className="font-mono font-bold text-emerald-100 text-xs mt-0.5">
                    {maskedAadhaar}
                  </p>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="mt-4 pt-3 border-t border-emerald-800/60 flex justify-between items-center text-[9px] text-emerald-300/70">
                <span className="flex items-center gap-1">
                  <Calendar size={10} aria-hidden="true" /> Repayment: {repaymentDays} Days
                </span>
                <span>Aapki Fasal, Hamari Saaf Niyat</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}