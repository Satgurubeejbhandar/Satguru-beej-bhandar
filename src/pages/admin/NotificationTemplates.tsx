// src/pages/admin/NotificationTemplates.tsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  Mail,
  Save,
  RotateCcw,
  Loader2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TemplateKey {
  key: string
  label: string
  def: string
  placeholders: string[]
}

const KEYS: TemplateKey[] = [
  {
    key: 'tpl_due_reminder',
    label: 'Due Reminder Template',
    def: 'Namaste {{name}}, aapki udhaar ₹{{amount}} due date {{due}} hai. Satguru Beej Bhandar.',
    placeholders: ['{{name}}', '{{amount}}', '{{due}}'],
  },
  {
    key: 'tpl_overdue_reminder',
    label: 'Overdue Reminder Template',
    def: 'Namaste {{name}}, aapki udhaar ₹{{amount}} OVERDUE hai (due {{due}}). Kripya jaldi jama karein.',
    placeholders: ['{{name}}', '{{amount}}', '{{due}}'],
  },
  {
    key: 'tpl_payment_thanks',
    label: 'Payment Thanks Template',
    def: 'Dhanyawad {{name}}, ₹{{amount}} prapt. Baki ₹{{balance}}. Satguru Beej Bhandar.',
    placeholders: ['{{name}}', '{{amount}}', '{{balance}}'],
  },
]

export default function NotificationTemplates() {
  const { role, loading: authLoading } = useAuth()

  const [map, setMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)

  const isMounted = useRef<boolean>(true)
  const saveLockRef = useRef<boolean>(false)

  const loadTemplates = useCallback(async () => {
    if (role !== 'admin') return

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in(
          'setting_key',
          KEYS.map((k) => k.key)
        )

      if (error) throw error

      if (!isMounted.current) return

      const templateMap: Record<string, string> = {}
      KEYS.forEach((k) => {
        const found = data?.find((d) => d.setting_key === k.key)
        templateMap[k.key] = found?.setting_value || k.def
      })

      setMap(templateMap)
    } catch (err: unknown) {
      console.error('loadTemplates failed:', err)
      if (isMounted.current) {
        toast.error('Failed to load templates. Using default templates.')
        const fallbackMap: Record<string, string> = {}
        KEYS.forEach((k) => {
          fallbackMap[k.key] = k.def
        })
        setMap(fallbackMap)
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role !== 'admin') {
      setLoading(false)
      return
    }
    void loadTemplates()
  }, [loadTemplates, role, authLoading])

  const handleResetDefaults = () => {
    const defaultMap: Record<string, string> = {}
    KEYS.forEach((k) => {
      defaultMap[k.key] = k.def
    })
    setMap(defaultMap)
    toast.success('Reset to default templates. Click Save to apply.')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()

    if (role !== 'admin') {
      toast.error('Aapke paas settings badalne ki anumati nahi hai.')
      return
    }

    // Validate inputs
    for (const k of KEYS) {
      const val = (map[k.key] || '').trim()
      if (!val) {
        toast.error(`Please enter text for "${k.label}"`)
        return
      }
      if (val.length > 1000) {
        toast.error(`"${k.label}" is too long (max 1000 characters).`)
        return
      }

      // Check missing placeholders warning
      const missing = k.placeholders.filter((ph) => !val.includes(ph))
      if (missing.length > 0) {
        const confirmSave = window.confirm(
          `Warning: "${k.label}" is missing tag(s): ${missing.join(
            ', '
          )}.\n\nDo you want to save anyway?`
        )
        if (!confirmSave) return
      }
    }

    if (saveLockRef.current || saving) return
    saveLockRef.current = true
    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Session expired. Please sign in.')
        return
      }

      const upsertPayload = KEYS.map((k) => ({
        setting_key: k.key,
        setting_value: (map[k.key] || '').trim(),
        setting_type: 'string',
        description: k.label,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('app_settings')
        .upsert(upsertPayload, { onConflict: 'setting_key' })

      if (error) throw error

      toast.success('Templates saved successfully!')
    } catch (err: unknown) {
      console.error('save templates failed:', err)
      if (isMounted.current) {
        toast.error('Failed to save templates. Please try again.')
      }
    } finally {
      saveLockRef.current = false
      if (isMounted.current) {
        setSaving(false)
      }
    }
  }

  if (!authLoading && role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 text-center space-y-2">
        <ShieldAlert className="inline-block text-red-600" size={32} />
        <h1 className="text-lg font-bold text-red-700">Access Denied</h1>
        <p className="text-sm text-gray-600">
          Aapke paas notification templates badalne ki anumati nahi hai.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="text-amber-400" size={28} /> Notification Templates
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            Placeholders:{' '}
            <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              {'{{name}}'}
            </code>{' '}
            <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              {'{{amount}}'}
            </code>{' '}
            <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              {'{{due}}'}
            </code>{' '}
            <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">
              {'{{balance}}'}
            </code>
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={loading || saving || authLoading}
          aria-label="Reset templates to default"
          className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-100 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-emerald-700 shrink-0"
        >
          <RotateCcw size={14} />
          Reset Defaults
        </button>
      </div>

      {/* Form Card */}
      <form
        onSubmit={save}
        className="bg-white p-6 rounded-3xl border shadow-sm space-y-5"
      >
        {loading || authLoading ? (
          <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-emerald-800" />
            Loading saved templates...
          </div>
        ) : (
          KEYS.map((k) => {
            const currentVal = map[k.key] || ''
            const missing = k.placeholders.filter(
              (ph) => !currentVal.includes(ph)
            )

            return (
              <div key={k.key} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor={k.key}
                    className="block text-xs font-bold text-gray-800"
                  >
                    {k.label}
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Allowed: {k.placeholders.join(', ')}
                  </span>
                </div>
                <textarea
                  id={k.key}
                  rows={3}
                  maxLength={1000}
                  disabled={saving}
                  value={currentVal}
                  onChange={(e) =>
                    setMap((prev) => ({ ...prev, [k.key]: e.target.value }))
                  }
                  placeholder={k.def}
                  className="w-full border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-2xl p-3.5 text-sm text-gray-800 transition-all font-sans disabled:opacity-60"
                />
                {missing.length > 0 && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                    <AlertTriangle size={12} />
                    Missing recommended tags: {missing.join(', ')}
                  </p>
                )}
              </div>
            )
          })
        )}

        <button
          type="submit"
          disabled={saving || loading || authLoading}
          className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving Templates...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Templates
            </>
          )}
        </button>
      </form>
    </div>
  )
}