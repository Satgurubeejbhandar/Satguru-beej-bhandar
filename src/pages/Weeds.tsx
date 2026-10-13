import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  WEED_GUIDES,
  WEEDICIDE_TIPS,
  type CropWeedGuide,
} from "../data/weeds";
import { waLink } from "../data/content";
import { Icon, PageHero, Reveal, WheatEar } from "../components/Shared";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash2,
  X,
  RefreshCw,
  ShieldCheck,
  Edit3,
  ChevronDown,
  ChevronUp,
  Copy,
  Save,
} from "lucide-react"; // यहाँ से 'Check' को हटा दिया गया है ताकि पीली लाइन हट जाए

/* ───────── Types ───────── */

interface WeedsPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

interface DbWeed {
  id: string;
  crop_name: string;
  crop_en: string;
  weed_names: string;
  cultural_method: string;
  pre_chemical: string;
  pre_dose: string;
  pre_timing: string;
  pre_note: string;
  post1_chemical: string;
  post1_dose: string;
  post1_timing: string;
  post1_note: string;
  post2_chemical: string;
  post2_dose: string;
  post2_timing: string;
  post2_note: string;
  post3_chemical: string;
  post3_dose: string;
  post3_timing: string;
  post3_note: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

type FormData = Omit<DbWeed, "id" | "created_at" | "updated_at">;

const emptyForm: FormData = {
  crop_name: "",
  crop_en: "",
  weed_names: "",
  cultural_method: "",
  pre_chemical: "",
  pre_dose: "",
  pre_timing: "",
  pre_note: "",
  post1_chemical: "",
  post1_dose: "",
  post1_timing: "",
  post1_note: "",
  post2_chemical: "",
  post2_dose: "",
  post2_timing: "",
  post2_note: "",
  post3_chemical: "",
  post3_dose: "",
  post3_timing: "",
  post3_note: "",
  is_custom: true,
};

/* ───────── Helper: Convert static guide → form data ───────── */
function guideToForm(guide: CropWeedGuide): FormData {
  const post = guide.postEmergence || [];
  return {
    crop_name: guide.crop,
    crop_en: guide.en || "",
    weed_names: guide.weeds || "",
    cultural_method: guide.cultural || "",
    pre_chemical: guide.preEmergence?.chemical || "",
    pre_dose: guide.preEmergence?.dose || "",
    pre_timing: guide.preEmergence?.timing || "",
    pre_note: guide.preEmergence?.note || "",
    post1_chemical: post[0]?.chemical || "",
    post1_dose: post[0]?.dose || "",
    post1_timing: post[0]?.timing || "",
    post1_note: post[0]?.note || "",
    post2_chemical: post[1]?.chemical || "",
    post2_dose: post[1]?.dose || "",
    post2_timing: post[1]?.timing || "",
    post2_note: post[1]?.note || "",
    post3_chemical: post[2]?.chemical || "",
    post3_dose: post[2]?.dose || "",
    post3_timing: post[2]?.timing || "",
    post3_note: post[2]?.note || "",
    is_custom: true,
  };
}

function dbToForm(row: DbWeed): FormData {
  return {
    crop_name: row.crop_name || "",
    crop_en: row.crop_en || "",
    weed_names: row.weed_names || "",
    cultural_method: row.cultural_method || "",
    pre_chemical: row.pre_chemical || "",
    pre_dose: row.pre_dose || "",
    pre_timing: row.pre_timing || "",
    pre_note: row.pre_note || "",
    post1_chemical: row.post1_chemical || "",
    post1_dose: row.post1_dose || "",
    post1_timing: row.post1_timing || "",
    post1_note: row.post1_note || "",
    post2_chemical: row.post2_chemical || "",
    post2_dose: row.post2_dose || "",
    post2_timing: row.post2_timing || "",
    post2_note: row.post2_note || "",
    post3_chemical: row.post3_chemical || "",
    post3_dose: row.post3_dose || "",
    post3_timing: row.post3_timing || "",
    post3_note: row.post3_note || "",
    is_custom: row.is_custom ?? true,
  };
}

/* ───────── Chem Display Row ───────── */

const ChemRow = ({
  label,
  chem,
  tint,
}: {
  label: string;
  chem: NonNullable<CropWeedGuide["preEmergence"]>;
  tint: string;
}) => (
  <div className={`rounded-xl border p-4 ${tint}`}>
    <p className="text-[10px] font-chunk font-bold tracking-[0.16em] uppercase text-gold-600">
      {label}
    </p>
    <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
      <p className="font-chunk font-bold text-[15px] text-pine-900">
        {chem.chemical}
      </p>
      <span className="pill pill-green !text-[0.7rem]">{chem.dose}</span>
    </div>
    <p className="mt-1 text-xs font-semibold text-pine-800">
      <Icon name="Clock" size={11} className="inline mr-1 text-gold-600" />
      समय: {chem.timing}
    </p>
    {chem.note && (
      <p className="mt-1.5 flex gap-1.5 text-xs text-clay-500 font-medium leading-relaxed">
        <Icon name="Info" size={12} className="shrink-0 mt-0.5" />
        {chem.note}
      </p>
    )}
  </div>
);

/* ───────── Form Section Component ───────── */

const FormSection = ({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-pine-700/15 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-cream-2 hover:bg-cream-3 transition"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-pine-900">
          {icon} {title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ───────── Input Helper ───────── */

const FormInput = ({
  label,
  placeholder,
  value,
  onChange,
  required = false,
  multiline = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  multiline?: boolean;
}) => (
  <div>
    <label className="block text-xs font-bold text-pine-800 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {multiline ? (
      <textarea
        className="w-full p-3 border border-pine-700/20 rounded-xl text-sm bg-white
                   focus:ring-2 focus:ring-gold-400/40 focus:border-gold-500 transition resize-y min-h-[60px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={2}
      />
    ) : (
      <input
        className="w-full p-3 border border-pine-700/20 rounded-xl text-sm bg-white
                   focus:ring-2 focus:ring-gold-400/40 focus:border-gold-500 transition"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export const WeedsPage = ({ userRole }: WeedsPageProps) => {
  const [active, setActive] = useState<CropWeedGuide>(WEED_GUIDES[0]);
  const [dbWeeds, setDbWeeds] = useState<DbWeed[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new, id = editing
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });

  /* ── Fetch from Supabase ── */
  const fetchDb = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("weeds")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDbWeeds(data as DbWeed[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDb();
  }, [fetchDb]);

  /* ── Update helper ── */
  const updateField = (key: keyof FormData, val: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  /* ── Open modal for NEW (pre-fill from active guide) ── */
  const openNewModal = () => {
    setEditingId(null);
    setFormData(guideToForm(active));
    setIsModalOpen(true);
  };

  /* ── Open modal for NEW with blank ── */
  const openBlankModal = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, crop_name: active.crop });
    setIsModalOpen(true);
  };

  /* ── Open modal for EDIT (existing DB row) ── */
  const openEditModal = (row: DbWeed) => {
    setEditingId(row.id);
    setFormData(dbToForm(row));
    setIsModalOpen(true);
  };

  /* ── Save (insert or update) ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.crop_name.trim()) {
      alert("फसल का नाम ज़रूरी है!");
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        // UPDATE
        const { error } = await supabase
          .from("weeds")
          .update({ ...formData, is_custom: true })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        // INSERT
        const { error } = await supabase
          .from("weeds")
          .insert([{ ...formData }]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ ...emptyForm });
      await fetchDb();
    } catch (err: any) {
      alert("Error: " + (err.message || "कुछ गलत हुआ"));
    }
    setLoading(false);
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("क्या आप यह जानकारी हटाना चाहते हैं?")) return;
    setLoading(true);
    await supabase.from("weeds").delete().eq("id", id);
    await fetchDb();
    setLoading(false);
  };

  /* ── Duplicate ── */
  const handleDuplicate = (row: DbWeed) => {
    setEditingId(null);
    const f = dbToForm(row);
    f.crop_name = f.crop_name + " (कॉपी)";
    setFormData(f);
    setIsModalOpen(true);
  };

  /* ── Filter DB entries for active crop ── */
  const extraWeeds = dbWeeds.filter((w) => w.crop_name === active.crop);

  /* ── Close modal ── */
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
  };

  return (
    <div>
      {/* ───────── HERO ───────── */}
      <PageHero
        eyebrow="वीडीसाइड मैनेजमेंट • Weed Management"
        title={
          <>
            खरपतवार <span className="text-gold-400">प्रबंधन</span>
          </>
        }
        sub="फसलवार घास-खरपतवार की पहचान + ICAR/DWR अनुशंसित वीडीसाइड — कौन-सी दवा, कितनी मात्रा, कब डालें (PE/पोस्ट), और बिना दवा के उपाय।"
        image="/images/hero.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        {/* ───────── ADMIN BAR ───────── */}
        {userRole === "admin" && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldCheck size={18} /> Admin Mode — पूरी जानकारी जोड़ें /
              एडिट करें
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchDb}
                className="p-2 bg-white/60 border rounded-xl hover:bg-white transition"
                title="Refresh"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
              <button
                onClick={openNewModal}
                className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-amber-700 transition"
              >
                <Plus size={16} /> मौजूदा फसल की जानकारी से नई जोड़ें
              </button>
              <button
                onClick={openBlankModal}
                className="bg-pine-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-pine-900 transition"
              >
                <Plus size={16} /> खाली फॉर्म से जोड़ें
              </button>
            </div>
          </div>
        )}

