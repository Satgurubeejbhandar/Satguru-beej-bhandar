// src/pages/admin/VillageWiseFarmers.tsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FC,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  MapPin,
  Search,
  Loader2,
  Users,
  IndianRupee,
  CreditCard,
  UserCheck,
  Download,
  Printer,
  Filter,
  X,
  Wallet,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

// 🚀 Pure Vector PDF Engine Imports
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ──────────────────────────────────────────────
   Type Definitions
   ────────────────────────────────────────────── */

interface CreditAccount {
  current_outstanding?: number | string | null
  credit_limit?: number | string | null
  available_credit?: number | string | null
  updated_at?: string | null
}

interface FarmerRow {
  id: string | number
  farmer_id: string | null
  farmer_name: string | null
  father_name: string | null
  mobile: string | null
  village: string | null
  credit_limit?: number | string | null
  outstanding_balance?: number | string | null
  credit_accounts?: CreditAccount[] | CreditAccount | null
}

interface EnrichedFarmer extends FarmerRow {
  _outstanding: number
  _availableCredit: number
  _creditLimit: number
}

interface Summary {
  farmers: number
  outstanding: number
  credit: number
  availableCredit: number
}

type VillageLoadState = 'idle' | 'loading' | 'loaded' | 'error'

interface OutstandingOption {
  key: string
  label: string
  test: (outstanding: number) => boolean
  pdfLabel: string
  fileLabel: string
}

const OUTSTANDING_OPTIONS: OutstandingOption[] = [
  {
    key: 'all',
    label: 'All Farmers',
    test: () => true,
    pdfLabel: 'All Farmers',
    fileLabel: 'All',
  },
  {
    key: 'lte_10000',
    label: '≤ ₹10,000',
    test: (o) => o <= 10000,
    pdfLabel: 'Outstanding ₹10,000 or below',
    fileLabel: 'Upto_10000',
  },
  {
    key: 'lte_20000',
    label: '≤ ₹20,000',
    test: (o) => o <= 20000,
    pdfLabel: 'Outstanding ₹20,000 or below',
    fileLabel: 'Upto_20000',
  },
  {
    key: 'lte_30000',
    label: '≤ ₹30,000',
    test: (o) => o <= 30000,
    pdfLabel: 'Outstanding ₹30,000 or below',
    fileLabel: 'Upto_30000',
  },
  {
    key: 'lte_40000',
    label: '≤ ₹40,000',
    test: (o) => o <= 40000,
    pdfLabel: 'Outstanding ₹40,000 or below',
    fileLabel: 'Upto_40000',
  },
  {
    key: 'lte_50000',
    label: '≤ ₹50,000',
    test: (o) => o <= 50000,
    pdfLabel: 'Outstanding ₹50,000 or below',
    fileLabel: 'Upto_50000',
  },
  {
    key: 'lte_60000',
    label: '≤ ₹60,000',
    test: (o) => o <= 60000,
    pdfLabel: 'Outstanding ₹60,000 or below',
    fileLabel: 'Upto_60000',
  },
  {
    key: 'lte_70000',
    label: '≤ ₹70,000',
    test: (o) => o <= 70000,
    pdfLabel: 'Outstanding ₹70,000 or below',
    fileLabel: 'Upto_70000',
  },
  {
    key: 'lte_80000',
    label: '≤ ₹80,000',
    test: (o) => o <= 80000,
    pdfLabel: 'Outstanding ₹80,000 or below',
    fileLabel: 'Upto_80000',
  },
  {
    key: 'lte_90000',
    label: '≤ ₹90,000',
    test: (o) => o <= 90000,
    pdfLabel: 'Outstanding ₹90,000 or below',
    fileLabel: 'Upto_90000',
  },
  {
    key: 'lte_100000',
    label: '≤ ₹1,00,000',
    test: (o) => o <= 100000,
    pdfLabel: 'Outstanding ₹1,00,000 or below',
    fileLabel: 'Upto_100000',
  },
  {
    key: 'gt_100000',
    label: '> ₹1,00,000',
    test: (o) => o > 100000,
    pdfLabel: 'Outstanding above ₹1,00,000',
    fileLabel: 'Above_100000',
  },
]

