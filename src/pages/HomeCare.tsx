import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HOMECARE_PLANTS, HOMECARE_TIPS } from "../data/homecare";
import { waLink } from "../data/content";
import { Icon, PageHero, Reveal } from "../components/Shared";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash2,
  X,
  RefreshCw,
  ShieldCheck,
  Edit3,
  Save,
  Copy,
  ChevronDown,
} from "lucide-react";

/* ─── Extended Type for Custom Care ─── */
export interface ExtendedHomeCarePlant {
  id: string;
  plant: string;
  en: string;
  type: string;
  problems: {
    pest: string;
    en: string;
    symptoms: string;
    chemical: string;
    dosePerLitre: string;
    phi: string;
    brands: string;
  }[];
  _isCustom?: boolean;
  _dbId?: string;
}

interface HomeCarePageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

const TYPE_FILTERS = ["सभी", "सब्जी", "फल", "सजावटी"] as const;
const TYPE_ICON: Record<string, string> = {
  सब्जी: "Leaf",
  फल: "Flower2",
  सजावटी: "Sparkles",
};

/* ─── Empty Template ─── */
const EMPTY_PLANT: ExtendedHomeCarePlant = {
  id: "",
  plant: "",
  en: "",
  type: "सब्जी",
  problems: [],
};

const EMPTY_PROBLEM = {
  pest: "",
  en: "",
  symptoms: "",
  chemical: "",
  dosePerLitre: "",
  phi: "",
  brands: "",
};

