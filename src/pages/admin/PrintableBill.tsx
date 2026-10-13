// src/pages/admin/PrintableBill.tsx

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

import {
  Printer,
  Loader2,
  Download,
  ShieldAlert,
  FileText,
  MessageCircle,
  Search,
  X,
  Check,
} from 'lucide-react'

import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'

import {
  SalesBillTemplate,
  BillTemplateData,
} from '../../components/SalesBillTemplate'


// ============================================================
// TYPES
// ============================================================

export interface BillSummaryOption {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number

  farmer: {
    farmer_name: string | null
    farmer_id: string | null
  } | null
}

type BillType = 'estimate' | 'gst'
type PrintSize = 'A4' | 'A5'


// ============================================================
// HELPERS
// ============================================================

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function formatINR(value: number): string {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Normalize Indian mobile for WhatsApp Business.
 * Returns digits only with country code, e.g. 919876543210
 */
function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null

  const cleaned = String(raw).replace(/[^\d+]/g, '')
  if (!cleaned) return null

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1)
    if (digits.length < 8 || digits.length > 15) return null
    return digits
  }

  const digits = cleaned.replace(/\D/g, '')

  if (digits.length === 10) {
    return `91${digits}`
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return digits
  }

  return null
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Open WhatsApp Business chat for farmer number.
 */
function openWhatsAppBusinessChat(phoneE164: string) {
  const phone = phoneE164.replace(/\D/g, '')
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && /Macintosh/i.test(navigator.userAgent))

  if (isMobile) {
    if (/Android/i.test(navigator.userAgent)) {
      const intentUrl =
        `intent://send?phone=${phone}` +
        `#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`

      window.location.href = intentUrl

      window.setTimeout(() => {
        window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
      }, 1200)
      return
    }

    window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
    return
  }

  window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
}


// ============================================================
// COMPONENT
// ============================================================

