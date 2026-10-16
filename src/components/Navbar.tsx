import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS, SHOP, waLink } from "../data/content";
import { Icon, Ticker, WheatEar } from "./Shared";
import { ShieldCheck, UserCheck, User, LogOut, HandCoins } from "lucide-react";

const TICKER_ITEMS = [
  "सरसों ₹6,xxx/क्विंटल",
  "गेहूं ₹2,xxx/क्विंटल",
  "चना ₹5,xxx/क्विंटल",
  "ग्वार ₹5,xxx/क्विंटल",
  "मूंग ₹8,xxx/क्विंटल",
  "बाजरा ₹2,xxx/क्विंटल",
  "तिल ₹12,xxx/क्विंटल",
  "कपास ₹8,xxx-,105x/क्विंटal",
  "जीरा ₹20,xxx/क्विंटल",
  "ताजा भाव हेतु कॉल करें: 79889 50257",
];

const FINAL_NAV_ITEMS = NAV_ITEMS;

interface NavbarProps {
  page: any;
  onNavigate: (p: any) => void;
  userRole: "admin" | "farmer" | "guest" | null;
  onOpenRoleModal: () => void;
  activeFarmerName?: string;
}

export const Navbar = ({
  page,
  onNavigate,
  userRole,
  onOpenRoleModal,
  activeFarmerName,
}: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const skipRestore = useRef(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (open) {
      const y = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${y}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (!skipRestore.current && top) {
        const y = parseInt(top, 10) * -1;
        if (!Number.isNaN(y)) window.scrollTo(0, y);
      }
      skipRestore.current = false;
    }
  }, [open]);

  const go = (p: any) => {
    skipRestore.current = true;
    setOpen(false);
    onNavigate(p);
  };

  const handleNavClick = (key: any) => {
    if (key === "udhaar" && (userRole === "guest" || !userRole)) {
      setOpen(false);
      onOpenRoleModal();
    } else {
      go(key);
    }
  };

  // ========== USER BADGE ==========
  const UserBadge = () => {
    if (!userRole) return null;

    return (
      <div className="flex items-center gap-2 bg-pine-900/50 p-1.5 pr-3 rounded-full border border-cream/20">
        {userRole === "admin" && (
          <>
            <span className="bg-gold-500 text-pine-950 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck size={12} /> ADMIN
            </span>
            <button
              onClick={onOpenRoleModal}
              className="text-[10px] text-cream hover:text-gold-400 font-bold flex items-center gap-1"
              title="लॉगिन बदलें"
            >
              <LogOut size={12} /> बदलें
            </button>
          </>
        )}

        {userRole === "farmer" && (
          <span className="bg-green-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <UserCheck size={12} /> {activeFarmerName || "किसान"}
          </span>
        )}

        {userRole === "guest" && (
          <span className="bg-gray-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
            <User size={12} /> GUEST
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ticker */}
      <div className="fixed top-0 inset-x-0 z-50">
        <Ticker items={TICKER_ITEMS} onClick={() => go("mandi")} />
      </div>

      {/* main bar */}
      <div
        className={`fixed top-[30px] inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-pine-950/95 backdrop-blur-md shadow-lg shadow-pine-950/30"
            : "bg-pine-950/60 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* logo */}
            <button
              onClick={() => go("home")}
              className="flex items-center gap-2.5 group shrink-0"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-pine-950 shadow-md shadow-gold-500/30 group-hover:rotate-12 transition-transform">
                <WheatEar className="w-5 h-6" />
              </span>
              <span className="text-left leading-none">
                <span className="display-xl block text-lg md:text-xl text-cream">
                  सतगुरु बीज भंडार
                </span>
                <span className="block text-[10px] md:text-[11px] font-chunk font-semibold tracking-[0.22em] text-gold-400 mt-1 uppercase">
                  दल्लुसर • सरदारशहर
                </span>
              </span>
            </button>

            {/* desktop links */}
            <nav className="hidden xl:flex items-center gap-3.5">
              {FINAL_NAV_ITEMS.map((n) => (
                <button
                  key={n.key}
                  onClick={() => handleNavClick(n.key)}
                  className={`nav-link !text-[0.88rem] flex items-center gap-1 ${
                    page === n.key ? "active" : ""
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>

            {/* actions */}
            <div className="flex items-center gap-2.5">
              {/* मुख्य किसान उधार पोर्टल बटन */}
              <button
                onClick={() => handleNavClick("udhaar")}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 hover:bg-gold-300 text-pine-950 font-chunk font-bold text-xs md:text-sm px-3.5 py-2 shadow-md shadow-gold-500/20 transition-all transform hover:scale-105 active:scale-95 shrink-0"
              >
                <HandCoins size={16} />
                <span className="whitespace-nowrap">किसान उधार पोर्टल</span>
              </button>

              {/* DESKTOP USER BADGE */}
              <div className="hidden lg:block">
                <UserBadge />
              </div>

              <a
                href={`tel:+${SHOP.phone1Raw}`}
                className="hidden md:inline-flex btn-green !py-2 !px-4"
              >
                <Icon name="Phone" size={16} />
                <span className="hidden lg:inline">{SHOP.phone1}</span>
                <span className="lg:hidden">कॉल करें</span>
              </a>

              {/* hamburger */}
              <button
                onClick={() => setOpen(true)}
                className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/25 text-cream hover:bg-cream/10 active:scale-95 transition"
                aria-label="मेनू खोलें"
              >
                <Icon name="Menu" size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MOBILE / TABLET FULL MENU ============ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-pine-950"
            style={{ height: "100dvh" }}
          >
            <div className="h-full flex flex-col">
              {/* menu header */}
              <div className="shrink-0 flex items-center justify-between px-5 h-16 border-b border-cream/10">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 text-pine-950">
                    <WheatEar className="w-4.5 h-5" />
                  </span>
                  <span className="display-xl text-lg text-cream">सतगुरु बीज भंडार</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-pine-950 active:scale-95 transition"
                  aria-label="मेनू बंद करें"
                >
                  <Icon name="X" size={20} />
                </button>
              </div>

              {/* MOBILE USER BADGE (तभी जगह घेरेगा जब यूजर लॉगिन होगा) */}
              {userRole && (
                <div className="px-5 py-3 border-b border-cream/5 flex justify-center">
                  <UserBadge />
                </div>
              )}

              {/* scrollable links */}
              <nav
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <ul className="divide-y divide-cream/10">
                  {FINAL_NAV_ITEMS.map((n, i) => (
                    <motion.li
                      key={n.key}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 + i * 0.04 }}
                    >
                      <button
                        onClick={() => handleNavClick(n.key)}
                        className={`w-full flex items-center gap-3.5 py-3 text-left group ${
                          page === n.key ? "text-gold-400" : "text-cream"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                            page === n.key
                              ? "bg-gold-400 text-pine-950"
                              : "bg-cream/10 text-gold-300"
                          }`}
                        >
                          <Icon name={n.icon || "Sprout"} size={19} />
                        </span>
                        <span className="display-xl text-xl">{n.label}</span>
                        <Icon name="ChevronRight" className="ml-auto opacity-50" size={18} />
                      </button>
                    </motion.li>
                  ))}
                </ul>

                {/* CTA buttons */}
                <div className="mt-5 grid grid-cols-2 gap-3 pb-3">
                  <a href={`tel:+${SHOP.phone1Raw}`} className="btn-gold justify-center !text-sm">
                    <Icon name="Phone" size={17} /> कॉल करें
                  </a>
                  <a
                    href={waLink("नमस्ते! मुझे जानकारी चाहिए।")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white font-chunk font-bold text-sm px-6 py-3.5"
                  >
                    <Icon name="MessageCircle" size={17} /> WhatsApp
                  </a>
                </div>

                <p className="pb-6 text-center text-cream/50 text-xs font-chunk">
                  {SHOP.hours} • {SHOP.hoursSunday}
                </p>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};