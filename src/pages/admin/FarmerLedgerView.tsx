// src/pages/admin/FarmerLedgerView.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FC,
} from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { round2 as roundMoney, safeNum as parseMoney } from '../../lib/round'
import {
  FileText,
  Search,
  Printer,
  Share2,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  User,
  Download,
  RotateCcw,
  TrendingUp,
  Gift,
  Camera,
  Eye,
  X,
  ExternalLink,
  Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Farmer {
  id: string
  farmer_id: string
  farmer_name: string
  father_name: string | null
  mobile: string | null
  village: string | null
  tehsil?: string | null
  district?: string | null
  credit_limit: number | string | null
  outstanding_balance?: number | string | null
  opening_balance?: number | string | null
  opening_balance_date?: string | null
  account_status?: string | null
  photo_url?: string | null
}

type VoucherType =
  | 'OPENING'
  | 'UDHAAR_BILL'
  | 'PAYMENT'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'OTHER'

interface LedgerEntry {
  id: string
  date: string
  voucher_type: VoucherType
  voucher_no: string
  particulars: string
  debit: number
  credit: number
  balance: number
  raw_timestamp?: string
  affects_outstanding: boolean
  is_physical?: boolean
  file_path?: string | null
  file_type?: string | null
  file_name?: string | null
}

interface BillItemRow {
  id: string
  product_name: string | null
  batch_number: string | null
  quantity: number
  unit_name: string | null
  rate: number
  total_amount: number
  expiry_date?: string | null
}

interface BillDetail {
  id: string
  bill_number: string
  bill_date: string
  bill_type: 'udhaar' | 'cash' | string
  total_amount: number
  total_items: number
  items: BillItemRow[]
  is_physical?: boolean
  file_path?: string | null
  file_type?: string | null
  file_name?: string | null
  notes?: string | null
  doc_type?: 'estimate' | 'gst' | string
}

interface PaymentDetail {
  id: string
  payment_number: string
  payment_date: string
  payment_mode: string
  payment_amount: number
  reference_number: string | null
  notes: string | null
}

interface SalesBillRow {
  id: string
  bill_number: string
  bill_date: string
  bill_type: string
  bill_status: string
  total_amount: number | string
  total_items?: number | string | null
  created_at?: string
}

interface PhysicalBillRow {
  id: string
  bill_number: string
  bill_date: string
  bill_type: 'estimate' | 'gst' | string
  transaction_type: 'udhaar' | 'cash' | string
  bill_amount: number | string
  notes: string | null
  file_path: string | null
  file_name: string | null
  file_type: string | null
  status: string
  created_at: string
}

interface PaymentRow {
  id: string
  payment_number: string
  payment_mode: string
  payment_amount: number | string
  reference_number: string | null
  payment_date: string
  created_at: string
  notes: string | null
}

interface ReturnRow {
  id: string
  return_number: string
  return_date: string
  total_amount: number | string
  return_status: string
  original_bill_id: string | null
  reason: string | null
  created_at: string
}

interface InterestRow {
  id: string
  interest_amount: number | string
  calculation_date: string
  created_at: string
  notes: string | null
}

interface CashbackRow {
  id: string
  cashback_released: number | string
  released_date: string
  created_at: string
  notes: string | null
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  return parseMoney(val)
}

function round2(val: number): number {
  return roundMoney(val)
}

function formatINR(val: number | string | null | undefined): string {
  return safeNum(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '-'
  const parts = dStr.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dStr
}

function getFinancialYearDates(): { start: string; end: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  let startYear = currentYear
  if (currentMonth < 3) {
    startYear = currentYear - 1
  }
  const endYear = startYear + 1
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  }
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0'))
    return `91${digits.slice(1)}`
  return digits.length >= 10 ? digits : null
}

function sanitizeWhatsAppString(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/[\u2014\u2013\u2010]/g, '-')
    .replace(/[\u2022\u25CF\u25CB]/g, '-')
    .replace(/₹/g, 'Rs. ')
    .replace(/[^\x00-\x7F\s.,():/\-[\]]/g, '')
    .trim()
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'Farmer'
  )
}

