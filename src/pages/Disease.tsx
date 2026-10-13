import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PEST_GUIDES, SPRAY_SAFETY, type CropPestGuide, type PestProblem } from "../data/pests";
import { waLink, type PageKey } from "../data/content";
import { Icon, PageHero, Reveal, WheatEar } from "../components/Shared";
import { supabase } from "../lib/supabase";
import { Plus, Trash2, X, RefreshCw, ShieldCheck, Edit3, Save } from "lucide-react";

type TabKey = "insects" | "diseases";

export interface ExtendedPestProblem extends PestProblem {
  _isCustom?: boolean;
  _dbId?: string;
  _cropName?: string;
  _tabKey?: TabKey;
}

interface DiseasePageProps {
  onNavigate: (p: PageKey) => void;
  userRole?: "admin" | "farmer" | "guest" | null;
}

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: "insects", label: "कीट / हानिकारक", icon: "Bug", color: "text-clay-500" },
  { key: "diseases", label: "रोग / बीमारियां", icon: "Pill", color: "text-red-700" },
];

/* ─── Empty Template for New Pest/Disease ─── */
const EMPTY_PEST: ExtendedPestProblem = {
  name: "",
  en: "",
  symptoms: "",
  etl: "",
  management: [],
};

/* ========================================================= */
/* 1. PROBLEM CARD COMPONENT (Renders each disease/insect)   */
/* ========================================================= */
const ProblemCard = ({
  prob,
  crop,
  index,
  userRole,
  onEdit,
  onDelete,
}: {
  prob: ExtendedPestProblem;
  crop: string;
  index: number;
  userRole?: string | null;
  onEdit?: (p: ExtendedPestProblem) => void;
  onDelete?: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 22 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    className={`card grain overflow-hidden relative ${prob._isCustom ? "ring-2 ring-emerald-400" : ""}`}
  >
    {/* Admin Actions for Custom Pests */}
    {userRole === "admin" && prob._isCustom && (
      <div className="absolute top-3 right-3 flex gap-2 z-10">
        <button onClick={() => onEdit?.(prob)} className="p-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 shadow-sm">
          <Edit3 size={15} />
        </button>
        <button onClick={() => onDelete?.(prob._dbId!)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 shadow-sm">
          <Trash2 size={15} />
        </button>
      </div>
    )}

    <div className="flex items-start gap-4 p-5 md:p-6 border-b border-dashed border-pine-700/15 relative">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pine-700 text-gold-300">
        <Icon name="AlertTriangle" size={20} />
      </span>
      <div className="min-w-0 pr-16">
        <h3 className="font-chunk font-bold text-lg md:text-xl text-pine-900 leading-tight">
          {prob.name}
          {prob.en && <span className="ml-2 text-xs font-semibold text-gold-600">({prob.en})</span>}
          {prob._isCustom && <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold">Custom</span>}
        </h3>
        <p className="mt-1.5 text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">
          <b className="text-pine-800">लक्षण:</b> {prob.symptoms}
        </p>
        {prob.etl && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 pill pill-red">
            <Icon name="Info" size={11} /> ETL: {prob.etl}
          </p>
        )}
      </div>
    </div>
    
    <div className="p-5 md:p-6 pt-4">
      <p className="flex items-center gap-2 font-chunk font-bold text-sm text-pine-800 mb-3">
        <Icon name="Syringe" size={16} className="text-gold-600" /> रासायनिक प्रबंधन (इलाज)
      </p>
      
      {prob.management.length === 0 ? (
        <p className="text-sm text-gray-500 italic">कोई इलाज नहीं दिया गया है।</p>
      ) : (
        <div className="space-y-2.5">
          {prob.management.map((m, i) => (
            <div key={i} className="rounded-xl border border-pine-700/10 bg-cream-2 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-chunk font-bold text-[14px] text-pine-900">{m.chemical}</p>
                {m.dose && m.dose !== "—" && <span className="pill pill-green !text-[0.7rem]">{m.dose}</span>}
              </div>
              {m.brands && m.brands !== "—" && <p className="mt-1 text-xs text-ink-600"><b>ब्रांड:</b> {m.brands}</p>}
              {m.note && <p className="mt-1 flex gap-1.5 text-xs text-clay-500 font-medium whitespace-pre-wrap"><Icon name="Info" size={13} className="shrink-0 mt-0.5" />{m.note}</p>}
            </div>
          ))}
        </div>
      )}

      <a href={waLink(`नमस्ते! मेरी ${crop} की फसल में "${prob.name}" की समस्या है। इलाज बताएं।`)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-chunk font-bold text-pine-700 hover:text-gold-600 transition">
        <Icon name="MessageCircle" size={15} /> WhatsApp सलाह लें <Icon name="ArrowRight" size={14} />
      </a>
    </div>
  </motion.div>
);

/* ========================================================= */
/* 2. FULL PEST/DISEASE EDITOR MODAL                         */
/* ========================================================= */
const PestEditorModal = ({
  isOpen,
  onClose,
  initialData,
  mode,
  currentCrop,
  currentTab,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: ExtendedPestProblem;
  mode: "add" | "edit";
  currentCrop: string;
  currentTab: TabKey;
  onSave: (data: ExtendedPestProblem) => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<ExtendedPestProblem>(initialData);

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...initialData,
        _cropName: initialData._cropName || currentCrop,
        _tabKey: initialData._tabKey || currentTab,
      });
    }
  }, [isOpen, initialData, currentCrop, currentTab]);

  if (!isOpen) return null;

  const updateField = (field: keyof ExtendedPestProblem, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addManagement = () => {
    setForm((prev) => ({
      ...prev,
      management: [...prev.management, { chemical: "", dose: "", brands: "", note: "" }],
    }));
  };

  const updateManagement = (index: number, field: string, value: string) => {
    const updated = [...form.management];
    updated[index] = { ...updated[index], [field]: value };
    setForm((prev) => ({ ...prev, management: updated }));
  };

  const removeManagement = (index: number) => {
    setForm((prev) => ({
      ...prev,
      management: prev.management.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-3 pt-12 sm:pt-16 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative mb-10 overflow-hidden border border-pine-200">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-pine-900 text-white p-5 flex justify-between items-center shadow-md">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              {mode === "add" ? <><Plus size={20} className="text-gold-400"/> नई समस्या / रोग जोड़ें</> : <><Edit3 size={20} className="text-gold-400"/> समस्या एडिट करें</>}
            </h3>
            <p className="text-[11px] text-cream mt-1">
              फसल: <b>{form._cropName}</b> | प्रकार: <b>{form._tabKey === "insects" ? "कीट" : "रोग"}</b>
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition"><X size={20} /></button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) { alert("समस्या का नाम (हिंदी) डालना ज़रूरी है!"); return; }
            onSave(form);
          }}
          className="p-5 sm:p-6 space-y-6"
        >
          {/* BASIC INFO */}
          <div className="bg-cream-2 p-4 rounded-2xl border border-pine-100 space-y-4">
            <h4 className="font-chunk font-bold text-pine-900 text-sm border-b border-pine-200 pb-2">1. मूल जानकारी (Basic Details)</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">समस्या / रोग का नाम (हिंदी) <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="जैसे: सफेद लट (White Grub)" required className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">English Name (Optional)</label>
                <input type="text" value={form.en} onChange={(e) => updateField("en", e.target.value)} placeholder="e.g. White Grub" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-pine-800 mb-1">लक्षण (Symptoms)</label>
              <textarea value={form.symptoms} onChange={(e) => updateField("symptoms", e.target.value)} placeholder="पौधे पर क्या असर दिखता है? विस्तार से लिखें..." rows={3} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-pine-800 mb-1">ETL (Economic Threshold Level) - Optional</label>
              <input type="text" value={form.etl} onChange={(e) => updateField("etl", e.target.value)} placeholder="जैसे: 2-3 लट प्रति पौधा" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500" />
            </div>
          </div>

          {/* MANAGEMENT (TREATMENTS) */}
          <div className="bg-leaf-50 p-4 rounded-2xl border border-leaf-200 space-y-4">
            <div className="flex justify-between items-center border-b border-leaf-200 pb-2">
              <h4 className="font-chunk font-bold text-leaf-900 text-sm">2. रासायनिक प्रबंधन (दवाइयाँ)</h4>
              <button type="button" onClick={addManagement} className="bg-leaf-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-leaf-700 shadow-sm">
                <Plus size={14} /> दवा जोड़ें
              </button>
            </div>

            {form.management.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-4 bg-white rounded-xl border border-dashed border-gray-300">कोई दवा नहीं जोड़ी गई है। "दवा जोड़ें" पर क्लिक करें।</p>
            ) : (
              <div className="space-y-3">
                {form.management.map((m, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-leaf-200 relative">
                    <button type="button" onClick={() => removeManagement(idx)} className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                      <Trash2 size={14} />
                    </button>
                    <p className="text-[10px] font-bold text-leaf-700 mb-2">दवा विकल्प #{idx + 1}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">टेक्निकल / साल्ट (Chemical)</label>
                        <input type="text" value={m.chemical} onChange={(e) => updateManagement(idx, "chemical", e.target.value)} placeholder="Imidacloprid 17.8% SL" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500" required />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">मात्रा (Dose)</label>
                        <input type="text" value={m.dose} onChange={(e) => updateManagement(idx, "dose", e.target.value)} placeholder="1 ml / Litre" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500" />
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">पॉपुलर ब्रांड्स (Brands)</label>
                      <input type="text" value={m.brands} onChange={(e) => updateManagement(idx, "brands", e.target.value)} placeholder="Confidor, Tatamida..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">विशेष नोट (Note)</label>
                      <textarea value={m.note} onChange={(e) => updateManagement(idx, "note", e.target.value)} placeholder="शाम के समय स्प्रे करें..." rows={2} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500 resize-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAVE BUTTONS */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
              ❌ रद्द करें
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-pine-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 hover:bg-pine-900 transition">
              <Save size={18} className="text-gold-400" />
              {saving ? "सेव हो रहा है..." : mode === "edit" ? "✅ अपडेट करें" : "✅ सेव करें"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


/* ========================================================= */
/* 3. MAIN PAGE COMPONENT                                    */
/* ========================================================= */
export const DiseasePage = ({ onNavigate, userRole }: DiseasePageProps) => {
  const [crop, setCrop] = useState<CropPestGuide>(PEST_GUIDES[0]);
  const [tab, setTab] = useState<TabKey>("insects");
  
  // Custom Pests from DB
  const [customPests, setCustomPests] = useState<ExtendedPestProblem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editorInitialData, setEditorInitialData] = useState<ExtendedPestProblem>(EMPTY_PEST);
  const [saving, setSaving] = useState(false);

  // Fetch Custom Pests
  const fetchCustomPests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("custom_pests").select("*").order("created_at", { ascending: false });
      if (data) {
        const converted: ExtendedPestProblem[] = data.map((d: any) => ({
          name: d.name,
          en: d.en,
          symptoms: d.symptoms,
          etl: d.etl,
          management: typeof d.management === "string" ? JSON.parse(d.management) : (d.management || []),
          _isCustom: true,
          _dbId: d.id,
          _cropName: d.crop_name,
          _tabKey: d.tab_key,
        }));
        setCustomPests(converted);
      }
    } catch (err) {
      console.error("Error fetching pests:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomPests();
  }, [fetchCustomPests]);

  // Combine Static + Custom Pests for the Active Crop & Tab
  const staticProblems = crop[tab] as ExtendedPestProblem[];
  const customProblems = customPests.filter((p) => p._cropName === crop.crop && p._tabKey === tab);
  const allActiveProblems = [...staticProblems, ...customProblems];

  // Handlers for Editor
  const openAddModal = () => {
    setEditorMode("add");
    setEditorInitialData(EMPTY_PEST);
    setIsEditorOpen(true);
  };

  const openEditModal = (pest: ExtendedPestProblem) => {
    setEditorMode("edit");
    setEditorInitialData({ ...pest });
    setIsEditorOpen(true);
  };

  const handleSavePest = async (data: ExtendedPestProblem) => {
    setSaving(true);
    try {
      const dbRow = {
        crop_name: data._cropName || crop.crop,
        tab_key: data._tabKey || tab,
        name: data.name,
        en: data.en,
        symptoms: data.symptoms,
        etl: data.etl,
        management: data.management,
      };

      if (editorMode === "edit" && data._dbId) {
        const { error } = await supabase.from("custom_pests").update(dbRow).eq("id", data._dbId);
        if (error) throw error;
        alert("✅ समस्या अपडेट हो गई!");
      } else {
        const { error } = await supabase.from("custom_pests").insert([dbRow]);
        if (error) throw error;
        alert("✅ नई समस्या जोड़ दी गई!");
      }

      setIsEditorOpen(false);
      fetchCustomPests();
    } catch (err: any) {
      alert(`❌ एरर: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePest = async (id: string) => {
    if (!confirm("⚠️ क्या आप सच में इस समस्या को डिलीट करना चाहते हैं?")) return;
    setLoading(true);
    const { error } = await supabase.from("custom_pests").delete().eq("id", id);
    if (!error) {
      alert("🗑️ डिलीट हो गया।");
      fetchCustomPests();
    } else {
      alert(`❌ एरर: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <PageHero
        eyebrow="फसल संरक्षण • Plant Protection"
        title={<>रोग <span className="text-gold-400">व दवाई</span></>}
        sub="31 प्रमुख राजस्थान फसलों के कीट व रोग — लक्षण पहचानें और ICAR आधारित प्रबंधन देखें।"
        image="/images/spray.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        
        {/* ADMIN TOOLBAR */}
        {userRole === "admin" && (
          <div className="mb-8 p-5 bg-amber-50 border-2 border-amber-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-amber-900 font-chunk font-bold text-lg flex items-center gap-2">
                <ShieldCheck size={22} className="text-amber-600" /> Admin Mode
              </h3>
              <p className="text-xs text-amber-700 mt-1">आप <b>{crop.crop}</b> के <b>{tab === "insects" ? "कीट" : "रोग"}</b> सेक्शन में नई समस्या जोड़ सकते हैं।</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={fetchCustomPests} className="p-2.5 bg-white border border-amber-200 rounded-xl hover:bg-amber-100 transition">
                <RefreshCw size={18} className={`text-amber-700 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition">
                <Plus size={18} /> नई समस्या जोड़ें
              </button>
            </div>
          </div>
        )}

        {/* CROP SELECTOR */}
        <p className="font-chunk font-bold text-pine-900 text-lg mb-3 flex items-center gap-2">
          <WheatEar className="w-4 h-5 text-gold-500" /> फसल चुनें ({PEST_GUIDES.length})
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
          {PEST_GUIDES.map((c) => (
            <button key={c.id} onClick={() => setCrop(c)} className={`chip ${crop.id === c.id ? "active" : ""}`}>
              {c.crop}
            </button>
          ))}
        </div>

        {/* TAB SELECTOR */}
        <div className="mt-7 grid grid-cols-2 gap-2 md:gap-3 max-w-md">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 font-chunk font-bold text-sm md:text-base transition-all ${tab === t.key ? "border-pine-700 bg-pine-700 text-cream shadow-lg" : "border-pine-700/15 bg-cream-2 text-pine-800 hover:border-pine-700/40"}`}>
              <Icon name={t.icon} size={18} className={tab === t.key ? "text-gold-400" : t.color} />
              {t.label}
            </button>
          ))}
        </div>

        {/* HEADER & COUNT */}
        <div className="mt-8 mb-6 flex items-center justify-between flex-wrap gap-2 border-b border-gray-200 pb-4">
          <h2 className="display-xl text-2xl md:text-3xl text-pine-900">{crop.crop} — {TABS.find((t) => t.key === tab)?.label}</h2>
          <span className="pill pill-gold text-sm px-4 py-1.5">{allActiveProblems.length} समस्याएं</span>
        </div>

        {/* CARDS GRID */}
        {allActiveProblems.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-3xl border border-gray-200">
            <p className="text-gray-500 font-medium">इस सेक्शन में अभी कोई समस्या नहीं जोड़ी गई है।</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={crop.id + tab} className="grid md:grid-cols-2 gap-5 lg:gap-6">
              {allActiveProblems.map((p, i) => (
                <ProblemCard
                  key={p._dbId || p.name}
                  prob={p}
                  crop={crop.crop}
                  index={i}
                  userRole={userRole}
                  onEdit={openEditModal}
                  onDelete={handleDeletePest}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* WEEDS BANNER */}
        <Reveal className="mt-10">
          <button onClick={() => onNavigate("weeds")} className="group w-full flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-leaf-500/40 bg-leaf-500/5 p-5 text-left hover:bg-leaf-500/10 transition">
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-500 text-white"><Icon name="Scissors" size={22} /></span>
              <span>
                <span className="block font-chunk font-bold text-pine-900">घास-खरपतवार की समस्या है?</span>
                <span className="block text-sm text-ink-600">फसलवार वीडीसाइड मैनेजमेंट — अलग सेक्शन में</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-chunk font-bold text-leaf-500 text-sm">खरपतवार सेक्शन <Icon name="ArrowRight" size={16} /></span>
          </button>
        </Reveal>

        {/* SAFETY RULES */}
        <Reveal className="mt-12">
          <div className="relative overflow-hidden rounded-3xl bg-pine-950 grain p-7 md:p-10">
            <div className="absolute inset-0 dot-grid opacity-15" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400 text-pine-950"><Icon name="ShieldCheck" size={26} /></span>
                <div>
                  <h3 className="display-xl text-2xl md:text-3xl text-cream">छिड़काव सुरक्षा नियम</h3>
                  <p className="text-cream/60 text-sm">दवाई दवा है, ज़हर भी — सावधानी ही बचाव है</p>
                </div>
              </div>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                {SPRAY_SAFETY.map((s, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-cream/12 bg-cream/[0.05] px-4 py-3 text-sm text-cream/80 leading-relaxed">
                    <Icon name="CheckCircle2" size={17} className="text-gold-400 shrink-0 mt-0.5" />{s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>

      {/* FULL EDITOR MODAL */}
      <PestEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialData={editorInitialData}
        mode={editorMode}
        currentCrop={crop.crop}
        currentTab={tab}
        onSave={handleSavePest}
        saving={saving}
      />
    </div>
  );
};