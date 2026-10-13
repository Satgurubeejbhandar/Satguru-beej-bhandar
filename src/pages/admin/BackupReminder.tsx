import { DatabaseBackup, ArrowRight, AlertTriangle, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BackupStep {
  title: string
  desc: string
}

const STEPS: BackupStep[] = [
  {
    title: 'Supabase Database Backups',
    desc: 'Project Settings → Database Backups से ऑटोमैटिक या मैनुअल स्नैपशॉट स्टेटस चेक करें।',
  },
  {
    title: 'Export Farmers & Ledger CSV',
    desc: 'हफ्ते में कम से कम 1 बार किसानों और खातों की CSV बैकअप फ़ाइल डाउनलोड करके सुरक्षित रखें।',
  },
  {
    title: 'Download Reports Snapshot',
    desc: 'महीने के अंत में सेल और पेमेंट समरी का डेटा या PDF सुरक्षित रखें।',
  },
]

export default function BackupReminder() {
  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DatabaseBackup className="text-amber-400" size={28} /> Backup & Recovery
        </h1>
        <p className="text-emerald-200 text-xs mt-1">
          Supabase Cloud Backups + Offline CSV Export Guide
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5 text-sm">
        <div>
          <h2 className="font-black text-emerald-950 text-base flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" /> Recommended Weekly Routine
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            डेटा सुरक्षा के लिए यह 3 काम नियमित रूप से करें:
          </p>
        </div>

        {/* Step Cards List */}
        <ol className="space-y-3" aria-label="Backup steps">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="p-3.5 bg-slate-50 border border-gray-100 rounded-2xl flex items-start gap-3"
            >
              <span
                className="w-6 h-6 bg-emerald-800 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <p className="font-bold text-gray-900 text-xs sm:text-sm">{step.title}</p>
                <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Strict Safety Rule Banner */}
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-900">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-black uppercase tracking-wider text-[11px] text-rose-700">
              Strict Data Safety Rule
            </p>
            <p className="font-medium mt-0.5 leading-relaxed">
              डेटाबेस में कभी भी <code className="bg-rose-100 px-1 py-0.5 rounded font-bold text-rose-950">TRUNCATE</code> या <code className="bg-rose-100 px-1 py-0.5 rounded font-bold text-rose-950">DROP TABLE</code> कमांड न चलाएं। कोई भी बिल या डेटा हटाने से पहले बैकअप ज़रूर लें।
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link
            to="/admin/export-farmers"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
            aria-label="Open Farmers CSV Export page"
          >
            <FileSpreadsheet size={16} /> Open Farmers CSV Export <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}