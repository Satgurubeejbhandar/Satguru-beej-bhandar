import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MSP_KHARIF_2526,
  MSP_KHARIF_2627,
  MSP_RABI_2526,
  MSP_RABI_2627,
  MSP_OTHER_COMMERCIAL,
  type MspRow,
} from "../data/market";
import { Icon, PageHero, WheatEar, Reveal } from "../components/Shared";
import { supabase } from "../lib/supabase";
import { Plus, Edit2, Trash2, RefreshCw, X, Check } from "lucide-react";

/* ───────── Types ───────── */
type SeasonTab = "rabi2526" | "kharif2526" | "rabi2627" | "kharif2627" | "other";
type CategoryFilter = "all" | "cereals" | "pulses" | "oilseeds" | "commercial";

interface MspPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

/* ───────── Full Form Shape (all fields) ───────── */
interface MspFormData {
  crop_name: string;        // हिन्दी नाम (गेहूं)
  crop_name_en: string;     // English name (Wheat)
  category: string;         // cereals | pulses | oilseeds | commercial
  category_hindi: string;   // अनाज | दलहन | तिलहन | नकदी
  season: string;           // rabi2526 | kharif2526 | rabi2627 | kharif2627 | other
  cost_a2fl: number | "";   // लागत A2+FL
  prev_msp: number | "";    // पिछला MSP
  msp_price: number | "";   // वर्तमान MSP
  unit: string;             // क्विंटल | टन
  year: string;             // 2025-26 | 2026-27
}

const EMPTY_FORM: MspFormData = {
  crop_name: "",
  crop_name_en: "",
  category: "cereals",
  category_hindi: "अनाज",
  season: "rabi2526",
  cost_a2fl: "",
  prev_msp: "",
  msp_price: "",
  unit: "क्विंटल",
  year: "2025-26",
};

/* ───────── Season Configs ───────── */
const SEASONS: {
  key: SeasonTab;
  label: string;
  sub: string;
  data: MspRow[];
  announced: string;
  source: string;
  latest?: boolean;
}[] = [
  {
    key: "rabi2526",
    label: "रबी 2025-26",
    sub: "गेहूं • सरसों • चना • मसूर • जौ",
    data: MSP_RABI_2526,
    announced: "CCEA निर्णय: 16 अक्टूबर 2024",
    source: "PIB Release ID: 2065360",
  },
  {
    key: "kharif2526",
    label: "खरीफ 2025-26",
    sub: "धान • बाजरा • मूंग • कपास • सोयाबीन",
    data: MSP_KHARIF_2526,
    announced: "CCEA निर्णय: 19 जून 2024",
    source: "PIB Release ID: 2026725",
  },
  {
    key: "rabi2627",
    label: "रबी 2026-27",
    sub: "नवीनतम स्वीकृत/संशोधित दरें",
    data: MSP_RABI_2627,
    announced: "CACP / CCEA आधिकारिक दरें",
    source: "कृषि मंत्रालय भारत सरकार",
    latest: true,
  },
  {
    key: "kharif2627",
    label: "खरीफ 2026-27",
    sub: "आगामी विपणन सत्र",
    data: MSP_KHARIF_2627,
    announced: "CACP / CCEA अनुमानित दरें",
    source: "कृषि मंत्रालय भारत सरकार",
    latest: true,
  },
  {
    key: "other",
    label: "व्यावसायिक फसलें",
    sub: "जूट • खोपरा (नारियल) • गन्ना (FRP)",
    data: MSP_OTHER_COMMERCIAL,
    announced: "CCEA विशेष निर्णय",
    source: "भारत सरकार गजट",
  },
];

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "सभी फसलें (All)" },
  { key: "cereals", label: "अनाज (Cereals)" },
  { key: "pulses", label: "दलहन (Pulses)" },
  { key: "oilseeds", label: "तिलहन (Oilseeds)" },
  { key: "commercial", label: "नकदी / व्यावसायिक" },
];

const CATEGORY_OPTIONS = [
  { value: "cereals", label: "अनाज (Cereals)", hindi: "अनाज" },
  { value: "pulses", label: "दलहन (Pulses)", hindi: "दलहन" },
  { value: "oilseeds", label: "तिलहन (Oilseeds)", hindi: "तिलहन" },
  { value: "commercial", label: "नकदी / व्यावसायिक (Commercial)", hindi: "नकदी" },
];

const SEASON_OPTIONS = [
  { value: "rabi2526", label: "रबी 2025-26" },
  { value: "kharif2526", label: "खरीफ 2025-26" },
  { value: "rabi2627", label: "रबी 2026-27" },
  { value: "kharif2627", label: "खरीफ 2026-27" },
  { value: "other", label: "व्यावसायिक / अन्य" },
];