const ALL_VILLAGES = '__ALL__'

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function safeNumber(val: unknown): number {
  if (val == null || val === '') return 0
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function roundCurrency(val: number): number {
  return Math.round(val * 100) / 100
}

function formatINR(val: number): string {
  return safeNumber(val).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
}

function pickCreditAccount(
  raw: CreditAccount[] | CreditAccount | null | undefined
): CreditAccount | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    if (raw.length === 1) return raw[0]
    const sorted = [...raw].sort((a, b) => {
      const ta = a.updated_at ? Date.parse(a.updated_at) : 0
      const tb = b.updated_at ? Date.parse(b.updated_at) : 0
      return tb - ta
    })
    return sorted[0]
  }
  return raw
}

function extractFarmerOutstanding(farmer: FarmerRow): number {
  const acc = pickCreditAccount(farmer.credit_accounts)
  if (acc && acc.current_outstanding !== undefined && acc.current_outstanding !== null) {
    return roundCurrency(safeNumber(acc.current_outstanding))
  }
  return roundCurrency(safeNumber(farmer.outstanding_balance))
}

function extractFarmerCreditLimit(farmer: FarmerRow): number {
  const acc = pickCreditAccount(farmer.credit_accounts)
  if (acc && acc.credit_limit !== undefined && acc.credit_limit !== null) {
    return roundCurrency(safeNumber(acc.credit_limit))
  }
  return roundCurrency(safeNumber(farmer.credit_limit))
}

function extractFarmerAvailableCredit(farmer: FarmerRow): number {
  const acc = pickCreditAccount(farmer.credit_accounts)
  if (acc && acc.available_credit !== undefined && acc.available_credit !== null) {
    return Math.max(0, roundCurrency(safeNumber(acc.available_credit)))
  }
  const limit = extractFarmerCreditLimit(farmer)
  const outstanding = extractFarmerOutstanding(farmer)
  return Math.max(0, roundCurrency(limit - outstanding))
}

