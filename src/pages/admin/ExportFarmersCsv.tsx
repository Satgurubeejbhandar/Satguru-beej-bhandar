import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, Loader2, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Strict Type Definitions ─────────────────────────────────────────
type CreditAccountRelation = {
  current_outstanding: number | null
  available_credit: number | null
  due_date: string | null
}

type FarmerExportRow = {
  farmer_id: string
  farmer_name: string | null
  father_name: string | null
  mobile: string | null
  village: string | null
  credit_limit: number | null
  account_status: string | null
  repayment_days: number | null
  credit_accounts: CreditAccountRelation[] | CreditAccountRelation | null
}

// Local IST Date Helper
function getLocalDateString(offsetDays = 0): string {
  const date = new Date()
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 🛡️ Helper: Robust CSV Cell Escaper & Sanitizer (Prevents Formula Injection)
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  let str = String(val).trim()

  // Prevent CSV Formula Injection in MS Excel / Google Sheets (=, +, -, @, tab)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Escape internal double quotes by doubling them (" -> "")
  str = str.replace(/"/g, '""')

  // Wrap inside quotes
  return `"${str}"`
}

export default function ExportFarmersCsv() {
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')

  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const exportCsv = async () => {
    setLoading(true)
    setProgressText('Initiating data fetch...')

    try {
      const allFarmers: FarmerExportRow[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      // Chunked Pagination Loop (Bypasses Supabase 1000-row default limit)
      while (hasMore && isMountedRef.current) {
        const from = page * pageSize
        const to = from + pageSize - 1

        if (isMountedRef.current) {
          setProgressText(`Fetching records ${from + 1} onwards...`)
        }

        const { data, error } = await supabase
          .from('farmers')
          .select(`
            farmer_id, 
            farmer_name, 
            father_name, 
            mobile, 
            village, 
            credit_limit, 
            account_status, 
            repayment_days, 
            credit_accounts(current_outstanding, available_credit, due_date)
          `)
          .order('farmer_name', { ascending: true })
          .range(from, to)

        if (error) throw error

        if (!isMountedRef.current) return

        if (data && data.length > 0) {
          allFarmers.push(...(data as unknown as FarmerExportRow[]))
        }

        hasMore = (data?.length ?? 0) === pageSize
        page++
      }

      if (!isMountedRef.current) return

      if (allFarmers.length === 0) {
        toast.error('No farmer records found to export')
        return
      }

      if (isMountedRef.current) {
        setProgressText('Generating CSV File...')
      }

      // CSV Header Row
      const headers = [
        'Farmer ID',
        'Farmer Name',
        'Father Name',
        'Mobile Number',
        'Village',
        'Credit Limit (INR)',
        'Current Outstanding (INR)',
        'Available Credit (INR)',
        'Due Date',
        'Account Status',
      ]

      const csvLines: string[] = [headers.join(',')]

      // Process Rows safely
      allFarmers.forEach((f) => {
        let acc: CreditAccountRelation | undefined
        if (Array.isArray(f.credit_accounts)) {
          acc = f.credit_accounts[0]
        } else if (f.credit_accounts && typeof f.credit_accounts === 'object') {
          acc = f.credit_accounts
        }

        const row = [
          escapeCsvCell(f.farmer_id),
          escapeCsvCell(f.farmer_name),
          escapeCsvCell(f.father_name),
          escapeCsvCell(f.mobile),
          escapeCsvCell(f.village),
          f.credit_limit ?? '',
          acc?.current_outstanding ?? '',
          acc?.available_credit ?? '',
          escapeCsvCell(acc?.due_date),
          escapeCsvCell(f.account_status),
        ]
        csvLines.push(row.join(','))
      })

      // Generate Download File with UTF-8 BOM
      const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const localDate = getLocalDateString(0)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `farmers-master-export-${localDate}.csv`)

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => URL.revokeObjectURL(url), 1000)

      if (isMountedRef.current) {
        toast.success(`Successfully exported ${allFarmers.length} farmers (Aadhaar Excluded)`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      if (isMountedRef.current) {
        toast.error(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        setProgressText('')
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="text-amber-400" size={28} /> Export Farmers CSV
        </h1>
        <p className="text-emerald-200 text-xs mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          Admin Backup Utility · Sensitive Aadhaar Data Intentionally Excluded
        </p>
      </div>

      {/* Action Card */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-5">
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-left text-xs text-emerald-900 space-y-1">
          <p className="font-bold text-sm text-emerald-950">Export Includes:</p>
          <p>• Master details (ID, Name, Father Name, Village, Mobile)</p>
          <p>• Live Credit Balances (Limit, Current Outstanding, Available Credit, Due Date)</p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={exportCsv}
          className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl flex items-center justify-center gap-2 mx-auto transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {progressText || 'Preparing CSV...'}
            </>
          ) : (
            <>
              <Download size={18} /> Download Farmers CSV
            </>
          )}
        </button>
      </div>
    </div>
  )
}