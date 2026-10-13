import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck, Store, MessagesSquare, HandCoins, Truck, ShieldCheck, Sprout, Bug,
  FlaskConical, Wind, GraduationCap, Phone, MessageCircle, MapPin, Clock, Mail,
  Home, ShoppingBasket, Stethoscope, Flower2, TrendingUp, Landmark, ScrollText,
  Wheat, Leaf, ArrowRight, ArrowUpRight, ChevronRight, Search, Menu, X, User,
  CalendarDays, Droplets, Sparkles, AlertTriangle, BookOpen, Bell, ExternalLink,
  Sun, CloudRain, Award, FileCheck, Pill, Syringe, Scissors, CheckCircle2, Info,
  TrendingDown, Minus, ClipboardList, PackageCheck, PhoneCall, Hammer, Shovel,
  ArrowUp,
} from "lucide-react";

/* ---------- Custom Youtube & Facebook Icons ---------- */
const YoutubeIcon = ({ className, size = 20 }: { className?: string; size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const FacebookIcon = ({ className, size = 20 }: { className?: string; size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

/* ---------- icon registry ---------- */
const ICONS: Record<string, any> = {
  BadgeCheck, Store, MessagesSquare, HandCoins, Truck, ShieldCheck, Sprout, Bug,
  FlaskConical, Wind, GraduationCap, Phone, MessageCircle, MapPin, Clock, Mail,
  Home, ShoppingBasket, Stethoscope, Flower2, TrendingUp, Landmark, ScrollText,
  Wheat, Leaf, ArrowRight, ArrowUpRight, ChevronRight, Search, Menu, X, User,
  CalendarDays, Droplets, Sparkles, AlertTriangle, BookOpen, Bell, ExternalLink,
  Sun, CloudRain, Award, FileCheck, Pill, Syringe, Scissors, CheckCircle2, Info,
  TrendingDown, Minus, ClipboardList, PackageCheck, PhoneCall, Hammer, Shovel,
  Youtube: YoutubeIcon,
  Facebook: FacebookIcon,
};

export const Icon = ({ name, className, size = 20 }: { name: string; className?: string; size?: number }) => {
  const Cmp = ICONS[name] ?? Sprout;
  return <Cmp className={className} size={size} strokeWidth={2} />;
};

/* ---------- scroll reveal wrapper ---------- */
export const Reveal = ({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

/* ---------- wheat ear SVG ---------- */
export const WheatEar = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
    <path d="M12 22V10" />
    <path d="M12 10c0-3-2.2-5-4.5-5.6C9.5 6.2 10.5 8.2 12 10Z" fill="currentColor" stroke="none" opacity=".9" />
    <path d="M12 10c0-3 2.2-5 4.5-5.6C14.5 6.2 13.5 8.2 12 10Z" fill="currentColor" stroke="none" opacity=".9" />
    <path d="M12 15c0-3-2.2-5-4.5-5.6C9.5 11.2 10.5 13.2 12 15Z" fill="currentColor" stroke="none" opacity=".85" />
    <path d="M12 15c0-3-2.2-5-4.5-5.6C14.5 11.2 13.5 13.2 12 15Z" fill="currentColor" stroke="none" opacity=".85" />
    <path d="M12 20c0-3-2.2-5-4.5-5.6C9.5 16.2 10.5 18.2 12 20Z" fill="currentColor" stroke="none" opacity=".8" />
    <path d="M12 20c0-3-2.2-5-4.5-5.6C14.5 16.2 13.5 18.2 12 20Z" fill="currentColor" stroke="none" opacity=".8" />
  </svg>
);

/* ---------- section heading ---------- */
export const SectionHead = ({
  eyebrow,
  title,
  sub,
  light = false,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  light?: boolean;
  align?: "left" | "center";
}) => (
  <Reveal className={`mb-10 md:mb-14 ${align === "center" ? "text-center" : ""}`}>
    <div className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}>
      <WheatEar className={`w-5 h-6 ${light ? "text-gold-400" : "text-gold-500"}`} />
      <span className={`font-chunk font-bold tracking-[0.18em] text-sm uppercase ${light ? "text-gold-400" : "text-gold-600"}`}>
        {eyebrow}
      </span>
    </div>
    <h2 className={`display-xl mt-3 text-4xl md:text-5xl lg:text-6xl ${light ? "text-cream" : "text-pine-900"}`}>
      {title}
    </h2>
    {sub && (
      <p className={`mt-4 max-w-2xl text-base md:text-lg leading-relaxed ${light ? "text-cream/70" : "text-ink-600"} ${align === "center" ? "mx-auto" : ""}`}>
        {sub}
      </p>
    )}
  </Reveal>
);

/* ---------- top mandi ticker ---------- */
export const Ticker = ({ items, onClick }: { items: string[]; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full bg-gold-400 text-pine-950 overflow-hidden cursor-pointer group relative"
    aria-label="मंडी भाव देखें"
  >
    <div className="flex items-center">
      <div className="shrink-0 z-10 bg-pine-950 text-gold-400 px-3 py-1.5 font-chunk font-bold text-xs md:text-sm flex items-center gap-1.5">
        <TrendingUp size={14} />
        मंडी भाव
      </div>
      <div className="overflow-hidden flex-1 py-1.5">
        <div className="marquee-track font-chunk font-semibold text-xs md:text-sm">
          {[...items, ...items].map((t, i) => (
            <span key={i} className="mx-5 inline-flex items-center gap-2 whitespace-nowrap">
              <WheatEar className="w-3.5 h-4 opacity-70" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
    <span className="absolute inset-0 opacity-0 group-hover:bg-white/10 transition" />
  </button>
);

/* ---------- rotating circular stamp ---------- */
export const RotatingStamp = ({ text, className = "" }: { text: string; className?: string }) => {
  const chars = text.split("");
  return (
    <div className={`relative ${className}`}>
      <div className="stamp-ring w-full h-full">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <path id="circ" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
          </defs>
          <text className="fill-current" style={{ fontSize: "8.2px", fontFamily: "Baloo 2", letterSpacing: "2.5px", fontWeight: 700 }}>
            <textPath href="#circ">
              {chars.map((c, i) => (
                <tspan key={i}>{c === " " ? "\u00A0" : c}</tspan>
              ))}
            </textPath>
          </text>
        </svg>
      </div>
      <WheatEar className="absolute inset-0 m-auto w-8 h-10" />
    </div>
  );
};

/* ---------- scroll to top ---------- */
export const ScrollToTop = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 450);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <motion.button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      initial={false}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.5, pointerEvents: show ? "auto" : "none" }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-[92px] right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-pine-950 text-gold-400 border border-gold-400/40 shadow-xl hover:bg-pine-800 transition-colors"
      aria-label="ऊपर जाएं"
      title="ऊपर जाएं"
    >
      <ArrowUp size={20} />
    </motion.button>
  );
};

/* ---------- floating whatsapp ---------- */
export const FloatingWhatsApp = ({ href }: { href: string }) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noreferrer"
    initial={{ scale: 0, rotate: -30 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 14 }}
    className="fixed bottom-5 right-5 z-50 group"
    aria-label="WhatsApp पर संपर्क करें"
  >
    <span className="absolute inset-0 rounded-full bg-leaf-500 animate-ping opacity-25" />
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-green-900/30 group-hover:scale-110 transition-transform">
      <Icon name="MessageCircle" size={26} />
    </span>
    <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-pine-950 text-cream text-xs font-chunk font-semibold px-3 py-1.5 opacity-0 group-hover:opacity-100 transition pointer-events-none">
      WhatsApp पर ऑर्डर करें
    </span>
  </motion.a>
);

/* ---------- page header band for inner pages ---------- */
export const PageHero = ({
  eyebrow,
  title,
  sub,
  image,
}: {
  eyebrow: string;
  title: ReactNode;
  sub: string;
  image?: string;
}) => (
  <header className="relative overflow-hidden bg-pine-950 grain">
    {image && (
      <div className="absolute inset-0">
        <img src={image} alt="" className="w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/70 to-pine-950/40" />
      </div>
    )}
    <div className="absolute inset-0 dot-grid opacity-30" />
    <div className="relative mx-auto max-w-7xl px-5 pt-28 pb-14 md:pt-36 md:pb-20">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center gap-3">
          <WheatEar className="w-5 h-6 text-gold-400" />
          <span className="font-chunk font-bold tracking-[0.2em] text-xs md:text-sm uppercase text-gold-400">{eyebrow}</span>
        </div>
        <h1 className="display-xl mt-4 text-4xl md:text-6xl text-cream max-w-3xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-cream/70 leading-relaxed md:text-lg">{sub}</p>
      </motion.div>
    </div>
    <svg className="absolute bottom-0 left-0 w-full text-cream" viewBox="0 0 1440 48" preserveAspectRatio="none" fill="currentColor">
      <path d="M0 48h1440V20c-120 8-240 12-360 10S840 22 720 18 480 10 360 12 120 26 0 20v28Z" />
    </svg>
  </header>
);