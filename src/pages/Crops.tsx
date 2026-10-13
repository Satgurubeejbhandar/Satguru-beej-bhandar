import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FIELD_CROPS, type CropGuide } from "../data/crops-field";
import { HORTI_CROPS } from "../data/crops-horti";
import { waLink } from "../data/content";
import { Icon, PageHero, Reveal, WheatEar } from "../components/Shared";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash2,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  Edit3,
  Copy,
  ChevronDown,
  ChevronUp,
  Save,
  AlertTriangle,
} from "lucide-react";

/* ─── Extended Type to prevent TS Errors ─── */
export interface ExtendedCropGuide extends CropGuide {
  _isCustom?: boolean;
  _dbId?: string;
}

interface CropsPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

/* ─── static data merge ─── */
const STATIC_CROPS: ExtendedCropGuide[] = [...HORTI_CROPS, ...FIELD_CROPS];

/* ─── category chips ─── */
const makeCats = (crops: ExtendedCropGuide[]) => [
  { key: "all" as const, label: "सभी फसलें", icon: "Wheat", count: crops.length },
  { key: "field" as const, label: "खेत फसलें", icon: "Sprout", count: crops.filter((c) => c.category === "field").length },
  { key: "fruit" as const, label: "फल (बागबानी)", icon: "Flower2", count: crops.filter((c) => c.category === "fruit").length },
  { key: "veg" as const, label: "सब्जियां", icon: "Leaf", count: crops.filter((c) => c.category === "veg").length },
];

/* ─── helpers to convert DB row ↔ CropGuide ─── */
const dbRowToCropGuide = (row: any): ExtendedCropGuide => ({
  id: row.crop_id,
  name: row.name,
  en: row.en || "",
  category: row.category || "field",
  season: row.season || "खरीफ",
  source: row.source || "सतगुरु बीज भंडार",
  soil: row.soil || "",
  landPrep: row.land_prep || "",
  manure: row.manure || "",
  sowing: row.sowing || "",
  seedRate: row.seed_rate || "",
  spacing: row.spacing || "",
  harvest: row.harvest || "",
  yield: row.yield_info || "",
  duration: row.duration || "",
  weedMgmt: row.weed_mgmt || "",
  tip: row.tip || "",
  varieties: row.varieties || [],
  fertilizer: row.fertilizer || [],
  irrigation: row.irrigation || [],
  protection: row.protection || [],
  extraCare: row.extra_care && row.extra_care.length > 0 ? row.extra_care : undefined,
  stages: row.stages || [],
  _isCustom: true,
  _dbId: row.id,
});

const cropGuideToDbRow = (c: ExtendedCropGuide) => ({
  crop_id: c.id,
  name: c.name,
  en: c.en,
  category: c.category,
  season: c.season,
  source: c.source,
  soil: c.soil,
  land_prep: c.landPrep,
  manure: c.manure,
  sowing: c.sowing,
  seed_rate: c.seedRate,
  spacing: c.spacing,
  harvest: c.harvest,
  yield_info: c.yield,
  duration: c.duration,
  weed_mgmt: c.weedMgmt,
  tip: c.tip,
  varieties: c.varieties,
  fertilizer: c.fertilizer,
  irrigation: c.irrigation,
  protection: c.protection,
  extra_care: c.extraCare || [],
  stages: c.stages,
  updated_at: new Date().toISOString(),
});

/* ─── Empty Crop Template ─── */
const EMPTY_CROP: ExtendedCropGuide = {
  id: "",
  name: "",
  en: "",
  category: "field",
  season: "खरीफ" as any,
  source: "सतगुरु बीज भंडार — दल्लुसर, सरदारशहर",
  soil: "",
  landPrep: "",
  manure: "",
  sowing: "",
  seedRate: "",
  spacing: "",
  harvest: "",
  yield: "",
  duration: "",
  weedMgmt: "",
  tip: "",
  varieties: [],
  fertilizer: [],
  irrigation: [],
  protection: [],
  extraCare: [],
  stages: [],
};

/* ============ Reusable Sub-Components ============ */

const InfoTile = ({
  icon,
  label,
  value,
  accent = "gold",
}: {
  icon: string;
  label: string;
  value: string;
  accent?: "gold" | "leaf" | "pine" | "rust";
}) => {
  const accents = {
    gold: "border-amber-500/30 bg-gradient-to-br from-amber-400/10 to-transparent text-amber-700",
    leaf: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700",
    pine: "border-teal-700/20 bg-gradient-to-br from-teal-700/5 to-transparent text-teal-800",
    rust: "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent text-orange-700",
  };
  return (
    <div className={`rounded-2xl border ${accents[accent]} px-4 py-3.5 hover:shadow-md transition-all`}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-chunk font-bold tracking-[0.12em] uppercase opacity-80">
        <Icon name={icon} size={13} /> {label}
      </p>
      <p className="mt-1.5 font-chunk font-bold text-[14px] text-gray-900 leading-snug">{value}</p>
    </div>
  );
};