/* ========================================================= */
/* PRE-FILL SELECTOR (Dropdown to copy from existing plant)  */
/* ========================================================= */
const PreFillSelector = ({
  allPlants,
  onSelect,
}: {
  allPlants: ExtendedHomeCarePlant[];
  onSelect: (plant: ExtendedHomeCarePlant) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-blue-50 border-2 border-dashed border-blue-300 text-blue-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between gap-2 hover:bg-blue-100 transition"
      >
        <span className="flex items-center gap-2">
          <Copy size={16} /> मौजूदा पौधे की जानकारी से भरें (Pre-fill)
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-2 w-full bg-white border border-blue-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {allPlants.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2"
            >
              <span>
                <b className="text-pine-900">{p.plant}</b>
                {p.en && (
                  <span className="text-xs text-gray-500 ml-1">({p.en})</span>
                )}
              </span>
              <span className="text-[10px] bg-pine-100 text-pine-700 px-2 py-0.5 rounded-full font-bold">
                {p.type} • {p.problems.length} समस्याएं
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ========================================================= */
/* FULL EDITOR MODAL                                         */
/* ========================================================= */
const CareEditorModal = ({
  isOpen,
  onClose,
  initialData,
  mode,
  onSave,
  saving,
  allPlants,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: ExtendedHomeCarePlant;
  mode: "add" | "edit";
  onSave: (data: ExtendedHomeCarePlant) => void;
  saving: boolean;
  allPlants: ExtendedHomeCarePlant[];
}) => {
  const [form, setForm] = useState<ExtendedHomeCarePlant>(initialData);

  useEffect(() => {
    if (isOpen) setForm(initialData);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const updateField = (field: keyof ExtendedHomeCarePlant, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addProblem = () => {
    setForm((prev) => ({
      ...prev,
      problems: [...prev.problems, { ...EMPTY_PROBLEM }],
    }));
  };

  const updateProblem = (index: number, field: string, value: string) => {
    const updated = [...form.problems];
    updated[index] = { ...updated[index], [field]: value };
    setForm((prev) => ({ ...prev, problems: updated }));
  };

  const removeProblem = (index: number) => {
    if (!confirm("यह समस्या हटानी है?")) return;
    setForm((prev) => ({
      ...prev,
      problems: prev.problems.filter((_, i) => i !== index),
    }));
  };

  // Pre-fill from an existing plant (keeps this as a NEW entry)
  const preFillFrom = (source: ExtendedHomeCarePlant) => {
    setForm({
      ...form,
      plant: source.plant,
      en: source.en,
      type: source.type,
      problems: source.problems.map((p) => ({ ...p })), // deep copy
    });
    alert(`✅ "${source.plant}" की जानकारी भर दी गई। अब आप एडिट कर सकते हैं।`);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-3 pt-12 sm:pt-16 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl relative mb-10 overflow-hidden border border-pine-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-pine-900 text-white p-5 flex justify-between items-center shadow-md">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {mode === "add" ? (
              <>
                <Plus size={20} className="text-gold-400" /> नया पौधा जोड़ें
              </>
            ) : (
              <>
                <Edit3 size={20} className="text-gold-400" /> पौधा एडिट करें
              </>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.plant.trim()) {
              alert("पौधे का नाम डालना ज़रूरी है!");
              return;
            }
            onSave(form);
          }}
          className="p-5 sm:p-6 space-y-6"
        >
          {/* PRE-FILL DROPDOWN (only in add mode) */}
          {mode === "add" && allPlants.length > 0 && (
            <PreFillSelector allPlants={allPlants} onSelect={preFillFrom} />
          )}

          {/* 1. BASIC INFO */}
          <div className="bg-cream-2 p-4 rounded-2xl border border-pine-100 space-y-4">
            <h4 className="font-chunk font-bold text-pine-900 text-sm border-b border-pine-200 pb-2">
              1. पौधे की जानकारी (Basic Info)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">
                  नाम (हिंदी) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.plant}
                  onChange={(e) => updateField("plant", e.target.value)}
                  placeholder="जैसे: टमाटर"
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-pine-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">
                  English Name
                </label>
                <input
                  type="text"
                  value={form.en}
                  onChange={(e) => updateField("en", e.target.value)}
                  placeholder="e.g. Tomato"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-pine-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">
                  प्रकार (Type)
                </label>
                <select
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-pine-500"
                >
                  <option value="सब्जी">सब्जी</option>
                  <option value="फल">फल</option>
                  <option value="सजावटी">सजावटी</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. PROBLEMS & SOLUTIONS */}
          <div className="bg-leaf-50 p-4 rounded-2xl border border-leaf-200 space-y-4">
            <div className="flex justify-between items-center border-b border-leaf-200 pb-2">
              <h4 className="font-chunk font-bold text-leaf-900 text-sm">
                2. समस्याएं और उपचार ({form.problems.length})
              </h4>
              <button
                type="button"
                onClick={addProblem}
                className="bg-leaf-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-leaf-700 shadow-sm"
              >
                <Plus size={14} /> समस्या जोड़ें
              </button>
            </div>

            {form.problems.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-4 bg-white rounded-xl border border-dashed border-gray-300">
                कोई समस्या नहीं जोड़ी गई है। ऊपर "समस्या जोड़ें" पर क्लिक करें।
              </p>
            ) : (
              <div className="space-y-4">
                {form.problems.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-xl border border-leaf-200 relative shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => removeProblem(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                      title="हटाएं"
                    >
                      <Trash2 size={14} />
                    </button>
                    <p className="text-[10px] font-bold text-leaf-700 mb-3 border-b pb-1">
                      समस्या #{idx + 1}
                    </p>

                    {/* Pest names */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          समस्या/कीट का नाम *
                        </label>
                        <input
                          type="text"
                          value={p.pest}
                          onChange={(e) =>
                            updateProblem(idx, "pest", e.target.value)
                          }
                          placeholder="जैसे: सफेद मक्खी"
                          required
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          English Name
                        </label>
                        <input
                          type="text"
                          value={p.en}
                          onChange={(e) =>
                            updateProblem(idx, "en", e.target.value)
                          }
                          placeholder="e.g. Whitefly"
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                        />
                      </div>
                    </div>

                    {/* Symptoms */}
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">
                        लक्षण (Symptoms)
                      </label>
                      <textarea
                        value={p.symptoms}
                        onChange={(e) =>
                          updateProblem(idx, "symptoms", e.target.value)
                        }
                        placeholder="जैसे: पत्तियां पीली पड़ जाती हैं, चिपचिपाहट..."
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500 resize-y"
                      />
                    </div>

                    {/* Chemical / Dose / PHI */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          दवाई (Chemical)
                        </label>
                        <input
                          type="text"
                          value={p.chemical}
                          onChange={(e) =>
                            updateProblem(idx, "chemical", e.target.value)
                          }
                          placeholder="जैसे: Imidacloprid 17.8% SL"
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          मात्रा (Dose/Litre)
                        </label>
                        <input
                          type="text"
                          value={p.dosePerLitre}
                          onChange={(e) =>
                            updateProblem(idx, "dosePerLitre", e.target.value)
                          }
                          placeholder="जैसे: 0.5 ml/लीटर"
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">
                          रुकने का समय (PHI)
                        </label>
                        <input
                          type="text"
                          value={p.phi}
                          onChange={(e) =>
                            updateProblem(idx, "phi", e.target.value)
                          }
                          placeholder="जैसे: 5 दिन"
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                        />
                      </div>
                    </div>

                    {/* Brands */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">
                        ब्रांड उदाहरण
                      </label>
                      <input
                        type="text"
                        value={p.brands}
                        onChange={(e) =>
                          updateProblem(idx, "brands", e.target.value)
                        }
                        placeholder="जैसे: Confidor, Actara, Tatamida"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-leaf-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAVE BUTTONS */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              ❌ रद्द करें
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-pine-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 hover:bg-pine-900 transition"
            >
              <Save size={18} className="text-gold-400" />
              {saving
                ? "सेव हो रहा है..."
                : mode === "edit"
                ? "✅ अपडेट करें"
                : "✅ सेव करें"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================= */
/* MAIN PAGE COMPONENT                                       */
/* ========================================================= */
export const HomeCarePage = ({ userRole }: HomeCarePageProps) => {
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("सभी");
  const [openId, setOpenId] = useState<string>(HOMECARE_PLANTS[0].id);

  const [customPlants, setCustomPlants] = useState<ExtendedHomeCarePlant[]>([]);
  const [allPlants, setAllPlants] = useState<ExtendedHomeCarePlant[]>(
    HOMECARE_PLANTS as ExtendedHomeCarePlant[]
  );
  const [loading, setLoading] = useState(false);

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editorInitialData, setEditorInitialData] =
    useState<ExtendedHomeCarePlant>(EMPTY_PLANT);
  const [saving, setSaving] = useState(false);

  /* Fetch from DB */
  const fetchCustomPlants = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("custom_homecare")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        const converted: ExtendedHomeCarePlant[] = data.map((d: any) => ({
          id: d.id,
          plant: d.plant,
          en: d.en,
          type: d.type,
          problems:
            typeof d.problems === "string"
              ? JSON.parse(d.problems)
              : d.problems || [],
          _isCustom: true,
          _dbId: d.id,
        }));
        setCustomPlants(converted);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomPlants();
  }, [fetchCustomPlants]);

  // Merge static + custom
  useEffect(() => {
    setAllPlants([
      ...(HOMECARE_PLANTS as ExtendedHomeCarePlant[]),
      ...customPlants,
    ]);
  }, [customPlants]);

  /* ── Open Modals ── */

  // Blank add
  const openAddModal = () => {
    setEditorMode("add");
    setEditorInitialData({ ...EMPTY_PLANT, id: `custom-${Date.now()}` });
    setIsEditorOpen(true);
  };

  // Edit existing custom OR duplicate any plant (static/custom) into a new custom entry
  const openEditModal = (plant: ExtendedHomeCarePlant, e: React.MouseEvent) => {
    e.stopPropagation();
    if (plant._isCustom) {
      // Actual edit
      setEditorMode("edit");
      setEditorInitialData({
        ...plant,
        problems: plant.problems.map((p) => ({ ...p })),
      });
    } else {
      // Static plant → open as ADD with pre-filled data
      setEditorMode("add");
      setEditorInitialData({
        ...plant,
        id: `custom-${Date.now()}`,
        _isCustom: false,
        _dbId: undefined,
        problems: plant.problems.map((p) => ({ ...p })),
      });
    }
    setIsEditorOpen(true);
  };

  // Duplicate button (for any plant)
  const openDuplicateModal = (
    plant: ExtendedHomeCarePlant,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setEditorMode("add");
    setEditorInitialData({
      ...plant,
      id: `custom-${Date.now()}`,
      plant: plant.plant + " (कॉपी)",
      _isCustom: false,
      _dbId: undefined,
      problems: plant.problems.map((p) => ({ ...p })),
    });
    setIsEditorOpen(true);
  };

  /* ── Save ── */
  const handleSavePlant = async (data: ExtendedHomeCarePlant) => {
    setSaving(true);
    try {
      const dbRow = {
        plant: data.plant,
        en: data.en,
        type: data.type,
        problems: data.problems,
      };

      if (editorMode === "edit" && data._dbId) {
        const { error } = await supabase
          .from("custom_homecare")
          .update(dbRow)
          .eq("id", data._dbId);
        if (error) throw error;
        alert("✅ पौधा अपडेट हो गया!");
      } else {
        const { error } = await supabase
          .from("custom_homecare")
          .insert([dbRow]);
        if (error) throw error;
        alert("✅ नया पौधा जोड़ दिया गया!");
      }

      setIsEditorOpen(false);
      fetchCustomPlants();
    } catch (err: any) {
      alert(`❌ एरर: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDeletePlant = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("⚠️ क्या आप सच में इस पौधे को डिलीट करना चाहते हैं?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("custom_homecare")
      .delete()
      .eq("id", id);
    if (!error) {
      alert("🗑️ डिलीट हो गया।");
      fetchCustomPlants();
    } else {
      alert(`❌ एरर: ${error.message}`);
    }
    setLoading(false);
  };

  const visiblePlants = allPlants.filter(
    (p) => type === "सभी" || p.type === type
  );

  return (
    <div>
      <PageHero
        eyebrow="घरेलू बगीचा • Home Garden"
        title={
          <>
            होम केयर —{" "}
            <span className="text-gold-400">घर की सब्जी-फल</span>
          </>
        }
        sub="टमाटर, मिर्च, बैंगन, लौकी, आम, नींबू, अमरूद, गुलाब — घर में लगने वाले पौधों के आम कीट-रोग व ICAR अनुशंसित उपचार (लीटर में सटीक मात्रा + खाने की सुरक्षा अवधि)।"
        image="/images/sarson.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        {/* Admin Banner */}
        {userRole === "admin" && (
          <div className="mb-8 p-5 bg-amber-50 border-2 border-amber-200 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
            <div>
              <h3 className="text-amber-900 font-chunk font-bold text-lg flex items-center gap-2">
                <ShieldCheck size={22} className="text-amber-600" /> Admin
                Mode
              </h3>
              <p className="text-xs text-amber-700 mt-1">
                नया पौधा जोड़ें या किसी भी पुराने पौधे को Edit / Duplicate
                करें (जानकारी pre-filled आ जाएगी)।
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={fetchCustomPlants}
                className="p-2.5 bg-white border border-amber-200 rounded-xl hover:bg-amber-100 transition"
              >
                <RefreshCw
                  size={18}
                  className={`text-amber-700 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button
                onClick={openAddModal}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition"
              >
                <Plus size={18} /> नया पौधा जोड़ें
              </button>
            </div>
          </div>
        )}

        {/* Type Filter */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5"
          style={{ scrollbarWidth: "none" }}
        >
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`chip ${type === t ? "active" : ""}`}
            >
              <Icon
                name={t === "सभी" ? "Flower2" : TYPE_ICON[t]}
                size={14}
              />
              {t === "सभी" ? "सभी पौधे" : t}
            </button>
          ))}
        </div>

        {/* Plant Accordions */}
        <div className="mt-8 space-y-4">
          {visiblePlants.length === 0 ? (
            <p className="text-center text-gray-500 py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              इस कैटेगरी में अभी कोई पौधा नहीं है।
            </p>
          ) : (
            visiblePlants.map((plant, pi) => {
              const open = openId === plant.id;
              return (
                <Reveal key={plant.id} delay={pi * 0.04}>
                  <div
                    className={`card grain overflow-hidden transition-all relative ${
                      open ? "ring-2 ring-gold-500/50" : ""
                    } ${plant._isCustom ? "border-emerald-300" : ""}`}
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() => setOpenId(open ? "" : plant.id)}
                      className="w-full flex items-center gap-4 px-5 md:px-7 py-5 text-left relative z-0"
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                          open
                            ? "bg-gold-400 text-pine-950"
                            : "bg-pine-700 text-gold-300"
                        }`}
                      >
                        <Icon
                          name={TYPE_ICON[plant.type] || "Leaf"}
                          size={24}
                        />
                      </span>
                      <span className="min-w-0 flex-1 pr-24">
                        <span className="display-xl text-xl md:text-2xl text-pine-900 leading-tight flex items-center gap-2 flex-wrap">
                          {plant.plant}{" "}
                          {plant.en && (
                            <span className="text-xs font-chunk font-semibold text-gold-600">
                              ({plant.en})
                            </span>
                          )}
                          <span className="pill pill-green !text-[0.68rem]">
                            {plant.type}
                          </span>
                          {plant._isCustom && (
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                              Custom
                            </span>
                          )}
                        </span>
                        <span className="block mt-1 text-xs text-ink-600">
                          {plant.problems.length} समस्याओं का उपचार — देखने
                          हेतु क्लिक करें
                        </span>
                      </span>
                      <motion.span
                        animate={{ rotate: open ? 90 : 0 }}
                        className="text-pine-700 shrink-0"
                      >
                        <Icon name="ChevronRight" size={22} />
                      </motion.span>
                    </button>

                    {/* Admin Actions — Edit for ALL, Delete only for Custom */}
                    {userRole === "admin" && (
                      <div className="absolute top-5 right-14 flex gap-1.5 z-10">
                        <button
                          onClick={(e) => openDuplicateModal(plant, e)}
                          className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          title="डुप्लिकेट करें"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={(e) => openEditModal(plant, e)}
                          className="p-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                          title={
                            plant._isCustom
                              ? "एडिट करें"
                              : "एडिट करें (नई कॉपी बनेगी)"
                          }
                        >
                          <Edit3 size={15} />
                        </button>
                        {plant._isCustom && (
                          <button
                            onClick={(e) =>
                              handleDeletePlant(plant._dbId!, e)
                            }
                            className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                            title="डिलीट करें"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Accordion Content */}
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 md:px-7 pb-6 grid gap-4 md:grid-cols-2">
                            {plant.problems.length === 0 ? (
                              <p className="text-sm text-gray-500 italic col-span-2">
                                कोई समस्या दर्ज नहीं है।
                              </p>
                            ) : (
                              plant.problems.map((pr, i) => (
                                <div
                                  key={i}
                                  className="rounded-2xl border border-pine-700/10 bg-cream-2 p-5"
                                >
                                  <p className="font-chunk font-bold text-pine-900 flex items-center gap-2">
                                    <Icon
                                      name="AlertTriangle"
                                      size={16}
                                      className="text-clay-500"
                                    />
                                    {pr.pest}
                                    {pr.en && (
                                      <span className="text-[11px] font-semibold text-gold-600">
                                        ({pr.en})
                                      </span>
                                    )}
                                  </p>
                                  {pr.symptoms && (
                                    <p className="mt-2 text-[13px] text-ink-600 leading-relaxed whitespace-pre-wrap">
                                      <b className="text-pine-800">लक्षण:</b>{" "}
                                      {pr.symptoms}
                                    </p>
                                  )}
                                  <div className="mt-3 rounded-xl bg-pine-950/[0.045] border border-pine-700/10 p-3.5 space-y-1.5">
                                    {pr.chemical && (
                                      <p className="text-sm">
                                        <b className="text-pine-900 font-chunk">
                                          दवाई:
                                        </b>{" "}
                                        <span className="text-ink-600">
                                          {pr.chemical}
                                        </span>
                                      </p>
                                    )}
                                    {pr.dosePerLitre && (
                                      <p className="text-sm">
                                        <b className="text-pine-900 font-chunk">
                                          मात्रा:
                                        </b>{" "}
                                        <span className="pill pill-gold !text-[0.72rem]">
                                          {pr.dosePerLitre}
                                        </span>
                                      </p>
                                    )}
                                    {pr.phi && (
                                      <p className="text-sm">
                                        <b className="text-pine-900 font-chunk">
                                          रुकें (PHI):
                                        </b>{" "}
                                        <span className="pill pill-red !text-[0.72rem]">
                                          {pr.phi}
                                        </span>
                                      </p>
                                    )}
                                    {pr.brands && (
                                      <p className="text-xs text-ink-600">
                                        <b>ब्रांड उदाहरण:</b> {pr.brands}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}

                            {/* WhatsApp Button */}
                            <a
                              href={waLink(
                                `नमस्ते! घर की ${plant.plant} में समस्या है — फोटो भेज रहा हूं, उपचार बताएं।`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="md:col-span-2 inline-flex w-fit items-center gap-2 rounded-full bg-[#25D366] text-white font-chunk font-bold text-sm px-5 py-2.5 hover:-translate-y-0.5 transition-transform mt-2"
                            >
                              <Icon name="MessageCircle" size={16} />
                              {plant.plant} की फोटो भेजें — मुफ्त सलाह पाएं
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Reveal>
              );
            })
          )}
        </div>

        {/* HOMECARE_TIPS */}
        <Reveal className="mt-14">
          <div className="relative overflow-hidden rounded-3xl bg-pine-950 grain p-7 md:p-10">
            <div className="absolute inset-0 dot-grid opacity-15" />
            <div className="relative">
              <h3 className="display-xl text-2xl md:text-3xl text-cream flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-pine-950">
                  <Icon name="ShieldCheck" size={24} />
                </span>
                घर में सुरक्षित छिड़काव — 6 नियम
              </h3>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {HOMECARE_TIPS.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-cream/12 bg-cream/[0.05] p-4"
                  >
                    <p className="font-chunk font-bold text-gold-300 text-[15px] flex gap-2 items-start">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-xs">
                        {i + 1}
                      </span>
                      {t.title}
                    </p>
                    <p className="mt-2 text-[13px] text-cream/70 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* FULL EDITOR MODAL */}
      <CareEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialData={editorInitialData}
        mode={editorMode}
        onSave={handleSavePlant}
        saving={saving}
        allPlants={allPlants}
      />
    </div>
  );
};

export default HomeCarePage;