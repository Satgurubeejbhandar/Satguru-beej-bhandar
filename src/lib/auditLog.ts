// src/lib/auditLog.ts
import { supabase } from './supabase'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VOID'
  | 'PAYMENT'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'STOCK_ADJUST'
  | 'PIN_RESET'
  | 'LOGIN'
  | 'LOGOUT'
  | 'OVERRIDE'
  | 'EXPORT'
  | 'SETTINGS'
  | 'STATUS_CHANGE'
  | string

export interface AuditPayload {
  action: AuditAction
  entity_type: string          // e.g. 'sales_bills', 'farmers', 'payments'
  entity_id?: string | number | null
  reason?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  user_role?: string
}

/**
 * Fire-and-forget audit logger.
 * Never throws to caller — logging failure must not break business action.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user

    const row = {
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id != null ? String(payload.entity_id) : null,
      user_role: payload.user_role || 'admin',
      performed_by: user?.email || user?.id || null,
      reason: payload.reason || null,
      old_data: payload.old_data || null,
      new_data: payload.new_data || null,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('audit_logs').insert([row])

    if (error) {
      // Don't block UI — just warn
      console.warn('[auditLog] insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[auditLog] unexpected error:', err)
  }
}