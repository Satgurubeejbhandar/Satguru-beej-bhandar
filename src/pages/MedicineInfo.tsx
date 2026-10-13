import { useState, useEffect, useCallback } from 'react';
import { MEDICINES_DATA, type Medicine } from '../data/medicines';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, RefreshCw, ShieldCheck, Copy, Save, BookOpen } from "lucide-react";

interface MedicineInfoProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

export interface ExtendedMedicine extends Medicine {
  _isCustom?: boolean;
  _dbId?: string;
}

const CATEGORIES = [
  { id: 'All', label: 'सब देखें' },
  { id: 'Insecticide', label: 'कीटनाशक' },
  { id: 'Fungicide', label: 'फफूंदनाशक' },
  { id: 'Herbicide', label: 'खरपतवारनाशक' },
  { id: 'PGR', label: 'टॉनिक / PGR' },
  { id: 'Bactericide', label: 'जीवाणुनाशक' },
  { id: 'Miticide', label: 'मकड़ीनाशक' },
  { id: 'Nematicide', label: 'सूत्रकृमिनाशक' },
  { id: 'Fertilizer', label: 'उर्वरक / खाद' },
  { id: 'Micronutrient', label: 'सूक्ष्म पोषक' },
  { id: 'SeedTreatment', label: 'बीज उपचार' },
  { id: 'Spreader', label: 'स्टीकर / चिपको' },
  { id: 'BioPesticide', label: 'जैविक (सभी Bio)' },
  { id: 'Rodenticide', label: 'चूहानाशक' },
  { id: 'SoilConditioner', label: 'भूमि सुधारक' },
];

/* ─── Empty Form Template ─── */
const EMPTY_MEDICINE: ExtendedMedicine = {
  id: "",
  name: "",
  saltName: "",
  category: "Insecticide",
  categoryHindi: "कीटनाशक",
  formulation: "",
  dose: "",
  applicationTime: "",
  crops: [],
  targetPests: [],
  avoidCrops: [],
  doNotMixWith: [],
  failureReasons: [],
  references: ["सतगुरु बीज भंडार"],
};

