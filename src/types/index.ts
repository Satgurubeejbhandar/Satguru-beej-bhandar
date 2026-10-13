export interface Farmer {
  id: string
  farmer_id: string
  farmer_name: string
  father_name?: string | null
  mobile: string
  village?: string | null
  tehsil?: string | null
  district?: string | null
  outstanding_balance?: number | null
  opening_balance?: number | null
  opening_balance_date?: string | null
  credit_limit?: number | null
  photo_url?: string | null
  aadhaar_photo_url?: string | null
  kcc_url?: string | null
  group_id?: string | null
  account_status?: string | null
  is_blocked?: boolean
  created_at?: string
}

export interface FarmerSecurity {
  farmer_id: string
  pin_hash?: string | null
  failed_attempts?: number | null
  is_locked?: boolean | null
}

export interface FarmerLedgerEntry {
  farmer_id: string
  debit: number
  credit: number
  balance: number
  entry_date: string
}

export interface SalesBill {
  id: string
  bill_number: string
  farmer_id: string | null
  total_amount: number
  taxable_amount?: number | null
  cgst_amount?: number | null
  sgst_amount?: number | null
  igst_amount?: number | null
  previous_outstanding?: number | null
  new_outstanding?: number | null
  is_gst_bill?: boolean | null
  bill_date?: string | null
  bill_type?: string | null
  bill_status?: string | null
}

export interface PurchaseBill {
  id: string
  bill_number: string
  company_id: string
  total_amount: number
  amount_paid?: number | null
}

export interface Payment {
  id: string
  payment_number: string
  farmer_id: string | null
  payment_amount: number
  payment_mode?: string | null
  previous_outstanding?: number | null
  new_outstanding?: number | null
  payment_date?: string | null
}

export interface Company {
  id: string
  company_name: string
  gstin?: string | null
  opening_balance?: number | null
  opening_balance_type?: string | null
}

export interface CompanyPayment {
  id: string
  company_id: string
  payment_amount: number
  payment_number?: string | null
}

export interface Product {
  id: string
  product_name: string
  sku?: string | null
  company_id?: string | null
  default_purchase_rate?: number | null
  default_selling_rate?: number | null
  hsn_code?: string | null
  gst_percent?: number | null
}

export interface InventoryBatch {
  id: string
  product_id: string
  batch_number?: string | null
  quantity_available: number
  purchase_rate?: number | null
  selling_rate?: number | null
  expiry_date?: string | null
}

export interface AppSetting {
  setting_key: string
  setting_value: string | null
}

export interface CreditAccount {
  id: string
  farmer_id: string
  current_outstanding?: number | null
  credit_limit?: number | null
  available_credit?: number | null
  due_date?: string | null
}

/** @deprecated Use Farmer.farmer_name — kept for older UI helpers */
export type FarmerNameAlias = Farmer['farmer_name']

export interface ProductItem {
  id: string
  name: string
  category: string
  form: 'Liquid' | 'Solid'
  unit: string
  quantity: number
  company: string
  expire_date: string
  rate: number
}

export interface UdhaarTxn {
  id: string
  farmer_id: string
  group_id: string | null
  amount: number
  type: 'UDHAAR' | 'PAYMENT'
  bill_number: string
  physical_bill_no: string | null
  physical_bill_photo_url: string | null
  description: string
  detailed_products: ProductItem[] | null
  receiver_name: string | null
  payment_by_name: string | null
  balance_after: number
  created_at: string
}

export interface GroupData {
  id: string
  group_id: string
  group_name: string
  leader_farmer_id: string
  total_limit: number
  group_cashback_percent: number
  cashback_earned: number
  transaction_pin: string
  is_active: boolean
  created_at: string
}

export interface InterestInfo {
  days_elapsed: number
  return_days: number
  overdue_days: number
  days_remaining: number
  daily_interest: number
  total_interest: number
  interest_rate: number
}

export type AppRole = 'admin' | 'farmer' | 'guest' | null

export interface SchemeSlot {
  range: string
  discount: string
  days: string
}
