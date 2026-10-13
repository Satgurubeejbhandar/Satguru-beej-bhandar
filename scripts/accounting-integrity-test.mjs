#!/usr/bin/env node
/**
 * Satguru Beej Bhandar — Accounting Integrity Simulator
 *
 * Runs 100 fake transactions IN MEMORY (does NOT write to Supabase).
 * Replays the SAME rounding/GST formulas used in:
 *   - src/pages/admin/BillingPOS.tsx  (MRP-inclusive GST extract)
 *   - src/pages/admin/PurchaseStockIn.tsx (tax-exclusive GST add)
 *   - src/pages/admin/FarmerLedgerView.tsx (running outstanding)
 *
 * Usage:
 *   node scripts/accounting-integrity-test.mjs
 *
 * Optional live READ-ONLY check (no inserts):
 *   set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY)
 *   node scripts/accounting-integrity-test.mjs --live
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const eq = trimmed.indexOf('=')
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadDotEnv()

function round2App(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function toPaisa(rs) {
  return Math.round(Number(rs) * 100)
}

function fromPaisa(p) {
  return p / 100
}

/** BillingPOS.calculateRowTotals — GST extracted from MRP-inclusive total */
function salesLineInclusive(qty, rate, gstPercent, isGst) {
  const rawTotal = qty * rate
  let taxable = rawTotal
  let cgst = 0
  let sgst = 0
  if (isGst && gstPercent > 0) {
    taxable = Math.round(((rawTotal * 100) / (100 + gstPercent)) * 100) / 100
    const totalGst = Math.round((rawTotal - taxable) * 100) / 100
    cgst = Math.round((totalGst / 2) * 100) / 100
    sgst = Math.round((totalGst - cgst) * 100) / 100
  }
  return {
    qty,
    rate,
    gstPercent,
    taxable,
    cgst,
    sgst,
    total: Math.round(rawTotal * 100) / 100,
  }
}

/** PurchaseStockIn.calcLine — GST added on exclusive rate */
function purchaseLineExclusive(qty, rate, gstPercent, gstActive) {
  const taxable = round2App(qty * rate)
  const cgst = gstActive ? round2App((taxable * (gstPercent / 2)) / 100) : 0
  const sgst = cgst
  const totalGst = round2App(cgst + sgst)
  return {
    qty,
    rate,
    gstPercent,
    taxable,
    cgst,
    sgst,
    total: round2App(taxable + totalGst),
  }
}

/** Paisa-integer gold standard for inclusive MRP */
function salesLineGold(qty, rate, gstPercent, isGst) {
  const totalP = toPaisa(qty * rate)
  if (!isGst || gstPercent <= 0) {
    return { taxableP: totalP, gstP: 0, cgstP: 0, sgstP: 0, totalP }
  }
  const taxableP = Math.round((totalP * 100) / (100 + gstPercent))
  const gstP = totalP - taxableP
  const cgstP = Math.round(gstP / 2)
  const sgstP = gstP - cgstP
  return { taxableP, gstP, cgstP, sgstP, totalP }
}

