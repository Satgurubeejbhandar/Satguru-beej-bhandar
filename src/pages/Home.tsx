import WeatherWidget from "../components/WeatherWidget";
import { motion } from "framer-motion";
import { ABOUT_TEXT, SERVICES, SHOP, TEAM, TRUST_POINTS, waLink, type PageKey } from "../data/content";
import { Icon, Reveal, RotatingStamp, SectionHead, WheatEar } from "../components/Shared";

const TOOLS: { key: PageKey; title: string; desc: string; icon: string; accent: string }[] = [
  { key: "products", title: "उत्पाद व कीमतें", desc: "बीज, दवाई, खाद — साइज़, दाम, डोज़, फसल व परिणाम सहित पूरी लिस्ट", icon: "ShoppingBasket", accent: "from-gold-400 to-gold-500" },
  { key: "crops", title: "फसल: बुवाई से कटाई तक", desc: "60+ फसलों की पूरी ICAR पैकेज प्रैक्टिस — खजूर समेत फल-सब्जी-खेत फसलें", icon: "Sprout", accent: "from-leaf-500 to-pine-700" },
  { key: "disease", title: "रोग व दवाई", desc: "60 फसलों के कीट व रोग — लक्षण, ETL व ICAR आधारित रासायनिक प्रबंधन", icon: "Stethoscope", accent: "from-clay-500 to-red-800" },
  { key: "weeds", title: "खरपतवार प्रबंधन", desc: "फसलवार घास की पहचान + वीडीसाइड (PE/पोस्ट) मात्रा व समय", icon: "Scissors", accent: "from-lime-500 to-emerald-800" },
  { key: "homecare", title: "होम केयर (बगीचा)", desc: "घर की सब्जियों-फलों के कीट-रोग व सुरक्षित उपचार (लीटर में मात्रा)", icon: "Flower2", accent: "from-pink-500 to-rose-700" },
  { key: "mandi", title: "मंडी भाव", desc: "रावतसर, सरदारशहर, नोहर, हनुमानगढ़ — 4 मंडियों के संकेतिक भाव", icon: "TrendingUp", accent: "from-emerald-500 to-pine-800" },
  { key: "msp", title: "MSP 2025-26", desc: "रबी व खरीफ की सभी फसलों के न्यूनतम समर्थन मूल्य — सरकारी आंकड़े", icon: "Landmark", accent: "from-sky-500 to-indigo-800" },
  { key: "schemes", title: "सरकारी योजनाएं", desc: "केंद्र व राजस्थान की किसान हितकारी योजनाएं — लाभ व आवेदन तरीका", icon: "ScrollText", accent: "from-amber-500 to-orange-800" },
  { key: "students", title: "स्टूडेंट कॉर्नर", desc: "फ़सल सुरक्षा एवं एग्रोकेमिकल्स सेल्स ट्रेनिंग प्रोग्राम", icon: "GraduationCap", accent: "from-violet-500 to-purple-800" },
];

