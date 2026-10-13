import { Link } from 'react-router-dom'

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6">
      <header className="flex justify-between items-center max-w-6xl mx-auto w-full py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌾</span>
          <div>
            <h1 className="text-lg font-bold text-emerald-400">SATGURU BEEJ BHANDAR</h1>
            <p className="text-xs text-slate-400">Daloosar, Sardarshahar (Churu), Rajasthan</p>
          </div>
        </div>
        <Link 
          to="/login" 
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg"
        >
          Portal Login 🔐
        </Link>
      </header>

      <main className="max-w-4xl mx-auto text-center py-16 space-y-6">
        <span className="px-4 py-1.5 bg-emerald-900/60 text-emerald-300 font-semibold text-xs rounded-full border border-emerald-700">
          Official Business Management Portal
        </span>
        <h2 className="text-4xl md:text-6xl font-black leading-tight text-slate-100">
          आपकी फसल, हमारी साफ नीयत, <br />
          <span className="text-emerald-400">सलाह और सुरक्षा</span>
        </h2>
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
          किसान उधार कार्ड, स्टॉक मैनेजमेंट, ग्रुप उधार, और बिलिंग का सम्पूर्ण डिजिटल खाता प्रणाली।
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link 
            to="/login"
            className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-lg transition-all shadow-xl"
          >
            किसान / व्यवस्थापक लॉगिन
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-800">
        JAI JAWAN JAI KISAN — SATGURU BEEJ BHANDAR © 2025
      </footer>
    </div>
  )
}