        {/* ───────── CROP SELECTOR ───────── */}
        <p className="font-chunk font-bold text-pine-900 text-lg mb-3 flex items-center gap-2">
          <WheatEar className="w-4 h-5 text-gold-500" /> फसल चुनें
        </p>
        <div
          className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5"
          style={{ scrollbarWidth: "none" }}
        >
          {WEED_GUIDES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`chip ${active.id === c.id ? "active" : ""}`}
            >
              {c.crop}
            </button>
          ))}
        </div>

        {/* ───────── MAIN CONTENT ───────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 grid lg:grid-cols-3 gap-5"
          >
            {/* Left Card */}
            <div className="card grain p-6 lg:col-span-1 h-fit">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-500 text-white">
                  <Icon name="Scissors" size={24} />
                </span>
                <div>
                  <h2 className="display-xl text-2xl text-pine-900">
                    {active.crop}
                  </h2>
                  <p className="text-xs text-gold-600 font-semibold">
                    {active.en}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs font-chunk font-bold tracking-[0.16em] uppercase text-gold-600 flex items-center gap-1.5">
                <Icon name="AlertTriangle" size={12} /> मुख्य खरपतवार
              </p>
              <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                {active.weeds}
              </p>

              <div className="mt-5 rounded-xl bg-leaf-500/10 border border-leaf-500/25 p-4">
                <p className="font-chunk font-bold text-pine-900 text-sm flex items-center gap-2">
                  <Icon name="Leaf" size={15} className="text-leaf-500" /> बिना
                  दवा के उपाय
                </p>
                <p className="mt-1.5 text-[13px] text-ink-600 leading-relaxed">
                  {active.cultural}
                </p>
              </div>

              <a
                href={waLink(
                  `नमस्ते! मेरी ${active.crop} की फसल में घास है। दवा की सलाह दें?`
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-chunk font-bold text-pine-700 hover:text-gold-600 transition"
              >
                <Icon name="MessageCircle" size={15} /> WhatsApp सलाह लें{" "}
                <Icon name="ArrowRight" size={14} />
              </a>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Pre-Emergence (static) */}
              {active.preEmergence ? (
                <ChemRow
                  label="पूर्व-अंकुरण (PE) दवा"
                  chem={active.preEmergence}
                  tint="bg-leaf-500/[0.06] border-leaf-500/25"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-pine-700/20 p-4 text-sm text-ink-600">
                  इस फसल में प्रमुख PE दवा सीमित — मुख्य रणनीति नीचे देखें।
                </div>
              )}

              {/* Post-Emergence (static) */}
              {active.postEmergence && active.postEmergence.length > 0 && (
                <div>
                  <p className="font-chunk font-bold text-pine-900 text-sm mb-2.5 flex items-center gap-2">
                    <Icon
                      name="Syringe"
                      size={15}
                      className="text-gold-600"
                    />{" "}
                    पोस्ट-इमरजेंस दवा
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {active.postEmergence.map((c, i) => (
                      <ChemRow
                        key={i}
                        label={`विकल्प ${i + 1}`}
                        chem={c}
                        tint="bg-cream-2 border-pine-700/10"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── DB Extra Entries ── */}
              {extraWeeds.length > 0 && (
                <div className="mt-4">
                  <p className="font-chunk font-bold text-amber-700 text-sm mb-2.5 flex items-center gap-2">
                    <Icon name="PlusCircle" size={15} /> अतिरिक्त उपाय (दुकान
                    द्वारा जोड़े गए)
                  </p>
                  <div className="grid sm:grid-cols-1 gap-4">
                    {extraWeeds.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 relative"
                      >
                        {/* Admin Actions */}
                        {userRole === "admin" && (
                          <div className="absolute top-3 right-3 flex gap-1.5">
                            <button
                              onClick={() => handleDuplicate(w)}
                              className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                              title="डुप्लिकेट"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => openEditModal(w)}
                              className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition"
                              title="एडिट करें"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(w.id)}
                              className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                              title="हटाएं"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white text-xs font-bold">
                            🌾
                          </span>
                          <div>
                            <p className="font-bold text-pine-900 text-sm">
                              {w.crop_name}
                            </p>
                            {w.crop_en && (
                              <p className="text-[10px] text-gold-600">
                                {w.crop_en}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Weed Names */}
                        {w.weed_names && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                              खरपतवार
                            </p>
                            <p className="text-xs text-ink-600 mt-0.5">
                              {w.weed_names}
                            </p>
                          </div>
                        )}

                        {/* Cultural Method */}
                        {w.cultural_method && (
                          <div className="mb-3 rounded-lg bg-leaf-500/10 border border-leaf-500/20 p-3">
                            <p className="text-[10px] font-bold text-leaf-700 uppercase">
                              बिना दवा के उपाय
                            </p>
                            <p className="text-xs text-ink-600 mt-0.5">
                              {w.cultural_method}
                            </p>
                          </div>
                        )}

                        {/* Pre-Emergence */}
                        {w.pre_chemical && (
                          <div className="mb-3 rounded-lg bg-leaf-500/[0.06] border border-leaf-500/25 p-3">
                            <p className="text-[10px] font-bold text-gold-600 uppercase">
                              पूर्व-अंकुरण (PE) दवा
                            </p>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
                              <p className="font-bold text-sm text-pine-900">
                                {w.pre_chemical}
                              </p>
                              {w.pre_dose && (
                                <span className="pill pill-green !text-[0.65rem]">
                                  {w.pre_dose}
                                </span>
                              )}
                            </div>
                            {w.pre_timing && (
                              <p className="text-xs text-pine-800 mt-1">
                                <Icon
                                  name="Clock"
                                  size={10}
                                  className="inline mr-1"
                                />{" "}
                                {w.pre_timing}
                              </p>
                            )}
                            {w.pre_note && (
                              <p className="text-xs text-clay-500 mt-1">
                                <Icon
                                  name="Info"
                                  size={10}
                                  className="inline mr-1"
                                />{" "}
                                {w.pre_note}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Post-Emergence */}
                        {(w.post1_chemical ||
                          w.post2_chemical ||
                          w.post3_chemical) && (
                          <div>
                            <p className="text-[10px] font-bold text-gold-600 uppercase mb-2">
                              पोस्ट-इमरजेंस दवा
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {[
                                {
                                  c: w.post1_chemical,
                                  d: w.post1_dose,
                                  t: w.post1_timing,
                                  n: w.post1_note,
                                },
                                {
                                  c: w.post2_chemical,
                                  d: w.post2_dose,
                                  t: w.post2_timing,
                                  n: w.post2_note,
                                },
                                {
                                  c: w.post3_chemical,
                                  d: w.post3_dose,
                                  t: w.post3_timing,
                                  n: w.post3_note,
                                },
                              ]
                                .filter((p) => p.c)
                                .map((p, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-lg bg-cream-2 border border-pine-700/10 p-3"
                                  >
                                    <p className="text-[10px] font-bold text-gold-600 uppercase">
                                      विकल्प {idx + 1}
                                    </p>
                                    <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1">
                                      <p className="font-bold text-sm text-pine-900">
                                        {p.c}
                                      </p>
                                      {p.d && (
                                        <span className="pill pill-green !text-[0.65rem]">
                                          {p.d}
                                        </span>
                                      )}
                                    </div>
                                    {p.t && (
                                      <p className="text-xs text-pine-800 mt-1">
                                        <Icon
                                          name="Clock"
                                          size={10}
                                          className="inline mr-1"
                                        />{" "}
                                        {p.t}
                                      </p>
                                    )}
                                    {p.n && (
                                      <p className="text-xs text-clay-500 mt-1">
                                        <Icon
                                          name="Info"
                                          size={10}
                                          className="inline mr-1"
                                        />{" "}
                                        {p.n}
                                      </p>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ───────── TIPS SECTION ───────── */}
        <Reveal className="mt-14">
          <div className="relative overflow-hidden rounded-3xl bg-pine-950 grain p-7 md:p-10">
            <div className="absolute inset-0 dot-grid opacity-15" />
            <div className="relative">
              <h3 className="display-xl text-2xl md:text-3xl text-cream flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-pine-950">
                  <Icon name="ShieldCheck" size={24} />
                </span>
                वीडीसाइड डालने के 8 नियम
              </h3>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                {WEEDICIDE_TIPS.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-cream/12 bg-cream/[0.05] px-4 py-3 text-sm text-cream/80"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-300 font-chunk font-bold text-xs mt-0.5">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ADMIN MODAL — Full form with all fields
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-8"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-pine-700/10">
                <h3 className="text-lg font-bold text-pine-900 flex items-center gap-2">
                  {editingId ? (
                    <>
                      <Edit3 size={20} className="text-amber-600" /> जानकारी
                      एडिट करें
                    </>
                  ) : (
                    <>
                      <Plus size={20} className="text-leaf-600" /> नई जानकारी
                      जोड़ें
                    </>
                  )}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-pine-100 rounded-xl transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* ── Basic Info ── */}
                <FormSection
                  title="फसल की जानकारी"
                  icon={<span>🌾</span>}
                  defaultOpen={true}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      label="फसल का नाम (हिंदी)"
                      placeholder="जैसे: गेहूं, धान, मक्का..."
                      value={formData.crop_name}
                      onChange={(v) => updateField("crop_name", v)}
                      required
                    />
                    <FormInput
                      label="Crop Name (English)"
                      placeholder="e.g. Wheat, Paddy..."
                      value={formData.crop_en}
                      onChange={(v) => updateField("crop_en", v)}
                    />
                  </div>
                  <FormInput
                    label="मुख्य खरपतवार (घास के नाम)"
                    placeholder="जैसे: गुल्ली डंडा, बथुआ, चटरी-मटरी..."
                    value={formData.weed_names}
                    onChange={(v) => updateField("weed_names", v)}
                    multiline
                  />
                  <FormInput
                    label="बिना दवा के उपाय (Cultural Method)"
                    placeholder="जैसे: गहरी जुताई, फसल चक्र, हाथ से निराई..."
                    value={formData.cultural_method}
                    onChange={(v) => updateField("cultural_method", v)}
                    multiline
                  />
                </FormSection>

                {/* ── Pre-Emergence ── */}
                <FormSection
                  title="पूर्व-अंकुरण (Pre-Emergence) दवा"
                  icon={<span>💊</span>}
                  defaultOpen={!!formData.pre_chemical}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      label="दवाई / केमिकल"
                      placeholder="जैसे: पेंडीमिथालिन 30% EC"
                      value={formData.pre_chemical}
                      onChange={(v) => updateField("pre_chemical", v)}
                    />
                    <FormInput
                      label="मात्रा (Dose)"
                      placeholder="जैसे: 3.3 लीटर/हेक्टेयर"
                      value={formData.pre_dose}
                      onChange={(v) => updateField("pre_dose", v)}
                    />
                  </div>
                  <FormInput
                    label="कब डालें (Timing)"
                    placeholder="जैसे: बुवाई के 0-3 दिन बाद"
                    value={formData.pre_timing}
                    onChange={(v) => updateField("pre_timing", v)}
                  />
                  <FormInput
                    label="विशेष नोट"
                    placeholder="कोई खास बात..."
                    value={formData.pre_note}
                    onChange={(v) => updateField("pre_note", v)}
                    multiline
                  />
                </FormSection>

                {/* ── Post-Emergence Option 1 ── */}
                <FormSection
                  title="पोस्ट-इमरजेंस दवा — विकल्प 1"
                  icon={<span>🧪</span>}
                  defaultOpen={!!formData.post1_chemical}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      label="दवाई / केमिकल"
                      placeholder="जैसे: सल्फोसल्फ्यूरॉन 75% WG"
                      value={formData.post1_chemical}
                      onChange={(v) => updateField("post1_chemical", v)}
                    />
                    <FormInput
                      label="मात्रा (Dose)"
                      placeholder="जैसे: 33 ग्राम/हेक्टेयर"
                      value={formData.post1_dose}
                      onChange={(v) => updateField("post1_dose", v)}
                    />
                  </div>
                  <FormInput
                    label="कब डालें (Timing)"
                    placeholder="जैसे: बुवाई के 25-35 दिन"
                    value={formData.post1_timing}
                    onChange={(v) => updateField("post1_timing", v)}
                  />
                  <FormInput
                    label="विशेष नोट"
                    placeholder=""
                    value={formData.post1_note}
                    onChange={(v) => updateField("post1_note", v)}
                    multiline
                  />
                </FormSection>

                {/* ── Post-Emergence Option 2 ── */}
                <FormSection
                  title="पोस्ट-इमरजेंस दवा — विकल्प 2"
                  icon={<span>🧪</span>}
                  defaultOpen={!!formData.post2_chemical}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      label="दवाई / केमिकल"
                      placeholder=""
                      value={formData.post2_chemical}
                      onChange={(v) => updateField("post2_chemical", v)}
                    />
                    <FormInput
                      label="मात्रा (Dose)"
                      placeholder=""
                      value={formData.post2_dose}
                      onChange={(v) => updateField("post2_dose", v)}
                    />
                  </div>
                  <FormInput
                    label="कब डालें (Timing)"
                    placeholder=""
                    value={formData.post2_timing}
                    onChange={(v) => updateField("post2_timing", v)}
                  />
                  <FormInput
                    label="विशेष नोट"
                    placeholder=""
                    value={formData.post2_note}
                    onChange={(v) => updateField("post2_note", v)}
                    multiline
                  />
                </FormSection>

                {/* ── Post-Emergence Option 3 ── */}
                <FormSection
                  title="पोस्ट-इमरजेंस दवा — विकल्प 3"
                  icon={<span>🧪</span>}
                  defaultOpen={!!formData.post3_chemical}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      label="दवाई / केमिकल"
                      placeholder=""
                      value={formData.post3_chemical}
                      onChange={(v) => updateField("post3_chemical", v)}
                    />
                    <FormInput
                      label="मात्रा (Dose)"
                      placeholder=""
                      value={formData.post3_dose}
                      onChange={(v) => updateField("post3_dose", v)}
                    />
                  </div>
                  <FormInput
                    label="कब डालें (Timing)"
                    placeholder=""
                    value={formData.post3_timing}
                    onChange={(v) => updateField("post3_timing", v)}
                  />
                  <FormInput
                    label="विशेष नोट"
                    placeholder=""
                    value={formData.post3_note}
                    onChange={(v) => updateField("post3_note", v)}
                    multiline
                  />
                </FormSection>

                {/* ── Action Buttons ── */}
                <div className="flex gap-3 pt-3 border-t border-pine-700/10">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 border border-pine-700/20 rounded-xl text-sm font-bold
                               hover:bg-pine-50 transition"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-pine-900 text-white rounded-xl text-sm font-bold
                               flex items-center justify-center gap-2 hover:bg-pine-800 transition
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {editingId ? "अपडेट करें" : "सेव करें"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};