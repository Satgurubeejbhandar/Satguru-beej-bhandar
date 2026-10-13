// src/components/PaymentReceipt.tsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  X,
  Download,
  Printer,
  Loader2,
  Landmark,
  Banknote,
  Smartphone,
  FileCheck,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'

export interface ReceiptData {
  payment_id: string
  payment_number: string
  payment_amount: number
  payment_mode: string
  payment_date: string
  reference_number?: string | null
  notes?: string | null
  created_at: string
  company_id: string
  company_name: string
  company_gstin?: string | null
  bank_name_snapshot?: string | null
  account_name_snapshot?: string | null
  account_number_snapshot?: string | null
  ifsc_snapshot?: string | null
  branch_snapshot?: string | null
  upi_id_snapshot?: string | null
  cash_recipient_name?: string | null
  cash_recipient_photo_path?: string | null
  cheque_number?: string | null
  cheque_bank_name?: string | null
}

interface Props {
  paymentId: string
  onClose: () => void
}

function formatINR(v: number | null | undefined): string {
  return (Number.isFinite(Number(v)) ? Number(v) : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function amountInWords(num: number): string {
  const n = Math.floor(Math.abs(num))
  if (n === 0) return 'Zero Rupees Only'

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const twoDigit = (x: number): string =>
    x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`

  const threeDigit = (x: number): string => {
    if (x >= 100) {
      return `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${twoDigit(x % 100)}` : ''}`
    }
    return twoDigit(x)
  }

  let out = ''
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000

  if (crore) out += `${threeDigit(crore)} Crore `
  if (lakh) out += `${twoDigit(lakh)} Lakh `
  if (thousand) out += `${twoDigit(thousand)} Thousand `
  if (rest) out += `${threeDigit(rest)} `

  return `${out.trim()} Rupees Only`
}