function enrichFarmer(f: FarmerRow): EnrichedFarmer {
  return {
    ...f,
    _outstanding: extractFarmerOutstanding(f),
    _availableCredit: extractFarmerAvailableCredit(f),
    _creditLimit: extractFarmerCreditLimit(f),
  }
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export const VillageWiseFarmers: FC = () => {
  const { role, loading: authLoading } = useAuth()
  const [village, setVillage] = useState<string>(ALL_VILLAGES)
  const [outstandingKey, setOutstandingKey] = useState<string>('all')

  const [villages, setVillages] = useState<string[]>([])
  const [villageLoadState, setVillageLoadState] =
    useState<VillageLoadState>('idle')

  const [rawFarmers, setRawFarmers] = useState<EnrichedFarmer[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [hasSearched, setHasSearched] = useState<boolean>(false)
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)
  const villageListAbortRef = useRef<AbortController | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      villageListAbortRef.current?.abort()
      searchAbortRef.current?.abort()
    }
  }, [])

  /* Load unique villages */
  const loadVillages = useCallback(async () => {
    if (role !== 'admin') return

    if (villageListAbortRef.current) villageListAbortRef.current.abort()
    const controller = new AbortController()
    villageListAbortRef.current = controller

    setVillageLoadState('loading')
    try {
      const { data, error } = await supabase
        .from('farmers')
        .select('village')
        .eq('account_status', 'active')
        .not('village', 'is', null)
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return
      if (error) throw error

      const rawData = (data as unknown as { village: string }[]) ?? []
      const unique = Array.from(
        new Set(rawData.map((d) => d.village).filter(Boolean))
      ).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      )

      if (isMounted.current) {
        setVillages(unique)
        setVillageLoadState('loaded')
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (isMounted.current) {
        setVillageLoadState('error')
        const msg =
          err instanceof Error ? err.message : 'Failed to load village list.'
        toast.error(msg)
      }
    }
  }, [role])

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadVillages()
    }
  }, [loadVillages, role, authLoading])

  /* Load farmers for selected village (or ALL) */
  const loadFarmers = useCallback(async (v: string) => {
    if (role !== 'admin') return

    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setLoading(true)
    setHasSearched(true)

    try {
      let query = supabase
        .from('farmers')
        .select('*, credit_accounts(*)')
        .eq('account_status', 'active')
        .order('farmer_name', { ascending: true })

      if (v !== ALL_VILLAGES) {
        query = query.eq('village', v)
      }

      const { data, error } = await query.abortSignal(controller.signal)

      if (controller.signal.aborted) return
      if (error) throw error

      const list = (data as unknown as FarmerRow[]) ?? []
      const enriched = list.map(enrichFarmer)

      if (isMounted.current) setRawFarmers(enriched)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : 'Search failed.'
        toast.error(msg)
        setRawFarmers([])
      }
    } finally {
      if (isMounted.current && !controller.signal.aborted) setLoading(false)
    }
  }, [role])

  /* Auto-load on village change */
  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadFarmers(village)
    }
  }, [village, loadFarmers, role, authLoading])

  const outstandingOption = useMemo(
    () =>
      OUTSTANDING_OPTIONS.find((o) => o.key === outstandingKey) ||
      OUTSTANDING_OPTIONS[0],
    [outstandingKey]
  )

  const filteredFarmers = useMemo(() => {
    return rawFarmers.filter((f) => outstandingOption.test(f._outstanding))
  }, [rawFarmers, outstandingOption])

  const summary: Summary = useMemo(() => {
    let outstanding = 0
    let credit = 0
    let availableCredit = 0
    for (const f of filteredFarmers) {
      outstanding += f._outstanding
      credit += f._creditLimit
      availableCredit += f._availableCredit
    }
    return {
      farmers: filteredFarmers.length,
      outstanding: roundCurrency(outstanding),
      credit: roundCurrency(credit),
      availableCredit: roundCurrency(availableCredit),
    }
  }, [filteredFarmers])

  const villageLabel = village === ALL_VILLAGES ? 'All Villages' : village

  const clearFilters = () => {
    setVillage(ALL_VILLAGES)
    setOutstandingKey('all')
  }

  /* ─── 🚀 PURE VECTOR PDF GENERATOR (Netlify Guaranteed) ─── */
  const handleDownloadPDF = async () => {
    if (filteredFarmers.length === 0) {
      toast.error('कोई डेटा उपलब्ध नहीं है')
      return
    }
    if (downloadingPdf) return

    setDownloadingPdf(true)
    const toastId = toast.loading('PDF तैयार हो रही है...')

    try {
      // 1. Initialize jsPDF Document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const dateStr = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      // 2. Add Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(6, 78, 59) // Emerald-900
      doc.text('SATGURU BEEJ BHANDAR', 105, 14, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text('Daloosar, Sardarshahar (Churu), Rajasthan', 105, 19, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(6, 95, 70)
      doc.text('VILLAGE-WISE FARMERS REPORT', 105, 25, { align: 'center' })

      // Header Divider Line
      doc.setDrawColor(6, 78, 59)
      doc.setLineWidth(0.5)
      doc.line(14, 28, 196, 28)

      // 3. Filter Information Box
      doc.setFillColor(248, 250, 252)
      doc.rect(14, 31, 182, 12, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(14, 31, 182, 12, 'S')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 85, 105)
      doc.text(`Village: `, 18, 36)
      doc.setTextColor(6, 78, 59)
      doc.text(`${villageLabel}`, 30, 36)

      doc.setTextColor(71, 85, 105)
      doc.text(`Filter: `, 90, 36)
      doc.setTextColor(6, 78, 59)
      doc.text(`${outstandingOption.pdfLabel}`, 102, 36)

      doc.setTextColor(71, 85, 105)
      doc.text(`Generated: `, 18, 40)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(15, 23, 42)
      doc.text(`${dateStr}`, 35, 40)

      // 4. Summary KPI Table
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')

      // Farmers Count Box
      doc.setFillColor(238, 242, 255)
      doc.rect(14, 46, 42, 12, 'F')
      doc.setTextColor(71, 85, 105)
      doc.text('TOTAL FARMERS', 16, 50)
      doc.setTextColor(49, 46, 129)
      doc.text(`${summary.farmers}`, 16, 55)

      // Outstanding Box
      doc.setFillColor(255, 241, 242)
      doc.rect(60, 46, 42, 12, 'F')
      doc.setTextColor(71, 85, 105)
      doc.text('TOTAL OUTSTANDING', 62, 50)
      doc.setTextColor(159, 18, 57)
      doc.text(`Rs. ${formatINR(summary.outstanding)}`, 62, 55)

      // Credit Limit Box
      doc.setFillColor(236, 253, 245)
      doc.rect(106, 46, 42, 12, 'F')
      doc.setTextColor(71, 85, 105)
      doc.text('CREDIT LIMIT', 108, 50)
      doc.setTextColor(6, 95, 70)
      doc.text(`Rs. ${formatINR(summary.credit)}`, 108, 55)

      // Available Credit Box
      doc.setFillColor(240, 249, 255)
      doc.rect(152, 46, 44, 12, 'F')
      doc.setTextColor(71, 85, 105)
      doc.text('AVAILABLE CREDIT', 154, 50)
      doc.setTextColor(12, 74, 110)
      doc.text(`Rs. ${formatINR(summary.availableCredit)}`, 154, 55)

      // 5. Prepare AutoTable Data
      const tableData = filteredFarmers.map((f) => [
        f.farmer_id || '—',
        f.farmer_name || '—',
        f.father_name || '—',
        f.village || '—',
        f.mobile || '—',
        `Rs. ${formatINR(f._outstanding)}`,
        `Rs. ${formatINR(f._availableCredit)}`,
      ])

      // 6. Generate Vector Table
      autoTable(doc, {
        startY: 62,
        head: [[
          'Farmer ID',
          'Farmer Name',
          'Father Name',
          'Village',
          'Mobile',
          'Outstanding',
          'Avail. Credit'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [6, 78, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [15, 23, 42],
        },
        columnStyles: {
          0: { cellWidth: 24, fontStyle: 'bold' },
          1: { cellWidth: 32, fontStyle: 'bold' },
          2: { cellWidth: 30 },
          3: { cellWidth: 26 },
          4: { cellWidth: 24 },
          5: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: [159, 18, 57] },
          6: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: [6, 95, 70] },
        },
        foot: [[
          `TOTAL (${summary.farmers} Farmers)`,
          '',
          '',
          '',
          '',
          `Rs. ${formatINR(summary.outstanding)}`,
          `Rs. ${formatINR(summary.availableCredit)}`
        ]],
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [2, 44, 34],
          fontSize: 8,
          fontStyle: 'bold',
        },
        didDrawPage: (data) => {
          // Page Footer
          const pageCount = doc.getNumberOfPages()
          doc.setFontSize(7)
          doc.setTextColor(100, 116, 139)
          doc.text(
            `Satguru Beej Bhandar · Page ${data.pageNumber} of ${pageCount}`,
            105,
            287,
            { align: 'center' }
          )
        },
      })

      // 7. Save PDF
      const filename = sanitizeFilename(
        `Farmers_${villageLabel.replace(/\s+/g, '_')}_${
          outstandingOption.fileLabel
        }_${new Date().toISOString().split('T')[0]}.pdf`
      )

      doc.save(filename)
      toast.success('PDF सफलतापूर्वक डाउनलोड हो गई!', { id: toastId })
    } catch (err) {
      console.error('[Vector PDF Generation Error]', err)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`PDF डाउनलोड नहीं हो सकी (${errMsg})`, { id: toastId })
    } finally {
      if (isMounted.current) setDownloadingPdf(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const hasResults = hasSearched && filteredFarmers.length > 0
  const showActions = hasSearched && rawFarmers.length > 0

  /* ---- Admin Gate Check ---- */
  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2 mt-10 shadow-sm font-sans">
        <ShieldAlert className="inline-block text-red-600 animate-bounce" size={40} />
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">Aapke paas Village-wise Farmers List की अनुमति नहीं है।</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-2 sm:px-0 font-sans">
      {/* Print CSS */}
      <style>{`
        #print-village-report table { border-collapse: collapse; width: 100%; }
        #print-village-report thead { display: table-header-group; }
        #print-village-report tr { page-break-inside: avoid; break-inside: avoid; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden !important; }
          #print-village-report, #print-village-report * { visibility: visible !important; }
          #print-village-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hidden">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <MapPin className="text-amber-400" size={28} aria-hidden="true" />
            Village-wise Farmers (ग्राम अनुसार किसान सूची)
          </h1>
          <p className="text-emerald-200 text-xs mt-1 font-medium">
            Village + Outstanding filters · Multi-page Vector PDF · Real-time summary
          </p>
        </div>

        {showActions && (
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasResults}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer flex-1 md:flex-none shadow-md disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Print (A4)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || loading || !hasResults}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 flex-1 md:flex-none shadow-md"
            >
              {downloadingPdf ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>
                {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm print-hidden">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-emerald-700" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Filters
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Village */}
          <div className="space-y-1">
            <label
              htmlFor="village-select"
              className="text-[10px] font-bold text-slate-600 uppercase tracking-wider"
            >
              Village
            </label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-slate-50">
              <Search
                className="text-slate-400 shrink-0"
                size={16}
                aria-hidden="true"
              />
              <select
                id="village-select"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                disabled={villageLoadState === 'loading'}
                className="w-full outline-none font-bold text-xs bg-transparent py-0.5 disabled:opacity-50 cursor-pointer"
                aria-label="Select village to view farmers"
              >
                <option value={ALL_VILLAGES}>
                  🌍 All Villages ({villages.length})
                </option>
                {villages.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {villageLoadState === 'loading' && (
                <Loader2
                  className="animate-spin text-emerald-600 shrink-0"
                  size={14}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Outstanding */}
          <div className="space-y-1">
            <label
              htmlFor="outstanding-select"
              className="text-[10px] font-bold text-slate-600 uppercase tracking-wider"
            >
              Outstanding Filter
            </label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-slate-50">
              <IndianRupee
                className="text-slate-400 shrink-0"
                size={16}
                aria-hidden="true"
              />
              <select
                id="outstanding-select"
                value={outstandingKey}
                onChange={(e) => setOutstandingKey(e.target.value)}
                className="w-full outline-none font-bold text-xs bg-transparent py-0.5 cursor-pointer"
                aria-label="Filter by outstanding limit"
              >
                {OUTSTANDING_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
              &nbsp;
            </label>
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-300"
            >
              <X size={14} />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px]">
          <span className="font-bold text-slate-500 uppercase">Active:</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-bold">
            Village: {villageLabel}
          </span>
          <span className="px-2 py-0.5 bg-rose-100 text-rose-900 rounded-md font-bold">
            {outstandingOption.label}
          </span>
        </div>
      </div>

      {/* On-Screen Report */}
      <div id="print-village-report" className="space-y-4">
        {/* Summary KPI Cards */}
        {showActions && !loading && (
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            role="region"
            aria-label={`Summary for ${villageLabel}`}
            aria-live="polite"
          >
            <div
              style={{ borderLeft: '4px solid #6366f1' }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-indigo-500" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  Farmers
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {summary.farmers}
              </p>
            </div>
            <div
              style={{ borderLeft: '4px solid #f43f5e' }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <IndianRupee size={14} className="text-rose-500" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  Outstanding
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                ₹{formatINR(summary.outstanding)}
              </p>
            </div>
            <div
              style={{ borderLeft: '4px solid #10b981' }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={14} className="text-emerald-500" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  Credit Limit
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
                ₹{formatINR(summary.credit)}
              </p>
            </div>
            <div
              style={{ borderLeft: '4px solid #0284c7' }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-sky-500" />
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  Available Credit
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-black text-sky-800 font-mono">
                ₹{formatINR(summary.availableCredit)}
              </p>
            </div>
          </div>
        )}

        {/* Farmer Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-xs text-left min-w-[880px]"
              aria-label="Farmer details by village"
            >
              <thead>
                <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wide text-[11px]">
                  <th className="p-3.5 whitespace-nowrap">Farmer ID</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Father</th>
                  <th className="p-3.5">Village</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5 text-right whitespace-nowrap">
                    Outstanding
                  </th>
                  <th className="p-3.5 text-right whitespace-nowrap">
                    Avail. Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      <Loader2
                        className="animate-spin mx-auto mb-2 text-emerald-600"
                        size={20}
                      />
                      Loading farmers…
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      <MapPin size={28} className="mx-auto mb-2 text-slate-300 animate-bounce" />
                      Please select a village above to load results.
                    </td>
                  </tr>
                ) : rawFarmers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      <UserCheck
                        size={28}
                        className="mx-auto mb-2 text-slate-300"
                      />
                      No active farmers found
                      {village !== ALL_VILLAGES ? ` in "${village}"` : ''}.
                    </td>
                  </tr>
                ) : filteredFarmers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      <Filter
                        size={28}
                        className="mx-auto mb-2 text-slate-300"
                      />
                      No farmers match the selected outstanding filter (
                      {outstandingOption.label}).
                      <br />
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-emerald-700 underline text-[11px] mt-2 font-bold cursor-pointer"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredFarmers.map((f) => (
                    <tr
                      key={f.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-3.5 font-mono font-bold text-emerald-800 text-[11px] whitespace-nowrap">
                        {f.farmer_id ?? '—'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 text-sm">
                        {f.farmer_name ?? '—'}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {f.father_name ?? '—'}
                      </td>
                      <td className="p-3.5 text-slate-800 font-medium">
                        {f.village ?? '—'}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                        {f.mobile ?? '—'}
                      </td>
                      <td className="p-3.5 text-right font-black text-rose-700 tabular-nums whitespace-nowrap font-mono">
                        ₹{formatINR(f._outstanding)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-800 tabular-nums whitespace-nowrap font-mono">
                        ₹{formatINR(f._availableCredit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {hasResults && (
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-900 font-black text-slate-900">
                    <td colSpan={5} className="p-3.5 uppercase text-xs">
                      Total ({summary.farmers} farmers)
                    </td>
                    <td className="p-3.5 text-right text-rose-700 font-mono text-sm">
                      ₹{formatINR(summary.outstanding)}
                    </td>
                    <td className="p-3.5 text-right text-emerald-800 font-mono text-sm">
                      ₹{formatINR(summary.availableCredit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {hasResults && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 font-bold flex flex-wrap justify-between items-center gap-2">
              <span>
                Showing {summary.farmers} farmer
                {summary.farmers !== 1 ? 's' : ''}{' '}
                {village === ALL_VILLAGES
                  ? 'from all villages'
                  : `from ${village}`}
                {outstandingKey !== 'all' && ` · ${outstandingOption.label}`}
              </span>
              <span className="text-slate-400 hidden sm:inline">
                Satguru Beej Bhandar
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VillageWiseFarmers