export default function PrintableBill() {
  const { role, loading: authLoading } = useAuth()

  const [bills, setBills] = useState<BillSummaryOption[]>([])
  const [billId, setBillId] = useState<string>('')
  const [billData, setBillData] = useState<BillTemplateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingBillDetails, setLoadingBillDetails] = useState(false)
  const [billType, setBillType] = useState<BillType>('estimate')
  const [printSize, setPrintSize] = useState<PrintSize>('A5')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  const isMounted = useRef(true)
  const requestIdRef = useRef(0)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  // ==========================================================
  // LOAD BILLS LIST
  // ==========================================================

  const init = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        if (isMounted.current) {
          toast.error('Session expired. Please sign in.')
        }
        return
      }

      const { data: billsData, error: billsErr } = await supabase
        .from('sales_bills')
        .select(`
          id,
          bill_number,
          bill_date,
          total_amount,
          farmer:farmers(
            farmer_name,
            farmer_id
          )
        `)
        .eq('bill_status', 'active')
        .order('created_at', { ascending: false })
        .limit(500)

      if (billsErr) throw billsErr
      if (!isMounted.current) return

      const normalizedBills: BillSummaryOption[] = (billsData || []).map(
        (bill: any) => ({
          id: String(bill.id),
          bill_number: bill.bill_number || 'N/A',
          bill_date: bill.bill_date || '',
          total_amount: Number(bill.total_amount || 0),
          farmer: Array.isArray(bill.farmer)
            ? bill.farmer[0] || null
            : bill.farmer || null,
        }),
      )

      setBills(normalizedBills)
    } catch (error) {
      console.error('Failed to load bills:', error)
      if (isMounted.current) {
        toast.error('Failed to load bills list.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [role])


  useEffect(() => {
    if (authLoading) return

    if (role !== 'admin') {
      setLoading(false)
      return
    }

    void init()
  }, [authLoading, role, init])


  // ==========================================================
  // FILTERED BILLS (SEARCH)
  // ==========================================================

  const filteredBills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return bills

    return bills.filter(bill => {
      const farmerName = (bill.farmer?.farmer_name || '').toLowerCase()
      const farmerId = (bill.farmer?.farmer_id || '').toLowerCase()
      const billNumber = (bill.bill_number || '').toLowerCase()
      return (
        farmerName.includes(q) ||
        farmerId.includes(q) ||
        billNumber.includes(q)
      )
    })
  }, [bills, searchQuery])


  // ==========================================================
  // LOAD BILL DETAILS
  // ==========================================================

  const loadBill = useCallback(
    async (idOrNumber: string) => {
      if (!idOrNumber) {
        setBillId('')
        setBillData(null)
        return
      }

      const currentRequestId = ++requestIdRef.current

      try {
        setLoadingBillDetails(true)

        let query = supabase
          .from('sales_bills')
          .select(`
            id,
            bill_number,
            bill_date,
            total_amount,
            is_gst_bill,
            bill_type,
            farmer:farmers(
              farmer_name,
              farmer_id,
              father_name,
              village,
              mobile
            ),
            sales_bill_items(
              id,
              product_name,
              batch_number,
              quantity,
              rate,
              total_amount,
              hsn_code,
              gst_percent,
              product:products(
                pack_size,
                pack_unit,
                company:companies(
                  company_name
                )
              )
            )
          `)

        if (isValidUUID(idOrNumber)) {
          query = query.eq('id', idOrNumber)
        } else {
          query = query.eq('bill_number', idOrNumber)
        }

        const { data, error } = await query.maybeSingle()

        if (!isMounted.current || currentRequestId !== requestIdRef.current) {
          return
        }

        if (error) throw error

        if (!data) {
          setBillId('')
          setBillData(null)
          toast.error('Bill details not found.')
          return
        }

        const farmerObj = Array.isArray(data.farmer)
          ? data.farmer[0] || null
          : data.farmer || null

        const normalizedBill: BillTemplateData = {
          bill_number: data.bill_number || 'N/A',
          bill_date: data.bill_date || '—',
          total_amount: Number(data.total_amount || 0),
          is_gst_bill: billType === 'gst',
          bill_type: data.bill_type || 'udhaar',
          farmer: farmerObj,
          items: (data.sales_bill_items || []).map((item: any) => {
            const product = Array.isArray(item.product)
              ? item.product[0]
              : item.product || null

            return {
              id: item.id,
              product_name: item.product_name || 'Product',
              batch_number: item.batch_number ?? null,
              quantity: Number(item.quantity || 0),
              rate: Number(item.rate || 0),
              total_amount: Number(item.total_amount || 0),
              hsn_code: item.hsn_code ?? null,
              gst_percent: Number(item.gst_percent || 0),
              pack_size: product?.pack_size ?? null,
              pack_unit: product?.pack_unit ?? null,
              company_name: product?.company?.company_name ?? null,
            }
          }),
        }

        setBillId(String(data.id))
        setBillData(normalizedBill)
      } catch (error) {
        console.error('Failed to load bill details:', error)
        if (
          isMounted.current &&
          currentRequestId === requestIdRef.current
        ) {
          toast.error('Failed to load bill details.')
        }
      } finally {
        if (
          isMounted.current &&
          currentRequestId === requestIdRef.current
        ) {
          setLoadingBillDetails(false)
        }
      }
    },
    [billType],
  )


  // ==========================================================
  // URL / SESSION BILL
  // ==========================================================

  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('billId')

    let fromSession: string | null = null

    try {
      fromSession =
        sessionStorage.getItem('print_bill_id') ||
        sessionStorage.getItem('print_bill_number')
    } catch {
      // ignore
    }

    const targetId = fromUrl || fromSession

    if (targetId) {
      void loadBill(targetId)

      try {
        sessionStorage.removeItem('print_bill_id')
        sessionStorage.removeItem('print_bill_number')
      } catch {
        // ignore
      }
    }
  }, [loading, loadBill])


  // ==========================================================
  // GST FLAG UPDATE
  // ==========================================================

  useEffect(() => {
    if (!billData) return

    setBillData(current =>
      current ? { ...current, is_gst_bill: billType === 'gst' } : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billType])


  // ==========================================================
  // PRINT
  // ==========================================================

  const handlePrint = useCallback(() => {
    if (!billData) {
      toast.error('Please select a bill first.')
      return
    }
    window.print()
  }, [billData])


  // ==========================================================
  // SHARED PDF FILENAME
  // ==========================================================

  const buildPdfFilename = useCallback((): string => {
    const prefix = billType === 'estimate' ? 'EST' : 'GST'
    const cleanBillNumber = String(billData?.bill_number || 'BILL')
      .replace(/^SALES[-_]?/i, '')
      .replace(/^BILL[-_]?/i, '')
      .replace(/[^\w.-]+/g, '_')

    return `${prefix}_${cleanBillNumber}_${printSize}.pdf`
  }, [billType, billData, printSize])


  // ==========================================================
  // REUSABLE HD PDF GENERATOR
  // ==========================================================

  const generateBillPdf = useCallback(async (): Promise<Blob> => {
    if (!billData) {
      throw new Error('Please select a bill first.')
    }

    const element = document.getElementById('printable-bill-area')
    if (!element) {
      throw new Error('Printable bill area not found.')
    }

    const originalStyle = element.getAttribute('style') || ''

    try {
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })

      if ('fonts' in document && (document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready
        } catch {
          // ignore
        }
      }

      const images = Array.from(element.querySelectorAll('img'))
      await Promise.all(
        images.map(img => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve()
          return new Promise<void>(resolve => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
            setTimeout(() => resolve(), 3000)
          })
        }),
      )

      const pageWidthMm = printSize === 'A4' ? 210 : 148
      const pageWidthPx = Math.round(pageWidthMm * 3.7795275591)

      element.classList.add('pdf-export-mode')
      element.style.width = `${pageWidthMm}mm`
      element.style.maxWidth = `${pageWidthMm}mm`
      element.style.minWidth = '0'
      element.style.height = 'auto'
      element.style.minHeight = '0'
      element.style.overflow = 'visible'
      element.style.background = '#ffffff'

      void element.offsetHeight

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve())
      })

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const finalScale = Math.max(3, dpr * 3)

      const options = {
        margin: 0,
        filename: buildPdfFilename(),
        image: {
          type: 'png',
          quality: 1.0,
        },
        html2canvas: {
          scale: finalScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: pageWidthPx,
          windowWidth: pageWidthPx,
          windowHeight: Math.max(element.scrollHeight, 1000),
          imageTimeout: 15000,
          removeContainer: true,
          letterRendering: true,
          foreignObjectRendering: false,
        },
        jsPDF: {
          unit: 'mm',
          format: printSize === 'A4' ? 'a4' : 'a5',
          orientation: 'portrait',
          compress: true,
          precision: 16,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', '.no-break', '.bill-header', '.bill-footer'],
        },
        enableLinks: true,
      }

      // Safe casting to avoid TypeScript errors with html2pdf
      const rawPdfBlob = await (html2pdf as any)()
        .set(options)
        .from(element)
        .output('blob')

      return new Blob([rawPdfBlob], { type: 'application/pdf' })
    } finally {
      element.classList.remove('pdf-export-mode')
      element.setAttribute('style', originalStyle)
    }
  }, [billData, printSize, buildPdfFilename])


  // ==========================================================
  // HD PDF DOWNLOAD
  // ==========================================================

  const handleDownloadPDF = useCallback(async () => {
    if (!billData) {
      toast.error('Please select a bill first.')
      return
    }
    if (downloadingPdf || sendingWhatsApp) return

    setDownloadingPdf(true)
    const toastId = toast.loading(`${printSize} HD PDF ban rahi hai...`)

    try {
      const pdfBlob = await generateBillPdf()
      const fileName = buildPdfFilename()
      triggerBrowserDownload(pdfBlob, fileName)

      toast.success(`${printSize} HD PDF successfully download ho gayi.`, {
        id: toastId,
      })
    } catch (error) {
      console.error('PDF generation failed:', error)
      toast.error(
        'PDF download nahi ho payi. Print → Save as PDF use karein.',
        { id: toastId },
      )
    } finally {
      if (isMounted.current) setDownloadingPdf(false)
    }
  }, [
    billData,
    printSize,
    downloadingPdf,
    sendingWhatsApp,
    generateBillPdf,
    buildPdfFilename,
  ])


  // ==========================================================
  // SEND PDF VIA WHATSAPP BUSINESS
  // ==========================================================

  const handleSendWhatsApp = useCallback(async () => {
    if (!billData) {
      toast.error('Please select a bill first.')
      return
    }

    const farmerMobile = billData.farmer?.mobile
    if (!farmerMobile) {
      toast.error('Farmer mobile number is not available.')
      return
    }

    const normalized = normalizeIndianMobile(farmerMobile)
    if (!normalized) {
      toast.error('Invalid farmer WhatsApp number.')
      return
    }

    if (sendingWhatsApp || downloadingPdf) return

    setSendingWhatsApp(true)
    const toastId = toast.loading('PDF तैयार हो रही है...')

    try {
      const pdfBlob = await generateBillPdf()
      const fileName = buildPdfFilename()
      const pdfFile = new File([pdfBlob], fileName, {
        type: 'application/pdf',
      })

      const canFileShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        typeof navigator.share === 'function' &&
        navigator.canShare({ files: [pdfFile] })

      if (canFileShare) {
        toast.loading('WhatsApp Business में शेयर करें...', { id: toastId })

        try {
          await navigator.share({
            files: [pdfFile],
            title: fileName,
          })

          toast.success(
            'WhatsApp Business में PDF attach हो गई। Send दबा दें.',
            { id: toastId },
          )
          return
        } catch (shareError: any) {
          if (
            shareError?.name === 'AbortError' ||
            shareError?.name === 'NotAllowedError'
          ) {
            toast.dismiss(toastId)
            return
          }
          console.error('Native share failed, using fallback:', shareError)
        }
      }

      toast.loading(
        'PDF download हो रही है और WhatsApp Business खुल रहा है...',
        { id: toastId },
      )

      triggerBrowserDownload(pdfBlob, fileName)
      openWhatsAppBusinessChat(normalized)

      toast.success(
        'PDF download हो गई है। WhatsApp Business चैट में PDF attach करके Send करें।',
        { id: toastId, duration: 7000 },
      )
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        toast.dismiss(toastId)
        return
      }

      console.error('WhatsApp Business share failed:', error)
      toast.error('PDF तैयार करने में समस्या आई।', { id: toastId })
    } finally {
      if (isMounted.current) setSendingWhatsApp(false)
    }
  }, [
    billData,
    downloadingPdf,
    sendingWhatsApp,
    generateBillPdf,
    buildPdfFilename,
  ])


  // ==========================================================
  // ACCESS DENIED
  // ==========================================================

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas bills print karne ki anumati nahi hai.
        </p>
      </div>
    )
  }


  // Handler for selecting a bill from dropdown
  const handleSelectBill = (bill: BillSummaryOption) => {
    void loadBill(bill.id)
    setSearchQuery('')
    setIsDropdownOpen(false)
  }

  // Get selected bill info for display
  const selectedBill = bills.find(b => b.id === billId)

  // ==========================================================
  // PAGE
  // ==========================================================

  const anyBusy = loadingBillDetails || downloadingPdf || sendingWhatsApp

  return (
    <div className="space-y-4 sm:space-y-6 printable-bill-page p-3 sm:p-4 max-w-7xl mx-auto">

      <style>{`

        /* GLOBAL PRINTABLE BILL */

        #printable-bill-area {
          box-sizing: border-box !important;
          display: block !important;
          position: relative;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          flex: none !important;
          float: none !important;
          transform: none !important;

          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;

          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        #printable-bill-area * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        #printable-bill-area.print-size-a4 {
          width: 210mm !important;
          max-width: 210mm !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
        }

        #printable-bill-area.print-size-a5 {
          width: 148mm !important;
          max-width: 148mm !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
        }

        #printable-bill-area > * {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          overflow: visible !important;
        }

        #printable-bill-area table {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed;
          border-collapse: collapse;
        }

        #printable-bill-area img {
          max-width: 100% !important;
          height: auto;
          object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
        }

        #printable-bill-area svg {
          max-width: 100% !important;
          shape-rendering: geometricPrecision;
        }

        #printable-bill-area input,
        #printable-bill-area textarea,
        #printable-bill-area select {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        #printable-bill-area td,
        #printable-bill-area th {
          overflow-wrap: anywhere;
          word-break: normal;
        }

        #printable-bill-area tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        #printable-bill-area .bill-header,
        #printable-bill-area .bill-footer,
        #printable-bill-area .no-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .printable-bill-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: visible;
          display: block;
          -webkit-overflow-scrolling: touch;
        }

        @media screen {
          #printable-bill-area {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          }
        }

        /* PDF EXPORT MODE */

        #printable-bill-area.pdf-export-mode {
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          background: #ffffff !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: geometricPrecision !important;
        }

        #printable-bill-area.pdf-export-mode * {
          max-width: 100% !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          text-shadow: none !important;
        }

        #printable-bill-area.pdf-export-mode table {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        #printable-bill-area.pdf-export-mode img {
          max-width: 100% !important;
          height: auto !important;
          image-rendering: -webkit-optimize-contrast !important;
        }

        /* PRINT */

        @media print {
          @page { margin: 0; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          body * { visibility: hidden; }

          #printable-bill-area,
          #printable-bill-area * { visibility: visible; }

          #printable-bill-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
          }

          #printable-bill-area.print-size-a4 {
            width: 210mm !important;
            max-width: 210mm !important;
            min-width: 0 !important;
          }

          #printable-bill-area.print-size-a5 {
            width: 148mm !important;
            max-width: 148mm !important;
            min-width: 0 !important;
          }

          #printable-bill-area > * {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }

          #printable-bill-area table {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
          }

          #printable-bill-area img {
            max-width: 100% !important;
            height: auto !important;
          }

          .print-hidden {
            display: none !important;
            visibility: hidden !important;
          }

          #printable-bill-area,
          #printable-bill-area * { overflow: visible !important; }

          * { box-shadow: none !important; }

          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .bill-header,
          .bill-footer,
          .no-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }

      `}</style>


      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl print-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="w-full">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Printer className="text-amber-400 shrink-0" size={24} />
            <span>Print & Download Bill</span>
          </h1>
          <p className="text-emerald-200 text-[11px] sm:text-xs mt-1">
            Estimate / GST • A4 / A5 • HD Quality PDF • WhatsApp Business
          </p>
        </div>
      </div>


      {/* CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm print-hidden space-y-5 max-w-4xl mx-auto">

        {/* BILL TYPE */}
        <div>
          <p className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
            1. Select Bill Format
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`border-2 p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${
                billType === 'estimate'
                  ? 'border-pink-500 bg-pink-50 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="billType"
                value="estimate"
                checked={billType === 'estimate'}
                onChange={() => setBillType('estimate')}
                className="w-4 h-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm">Estimate Bill</p>
                <p className="text-[10px] text-gray-500">
                  Pink Kacha Slip Format
                </p>
              </div>
            </label>

            <label
              className={`border-2 p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${
                billType === 'gst'
                  ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="billType"
                value="gst"
                checked={billType === 'gst'}
                onChange={() => setBillType('gst')}
                className="w-4 h-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm">
                  GST / Pukka Bill
                </p>
                <p className="text-[10px] text-gray-500">
                  Official White Format
                </p>
              </div>
            </label>
          </div>
        </div>


        {/* PAPER SIZE */}
        <div>
          <p className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
            2. Select Paper Size
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`border-2 p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${
                printSize === 'A5'
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="printSize"
                value="A5"
                checked={printSize === 'A5'}
                onChange={() => setPrintSize('A5')}
                className="w-4 h-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm">A5</p>
                <p className="text-[10px] text-gray-500">148 × 210 mm</p>
              </div>
            </label>

            <label
              className={`border-2 p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${
                printSize === 'A4'
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="printSize"
                value="A4"
                checked={printSize === 'A4'}
                onChange={() => setPrintSize('A4')}
                className="w-4 h-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm">A4</p>
                <p className="text-[10px] text-gray-500">210 × 297 mm</p>
              </div>
            </label>
          </div>
        </div>


        {/* BILL SEARCH & SELECT */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
            3. Search & Select Bill
          </label>

          {/* Show currently selected bill */}
          {selectedBill && !isDropdownOpen && (
            <div className="mb-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 bg-emerald-700 text-white rounded-lg flex items-center justify-center shrink-0">
                  <Check size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-emerald-950 text-sm truncate">
                    {selectedBill.farmer?.farmer_name || 'No Farmer'} — {selectedBill.bill_number}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-mono truncate">
                    {selectedBill.bill_date} • ₹{formatINR(selectedBill.total_amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBillId('')
                  setBillData(null)
                  setSearchQuery('')
                  setIsDropdownOpen(true)
                }}
                className="w-full sm:w-auto px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg hover:bg-emerald-100 cursor-pointer text-center shrink-0"
              >
                Change Bill
              </button>
            </div>
          )}

          {/* Search Input */}
          {!selectedBill && (
            <div className="relative" ref={searchWrapperRef}>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search by Farmer Name, Farmer ID or Bill No..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setIsDropdownOpen(true)
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  disabled={loading || authLoading || anyBusy}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl font-medium text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Search Dropdown Results */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-50 divide-y divide-gray-100">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading bills...
                    </div>
                  ) : filteredBills.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      {searchQuery
                        ? `No bills found matching "${searchQuery}"`
                        : 'No bills available.'}
                    </div>
                  ) : (
                    filteredBills.slice(0, 50).map(bill => (
                      <button
                        key={bill.id}
                        type="button"
                        onClick={() => handleSelectBill(bill)}
                        className="w-full text-left p-3 hover:bg-emerald-50 transition-colors flex justify-between items-start gap-2 text-xs cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 truncate">
                            {bill.farmer?.farmer_name || 'No Farmer'}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono truncate">
                            Bill: {bill.bill_number}
                            {bill.farmer?.farmer_id && ` • ID: ${bill.farmer.farmer_id}`}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            Date: {bill.bill_date}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                          ₹{formatINR(bill.total_amount)}
                        </span>
                      </button>
                    ))
                  )}
                  {filteredBills.length > 50 && (
                    <div className="p-2 text-center text-[10px] text-gray-500 bg-gray-50">
                      Showing top 50 of {filteredBills.length} results. Type more to refine.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>


        {/* ACTION BUTTONS */}
        {billData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={handlePrint}
              disabled={anyBusy}
              className="px-4 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer size={16} />
              <span className="truncate">Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={anyBusy}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {downloadingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span className="truncate">
                {downloadingPdf ? 'Generating...' : `Download ${printSize} PDF`}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={anyBusy || !billData?.farmer?.mobile}
              title={
                !billData?.farmer?.mobile
                  ? 'Farmer mobile number missing'
                  : 'WhatsApp Business पर PDF भेजें'
              }
              className="px-4 py-3 bg-[#25D366] hover:bg-[#1ebe57] disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {sendingWhatsApp ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MessageCircle size={16} />
              )}
              <span className="truncate">
                {sendingWhatsApp ? 'Preparing...' : 'Send WhatsApp'}
              </span>
            </button>
          </div>
        )}


        {/* INFO */}
        {billData && (
          <div className="flex items-start gap-2 rounded-xl bg-gray-50 border p-3 text-[11px] sm:text-xs text-gray-600">
            <FileText
              size={16}
              className="mt-0.5 text-blue-600 shrink-0"
            />
            <p className="min-w-0">
              Selected paper: <strong>{printSize}</strong>
              <br />
              <strong>Download {printSize} HD PDF</strong> — High Definition
              lossless PDF (PNG based, full colors, sharp text).
              <br />
              <strong>Print / Save as PDF</strong> — Browser का print dialog खोलेगा।
              <br />
              <strong>Send on WhatsApp Business</strong> — वही HD PDF बनेगी।
              Mobile पर share sheet में <strong>WhatsApp Business</strong> चुनें।
              Computer पर PDF download + farmer chat खुलेगी — PDF attach करके Send करें।
            </p>
          </div>
        )}
      </div>


      {/* LOADING */}
      {loadingBillDetails && (
        <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2 print-hidden">
          <Loader2 size={20} className="animate-spin text-emerald-800" />
          Loading bill details...
        </div>
      )}


      {/* BILL */}
      {!loadingBillDetails && billData && (
        <div className="printable-bill-wrapper w-full overflow-x-auto print:overflow-visible pb-4">
          <div
            id="printable-bill-area"
            className={`bg-white ${
              printSize === 'A4' ? 'print-size-a4' : 'print-size-a5'
            }`}
          >
            <SalesBillTemplate bill={billData} />
          </div>
        </div>
      )}
    </div>
  )
}