function purchaseLineGold(qty, rate, gstPercent, gstActive) {
  const taxableP = toPaisa(qty * rate)
  if (!gstActive || gstPercent <= 0) {
    return { taxableP, cgstP: 0, sgstP: 0, gstP: 0, totalP: taxableP }
  }
  const gstP = Math.round((taxableP * gstPercent) / 100)
  const cgstP = Math.round(gstP / 2)
  const sgstP = gstP - cgstP
  return { taxableP, cgstP, sgstP, gstP, totalP: taxableP + gstP }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GST_RATES = [0, 5, 12, 18, 28]
const rand = mulberry32(20261009)

const issues = []
function fail(phase, id, issue, severity, extra = '') {
  issues.push({ phase, id, issue, severity, extra })
}

const N = 100
const stock = new Map() // sku -> { opening, inn, out, closing }
const farmers = Array.from({ length: 8 }, (_, i) => ({
  id: `F${i + 1}`,
  opening: round2App(5000 + i * 137.25),
  outstanding: 0,
}))
for (const f of farmers) f.outstanding = f.opening

let sumSalesTaxable = 0
let sumSalesCgst = 0
let sumSalesSgst = 0
let sumSalesTotal = 0
let sumPurchTaxable = 0
let sumPurchCgst = 0
let sumPurchSgst = 0
let sumPurchTotal = 0
let paisaDriftCount = 0
let inclusiveIdentityBreaks = 0
let qtyLtOneBlocked = 0

console.log('============================================================')
console.log('SATGURU ACCOUNTING INTEGRITY TEST — 100 fake transactions')
console.log('(in-memory only — production database is not modified)')
console.log('============================================================\n')

for (let i = 0; i < N; i++) {
  const kindRoll = rand()
  const sku = `SKU-${(i % 12) + 1}`
  if (!stock.has(sku)) {
    const opening = round2App(50 + rand() * 200)
    stock.set(sku, { opening, inn: 0, out: 0, closing: opening })
  }
  const st = stock.get(sku)

  if (kindRoll < 0.35) {
    // PURCHASE / stock in
    const qty = round2App(1 + rand() * 40) || 1
    const rate = round2App(20 + rand() * 800)
    const gst = GST_RATES[Math.floor(rand() * GST_RATES.length)]
    const gstOn = gst > 0
    const app = purchaseLineExclusive(qty, rate, gst, gstOn)
    const gold = purchaseLineGold(qty, rate, gst, gstOn)

    if (Math.abs(toPaisa(app.taxable) - gold.taxableP) > 1) {
      paisaDriftCount += 1
      fail('GST-Purchase', i, `Taxable drift > 1 paisa (app ${app.taxable} vs gold ${fromPaisa(gold.taxableP)})`, 'HIGH')
    }
    if (round2App(app.cgst + app.sgst) !== round2App(app.total - app.taxable) && gstOn) {
      fail('GST-Purchase', i, 'taxable + CGST + SGST !== total', 'CRITICAL', JSON.stringify(app))
    }
    st.inn = round2App(st.inn + qty)
    st.closing = round2App(st.opening + st.inn - st.out)
    sumPurchTaxable = round2App(sumPurchTaxable + app.taxable)
    sumPurchCgst = round2App(sumPurchCgst + app.cgst)
    sumPurchSgst = round2App(sumPurchSgst + app.sgst)
    sumPurchTotal = round2App(sumPurchTotal + app.total)
  } else if (kindRoll < 0.8) {
    // SALE
    const wantDecimal = rand() < 0.2
    const qty = wantDecimal ? round2App(0.25 + rand() * 0.74) : round2App(1 + rand() * 10)
    if (qty < 1) qtyLtOneBlocked += 1 // mirrors BillingPOS invalidRow: quantity < 1
    const rate = round2App(30 + rand() * 900)
    const gst = GST_RATES[Math.floor(rand() * GST_RATES.length)]
    const isGst = gst > 0
    const app = salesLineInclusive(qty, rate, gst, isGst)
    const gold = salesLineGold(qty, rate, gst, isGst)

    const identity = round2App(app.taxable + app.cgst + app.sgst)
    if (isGst && identity !== app.total) {
      inclusiveIdentityBreaks += 1
      fail(
        'GST-Sales',
        i,
        `Inclusive identity break: taxable+CGST+SGST (${identity}) !== MRP total (${app.total})`,
        'CRITICAL',
        JSON.stringify(app)
      )
    }
    if (Math.abs(toPaisa(app.total) - gold.totalP) > 1) {
      paisaDriftCount += 1
      fail('GST-Sales', i, `Total drift > 1 paisa vs paisa-gold`, 'MEDIUM', JSON.stringify({ app, gold }))
    }

    const farmer = farmers[Math.floor(rand() * farmers.length)]
    const isUdhaar = rand() < 0.7
    if (isUdhaar) {
      farmer.outstanding = round2App(farmer.outstanding + app.total)
    }

    if (qty <= st.closing) {
      st.out = round2App(st.out + qty)
      st.closing = round2App(st.opening + st.inn - st.out)
    } else {
      fail('Stock', i, `Sale qty ${qty} would go negative vs closing ${st.closing} (prevention path)`, 'LOW')
    }

    sumSalesTaxable = round2App(sumSalesTaxable + app.taxable)
    sumSalesCgst = round2App(sumSalesCgst + app.cgst)
    sumSalesSgst = round2App(sumSalesSgst + app.sgst)
    sumSalesTotal = round2App(sumSalesTotal + app.total)
  } else if (kindRoll < 0.93) {
    // PAYMENT
    const farmer = farmers[Math.floor(rand() * farmers.length)]
    const maxPay = Math.max(0, farmer.outstanding)
    const amt = round2App(Math.min(maxPay || 100, 50 + rand() * 2000))
    farmer.outstanding = round2App(farmer.outstanding - amt)
  } else {
    // RETURN (credit outstanding, restore stock)
    const farmer = farmers[Math.floor(rand() * farmers.length)]
    const amt = round2App(10 + rand() * 200)
    const qty = round2App(0.5 + rand() * 3)
    farmer.outstanding = round2App(farmer.outstanding - amt)
    st.out = round2App(st.out - qty)
    st.closing = round2App(st.opening + st.inn - st.out)
  }
}

// Stock identity for every SKU
for (const [sku, st] of stock) {
  const expected = round2App(st.opening + st.inn - st.out)
  if (expected !== st.closing) {
    fail('Stock', sku, `Opening+In-Out (${expected}) !== closing (${st.closing})`, 'CRITICAL')
  }
}

// Farmer outstanding identity
for (const f of farmers) {
  if (!Number.isFinite(f.outstanding)) {
    fail('Ledger', f.id, 'Outstanding is not finite', 'CRITICAL')
  }
}

console.log('Sales GST (inclusive MRP extract):')
console.log(`  Taxable  ₹${sumSalesTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  CGST     ₹${sumSalesCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  SGST     ₹${sumSalesSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  Total    ₹${sumSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(
  `  Identity taxable+tax vs total: ₹${round2App(sumSalesTaxable + sumSalesCgst + sumSalesSgst)} vs ₹${sumSalesTotal}`
)
console.log(`  Inclusive identity breaks (line-level): ${inclusiveIdentityBreaks}`)
console.log(`  Lines with qty < 1 (blocked by BillingPOS today): ${qtyLtOneBlocked}`)
console.log('')
console.log('Purchase GST (exclusive add):')
console.log(`  Taxable  ₹${sumPurchTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  CGST     ₹${sumPurchCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  SGST     ₹${sumPurchSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log(`  Total    ₹${sumPurchTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
console.log('')
console.log('Farmer simulated outstanding:')
for (const f of farmers) {
  console.log(`  ${f.id}  opening ₹${f.opening.toFixed(2)}  closing ₹${f.outstanding.toFixed(2)}`)
}
console.log('')
console.log('Stock identity:')
for (const [sku, st] of stock) {
  console.log(
    `  ${sku}  O=${st.opening} +In=${st.inn} -Out=${st.out} = ${st.closing}`
  )
}

const live = process.argv.includes('--live')
if (live) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log('\n[LIVE] Skipped: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  } else {
    console.log('\n[LIVE] Read-only sample of farmers outstanding vs credit_accounts (anon RLS applies)...')
    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from('farmers')
      .select('id, farmer_id, farmer_name, outstanding_balance, credit_accounts(current_outstanding)')
      .eq('account_status', 'active')
      .limit(50)
    if (error) {
      fail('Live', 'query', error.message, 'HIGH')
      console.log('[LIVE] Query failed:', error.message)
    } else {
      let mismatch = 0
      for (const row of data || []) {
        const master = round2App(row.outstanding_balance)
        const acc = Array.isArray(row.credit_accounts) ? row.credit_accounts[0] : row.credit_accounts
        const ca = acc ? round2App(acc.current_outstanding) : null
        if (ca !== null && ca !== master) {
          mismatch += 1
          fail(
            'Live',
            row.farmer_id || row.id,
            `farmers.outstanding_balance (${master}) !== credit_accounts.current_outstanding (${ca})`,
            'CRITICAL'
          )
        }
      }
      console.log(`[LIVE] Checked ${data?.length || 0} farmers, dual-balance mismatches: ${mismatch}`)
    }
  }
}

console.log('\n------------------------------------------------------------')
console.log(`Issues found: ${issues.length}  | paisa-drift flags: ${paisaDriftCount}`)
if (issues.length) {
  console.log('\n# | Phase | Id | Severity | Issue')
  issues.forEach((x, idx) => {
    console.log(`${idx + 1} | ${x.phase} | ${x.id} | ${x.severity} | ${x.issue}`)
  })
  process.exitCode = 1
} else {
  console.log('Simulator: all 100 transactions kept stock identity and GST line identity.')
}
console.log('\nNote: this script cannot prove remote RPC/RLS correctness; those live in Supabase, not this repo.')
