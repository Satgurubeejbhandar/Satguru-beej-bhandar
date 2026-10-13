import { SHOP, waLink, NAV_ITEMS, type PageKey } from "../data/content";
import { Icon, WheatEar } from "./Shared";

export const Footer = ({ onNavigate }: { onNavigate: (p: PageKey) => void }) => {
  const categories = ["बीज / Seeds", "कीटनाशक", "फफूंदनाशक", "खरपतवारनाशक", "खाद / उर्वरक", "कृषि उपकरण"];

  return (
    <footer className="relative bg-pine-950 text-cream grain overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-20" />
      {/* watermark */}
      <div className="pointer-events-none absolute -bottom-10 left-0 right-0 text-center display-xl text-[18vw] leading-none text-cream/[0.04] select-none whitespace-nowrap">
        सतगुरु बीज भंडार
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pt-16 pb-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-400 text-pine-950 shadow-lg shadow-gold-500/25">
                <WheatEar className="w-6 h-7" />
              </span>
              <div>
                <p className="display-xl text-2xl">सतगुरु बीज भंडार</p>
                <p className="text-xs font-chunk font-semibold tracking-[0.2em] text-gold-400 uppercase mt-0.5">Est. 2015 • किसान का साथी</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-cream/65">
              10+ वर्षों से किसान भाइयों की सेवा में समर्पित। उच्च गुणवत्ता के बीज, खाद, कीटनाशक और कृषि सलाह — उचित मूल्य पर।
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="pill pill-gold !text-cream/90 !bg-cream/10">प्रमाणित बीज</span>
              <span className="pill pill-gold !text-cream/90 !bg-cream/10">मुफ्त सलाह</span>
              <span className="pill pill-gold !text-cream/90 !bg-cream/10">होम डिलीवरी</span>
            </div>
          </div>

          {/* quick links */}
          <div>
            <p className="font-chunk font-bold text-gold-400 tracking-widest text-sm uppercase mb-4">त्वरित लिंक</p>
            <ul className="space-y-2.5">
              {NAV_ITEMS.map((n) => (
                <li key={n.key}>
                  <button onClick={() => onNavigate(n.key)} className="group inline-flex items-center gap-2 text-cream/70 hover:text-gold-300 transition text-sm font-medium">
                    <Icon name="ChevronRight" size={14} className="text-gold-500 group-hover:translate-x-1 transition-transform" />
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* categories */}
          <div>
            <p className="font-chunk font-bold text-gold-400 tracking-widest text-sm uppercase mb-4">उत्पाद श्रेणियां</p>
            <ul className="space-y-2.5">
              {categories.map((c) => (
                <li key={c}>
                  <button onClick={() => onNavigate("products")} className="group inline-flex items-center gap-2 text-cream/70 hover:text-gold-300 transition text-sm font-medium">
                    <Icon name="Leaf" size={13} className="text-gold-500" />
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* contact */}
          <div>
            <p className="font-chunk font-bold text-gold-400 tracking-widest text-sm uppercase mb-4">संपर्क जानकारी</p>
            <ul className="space-y-3.5 text-sm">
              <li className="flex gap-3 text-cream/75">
                <Icon name="MapPin" size={17} className="text-gold-400 shrink-0 mt-0.5" />
                <span>दल्लुसर, सरदारशहर, चूरू (राजस्थान) — 331411</span>
              </li>
              <li className="flex gap-3 text-cream/75">
                <Icon name="Phone" size={16} className="text-gold-400 shrink-0 mt-0.5" />
                <span>
                  <a href={`tel:+${SHOP.phone1Raw}`} className="hover:text-gold-300 transition block">{SHOP.phone1}</a>
                  <a href={`tel:+${SHOP.phone2Raw}`} className="hover:text-gold-300 transition block">{SHOP.phone2}</a>
                </span>
              </li>
              <li className="flex gap-3 text-cream/75">
                <Icon name="MessageCircle" size={16} className="text-gold-400 shrink-0 mt-0.5" />
                <a href={waLink("नमस्ते!")} target="_blank" rel="noreferrer" className="hover:text-gold-300 transition">WhatsApp: {SHOP.phone1}</a>
              </li>
              <li className="flex gap-3 text-cream/75">
                <Icon name="Mail" size={16} className="text-gold-400 shrink-0 mt-0.5" />
                <a href={`mailto:${SHOP.email}`} className="hover:text-gold-300 transition break-all">{SHOP.email}</a>
              </li>
              <li className="flex gap-3 text-cream/75">
                <Icon name="Clock" size={16} className="text-gold-400 shrink-0 mt-0.5" />
                <span>सोम–शनि: सुबह 7 – रात 9 • रविवार बंद</span>
              </li>
            </ul>
          </div>
        </div>

        {/* license strip */}
        <div className="mt-12 rounded-2xl border border-cream/10 bg-cream/5 p-4 md:p-5">
          <p className="font-chunk font-bold text-xs tracking-[0.22em] text-gold-400 uppercase mb-3 text-center">दुकान पंजीकरण / लाइसेंस विवरण</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-cream/80 font-chunk">
            <span>GSTIN: <b className="text-gold-300">{SHOP.gstin}</b></span>
            <span>राज्य कोड: <b className="text-gold-300">{SHOP.stateCode}</b></span>
            <span>फर्म लाइसेंस: <b className="text-gold-300">{SHOP.firmLicense}</b></span>
            <span>बीज लाइसेंस: <b className="text-gold-300">{SHOP.seedLicense}</b></span>
            <span>खाद लाइसेंस: <b className="text-gold-300">{SHOP.fertLicense}</b></span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-cream/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-cream/50">
          <p>© 2015–2026 सतगुरु बीज भंडार | सभी अधिकार सुरक्षित</p>
          <p className="flex items-center gap-1.5">
            किसानों के लिए स्नेह से निर्मित
            <WheatEar className="w-3.5 h-4 text-gold-400" />
            Jai Jawan Jai Kisan
          </p>
          <p>संकेतिक भाव व जानकारी में बदलाव संभव — पुष्टि हेतु दुकान पर संपर्क करें</p>
        </div>
      </div>
    </footer>
  );
};