function nowDisplayString(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mn}`
}

function safeText(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim() || '-'
}

/** 
 * Extracted Storage Path from URL
 */
function getPhotoPath(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  try {
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  } catch {
    return url.slice(idx + marker.length).split('?')[0]
  }
}

/** 
 * PRODUCTION-SAFE Photo Loader for PDF (Bypasses Tainted Canvas / CORS on Netlify)
 */
async function fetchImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  try {
    const bucketNames = ['farmer-photos', 'FARMER-PHOTOS']
    let blob: Blob | null = null

    // Attempt 1: SDK Download
    for (const b of bucketNames) {
      const path = getPhotoPath(url, b)
      if (path) {
        const { data, error } = await supabase.storage.from(b).download(path)
        if (!error && data) {
          blob = data
          break
        }
      }
    }

    // Attempt 2: Direct Fetch Fallback
    if (!blob) {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) return null
      blob = await res.blob()
    }

    // Convert Blob to Base64 using FileReader
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob!)
    })
  } catch (err) {
    console.warn('[PDF Photo] Failed to load image:', err)
    return null
  }
}

/**
 * Build PREMIUM Farmer Ledger PDF using jsPDF + autoTable (English Only)
 */
async function buildLedgerPdfDoc(params: {
  farmer: Farmer
  startDate: string
  endDate: string
  openingBalance: number
  ledgerEntries: LedgerEntry[]
  attachedPayments: PaymentDetail[]
  udhaarBillsList: BillDetail[]
  photoDataUrl?: string | null
  totals: {
    totalUdhaarSales: number
    totalPayments: number
    totalReturns: number
    totalInterest: number
    totalCashback: number
    closingBalance: number
  }
}): Promise<jsPDF> {
  const {
    farmer,
    startDate,
    endDate,
    openingBalance,
    ledgerEntries,
    attachedPayments,
    udhaarBillsList,
    photoDataUrl,
    totals,
  } = params

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoDoc = doc as any

  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mL = 10
  const mR = 10
  const contentW = pw - mL - mR
  const generated = nowDisplayString()

  // ── Colour Palette ──
  const cPrimary: [number, number, number] = [6, 78, 59]
  const cDark: [number, number, number] = [15, 23, 42]
  const cMuted: [number, number, number] = [100, 116, 139]
  const cRed: [number, number, number] = [190, 18, 60]
  const cGreen: [number, number, number] = [4, 120, 87]
  const cAmber: [number, number, number] = [120, 53, 15]
  const cPurple: [number, number, number] = [88, 28, 135]
  const cWhite: [number, number, number] = [255, 255, 255]
  const cLine: [number, number, number] = [203, 213, 225]
  const cBgLight: [number, number, number] = [248, 250, 252]
  const cBgGreen: [number, number, number] = [240, 253, 244]
  const cBgAmber: [number, number, number] = [254, 243, 199]
  const cBgRose: [number, number, number] = [255, 241, 242]
  const cBgGreenDark: [number, number, number] = [220, 252, 231]
  const cBgPurple: [number, number, number] = [250, 245, 255]
  const cRoseDeep: [number, number, number] = [136, 19, 55]

  const addFooter = () => {
    const pageCount = typeof (doc as any).getNumberOfPages === 'function' ? (doc as any).getNumberOfPages() : 1
    const cp = autoDoc.getCurrentPageInfo ? autoDoc.getCurrentPageInfo().pageNumber : pageCount
    doc.setDrawColor(cLine[0], cLine[1], cLine[2])
    doc.setLineWidth(0.3)
    doc.line(mL, ph - 12, pw - mR, ph - 12)
    doc.setFontSize(7)
    doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
    doc.setFont('helvetica', 'italic')
    doc.text('Satguru Beej Bhandar - Farmer Khata Statement (Computer Generated)', mL, ph - 8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${generated}`, mL, ph - 5)
    doc.text(`Page ${cp} of ${pageCount}`, pw - mR, ph - 5, { align: 'right' })
  }

  const ensureSpace = (needed: number): number => {
    const currentY: number = autoDoc.lastAutoTable?.finalY ?? 60
    if (currentY + needed > ph - 25) {
      doc.addPage()
      return 18
    }
    return currentY + 10
  }

  // ══════════════════════════════════════════════════════════════════
  // HEADER BANNER
  // ══════════════════════════════════════════════════════════════════
  doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.rect(0, 0, pw, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(cWhite[0], cWhite[1], cWhite[2])
  doc.text('SATGURU BEEJ BHANDAR', pw / 2, 11, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(167, 243, 208)
  doc.text('Daloosar, Sardarshahar (Churu), Rajasthan', pw / 2, 17, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(253, 230, 138)
  doc.text('FARMER ACCOUNT LEDGER STATEMENT', pw / 2, 24, { align: 'center' })

  // ══════════════════════════════════════════════════════════════════
  // FARMER DETAILS BOX (WITH PHOTO)
  // ══════════════════════════════════════════════════════════════════
  const fdY = 32
  const photoSize = 26
  const photoX = mL + 3
  const photoY = fdY + 3

  doc.setDrawColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.setLineWidth(0.6)
  doc.setFillColor(cBgLight[0], cBgLight[1], cBgLight[2])
  doc.roundedRect(mL, fdY, contentW, 32, 2, 2, 'FD')

  const drawPhotoPlaceholder = () => {
    doc.setFillColor(236, 253, 245)
    doc.setDrawColor(cPrimary[0], cPrimary[1], cPrimary[2])
    doc.setLineWidth(0.5)
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(18)
    doc.setTextColor(cPrimary[0], cPrimary[1], cPrimary[2])
    const letter = (safeText(farmer.farmer_name).charAt(0) || '?').toUpperCase()
    doc.text(
      letter,
      photoX + photoSize / 2,
      photoY + photoSize / 2 + 3,
      { align: 'center' }
    )
  }

  if (photoDataUrl) {
    try {
      doc.setFillColor(cWhite[0], cWhite[1], cWhite[2])
      doc.setDrawColor(cPrimary[0], cPrimary[1], cPrimary[2])
      doc.setLineWidth(0.5)
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'FD')
      doc.addImage(photoDataUrl, 'JPEG', photoX + 1, photoY + 1, photoSize - 2, photoSize - 2, undefined, 'FAST')
    } catch {
      drawPhotoPlaceholder()
    }
  } else {
    drawPhotoPlaceholder()
  }

  doc.setFontSize(8)
  const lCol = mL + photoSize + 8
  const rCol = pw / 2 + 10
  const lValOffset = 26
  const rValOffset = 24

  const farmerFields = [
    { label: 'Farmer Name:', value: safeText(farmer.farmer_name) },
    { label: 'Farmer ID:', value: safeText(farmer.farmer_id) },
    { label: 'S/O:', value: safeText(farmer.father_name) },
    { label: 'Village:', value: safeText(farmer.village) },
  ]

  farmerFields.forEach((f, i) => {
    const y = fdY + 7 + i * 6.8
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
    doc.text(f.label, lCol, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(cDark[0], cDark[1], cDark[2])
    doc.text(String(f.value).slice(0, 26), lCol + lValOffset, y)
  })

  const rightFields = [
    { label: 'Mobile:', value: safeText(farmer.mobile) },
    { label: 'Tehsil:', value: safeText(farmer.tehsil) },
    { label: 'Credit Limit:', value: `Rs. ${formatINR(farmer.credit_limit)}` },
    { label: 'Period:', value: `${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}` },
  ]

  rightFields.forEach((f, i) => {
    const y = fdY + 7 + i * 6.8
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
    doc.text(f.label, rCol, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(cDark[0], cDark[1], cDark[2])
    doc.text(String(f.value), rCol + rValOffset, y)
  })

  // ══════════════════════════════════════════════════════════════════
  // ACCOUNT SUMMARY BOX
  // ══════════════════════════════════════════════════════════════════
  const sumY = fdY + 36
  doc.setFillColor(cBgGreen[0], cBgGreen[1], cBgGreen[2])
  doc.setDrawColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.setLineWidth(0.5)
  doc.roundedRect(mL, sumY, contentW, 36, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.text('ACCOUNT SUMMARY', mL + 4, sumY + 6)

  doc.setDrawColor(cLine[0], cLine[1], cLine[2])
  doc.setLineWidth(0.2)
  doc.line(mL + 2, sumY + 8, pw - mR - 2, sumY + 8)

  const s1X = mL + 4
  const s2X = mL + 4 + contentW / 3
  const s3X = mL + 4 + (contentW * 2) / 3

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
  doc.text('Opening Balance', s1X, sumY + 14)
  doc.text('Udhaar Sales (+)', s2X, sumY + 14)
  doc.text('Interest Charged (+)', s3X, sumY + 14)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(cAmber[0], cAmber[1], cAmber[2])
  doc.text(`Rs. ${formatINR(openingBalance)}`, s1X, sumY + 18.5)
  doc.setTextColor(cRed[0], cRed[1], cRed[2])
  doc.text(`Rs. ${formatINR(totals.totalUdhaarSales)}`, s2X, sumY + 18.5)
  doc.setTextColor(180, 83, 9)
  doc.text(`Rs. ${formatINR(totals.totalInterest)}`, s3X, sumY + 18.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
  doc.text('Payments Received (-)', s1X, sumY + 24.5)
  doc.text('Returns (-)', s2X, sumY + 24.5)
  doc.text('Cashback Released (-)', s3X, sumY + 24.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(cGreen[0], cGreen[1], cGreen[2])
  doc.text(`Rs. ${formatINR(totals.totalPayments)}`, s1X, sumY + 29)
  doc.setTextColor(cPurple[0], cPurple[1], cPurple[2])
  doc.text(`Rs. ${formatINR(totals.totalReturns)}`, s2X, sumY + 29)
  doc.setTextColor(15, 118, 110)
  doc.text(`Rs. ${formatINR(totals.totalCashback)}`, s3X, sumY + 29)

  doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.rect(mL, sumY + 31, contentW, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(cWhite[0], cWhite[1], cWhite[2])
  doc.text('CLOSING OUTSTANDING DUE:', mL + 4, sumY + 34.6)
  doc.setFontSize(10)
  doc.text(
    `Rs. ${formatINR(totals.closingBalance)} ${totals.closingBalance >= 0 ? 'Dr' : 'Cr'}`,
    pw - mR - 4,
    sumY + 34.7,
    { align: 'right' }
  )

  // ══════════════════════════════════════════════════════════════════
  // LEDGER TABLE
  // ══════════════════════════════════════════════════════════════════
  const ledgerStartY = sumY + 44

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.text('TRANSACTION LEDGER', mL, ledgerStartY - 3)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
  doc.text(
    `Period: ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}  |  Entries: ${ledgerEntries.length}`,
    pw - mR,
    ledgerStartY - 3,
    { align: 'right' }
  )

  const ledgerHead = [[
    'Date', 'Type', 'Voucher No', 
    'Particulars', 
    'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)'
  ]]
  const ledgerBody: string[][] = []

  ledgerBody.push([
    formatDateDisplay(startDate),
    'OPENING',
    '-',
    '*** Opening Balance B/F ***',
    openingBalance > 0 ? formatINR(openingBalance) : '-',
    openingBalance < 0 ? formatINR(Math.abs(openingBalance)) : '-',
    `${formatINR(openingBalance)} ${openingBalance >= 0 ? 'Dr' : 'Cr'}`,
  ])

  if (ledgerEntries.length === 0) {
    ledgerBody.push([
      '-', '-', '-', 
      'No transactions in this period',
      '-', '-', '-'
    ])
  } else {
    for (const ev of ledgerEntries) {
      let typeBadge = ''
      switch (ev.voucher_type) {
        case 'UDHAAR_BILL': typeBadge = ev.is_physical ? 'PHY-BILL' : 'UDHAAR'; break
        case 'PAYMENT': typeBadge = 'PAYMENT'; break
        case 'RETURN': typeBadge = 'RETURN'; break
        case 'ADJUSTMENT': typeBadge = ev.voucher_no === 'INT' ? 'INTEREST' : ev.voucher_no === 'CSH' ? 'CASHBACK' : 'ADJ'; break
        default: typeBadge = String(ev.voucher_type)
      }

      ledgerBody.push([
        formatDateDisplay(ev.date),
        typeBadge,
        safeText(ev.voucher_no),
        safeText(ev.particulars),
        ev.debit > 0 ? formatINR(ev.debit) : '-',
        ev.credit > 0 ? formatINR(ev.credit) : '-',
        ev.affects_outstanding
          ? `${formatINR(ev.balance)} ${ev.balance >= 0 ? 'Dr' : 'Cr'}`
          : '- separate -',
      ])
    }
  }

  ledgerBody.push([
    '',
    '',
    '',
    `PERIOD TOTALS (${ledgerEntries.length} entries)`,
    formatINR(totals.totalUdhaarSales + totals.totalInterest),
    formatINR(totals.totalPayments + totals.totalReturns + totals.totalCashback),
    `${formatINR(totals.closingBalance)} ${totals.closingBalance >= 0 ? 'Dr' : 'Cr'}`,
  ])

  const ledgerLastIdx = ledgerBody.length - 1

  autoTable(doc, {
    startY: ledgerStartY,
    head: ledgerHead,
    body: ledgerBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      overflow: 'linebreak',
      textColor: cDark,
      lineColor: cLine,
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: cPrimary,
      textColor: cWhite,
      fontStyle: 'bold',
      font: 'helvetica',
      fontSize: 7,
      halign: 'center',
      cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 17, halign: 'center', fontSize: 6.3 },
      2: { cellWidth: 20, halign: 'center', fontSize: 6.3 },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 22, halign: 'right', textColor: cRed },
      5: { cellWidth: 22, halign: 'right', textColor: cGreen },
      6: { cellWidth: 26, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.fillColor = cBgAmber
        data.cell.styles.textColor = cAmber
      }
      if (data.section === 'body' && data.row.index === ledgerLastIdx) {
        data.cell.styles.fillColor = cBgGreenDark
        data.cell.styles.textColor = cPrimary
        data.cell.styles.fontSize = 7.5
      }
    },
    margin: { top: 16, left: mL, right: mR, bottom: 18 },
    showHead: 'everyPage',
    didDrawPage: addFooter,
  })

  // ══════════════════════════════════════════════════════════════════
  // UDHAAR BILLS SECTION
  // ══════════════════════════════════════════════════════════════════
  if (udhaarBillsList.length > 0) {
    let billSectionY = ensureSpace(34)

    doc.setFillColor(cRoseDeep[0], cRoseDeep[1], cRoseDeep[2])
    doc.roundedRect(mL, billSectionY - 4, contentW, 10, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(cWhite[0], cWhite[1], cWhite[2])
    doc.text('UDHAAR BILLS (Digital & Physical)', mL + 4, billSectionY + 2.3)
    doc.setFontSize(8)
    doc.text(
      `${udhaarBillsList.length} Bills  |  Rs. ${formatINR(totals.totalUdhaarSales)}`,
      pw - mR - 4,
      billSectionY + 2.3,
      { align: 'right' }
    )

    billSectionY += 10

    const billsHead = [[
      '#', 'Date', 'Bill No', 'Source', 'Doc Type', 'Items', 'Amount (Rs.)', 
      'Notes'
    ]]
    const billsBody: string[][] = udhaarBillsList.map((b, idx) => [
      String(idx + 1),
      formatDateDisplay(b.bill_date),
      safeText(b.bill_number),
      b.is_physical ? 'PHYSICAL' : 'DIGITAL',
      b.is_physical ? String(b.doc_type || 'estimate').toUpperCase() : 'SYSTEM',
      b.is_physical ? '-' : String(b.total_items || b.items.length || 0),
      formatINR(b.total_amount),
      b.notes ? safeText(b.notes).slice(0, 38) : '-',
    ])

    billsBody.push(['', '', '', '', '', 'TOTAL', formatINR(totals.totalUdhaarSales), ''])
    const billsLastIdx = billsBody.length - 1

    autoTable(doc, {
      startY: billSectionY,
      head: billsHead,
      body: billsBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: cDark,
        lineColor: cLine,
        lineWidth: 0.12,
        valign: 'middle',
      },
      headStyles: {
        fillColor: cRoseDeep,
        textColor: cWhite,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 18, halign: 'center', fontSize: 6 },
        4: { cellWidth: 17, halign: 'center', fontSize: 6 },
        5: { cellWidth: 11, halign: 'center' },
        6: { cellWidth: 24, halign: 'right', textColor: cRed },
        7: { cellWidth: 'auto', fontSize: 6 },
      },
      alternateRowStyles: { fillColor: cBgRose },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === billsLastIdx) {
          data.cell.styles.fillColor = [254, 226, 226]
          data.cell.styles.textColor = cRoseDeep
          data.cell.styles.fontSize = 7.5
        }
      },
      margin: { top: 16, left: mL, right: mR, bottom: 18 },
      showHead: 'everyPage',
      didDrawPage: addFooter,
    })

    const digitalBillsWithItems = udhaarBillsList.filter((b) => !b.is_physical && b.items && b.items.length > 0)

    for (const bill of digitalBillsWithItems) {
      const itemStartY = ensureSpace(28)

      doc.setFillColor(cBgLight[0], cBgLight[1], cBgLight[2])
      doc.setDrawColor(cLine[0], cLine[1], cLine[2])
      doc.setLineWidth(0.3)
      doc.roundedRect(mL, itemStartY - 3.5, contentW, 8, 1, 1, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(cRoseDeep[0], cRoseDeep[1], cRoseDeep[2])
      doc.text(
        `Bill #${bill.bill_number}   |   Date: ${formatDateDisplay(bill.bill_date)}   |   Total: Rs. ${formatINR(bill.total_amount)}`,
        mL + 3,
        itemStartY + 1.5
      )
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
      doc.text(`${bill.items.length} item(s)`, pw - mR - 3, itemStartY + 1.5, { align: 'right' })

      const itemHead = [[
        '#', 'Product Name', 'Batch No', 'Qty', 'Unit', 'Rate (Rs.)', 'Total (Rs.)'
      ]]
      const itemBody: string[][] = bill.items.map((it, idx) => [
        String(idx + 1),
        safeText(it.product_name),
        safeText(it.batch_number),
        String(it.quantity),
        safeText(it.unit_name),
        formatINR(it.rate),
        formatINR(it.total_amount),
      ])

      itemBody.push(['', '', '', '', '', 'Bill Total:', formatINR(bill.total_amount)])
      const itemLastIdx = itemBody.length - 1

      autoTable(doc, {
        startY: itemStartY + 6.5,
        head: itemHead,
        body: itemBody,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 6.4,
          cellPadding: 1.6,
          overflow: 'linebreak',
          textColor: cDark,
          lineColor: cLine,
          lineWidth: 0.1,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [51, 65, 85],
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 6.4,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 24, halign: 'center', fontSize: 6 },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === itemLastIdx) {
            data.cell.styles.fillColor = cBgRose
            data.cell.styles.textColor = cRoseDeep
            data.cell.styles.fontSize = 7
          }
        },
        margin: { top: 16, left: mL + 2, right: mR + 2, bottom: 18 },
        didDrawPage: addFooter,
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PAYMENTS SECTION
  // ══════════════════════════════════════════════════════════════════
  if (attachedPayments.length > 0) {
    let paySectionY = ensureSpace(34)

    doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2])
    doc.roundedRect(mL, paySectionY - 4, contentW, 10, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(cWhite[0], cWhite[1], cWhite[2])
    doc.text('PAYMENTS RECEIVED', mL + 4, paySectionY + 2.3)
    doc.setFontSize(8)
    doc.text(
      `${attachedPayments.length} Payments  |  Rs. ${formatINR(totals.totalPayments)}`,
      pw - mR - 4,
      paySectionY + 2.3,
      { align: 'right' }
    )

    paySectionY += 10

    const payHead = [[
      '#', 'Date', 'Payment No', 'Mode', 'Reference', 
      'Notes', 
      'Amount (Rs.)'
    ]]
    const payBody: string[][] = attachedPayments.map((p, idx) => [
      String(idx + 1),
      formatDateDisplay(p.payment_date),
      safeText(p.payment_number),
      (p.payment_mode || 'CASH').toUpperCase(),
      safeText(p.reference_number),
      safeText(p.notes),
      formatINR(p.payment_amount),
    ])

    payBody.push(['', '', '', '', '', 'TOTAL', formatINR(totals.totalPayments)])
    const payLastIdx = payBody.length - 1

    autoTable(doc, {
      startY: paySectionY,
      head: payHead,
      body: payBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: cDark,
        lineColor: cLine,
        lineWidth: 0.12,
        valign: 'middle',
      },
      headStyles: {
        fillColor: cPrimary,
        textColor: cWhite,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 26, halign: 'center', textColor: cPrimary },
        3: { cellWidth: 18, halign: 'center', fontSize: 6.2 },
        4: { cellWidth: 26, halign: 'center', fontSize: 6 },
        5: { cellWidth: 'auto', fontSize: 6 },
        6: { cellWidth: 25, halign: 'right', textColor: cGreen },
      },
      alternateRowStyles: { fillColor: cBgGreen },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === payLastIdx) {
          data.cell.styles.fillColor = cBgGreenDark
          data.cell.styles.textColor = cPrimary
          data.cell.styles.fontSize = 7.5
        }
      },
      margin: { top: 16, left: mL, right: mR, bottom: 18 },
      showHead: 'everyPage',
      didDrawPage: addFooter,
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // RETURNS SECTION
  // ══════════════════════════════════════════════════════════════════
  const returnEntries = ledgerEntries.filter((e) => e.voucher_type === 'RETURN')
  if (returnEntries.length > 0) {
    let retSectionY = ensureSpace(34)

    doc.setFillColor(cPurple[0], cPurple[1], cPurple[2])
    doc.roundedRect(mL, retSectionY - 4, contentW, 10, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(cWhite[0], cWhite[1], cWhite[2])
    doc.text('GOODS RETURNED', mL + 4, retSectionY + 2.3)
    doc.setFontSize(8)
    doc.text(
      `${returnEntries.length} Returns  |  Rs. ${formatINR(totals.totalReturns)}`,
      pw - mR - 4,
      retSectionY + 2.3,
      { align: 'right' }
    )

    retSectionY += 10

    const retHead = [[
      '#', 'Date', 'Return No', 
      'Particulars', 
      'Amount (Rs.)'
    ]]
    const retBody: string[][] = returnEntries.map((r, idx) => [
      String(idx + 1),
      formatDateDisplay(r.date),
      safeText(r.voucher_no),
      safeText(r.particulars),
      formatINR(r.credit),
    ])

    retBody.push(['', '', '', 'TOTAL', formatINR(totals.totalReturns)])
    const retLastIdx = retBody.length - 1

    autoTable(doc, {
      startY: retSectionY,
      head: retHead,
      body: retBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: cDark,
        lineColor: cLine,
        lineWidth: 0.12,
        valign: 'middle',
      },
      headStyles: {
        fillColor: cPurple,
        textColor: cWhite,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 35, halign: 'center', textColor: cPurple },
        3: { cellWidth: 'auto', halign: 'left' },
        4: { cellWidth: 30, halign: 'right', textColor: cPurple },
      },
      alternateRowStyles: { fillColor: cBgPurple },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === retLastIdx) {
          data.cell.styles.fillColor = [243, 232, 255]
          data.cell.styles.textColor = cPurple
          data.cell.styles.fontSize = 7.5
        }
      },
      margin: { top: 16, left: mL, right: mR, bottom: 18 },
      showHead: 'everyPage',
      didDrawPage: addFooter,
    })
  }

  // ══════════════════════════════════════════════════════════════════
  // RECONCILIATION + SIGNATURE
  // ══════════════════════════════════════════════════════════════════
  let signY = ensureSpace(56)

  doc.setFillColor(cBgLight[0], cBgLight[1], cBgLight[2])
  doc.setDrawColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(mL, signY, contentW, 24, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(cPrimary[0], cPrimary[1], cPrimary[2])
  doc.text('RECONCILIATION', mL + 4, signY + 5.5)

  doc.setFont('courier', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(cDark[0], cDark[1], cDark[2])
  doc.text(`Opening Balance      : Rs. ${formatINR(openingBalance)}`, mL + 4, signY + 11)
  doc.text(
    `(+) Udhaar Sales     : Rs. ${formatINR(totals.totalUdhaarSales)}      (+) Interest : Rs. ${formatINR(totals.totalInterest)}`,
    mL + 4,
    signY + 15
  )
  doc.text(
    `(-) Payments         : Rs. ${formatINR(totals.totalPayments)}      (-) Returns  : Rs. ${formatINR(totals.totalReturns)}      (-) Cashback : Rs. ${formatINR(totals.totalCashback)}`,
    mL + 4,
    signY + 19
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(cRed[0], cRed[1], cRed[2])
  doc.text(
    `CLOSING DUE: Rs. ${formatINR(totals.closingBalance)} ${totals.closingBalance >= 0 ? 'Dr' : 'Cr'}`,
    pw - mR - 4,
    signY + 6,
    { align: 'right' }
  )

  signY += 34

  if (signY > ph - 32) {
    doc.addPage()
    signY = 22
  }

  doc.setDrawColor(cLine[0], cLine[1], cLine[2])
  doc.setLineWidth(0.2)
  doc.line(mL, signY, pw - mR, signY)

  signY += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(cDark[0], cDark[1], cDark[2])
  doc.text('Farmer Signature / Thumb', mL, signY)
  doc.text('For: Satguru Beej Bhandar', pw - mR, signY, { align: 'right' })

  signY += 14

  doc.setDrawColor(cDark[0], cDark[1], cDark[2])
  doc.setLineWidth(0.3)
  doc.line(mL, signY, mL + 58, signY)
  doc.line(pw - mR - 58, signY, pw - mR, signY)

  signY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
  doc.text(String(safeText(farmer.farmer_name)), mL, signY)
  doc.setFont('helvetica', 'normal')
  doc.text('Authorised Signatory', pw - mR, signY, { align: 'right' })

  signY += 6

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.3)
  doc.setTextColor(cMuted[0], cMuted[1], cMuted[2])
  doc.text(
    'This is a computer-generated account statement. Please retain a signed copy as proof of settlement.',
    pw / 2,
    signY,
    { align: 'center' }
  )

  addFooter()
  return doc
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const FarmerLedgerView: FC = () => {
  const { role, loading: authLoading } = useAuth()

  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('')
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)

  const [loadingFarmers, setLoadingFarmers] = useState<boolean>(true)
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState<boolean>(false)

  const defaultFY = useMemo(() => getFinancialYearDates(), [])
  const [startDate, setStartDate] = useState<string>(defaultFY.start)
  const [endDate, setEndDate] = useState<string>(defaultFY.end)

  const [openingBalance, setOpeningBalance] = useState<number>(0)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [attachedBills, setAttachedBills] = useState<BillDetail[]>([])
  const [attachedPayments, setAttachedPayments] = useState<PaymentDetail[]>([])

  const [totalUdhaarSales, setTotalUdhaarSales] = useState<number>(0)
  const [totalPayments, setTotalPayments] = useState<number>(0)
  const [totalReturns, setTotalReturns] = useState<number>(0)
  const [totalInterest, setTotalInterest] = useState<number>(0)
  const [totalCashback, setTotalCashback] = useState<number>(0)

  const [searchQuery, setSearchQuery] = useState<string>('')
  const isMountedRef = useRef<boolean>(true)

  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)
  const [previewDocType, setPreviewDocType] = useState<string>('image')
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('')
  const [loadingDocPreview, setLoadingDocPreview] = useState<boolean>(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadFarmers = useCallback(async () => {
    if (role !== 'admin') return
    try {
      setLoadingFarmers(true)
      const { data, error } = await supabase
        .from('farmers')
        .select(
          'id, farmer_id, farmer_name, father_name, mobile, village, tehsil, district, credit_limit, outstanding_balance, opening_balance, opening_balance_date, account_status, photo_url'
        )
        .order('farmer_name', { ascending: true })

      if (error) throw error
      if (isMountedRef.current) {
        setFarmers((data as Farmer[]) || [])
      }
    } catch (err: unknown) {
      console.error('loadFarmers failed:', err)
      if (isMountedRef.current) toast.error('Error loading farmers list')
    } finally {
      if (isMountedRef.current) setLoadingFarmers(false)
    }
  }, [role])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') return
    void loadFarmers()
  }, [loadFarmers, role, authLoading])

  const handleViewAttachment = async (
    filePath: string | null | undefined,
    fileType: string | null | undefined,
    billNo: string
  ) => {
    if (!filePath) {
      toast.error('No document/photo attached to this bill.')
      return
    }
    try {
      setLoadingDocPreview(true)
      setPreviewDocTitle(`Physical Bill #${billNo}`)
      setPreviewDocType(fileType?.includes('pdf') ? 'pdf' : 'image')
      setPreviewDocUrl(null)
      setPreviewModalOpen(true)
      const { data, error } = await supabase.storage
        .from('physical-bills')
        .createSignedUrl(filePath, 3600)
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Signed URL generation failed')
      }
      if (isMountedRef.current) {
        setPreviewDocUrl(data.signedUrl)
      }
    } catch (err: unknown) {
      console.error('Failed to load attachment:', err)
      const msg = err instanceof Error ? err.message : 'Error'
      toast.error('Failed to open document: ' + msg)
      if (isMountedRef.current) setPreviewModalOpen(false)
    } finally {
      if (isMountedRef.current) setLoadingDocPreview(false)
    }
  }

  const fetchFarmerLedger = useCallback(
    async (farmerId: string, sDate: string, eDate: string) => {
      if (!farmerId) return
      setLoadingLedger(true)

      try {
        const { data: farmerData } = await supabase
          .from('farmers')
          .select('*')
          .eq('id', farmerId)
          .single()

        let initialOpeningBal = 0

        if (farmerData) {
          const fObj = farmerData as Farmer
          initialOpeningBal = safeNum(fObj.opening_balance)
          if (isMountedRef.current) setSelectedFarmer(fObj)

          const obDateStr = fObj.opening_balance_date
          if (obDateStr && sDate && obDateStr > sDate) {
            console.warn(`Farmer OB Date (${obDateStr}) is after selected Start Date (${sDate})`)
          }
        }

        const [
          billsRes,
          physicalBillsRes,
          paymentsRes,
          returnsRes,
          interestRes,
          cashbackRes,
        ] = await Promise.all([
          supabase
            .from('sales_bills')
            .select('id, bill_number, bill_date, bill_type, bill_status, total_amount, total_items, created_at')
            .eq('farmer_id', farmerId)
            .eq('bill_status', 'active')
            .eq('bill_type', 'udhaar')
            .order('bill_date', { ascending: true }),
          supabase
            .from('physical_bills')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('status', 'active')
            .eq('transaction_type', 'udhaar')
            .order('bill_date', { ascending: true }),
          supabase
            .from('payments')
            .select('id, payment_number, payment_mode, payment_amount, reference_number, payment_date, created_at, notes')
            .eq('farmer_id', farmerId)
            .order('payment_date', { ascending: true }),
          supabase
            .from('returns')
            .select('id, return_number, return_date, total_amount, return_status, original_bill_id, reason, created_at')
            .eq('farmer_id', farmerId)
            .in('return_status', ['approved', 'completed'])
            .order('return_date', { ascending: true }),
          supabase
            .from('interest_records')
            .select('id, interest_amount, calculation_date, created_at, notes')
            .eq('farmer_id', farmerId)
            .eq('is_applied', true)
            .order('calculation_date', { ascending: true }),
          supabase
            .from('cashback_records')
            .select('id, cashback_released, released_date, created_at, notes')
            .eq('farmer_id', farmerId)
            .gt('cashback_released', 0)
            .order('released_date', { ascending: true }),
        ])

        const rawBills = (billsRes.data as SalesBillRow[]) || []
        const rawPhysicalBills = (physicalBillsRes.data as PhysicalBillRow[]) || []
        const rawPayments = (paymentsRes.data as PaymentRow[]) || []
        const rawReturns = (returnsRes.data as ReturnRow[]) || []
        const rawInterest = (interestRes.data as InterestRow[]) || []
        const rawCashback = (cashbackRes.data as CashbackRow[]) || []

        const billIds = rawBills.map((b) => b.id)
        const billItemsMap: Record<string, BillItemRow[]> = {}

        if (billIds.length > 0) {
          const { data: itemsData } = await supabase
            .from('sales_bill_items')
            .select('id, sales_bill_id, product_name, batch_number, quantity, unit_name, rate, total_amount, expiry_date')
            .in('sales_bill_id', billIds)

          if (itemsData) {
            for (const it of itemsData as (BillItemRow & { sales_bill_id: string })[]) {
              const k = it.sales_bill_id
              if (!billItemsMap[k]) billItemsMap[k] = []
              billItemsMap[k].push({
                id: it.id,
                product_name: it.product_name,
                batch_number: it.batch_number,
                quantity: safeNum(it.quantity),
                unit_name: it.unit_name,
                rate: safeNum(it.rate),
                total_amount: safeNum(it.total_amount),
                expiry_date: it.expiry_date,
              })
            }
          }
        }

        interface RawEvent {
          id: string
          date: string
          raw_timestamp: string
          voucher_type: VoucherType
          voucher_no: string
          particulars: string
          debit: number
          credit: number
          affects_outstanding: boolean
          is_physical?: boolean
          file_path?: string | null
          file_type?: string | null
          file_name?: string | null
        }

        const allEvents: RawEvent[] = []

        for (const b of rawBills) {
          allEvents.push({
            id: b.id,
            date: b.bill_date || (b.created_at ? b.created_at.split('T')[0] : ''),
            raw_timestamp: b.created_at || b.bill_date || '',
            voucher_type: 'UDHAAR_BILL',
            voucher_no: b.bill_number || 'BILL',
            particulars: 'Udhaar Sale',
            debit: safeNum(b.total_amount),
            credit: 0,
            affects_outstanding: true,
            is_physical: false,
          })
        }

        for (const pb of rawPhysicalBills) {
          allEvents.push({
            id: pb.id,
            date: pb.bill_date || (pb.created_at ? pb.created_at.split('T')[0] : ''),
            raw_timestamp: pb.created_at || pb.bill_date || '',
            voucher_type: 'UDHAAR_BILL',
            voucher_no: pb.bill_number || 'PHYSICAL',
            particulars: `Physical Bill #${pb.bill_number}${pb.notes ? ' - ' + pb.notes : ''}`,
            debit: safeNum(pb.bill_amount),
            credit: 0,
            affects_outstanding: true,
            is_physical: true,
            file_path: pb.file_path,
            file_type: pb.file_type,
            file_name: pb.file_name,
          })
        }

        for (const p of rawPayments) {
          const modeLabel = (p.payment_mode || 'Cash').toUpperCase()
          const refStr = p.reference_number ? ` (Ref: ${p.reference_number})` : ''
          allEvents.push({
            id: p.id,
            date: p.payment_date || (p.created_at ? p.created_at.split('T')[0] : ''),
            raw_timestamp: p.created_at || p.payment_date || '',
            voucher_type: 'PAYMENT',
            voucher_no: p.payment_number || 'PAY',
            particulars: `Payment Received [${modeLabel}]${refStr}${p.notes ? ' - ' + p.notes : ''}`,
            debit: 0,
            credit: safeNum(p.payment_amount),
            affects_outstanding: true,
          })
        }

        for (const r of rawReturns) {
          allEvents.push({
            id: r.id,
            date: r.return_date || (r.created_at ? r.created_at.split('T')[0] : ''),
            raw_timestamp: r.created_at || r.return_date || '',
            voucher_type: 'RETURN',
            voucher_no: r.return_number || 'RET',
            particulars: `Goods Return${r.reason ? ' - ' + r.reason : ''}`,
            debit: 0,
            credit: safeNum(r.total_amount),
            affects_outstanding: true,
          })
        }

        for (const i of rawInterest) {
          allEvents.push({
            id: i.id,
            date: i.calculation_date || (i.created_at ? i.created_at.split('T')[0] : ''),
            raw_timestamp: i.created_at || i.calculation_date || '',
            voucher_type: 'ADJUSTMENT',
            voucher_no: 'INT',
            particulars: `Interest Charged${i.notes ? ' - ' + i.notes : ''}`,
            debit: safeNum(i.interest_amount),
            credit: 0,
            affects_outstanding: true,
          })
        }

        for (const c of rawCashback) {
          allEvents.push({
            id: c.id,
            date: c.released_date || (c.created_at ? c.created_at.split('T')[0] : ''),
            raw_timestamp: c.created_at || c.released_date || '',
            voucher_type: 'ADJUSTMENT',
            voucher_no: 'CSH',
            particulars: `Cashback Released${c.notes ? ' - ' + c.notes : ''}`,
            debit: 0,
            credit: safeNum(c.cashback_released),
            affects_outstanding: true,
          })
        }

        allEvents.sort((a, b) => {
          const dCompare = (a.date || '').localeCompare(b.date || '')
          if (dCompare !== 0) return dCompare
          return (a.raw_timestamp || '').localeCompare(b.raw_timestamp || '')
        })

        let runningBal = initialOpeningBal
        let calcOpening = initialOpeningBal
        let sumUdhaar = 0
        let sumPay = 0
        let sumRet = 0
        let sumInt = 0
        let sumCsh = 0

        const inRangeEntries: LedgerEntry[] = []
        const inRangeBillIds = new Set<string>()
        const inRangePhysicalBillIds = new Set<string>()
        const inRangePaymentIds = new Set<string>()

        for (const ev of allEvents) {
          const isBeforeStart = sDate ? ev.date < sDate : false
          const isAfterEnd = eDate ? ev.date > eDate : false

          if (isBeforeStart) {
            if (ev.affects_outstanding) {
              runningBal = round2(runningBal + safeNum(ev.debit) - safeNum(ev.credit))
              calcOpening = runningBal
            }
          } else if (!isAfterEnd) {
            if (ev.affects_outstanding) {
              runningBal = round2(runningBal + safeNum(ev.debit) - safeNum(ev.credit))
            }
            if (ev.voucher_type === 'UDHAAR_BILL') {
              sumUdhaar = round2(sumUdhaar + safeNum(ev.debit))
              if (ev.is_physical) inRangePhysicalBillIds.add(ev.id)
              else inRangeBillIds.add(ev.id)
            } else if (ev.voucher_type === 'PAYMENT') {
              sumPay = round2(sumPay + safeNum(ev.credit))
              inRangePaymentIds.add(ev.id)
            } else if (ev.voucher_type === 'RETURN') {
              sumRet = round2(sumRet + safeNum(ev.credit))
            } else if (ev.voucher_type === 'ADJUSTMENT' && ev.voucher_no === 'INT') {
              sumInt = round2(sumInt + safeNum(ev.debit))
            } else if (ev.voucher_type === 'ADJUSTMENT' && ev.voucher_no === 'CSH') {
              sumCsh = round2(sumCsh + safeNum(ev.credit))
            }

            inRangeEntries.push({
              ...ev,
              balance: round2(runningBal),
            })
          }
        }

        const attachedStandard: BillDetail[] = rawBills
          .filter((b) => inRangeBillIds.has(b.id))
          .map((b) => ({
            id: b.id,
            bill_number: b.bill_number,
            bill_date: b.bill_date,
            bill_type: b.bill_type,
            total_amount: safeNum(b.total_amount),
            total_items: safeNum(b.total_items || 0),
            items: billItemsMap[b.id] || [],
            is_physical: false,
          }))

        const attachedPhysical: BillDetail[] = rawPhysicalBills
          .filter((pb) => inRangePhysicalBillIds.has(pb.id))
          .map((pb) => ({
            id: pb.id,
            bill_number: pb.bill_number,
            bill_date: pb.bill_date,
            bill_type: pb.transaction_type,
            total_amount: safeNum(pb.bill_amount),
            total_items: 0,
            items: [],
            is_physical: true,
            file_path: pb.file_path,
            file_type: pb.file_type,
            file_name: pb.file_name,
            notes: pb.notes,
            doc_type: pb.bill_type,
          }))

        const allAttachedBills: BillDetail[] = [...attachedStandard, ...attachedPhysical].sort((a, b) =>
          (a.bill_date || '').localeCompare(b.bill_date || '')
        )

        const attachedPays: PaymentDetail[] = rawPayments
          .filter((p) => inRangePaymentIds.has(p.id))
          .map((p) => ({
            id: p.id,
            payment_number: p.payment_number,
            payment_date: p.payment_date,
            payment_mode: p.payment_mode,
            payment_amount: safeNum(p.payment_amount),
            reference_number: p.reference_number,
            notes: p.notes,
          }))
          .sort((a, b) => (a.payment_date || '').localeCompare(b.payment_date || ''))

        if (isMountedRef.current) {
          setOpeningBalance(round2(calcOpening))
          setLedgerEntries(inRangeEntries)
          setAttachedBills(allAttachedBills)
          setAttachedPayments(attachedPays)
          setTotalUdhaarSales(round2(sumUdhaar))
          setTotalPayments(round2(sumPay))
          setTotalReturns(round2(sumRet))
          setTotalInterest(round2(sumInt))
          setTotalCashback(round2(sumCsh))
        }
      } catch (err: unknown) {
        console.error('fetchFarmerLedger failed:', err)
        if (isMountedRef.current) toast.error('Error loading ledger details')
      } finally {
        if (isMountedRef.current) setLoadingLedger(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedFarmerId) {
      void fetchFarmerLedger(selectedFarmerId, startDate, endDate)
    } else {
      setSelectedFarmer(null)
      setLedgerEntries([])
      setAttachedBills([])
      setAttachedPayments([])
      setOpeningBalance(0)
      setTotalUdhaarSales(0)
      setTotalPayments(0)
      setTotalReturns(0)
      setTotalInterest(0)
      setTotalCashback(0)
    }
  }, [selectedFarmerId, startDate, endDate, fetchFarmerLedger])

  const handleSyncAccount = async () => {
    if (!selectedFarmerId) return
    setSyncing(true)
    const toastId = toast.loading('Syncing account balance...')
    try {
      const { error } = await supabase.rpc('sync_farmer_credit_account', {
        p_farmer_id: selectedFarmerId,
      })
      if (error) throw error
      toast.success('Account balance synced successfully!', { id: toastId })
      await fetchFarmerLedger(selectedFarmerId, startDate, endDate)
    } catch (err: unknown) {
      console.error('handleSyncAccount failed:', err)
      toast.error('Sync failed', { id: toastId })
    } finally {
      if (isMountedRef.current) setSyncing(false)
    }
  }

  const closingBalance = useMemo(() => {
    const rawVal = safeNum(openingBalance)
      + safeNum(totalUdhaarSales)
      + safeNum(totalInterest)
      - safeNum(totalPayments)
      - safeNum(totalReturns)
      - safeNum(totalCashback)
    return round2(rawVal)
  }, [openingBalance, totalUdhaarSales, totalInterest, totalPayments, totalReturns, totalCashback])

  const udhaarBillsList = useMemo(() => attachedBills.filter((b) => b.bill_type === 'udhaar'), [attachedBills])
  const returnEntries = useMemo(() => ledgerEntries.filter((e) => e.voucher_type === 'RETURN'), [ledgerEntries])

  const handleDownloadPDF = useCallback(async () => {
    if (!selectedFarmer) {
      toast.error('Please select a farmer first')
      return
    }
    if (downloadingPdf) return
    if (loadingLedger) {
      toast.error('Ledger is currently loading')
      return
    }

    setDownloadingPdf(true)
    const toastId = toast.loading('Preparing PDF...')

    try {
      let photoDataUrl: string | null = null
      if (selectedFarmer.photo_url) {
        photoDataUrl = await fetchImageAsDataUrl(selectedFarmer.photo_url)
      }

      const doc = await buildLedgerPdfDoc({
        farmer: selectedFarmer,
        startDate,
        endDate,
        openingBalance,
        ledgerEntries,
        attachedPayments,
        udhaarBillsList,
        photoDataUrl,
        totals: {
          totalUdhaarSales,
          totalPayments,
          totalReturns,
          totalInterest,
          totalCashback,
          closingBalance,
        },
      })

      const fileName = `Satguru_Farmer_Ledger_${sanitizeFilename(
        selectedFarmer.farmer_name
      )}_${startDate}_to_${endDate}.pdf`

      doc.save(fileName)
      toast.success('PDF downloaded successfully!', { id: toastId })
    } catch (err) {
      console.error('[PDF Download Error]', err)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error(`PDF generation failed: ${errorMsg}`, { id: toastId })
    } finally {
      if (isMountedRef.current) setDownloadingPdf(false)
    }
  }, [
    selectedFarmer,
    downloadingPdf,
    loadingLedger,
    startDate,
    endDate,
    openingBalance,
    ledgerEntries,
    attachedPayments,
    udhaarBillsList,
    totalUdhaarSales,
    totalPayments,
    totalReturns,
    totalInterest,
    totalCashback,
    closingBalance,
  ])

  const handleShareWhatsApp = useCallback(async () => {
    if (!selectedFarmer) {
      toast.error('Please select a farmer first')
      return
    }
    if (role !== 'admin') {
      toast.error('Only admins can send WhatsApp statements')
      return
    }
    if (sendingWhatsApp) return
    if (loadingLedger) {
      toast.error('Ledger is currently loading')
      return
    }

    setSendingWhatsApp(true)
    const toastId = toast.loading('Preparing PDF...')

    const fileName = `Satguru_Farmer_Ledger_${sanitizeFilename(
      selectedFarmer.farmer_name
    )}_${startDate}_to_${endDate}.pdf`
    const phone = normalisePhone(selectedFarmer.mobile)

    try {
      let photoDataUrl: string | null = null
      if (selectedFarmer.photo_url) {
        photoDataUrl = await fetchImageAsDataUrl(selectedFarmer.photo_url)
      }

      const doc = await buildLedgerPdfDoc({
        farmer: selectedFarmer,
        startDate,
        endDate,
        openingBalance,
        ledgerEntries,
        attachedPayments,
        udhaarBillsList,
        photoDataUrl,
        totals: {
          totalUdhaarSales,
          totalPayments,
          totalReturns,
          totalInterest,
          totalCashback,
          closingBalance,
        },
      })

      const pdfBlob = doc.output('blob')
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('PDF generation returned empty blob')
      }

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

      const messageText =
        `*SATGURU BEEJ BHANDAR*\n` +
        `Daloosar, Sardarshahar (Churu), Rajasthan\n` +
        `----------------------------------------\n` +
        `*KHAATA STATEMENT*\n\n` +
        `*Farmer:* ${sanitizeWhatsAppString(selectedFarmer.farmer_name)}\n` +
        `*ID:* ${selectedFarmer.farmer_id}\n` +
        `*Period:* ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}\n` +
        `*Closing Balance:* Rs. ${formatINR(closingBalance)} ${closingBalance >= 0 ? 'Dr' : 'Cr'}\n\n` +
        `Thank You!\n` +
        `Satguru Beej Bhandar`

      const canShareFile =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function'

      let webShareSupported = false
      if (canShareFile) {
        try {
          webShareSupported = navigator.canShare({ files: [pdfFile] })
        } catch {
          webShareSupported = false
        }
      }

      if (webShareSupported) {
        try {
          await navigator.share({
            title: 'Satguru Beej Bhandar - Khaata Statement',
            text: messageText,
            files: [pdfFile],
          })
          toast.success('PDF sent to Share Sheet', { id: toastId })
          return
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === 'AbortError') {
            toast.dismiss(toastId)
            return
          }
        }
      }

      let shareUrl = ''
      const filePath = `${selectedFarmer.id}/${fileName}`

      try {
        const { error: uploadError } = await supabase.storage
          .from('ledger-pdfs')
          .upload(filePath, pdfBlob, {
            cacheControl: '3600',
            contentType: 'application/pdf',
            upsert: true,
          })

        if (!uploadError) {
          const { data: publicData } = supabase.storage.from('ledger-pdfs').getPublicUrl(filePath)
          shareUrl = publicData?.publicUrl || ''
        }
      } catch (storageErr) {
        console.warn('[WhatsApp PDF storage fallback]', storageErr)
      }

      doc.save(fileName)

      const finalMessage = shareUrl
        ? `${messageText}\n\nDownload PDF Statement:\n${shareUrl}`
        : `${messageText}\n\n(PDF file has been downloaded. Please attach it in WhatsApp.)`

      const waUrl = phone
        ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(finalMessage)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(finalMessage)}`

      window.open(waUrl, '_blank', 'noopener,noreferrer')

      toast.success(
        shareUrl ? 'PDF link opened in WhatsApp!' : 'PDF downloaded and WhatsApp opened.',
        { id: toastId }
      )
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.dismiss(toastId)
      } else {
        console.error('WhatsApp/PDF share failed:', err)
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
        toast.error(`WhatsApp/PDF: ${errorMsg}`, { id: toastId })
      }
    } finally {
      if (isMountedRef.current) setSendingWhatsApp(false)
    }
  }, [
    selectedFarmer,
    role,
    sendingWhatsApp,
    loadingLedger,
    startDate,
    endDate,
    openingBalance,
    ledgerEntries,
    attachedPayments,
    udhaarBillsList,
    totalUdhaarSales,
    totalPayments,
    totalReturns,
    totalInterest,
    totalCashback,
    closingBalance,
  ])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const filteredFarmers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return farmers
    return farmers.filter(
      (f) =>
        f.farmer_name.toLowerCase().includes(q) ||
        f.farmer_id.toLowerCase().includes(q) ||
        (f.mobile || '').includes(q) ||
        (f.village || '').toLowerCase().includes(q)
    )
  }, [farmers, searchQuery])

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">You do not have permission to view the ledger.</p>
      </div>
    )
  }

  const renderBillCard = (bill: BillDetail) => {
    const isPhysical = bill.is_physical

    return (
      <div
        key={bill.id + (isPhysical ? '-pb' : '-sb')}
        style={{
          border: isPhysical ? '2px solid #fdba74' : '2px solid #fda4af',
          backgroundColor: isPhysical ? '#fffbeb' : '#fff1f2',
        }}
        className="rounded-2xl p-3.5 sm:p-4 transition-all shadow-sm"
      >
        <div
          style={{ borderBottom: '1px solid #cbd5e1' }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 mb-2.5"
        >
          <div className="min-w-0 flex-1">
            <div className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-2 flex-wrap">
              {isPhysical ? (
                <Camera size={16} className="text-amber-700 shrink-0" />
              ) : (
                <FileText size={16} className="text-rose-700 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isPhysical ? 'Physical Bill:' : 'Bill:'}
              </span>
              <span className="font-mono break-all font-bold">#{bill.bill_number}</span>
              <span
                style={{
                  backgroundColor: '#ffe4e6',
                  color: '#881337',
                  border: '1px solid #fecdd3',
                }}
                className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase whitespace-nowrap"
              >
                UDHAAR
              </span>
              {isPhysical && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">
                  Receipt Bill
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Date: {formatDateDisplay(bill.bill_date)}
              {!isPhysical && ` | Items: ${bill.total_items || bill.items.length}`}
              {bill.notes && ` | Notes: ${bill.notes}`}
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <p
              style={{ color: '#9f1239' }}
              className="font-black font-mono text-base sm:text-lg whitespace-nowrap"
            >
              ₹{formatINR(bill.total_amount)}
            </p>
            {isPhysical && bill.file_path && (
              <button
                type="button"
                onClick={() =>
                  handleViewAttachment(bill.file_path, bill.file_type, bill.bill_number)
                }
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer print-hidden"
              >
                <Eye size={13} />
                <span>View Receipt</span>
              </button>
            )}
          </div>
        </div>

        {!isPhysical && bill.items.length > 0 && (
          <div className="overflow-x-auto">
            <table
              className="w-full text-[10px] border-collapse"
              style={{ tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }} className="font-bold">
                  <th className="p-1.5 text-left">Product</th>
                  <th className="p-1.5 text-left">Batch</th>
                  <th className="p-1.5 text-right">Qty</th>
                  <th className="p-1.5 text-center">Unit</th>
                  <th className="p-1.5 text-right">Rate</th>
                  <th className="p-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="p-1.5 font-medium break-words">{it.product_name || '—'}</td>
                    <td className="p-1.5 font-mono break-all">{it.batch_number || '—'}</td>
                    <td className="p-1.5 text-right font-mono">{it.quantity}</td>
                    <td className="p-1.5 text-center">{it.unit_name || '—'}</td>
                    <td className="p-1.5 text-right font-mono">₹{formatINR(it.rate)}</td>
                    <td className="p-1.5 text-right font-mono font-bold">
                      ₹{formatINR(it.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8fafc' }} className="font-black">
                  <td colSpan={5} className="p-1.5 text-right">
                    Total:
                  </td>
                  <td className="p-1.5 text-right font-mono">
                    ₹{formatINR(bill.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {isPhysical && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-center justify-between">
            <span className="font-semibold">
              This is an external/physical udhaar bill (attached photo saved in records).
            </span>
            {bill.file_path && (
              <span
                className="font-mono text-[10px] text-amber-800 underline cursor-pointer print-hidden"
                onClick={() =>
                  handleViewAttachment(bill.file_path, bill.file_type, bill.bill_number)
                }
              >
                View Photo ({bill.file_name || 'Attached File'})
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 font-sans">
      <style>{`
        .ledger-mobile-cards { display: none; }
        @media (max-width: 640px) {
          .ledger-table-wrap { display: none; }
          .ledger-mobile-cards { display: block; }
        }

        @media print {
          @page { size: A4 portrait; margin: 6mm; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden !important; }
          #ledger-printable-statement,
          #ledger-printable-statement * { visibility: visible !important; }
          #ledger-printable-statement {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print-hidden { display: none !important; }
          .ledger-mobile-cards { display: none !important; }
          .ledger-table-wrap { display: block !important; }
        }
      `}</style>

      {/* ── Header Banner ── */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col gap-6 print-hidden font-sans">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="text-white shrink-0">
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 flex-wrap">
              <FileText className="text-amber-400 shrink-0" size={24} />
              <span>Farmer Ledger</span>
            </h1>
            <p className="text-emerald-200 text-xs mt-1">
              Complete account statement of Udhaar bills and physical receipts.
            </p>
          </div>

          {selectedFarmer && (
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={handleSyncAccount}
                disabled={syncing || loadingLedger}
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-700 transition cursor-pointer disabled:opacity-60 shadow-sm"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Balance'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={sendingWhatsApp || loadingLedger || downloadingPdf}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-60"
              >
                {sendingWhatsApp ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Share2 size={14} />
                )}
                <span>{sendingWhatsApp ? 'Preparing PDF...' : 'WhatsApp PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloadingPdf || loadingLedger || sendingWhatsApp}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-60"
              >
                {downloadingPdf ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>{downloadingPdf ? 'Preparing...' : 'Download PDF'}</span>
              </button>
            </div>
          )}
        </div>

        {selectedFarmer && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4 w-full relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-600 bg-emerald-50 flex items-center justify-center shrink-0 shadow-inner">
              {selectedFarmer.photo_url ? (
                <img
                  src={selectedFarmer.photo_url}
                  alt={selectedFarmer.farmer_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent && !parent.querySelector('.photo-fallback')) {
                      const span = document.createElement('span')
                      span.className =
                        'photo-fallback text-3xl font-black text-emerald-700'
                      span.textContent =
                        selectedFarmer.farmer_name?.charAt(0)?.toUpperCase() || '?'
                      parent.appendChild(span)
                    }
                  }}
                />
              ) : (
                <span className="text-3xl font-black text-emerald-700">
                  {selectedFarmer.farmer_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Selected Farmer
              </p>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 break-words">
                {selectedFarmer.farmer_name}
              </h2>
              <p className="text-xs text-slate-600 break-words">
                S/O {selectedFarmer.father_name || '—'} · ID:{' '}
                <span className="font-mono font-bold text-emerald-800">
                  {selectedFarmer.farmer_id}
                </span>
              </p>
              <p className="text-xs text-slate-500 break-words">
                {selectedFarmer.village || '—'}
                {selectedFarmer.mobile ? ` · ${selectedFarmer.mobile}` : ''}
              </p>
            </div>

            <div className="text-center sm:text-right bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3 w-full sm:w-auto">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">
                Credit Limit
              </p>
              <p className="text-lg sm:text-xl font-black font-mono text-emerald-950">
                ₹{formatINR(selectedFarmer.credit_limit)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Farmer Selection & Filters ── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4 print-hidden font-sans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1 space-y-1">
            <label className="block font-bold text-xs text-gray-700 uppercase tracking-wider">
              Select Farmer *
            </label>
            <select
              disabled={loadingFarmers}
              value={selectedFarmerId}
              onChange={(e) => setSelectedFarmerId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-bold text-xs bg-slate-50 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose Farmer --</option>
              {filteredFarmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmer_name} S/O {f.father_name || '—'} ({f.village || '—'}) -{' '}
                  {f.farmer_id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-xs text-gray-700 uppercase tracking-wider">
              Search by Name / Mobile / Village
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter farmer dropdown..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-xs text-gray-700 uppercase tracking-wider">
              Date Period
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
              />
              <span className="text-gray-400 text-xs text-center">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t text-[11px]">
          <span className="font-bold text-gray-500 self-center">Quick Filters:</span>
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, '0')
              setStartDate(`${y}-${m}-01`)
              setEndDate(now.toISOString().split('T')[0])
            }}
            className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg font-semibold text-gray-700 transition cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() - 30)
              setStartDate(d.toISOString().split('T')[0])
              setEndDate(new Date().toISOString().split('T')[0])
            }}
            className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg font-semibold text-gray-700 transition cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(defaultFY.start)
              setEndDate(defaultFY.end)
            }}
            className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-bold rounded-lg transition cursor-pointer"
          >
            Current FY ({defaultFY.start.slice(0, 4)}-{defaultFY.end.slice(2, 4)})
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate('2020-01-01')
              setEndDate(new Date().toISOString().split('T')[0])
            }}
            className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg font-semibold text-gray-700 transition cursor-pointer"
          >
            All Time
          </button>
        </div>
      </div>

      {/* ── Live Summary Cards ── */}
      {selectedFarmer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 print-hidden">
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm space-y-1">
            <p className="text-[10px] text-amber-900 font-bold uppercase">Opening Bal</p>
            <p className="text-sm font-black font-mono text-amber-950 break-all">
              ₹{formatINR(openingBalance)}
            </p>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm space-y-1">
            <p className="text-[10px] text-rose-900 font-bold uppercase flex items-center gap-1">
              <ArrowUpRight size={10} /> Udhaar Sales
            </p>
            <p className="text-sm font-black font-mono text-rose-800 break-all">
              ₹{formatINR(totalUdhaarSales)}
            </p>
          </div>
          <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200 shadow-sm space-y-1">
            <p className="text-[10px] text-orange-900 font-bold uppercase flex items-center gap-1">
              <TrendingUp size={10} /> Interest
            </p>
            <p className="text-sm font-black font-mono text-orange-800 break-all">
              ₹{formatINR(totalInterest)}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm space-y-1">
            <p className="text-[10px] text-emerald-900 font-bold uppercase flex items-center gap-1">
              <ArrowDownLeft size={10} /> Payments
            </p>
            <p className="text-sm font-black font-mono text-emerald-800 break-all">
              ₹{formatINR(totalPayments)}
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 shadow-sm space-y-1">
            <p className="text-[10px] text-purple-900 font-bold uppercase flex items-center gap-1">
              <RotateCcw size={10} /> Returns
            </p>
            <p className="text-sm font-black font-mono text-purple-800 break-all">
              ₹{formatINR(totalReturns)}
            </p>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 shadow-sm space-y-1">
            <p className="text-[10px] text-teal-900 font-bold uppercase flex items-center gap-1">
              <Gift size={10} /> Cashback
            </p>
            <p className="text-sm font-black font-mono text-teal-800 break-all">
              ₹{formatINR(totalCashback)}
            </p>
          </div>
          <div className="p-3 bg-emerald-950 text-white rounded-2xl shadow-md space-y-1 col-span-2 sm:col-span-1">
            <p className="text-[10px] text-amber-400 font-bold uppercase">Closing Due</p>
            <p className="text-sm font-black font-mono text-amber-300 break-all">
              ₹{formatINR(closingBalance)}
            </p>
          </div>
        </div>
      )}

      {/* ── On-Screen Ledger Statement ── */}
      <div
        id="ledger-printable-statement"
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        className="rounded-3xl border border-slate-300 p-3 sm:p-4 md:p-6 print:p-0 print:border-none"
      >
        {selectedFarmer && (
          <>
            <div
              style={{
                borderBottom: '2px solid #064e3b',
                paddingBottom: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <h2
                  style={{
                    color: '#064e3b',
                    fontSize: '22px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    margin: '0',
                  }}
                >
                  SATGURU BEEJ BHANDAR
                </h2>
                <p style={{ color: '#475569', fontSize: '12px', fontWeight: 500, margin: '2px 0 0 0' }}>
                  Daloosar, Sardarshahar (Churu), Rajasthan
                </p>
                <p style={{ color: '#065f46', fontSize: '13px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>
                  FARMER ACCOUNT LEDGER STATEMENT
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '10px',
              }}
            >
              <div>
                <span style={{ color: '#475569', fontWeight: 'bold' }}>Opening Bal:</span>{' '}
                <span style={{ color: '#78350f', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  ₹{formatINR(openingBalance)}
                </span>
              </div>
              <div>
                <span style={{ color: '#475569', fontWeight: 'bold' }}>Udhaar Sales:</span>{' '}
                <span style={{ color: '#9f1239', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  ₹{formatINR(totalUdhaarSales)}
                </span>
              </div>
              <div>
                <span style={{ color: '#475569', fontWeight: 'bold' }}>Payments:</span>{' '}
                <span style={{ color: '#065f46', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  ₹{formatINR(totalPayments)}
                </span>
              </div>
              <div>
                <span style={{ color: '#475569', fontWeight: 'bold' }}>Closing Due:</span>{' '}
                <span style={{ color: '#022c22', fontFamily: 'monospace', fontWeight: 900 }}>
                  ₹{formatINR(closingBalance)} {closingBalance >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            </div>
          </>
        )}

        {!selectedFarmerId ? (
          <div className="py-20 text-center text-gray-500 space-y-2 print-hidden">
            <User size={40} className="mx-auto text-gray-300" />
            <p className="font-bold text-sm">Select a farmer to view the ledger.</p>
          </div>
        ) : loadingLedger ? (
          <div className="py-20 text-center text-gray-500 space-y-2">
            <Loader2 size={32} className="animate-spin text-emerald-700 mx-auto" />
            <p className="font-bold text-xs">Loading ledger details...</p>
          </div>
        ) : (
          <>
            <div className="ledger-table-wrap overflow-x-auto">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#064e3b', color: '#ffffff' }}>
                    <th style={{ padding: '6px 8px', width: '12%' }}>Date</th>
                    <th style={{ padding: '6px 8px', width: '10%' }}>Type</th>
                    <th style={{ padding: '6px 8px', width: '14%' }}>Vch No</th>
                    <th style={{ padding: '6px 8px', width: '32%' }}>Particulars</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '10%' }}>Debit ₹</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '10%' }}>Credit ₹</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '12%' }}>Balance ₹</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    style={{
                      backgroundColor: '#fffbeb',
                      color: '#78350f',
                      fontWeight: 'bold',
                      borderBottom: '1px solid #fde68a',
                    }}
                  >
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                      {formatDateDisplay(startDate)}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span
                        style={{
                          backgroundColor: '#fef3c7',
                          color: '#78350f',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '9px',
                        }}
                      >
                        OPENING
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>—</td>
                    <td style={{ padding: '6px 8px' }}>*** Opening Balance B/F ***</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {openingBalance > 0 ? `₹${formatINR(openingBalance)}` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {openingBalance < 0 ? `₹${formatINR(Math.abs(openingBalance))}` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#be123c' }}>
                      ₹{formatINR(openingBalance)} {openingBalance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>

                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No transactions occurred in this period.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((row) => {
                      let typeBadge = ''
                      let typeBg = '#f1f5f9'
                      let typeColor = '#1e293b'
                      switch (row.voucher_type) {
                        case 'UDHAAR_BILL':
                          typeBadge = row.is_physical ? 'PHY-UDHAAR' : 'UDHAAR'
                          typeBg = '#ffe4e6'
                          typeColor = '#881337'
                          break
                        case 'PAYMENT':
                          typeBadge = 'PAYMENT'
                          typeBg = '#d1fae5'
                          typeColor = '#064e3b'
                          break
                        case 'RETURN':
                          typeBadge = 'RETURN'
                          typeBg = '#f3e8ff'
                          typeColor = '#581c87'
                          break
                        case 'ADJUSTMENT':
                          if (row.voucher_no === 'INT') {
                            typeBadge = 'INTEREST'
                            typeBg = '#ffedd5'
                            typeColor = '#7c2d12'
                          } else if (row.voucher_no === 'CSH') {
                            typeBadge = 'CASHBACK'
                            typeBg = '#ecfeff'
                            typeColor = '#164e63'
                          } else {
                            typeBadge = 'ADJUSTMENT'
                            typeBg = '#f0f9ff'
                            typeColor = '#0c4a6e'
                          }
                          break
                        default:
                          typeBadge = row.voucher_type
                      }
                      return (
                        <tr key={row.id + row.voucher_type + (row.is_physical ? '-phy' : '')} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                            {formatDateDisplay(row.date)}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                backgroundColor: typeBg,
                                color: typeColor,
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 'bold',
                              }}
                            >
                              {typeBadge}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#065f46' }}>
                            {row.voucher_no}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span>{row.particulars}</span>
                              {row.is_physical && row.file_path && (
                                <button
                                  type="button"
                                  onClick={() => handleViewAttachment(row.file_path, row.file_type, row.voucher_no)}
                                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-bold text-[9px] flex items-center gap-1 shrink-0 print-hidden cursor-pointer"
                                  title="View Physical Bill Photo"
                                >
                                  <Camera size={10} />
                                  <span>Receipt</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#be123c' }}>
                            {row.debit > 0 ? `₹${formatINR(row.debit)}` : '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>
                            {row.credit > 0 ? `₹${formatINR(row.credit)}` : '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                            {row.affects_outstanding ? `₹${formatINR(row.balance)} ${row.balance >= 0 ? 'Dr' : 'Cr'}` : '— separate —'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#ecfdf5', borderTop: '2px solid #064e3b', color: '#022c22', fontWeight: 'bold' }}>
                    <td colSpan={4} style={{ padding: '8px', textTransform: 'uppercase' }}>
                      TOTAL — {ledgerEntries.length} entries
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#be123c' }}>
                      ₹{formatINR(totalUdhaarSales + totalInterest)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                      ₹{formatINR(totalPayments + totalReturns + totalCashback)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#be123c', fontSize: '12px' }}>
                      ₹{formatINR(closingBalance)} {closingBalance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="ledger-mobile-cards space-y-2">
              {ledgerEntries.length === 0 ? (
                <div className="p-6 text-center text-gray-500 font-semibold text-xs bg-slate-50 rounded-xl">
                  No transactions occurred in this period.
                </div>
              ) : (
                ledgerEntries.map((row) => (
                  <div
                    key={row.id + row.voucher_type + '-m'}
                    style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
                    className="rounded-xl p-3 space-y-1.5 shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800">
                        {row.voucher_type}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{formatDateDisplay(row.date)}</span>
                    </div>
                    <p className="text-[10px] font-mono font-bold text-emerald-800 break-all">
                      Vch: #{row.voucher_no}
                    </p>
                    <p className="text-xs text-slate-700 break-words">{row.particulars}</p>
                    <div className="grid grid-cols-3 gap-1 text-[10px] pt-1 border-t border-slate-100">
                      <div>
                        <p className="text-slate-500 font-bold">Debit</p>
                        <p className="font-mono font-bold text-rose-700 break-all">
                          {row.debit > 0 ? `₹${formatINR(row.debit)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold">Credit</p>
                        <p className="font-mono font-bold text-emerald-700 break-all">
                          {row.credit > 0 ? `₹${formatINR(row.credit)}` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 font-bold">Balance</p>
                        <p className="font-mono font-black text-slate-900 break-all">
                          {row.affects_outstanding
                            ? `₹${formatINR(row.balance)} ${row.balance >= 0 ? 'Dr' : 'Cr'}`
                            : '— separate —'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {selectedFarmer && udhaarBillsList.length > 0 && (
          <div style={{ borderTop: '4px solid #9f1239', marginTop: '24px', paddingTop: '16px' }}>
            <h3 style={{ color: '#881337', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 8px 0' }}>
              Udhaar Bills (Digital & Physical)
            </h3>
            <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 16px 0' }}>
              Total Bills: {udhaarBillsList.length} | Total Amount: ₹{formatINR(totalUdhaarSales)}
            </p>
            <div className="space-y-4">
              {udhaarBillsList.map((bill) => renderBillCard(bill))}
            </div>
          </div>
        )}

        {selectedFarmer && returnEntries.length > 0 && (
          <div style={{ borderTop: '4px solid #581c87', marginTop: '24px', paddingTop: '16px' }}>
            <h3 style={{ color: '#581c87', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 8px 0' }}>
              Goods Returned
            </h3>
            <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 16px 0' }}>
              Total Returns: {returnEntries.length} | Total Amount: ₹{formatINR(totalReturns)}
            </p>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#581c87', color: '#ffffff', fontWeight: 'bold' }}>
                    <th style={{ padding: '6px 8px' }}>Date</th>
                    <th style={{ padding: '6px 8px' }}>Return No</th>
                    <th style={{ padding: '6px 8px' }}>Particulars (Products)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {returnEntries.map((r) => (
                    <tr key={r.id} style={{ backgroundColor: '#faf5ff', borderBottom: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{formatDateDisplay(r.date)}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4c1d95' }}>
                        {r.voucher_no}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{r.particulars}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#581c87' }}>
                        ₹{formatINR(r.credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Physical Bill Attachment Viewer ── */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm print-hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Receipt className="text-emerald-700" size={18} />
                <span>{previewDocTitle || 'Physical Bill Document Viewer'}</span>
              </h4>
              <div className="flex items-center space-x-2">
                {previewDocUrl && (
                  <a
                    href={previewDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-600 hover:text-emerald-700 hover:bg-gray-200 rounded-xl cursor-pointer"
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-gray-900/5 min-h-[300px]">
              {loadingDocPreview ? (
                <div className="text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  <span className="text-xs font-bold">Loading document...</span>
                </div>
              ) : previewDocUrl ? (
                previewDocType === 'pdf' ? (
                  <div className="text-center space-y-4">
                    <FileText className="w-16 h-16 text-rose-500 mx-auto" />
                    <p className="text-sm font-bold text-gray-800">PDF Document Ready</p>
                    <a
                      href={previewDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow hover:bg-emerald-700 transition cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download / Open PDF</span>
                    </a>
                  </div>
                ) : (
                  <img
                    src={previewDocUrl}
                    alt="Physical Bill Original"
                    className="max-h-[72vh] object-contain rounded-xl shadow-md"
                  />
                )
              ) : (
                <p className="text-gray-400 text-xs font-bold">Document not available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FarmerLedgerView