const DetailCard = ({
  title,
  icon,
  items,
  single,
  tone = "cream",
}: {
  title: string;
  icon: string;
  items: string[];
  single?: boolean;
  tone?: "cream" | "gold" | "leaf" | "rust" | "danger";
}) => {
  const tones = {
    cream: { wrap: "border-gray-200 bg-white", iconWrap: "bg-teal-900 text-amber-300", check: "text-emerald-500" },
    gold: { wrap: "border-amber-200 bg-gradient-to-br from-amber-50 to-white", iconWrap: "bg-amber-500 text-white", check: "text-amber-600" },
    leaf: { wrap: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white", iconWrap: "bg-emerald-600 text-white", check: "text-emerald-600" },
    rust: { wrap: "border-orange-200 bg-gradient-to-br from-orange-50 to-white", iconWrap: "bg-orange-500 text-white", check: "text-orange-500" },
    danger: { wrap: "border-red-200 bg-gradient-to-br from-red-50 to-white", iconWrap: "bg-red-500 text-white", check: "text-red-500" },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-2xl border ${t.wrap} p-5 h-full hover:shadow-lg transition-shadow duration-300`}>
      <p className="flex items-center gap-3 font-chunk font-bold text-gray-900 text-[16px]">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.iconWrap} shadow-sm`}>
          <Icon name={icon} size={18} />
        </span>
        {title}
      </p>
      {single ? (
        <p className="mt-3.5 text-[14px] text-gray-600 leading-relaxed">{items[0]}</p>
      ) : (
        <ul className="mt-3.5 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] text-gray-600 leading-relaxed">
              <Icon name="CheckCircle2" size={16} className={`${t.check} shrink-0 mt-0.5`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ============ ARRAY FIELD EDITOR ============ */

const ArrayFieldEditor = ({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) => {
  const addItem = () => onChange([...values, ""]);
  const removeItem = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  const updateItem = (idx: number, val: string) => {
    const copy = [...values];
    copy[idx] = val;
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700">{label} ({values.length})</label>
        <button
          type="button"
          onClick={addItem}
          className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold flex items-center gap-1"
        >
          <Plus size={12} /> जोड़ें
        </button>
      </div>
      {values.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">कोई आइटम नहीं। "जोड़ें" दबाएं।</p>
      )}
      {values.map((val, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <span className="text-[10px] bg-gray-200 text-gray-600 w-6 h-8 flex items-center justify-center rounded font-bold shrink-0 mt-0.5">
            {idx + 1}
          </span>
          <textarea
            value={val}
            onChange={(e) => updateItem(idx, e.target.value)}
            placeholder={placeholder || `आइटम ${idx + 1}`}
            rows={2}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="p-1.5 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5 hover:bg-red-200"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

/* ============ STAGES EDITOR ============ */

const StagesEditor = ({
  stages,
  onChange,
}: {
  stages: { title: string; days: string; detail: string }[];
  onChange: (s: { title: string; days: string; detail: string }[]) => void;
}) => {
  const addStage = () => onChange([...stages, { title: "", days: "", detail: "" }]);
  const removeStage = (idx: number) => onChange(stages.filter((_, i) => i !== idx));
  const updateStage = (idx: number, field: string, val: string) => {
    const copy = [...stages];
    copy[idx] = { ...copy[idx], [field]: val };
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700">🗓️ फसल के चरण / Stages ({stages.length})</label>
        <button
          type="button"
          onClick={addStage}
          className="text-[10px] bg-teal-100 text-teal-700 px-2 py-1 rounded font-bold flex items-center gap-1"
        >
          <Plus size={12} /> चरण जोड़ें
        </button>
      </div>
      {stages.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">कोई चरण नहीं। "चरण जोड़ें" दबाएं।</p>
      )}
      {stages.map((stage, idx) => (
        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 relative">
          <button
            type="button"
            onClick={() => removeStage(idx)}
            className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded"
          >
            <Trash2 size={12} />
          </button>
          <p className="text-[10px] font-bold text-gray-400 mb-2">चरण {idx + 1}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={stage.title}
              onChange={(e) => updateStage(idx, "title", e.target.value)}
              placeholder="चरण का नाम (जैसे: बुवाई)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <input
              type="text"
              value={stage.days}
              onChange={(e) => updateStage(idx, "days", e.target.value)}
              placeholder="समय (जैसे: 0-7 दिन)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <textarea
            value={stage.detail}
            onChange={(e) => updateStage(idx, "detail", e.target.value)}
            placeholder="विस्तार से जानकारी..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none"
          />
        </div>
      ))}
    </div>
  );
};

/* ============ FULL CROP EDITOR MODAL ============ */

const CropEditorModal = ({
  isOpen,
  onClose,
  initialData,
  mode,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: ExtendedCropGuide;
  mode: "add" | "edit" | "clone";
  onSave: (data: ExtendedCropGuide) => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<ExtendedCropGuide>(initialData);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    soil: false,
    sowing: false,
    management: false,
    stages: false,
    extra: false,
  });

  useEffect(() => {
    if (isOpen) {
      setForm(initialData);
      setOpenSections({ basic: true, soil: false, sowing: false, management: false, stages: false, extra: false });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateField = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const SectionHeader = ({
    sKey,
    icon,
    title,
    subtitle,
    color,
  }: {
    sKey: string;
    icon: string;
    title: string;
    subtitle: string;
    color: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sKey)}
      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
        openSections[sKey] ? `${color} shadow-sm` : "bg-gray-50 border-gray-200 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon name={icon} size={18} />
        <div className="text-left">
          <p className="font-bold text-sm text-gray-900">{title}</p>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
      </div>
      {openSections[sKey] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
  );

  const TextInput = ({
    label,
    field,
    placeholder,
    required,
  }: {
    label: string;
    field: string;
    placeholder?: string;
    required?: boolean;
  }) => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={(form as any)[field] || ""}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
      />
    </div>
  );

  const TextArea = ({
    label,
    field,
    placeholder,
    rows = 3,
  }: {
    label: string;
    field: string;
    placeholder?: string;
    rows?: number;
  }) => (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      <textarea
        value={(form as any)[field] || ""}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 p-3 pt-16 sm:pt-20 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl relative mb-10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              {mode === "add" && <><Plus size={20} /> नई फसल जोड़ें</>}
              {mode === "edit" && <><Edit3 size={20} /> फसल एडिट करें</>}
              {mode === "clone" && <><Copy size={20} /> फसल कॉपी करके नई बनाएं</>}
            </h3>
            <p className="text-[11px] text-emerald-200 mt-0.5">सभी फील्ड भरें — Soil से Harvesting तक</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              alert("फसल का नाम डालना ज़रूरी है!");
              return;
            }
            onSave(form);
          }}
          className="p-4 sm:p-6 space-y-4"
        >
          {/* ===== SECTION 1: BASIC INFO ===== */}
          <SectionHeader
            sKey="basic"
            icon="FileText"
            title="1. मूल जानकारी (Basic Info)"
            subtitle="नाम, श्रेणी, मौसम, स्रोत"
            color="bg-blue-50 border-blue-200"
          />
          {openSections.basic && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="फसल का नाम (हिंदी)" field="name" placeholder="जैसे: गेहूं" required />
                <TextInput label="English Name" field="en" placeholder="e.g. Wheat" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    श्रेणी (Category) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
                    required
                  >
                    <option value="field">खेत फसल (Field)</option>
                    <option value="fruit">फल (Fruit)</option>
                    <option value="veg">सब्जी (Vegetable)</option>
                  </select>
                </div>
                <TextInput label="मौसम / Season" field="season" placeholder="खरीफ / रबी / जायद" />
                <TextInput label="अवधि (Duration)" field="duration" placeholder="120-150 दिन" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="स्रोत (Source)" field="source" placeholder="ICAR / RAU / सतगुरु" />
                <TextInput label="उपज (Yield)" field="yield" placeholder="20-25 क्विंटल/हेक्टेयर" />
              </div>
            </div>
          )}

          {/* ===== SECTION 2: SOIL & LAND ===== */}
          <SectionHeader
            sKey="soil"
            icon="Layers"
            title="2. मिट्टी व भूमि (Soil & Land)"
            subtitle="मिट्टी, भूमि तैयारी, गोबर खाद"
            color="bg-orange-50 border-orange-200"
          />
          {openSections.soil && (
            <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 space-y-3">
              <TextArea label="🟤 मिट्टी (Soil)" field="soil" placeholder="बलुई दोमट, pH 6.5-7.5..." />
              <TextArea label="🏗️ भूमि तैयारी / गड्ढा (Land Prep)" field="landPrep" placeholder="2-3 जुताई, पाटा..." />
              <TextArea label="🐄 सड़ी गोबर खाद (FYM/Manure)" field="manure" placeholder="10-15 टन/हेक्टेयर..." />
            </div>
          )}

          {/* ===== SECTION 3: SOWING ===== */}
          <SectionHeader
            sKey="sowing"
            icon="Sprout"
            title="3. बुवाई / रोपण (Sowing Details)"
            subtitle="समय, बीज दर, दूरी, किस्में, कटाई"
            color="bg-emerald-50 border-emerald-200"
          />
          {openSections.sowing && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="📅 बुवाई का समय" field="sowing" placeholder="अक्टूबर-नवंबर" />
                <TextInput label="🌱 बीज/पौधे दर" field="seedRate" placeholder="100 kg/ha; 20 kg/bigha" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="📏 दूरी / Spacing" field="spacing" placeholder="30×10 cm / 5×5 m" />
                <TextInput label="✂️ कटाई / Harvest" field="harvest" placeholder="मार्च-अप्रैल" />
              </div>

              {/* Varieties */}
              <ArrayFieldEditor
                label="⭐ अनुशंसित किस्में (Varieties)"
                values={form.varieties}
                onChange={(v) => updateField("varieties", v)}
                placeholder="किस्म का नाम (जैसे: RH-725)"
              />
            </div>
          )}

          {/* ===== SECTION 4: MANAGEMENT ===== */}
          <SectionHeader
            sKey="management"
            icon="FlaskConical"
            title="4. प्रबंधन (Management)"
            subtitle="खाद, सिंचाई, खरपतवार, संरक्षण"
            color="bg-teal-50 border-teal-200"
          />
          {openSections.management && (
            <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4 space-y-4">
              <ArrayFieldEditor
                label="💊 रासायनिक खाद योजना (Fertilizer)"
                values={form.fertilizer}
                onChange={(v) => updateField("fertilizer", v)}
                placeholder="N:P:K डोज़ और समय..."
              />
              <ArrayFieldEditor
                label="💧 सिंचाई योजना (Irrigation)"
                values={form.irrigation}
                onChange={(v) => updateField("irrigation", v)}
                placeholder="सिंचाई का समय और तरीका..."
              />
              <TextArea
                label="🌿 खरपतवार प्रबंधन (Weed Management)"
                field="weedMgmt"
                placeholder="पेंडीमिथालिन 1 kg/ha बुवाई से 2 दिन बाद..."
              />
              <ArrayFieldEditor
                label="🛡️ कीट-रोग संरक्षण (Protection)"
                values={form.protection}
                onChange={(v) => updateField("protection", v)}
                placeholder="कीट/रोग का नाम और दवाई..."
              />
            </div>
          )}

          {/* ===== SECTION 5: STAGES ===== */}
          <SectionHeader
            sKey="stages"
            icon="Route"
            title="5. फसल के चरण (Crop Stages)"
            subtitle="बुवाई से कटाई तक हर चरण"
            color="bg-purple-50 border-purple-200"
          />
          {openSections.stages && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4">
              <StagesEditor stages={form.stages} onChange={(s) => updateField("stages", s)} />
            </div>
          )}

          {/* ===== SECTION 6: EXTRA ===== */}
          <SectionHeader
            sKey="extra"
            icon="Sparkles"
            title="6. अतिरिक्त (Extra)"
            subtitle="विशेषज्ञ टिप, विशेष देखभाल"
            color="bg-amber-50 border-amber-200"
          />
          {openSections.extra && (
            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 space-y-3">
              <TextArea
                label="💡 विशेषज्ञ टिप (Expert Tip)"
                field="tip"
                placeholder="बुवाई से पहले बीज उपचार ज़रूर करें..."
                rows={3}
              />
              <ArrayFieldEditor
                label="❤️ विशेष देखभाल (Extra Care) — सिर्फ फल/सब्जी"
                values={form.extraCare || []}
                onChange={(v) => updateField("extraCare", v)}
                placeholder="छंटाई, कांट-छांट, ट्रेनिंग..."
              />
            </div>
          )}

          {/* ===== SAVE BUTTONS ===== */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white p-4 -mx-4 sm:-mx-6 rounded-b-2xl">
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
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 hover:shadow-xl transition"
            >
              <Save size={18} />
              {saving ? "सेव हो रहा है..." : mode === "edit" ? "✅ अपडेट करें" : "✅ सेव करें"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============ MAIN PAGE COMPONENT ============ */

export const CropsPage = ({ userRole }: CropsPageProps) => {
  const [cat, setCat] = useState<"all" | "field" | "fruit" | "veg">("all");
  const [active, setActive] = useState<ExtendedCropGuide>(HORTI_CROPS[0]);
  const [search, setSearch] = useState("");

  // Custom crops from DB
  const [customCrops, setCustomCrops] = useState<ExtendedCropGuide[]>([]);
  const [allCrops, setAllCrops] = useState<ExtendedCropGuide[]>(STATIC_CROPS);

  // Admin Dynamic Notes
  const [dbInfo, setDbInfo] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteFormData, setNoteFormData] = useState({ title: "", details: "" });

  // Crop Editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit" | "clone">("add");
  const [editorInitialData, setEditorInitialData] = useState<ExtendedCropGuide>(EMPTY_CROP);
  const [saving, setSaving] = useState(false);

  // Fetch custom crops from DB
  const fetchCustomCrops = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("custom_crops")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        const converted = data.map(dbRowToCropGuide);
        setCustomCrops(converted);
      }
    } catch {}
  }, []);

  // Fetch notes
  const fetchDb = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("general_info")
        .select("*")
        .eq("category", "Crops")
        .order("created_at", { ascending: false });
      if (data) setDbInfo(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDb();
    fetchCustomCrops();
  }, [fetchDb, fetchCustomCrops]);

  // Merge static + custom crops
  useEffect(() => {
    const merged = [...STATIC_CROPS, ...customCrops];
    setAllCrops(merged);
  }, [customCrops]);

  const CATS = makeCats(allCrops);

  // Notes save
  const handleNoteSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.from("general_info").insert([
        { category: "Crops", title: noteFormData.title || active.name, details: noteFormData.details },
      ]);
      setIsNoteModalOpen(false);
      setNoteFormData({ title: "", details: "" });
      fetchDb();
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleNoteDelete = async (id: string) => {
    if (!confirm("हटाना चाहते हैं?")) return;
    setLoading(true);
    await supabase.from("general_info").delete().eq("id", id);
    fetchDb();
  };

  // ===== CROP EDITOR HANDLERS =====

  const openAddCrop = () => {
    setEditorMode("add");
    setEditorInitialData({
      ...EMPTY_CROP,
      id: `custom-${Date.now()}`,
    });
    setIsEditorOpen(true);
  };

  const openEditCrop = (crop: ExtendedCropGuide) => {
    setEditorMode("edit");
    setEditorInitialData({ ...crop });
    setIsEditorOpen(true);
  };

  const openCloneCrop = (crop: ExtendedCropGuide) => {
    setEditorMode("clone");
    setEditorInitialData({
      ...crop,
      id: `custom-${Date.now()}`,
      name: `${crop.name} (कॉपी)`,
      _isCustom: undefined,
      _dbId: undefined,
    });
    setIsEditorOpen(true);
  };

  const handleCropSave = async (data: ExtendedCropGuide) => {
    setSaving(true);
    try {
      const dbData = cropGuideToDbRow(data);

      if (editorMode === "edit" && data._dbId) {
        // Update existing
        const { error } = await supabase
          .from("custom_crops")
          .update(dbData)
          .eq("id", data._dbId);
        if (error) throw error;
        alert("✅ फसल अपडेट हो गई!");
      } else {
        // Insert new
        const { error } = await supabase.from("custom_crops").insert([dbData]);
        if (error) throw error;
        alert("✅ नई फसल जोड़ दी गई!");
      }

      setIsEditorOpen(false);
      await fetchCustomCrops();
    } catch (err: any) {
      alert(`❌ एरर: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCrop = async (crop: ExtendedCropGuide) => {
    if (!crop._isCustom || !crop._dbId) {
      alert("⚠️ सिर्फ कस्टम (एडमिन द्वारा जोड़ी गई) फसलें डिलीट हो सकती हैं। Built-in फसलें डिलीट नहीं होंगी।");
      return;
    }
    if (!confirm(`⚠️ क्या आप "${crop.name}" को डिलीट करना चाहते हैं?`)) return;
    if (!confirm("🚨 फाइनल वार्निंग: यह फसल और उसका सारा डेटा हमेशा के लिए डिलीट हो जाएगा!")) return;

    setLoading(true);
    const { error } = await supabase.from("custom_crops").delete().eq("id", crop._dbId);
    if (!error) {
      alert("🗑️ फसल डिलीट हो गई।");
      if (active.id === crop.id) setActive(STATIC_CROPS[0]);
      await fetchCustomCrops();
    } else {
      alert(`❌ डिलीट फेल: ${error.message}`);
    }
    setLoading(false);
  };

  // Filter
  const filtered = allCrops
    .filter((c) => cat === "all" || c.category === cat)
    .filter((c) => !search || c.name.includes(search) || c.en.toLowerCase().includes(search.toLowerCase()));

  const extraNotes = dbInfo.filter((d) => d.title === active.name);

  return (
    <div className="bg-[#FDFBF7] min-h-screen pb-20">
      <PageHero
        eyebrow={`Package of Practices • ${allCrops.length} फसलें`}
        title={
          <>
            फसल: <span className="text-orange-400">बुवाई से कटाई तक</span>
          </>
        }
        sub={`${allCrops.length} राजस्थान फसलों की पूरी ICAR Package of Practices — मिट्टी तैयारी से कटाई तक: किस्में, खाद, सिंचाई व संरक्षण। बागबानी, फल और सब्जियों पर विशेष फोकस।`}
        image="/images/hero.jpg"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-5 py-8 md:py-16">
        {/* ADMIN BANNER */}
        {userRole === "admin" && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-amber-900 font-bold text-sm flex items-center gap-2">
                <ShieldCheck size={18} /> Admin Mode: फसल जोड़ें / एडिट करें / नोट जोड़ें
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={fetchCustomCrops} className="p-2 bg-white/60 border rounded-xl">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={openAddCrop}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus size={16} /> नई फसल जोड़ें
                </button>
                <button
                  onClick={() => openCloneCrop(active)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Copy size={16} /> कॉपी करके नई
                </button>
                {active._isCustom && (
                  <button
                    onClick={() => openEditCrop(active)}
                    className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Edit3 size={16} /> एडिट करें
                  </button>
                )}
                {active._isCustom && (
                  <button
                    onClick={() => handleDeleteCrop(active)}
                    className="bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow"
                  >
                    <Trash2 size={14} /> डिलीट
                  </button>
                )}
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus size={16} /> नोट जोड़ें
                </button>
              </div>
            </div>

            {/* Custom crops indicator */}
            {customCrops.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-300/30">
                <p className="text-[11px] text-amber-800 font-bold">
                  📦 एडमिन द्वारा जोड़ी गई फसलें: {customCrops.length} |{" "}
                  {customCrops.map((c) => c.name).join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========== FILTER BAR ========== */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div
              className="w-full md:w-auto overflow-x-auto pb-1 -mx-2 px-2"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex flex-nowrap md:flex-wrap gap-2 min-w-max">
                {CATS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCat(c.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-chunk font-semibold transition-all shrink-0 ${
                      cat === c.key
                        ? "bg-teal-900 text-amber-300 shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Icon name={c.icon} size={14} />
                    {c.label}
                    <span
                      className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        cat === c.key ? "bg-black/20 text-white" : "bg-gray-300 text-gray-700"
                      }`}
                    >
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-72 shrink-0">
              <Icon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="फसल खोजें (उदा: खजूर, जीरा)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all"
              />
            </div>
          </div>

          {/* CROP CHIPS */}
          <div
            className="mt-5 flex gap-2 overflow-x-auto pb-2 border-t border-gray-100 pt-4"
            style={{ scrollbarWidth: "none" }}
          >
            {filtered.length === 0 && <p className="text-sm text-gray-500 py-2">कोई फसल नहीं मिली।</p>}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActive(c);
                  document.getElementById("crop-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-semibold transition-all whitespace-nowrap border shrink-0 ${
                  active.id === c.id
                    ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white border-orange-500 shadow-md scale-[1.02]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                } ${c._isCustom ? "ring-2 ring-emerald-400/50" : ""}`}
              >
                <WheatEar className="w-3.5 h-4" />
                {c.name}
                {c._isCustom && (
                  <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ============ CROP DETAIL SECTION ============ */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            id="crop-detail"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="scroll-mt-24"
          >
            {/* Admin Edit Badge for active crop */}
            {userRole === "admin" && active._isCustom && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> यह एडमिन द्वारा जोड़ी गई फसल है — एडिट/डिलीट कर सकते हैं
                </p>
                <button
                  onClick={() => openEditCrop(active)}
                  className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Edit3 size={14} /> एडिट
                </button>
              </div>
            )}

            {/* ===== HERO HEADER ===== */}
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#0f172a] p-5 sm:p-8 md:p-12 shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px]" />
              <div className="relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-10">
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold tracking-wide">
                        <Icon name="Calendar" size={12} /> {active.season}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-white/90 border border-white/10 text-xs font-bold tracking-wide">
                        {active.en}
                      </span>
                      {active._isCustom && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                          ✨ Admin Added
                        </span>
                      )}
                    </div>
                    <h2 className="font-chunk font-black text-4xl sm:text-5xl md:text-6xl text-white tracking-tight break-words leading-tight">
                      {active.name}
                    </h2>
                    <p className="mt-3 flex items-start gap-2 text-[13px] sm:text-sm text-emerald-200/80 font-medium">
                      <Icon name="Landmark" size={16} className="shrink-0 mt-0.5" />
                      <span>{active.source}</span>
                    </p>
                    <div className="mt-8 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
                      {[
                        { label: "उपज", value: active.yield },
                        { label: "अवधि", value: active.duration },
                        { label: "बीज दर", value: active.seedRate?.split(";")[0] },
                        { label: "प्रक्रिया", value: `${active.stages.length} मुख्य चरण` },
                      ].map((item, i) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5 shadow-inner">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-orange-300">{item.label}</p>
                          <p className="mt-1 font-bold text-white text-[14px] leading-snug">{item.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
                    <a
                      href={waLink(`नमस्ते! मुझे ${active.name} की खेती के बारे में पूरी सलाह चाहिए।`)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-chunk font-bold text-[15px] px-6 py-4 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-1 transition-all"
                    >
                      <Icon name="MessageCircle" size={20} />
                      सलाह पाएं
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ADMIN EXTRA NOTES */}
            {extraNotes.length > 0 && (
              <div className="mt-6 space-y-3">
                {extraNotes.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5 relative shadow-sm">
                    {userRole === "admin" && (
                      <button onClick={() => handleNoteDelete(d.id)} className="absolute top-4 right-4 p-1.5 bg-red-100 text-red-600 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                      <Icon name="Info" size={16} /> दुकान द्वारा विशेष नोट:
                    </h3>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{d.details}</p>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION: मिट्टी व भूमि */}
            {(active.soil || active.landPrep || active.manure) && (
              <div className="mt-10">
                <div className="flex items-center gap-3.5 mb-5 pl-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-orange-100 text-orange-600 shadow-sm border border-orange-200">
                    <Icon name="Landmark" size={20} />
                  </span>
                  <div>
                    <h3 className="font-chunk font-bold text-gray-900 text-xl sm:text-2xl tracking-tight">मिट्टी व भूमि तैयारी</h3>
                    <p className="text-[13px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Soil & Land Prep</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {active.soil && <DetailCard title="मिट्टी (Soil)" icon="Layers" items={[active.soil]} single tone="rust" />}
                  {active.landPrep && <DetailCard title="भूमि तैयारी" icon="Shovel" items={[active.landPrep]} single tone="cream" />}
                  {active.manure && <DetailCard title="सड़ी गोबर खाद (FYM)" icon="Sprout" items={[active.manure]} single tone="leaf" />}
                </div>
              </div>
            )}

            {/* SECTION: बुवाई विवरण */}
            <div className="mt-10">
              <div className="flex items-center gap-3.5 mb-5 pl-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200">
                  <Icon name="Sprout" size={20} />
                </span>
                <div>
                  <h3 className="font-chunk font-bold text-gray-900 text-xl sm:text-2xl tracking-tight">बुवाई / रोपण विवरण</h3>
                  <p className="text-[13px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Sowing Details</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <InfoTile icon="CalendarDays" label="बुवाई का समय" value={active.sowing || "—"} accent="gold" />
                <InfoTile icon="Sprout" label="बीज / पौधे दर" value={active.seedRate || "—"} accent="rust" />
                <InfoTile icon="Ruler" label="दूरी / स्पेसिंग" value={active.spacing || "—"} accent="pine" />
                <InfoTile icon="Scissors" label="कटाई / तुड़ाई" value={active.harvest || "—"} accent="leaf" />
              </div>

              {/* किस्में */}
              {active.varieties.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <p className="flex items-center gap-3 font-chunk font-bold text-gray-900 text-lg">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                        <Icon name="Award" size={18} />
                      </span>
                      ICAR/RAU अनुशंसित किस्में
                    </p>
                    <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 w-max">
                      {active.varieties.length} किस्में
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {active.varieties.map((v) => (
                      <span key={v} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-sm font-semibold text-gray-700">
                        <Icon name="Star" size={12} className="text-amber-500" /> {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: प्रबंधन */}
            {(active.fertilizer.length > 0 || active.irrigation.length > 0 || active.weedMgmt || active.protection.length > 0) && (
              <div className="mt-10">
                <div className="flex items-center gap-3.5 mb-5 pl-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal-100 text-teal-800 shadow-sm border border-teal-200">
                    <Icon name="FlaskConical" size={20} />
                  </span>
                  <div>
                    <h3 className="font-chunk font-bold text-gray-900 text-xl sm:text-2xl tracking-tight">प्रबंधन योजना</h3>
                    <p className="text-[13px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Management Plan</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {active.fertilizer.length > 0 && <DetailCard title="रासायनिक खाद योजना" icon="FlaskConical" items={active.fertilizer} tone="gold" />}
                  {active.irrigation.length > 0 && <DetailCard title="सिंचाई योजना" icon="Droplets" items={active.irrigation} tone="leaf" />}
                  {active.weedMgmt && <DetailCard title="खरपतवार प्रबंधन" icon="Trash2" items={[active.weedMgmt]} single tone="cream" />}
                  {active.protection.length > 0 && <DetailCard title="प्रमुख कीट-रोग संरक्षण" icon="ShieldCheck" items={active.protection} tone="danger" />}
                </div>
              </div>
            )}

            {/* SECTION: विशेषज्ञ टिप */}
            {active.tip && (
              <Reveal className="mt-8">
                <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6 md:p-8 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-3xl" />
                  <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
                      <Icon name="Sparkles" size={26} />
                    </span>
                    <div>
                      <p className="font-chunk font-black text-gray-900 text-[18px]">विशेषज्ञ टिप (Expert Tip)</p>
                      <p className="mt-2 text-[14.5px] text-gray-700 leading-relaxed font-medium">{active.tip}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {/* SECTION: विशेष देखभाल */}
            {active.extraCare && active.extraCare.length > 0 && (
              <Reveal className="mt-6">
                <div className="rounded-3xl bg-[#064e3b] relative overflow-hidden p-6 md:p-8 shadow-lg">
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3.5 mb-5">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md">
                        <Icon name="Heart" size={24} />
                      </span>
                      <div>
                        <p className="font-chunk font-bold text-xl md:text-2xl text-white tracking-tight">{active.name} की विशेष देखभाल</p>
                        <p className="text-[12px] font-bold tracking-widest text-emerald-300 uppercase mt-0.5">Special Care</p>
                      </div>
                    </div>
                    <ul className="grid sm:grid-cols-2 gap-3.5">
                      {active.extraCare.map((ec, i) => (
                        <li key={i} className="flex gap-3.5 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-[14px] font-medium text-white/90 leading-relaxed hover:bg-white/10 transition-colors">
                          <Icon name="CheckCircle2" size={18} className="text-orange-400 shrink-0 mt-0.5" />
                          <span>{ec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            )}

            {/* SECTION: TIMELINE */}
            {active.stages.length > 0 && (
              <Reveal className="mt-10">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-6 sm:p-8 md:p-12 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100 rounded-full blur-[80px]" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-50 rounded-full blur-[80px]" />
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                      <div className="flex items-center gap-4">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-lg shadow-teal-900/20">
                          <Icon name="Route" size={26} />
                        </span>
                        <div>
                          <h3 className="font-chunk font-black text-3xl md:text-4xl text-gray-900 tracking-tight">कटाई तक का सफर</h3>
                          <p className="text-[14px] font-medium text-gray-500 mt-1">{active.stages.length} चरणों में पूरा गाइड</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-8">
                      <span className="hidden md:block absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-1.5 bg-gradient-to-b from-orange-400 via-emerald-500 to-teal-800 rounded-full opacity-30" />
                      <span className="md:hidden absolute left-[23px] top-4 bottom-4 w-1.5 bg-gradient-to-b from-orange-400 via-emerald-500 to-teal-800 rounded-full opacity-30" />

                      <ul className="space-y-8 md:space-y-12">
                        {active.stages.map((s, i) => {
                          const isLeft = i % 2 === 0;
                          return (
                            <Reveal key={`${s.title}-${i}`} delay={i * 0.1}>
                              <li className="relative">
                                {/* Mobile */}
                                <div className="md:hidden pl-16">
                                  <span className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-teal-900 text-white font-chunk font-bold text-lg shadow-md ring-4 ring-white z-10">
                                    {i + 1}
                                  </span>
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
                                    <div className="flex flex-col gap-2 mb-2">
                                      <span className="w-max inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-md">
                                        <Icon name="Clock" size={12} /> {s.days}
                                      </span>
                                      <p className="font-chunk font-bold text-gray-900 text-[17px] leading-tight">{s.title}</p>
                                    </div>
                                    <p className="mt-2.5 text-[14.5px] text-gray-600 leading-relaxed font-medium">{s.detail}</p>
                                  </div>
                                </div>

                                {/* Desktop */}
                                <div className="hidden md:grid grid-cols-2 gap-12 items-center relative">
                                  {isLeft ? (
                                    <>
                                      <div className="text-right flex justify-end">
                                        <div className="w-full max-w-[90%] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-shadow text-left">
                                          <div className="flex items-start justify-between gap-3 mb-3">
                                            <p className="font-chunk font-bold text-gray-900 text-[18px]">{s.title}</p>
                                            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-md">
                                              <Icon name="Clock" size={12} /> {s.days}
                                            </span>
                                          </div>
                                          <p className="text-[14.5px] text-gray-600 leading-relaxed font-medium">{s.detail}</p>
                                        </div>
                                      </div>
                                      <div />
                                    </>
                                  ) : (
                                    <>
                                      <div />
                                      <div className="flex justify-start">
                                        <div className="w-full max-w-[90%] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition-shadow">
                                          <div className="flex items-start justify-between gap-3 mb-3">
                                            <p className="font-chunk font-bold text-gray-900 text-[18px]">{s.title}</p>
                                            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-md">
                                              <Icon name="Clock" size={12} /> {s.days}
                                            </span>
                                          </div>
                                          <p className="text-[14.5px] text-gray-600 leading-relaxed font-medium">{s.detail}</p>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-teal-900 text-white font-chunk font-bold text-xl shadow-lg ring-[6px] ring-[#FDFBF7] z-10">
                                    {i + 1}
                                  </span>
                                </div>
                              </li>
                            </Reveal>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl">
                      <div className="flex items-center gap-2.5 text-[13px] font-medium text-gray-600">
                        <Icon name="Info" size={16} className="text-teal-700 shrink-0" />
                        <span>समय अनुमानित है; मौसम व मिट्टी अनुसार बदल सकता है।</span>
                      </div>
                      <a
                        href={waLink(`नमस्ते! ${active.name} की स्टेज-वाइज सलाह चाहिए।`)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-teal-800 text-white font-bold text-sm px-5 py-3 rounded-xl hover:bg-teal-900 transition-colors shadow-md"
                      >
                        <Icon name="MessageCircle" size={16} /> स्टेज वाइज सलाह
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ===== NOTE MODAL ===== */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">➕ विशेष नोट जोड़ें</h3>
              <button onClick={() => setIsNoteModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleNoteSave} className="space-y-3">
              <input className="w-full p-3 border rounded-xl text-sm bg-gray-50" value={active.name} disabled />
              <textarea
                className="w-full p-3 border rounded-xl text-sm"
                placeholder="नोट (उदा: इस मौसम में दवा स्प्रे ना करें)"
                rows={4}
                value={noteFormData.details}
                onChange={(e) => setNoteFormData({ ...noteFormData, details: e.target.value })}
                required
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsNoteModalOpen(false)} className="flex-1 py-2.5 border rounded-xl text-xs font-bold">
                  रद्द
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                  <Check size={16} /> सेव करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== FULL CROP EDITOR MODAL ===== */}
      <CropEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialData={editorInitialData}
        mode={editorMode}
        onSave={handleCropSave}
        saving={saving}
      />
    </div>
  );
};