const UNIT_OPTIONS = ["क्विंटल", "टन", "किलो"];
const YEAR_OPTIONS = ["2024-25", "2025-26", "2026-27", "2027-28"];

/* ================================================================
   COMPONENT
   ================================================================ */
export const MspPage = ({ userRole }: MspPageProps) => {
  const [tab, setTab] = useState<SeasonTab>("rabi2526");
  const [search, setSearch] = useState<string>("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");

  /* ── Supabase dynamic state ── */
  const [dbMsp, setDbMsp] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── Modal state ── */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MspFormData>({ ...EMPTY_FORM });

  const season = SEASONS.find((s) => s.key === tab)!;

  /* ── Fetch from Supabase ── */
  const fetchDbMsp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("msp_rates").select("*");
      if (!error && data) {
        setDbMsp(data);
      }
    } catch (e) {
      console.log("Supabase fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbMsp();
  }, []);

  /* ── Filtered list ── */
  const combinedData = useMemo(() => {
    const baseList = season.data;
    return baseList.filter((r) => {
      const matchCat = catFilter === "all" || r.category === catFilter;
      const matchSearch =
        search.trim() === "" ||
        r.crop.toLowerCase().includes(search.toLowerCase()) ||
        r.en.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [season.data, catFilter, search]);

  const maxMsp = Math.max(...season.data.map((r) => r.msp), 1);

  /* ───────────────────────────────────────────────
     MODAL OPEN — pre-fill ALL fields
     ─────────────────────────────────────────────── */
  const openModal = (item?: any, sourceRow?: MspRow) => {
    if (item && item.id) {
      // ─── EDITING an existing Supabase record ───
      setEditingId(item.id);
      setFormData({
        crop_name: item.crop_name || "",
        crop_name_en: item.crop_name_en || "",
        category: item.category || "cereals",
        category_hindi: item.category_hindi || "अनाज",
        season: item.season || tab,
        cost_a2fl: item.cost_a2fl ?? "",
        prev_msp: item.prev_msp ?? "",
        msp_price: item.msp_price ?? "",
        unit: item.unit || "क्विंटल",
        year: item.year || "2025-26",
      });
    } else if (sourceRow) {
      // ─── NEW from existing static row (pre-fill from hardcoded data) ───
      setEditingId(null);
      setFormData({
        crop_name: sourceRow.crop || "",
        crop_name_en: sourceRow.en || "",
        category: sourceRow.category || "cereals",
        category_hindi: sourceRow.categoryHindi || "अनाज",
        season: tab,
        cost_a2fl: sourceRow.cost ?? "",
        prev_msp: sourceRow.prev ?? "",
        msp_price: sourceRow.msp ?? "",
        unit: "क्विंटल",
        year: "2025-26",
      });
    } else {
      // ─── Completely blank new entry ───
      setEditingId(null);
      setFormData({ ...EMPTY_FORM, season: tab });
    }
    setIsModalOpen(true);
  };

  /* ── Save (Insert / Update) ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.crop_name || !formData.msp_price) {
      alert("फसल का नाम और MSP मूल्य भरना ज़रूरी है!");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        crop_name: formData.crop_name.trim(),
        crop_name_en: formData.crop_name_en.trim(),
        category: formData.category,
        category_hindi: formData.category_hindi,
        season: formData.season,
        cost_a2fl: formData.cost_a2fl === "" ? null : Number(formData.cost_a2fl),
        prev_msp: formData.prev_msp === "" ? null : Number(formData.prev_msp),
        msp_price: Number(formData.msp_price),
        unit: formData.unit,
        year: formData.year,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("msp_rates")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("msp_rates")
          .insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ ...EMPTY_FORM });
      fetchDbMsp();
    } catch (err: any) {
      alert("Error saving MSP: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("क्या आप इस custom MSP बदलाव को हटाना चाहते हैं?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("msp_rates").delete().eq("id", id);
      if (error) throw error;
      fetchDbMsp();
    } catch (err: any) {
      alert("Delete Error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  /* ── Helper: update category and auto-fill hindi ── */
  const handleCategoryChange = (val: string) => {
    const found = CATEGORY_OPTIONS.find((c) => c.value === val);
    setFormData({
      ...formData,
      category: val,
      category_hindi: found?.hindi || formData.category_hindi,
    });
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div>
      <PageHero
        eyebrow="भारत सरकार द्वारा अनुमोदित • Minimum Support Price (MSP)"
        title={
          <>
            MSP दरें <span className="text-gold-400">2025-26 / 2026-27</span>
          </>
        }
        sub="रबी, खरीफ व व्यावसायिक सभी 22+ अधिसूचित फसलों के न्यूनतम समर्थन मूल्य — CCEA एवं CACP की आधिकारिक घोषणाओं के आधार पर।"
        image="/images/seeds.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">

        {/* ═══════════ Admin Banner ═══════════ */}
        {userRole === "admin" && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Icon name="ShieldCheck" size={18} />
              <span>Admin Mode: आप MSP रेट बदल या जोड़ सकते हैं</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDbMsp}
                className="p-2 bg-white/50 border rounded-xl hover:bg-white transition"
                title="रीफ्रेश"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => openModal()}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
              >
                <Plus size={16} />
                नया MSP रेट जोड़ें
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ Season Tabs ═══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {SEASONS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setTab(s.key);
                setCatFilter("all");
              }}
              className={`relative rounded-2xl border-2 p-3.5 text-left transition-all ${
                tab === s.key
                  ? "border-pine-700 bg-pine-700 text-cream shadow-lg"
                  : "border-pine-700/15 bg-cream-2 text-pine-800 hover:border-pine-700/40"
              }`}
            >
              {s.latest && (
                <span
                  className={`absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[9px] font-chunk font-bold ${
                    tab === s.key
                      ? "bg-gold-400 text-pine-950"
                      : "bg-pine-700 text-cream"
                  }`}
                >
                  नवीनतम
                </span>
              )}
              <span className="block font-chunk font-bold text-sm md:text-base">
                {s.label}
              </span>
              <span
                className={`block mt-0.5 text-[11px] truncate ${
                  tab === s.key ? "text-cream/70" : "text-ink-600"
                }`}
              >
                {s.sub}
              </span>
            </button>
          ))}
        </div>

        {/* ═══════════ Search + Category Filter ═══════════ */}
        <div className="mt-8 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCatFilter(c.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  catFilter === c.key
                    ? "bg-pine-900 text-gold-300 shadow"
                    : "bg-cream-2 border border-pine-700/15 text-pine-800 hover:bg-cream-3"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="फसल खोजें (उदा. गेहूं, सरसों, धान)..."
              className="w-full rounded-xl border border-pine-700/20 bg-cream-2 px-3.5 py-2 text-xs md:text-sm text-pine-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500 hover:text-pine-900"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ═══════════ Main List ═══════════ */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + catFilter}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h2 className="display-xl text-2xl md:text-3xl text-pine-900 flex items-center gap-2.5">
                <WheatEar className="w-5 h-7 text-gold-500" />
                {season.label} —{" "}
                {catFilter === "all"
                  ? "सभी फसलें"
                  : CATEGORIES.find((c) => c.key === catFilter)?.label}{" "}
                ({combinedData.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill pill-green text-xs">
                  <Icon name="Landmark" size={12} />
                  {season.announced}
                </span>
                <span className="text-[11px] text-ink-600 bg-cream-3 px-2 py-1 rounded-lg border border-pine-700/10">
                  स्रोत: {season.source}
                </span>
              </div>
            </div>

            {combinedData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-pine-700/20 p-8 text-center text-ink-600 bg-cream-2">
                कोई फसल नहीं मिली। कृपया खोज शब्द बदलें।
              </div>
            ) : (
              <div className="grid gap-3">
                {combinedData.map((r, i) => {
                  // Find Supabase override for this crop
                  const override = dbMsp.find(
                    (db) =>
                      db.crop_name &&
                      db.crop_name.toLowerCase() === r.crop.toLowerCase()
                  );

                  const currentMsp = override ? override.msp_price : r.msp;
                  const currentPrev = override?.prev_msp ?? r.prev;
                  const inc = currentMsp - currentPrev;
                  const incPercent =
                    currentPrev > 0
                      ? ((inc / currentPrev) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <motion.div
                      key={r.crop + r.en}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.3 }}
                      className="group relative overflow-hidden rounded-2xl border border-pine-700/10 bg-cream-2 p-4 md:px-5 md:py-4 hover:border-gold-500/50 hover:shadow-md transition-all"
                    >
                      {/* Background bar */}
                      <span
                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-leaf-500/15 to-transparent transition-all duration-700 pointer-events-none"
                        style={{
                          width: `${Math.min(
                            (currentMsp / maxMsp) * 100,
                            100
                          )}%`,
                        }}
                        aria-hidden
                      />

                      {/* Override badge */}
                      {override && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold z-10">
                          Custom
                        </span>
                      )}

                      <div className="relative flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                        {/* Crop Name */}
                        <div className="min-w-44 md:w-56">
                          <div className="flex items-center gap-2">
                            <p className="font-chunk font-bold text-base md:text-lg text-pine-900">
                              {r.crop}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pine-700/10 text-pine-800 font-semibold">
                              {r.categoryHindi}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-600 mt-0.5">
                            {r.en}
                          </p>
                        </div>

                        {/* Cost A2+FL */}
                        {r.cost && (
                          <div className="hidden lg:block text-left text-xs">
                            <span className="text-ink-500 block text-[10px]">
                              लागत (A2+FL)
                            </span>
                            <span className="font-bold text-pine-900">
                              ₹{r.cost.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}

                        {/* Previous MSP */}
                        <div className="hidden sm:block text-left text-xs">
                          <span className="text-ink-500 block text-[10px]">
                            पिछला MSP
                          </span>
                          <span className="font-semibold text-ink-700">
                            ₹{currentPrev.toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Current MSP */}
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-ink-500 block sm:hidden">
                            MSP:
                          </span>
                          <p className="font-chunk font-bold text-xl md:text-2xl text-pine-800">
                            ₹{currentMsp.toLocaleString("en-IN")}
                            <span className="text-xs font-semibold text-ink-600 ml-1">
                              /क्विंटल
                            </span>
                          </p>
                        </div>

                        {/* Increment + Admin Actions */}
                        <div className="flex items-center gap-2">
                          <span className="pill pill-green text-xs font-bold">
                            <Icon name="TrendingUp" size={11} />
                            +₹{inc.toLocaleString("en-IN")} ({incPercent}%)
                          </span>

                          {userRole === "admin" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (override) {
                                    // Edit existing Supabase record with all fields
                                    openModal(override);
                                  } else {
                                    // New override — pre-fill from static row
                                    openModal(undefined, r);
                                  }
                                }}
                                className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition"
                                title="MSP बदलें / Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              {override && (
                                <button
                                  onClick={() => handleDelete(override.id)}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition"
                                  title="बदलाव हटाएं / Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ═══════════ Info / FAQ Section ═══════════ */}
        <Reveal className="mt-14 grid md:grid-cols-3 gap-5">
          <div className="rounded-3xl bg-pine-950 grain p-6 text-cream relative overflow-hidden">
            <div className="absolute inset-0 dot-grid opacity-15" />
            <div className="relative">
              <Icon name="Landmark" size={26} className="text-gold-400" />
              <h3 className="display-xl text-xl mt-3 text-gold-300">
                MSP का निर्धारण कैसे होता है?
              </h3>
              <p className="mt-2 text-xs md:text-sm text-cream/70 leading-relaxed">
                स्वामीनाथन आयोग की सिफारिशों के आधार पर सरकार उत्पादन लागत
                (A2+FL) पर कम से कम{" "}
                <b>50% से 100%+ तक का मुनाफा</b> जोड़कर न्यूनतम समर्थन मूल्य
                (MSP) तय करती है।
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-pine-700/10 bg-cream-2 p-6">
            <Icon name="ClipboardList" size={26} className="text-pine-700" />
            <h3 className="display-xl text-xl mt-3 text-pine-900">
              पंजीकरण व खरीद प्रक्रिया
            </h3>
            <p className="mt-2 text-xs md:text-sm text-ink-600 leading-relaxed">
              सरकारी खरीद (NAFED/FCI/राजफेड) हेतु राज्य पोर्टल (राजस्थान:{" "}
              <b>ई-उपार्जन / राज किसान पोर्टल</b>) पर गिरदावरी, जन आधार व बैंक
              खाते से ऑनलाइन स्लॉट बुक करें।
            </p>
          </div>

          <div className="rounded-3xl border border-gold-500/30 bg-gold-400/10 p-6">
            <Icon name="Info" size={26} className="text-gold-600" />
            <h3 className="display-xl text-xl mt-3 text-pine-900">
              FAQ गुणवत्ता मानक ध्यान रखें
            </h3>
            <p className="mt-2 text-xs md:text-sm text-ink-600 leading-relaxed">
              घोषित MSP दरें केवल <b>FAQ (Fair Average Quality)</b> मानकों वाली
              उपज पर लागू होती हैं। नमी (Moisture) 12% से कम व अवांछित
              कचरा/कंकड़ न होने पर पूरा भुगतान तुरंत खाते में होता है।
            </p>
          </div>
        </Reveal>

        {/* ═══════════════════════════════════════════════
            ADMIN MODAL — ALL FIELDS EDITABLE
            ═══════════════════════════════════════════════ */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    {editingId ? (
                      <>
                        <Edit2 size={18} className="text-amber-600" />
                        MSP दर बदलें (Edit)
                      </>
                    ) : (
                      <>
                        <Plus size={18} className="text-emerald-600" />
                        नया MSP मूल्य जोड़ें (Add New)
                      </>
                    )}
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-xl transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  {/* ── Row 1: Crop Names ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        🌾 फसल का नाम (हिन्दी) <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                        placeholder="जैसे: गेहूं"
                        value={formData.crop_name}
                        onChange={(e) =>
                          setFormData({ ...formData, crop_name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        🌾 Crop Name (English)
                      </label>
                      <input
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                        placeholder="e.g. Wheat"
                        value={formData.crop_name_en}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            crop_name_en: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* ── Row 2: Category + Season ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        📂 श्रेणी (Category)
                      </label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                        value={formData.category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        📅 सीज़न (Season)
                      </label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                        value={formData.season}
                        onChange={(e) =>
                          setFormData({ ...formData, season: e.target.value })
                        }
                      >
                        {SEASON_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Row 3: Category Hindi + Year ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        📝 श्रेणी हिन्दी (Category Hindi)
                      </label>
                      <input
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition"
                        placeholder="जैसे: अनाज, दलहन"
                        value={formData.category_hindi}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category_hindi: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        📆 वर्ष (Year)
                      </label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                        value={formData.year}
                        onChange={(e) =>
                          setFormData({ ...formData, year: e.target.value })
                        }
                      >
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Divider ── */}
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                      💰 मूल्य विवरण (Price Details)
                    </p>
                  </div>

                  {/* ── Row 4: Cost + Prev MSP ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        🧮 लागत A2+FL (₹/क्विंटल)
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none transition"
                        placeholder="जैसे: 1128"
                        value={formData.cost_a2fl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cost_a2fl:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        खाली छोड़ सकते हैं अगर उपलब्ध नहीं है
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        📉 पिछला MSP (₹/क्विंटल)
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none transition"
                        placeholder="जैसे: 2275"
                        value={formData.prev_msp}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            prev_msp:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* ── Row 5: MSP Price (highlighted) + Unit ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-emerald-700 mb-1">
                        ✅ वर्तमान MSP मूल्य (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        className="w-full p-3 border-2 border-emerald-400 rounded-xl font-bold text-lg text-emerald-800 bg-emerald-50 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                        placeholder="जैसे: 2425"
                        value={formData.msp_price}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            msp_price:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        ⚖️ इकाई (Unit)
                      </label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                        value={formData.unit}
                        onChange={(e) =>
                          setFormData({ ...formData, unit: e.target.value })
                        }
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Preview Card ── */}
                  {formData.crop_name && formData.msp_price && (
                    <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200 rounded-xl p-3 mt-2">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">
                        📋 Preview (पूर्वावलोकन)
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-800">
                            {formData.crop_name}
                            {formData.crop_name_en && (
                              <span className="text-gray-500 font-normal ml-1">
                                ({formData.crop_name_en})
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formData.category_hindi} •{" "}
                            {
                              SEASON_OPTIONS.find(
                                (s) => s.value === formData.season
                              )?.label
                            }{" "}
                            • {formData.year}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-emerald-700">
                            ₹
                            {Number(formData.msp_price).toLocaleString("en-IN")}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            /{formData.unit}
                          </p>
                        </div>
                      </div>
                      {formData.prev_msp && formData.msp_price && (
                        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                          <span className="text-gray-500">
                            पिछला: ₹
                            {Number(formData.prev_msp).toLocaleString("en-IN")}
                          </span>
                          <span className="text-emerald-600 font-bold">
                            → बढ़ोतरी: +₹
                            {(
                              Number(formData.msp_price) -
                              Number(formData.prev_msp)
                            ).toLocaleString("en-IN")}{" "}
                            (
                            {(
                              ((Number(formData.msp_price) -
                                Number(formData.prev_msp)) /
                                Number(formData.prev_msp)) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                      )}
                      {formData.cost_a2fl && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          लागत A2+FL: ₹
                          {Number(formData.cost_a2fl).toLocaleString("en-IN")} →
                          मुनाफा:{" "}
                          {(
                            ((Number(formData.msp_price) -
                              Number(formData.cost_a2fl)) /
                              Number(formData.cost_a2fl)) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Action Buttons ── */}
                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingId(null);
                        setFormData({ ...EMPTY_FORM });
                      }}
                      className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                    >
                      रद्द करें (Cancel)
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          सहेज रहे हैं...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          {editingId ? "अपडेट करें (Update)" : "सेव करें (Save)"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};