/* ========================================================= */
/* ARRAY FIELD EDITOR COMPONENT                              */
/* ========================================================= */
const ArrayEditor = ({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) => {
  return (
    <div className="bg-pine-900/50 p-3 rounded-xl border border-gold-400/20">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-bold text-gold-400">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="bg-gold-400/20 text-gold-400 px-2 py-1 rounded text-[10px] font-bold"
        >
          + जोड़ें
        </button>
      </div>
      {values.length === 0 ? (
        <p className="text-[10px] text-cream/40 italic">खाली है, + जोड़ें बटन दबाएं।</p>
      ) : (
        <div className="space-y-2">
          {values.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={v}
                onChange={(e) => {
                  const arr = [...values];
                  arr[i] = e.target.value;
                  onChange(arr);
                }}
                placeholder={placeholder}
                className="flex-1 bg-pine-950 text-cream text-sm px-3 py-1.5 rounded-lg border border-gold-400/20 focus:outline-none focus:border-gold-400"
              />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="text-red-400 bg-red-900/40 p-1.5 rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ========================================================= */
/* FULL EDITOR MODAL                                         */
/* ========================================================= */
const MedicineEditorModal = ({
  isOpen,
  onClose,
  initialData,
  mode,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: ExtendedMedicine;
  mode: "add" | "edit" | "clone";
  onSave: (data: ExtendedMedicine) => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<ExtendedMedicine>(initialData);

  useEffect(() => {
    if (isOpen) setForm(initialData);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const updateField = (field: keyof ExtendedMedicine, val: any) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/80 p-3 pt-12 sm:pt-16 overflow-y-auto backdrop-blur-sm">
      <div className="bg-pine-950 rounded-3xl w-full max-w-3xl shadow-2xl relative mb-10 overflow-hidden border border-gold-400/30">
        
        <div className="sticky top-0 z-10 bg-pine-900 border-b border-gold-400/30 text-cream p-5 flex justify-between items-center shadow-md">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gold-400">
            {mode === "add" && <><Plus size={20} /> नई दवाई जोड़ें</>}
            {mode === "edit" && <><Edit2 size={20} /> दवाई एडिट करें</>}
            {mode === "clone" && <><Copy size={20} /> कॉपी करके नई बनाएं</>}
          </h3>
          <button onClick={onClose} className="p-2 bg-black/20 rounded-xl hover:bg-black/40"><X size={20} /></button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || !form.saltName.trim()) {
              alert("दवाई का नाम और साल्ट (Technical) डालना अनिवार्य है!");
              return;
            }
            onSave(form);
          }}
          className="p-5 sm:p-6 space-y-6"
        >
          {/* BASIC INFO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">दवाई/ब्रांड का नाम <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} required placeholder="जैसे: Coragen" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">टेक्निकल (Salt) <span className="text-red-500">*</span></label>
              <input type="text" value={form.saltName} onChange={(e) => updateField("saltName", e.target.value)} required placeholder="जैसे: Chlorantraniliprole 18.5% SC" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">कैटेगरी</label>
              <select value={form.category} onChange={(e) => updateField("category", e.target.value)} className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none">
                {CATEGORIES.filter(c => c.id !== 'All').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">कैटेगरी (हिंदी नाम)</label>
              <input type="text" value={form.categoryHindi} onChange={(e) => updateField("categoryHindi", e.target.value)} placeholder="जैसे: कीटनाशक" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">फॉर्मूलेशन (EC/SC/WG)</label>
              <input type="text" value={form.formulation} onChange={(e) => updateField("formulation", e.target.value)} placeholder="जैसे: SC, EC, WP" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-3 py-2.5 text-cream text-sm focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">डोज़ (मात्रा)</label>
              <input type="text" value={form.dose} onChange={(e) => updateField("dose", e.target.value)} placeholder="जैसे: 60ml / एकड़" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gold-400 mb-1">छिड़काव का समय (Time)</label>
              <input type="text" value={form.applicationTime} onChange={(e) => updateField("applicationTime", e.target.value)} placeholder="सुबह या शाम" className="w-full bg-pine-900 border border-gold-400/30 rounded-xl px-4 py-2.5 text-cream text-sm focus:outline-none" />
            </div>
          </div>

          {/* ARRAYS SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ArrayEditor label="🌱 कौन-सी फसलों में डालें (Crops)" values={form.crops} onChange={(v) => updateField("crops", v)} placeholder="जैसे: कपास, धान" />
            <ArrayEditor label="🐛 कौन-से कीट/रोग मारेगा (Pests)" values={form.targetPests} onChange={(v) => updateField("targetPests", v)} placeholder="जैसे: सफेद मक्खी, सुंडी" />
          </div>

          {/* REFERENCE BOX ADDED HERE */}
          <div className="bg-pine-900/30 p-1 rounded-xl">
            <ArrayEditor 
              label="📖 संदर्भ / दुकान / स्त्रोत (References)" 
              values={form.references || []} 
              onChange={(v) => updateField("references", v)} 
              placeholder="जैसे: सतगुरु बीज भंडार" 
            />
          </div>

          {/* WARNING ARRAYS */}
          <div className="bg-red-950/40 p-4 rounded-xl border border-red-900/50 space-y-4">
            <ArrayEditor label="🚫 किन फसलों में बिल्कुल ना डालें (Avoid Crops)" values={form.avoidCrops || []} onChange={(v) => updateField("avoidCrops", v)} placeholder="जैसे: सरसों, जीरा" />
            <ArrayEditor label="⚠️ किसके साथ मिलाकर ना छिड़कें (Do not mix)" values={form.doNotMixWith || []} onChange={(v) => updateField("doNotMixWith", v)} placeholder="जैसे: सल्फर, कॉपर" />
            <ArrayEditor label="❌ रिजल्ट ना आने के कारण (Failure Reasons)" values={form.failureReasons || []} onChange={(v) => updateField("failureReasons", v)} placeholder="जैसे: खारा पानी, कम डोज़" />
          </div>

          {/* SAVE BUTTONS */}
          <div className="flex gap-3 pt-4 border-t border-gold-400/20">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-gold-400/40 text-cream rounded-xl text-sm font-bold hover:bg-white/5 transition">
              ❌ रद्द करें
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-gold-400 text-pine-950 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 hover:bg-gold-500 transition">
              <Save size={18} />
              {saving ? "सेव हो रहा है..." : mode === "edit" ? "✅ अपडेट करें" : "✅ सेव करें"}
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
export const MedicineInfo = ({ userRole }: MedicineInfoProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMedicine, setSelectedMedicine] = useState<ExtendedMedicine | null>(null);

  // Custom Data State
  const [customMeds, setCustomMeds] = useState<ExtendedMedicine[]>([]);
  const [allMedicines, setAllMedicines] = useState<ExtendedMedicine[]>(MEDICINES_DATA);
  const [loading, setLoading] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit" | "clone">("add");
  const [editorInitialData, setEditorInitialData] = useState<ExtendedMedicine>(EMPTY_MEDICINE);
  const [saving, setSaving] = useState(false);

  const fetchCustomMeds = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("custom_medicines").select("*").order("created_at", { ascending: false });
      if (data) {
        const converted: ExtendedMedicine[] = data.map(d => ({
          id: d.id,
          name: d.name,
          saltName: d.salt_name,
          category: d.category,
          categoryHindi: d.category_hindi,
          formulation: d.formulation,
          dose: d.dose,
          applicationTime: d.application_time,
          crops: typeof d.crops === 'string' ? JSON.parse(d.crops) : (d.crops || []),
          targetPests: typeof d.target_pests === 'string' ? JSON.parse(d.target_pests) : (d.target_pests || []),
          avoidCrops: typeof d.avoid_crops === 'string' ? JSON.parse(d.avoid_crops) : (d.avoid_crops || []),
          doNotMixWith: typeof d.do_not_mix_with === 'string' ? JSON.parse(d.do_not_mix_with) : (d.do_not_mix_with || []),
          failureReasons: typeof d.failure_reasons === 'string' ? JSON.parse(d.failure_reasons) : (d.failure_reasons || []),
          // DB references parsing (Fallback to default if empty)
          references: d.references 
            ? (typeof d.references === 'string' ? JSON.parse(d.references) : d.references) 
            : ["सतगुरु बीज भंडार"],
          _isCustom: true,
          _dbId: d.id,
        }));
        setCustomMeds(converted);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomMeds();
  }, [fetchCustomMeds]);

  // Merge Static + Custom
  useEffect(() => {
    setAllMedicines([...MEDICINES_DATA, ...customMeds]);
  }, [customMeds]);

  // Search Filter
  const filteredMedicines = allMedicines.filter((med) => {
    const matchesSearch =
      med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.saltName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.crops.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase())) ||
      med.targetPests.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' ||
      med.category === selectedCategory ||
      (selectedCategory === 'BioPesticide' && med.category.toLowerCase().includes('bio'));

    return matchesSearch && matchesCategory;
  });

  // Editor Actions
  const openAddModal = () => {
    setEditorMode("add");
    setEditorInitialData({ ...EMPTY_MEDICINE, id: `custom-${Date.now()}` });
    setIsEditorOpen(true);
  };

  const openCloneModal = (med: ExtendedMedicine) => {
    setEditorMode("clone");
    setEditorInitialData({
      ...med,
      id: `custom-${Date.now()}`,
      name: `${med.name} (कॉपी)`,
      _isCustom: undefined,
      _dbId: undefined,
    });
    setIsEditorOpen(true);
  };

  const openEditModal = (med: ExtendedMedicine) => {
    setEditorMode("edit");
    setEditorInitialData({ ...med });
    setIsEditorOpen(true);
  };

  const handleSaveMed = async (data: ExtendedMedicine) => {
    setSaving(true);
    try {
      const dbRow = {
        name: data.name,
        salt_name: data.saltName,
        category: data.category,
        category_hindi: data.categoryHindi,
        formulation: data.formulation,
        dose: data.dose,
        application_time: data.applicationTime,
        crops: data.crops,
        target_pests: data.targetPests,
        avoid_crops: data.avoidCrops,
        do_not_mix_with: data.doNotMixWith,
        failure_reasons: data.failureReasons,
        references: data.references, // references added here to save in database
      };

      if (editorMode === "edit" && data._dbId) {
        await supabase.from("custom_medicines").update(dbRow).eq("id", data._dbId);
        alert("✅ दवाई अपडेट हो गई!");
      } else {
        await supabase.from("custom_medicines").insert([dbRow]);
        alert("✅ नई दवाई जोड़ दी गई!");
      }

      setIsEditorOpen(false);
      fetchCustomMeds();
    } catch (err: any) {
      alert(`❌ एरर: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMed = async (id: string) => {
    if (!confirm("⚠️ क्या आप सच में इस दवाई को डिलीट करना चाहते हैं?")) return;
    setLoading(true);
    await supabase.from("custom_medicines").delete().eq("id", id);
    alert("🗑️ दवाई डिलीट हो गई।");
    fetchCustomMeds();
  };

  return (
    <div className="min-h-screen bg-pine-950 pt-24 pb-12 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-400/10 border border-gold-400/30 text-gold-400 text-xs md:text-sm font-semibold mb-4 shadow-inner">
          <span className="animate-pulse">🌿</span>
          <span>
            वर्तमान में कुल <strong className="text-cream font-bold text-sm md:text-base mx-1">{allMedicines.length}</strong> दवाइयों व साल्ट की जानकारी उपलब्ध है
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-chunk text-gold-400 mb-3">दवाई व साल्ट जानकारी कोश</h1>
        <p className="text-cream/80 text-sm md:text-base max-w-2xl mx-auto">अपनी बची हुई दवाई का साल्ट या नाम सर्च करें और जानें सही मात्रा, फसल और सावधानियां।</p>
      </div>

      {/* Admin Panel Banner */}
      <div className="max-w-4xl mx-auto mb-6 space-y-3">
        {userRole === "admin" && (
          <div className="p-4 bg-gold-400/10 border border-gold-400/30 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-gold-400 text-sm font-bold flex items-center gap-2">
              <ShieldCheck size={18} /> Admin Mode: नई दवाई / साल्ट जोड़ें
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={fetchCustomMeds} className="p-2 bg-black/30 border border-gold-400/30 rounded-xl text-gold-400 hover:bg-gold-400/20">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button onClick={openAddModal} className="bg-gold-400 text-pine-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gold-500 shadow-lg">
                <Plus size={16} /> नई दवाई जोड़ें
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          <input type="text" placeholder="🔍 दवाई का नाम, साल्ट, बीमारी या फसल सर्च करें..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 pl-5 rounded-2xl bg-pine-900 border border-gold-400/30 text-cream placeholder-cream/50 focus:outline-none focus:border-gold-400 text-base shadow-lg" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-4 text-cream/50 hover:text-cream">✖</button>}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-none snap-x whitespace-nowrap border-y border-gold-400/10">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`snap-start flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCategory === cat.id ? 'bg-gold-400 text-pine-950 font-bold shadow-md scale-105' : 'bg-pine-900 text-cream/70 border border-gold-400/20 hover:bg-pine-800 hover:text-cream'}`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-4 flex justify-between items-center px-2 text-xs text-cream/60">
        <span>कुल <strong className="text-gold-400 font-bold">{allMedicines.length}</strong> में से <strong className="text-gold-400 font-bold">{filteredMedicines.length}</strong> दिख रही हैं</span>
      </div>

      {/* Cards Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMedicines.length > 0 ? (
          filteredMedicines.map((med) => (
            <div key={med.id} className={`bg-pine-900 border ${med._isCustom ? "border-emerald-400/60" : "border-gold-400/20"} rounded-2xl p-5 hover:border-gold-400/60 transition-all flex flex-col justify-between shadow-xl relative`}>
              
              {/* Admin Actions */}
              {userRole === "admin" && (
                <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                  <button onClick={() => openCloneModal(med)} className="p-1.5 bg-blue-900/60 text-blue-300 rounded-lg hover:bg-blue-800" title="कॉपी (Clone)">
                    <Copy size={14} />
                  </button>
                  {med._isCustom && (
                    <>
                      <button onClick={() => openEditModal(med)} className="p-1.5 bg-amber-900/60 text-amber-300 rounded-lg hover:bg-amber-800" title="एडिट">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteMed(med._dbId!)} className="p-1.5 bg-red-900/60 text-red-300 rounded-lg hover:bg-red-800" title="डिलीट">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs bg-pine-950 text-gold-400 border border-gold-400/30 px-3 py-1 rounded-full font-semibold">
                    {med.categoryHindi}
                  </span>
                  <span className="text-xs text-cream/60 bg-black/30 px-2 py-1 rounded">{med.formulation}</span>
                </div>

                <h3 className="text-lg font-bold text-cream mb-1 flex items-center gap-2">
                  {med.name}
                  {med._isCustom && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold border border-emerald-500/30">Custom</span>}
                </h3>
                <p className="text-xs text-gold-300/90 mb-4 italic font-mono">साल्ट: {med.saltName}</p>

                <div className="space-y-2 text-sm text-cream/80 mb-4">
                  <div><strong className="text-gold-400">🌱 फसलें:</strong> {med.crops.join(', ')}</div>
                  <div><strong className="text-gold-400">🎯 लक्ष्य:</strong> {med.targetPests.join(', ')}</div>
                  <div><strong className="text-gold-400">⚖️ डोज़:</strong> <span className="text-cream font-medium">{med.dose}</span></div>
                </div>
              </div>

              <button onClick={() => setSelectedMedicine(med)} className="w-full mt-2 py-2.5 bg-gold-400 hover:bg-gold-500 text-pine-950 font-bold rounded-xl transition-colors text-sm">
                पूरी जानकारी देखें ➔
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-cream/50"><p className="text-lg">इस कैटेगरी या सर्च में कोई दवाई नहीं मिली।</p></div>
        )}
      </div>

      {/* FULL DETAIL MODAL (Pop-up) */}
      {selectedMedicine && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div className="bg-pine-950 border border-gold-400/50 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 text-cream relative shadow-2xl">
            <button onClick={() => setSelectedMedicine(null)} className="absolute top-4 right-4 bg-pine-900 hover:bg-pine-800 text-cream w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold">✕</button>

            <div className="mb-4 pr-10">
              <span className="text-xs bg-gold-400 text-pine-950 font-bold px-3 py-1 rounded-full">{selectedMedicine.categoryHindi} ({selectedMedicine.formulation})</span>
              <h2 className="text-2xl font-bold text-gold-400 mt-3">{selectedMedicine.name}</h2>
              <p className="text-sm text-cream/70 font-mono mt-1">Technical/Salt: {selectedMedicine.saltName}</p>
            </div>

            <div className="space-y-4 text-sm md:text-base border-t border-gold-400/20 pt-4">
              <div className="bg-pine-900 p-3 rounded-xl border border-gold-400/10">
                <p className="font-semibold text-gold-400 mb-1">🌾 किन फसलों में डालें:</p>
                <p className="text-cream/90">{selectedMedicine.crops.join(', ')}</p>
              </div>

              <div className="bg-pine-900 p-3 rounded-xl border border-gold-400/10">
                <p className="font-semibold text-gold-400 mb-1">🐛 किस कीट / रोग पर असरदार:</p>
                <p className="text-cream/90">{selectedMedicine.targetPests.join(', ')}</p>
              </div>

              <div className="bg-pine-900 p-3 rounded-xl border border-gold-400/10">
                <p className="font-semibold text-gold-400 mb-1">💧 डोज़ (मात्रा प्रति एकड़):</p>
                <p className="text-cream font-bold">{selectedMedicine.dose}</p>
              </div>

              <div className="bg-pine-900 p-3 rounded-xl border border-gold-400/10">
                <p className="font-semibold text-gold-400 mb-1">⏰ सही समय (छिड़काव कब करें):</p>
                <p className="text-cream/90">{selectedMedicine.applicationTime}</p>
              </div>

              {/* REFERENCES SHOWING HERE */}
              {selectedMedicine.references && selectedMedicine.references.length > 0 && (
                <div className="bg-pine-900 p-3 rounded-xl border border-gold-400/15 flex items-start gap-2">
                  <div className="text-gold-400 mt-0.5"><BookOpen size={16} /></div>
                  <div>
                    <p className="font-semibold text-gold-400 mb-1 text-xs uppercase tracking-wide">📖 संदर्भ / दुकान / स्त्रोत:</p>
                    <p className="text-cream/90 text-sm">{selectedMedicine.references.join(', ')}</p>
                  </div>
                </div>
              )}

              {/* Warnings */}
              <div className="bg-red-950/40 border border-red-700/60 p-4 rounded-xl space-y-3">
                {selectedMedicine.avoidCrops && selectedMedicine.avoidCrops.length > 0 && (
                  <div>
                    <p className="font-bold text-red-400 flex items-center gap-1">🚫 किस फसल में बिल्कुल न डालें:</p>
                    <ul className="list-disc pl-5 text-cream/80 text-sm mt-1">{selectedMedicine.avoidCrops.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                  </div>
                )}
                {selectedMedicine.doNotMixWith && selectedMedicine.doNotMixWith.length > 0 && (
                  <div>
                    <p className="font-bold text-red-400 flex items-center gap-1">⚠️ किसके साथ मिलाकर छिड़काव न करें:</p>
                    <ul className="list-disc pl-5 text-cream/80 text-sm mt-1">{selectedMedicine.doNotMixWith.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                  </div>
                )}
              </div>

              {selectedMedicine.failureReasons && selectedMedicine.failureReasons.length > 0 && (
                <div className="bg-orange-950/40 border border-orange-700/50 p-4 rounded-xl">
                  <p className="font-bold text-orange-400 mb-1">❌ रिजल्ट न मिलने के मुख्य कारण:</p>
                  <ul className="list-disc pl-5 text-cream/80 text-sm space-y-1">{selectedMedicine.failureReasons.map((r, idx) => <li key={idx}>{r}</li>)}</ul>
                </div>
              )}
            </div>

            <button onClick={() => setSelectedMedicine(null)} className="w-full mt-6 py-3 bg-gold-400 text-pine-950 font-bold rounded-xl hover:bg-gold-500 transition-colors">
              समझ गया (बंद करें)
            </button>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <MedicineEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialData={editorInitialData}
        mode={editorMode}
        onSave={handleSaveMed}
        saving={saving}
      />
    </div>
  );
};