export const HomePage = ({ onNavigate }: { onNavigate: (p: PageKey) => void }) => {
  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative min-h-[100svh] flex items-end overflow-hidden bg-pine-950 grain">
        <div className="absolute inset-0">
          <motion.img
            src="/images/hero.jpg"
            alt="गेहूं का खेत"
            className="w-full h-full object-cover"
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/55 to-pine-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950/80 via-transparent to-transparent" />
        </div>

        {/* floating leaves */}
        <motion.div className="absolute top-1/4 right-[12%] text-gold-400/70 hidden lg:block animate-float" aria-hidden>
          <WheatEar className="w-14 h-16" />
        </motion.div>
        <motion.div className="absolute top-1/2 right-[28%] text-cream/30 hidden lg:block animate-float" style={{ animationDelay: "1.4s" }} aria-hidden>
          <WheatEar className="w-8 h-10" />
        </motion.div>

        {/* rotating stamp */}
        <div className="absolute top-28 right-6 md:right-14 hidden sm:block text-gold-400">
          <RotatingStamp text="प्रमाणित बीज • उचित मूल्य • मुफ्त सलाह •" className="w-28 h-28 md:w-36 md:h-36" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 pt-40 pb-16 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-pine-950/50 backdrop-blur px-4 py-1.5 font-chunk font-semibold text-xs md:text-sm text-gold-300 tracking-wider">
              <Icon name="BadgeCheck" size={15} />
              पंजीकृत दुकान • 10+ वर्षों से सेवा में • EST. 2015
            </p>

            <h1 className="display-xl mt-5 text-5xl md:text-7xl lg:text-8xl text-cream">
              सतगुरु <span className="gold-underline">बीज भंडार</span>
            </h1>
            <p className="display-xl mt-3 text-xl md:text-3xl text-gold-300">
              बुवाई से कटाई तक — किसान का सच्चा साथी
            </p>
            <p className="mt-5 max-w-xl text-cream/75 leading-relaxed md:text-lg">
              प्रमाणित बीज, खाद, कीटनाशक, कृषि उपकरण व मुफ्त फसल सलाह — सब कुछ एक ही जगह, उचित मूल्य पर।
              दल्लुसर (सरदारशहर, चूरू) में आपकी अपनी दुकान।
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <a href={waLink("नमस्ते! मुझे बीज/दवाई की जानकारी चाहिए।")} target="_blank" rel="noreferrer" className="btn-gold">
                <Icon name="MessageCircle" size={19} />
                WhatsApp पर ऑर्डर करें
              </a>
              <a href={`tel:+${SHOP.phone1Raw}`} className="btn-outline">
                <Icon name="PhoneCall" size={18} />
                {SHOP.phone1}
              </a>
              <button onClick={() => onNavigate("products")} className="btn-outline !border-gold-400/50">
                <Icon name="ShoppingBasket" size={18} />
                उत्पाद देखें
              </button>
            </div>
          </motion.div>

          {/* stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55 }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { n: "10+", t: "वर्षों का अनुभव" },
              { n: "500+", t: "उत्पाद उपलब्ध" },
              { n: "1000+", t: "संतुष्ट किसान परिवार" },
              { n: "₹5000+", t: "पर मुफ्त होम डिलीवरी" },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-cream/15 bg-cream/[0.07] backdrop-blur px-5 py-4">
                <p className="display-xl text-3xl md:text-4xl text-gold-400">{s.n}</p>
                <p className="mt-1 text-xs md:text-sm text-cream/70 font-medium">{s.t}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <svg className="absolute bottom-0 left-0 w-full text-[#f4f7f4]" viewBox="0 0 1440 48" preserveAspectRatio="none" fill="currentColor">
          <path d="M0 48h1440V20c-120 8-240 12-360 10S840 22 720 18 480 10 360 12 120 26 0 20v28Z" />
        </svg>
      </section>

      {/* ================ WEATHER & MANDI QUICK SEARCH (FIXED) ================ */}
      <section className="py-12 md:py-16 px-4 sm:px-6 bg-[#f4f7f4] relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-emerald-50/60 to-transparent pointer-events-none" aria-hidden />
        
        {/* Desktop & Mobile दोनों पर परफेक्ट दिखने के लिए max-w-4xl और flex-col का उपयोग किया गया है */}
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col gap-6 md:gap-8">
          
          {/* ── Weather (Top) ── */}
          <div className="w-full drop-shadow-xl">
            <WeatherWidget />
          </div>

          {/* ── Mandi Card (Bottom) ── */}
          <Reveal delay={0.1} className="w-full">
            <div className="w-full bg-white rounded-[2rem] p-7 md:p-9 shadow-xl shadow-pine-900/5 border border-emerald-100/60 relative overflow-hidden group">
              
              {/* Soft Glow Background */}
              <div className="absolute -top-20 -right-20 w-56 h-56 bg-emerald-100 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full">
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Icon name="TrendingUp" size={24} />
                  </span>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-pine-950 tracking-tight font-chunk">
                      मंडी भाव
                    </h3>
                    <p className="text-emerald-700 text-sm font-semibold">सरकारी लाइव आंकड़े</p>
                  </div>
                </div>

                {/* डेस्कटॉप पर खाली जगह बचाने के लिए ग्रिड (2 Columns on Desktop) */}
                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                  {/* Local Mandis */}
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2.5">लोकल मंडियाँ</p>
                    <div className="flex flex-wrap gap-2">
                      {["सरदारशहर", "नोहर", "रावतसर", "हनुमानगढ़", "श्रीगंगानगर", "चूरू"].map((m) => (
                        <span key={m} className="text-xs md:text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full font-bold">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Crops */}
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2.5">मुख्य फसलें</p>
                    <div className="flex flex-wrap gap-2">
                      {["सरसों", "ग्वार", "गेहूं", "चना", "कपास", "मूंग", "बाजरा"].map((c) => (
                        <span key={c} className="text-xs md:text-sm bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full font-bold">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Big Click Button */}
                <div className="mt-auto">
                  <button
                    onClick={() => onNavigate("mandi")}
                    className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-pine-700 hover:from-emerald-500 hover:to-pine-600 text-white py-4 rounded-2xl font-bold text-base md:text-lg shadow-lg shadow-emerald-700/25 hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0"
                  >
                    <Icon name="TrendingUp" size={20} />
                    भाव देखने के लिए यहाँ क्लिक करें
                    <Icon name="ArrowRight" size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-center text-[11px] text-gray-400 mt-3 font-medium">
                    ताज़ा सरकारी मंडी रेट • मुफ्त • एक क्लिक में
                  </p>
                </div>

              </div>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}
      <section className="relative bg-cream">
        <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {TRUST_POINTS.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06}>
                <div className="group h-full rounded-2xl border border-pine-700/10 bg-cream-2 p-4 md:p-5 text-center hover:bg-pine-700 hover:-translate-y-1.5 transition-all duration-300 cursor-default shadow-sm">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-pine-700/10 text-pine-700 group-hover:bg-gold-400 group-hover:text-pine-950 transition-colors">
                    <Icon name={t.icon} size={22} />
                  </span>
                  <p className="mt-3 font-chunk font-bold text-sm md:text-base text-pine-900 group-hover:text-cream transition-colors">{t.title}</p>
                  <p className="mt-1 text-[11px] md:text-xs text-ink-600 group-hover:text-cream/70 transition-colors leading-snug">{t.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ABOUT + LICENSE ================= */}
      <section className="section relative overflow-hidden">
        <div className="absolute -right-24 top-10 w-72 h-72 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <SectionHead
                eyebrow="हमारे बारे में"
                title={<>किसान भाइयों का <span className="gold-underline">स्वागत है</span></>}
              />
              <Reveal className="space-y-4 text-ink-600 leading-relaxed md:text-lg -mt-6">
                {ABOUT_TEXT.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Reveal>

              {/* founder card */}
              <Reveal delay={0.15}>
                <div className="mt-7 flex items-start gap-4 rounded-2xl border-l-4 border-gold-500 bg-cream-2 p-5 shadow-sm">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine-700 text-gold-300">
                    <Icon name="User" size={26} />
                  </span>
                  <div>
                    <p className="font-chunk font-bold text-lg text-pine-900">रमेश कुमार</p>
                    <p className="text-sm text-gold-600 font-semibold">संस्थापक एवं प्रबंधक, सतगुरु बीज भंडार</p>
                    <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">
                      "हर किसान भाई मेरे लिए परिवार है — सही बीज, सही दवा, सही सलाह; यही मेरा वादा है।"
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* image + license card */}
            <Reveal delay={0.1} className="relative">
              <div className="relative">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-[2rem] border-2 border-dashed border-gold-500/40" aria-hidden />
                  <img src="/images/seeds.jpg" alt="किसान के हाथ में बीज" className="relative rounded-[1.75rem] w-full h-72 md:h-96 object-cover shadow-2xl" />
                </div>
                {/* license card */}
                <div className="card grain relative z-10 mx-3 sm:mx-8 lg:mx-10 -mt-12 lg:-mt-16 p-5 md:p-6 max-w-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-700 text-gold-300">
                      <Icon name="FileCheck" size={19} />
                    </span>
                    <p className="font-chunk font-bold text-pine-900 text-base md:text-lg">दुकान पंजीकरण / लाइसेंस विवरण</p>
                  </div>
                  <ul className="space-y-1.5 text-sm text-ink-600 font-chunk">
                    <li className="flex justify-between gap-4 border-b border-dashed border-pine-700/15 pb-1.5"><span>GSTIN (जीएसटी नंबर)</span><b className="text-pine-800">{SHOP.gstin}</b></li>
                    <li className="flex justify-between gap-4 border-b border-dashed border-pine-700/15 pb-1.5"><span>राज्य कोड</span><b className="text-pine-800">{SHOP.stateCode}</b></li>
                    <li className="flex justify-between gap-4 border-b border-dashed border-pine-700/15 pb-1.5"><span>फर्म लाइसेंस नं.</span><b className="text-pine-800">{SHOP.firmLicense}</b></li>
                    <li className="flex justify-between gap-4 border-b border-dashed border-pine-700/15 pb-1.5"><span>बीज लाइसेंस नं.</span><b className="text-pine-800">{SHOP.seedLicense}</b></li>
                    <li className="flex justify-between gap-4"><span>खाद लाइसेंस नं.</span><b className="text-pine-800">{SHOP.fertLicense}</b></li>
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= SERVICES ================= */}
      <section className="section relative bg-pine-950 grain overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-15" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5">
          <SectionHead
            light
            align="center"
            eyebrow="हमारी सेवाएं"
            title={<>हम क्या-क्या सेवाएं <span className="text-gold-400">प्रदान करते हैं</span></>}
            sub="बुवाई से कटाई तक — फसल की हर जरूरत के लिए एक ही भरोसेमंद पता"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.07}>
                <div className="group h-full rounded-3xl border border-cream/12 bg-gradient-to-b from-cream/[0.07] to-cream/[0.03] p-6 md:p-7 hover:border-gold-400/50 hover:-translate-y-2 transition-all duration-300">
                  <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gold-400 text-pine-950 shadow-lg shadow-gold-500/25 group-hover:scale-110 group-hover:rotate-6 transition-transform" style={{ width: 52, height: 52 }}>
                    <Icon name={s.icon} size={26} />
                  </span>
                  <p className="mt-5 display-xl text-2xl text-cream">{s.title}</p>
                  <p className="mt-2.5 text-sm md:text-[15px] text-cream/65 leading-relaxed">{s.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.points.map((p) => (
                      <span key={p} className="pill !bg-cream/8 !text-gold-300/95 border !border-cream/10" style={{ fontSize: "0.72rem" }}>{p}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TOOLS GRID ================= */}
      <section className="section relative overflow-hidden">
        <div className="absolute inset-0 field-lines" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5">
          <SectionHead
            eyebrow="किसान डिजिटल टूल्स"
            title={<>एक क्लिक में <span className="gold-underline">पूरी कृषि जानकारी</span></>}
            sub="फसल गाइड, रोग-दवाई, मंडी भाव, MSP, योजनाएं — सब कुछ हिंदी में, मुफ्त में, आपके लिए"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {TOOLS.map((t, i) => (
              <Reveal key={t.key} delay={i * 0.05}>
                <button
                  onClick={() => onNavigate(t.key)}
                  className="group relative w-full h-full text-left rounded-3xl overflow-hidden bg-cream-2 border border-pine-700/10 p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300"
                >
                  <span className={`absolute top-0 right-0 w-28 h-28 rounded-full bg-gradient-to-br ${t.accent} opacity-10 -translate-y-10 translate-x-10 group-hover:scale-[2.2] transition-transform duration-500`} aria-hidden />
                  <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${t.accent} text-white shadow-lg`}>
                    <Icon name={t.icon} size={24} />
                  </span>
                  <p className="relative mt-4 font-chunk font-bold text-lg text-pine-900 leading-tight">{t.title}</p>
                  <p className="relative mt-1.5 text-xs md:text-sm text-ink-600 leading-relaxed">{t.desc}</p>
                  <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-chunk font-bold text-pine-700 group-hover:text-gold-600 transition-colors">
                    देखें
                    <Icon name="ArrowRight" size={16} className="group-hover:translate-x-1.5 transition-transform" />
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= YOUTUBE & FACEBOOK CARDS ================= */}
      <section className="relative bg-cream pb-16">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead
            eyebrow="सोशल मीडिया व वीडियो"
            title={<>हमारे साथ <span className="gold-underline">ऑनलाइन जुड़ें</span></>}
            sub="ताज़ा कृषि अपडेट्स, नया स्टॉक, और खेती की आधुनिक तकनीकों के वीडियो देखें।"
          />
          <div className="grid sm:grid-cols-2 gap-5 md:gap-6 -mt-4">
            {/* YouTube Card */}
            <Reveal delay={0.05}>
              <div
                onClick={() => onNavigate("youtube")}
                className="group cursor-pointer rounded-3xl border border-pine-700/10 bg-cream-2 p-6 md:p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/10 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Icon name="Youtube" size={32} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-chunk font-bold text-pine-700 group-hover:text-red-600 transition-colors">
                    वीडियो देखें <Icon name="ArrowRight" size={16} className="group-hover:translate-x-1.5 transition-transform" />
                  </span>
                </div>
                <p className="display-xl text-2xl md:text-3xl text-pine-900 mt-2">YouTube चैनल</p>
                <p className="mt-2.5 text-ink-600 leading-relaxed text-sm md:text-base flex-1">
                  फसल बुवाई, सही दवाई की मात्रा, और कीट नियंत्रण के सभी वीडियो एक जगह देखें। हमारे कृषि विशेषज्ञों द्वारा तैयार की गई विशेष वीडियो गाइड।
                </p>
              </div>
            </Reveal>

            {/* Facebook Card */}
            <Reveal delay={0.1}>
              <div
                onClick={() => onNavigate("facebook")}
                className="group cursor-pointer rounded-3xl border border-pine-700/10 bg-cream-2 p-6 md:p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Icon name="Facebook" size={32} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-chunk font-bold text-pine-700 group-hover:text-blue-600 transition-colors">
                    पेज देखें <Icon name="ArrowRight" size={16} className="group-hover:translate-x-1.5 transition-transform" />
                  </span>
                </div>
                <p className="display-xl text-2xl md:text-3xl text-pine-900 mt-2">Facebook अपडेट्स</p>
                <p className="mt-2.5 text-ink-600 leading-relaxed text-sm md:text-base flex-1">
                  दुकान की नई जानकारियों, बीज व दवाई के ताज़ा स्टॉक, और रोज़ाना के ऑफर्स व अपडेट्स के लिए हमारे फेसबुक पेज से जुड़ें।
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= SPRAY IMAGE BAND ================= */}
      <section className="relative h-72 md:h-96 overflow-hidden">
        <img src="/images/spray.jpg" alt="खेत में छिड़काव" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-pine-950/90 via-pine-950/50 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-5 w-full">
            <Reveal>
              <p className="display-xl text-3xl md:text-5xl text-cream max-w-xl leading-tight">
                पत्ते की फोटो भेजें,<br /><span className="text-gold-400">सही दवाई की सलाह पाएं</span>
              </p>
              <p className="mt-3 text-cream/75 max-w-md text-sm md:text-base">रोग की पहचान हेतु WhatsApp पर फसल की तस्वीर भेजें — हमारे विशेषज्ञ मुफ्त सलाह देंगे।</p>
              <a href={waLink("नमस्ते! मेरी फसल में रोग/कीट की समस्या है। फोटो भेज रहा हूं, कृपया दवाई की सलाह दें।")} target="_blank" rel="noreferrer" className="btn-gold mt-5">
                <Icon name="MessageCircle" size={18} />
                फोटो भेजें — मुफ्त सलाह
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= TEAM ================= */}
      <section className="section relative">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead
            eyebrow="संचालक एवं सहयोगी टीम"
            title={<>मिलिए <span className="gold-underline">हमारी टीम</span> से</>}
            sub="किसी भी कृषि सलाह या सेवा के लिए हमसे सीधे संपर्क करें"
          />
          <div className="grid md:grid-cols-3 gap-5 md:gap-7">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.1}>
                <div className="card grain relative h-full p-7 text-center overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400" />
                  <span className="pill pill-gold absolute top-4 right-4">{m.badge}</span>
                  
                  {/* फोटो या डिफ़ॉल्ट आइकॉन */}
                  <div className="mx-auto h-20 w-20 rounded-full overflow-hidden bg-pine-700 text-gold-300 shadow-lg shadow-pine-900/20 ring-4 ring-gold-400/40">
                    {m.image ? (
                      <img 
                      src={m.image} 
                      alt={m.name} 
                      className="h-full w-full object-cover rounded-full" 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icon name="User" size={38} />
                      </div>
                    )}
                  </div>

                  <p className="mt-4 display-xl text-2xl text-pine-900">{m.name}</p>
                  <p className="mt-0.5 font-chunk font-semibold text-sm text-gold-600">{m.role}</p>
                  <p className="mt-3 text-sm text-ink-600 leading-relaxed">{m.desc}</p>
                  <div className="mt-5 flex justify-center gap-3">
                    <a href={`tel:+${m.phone}`} className="btn-green">
                      <Icon name="Phone" size={16} /> कॉल
                    </a>
                    <a
                      href={waLink(`नमस्ते ${m.name} जी! मुझे ${m.role} संबंधी सहायता चाहिए।`, m.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white font-chunk font-semibold text-sm px-4 py-2 hover:-translate-y-0.5 transition-transform"
                    >
                      <Icon name="MessageCircle" size={16} /> व्हाट्सएप
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      {/* pb-40 md:pb-28 इसलिए दिया है ताकि iPhone/Mobile पर तैरता हुआ AI डॉक्टर बटन कार्ड्स को न ढके */}
      <section className="section relative bg-pine-950 grain overflow-hidden pb-40 md:pb-28">
        <div className="absolute inset-0">
          <img src="/images/sarson.jpg" alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-pine-950 via-pine-950/80 to-pine-950" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5">
          <SectionHead light eyebrow="संपर्क करें" title={<>हमसे <span className="text-gold-400">जुड़ें</span></>} />
          <div className="grid lg:grid-cols-2 gap-6 md:gap-8 -mt-4">
            {/* address & hours */}
            <Reveal>
              <div className="h-full rounded-3xl border border-cream/12 bg-cream/[0.06] backdrop-blur p-5 sm:p-7 md:p-8">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-pine-950">
                    <Icon name="MapPin" size={22} />
                  </span>
                  <div>
                    <p className="display-xl text-xl sm:text-2xl text-cream">पता</p>
                    <p className="mt-2 text-cream/75 text-sm sm:text-base leading-relaxed">
                      <b className="text-gold-300">{SHOP.name}</b><br />
                      {SHOP.address.map((l) => (
                        <span key={l} className="block">{l}</span>
                      ))}
                    </p>
                    <a href={SHOP.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-chunk font-bold text-sm text-gold-400 hover:text-gold-300 transition">
                      Google Maps पर खोलें <Icon name="ArrowUpRight" size={15} />
                    </a>
                  </div>
                </div>
                <div className="mt-7 flex items-start gap-3 sm:gap-4">
                  <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-pine-950">
                    <Icon name="Clock" size={22} />
                  </span>
                  <div>
                    <p className="display-xl text-xl sm:text-2xl text-cream">खुलने का समय</p>
                    <p className="mt-2 text-cream/75 text-sm sm:text-base">{SHOP.hours}</p>
                    <p className="text-cream/55 text-xs sm:text-sm">{SHOP.hoursSunday}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* phones */}
            <Reveal delay={0.12}>
              <div className="h-full flex flex-col gap-3 sm:gap-4">
                {[
                  { label: "फोन नंबर (मुख्य)", value: SHOP.phone1, href: `tel:+${SHOP.phone1Raw}`, icon: "PhoneCall", note: "ऑर्डर व पूछताछ हेतु" },
                  { label: "फोन नंबर (वैकल्पिक)", value: SHOP.phone2, href: `tel:+${SHOP.phone2Raw}`, icon: "Phone", note: "दुकान संपर्क" },
                  { label: "WhatsApp", value: SHOP.phone1, href: waLink("नमस्ते! मुझे ऑर्डर देना है।"), icon: "MessageCircle", note: "ऑर्डर, फसल फोटो, मुफ्त सलाह" },
                  { label: "ईमेल", value: SHOP.email, href: `mailto:${SHOP.email}`, icon: "Mail", note: "लिखित पूछताछ हेतु" },
                ].map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-cream/12 bg-cream/[0.06] backdrop-blur p-4 sm:px-5 sm:py-4 hover:border-gold-400/60 hover:bg-cream/10 transition"
                  >
                    <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-pine-700 text-gold-300 group-hover:bg-gold-400 group-hover:text-pine-950 transition-colors">
                      <Icon name={c.icon} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] sm:text-xs font-chunk font-bold tracking-widest text-gold-400 uppercase">{c.label}</span>
                      <span className="block text-base sm:text-lg font-chunk font-bold text-cream break-all">{c.value}</span>
                      <span className="block text-[11px] sm:text-xs text-cream/55">{c.note}</span>
                    </span>
                    <Icon name="ArrowUpRight" size={18} className="ml-auto text-cream/40 group-hover:text-gold-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all shrink-0" />
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
};