function formatDate(d: string): string {
  const parts = (d || '').split('T')[0].split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d || '—'
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function modeLabel(m: string): string {
  const map: Record<string, string> = {
    bank: 'Bank Transfer',
    upi: 'UPI',
    cheque: 'Cheque',
    cash: 'Cash',
  }
  return map[(m || '').toLowerCase()] || (m || '').toUpperCase() || '—'
}

function ModeIcon({ mode, size = 16 }: { mode: string; size?: number }) {
  const m = (mode || '').toLowerCase()
  if (m === 'upi') return <Smartphone size={size} />
  if (m === 'cheque') return <FileCheck size={size} />
  if (m === 'cash') return <IndianRupee size={size} />
  return <Banknote size={size} />
}

function sanitizeFilename(s: string): string {
  return (s || 'Receipt')
    .replace(/[/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
}

function getAutoTableFinalY(doc: jsPDF, fallback: number): number {
  const anyDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } }
  return anyDoc.lastAutoTable?.finalY ?? fallback
}

export default function PaymentReceipt({ paymentId, onClose }: Props) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setPhotoUrl(null)

      const { data, error } = await supabase.rpc('get_payment_receipt', {
        p_payment_id: paymentId,
      })

      if (error) throw error
      if (!data) throw new Error('Receipt not found')

      const parsed = data as ReceiptData
      setReceipt(parsed)

      if (parsed.cash_recipient_photo_path) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('cash-recipient-photos')
          .createSignedUrl(parsed.cash_recipient_photo_path, 3600)

        if (urlError) {
          console.warn('Signed URL error:', urlError.message)
        } else if (urlData?.signedUrl) {
          setPhotoUrl(urlData.signedUrl)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Receipt load failed: ' + msg)
      setReceipt(null)
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => {
    void load()
  }, [load])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    if (!receipt) return

    setGenerating(true)
    const toastId = toast.loading('PDF तैयार हो रहा है...')

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pw = doc.internal.pageSize.getWidth()

      // Outer border
      doc.setDrawColor(6, 78, 59)
      doc.setLineWidth(0.8)
      doc.rect(8, 8, pw - 16, 275)
      doc.setLineWidth(0.3)
      doc.rect(10, 10, pw - 20, 271)

      // Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(6, 78, 59)
      doc.text('SATGURU BEEJ BHANDAR', pw / 2, 22, { align: 'center' })

      doc.setFontSize(11)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text('Agricultural Seeds & Crop Protection Supplier', pw / 2, 28, { align: 'center' })

      // Title band
      doc.setFillColor(6, 78, 59)
      doc.rect(10, 34, pw - 20, 10, 'F')
      doc.setFontSize(13)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('SUPPLIER PAYMENT RECEIPT', pw / 2, 41, { align: 'center' })

      // Meta
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Receipt No:', 14, 52)
      doc.setFont('helvetica', 'normal')
      doc.text(receipt.payment_number || '—', 40, 52)

      doc.setFont('helvetica', 'bold')
      doc.text('Payment Date:', pw - 70, 52)
      doc.setFont('helvetica', 'normal')
      doc.text(formatDate(receipt.payment_date), pw - 40, 52)

      doc.setFont('helvetica', 'bold')
      doc.text('Recorded:', 14, 58)
      doc.setFont('helvetica', 'normal')
      doc.text(formatDateTime(receipt.created_at), 40, 58)

      doc.setDrawColor(203, 213, 225)
      doc.line(14, 62, pw - 14, 62)

      // PAID TO
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(6, 78, 59)
      doc.text('PAID TO (Supplier):', 14, 70)

      doc.setTextColor(15, 23, 42)
      doc.setFontSize(12)
      doc.text(receipt.company_name || '—', 14, 77)

      if (receipt.company_gstin) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`GSTIN: ${receipt.company_gstin}`, 14, 83)
      }

      // AMOUNT BOX
      doc.setFillColor(240, 253, 244)
      doc.setDrawColor(6, 78, 59)
      doc.setLineWidth(0.5)
      doc.rect(14, 90, pw - 28, 22, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(6, 78, 59)
      doc.text('AMOUNT PAID', 18, 96)

      doc.setFontSize(20)
      doc.setTextColor(190, 18, 60)
      doc.text(`Rs. ${formatINR(receipt.payment_amount)}`, 18, 106)

      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'italic')
      doc.text(`(${amountInWords(Number(receipt.payment_amount || 0))})`, 18, 110)

      // PAYMENT DETAILS
      let y = 120
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(6, 78, 59)
      doc.text('PAYMENT DETAILS', 14, y)
      y += 5

      const modeRows: string[][] = [['Mode', modeLabel(receipt.payment_mode)]]
      const m = (receipt.payment_mode || '').toLowerCase()

      if (m === 'bank' || m === 'upi') {
        if (receipt.reference_number) {
          modeRows.push([
            m === 'upi' ? 'UPI Transaction ID' : 'UTR / Ref No',
            receipt.reference_number,
          ])
        }
      } else if (m === 'cheque') {
        if (receipt.cheque_number) modeRows.push(['Cheque No', receipt.cheque_number])
        if (receipt.cheque_bank_name) modeRows.push(['Drawn On', receipt.cheque_bank_name])
      } else if (m === 'cash') {
        if (receipt.cash_recipient_name) {
          modeRows.push(['Cash Paid To', receipt.cash_recipient_name])
        }
      }

      autoTable(doc, {
        startY: y,
        body: modeRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 45 },
          1: { textColor: [15, 23, 42] },
        },
        margin: { left: 14, right: 14 },
      })

      y = getAutoTableFinalY(doc, y) + 6

      // PAYMENT FROM
      if (receipt.bank_name_snapshot) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(6, 78, 59)
        doc.text('PAYMENT FROM', 14, y)
        y += 5

        const bankRows: string[][] = [
          ['Bank', receipt.bank_name_snapshot],
          ['A/C Name', receipt.account_name_snapshot || '—'],
          ['A/C No', receipt.account_number_snapshot || '—'],
          ['IFSC', receipt.ifsc_snapshot || '—'],
        ]
        if (receipt.branch_snapshot) bankRows.push(['Branch', receipt.branch_snapshot])
        if (receipt.upi_id_snapshot) bankRows.push(['UPI ID', receipt.upi_id_snapshot])

        autoTable(doc, {
          startY: y,
          body: bankRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: {
              fontStyle: 'bold',
              fillColor: [240, 253, 244],
              textColor: [6, 78, 59],
              cellWidth: 40,
            },
            1: { textColor: [15, 23, 42] },
          },
          margin: { left: 14, right: 14 },
        })

        y = getAutoTableFinalY(doc, y) + 6
      }

      if (receipt.notes) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        doc.text('Notes:', 14, y)
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(receipt.notes, pw - 50)
        doc.text(noteLines, 30, y)
        y += Math.max(8, noteLines.length * 4)
      }

      // Signature
      const sigY = 250
      doc.setDrawColor(100, 116, 139)
      doc.setLineWidth(0.3)
      doc.line(pw - 70, sigY, pw - 20, sigY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text('Authorized Signatory', pw - 45, sigY + 4, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.text('For Satguru Beej Bhandar', pw - 45, sigY + 8, { align: 'center' })

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text(
        'This is a computer-generated payment acknowledgement. Not a negotiable instrument.',
        pw / 2,
        275,
        { align: 'center' }
      )

      const filename = `Satguru_Payment_Receipt_${sanitizeFilename(receipt.payment_number)}.pdf`
      doc.save(filename)
      toast.success('PDF downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('PDF failed: ' + msg, { id: toastId })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-10 text-center">
          <Loader2 className="animate-spin text-emerald-700 mx-auto" size={32} />
          <p className="text-xs mt-3 font-bold">Loading receipt...</p>
        </div>
      </div>
    )
  }

  if (!receipt) return null

  const mode = (receipt.payment_mode || '').toLowerCase()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #print-receipt, #print-receipt * { visibility: visible; }
          #print-receipt { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl my-4">
        <div className="no-print sticky top-0 bg-white/95 backdrop-blur border-b px-5 py-3 flex justify-between items-center rounded-t-3xl z-10">
          <h3 className="font-black text-sm text-emerald-900 flex items-center gap-2">
            <ShieldCheck size={16} /> Payment Receipt Preview
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPDF()}
              disabled={generating}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Printer size={13} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div id="print-receipt" className="p-6 sm:p-8">
          <div className="border-4 border-double border-emerald-800 rounded-lg p-5 relative bg-gradient-to-br from-emerald-50/30 to-amber-50/20">
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-emerald-800 opacity-40" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-emerald-800 opacity-40" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-emerald-800 opacity-40" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-emerald-800 opacity-40" />

            <div className="text-center border-b-2 border-emerald-800 pb-3 mb-4">
              <h1 className="text-2xl font-black text-emerald-900 tracking-wide">
                SATGURU BEEJ BHANDAR
              </h1>
              <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                Agricultural Seeds & Crop Protection Supplier
              </p>
              <div className="mt-3 inline-block bg-emerald-800 text-white px-6 py-1.5 rounded font-black text-sm tracking-widest">
                SUPPLIER PAYMENT RECEIPT
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4 pb-3 border-b border-slate-300">
              <div>
                <span className="text-slate-500 font-bold">Receipt No:</span>
                <p className="font-mono font-black text-emerald-900">{receipt.payment_number}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-bold">Payment Date:</span>
                <p className="font-mono font-black">{formatDate(receipt.payment_date)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Recorded: {formatDateTime(receipt.created_at)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                PAID TO (Supplier)
              </p>
              <p className="text-lg font-black text-slate-900">{receipt.company_name}</p>
              {receipt.company_gstin && (
                <p className="text-xs font-mono text-slate-600">GSTIN: {receipt.company_gstin}</p>
              )}
            </div>

            <div className="bg-emerald-50 border-2 border-emerald-800 rounded-lg p-4 mb-4">
              <p className="text-[10px] font-black text-emerald-800 uppercase">Amount Paid</p>
              <p className="text-3xl font-black text-rose-700 font-mono mt-1">
                ₹{formatINR(receipt.payment_amount)}
              </p>
              <p className="text-[10px] italic text-slate-600 mt-1">
                {amountInWords(Number(receipt.payment_amount || 0))}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-2">
                Payment Details
              </p>
              <div className="bg-white border border-slate-300 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600 flex items-center gap-1.5">
                    <ModeIcon mode={receipt.payment_mode} size={12} /> Mode:
                  </span>
                  <span className="font-black">{modeLabel(receipt.payment_mode)}</span>
                </div>

                {(mode === 'bank' || mode === 'upi') && receipt.reference_number && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">
                      {mode === 'upi' ? 'UPI Transaction ID:' : 'UTR / Reference:'}
                    </span>
                    <span className="font-mono font-black">{receipt.reference_number}</span>
                  </div>
                )}

                {mode === 'cheque' && (
                  <>
                    {receipt.cheque_number && (
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-600">Cheque No:</span>
                        <span className="font-mono font-black">{receipt.cheque_number}</span>
                      </div>
                    )}
                    {receipt.cheque_bank_name && (
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-600">Drawn On:</span>
                        <span className="font-black">{receipt.cheque_bank_name}</span>
                      </div>
                    )}
                  </>
                )}

                {mode === 'cash' && receipt.cash_recipient_name && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Cash Paid To:</span>
                    <span className="font-black">{receipt.cash_recipient_name}</span>
                  </div>
                )}
              </div>
            </div>

            {mode === 'cash' && photoUrl && (
              <div className="mb-4">
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-2">
                  Recipient Photo
                </p>
                <img
                  src={photoUrl}
                  alt="Cash Recipient"
                  className="w-32 h-32 object-cover rounded-lg border-2 border-emerald-300 shadow-sm"
                />
              </div>
            )}

            {receipt.bank_name_snapshot && (
              <div className="mb-4">
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Landmark size={11} /> Payment From
                </p>
                <div className="bg-white border border-slate-300 rounded-lg p-3 space-y-1 text-xs">
                  <div className="font-black text-slate-900">Satguru Beej Bhandar</div>
                  <div className="grid grid-cols-2 gap-y-1 mt-2 text-[11px]">
                    <span className="text-slate-500">Bank:</span>
                    <span className="font-bold">{receipt.bank_name_snapshot}</span>
                    <span className="text-slate-500">A/C Name:</span>
                    <span className="font-bold">{receipt.account_name_snapshot}</span>
                    <span className="text-slate-500">A/C No:</span>
                    <span className="font-mono font-bold">{receipt.account_number_snapshot}</span>
                    <span className="text-slate-500">IFSC:</span>
                    <span className="font-mono font-bold">{receipt.ifsc_snapshot}</span>
                    {receipt.branch_snapshot && (
                      <>
                        <span className="text-slate-500">Branch:</span>
                        <span>{receipt.branch_snapshot}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {receipt.notes && (
              <div className="mb-4 text-xs">
                <span className="font-bold text-slate-600">Notes: </span>
                <span className="text-slate-800">{receipt.notes}</span>
              </div>
            )}

            <div className="mt-8 flex justify-between items-end">
              <div className="text-[10px] text-slate-500">
                <p>This is a computer-generated payment</p>
                <p>acknowledgement. Not a negotiable instrument.</p>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-slate-800 w-40 pt-1">
                  <p className="text-[10px] font-black">Authorized Signatory</p>
                  <p className="text-[9px] text-slate-600">For Satguru Beej Bhandar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}