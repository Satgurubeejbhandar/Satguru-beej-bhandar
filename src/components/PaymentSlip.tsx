// src/components/PaymentSlip.tsx
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PaymentReceipt {
  payment_id: string
  payment_number: string
  payment_amount: number
  payment_mode: string
  previous_outstanding: number
  new_outstanding: number
  farmer_name: string
  farmer_id_code: string
  farmer_mobile: string | null
  payment_date: string
  reference_number: string
  notes: string
}

export const SHOP_INFO = {
  name: 'SATGURU BEEJ BHANDAR',
  address: 'Daloosar, Sardarshahar (Churu), Rajasthan',
  tagline: 'बुआई से कटाई तक - आपका भरोसेमंद साथी',
  phone: '+91-7988950257',
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  cash: 'Cash (नकद)',
  upi: 'UPI / PhonePe / GPay',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
}

export const A6_WIDTH_MM = 105
export const A6_HEIGHT_MM = 148

export function formatINR(value: number): string {
  return (Number(value) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 60)
}

export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length >= 10 ? digits : null
}

export function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function formatTime12(d: Date): string {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

export function referenceDisplay(mode: string, ref: string): string {
  const trimmed = (ref || '').trim()
  if (mode === 'cash') return trimmed || 'Cash Payment'
  return trimmed || 'N/A'
}

export function PaymentSlipTemplate({
  receipt,
  slipRef,
}: {
  receipt: PaymentReceipt
  slipRef: React.RefObject<HTMLDivElement | null>
}) {
  const paymentDate = new Date(receipt.payment_date)
  const dateStr = formatDateDMY(paymentDate)
  const timeStr = formatTime12(paymentDate)
  const modeLabel = PAYMENT_MODE_LABEL[receipt.payment_mode] || receipt.payment_mode
  const refText = referenceDisplay(receipt.payment_mode, receipt.reference_number)

  const widthPx = Math.round(A6_WIDTH_MM * 4)
  const heightPx = Math.round(A6_HEIGHT_MM * 4)

  return (
    <div
      ref={slipRef}
      style={{
        width: `${widthPx}px`,
        minHeight: `${heightPx}px`,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily:
          '"Helvetica Neue", Helvetica, Arial, "Noto Sans Devanagari", sans-serif',
        padding: '0',
        boxSizing: 'border-box',
        position: 'relative',
        fontSize: '11px',
        lineHeight: 1.4,
        overflow: 'hidden',
        border: '2px solid #064e3b',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            transform: 'rotate(-32deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                fontSize: '46px',
                fontWeight: 900,
                color: 'rgba(6, 78, 59, 0.13)',
                whiteSpace: 'nowrap',
                letterSpacing: '6px',
                fontFamily: 'Arial Black, Helvetica, sans-serif',
              }}
            >
              SATGURU PAYMENTS
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, padding: '14px 16px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            margin: '-14px -16px 0 -16px',
            padding: '14px 16px 12px 16px',
            textAlign: 'center',
            borderBottom: '4px solid #f59e0b',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '1.5px',
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {SHOP_INFO.name}
          </div>
          <div style={{ fontSize: '9px', color: '#d1fae5', marginTop: '3px', fontWeight: 500 }}>
            {SHOP_INFO.address}
          </div>
          <div
            style={{
              fontSize: '9px',
              color: '#fef3c7',
              marginTop: '2px',
              fontWeight: 700,
              fontStyle: 'italic',
            }}
          >
            {SHOP_INFO.tagline}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div
            style={{
              display: 'inline-block',
              background: '#f59e0b',
              color: '#064e3b',
              padding: '5px 18px',
              fontSize: '12px',
              fontWeight: 900,
              borderRadius: '20px',
              letterSpacing: '2px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '2px solid #064e3b',
            }}
          >
            UDHAAR PAYMENT SLIP
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '10px',
            padding: '6px 10px',
            background: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #bbf7d0',
            fontSize: '10px',
          }}
        >
          <div>
            <div style={{ color: '#047857', fontSize: '8px', fontWeight: 700 }}>RECEIPT NO.</div>
            <div style={{ fontWeight: 900, color: '#064e3b', fontSize: '12px' }}>
              {receipt.payment_number}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#047857', fontSize: '8px', fontWeight: 700 }}>DATE & TIME</div>
            <div style={{ fontWeight: 800, color: '#064e3b', fontSize: '11px' }}>{dateStr}</div>
            <div style={{ fontWeight: 700, color: '#064e3b', fontSize: '10px' }}>{timeStr}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: '10px',
            padding: '8px 10px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            border: '2px solid #10b981',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '8px',
              color: '#065f46',
              fontWeight: 800,
              letterSpacing: '0.5px',
              marginBottom: '2px',
            }}
          >
            ◆ PAYMENT RECEIVED FROM / भुगतान कर्ता
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 900,
              color: '#064e3b',
              marginTop: '2px',
              borderBottom: '1px dashed #047857',
              paddingBottom: '4px',
            }}
          >
            {receipt.farmer_name}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '5px',
              fontSize: '10px',
            }}
          >
            <div>
              <span style={{ color: '#047857', fontWeight: 700 }}>ID: </span>
              <span style={{ fontWeight: 900, color: '#064e3b' }}>{receipt.farmer_id_code}</span>
            </div>
            <div>
              <span style={{ color: '#047857', fontWeight: 700 }}>Mob: </span>
              <span style={{ fontWeight: 900, color: '#064e3b' }}>
                {receipt.farmer_mobile || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 900,
              color: '#ffffff',
              background: '#064e3b',
              padding: '3px 8px',
              borderRadius: '4px 4px 0 0',
              letterSpacing: '1px',
            }}
          >
            ◆ PAYMENT DETAILS
          </div>
          <div
            style={{
              border: '1.5px solid #064e3b',
              borderTop: 'none',
              padding: '6px 10px',
              borderRadius: '0 0 4px 4px',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                padding: '2px 0',
              }}
            >
              <span style={{ color: '#374151', fontWeight: 600 }}>Payment Mode</span>
              <span style={{ fontWeight: 900, color: '#064e3b' }}>{modeLabel}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                padding: '2px 0',
                borderTop: '1px dotted #d1d5db',
                marginTop: '3px',
                paddingTop: '4px',
              }}
            >
              <span style={{ color: '#374151', fontWeight: 600 }}>UTR / Ref.</span>
              <span
                style={{
                  fontWeight: 800,
                  maxWidth: '60%',
                  textAlign: 'right',
                  wordBreak: 'break-all',
                  color: '#064e3b',
                  fontFamily: 'monospace',
                }}
              >
                {refText}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 900,
              color: '#ffffff',
              background: '#064e3b',
              padding: '3px 8px',
              borderRadius: '4px 4px 0 0',
              letterSpacing: '1px',
            }}
          >
            ◆ ACCOUNT SUMMARY
          </div>
          <div
            style={{
              border: '1.5px solid #064e3b',
              borderTop: 'none',
              padding: '6px',
              borderRadius: '0 0 4px 4px',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                background: '#f3f4f6',
                borderRadius: '4px',
                marginBottom: '4px',
                borderLeft: '3px solid #6b7280',
              }}
            >
              <span style={{ fontSize: '10px', color: '#374151', fontWeight: 700 }}>
                Outstanding Before
              </span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#374151' }}>
                ₹{formatINR(receipt.previous_outstanding)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 10px',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)',
                border: '2px solid #059669',
                borderRadius: '4px',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#064e3b', fontWeight: 800 }}>
                ✓ Payment Received
              </span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#064e3b' }}>
                ₹{formatINR(receipt.payment_amount)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 10px',
                background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                border: '2px solid #ea580c',
                borderRadius: '4px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#9a3412', fontWeight: 800 }}>
                Outstanding After
              </span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#9a3412' }}>
                ₹{formatINR(receipt.new_outstanding)}
              </span>
            </div>
          </div>
        </div>

        {receipt.notes && (
          <div
            style={{
              marginTop: '8px',
              padding: '5px 8px',
              background: '#fefce8',
              border: '1px dashed #ca8a04',
              borderRadius: '4px',
              fontSize: '9px',
            }}
          >
            <span style={{ color: '#854d0e', fontWeight: 800 }}>Note: </span>
            <span style={{ color: '#422006' }}>{receipt.notes}</span>
          </div>
        )}

        <div
          style={{
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '2px dashed #064e3b',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#064e3b', fontWeight: 900, letterSpacing: '0.5px' }}>
            ✓ Payment Received Successfully
          </div>
          <div style={{ fontSize: '8px', color: '#374151', marginTop: '3px' }}>
            Thank you for choosing {SHOP_INFO.name}
          </div>
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '8px',
              color: '#6b7280',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '4px',
            }}
          >
            <span>📞 {SHOP_INFO.phone}</span>
            <span style={{ fontWeight: 700, color: '#064e3b' }}>Computer Generated Slip</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function buildPdfBlob(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
    compress: true,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const ratio = canvas.width / canvas.height

  let renderW = pageWidth
  let renderH = renderW / ratio
  if (renderH > pageHeight) {
    renderH = pageHeight
    renderW = renderH * ratio
  }

  const offsetX = (pageWidth - renderW) / 2
  const offsetY = (pageHeight - renderH) / 2
  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST')
  return pdf.output('blob')
}