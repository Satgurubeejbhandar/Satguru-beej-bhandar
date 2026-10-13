// src/lib/round.ts
/**
 * SATGURU ACCOUNTING CORE - Universal Math & Rounding Engine
 * Tally / Busy Level Currency & Stock Precision
 */

/**
 * 2 Decimal Commercial Rounding (Airtight EPSILON Math)
 * Example: 1.005 -> 1.01 (No JS Float Trap)
 */
export function round2(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0))
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * 3 Decimal Precision (For Kg, Litres, Decimal Quantities)
 * Example: 1.2505 -> 1.251
 */
export function round3(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0))
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

/**
 * Safe Number Parser (Never returns NaN)
 */
export function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  return Number.isFinite(n) ? n : 0
}

/**
 * Integer Paisa Math (Gold Standard: 100% No Float Drift)
 */
export function toPaisa(rs: number | string): number {
  return Math.round(safeNum(rs) * 100)
}

export function fromPaisa(paisa: number): number {
  return paisa / 100
}

/**
 * Standard Indian Rupee Formatter (₹ 1,23,456.78)
 */
export function formatINR(amount: number | string | null | undefined): string {
  return safeNum(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Safe Quantity Parser (Allows Decimals: 0.5 kg, 1.25 L, 10 Bags)
 * Fixes Problem #18 (Math.floor removal)
 */
export function parseQty(val: unknown): number {
  const n = safeNum(val)
  if (n <= 0) return 0
  // Max 3 decimal places for seed/fertilizer/pesticide units
  return round3(n)
}