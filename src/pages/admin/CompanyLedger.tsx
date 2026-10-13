// src/pages/admin/CompanyLedger.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Building2, Printer, Loader2, ShieldAlert, Download, FileText,
  TrendingUp, TrendingDown, RotateCcw, Wallet, Search, X, Info, ChevronDown,
  Eye, ExternalLink, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { round2, safeNum as libSafeNum } from '../../lib/round'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Company {
  id: string
  company_name: string
  gstin?: string | null
}

type LedgerEventType = 'PURCHASE' | 'PAYMENT' | 'RETURN'

interface LedgerEvent {
  id: string
  date: string
  type: LedgerEventType
  ref_no: string
  description: string
  debit: number
  credit: number
  balance?: number
  invoice_url?: string | null
}

interface RpcRawEvent {
  id: string
  date: string
  type: string
  ref_no: string
  description: string
  debit: number | string | null
  credit: number | string | null
  invoice_url?: string | null
}

interface RpcLedgerResponse {
  opening_balance?: number | string | null
  events?: RpcRawEvent[] | null
}

interface LedgerTotals {
  totalPurchases: number
  totalPayments: number
  totalReturns: number
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function safeNum(val: unknown): number {
  return libSafeNum(val)
}

function formatINR(val: number | null | undefined): string {
  return safeNum(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '—'
  const parts = dStr.split('T')[0].split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dStr
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'Company'
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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

/**
 * Multi-fallback smart storage URL resolver for Private & Public Supabase Buckets
 */
async function resolveStorageUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''

  const cleanStr = pathOrUrl.trim()
  if (!cleanStr) return ''

  let bucket = 'company-bills'
  let objectPath = ''

  // Extract bucket and object name from full Supabase URL
  if (cleanStr.includes('/storage/v1/object/')) {
    try {
      const parts = cleanStr.split('/storage/v1/object/')[1]
      if (parts) {
        const withoutQuery = parts.split('?')[0]
        const segments = withoutQuery.split('/').filter(Boolean)
        // segments[0] = 'public' | 'sign' | 'authenticated'
        // segments[1] = bucket name (e.g. 'company-bills')
        // segments[2..] = object path (e.g. ['company-bills', 'TER43-1791544869143.png'])
        if (segments.length >= 3) {
          bucket = segments[1]
          objectPath = segments.slice(2).join('/')
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  if (!objectPath) {
    if (cleanStr.startsWith('http://') || cleanStr.startsWith('https://')) {
      return cleanStr
    }
    objectPath = cleanStr
  }

  // Attempt 1: Exact path as recorded in storage.objects
  try {
    const { data: signed1, error: err1 } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600)

    if (!err1 && signed1?.signedUrl) {
      return signed1.signedUrl
    }
  } catch {
    // ignore
  }

  // Attempt 2: If objectPath starts with bucket name, try stripping it
  if (objectPath.startsWith(`${bucket}/`)) {
    const strippedPath = objectPath.substring(bucket.length + 1)
    try {
      const { data: signed2, error: err2 } = await supabase.storage
        .from(bucket)
        .createSignedUrl(strippedPath, 3600)

      if (!err2 && signed2?.signedUrl) {
        return signed2.signedUrl
      }
    } catch {
      // ignore
    }
  }

  // Attempt 3: Try prepending bucket name if missing
  if (!objectPath.startsWith(`${bucket}/`)) {
    const prependedPath = `${bucket}/${objectPath}`
    try {
      const { data: signed3, error: err3 } = await supabase.storage
        .from(bucket)
        .createSignedUrl(prependedPath, 3600)

      if (!err3 && signed3?.signedUrl) {
        return signed3.signedUrl
      }
    } catch {
      // ignore
    }
  }

  return cleanStr
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CompanyLedger() {
  const { role, loading: authLoading } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchingLedger, setFetchingLedger] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const [openingBalance, setOpeningBalance] = useState(0)
  const [events, setEvents] = useState<LedgerEvent[]>([])
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  // Search & Filter states
  const [companySearch, setCompanySearch] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | LedgerEventType>('ALL')

  // Invoice viewer modal state
  const [viewingInvoice, setViewingInvoice] = useState<{
    url: string
    refNo: string
    date: string
    loading: boolean
  } | null>(null)
  const [imgLoadError, setImgLoadError] = useState(false)

  const isMounted = useRef(true)
  const activeRequestId = useRef(0)

  /* ---- Load company list ---- */
  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_name, gstin')
        .eq('account_status', 'active')
        .order('company_name')
      if (error) throw error
      if (isMounted.current) setCompanies((data as Company[]) || [])
    } catch {
      toast.error('Companies load failed')
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    if (role === 'admin') void loadCompanies()
    return () => {
      isMounted.current = false
    }
  }, [loadCompanies, role])

  /* ---- Fetch Ledger ---- */
  const fetchLedger = useCallback(async (compId: string) => {
    if (!compId) return

    const requestId = ++activeRequestId.current

    setFetchingLedger(true)
    setLedgerError(null)
    setOpeningBalance(0)
    setEvents([])

    try {
      const { data, error } = await supabase.rpc('get_company_ledger', {
        p_company_id: compId,
      })
      if (error) throw error

      if (requestId !== activeRequestId.current) return

      const resp = (data ?? {}) as RpcLedgerResponse
      const openBal = safeNum(resp.opening_balance)

      const rawEvs: LedgerEvent[] = (resp.events || []).map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type as LedgerEventType,
        ref_no: e.ref_no,
        description: e.description,
        debit: safeNum(e.debit),
        credit: safeNum(e.credit),
        invoice_url: e.invoice_url || null,
      }))

      let running = openBal
      const processed = rawEvs.map((ev) => {
        // Payables: Closing = Opening + Credit (purchases) - Debit (payments/returns)
        running = round2(running + ev.credit - ev.debit)
        return { ...ev, balance: running }
      })

      if (isMounted.current && requestId === activeRequestId.current) {
        setOpeningBalance(openBal)
        setEvents(processed)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (isMounted.current && requestId === activeRequestId.current) {
        setLedgerError(msg)
        toast.error('Ledger load failed: ' + msg)
      }
    } finally {
      if (isMounted.current && requestId === activeRequestId.current) {
        setFetchingLedger(false)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      void fetchLedger(selectedCompanyId)
      setLedgerSearch('')
      setTypeFilter('ALL')
    } else {
      setOpeningBalance(0)
      setEvents([])
      setLedgerError(null)
    }
  }, [selectedCompanyId, fetchLedger])

  /* ---- Open Physical Invoice Modal ---- */
  const handleOpenInvoice = useCallback(async (rawUrl: string, refNo: string, date: string) => {
    setImgLoadError(false)
    setViewingInvoice({
      url: '',
      refNo,
      date,
      loading: true,
    })

    try {
      const finalUrl = await resolveStorageUrl(rawUrl)
      if (!finalUrl) {
        toast.error('Bill URL not available')
        setViewingInvoice(null)
        return
      }
      setViewingInvoice({
        url: finalUrl,
        refNo,
        date,
        loading: false,
      })
    } catch {
      toast.error('Unable to open bill image.')
      setViewingInvoice(null)
    }
  }, [])

  /* ---- Filtered companies ---- */
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies
    const q = companySearch.toLowerCase().trim()
    return companies.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        (c.gstin || '').toLowerCase().includes(q)
    )
  }, [companies, companySearch])

  /* ---- Filtered ledger events ---- */
  const filteredEvents = useMemo(() => {
    let list = events
    if (typeFilter !== 'ALL') {
      list = list.filter((ev) => ev.type === typeFilter)
    }
    const q = ledgerSearch.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (ev) =>
          (ev.ref_no || '').toLowerCase().includes(q) ||
          (ev.description || '').toLowerCase().includes(q) ||
          (ev.type || '').toLowerCase().includes(q) ||
          formatDateDisplay(ev.date).includes(q) ||
          String(ev.debit).includes(q) ||
          String(ev.credit).includes(q)
      )
    }
    return list
  }, [events, ledgerSearch, typeFilter])

  /* ---- Totals ---- */
  const totals: LedgerTotals = useMemo(() => {
    let totalPurchases = 0
    let totalPayments = 0
    let totalReturns = 0
    let totalDebit = 0
    let totalCredit = 0

    for (const ev of events) {
      totalDebit += ev.debit
      totalCredit += ev.credit
      if (ev.type === 'PURCHASE') totalPurchases += ev.credit
      else if (ev.type === 'PAYMENT') totalPayments += ev.debit
      else if (ev.type === 'RETURN') totalReturns += ev.debit
    }

    const closingBalance =
      Math.round((openingBalance + totalCredit - totalDebit + Number.EPSILON) * 100) / 100

    return {
      totalPurchases: Math.round((totalPurchases + Number.EPSILON) * 100) / 100,
      totalPayments: Math.round((totalPayments + Number.EPSILON) * 100) / 100,
      totalReturns: Math.round((totalReturns + Number.EPSILON) * 100) / 100,
      totalDebit: Math.round((totalDebit + Number.EPSILON) * 100) / 100,
      totalCredit: Math.round((totalCredit + Number.EPSILON) * 100) / 100,
      closingBalance,
    }
  }, [events, openingBalance])

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  )

  const canExport = Boolean(selectedCompanyId) && !fetchingLedger && !ledgerError
  const isSearchActive = ledgerSearch.trim() !== '' || typeFilter !== 'ALL'

  /* ---- PDF Generation ---- */
  const handleDownloadPdf = useCallback(async () => {
    if (!selectedCompany) {
      toast.error('No company selected')
      return
    }
    if (fetchingLedger) {
      toast.error('Ledger is still loading')
      return
    }

    setGeneratingPdf(true)
    const toastId = toast.loading('Generating PDF...')

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const companyName = selectedCompany.company_name || 'Unknown'
      const gstin = selectedCompany.gstin || 'N/A'
      const generatedOn = nowDisplayString()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(6, 78, 59)
      doc.text('SATGURU BEEJ BHANDAR', pageWidth / 2, 14, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text('Company Account Statement', pageWidth / 2, 20, { align: 'center' })

      doc.setDrawColor(6, 78, 59)
      doc.setLineWidth(0.5)
      doc.line(10, 23, pageWidth - 10, 23)

      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text('Supplier / Company:', 10, 30)
      doc.setFont('helvetica', 'normal')
      doc.text(companyName, 48, 30)

      doc.setFont('helvetica', 'bold')
      doc.text('GSTIN:', 10, 35)
      doc.setFont('helvetica', 'normal')
      doc.text(String(gstin), 48, 35)

      doc.setFont('helvetica', 'bold')
      doc.text('Generated On:', 10, 40)
      doc.setFont('helvetica', 'normal')
      doc.text(generatedOn, 48, 40)

      const summaryStartY = 46
      doc.setDrawColor(203, 213, 225)
      doc.setFillColor(240, 253, 244)
      doc.rect(10, summaryStartY, pageWidth - 20, 30, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(6, 78, 59)
      doc.text('ACCOUNT SUMMARY', 13, summaryStartY + 5)

      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)

      const col1X = 13
      const col2X = pageWidth / 2 + 5

      doc.setFont('helvetica', 'normal')
      doc.text('Opening Balance:', col1X, summaryStartY + 12)
      doc.text('Total Purchases:', col1X, summaryStartY + 18)
      doc.text('Total Payments:', col1X, summaryStartY + 24)

      doc.setFont('helvetica', 'bold')
      doc.text(
        `Rs. ${formatINR(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Cr' : 'Dr'}`,
        col1X + 40,
        summaryStartY + 12
      )
      doc.text(`Rs. ${formatINR(totals.totalPurchases)}`, col1X + 40, summaryStartY + 18)
      doc.text(`Rs. ${formatINR(totals.totalPayments)}`, col1X + 40, summaryStartY + 24)

      doc.setFont('helvetica', 'normal')
      doc.text('Total Returns:', col2X, summaryStartY + 12)
      doc.text('Total Transactions:', col2X, summaryStartY + 18)

      doc.setFont('helvetica', 'bold')
      doc.text(`Rs. ${formatINR(totals.totalReturns)}`, col2X + 40, summaryStartY + 12)
      doc.text(`${events.length}`, col2X + 40, summaryStartY + 18)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(190, 18, 60)
      doc.text('CLOSING PAYABLE:', col2X, summaryStartY + 25)
      doc.text(
        `Rs. ${formatINR(Math.abs(totals.closingBalance))} ${
          totals.closingBalance >= 0 ? 'Cr' : 'Dr'
        }`,
        col2X + 40,
        summaryStartY + 25
      )

      const tableStartY = summaryStartY + 35

      const tableHead = [
        ['Date', 'Type', 'Ref No', 'Particulars', 'Debit', 'Credit', 'Balance'],
      ]

      const tableBody: (string | number)[][] = []

      tableBody.push([
        '—',
        'OPENING',
        '—',
        'Opening Payable Balance',
        '—',
        '—',
        `Rs. ${formatINR(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Cr' : 'Dr'}`,
      ])

      if (events.length === 0) {
        tableBody.push([
          '—',
          '—',
          '—',
          'No transactions found for the available history.',
          '—',
          '—',
          '—',
        ])
      } else {
        for (const ev of events) {
          tableBody.push([
            formatDateDisplay(ev.date),
            ev.type,
            ev.ref_no || '—',
            ev.description || '—',
            ev.debit > 0 ? `Rs. ${formatINR(ev.debit)}` : '—',
            ev.credit > 0 ? `Rs. ${formatINR(ev.credit)}` : '—',
            `Rs. ${formatINR(Math.abs(ev.balance || 0))} ${(ev.balance || 0) >= 0 ? 'Cr' : 'Dr'}`,
          ])
        }
      }

      tableBody.push([
        '',
        '',
        '',
        'CLOSING PAYABLE BALANCE',
        `Rs. ${formatINR(totals.totalDebit)}`,
        `Rs. ${formatINR(totals.totalCredit)}`,
        `Rs. ${formatINR(Math.abs(totals.closingBalance))} ${
          totals.closingBalance >= 0 ? 'Cr' : 'Dr'
        }`,
      ])

      autoTable(doc, {
        startY: tableStartY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [6, 78, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 18 },
          2: { cellWidth: 22 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === 0) {
            data.cell.styles.fillColor = [254, 243, 199]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [120, 53, 15]
          }
          if (data.section === 'body' && data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = [220, 252, 231]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [6, 78, 59]
          }
        },
        margin: { top: 15, left: 10, right: 10, bottom: 15 },
        showHead: 'everyPage',
        didDrawPage: () => {
          const pageCount =
            typeof (doc as any).getNumberOfPages === 'function'
              ? (doc as any).getNumberOfPages()
              : 1
          const currentPage =
            typeof (doc as any).getCurrentPageInfo === 'function'
              ? (doc as any).getCurrentPageInfo().pageNumber
              : 1

          doc.setFontSize(8)
          doc.setTextColor(100, 116, 139)
          doc.setFont('helvetica', 'normal')

          doc.setDrawColor(203, 213, 225)
          doc.setLineWidth(0.2)
          doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10)

          doc.text(
            'Satguru Beej Bhandar — Company Account Statement',
            10,
            pageHeight - 6
          )
          doc.text(
            `Page ${currentPage} of ${pageCount}`,
            pageWidth - 10,
            pageHeight - 6,
            { align: 'right' }
          )
        },
      })

      const filename = `Satguru_Company_Ledger_${sanitizeFilename(companyName)}_${todayISO()}.pdf`
      doc.save(filename)

      toast.success('PDF downloaded successfully.', { id: toastId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('PDF generation failed. (' + msg + ')', {
        id: toastId,
      })
    } finally {
      if (isMounted.current) setGeneratingPdf(false)
    }
  }, [selectedCompany, fetchingLedger, openingBalance, events, totals])

  /* ---- Admin gate ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-8 bg-white rounded-[2rem] border border-rose-100 text-center shadow-[0_8px_30px_rgb(225,29,72,0.1)]">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="text-rose-600" size={40} />
          </div>
          <h1 className="font-extrabold text-slate-900 text-2xl mb-2">Access Denied</h1>
          <p className="text-slate-500 text-sm">Only administrators can view company ledgers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          .mobile-cards { display: none !important; }
          .desktop-table { display: table !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 8px !important; border-bottom: 1px solid #cbd5e1; font-size: 10px !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ============ HEADER BANNER ============ */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 rounded-[2rem] shadow-xl border border-emerald-700/30 print-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-teal-400 opacity-10 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0">
                <Building2 className="text-emerald-300" size={28} />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Company Ledger
                </h1>
                <p className="text-emerald-100/80 text-sm sm:text-base font-medium mt-1 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Tally-style statement for Purchases, Payments & Returns
                </p>
              </div>
            </div>

            {selectedCompanyId && (
              <div className="flex w-full md:w-auto gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={!canExport || generatingPdf}
                  className="flex-1 md:flex-none px-5 py-3 bg-white hover:bg-slate-50 text-emerald-900 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group border border-emerald-100"
                >
                  {generatingPdf ? (
                    <><Loader2 size={18} className="animate-spin text-emerald-600" /> Generating PDF...</>
                  ) : (
                    <><Download size={18} className="text-emerald-600 group-hover:-translate-y-0.5 transition-transform" /> Download PDF</>
                  )}
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!canExport}
                  className="flex-1 md:flex-none px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg border border-white/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={18} /> Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============ SEARCH & SELECT CARD ============ */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 print-hidden relative z-20 -mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            
            <div className="space-y-2.5">
              <label className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5 ml-1">
                <Search size={14} className="text-emerald-500" /> 
                Search Supplier Database
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Type Company Name or GSTIN..."
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 rounded-2xl font-semibold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
                {companySearch && (
                  <button
                    onClick={() => setCompanySearch('')}
                    className="absolute inset-y-0 right-4 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {companySearch && (
                <p className="text-[11px] text-emerald-600 font-bold ml-2 animate-fade-in">
                  Found {filteredCompanies.length} result(s)
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5 ml-1">
                <Building2 size={14} className="text-emerald-500" /> 
                Select Account <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  disabled={loading}
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full appearance-none pl-4 pr-12 py-3.5 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:cursor-wait"
                >
                  <option value="" className="text-slate-400 font-normal">-- Choose a Supplier --</option>
                  {filteredCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.gstin ? `(GST: ${c.gstin})` : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <ChevronDown size={20} className="text-slate-400" />
                </div>
              </div>
              {filteredCompanies.length === 0 && companySearch && (
                <p className="text-[11px] text-rose-500 font-bold ml-2">
                  ⚠ No matching company found.
                </p>
              )}
            </div>

          </div>
        </div>

        {/* ============ LOADING & ERROR STATES ============ */}
        {fetchingLedger && (
          <div className="py-16 text-center bg-white rounded-[2rem] shadow-sm border border-slate-100 print-hidden">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-lg font-bold text-slate-700">Loading Ledger Data</h3>
            <p className="text-sm text-slate-400 mt-1">Please wait while we fetch the transactions...</p>
          </div>
        )}

        {!fetchingLedger && ledgerError && selectedCompanyId && (
          <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 flex items-start gap-4 print-hidden">
            <ShieldAlert className="text-rose-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-rose-800">Failed to load ledger</h3>
              <p className="text-sm text-rose-600 mt-1">{ledgerError}</p>
            </div>
          </div>
        )}

        {/* ============ DASHBOARD METRIC CARDS ============ */}
        {!fetchingLedger && !ledgerError && selectedCompanyId && selectedCompany && (
          <div className="print-hidden space-y-6 animate-fade-in">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Card 1: Closing Payable */}
              <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl relative overflow-hidden flex flex-col justify-center">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Building2 size={64} className="text-white" />
                 </div>
                 <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">
                   Current Payable
                 </p>
                 <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight break-all relative z-10">
                   ₹{formatINR(Math.abs(totals.closingBalance))}
                   <span className="text-lg text-slate-400 ml-2">{totals.closingBalance >= 0 ? 'Cr' : 'Dr'}</span>
                 </h2>
                 <p className="text-slate-400 text-[11px] font-medium mt-2 relative z-10 break-words">
                   {selectedCompany.company_name}
                 </p>
              </div>

              {/* Card 2: Purchases */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-colors">
                 <div className="flex justify-between items-start mb-4">
                   <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                     <TrendingUp size={20} />
                   </div>
                   <span className="px-2 py-1 bg-slate-50 text-slate-400 text-[9px] font-bold uppercase rounded-lg">Cr</span>
                 </div>
                 <div>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Purchases</p>
                   <p className="text-2xl font-black text-slate-800 break-all">₹{formatINR(totals.totalPurchases)}</p>
                 </div>
              </div>

              {/* Card 3: Payments */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-rose-200 transition-colors">
                 <div className="flex justify-between items-start mb-4">
                   <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                     <TrendingDown size={20} />
                   </div>
                   <span className="px-2 py-1 bg-slate-50 text-slate-400 text-[9px] font-bold uppercase rounded-lg">Dr</span>
                 </div>
                 <div>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Payments</p>
                   <p className="text-2xl font-black text-slate-800 break-all">₹{formatINR(totals.totalPayments)}</p>
                 </div>
              </div>

              {/* Card 4: Returns & Opening */}
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between flex-1">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Returns</p>
                    <p className="text-lg font-black text-slate-700">₹{formatINR(totals.totalReturns)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
                    <RotateCcw size={16} />
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between flex-1">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Opening Bal</p>
                    <p className="text-lg font-black text-slate-700">₹{formatINR(Math.abs(openingBalance))}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                </div>
              </div>

            </div>

            {/* Reconciliation Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 py-2">
               <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-500 shadow-sm flex items-center gap-2">
                 <FileText size={14} className="text-emerald-500" /> {events.length} Transactions
               </span>
               <p className="text-[11px] font-mono font-medium text-slate-400 tracking-wide text-center">
                 Op ₹{formatINR(openingBalance)} + Cr ₹{formatINR(totals.totalCredit)} − Dr ₹{formatINR(totals.totalDebit)} = ₹{formatINR(totals.closingBalance)}
               </p>
            </div>
          </div>
        )}

        {/* ============ FILTER & TABLE AREA ============ */}
        {!fetchingLedger && !ledgerError && selectedCompanyId && events.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden print-hidden animate-fade-in">
            
            {/* Filter Toolbar */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
                
                {/* Search inside ledger */}
                <div className="w-full lg:w-96 relative group">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400 group-focus-within:text-emerald-500" />
                  </div>
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search Date, Ref No, Amount..."
                    className="w-full pl-10 pr-10 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-medium text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                  {ledgerSearch && (
                    <button onClick={() => setLedgerSearch('')} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-rose-500">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Type Filters */}
                <div className="w-full lg:w-auto flex flex-wrap gap-2 bg-white p-1 rounded-xl border border-slate-200">
                  {(['ALL', 'PURCHASE', 'PAYMENT', 'RETURN'] as const).map((t) => {
                    const active = typeFilter === t
                    return (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                          active 
                          ? 'bg-slate-900 text-white shadow-md' 
                          : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {isSearchActive && (
                <div className="flex items-center justify-between bg-amber-50/50 border border-amber-200/50 rounded-xl p-3">
                  <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                    <Info size={14} className="text-amber-500" />
                    Showing {filteredEvents.length} of {events.length} results. Balance column shows chronological account balance.
                  </p>
                  <button onClick={() => { setLedgerSearch(''); setTypeFilter('ALL'); }} className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase bg-rose-100 px-3 py-1.5 rounded-lg">
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b-2 border-slate-100">
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest">Date</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest">Type</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest">Ref No</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest w-full">Particulars</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest text-center">Invoice</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest text-right">Debit (Dr)</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest text-right">Credit (Cr)</th>
                    <th className="py-4 px-6 text-slate-400 font-black text-xs uppercase tracking-widest text-right bg-slate-50/50">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  
                  {!isSearchActive && (
                    <tr className="bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                      <td className="py-4 px-6 text-slate-400">—</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-[10px] font-black uppercase">Opening</span>
                      </td>
                      <td className="py-4 px-6 text-slate-400">—</td>
                      <td className="py-4 px-6 font-semibold text-slate-700">Opening Payable Balance</td>
                      <td className="py-4 px-6 text-center text-slate-400">—</td>
                      <td className="py-4 px-6 text-right text-slate-400">—</td>
                      <td className="py-4 px-6 text-right text-slate-400">—</td>
                      <td className="py-4 px-6 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                        ₹{formatINR(Math.abs(openingBalance))} <span className="text-xs text-slate-500 ml-1">{openingBalance >= 0 ? 'Cr' : 'Dr'}</span>
                      </td>
                    </tr>
                  )}

                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium bg-slate-50/50">
                        No transactions found for the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => {
                      let bStyle = ''
                      if (ev.type === 'PURCHASE') bStyle = 'bg-emerald-100 text-emerald-700'
                      else if (ev.type === 'PAYMENT') bStyle = 'bg-rose-100 text-rose-700'
                      else if (ev.type === 'RETURN') bStyle = 'bg-purple-100 text-purple-700'

                      return (
                        <tr key={ev.id + ev.type} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-4 px-6 font-medium text-slate-600">
                            {formatDateDisplay(ev.date)}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${bStyle}`}>
                              {ev.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-slate-700">
                            {ev.ref_no || '—'}
                          </td>
                          <td className="py-4 px-6 text-slate-600 truncate max-w-[220px]" title={ev.description}>
                            {ev.description || '—'}
                          </td>
                          
                          {/* Invoice View Button Column */}
                          <td className="py-4 px-6 text-center">
                            {ev.type === 'PURCHASE' && ev.invoice_url ? (
                              <button
                                onClick={() => handleOpenInvoice(ev.invoice_url!, ev.ref_no, ev.date)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-sm active:scale-95 group/btn"
                                title="Click to view uploaded physical invoice"
                              >
                                <Eye size={14} className="text-emerald-600 group-hover/btn:scale-110 transition-transform" />
                                <span>Bill</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right font-mono font-bold text-rose-600">
                            {ev.debit > 0 ? `₹${formatINR(ev.debit)}` : '—'}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-emerald-600">
                            {ev.credit > 0 ? `₹${formatINR(ev.credit)}` : '—'}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-black text-slate-900 bg-slate-50/50 group-hover:bg-slate-100/50 transition-colors">
                            ₹{formatINR(Math.abs(ev.balance || 0))} <span className="text-xs text-slate-400 ml-1">{(ev.balance || 0) >= 0 ? 'Cr' : 'Dr'}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100 bg-slate-50/30 mobile-cards">
              {!isSearchActive && (
                <div className="p-4 bg-amber-50/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-black uppercase">Opening</span>
                    <p className="font-mono font-black text-sm text-slate-900">
                      ₹{formatINR(Math.abs(openingBalance))} <span className="text-xs text-slate-500">{openingBalance >= 0 ? 'Cr' : 'Dr'}</span>
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">Opening Payable Balance</p>
                </div>
              )}

              {filteredEvents.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 text-sm font-medium">No transactions found.</div>
              ) : (
                filteredEvents.map((ev) => {
                  let bStyle = ''
                  let bColor = ''
                  if (ev.type === 'PURCHASE') { bStyle = 'bg-emerald-100 text-emerald-700'; bColor = 'bg-emerald-500' }
                  else if (ev.type === 'PAYMENT') { bStyle = 'bg-rose-100 text-rose-700'; bColor = 'bg-rose-500' }
                  else if (ev.type === 'RETURN') { bStyle = 'bg-purple-100 text-purple-700'; bColor = 'bg-purple-500' }

                  return (
                    <div key={ev.id + ev.type} className="p-4 relative bg-white">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bColor} opacity-50`}></div>
                      <div className="pl-2 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${bStyle}`}>
                              {ev.type}
                            </span>
                            <span className="text-xs font-medium text-slate-400">{formatDateDisplay(ev.date)}</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-slate-700">{ev.ref_no || '—'}</span>
                        </div>

                        <p className="text-sm text-slate-700 line-clamp-2">{ev.description || '—'}</p>

                        {/* Mobile Invoice Button */}
                        {ev.type === 'PURCHASE' && ev.invoice_url && (
                          <div className="pt-1">
                            <button
                              onClick={() => handleOpenInvoice(ev.invoice_url!, ev.ref_no, ev.date)}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl shadow-sm transition-all"
                            >
                              <Eye size={15} className="text-emerald-600" />
                              View Physical Invoice
                            </button>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-end bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Amount</p>
                            {ev.debit > 0 ? (
                              <p className="font-mono font-bold text-rose-600">Dr ₹{formatINR(ev.debit)}</p>
                            ) : (
                              <p className="font-mono font-bold text-emerald-600">Cr ₹{formatINR(ev.credit)}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Balance</p>
                            <p className="font-mono font-black text-slate-900">
                              ₹{formatINR(Math.abs(ev.balance || 0))} <span className="text-[10px] text-slate-500">{(ev.balance || 0) >= 0 ? 'Cr' : 'Dr'}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

          </div>
        )}

      </div>

      {/* ============ INVOICE VIEWER POPUP MODAL ============ */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in print-hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                    Physical Bill: {viewingInvoice.refNo}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bill Date: {formatDateDisplay(viewingInvoice.date)} • {selectedCompany?.company_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingInvoice.url && (
                  <a
                    href={viewingInvoice.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[72vh] custom-scrollbar">
              {viewingInvoice.loading ? (
                <div className="text-center py-12">
                  <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">Loading invoice document...</p>
                </div>
              ) : viewingInvoice.url ? (
                viewingInvoice.url.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={viewingInvoice.url}
                    title="Invoice PDF"
                    className="w-full h-[65vh] rounded-2xl border border-slate-200 bg-white"
                  />
                ) : !imgLoadError ? (
                  <img
                    src={viewingInvoice.url}
                    alt="Uploaded Bill"
                    onError={() => setImgLoadError(true)}
                    className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-md border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="text-center p-8 bg-white rounded-2xl border border-rose-100 max-w-md">
                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert size={24} />
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1">Unable to preview image directly</p>
                    <p className="text-xs text-slate-500 mb-4">
                      The file might be restricted by storage permissions or moved.
                    </p>
                    <a
                      href={viewingInvoice.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all"
                    >
                      <ExternalLink size={14} /> Open Direct File Link
                    </a>
                  </div>
                )
              ) : (
                <p className="text-slate-400 font-medium">No document available.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Satguru Beej Bhandar Accounting Document
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {viewingInvoice.url && (
                  <a
                    href={viewingInvoice.url}
                    download={`Bill_${sanitizeFilename(viewingInvoice.refNo)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} /> Download File
                  </a>
                )}
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}