import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  MessageSquareWarning, 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

const SETTING_KEY = 'bill_warning_message'
const DEFAULT_MSG =
  'Kisi bhi Dawai ka Galat tarike se use, galat dose, galat fasal me ya kisi any jaanleva prayog me use kiya gaya to aap khud zimmedar honge. SATGURU BEEJ BHANDAR zimmedar nahi hoga. Dhanyawad. Aapki Fasal, Hamari Saaf Niyat, Salah aur Suraksha. JAI JAWAN JAI KISAN'

const MAX_CHARS = 500

export default function BillWarningEditor() {
  const [msg, setMsg] = useState<string>('')
  const [initialMsg, setInitialMsg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isMounted = useRef<boolean>(true)

  // 1. Data Fetching with strict error & mount handling
  const loadSetting = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle()

      if (error) throw error

      if (isMounted.current) {
        const activeText = data?.setting_value?.trim() || DEFAULT_MSG
        setMsg(activeText)
        setInitialMsg(activeText)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load setting'
      if (isMounted.current) {
        setFetchError(errorMessage)
        toast.error('Could not load existing warning message')
        setMsg(DEFAULT_MSG)
        setInitialMsg(DEFAULT_MSG)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    loadSetting()

    return () => {
      isMounted.current = false
    }
  }, [loadSetting])

  // 2. Dirty check to prevent unnecessary DB updates
  const isDirty = useMemo(() => msg.trim() !== initialMsg.trim(), [msg, initialMsg])
  const isTooLong = msg.length > MAX_CHARS

  // 3. Clean Upsert Operation (Verified Schema Columns Only)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedMsg = msg.trim()
    if (!trimmedMsg) {
      toast.error('Warning message cannot be empty')
      return
    }

    if (isTooLong) {
      toast.error(`Message exceeds maximum limit of ${MAX_CHARS} characters`)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            setting_key: SETTING_KEY,
            setting_value: trimmedMsg,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        )

      if (error) throw error

      if (isMounted.current) {
        setInitialMsg(trimmedMsg)
        toast.success('Bill warning saved successfully!')
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save message'
      if (isMounted.current) {
        toast.error(errorMsg)
      }
    } finally {
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  const handleResetToDefault = () => {
    setMsg(DEFAULT_MSG)
    toast('Reset to default text template', { icon: 'ℹ️' })
  }

  const handleDiscardChanges = () => {
    setMsg(initialMsg)
    toast('Changes discarded', { icon: '↩️' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <MessageSquareWarning className="text-amber-400 shrink-0" size={26} /> 
            Bill Warning Disclaimer
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Displayed on printed Invoices, Thermal Receipts, & WhatsApp PDF templates.
          </p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Could not sync with cloud. Showing local template.</span>
          </div>
          <button 
            type="button" 
            onClick={loadSetting} 
            className="text-amber-950 underline font-bold hover:text-black"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Textarea Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="bill-warning-input" className="font-bold text-slate-700">
              Disclaimer Text
            </label>
            <span className={`font-mono text-[11px] ${isTooLong ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
              {msg.length}/{MAX_CHARS} chars
            </span>
          </div>

          {loading ? (
            <div className="h-40 w-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400 text-xs font-medium">
              <Loader2 className="animate-spin mr-2" size={16} /> Loading saved disclaimer...
            </div>
          ) : (
            <textarea
              id="bill-warning-input"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={6}
              disabled={saving}
              placeholder="Enter invoice disclaimer message..."
              className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all resize-y disabled:bg-slate-50"
            />
          )}
        </div>

        {/* Action Toolbars */}
        <div className="flex flex-wrap gap-2 justify-between items-center pt-1 border-t border-slate-100">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={loading || saving || msg === DEFAULT_MSG}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <RotateCcw size={13} /> Reset to Default
            </button>
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={loading || saving}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-all"
              >
                Discard
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!isDirty || saving || loading || isTooLong}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={14} /> Save Changes
              </>
            )}
          </button>
        </div>

        {/* Live Thermal Bill Preview Card */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Eye size={14} /> Live Bill Footer Preview
          </h3>
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 font-mono text-[11px] text-slate-700 leading-relaxed space-y-2">
            <div className="text-center font-bold text-slate-400 text-[10px] pb-1 border-b border-slate-200">
              --- BOTTOM OF INVOICE ---
            </div>
            <p className="text-justify italic">
              &ldquo;{msg.trim() || 'No disclaimer set'}&rdquo;
            </p>
            <div className="flex justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200 font-sans">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 size={12} /> Auto-synced with PDF generator
              </span>
              <span>Font: Monospace</span>
            </div>
          </div>
        </div>

      </form>
    </div>
  )
}