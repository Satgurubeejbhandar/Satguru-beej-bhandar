// src/pages/admin/PrintHelp.tsx
import {
  Printer,
  ExternalLink,
  Keyboard,
  HelpCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Settings,
} from 'lucide-react'

export default function PrintHelp() {
  const handleTestPrint = () => {
    window.print()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-3 sm:p-0">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="text-amber-400" size={28} /> Print Help
          </h1>
          <p className="text-emerald-200 text-xs mt-1">
            A5 Estimate & GST bill printing guide (High Quality PDF)
          </p>
        </div>
        <span className="bg-emerald-800/80 text-amber-300 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-700 font-mono shrink-0">
          Guide
        </span>
      </div>

      {/* Main Instructions Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border shadow-sm space-y-5 text-sm font-medium text-gray-800">
        <div className="flex items-center gap-2 pb-2 border-b">
          <HelpCircle className="text-emerald-700" size={18} />
          <h2 className="text-sm font-bold text-gray-900">
            Step-by-Step Bill Printing Instructions
          </h2>
        </div>

        <ol className="space-y-3 text-xs text-gray-800 font-medium list-none pl-0" aria-label="Printing steps">
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900 text-white text-xs font-bold shrink-0">
              1
            </span>
            <div className="pt-0.5">
              Open <strong>Billing POS</strong> → Print Bill, या{' '}
              <strong>Printable Bill</strong> पेज खोलें।
            </div>
          </li>

          <li className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900 text-white text-xs font-bold shrink-0">
              2
            </span>
            <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
              <span>Browser print shortcut:</span>
              <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded-md font-mono text-[11px] font-bold text-gray-800 shadow-xs inline-flex items-center gap-1">
                <Keyboard size={12} className="text-gray-500" /> Ctrl + P
              </kbd>
              <span className="text-gray-500">(Mac: Cmd + P)</span>
            </div>
          </li>

          <li className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900 text-white text-xs font-bold shrink-0">
              3
            </span>
            <div className="pt-0.5">
              <strong>More settings</strong> खोलें और नीचे दी गई सही सेटिंग्स चुनें।
            </div>
          </li>

          <li className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900 text-white text-xs font-bold shrink-0">
              4
            </span>
            <div className="pt-0.5">
              <strong>Background graphics</strong> पर टिक (✓) ज़रूर लगाएँ — वरना
              टेक्स्ट हल्का / fade दिखेगा।
            </div>
          </li>
        </ol>

        {/* Paper Size Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Estimate */}
          <div className="rounded-2xl border border-pink-200 bg-pink-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-pink-700" />
              <h3 className="text-xs font-black text-pink-800 uppercase tracking-wide">
                Estimate Bill (Kacha)
              </h3>
            </div>
            <ul className="text-[11px] text-pink-950 font-semibold space-y-1.5">
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-pink-600 shrink-0 mt-0.5" />
                <span>
                  Paper size: <strong>A5</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-pink-600 shrink-0 mt-0.5" />
                <span>
                  Layout: <strong>Portrait (खड़ा)</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-pink-600 shrink-0 mt-0.5" />
                <span>
                  Margins: <strong>None / Minimum</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-pink-600 shrink-0 mt-0.5" />
                <span>
                  Scale: <strong>100% (Default)</strong>
                </span>
              </li>
            </ul>
          </div>

          {/* GST */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-emerald-700" />
              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                GST / Pukka Bill
              </h3>
            </div>
            <ul className="text-[11px] text-emerald-950 font-semibold space-y-1.5">
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Paper size: <strong>A5</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Layout: <strong>Landscape (आड़ा)</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Margins: <strong>None / Minimum</strong>
                </span>
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Scale: <strong>100% (Default)</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900 font-semibold leading-relaxed">
            <strong>अगर PDF आधा खाली आ रहा है:</strong> प्रिंटर/Browser में Paper Size अभी भी{' '}
            <strong>A4</strong> सेट है। More settings → Paper size को{' '}
            <strong>A5</strong> करें। Background graphics ऑन रखें, नहीं तो शब्द fade दिखेंगे।
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleTestPrint}
            className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={14} />
            Test Printer Dialog
          </button>

          <a
            href="/admin/print-bill"
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <FileText size={14} />
            Go to Printable Bill <ExternalLink size={12} />
          </a>
        </div>

        {/* Route Info Notice */}
        <div className="pt-3 border-t flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
            <CheckCircle2 size={14} className="text-emerald-600" /> Direct Routes:
          </span>
          <div className="flex flex-wrap gap-2">
            <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-emerald-900 font-bold border border-slate-200">
              /admin/print-bill
            </code>
            <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-emerald-900 font-bold border border-slate-200">
              /admin/print-help
            </code>
          </div>
        </div>
      </div>

      {/* Extra tip card */}
      <div className="bg-white p-5 rounded-3xl border shadow-sm text-xs text-gray-700 font-medium space-y-2">
        <p className="font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          High Quality PDF Tips
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>Chrome / Edge ब्राउज़र सबसे अच्छा रिजल्ट देता है।</li>
          <li>
            Destination = <strong>Save as PDF</strong> चुनकर पहले PDF बनाएँ, फिर प्रिंट करें।
          </li>
          <li>
            Words jet-black दिखें, इसके लिए <strong>Background graphics = ON</strong> रखें।
          </li>
          <li>
            Estimate = A5 Portrait · GST Bill = A5 Landscape (हमेशा यही सेट करें)।
          </li>
        </ul>
      </div>
    </div>
  )
}