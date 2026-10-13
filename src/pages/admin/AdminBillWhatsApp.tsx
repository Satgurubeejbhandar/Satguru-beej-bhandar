import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Share2, Receipt, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface FarmerJoin {
  farmer_name: string | null
  farmer_id: string | null
  mobile: string | null
}

interface SalesBillItem {
  id?: string
  product_name: string | null
  quantity: number | string | null
  rate: number | string | null
  total_amount: number | string | null
}

interface SalesBill {
  id: string
  bill_number: string | null
  bill_date: string | null
  bill_status: string | null
  total_amount: number | string | null
  previous_outstanding: number | string | null
  new_outstanding: number | string | null
  created_at?: string | null
  farmer: FarmerJoin | FarmerJoin[] | null
  sales_bill_items: SalesBillItem[] | null
}

const DEFAULT_BUSINESS_NAME = 'SATGURU BEEJ BHANDAR'

function asFarmer(farmer: SalesBill['farmer']): FarmerJoin | null {
  if (!farmer) return null
  return Array.isArray(farmer) ? farmer[0] || null : farmer
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatINR(value: number | string | null | undefined): string {
  return toNumber(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Normalize Indian mobile for wa.me / api.whatsapp.com */
function normalizeWhatsAppPhone(mobile: string | null | undefined): string | null {
  if (!mobile) return null
  const digits = mobile.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  if (digits.length >= 10) return digits
  return null
}

export default function AdminBillWhatsApp() {
  const [bills, setBills] = useState<SalesBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME)
  const [sharingId, setSharingId] = useState<string | null>(null)

  const loadBusinessName = useCallback(async (isMounted: () => boolean) => {
    try {
      const { data, error: settingsError } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'business_name')
        .maybeSingle()

      if (!settingsError && data?.setting_value && isMounted()) {
        setBusinessName(String(data.setting_value))
      }
    } catch {
      // Non-blocking: keep default business name
    }
  }, [])

  const loadBills = useCallback(async (isMounted: () => boolean) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('sales_bills')
        .select(
          `
          id,
          bill_number,
          bill_date,
          bill_status,
          total_amount,
          previous_outstanding,
          new_outstanding,
          created_at,
          farmer:farmers(
            farmer_name,
            farmer_id,
            mobile
          ),
          sales_bill_items(
            id,
            product_name,
            quantity,
            rate,
            total_amount
          )
        `
        )
        .eq('bill_status', 'active')
        .order('created_at', { ascending: false })
        .limit(30)

      if (fetchError) {
        throw fetchError
      }

      if (isMounted()) {
        setBills((data as SalesBill[]) || [])
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to load bills'

      if (isMounted()) {
        setError(message)
        setBills([])
        toast.error(message)
      }
    } finally {
      if (isMounted()) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const isMounted = () => mounted

    void loadBusinessName(isMounted)
    void loadBills(isMounted)

    return () => {
      mounted = false
    }
  }, [loadBusinessName, loadBills])

  const buildMessage = (bill: SalesBill): string => {
    const farmer = asFarmer(bill.farmer)
    const items = (bill.sales_bill_items || [])
      .map((item) => {
        const name = item.product_name || 'Item'
        const qty = formatINR(item.quantity)
        const rate = formatINR(item.rate)
        const lineTotal = formatINR(item.total_amount)
        return `• ${name} | ${qty} x ₹${rate} = ₹${lineTotal}`
      })
      .join('\n')

    const itemsBlock = items || '• (No line items)'

    return (
      `🌾 *${businessName} — UDHAAR BILL*\n` +
      `-----------------------------------\n` +
      `Farmer: ${farmer?.farmer_name || '—'}\n` +
      `Farmer ID: ${farmer?.farmer_id || '—'}\n` +
      `Bill No: ${bill.bill_number || '—'}\n` +
      `Date: ${formatDate(bill.bill_date)}\n` +
      `-----------------------------------\n` +
      `${itemsBlock}\n` +
      `-----------------------------------\n` +
      `Bill Total: ₹${formatINR(bill.total_amount)}\n` +
      `Prev Outstanding: ₹${formatINR(bill.previous_outstanding)}\n` +
      `New Outstanding: ₹${formatINR(bill.new_outstanding)}\n` +
      `-----------------------------------\n` +
      `Kisi bhi dawai ka galat use aapki zimmedari. ${businessName} zimmedar nahi.\n` +
      `JAI JAWAN JAI KISAN`
    )
  }

  const share = (bill: SalesBill) => {
    const farmer = asFarmer(bill.farmer)
    const farmerLabel = farmer?.farmer_name || bill.bill_number || 'this bill'

    const confirmed = window.confirm(
      `Share bill ${bill.bill_number || ''} for ${farmerLabel} on WhatsApp?\n\nAadhaar is never included in this message.`
    )
    if (!confirmed) return

    try {
      setSharingId(bill.id)
      const msg = buildMessage(bill)
      const phone = normalizeWhatsAppPhone(farmer?.mobile || null)

      const url = phone
        ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`

      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        toast.error('Popup blocked. Please allow popups for WhatsApp share.')
        return
      }

      if (!phone) {
        toast('Mobile number missing — choose contact manually in WhatsApp.', { icon: '📱' })
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to open WhatsApp'
      toast.error(message)
    } finally {
      setSharingId(null)
    }
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Share2 className="text-amber-400" size={28} /> Admin Bill WhatsApp Share
            </h1>
            <p className="text-emerald-200 text-xs mt-1">
              ONLY Admin — Farmer portal me ye option nahi hai. Bill/payment business share only (no Aadhaar).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              let mounted = true
              void loadBills(() => mounted)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-xs font-bold transition-colors"
            aria-label="Refresh bills"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Could not load bills</p>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[640px]" aria-label="Active sales bills for WhatsApp share">
            <thead>
              <tr className="bg-emerald-900 text-white font-extrabold uppercase tracking-wider">
                <th scope="col" className="p-3.5">Bill</th>
                <th scope="col" className="p-3.5">Farmer</th>
                <th scope="col" className="p-3.5">Amount</th>
                <th scope="col" className="p-3.5">Outstanding After</th>
                <th scope="col" className="p-3.5 text-center">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Loading bills...
                    </span>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500">
                    No active bills found.
                  </td>
                </tr>
              ) : (
                bills.map((b) => {
                  const farmer = asFarmer(b.farmer)
                  const isSharing = sharingId === b.id

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-mono font-bold flex items-center gap-1 text-gray-900">
                          <Receipt size={12} className="text-emerald-700" />
                          {b.bill_number || '—'}
                        </span>
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {formatDate(b.bill_date)}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-gray-800">
                        {farmer?.farmer_name || '—'}
                        <span className="block text-[10px] font-mono text-gray-500 mt-0.5">
                          {farmer?.farmer_id || '—'}
                          {farmer?.mobile ? ` · ${farmer.mobile}` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-gray-900">
                        ₹{formatINR(b.total_amount)}
                      </td>
                      <td className="p-3.5 font-bold text-rose-700">
                        ₹{formatINR(b.new_outstanding)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => share(b)}
                          disabled={isSharing}
                          aria-label={`Share bill ${b.bill_number || b.id} on WhatsApp`}
                          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                        >
                          {isSharing ? 'Opening…' : 'WhatsApp'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 font-medium">
        Shares bill totals and outstanding only. No Aadhaar / no full farmer-portal history export.
      </p>
    </div>
  )
}