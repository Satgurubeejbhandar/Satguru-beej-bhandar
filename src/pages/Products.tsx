import { useMemo, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PRODUCTS, PRODUCT_CATEGORIES, type Product } from "../data/products";
import { waLink } from "../data/content";
import { Icon, PageHero, Reveal, WheatEar } from "../components/Shared";
import { supabase } from "../lib/supabase";
import { Plus, Edit2, Trash2, X, RefreshCw, ShieldCheck, Copy, Save } from "lucide-react";

const CAT_ICONS: Record<string, string> = {
  "सभी": "ShoppingBasket",
  "बीज": "Sprout",
  "कीटनाशक": "Bug",
  "फफूंदनाशक": "FlaskConical",
  "खरपतवारनाशक": "Scissors",
  "खाद / उर्वरक": "PackageCheck",
  "जैविक / PGR / सूक्ष्म तत्व": "Leaf",
  "कृषि उपकरण": "Hammer",
};

interface ProductsPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

// Extended Type with Custom flags
interface ExtendedProduct extends Product {
  _isCustom?: boolean;
  _dbId?: string;
}

const EMPTY_PRODUCT: ExtendedProduct = {
  id: 0 as any,
  name: "",
  brand: "",
  category: "बीज",
  tech: "",
  sizes: [{ pack: "1 Packet", price: 0 }],
  dose: "",
  crops: [],
  result: "",
  tag: undefined,
};

// ========================================================
// PRODUCT CARD (Bilkul Same Design)
// ========================================================
const ProductCard = ({
  p,
  index,
  userRole,
  onEdit,
  onClone,
  onDelete,
}: {
  p: ExtendedProduct;
  index: number;
  userRole?: "admin" | "farmer" | "guest" | null;
  onEdit?: (p: ExtendedProduct) => void;
  onClone?: (p: ExtendedProduct) => void;
  onDelete?: (id: string) => void;
}) => {
  const [sizeIdx, setSizeIdx] = useState(0);
  const sel = p.sizes[sizeIdx] || p.sizes[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={`card grain relative flex h-full flex-col p-5 overflow-hidden ${p._isCustom ? "ring-2 ring-emerald-400" : ""}`}
    >
      {p.tag && (
        <span
          className={`absolute top-0 right-0 rounded-bl-2xl px-3 py-1 text-[10px] font-chunk font-bold ${
            p.tag === "लोकप्रिय"
              ? "bg-gold-400 text-pine-950"
              : p.tag === "नया"
              ? "bg-pine-700 text-cream"
              : "bg-clay-500 text-cream-2"
          }`}
        >
          {p.tag}
        </span>
      )}

      {/* Admin Edit/Clone/Delete */}
      {userRole === "admin" && (
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          <button
            onClick={() => onEdit?.(p)}
            className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg shadow-sm"
            title="एडिट"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onClone?.(p)}
            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg shadow-sm"
            title="कॉपी करें"
          >
            <Copy size={14} />
          </button>
          {p._isCustom && p._dbId && (
            <button
              onClick={() => onDelete?.(p._dbId!)}
              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg shadow-sm"
              title="हटाएं"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pr-14 mt-6">
        <span className="pill pill-green !text-[0.7rem]">
          <Icon name={CAT_ICONS[p.category] ?? "Sprout"} size={11} />
          {p.category}
        </span>
        <span className="pill pill-gold !text-[0.7rem]">{p.brand}</span>
        {p._isCustom && (
          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold">
            Custom
          </span>
        )}
      </div>

      <h3 className="mt-2.5 font-chunk font-bold text-[17px] text-pine-900 leading-snug">{p.name}</h3>
      {p.tech && <p className="text-[11px] text-ink-600">तकनीकी: {p.tech}</p>}

      {p.sizes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.sizes.map((s, i) => (
            <button
              key={s.pack + i}
              onClick={() => setSizeIdx(i)}
              className={`rounded-full px-3 py-1 text-xs font-chunk font-bold border transition-all ${
                i === sizeIdx
                  ? "bg-pine-700 text-cream border-pine-700 shadow"
                  : "bg-cream-2 text-pine-800 border-pine-700/20 hover:border-pine-700/50"
              }`}
            >
              {s.pack}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between rounded-xl bg-gold-400/15 border border-gold-500/25 px-3.5 py-2.5">
        <div>
          <p className="text-[10px] font-chunk font-bold tracking-widest text-gold-600 uppercase">पैक साइज़</p>
          <p className="text-sm font-bold text-pine-900">{sel?.pack}</p>
        </div>
        <p className="font-chunk font-bold text-2xl text-pine-900">
          ₹{(sel?.price || 0).toLocaleString("en-IN")}
        </p>
      </div>

      {p.dose && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-pine-700/[0.06] border border-pine-700/10 px-3 py-2">
          <Icon name="Droplets" size={14} className="text-pine-700 shrink-0 mt-0.5" />
          <p className="text-[13px] font-semibold text-pine-900 leading-snug">{p.dose}</p>
        </div>
      )}

      {p.crops.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {p.crops.slice(0, 4).map((c, i) => (
            <span key={c + i} className="pill pill-clay !text-[0.68rem]">
              <WheatEar className="w-2.5 h-3" />
              {c}
            </span>
          ))}
          {p.crops.length > 4 && (
            <span className="pill pill-clay !text-[0.68rem]">+{p.crops.length - 4}</span>
          )}
        </div>
      )}

      {p.result && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-ink-600 leading-relaxed grow">
          <Icon name="Sparkles" size={13} className="text-gold-500 shrink-0 mt-1" />
          {p.result}
        </p>
      )}

      <a
        href={waLink(
          `नमस्ते! "${p.name} (${p.brand}) — ${sel?.pack}" का दाम ₹${sel?.price} देखा। स्टॉक/ऑर्डर की जानकारी चाहिए।`
        )}
        target="_blank"
        rel="noreferrer"
        className="mt-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-chunk font-bold text-sm px-4 py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all"
      >
        <Icon name="MessageCircle" size={15} />
        इस साइज़ पर ऑर्डर पूछें
      </a>
    </motion.div>
  );
};

// ========================================================
// FULL PRODUCT EDITOR MODAL
// ========================================================
const ProductEditorModal = ({
  isOpen,
  onClose,
  initialData,
  mode,
  onSave,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: ExtendedProduct;
  mode: "add" | "edit" | "clone";
  onSave: (data: ExtendedProduct) => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<ExtendedProduct>(initialData);

  useEffect(() => {
    if (isOpen) setForm(initialData);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const updateField = (field: keyof ExtendedProduct, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Sizes handlers
  const addSize = () =>
    setForm((prev) => ({ ...prev, sizes: [...prev.sizes, { pack: "", price: 0 }] }));

  const updateSize = (idx: number, field: "pack" | "price", val: string | number) => {
    const arr = [...form.sizes];
    arr[idx] = { ...arr[idx], [field]: field === "price" ? Number(val) : val };
    setForm((prev) => ({ ...prev, sizes: arr }));
  };

  const removeSize = (idx: number) => {
    if (form.sizes.length <= 1) return;
    setForm((prev) => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== idx) }));
  };

  // Crops handlers
  const addCrop = () => setForm((prev) => ({ ...prev, crops: [...prev.crops, ""] }));
  const updateCrop = (idx: number, val: string) => {
    const arr = [...form.crops];
    arr[idx] = val;
    setForm((prev) => ({ ...prev, crops: arr }));
  };
  const removeCrop = (idx: number) =>
    setForm((prev) => ({ ...prev, crops: prev.crops.filter((_, i) => i !== idx) }));

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 p-3 pt-12 sm:pt-16 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl relative mb-10 overflow-hidden border border-pine-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-pine-900 text-white p-5 flex justify-between items-center shadow-md">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {mode === "add" && <><Plus size={20} className="text-gold-400" /> नया उत्पाद जोड़ें</>}
            {mode === "edit" && <><Edit2 size={20} className="text-gold-400" /> उत्पाद एडिट करें</>}
            {mode === "clone" && <><Copy size={20} className="text-gold-400" /> कॉपी करके नया बनाएं</>}
          </h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              alert("उत्पाद का नाम डालना ज़रूरी है!");
              return;
            }
            if (form.sizes.length === 0 || !form.sizes.some((s) => s.pack.trim() !== "")) {
              alert("कम से कम 1 पैक साइज़ डालें!");
              return;
            }
            onSave(form);
          }}
          className="p-5 sm:p-6 space-y-5"
        >
          {/* 1. BASIC INFO */}
          <div className="bg-cream-2 p-4 rounded-2xl border border-pine-100 space-y-3">
            <h4 className="font-chunk font-bold text-pine-900 text-sm border-b border-pine-200 pb-2">
              1. मूल जानकारी (Basic Info)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">
                  उत्पाद का नाम <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="जैसे: कोराजन"
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">ब्रांड / कंपनी</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  placeholder="जैसे: FMC"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">कैटेगरी</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500 bg-white"
                >
                  {PRODUCT_CATEGORIES.filter((c) => c !== "सभी").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-pine-800 mb-1">तकनीकी नाम (Tech)</label>
                <input
                  type="text"
                  value={form.tech || ""}
                  onChange={(e) => updateField("tech", e.target.value)}
                  placeholder="Chlorantraniliprole 18.5% SC"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-pine-800 mb-1">टैग (Tag - Optional)</label>
              <select
                value={form.tag || ""}
                onChange={(e) => updateField("tag", e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500 bg-white"
              >
                <option value="">कोई टैग नहीं</option>
                <option value="लोकप्रिय">🔥 लोकप्रिय</option>
                <option value="नया">✨ नया</option>
                <option value="ऑफर">💰 ऑफर</option>
                <option value="स्टॉक समाप्त">❌ स्टॉक समाप्त</option>
              </select>
            </div>
          </div>

          {/* 2. SIZES & PRICES */}
          <div className="bg-gold-400/10 p-4 rounded-2xl border border-gold-500/25 space-y-3">
            <div className="flex justify-between items-center border-b border-gold-500/25 pb-2">
              <h4 className="font-chunk font-bold text-pine-900 text-sm">
                2. पैक साइज़ और मूल्य (Sizes & Prices) <span className="text-red-500">*</span>
              </h4>
              <button
                type="button"
                onClick={addSize}
                className="bg-gold-500 hover:bg-gold-600 text-pine-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} /> साइज़ जोड़ें
              </button>
            </div>

            <div className="space-y-2">
              {form.sizes.map((s, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-gold-500/20 flex items-center gap-2">
                  <span className="text-[10px] bg-gold-100 text-gold-700 w-7 h-7 flex items-center justify-center rounded-full font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={s.pack}
                    onChange={(e) => updateSize(idx, "pack", e.target.value)}
                    placeholder="पैक (जैसे: 150ml)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
                    required
                  />
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">₹</span>
                    <input
                      type="number"
                      value={s.price || ""}
                      onChange={(e) => updateSize(idx, "price", e.target.value)}
                      placeholder="मूल्य"
                      className="w-full border border-gray-300 rounded-lg pl-6 pr-2 py-2 text-sm outline-none focus:border-gold-500 font-bold text-pine-900"
                      required
                    />
                  </div>
                  {form.sizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSize(idx)}
                      className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. DOSE & USAGE */}
          <div className="bg-pine-50 p-4 rounded-2xl border border-pine-100 space-y-3">
            <h4 className="font-chunk font-bold text-pine-900 text-sm border-b border-pine-200 pb-2">
              3. खुराक व उपयोग (Dose & Usage)
            </h4>
            <div>
              <label className="block text-xs font-bold text-pine-800 mb-1">खुराक / डोज़</label>
              <input
                type="text"
                value={form.dose}
                onChange={(e) => updateField("dose", e.target.value)}
                placeholder="जैसे: 60ml प्रति एकड़ या 1 ग्राम प्रति लीटर"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-pine-800 mb-1">नतीजा / फायदा (Result)</label>
              <textarea
                value={form.result}
                onChange={(e) => updateField("result", e.target.value)}
                placeholder="इससे क्या फायदा होगा — विस्तार से लिखें..."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pine-500 resize-none"
              />
            </div>
          </div>

          {/* 4. CROPS */}
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 space-y-3">
            <div className="flex justify-between items-center border-b border-orange-200 pb-2">
              <h4 className="font-chunk font-bold text-orange-900 text-sm">
                4. कौन-सी फसलों में उपयोगी (Crops)
              </h4>
              <button
                type="button"
                onClick={addCrop}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus size={14} /> फसल जोड़ें
              </button>
            </div>

            {form.crops.length === 0 ? (
              <p className="text-xs text-gray-500 italic text-center py-3 bg-white rounded-lg border border-dashed border-gray-300">
                कोई फसल नहीं जोड़ी। "फसल जोड़ें" पर क्लिक करें।
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {form.crops.map((c, idx) => (
                  <div key={idx} className="bg-white flex items-center gap-1 border border-orange-200 rounded-lg pl-2">
                    <input
                      type="text"
                      value={c}
                      onChange={(e) => updateCrop(idx, e.target.value)}
                      placeholder="फसल"
                      className="flex-1 py-1.5 text-sm outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeCrop(idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAVE BUTTONS */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white py-3 -mx-5 sm:-mx-6 px-5 sm:px-6 border-t">
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
              className="flex-1 py-3 bg-pine-800 hover:bg-pine-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition"
            >
              <Save size={18} className="text-gold-400" />
              {saving ? "सेव हो रहा है..." : mode === "edit" ? "✅ अपडेट करें" : "✅ सेव करें"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// MAIN PAGE COMPONENT
// ========================================================
export const ProductsPage = ({ userRole }: ProductsPageProps) => {
  const [cat, setCat] = useState("सभी");
  const [q, setQ] = useState("");
  const [dbProducts, setDbProducts] = useState<ExtendedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit" | "clone">("add");
  const [editorInitialData, setEditorInitialData] = useState<ExtendedProduct>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  const fetchDbProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: ExtendedProduct[] = data.map((row: any) => {
          // Backward compatibility: if sizes JSONB empty, build from old price/unit
          let sizes = row.sizes;
          if (typeof sizes === "string") {
            try { sizes = JSON.parse(sizes); } catch { sizes = []; }
          }
          if (!sizes || sizes.length === 0) {
            sizes = [{ pack: row.unit || "1 Unit", price: Number(row.price) || 0 }];
          }

          let crops = row.crops;
          if (typeof crops === "string") {
            try { crops = JSON.parse(crops); } catch { crops = []; }
          }
          if (!crops) crops = [];

          return {
            id: row.id,
            name: row.name,
            brand: row.company || "सतगुरु",
            category: row.category || "बीज",
            tech: row.tech || "",
            sizes: sizes,
            dose: row.dosage || "",
            crops: crops,
            result: row.description || "",
            tag: row.tag || (row.in_stock === false ? "स्टॉक समाप्त" : undefined),
            _isCustom: true,
            _dbId: row.id,
          };
        });
        setDbProducts(mapped);
      } else {
        setDbProducts([]);
      }
    } catch {
      setDbProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDbProducts(); }, [fetchDbProducts]);

  // Merge static + DB (DB pehle)
  const allProducts = useMemo<ExtendedProduct[]>(() => {
    return [...dbProducts, ...(PRODUCTS as ExtendedProduct[])];
  }, [dbProducts]);

  const list = useMemo(() => {
    return allProducts.filter((p) => {
      const inCat = cat === "सभी" || p.category === cat;
      const query = q.trim().toLowerCase();
      if (!query) return inCat;
      return (
        inCat &&
        [p.name, p.brand, p.tech ?? "", p.category, ...(p.crops || [])]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [cat, q, allProducts]);

  // Editor Handlers
  const openAddModal = () => {
    setEditorMode("add");
    setEditorInitialData({ ...EMPTY_PRODUCT, id: Date.now() as any });
    setIsEditorOpen(true);
  };

  const openEditModal = (p: ExtendedProduct) => {
    setEditorMode("edit");
    setEditorInitialData({ ...p });
    setIsEditorOpen(true);
  };

  const openCloneModal = (p: ExtendedProduct) => {
    setEditorMode("clone");
    setEditorInitialData({
  ...p,
  id: Date.now() as any,
  name: `${p.name} (कॉपी)`,
  _isCustom: undefined,
  _dbId: undefined,
});
    setIsEditorOpen(true);
  };

  const handleSaveProduct = async (data: ExtendedProduct) => {
    setSaving(true);
    try {
      const payload: any = {
        name: data.name,
        company: data.brand,
        category: data.category,
        tech: data.tech || "",
        sizes: data.sizes,
        crops: data.crops,
        dosage: data.dose || "",
        description: data.result || "",
        tag: data.tag || "",
       in_stock: (data.tag as string) !== "स्टॉक समाप्त",
        price: data.sizes[0]?.price || 0, // backward-compat
        unit: data.sizes[0]?.pack || "",   // backward-compat
        updated_at: new Date().toISOString(),
      };

      if (editorMode === "edit" && data._dbId) {
        const { error } = await supabase.from("products").update(payload).eq("id", data._dbId);
        if (error) throw error;
        alert("✅ उत्पाद अपडेट हो गया!");
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
        alert("✅ नया उत्पाद जोड़ दिया गया!");
      }

      setIsEditorOpen(false);
      fetchDbProducts();
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("⚠️ क्या आप इस उत्पाद को हटाना चाहते हैं?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      alert("🗑️ उत्पाद हटा दिया गया।");
      fetchDbProducts();
    } catch (err: any) {
      alert("❌ Delete Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow={`उत्पाद भंडार • ${allProducts.length}+ उत्पाद`}
        title={<>उत्पाद, <span className="text-gold-400">साइज़ व बाज़ार दर</span></>}
        sub={`आम दवाई-बीज दुकान पर मिलने वाले ${allProducts.length}+ उत्पाद — हर उत्पाद में अलग-अलग पैक साइज़ चुनें और उसी साइज़ का रेट देखें। दरें बाज़ार अनुसार संकेतिक हैं; ताजा दाम व स्टॉक हेतु कॉल/WhatsApp करें।`}
        image="/images/seeds.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        {/* Admin Banner */}
        {userRole === "admin" && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldCheck size={18} />
              <span>Admin Mode: नया उत्पाद जोड़ें, कॉपी करें या रेट अपडेट करें</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDbProducts}
                className="p-2 bg-white/60 border rounded-xl hover:bg-white"
                title="रीफ्रेश"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={openAddModal}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus size={16} /> नया उत्पाद जोड़ें
              </button>
            </div>
          </div>
        )}

        {/* search */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 max-w-xl">
            <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-pine-700/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="उत्पाद, ब्रांड या फसल खोजें… जैसे: कोराजन, सरसों, यूरिया, लीडर"
              className="w-full rounded-full border border-pine-700/20 bg-cream-2 pl-11 pr-4 py-3 text-[15px] outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30 transition font-medium placeholder:text-ink-600/50"
            />
          </div>
          <p className="text-sm text-ink-600 font-chunk font-semibold">
            {list.length} / {allProducts.length} उत्पाद
          </p>
        </div>

        {/* categories */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
          {PRODUCT_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip ${cat === c ? "active" : ""}`}>
              <Icon name={CAT_ICONS[c] ?? "Sprout"} size={14} />
              {c}
            </button>
          ))}
        </div>

        {/* grid */}
        <motion.div layout className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {list.map((p, i) => (
              <ProductCard
                key={(p._dbId || p.id || p.name) + "-" + i}
                p={p}
                index={i}
                userRole={userRole}
                onEdit={openEditModal}
                onClone={openCloneModal}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {list.length === 0 && (
          <Reveal className="text-center py-20">
            <Icon name="Search" size={44} className="mx-auto text-pine-700/30" />
            <p className="mt-4 display-xl text-2xl text-pine-900">कोई उत्पाद नहीं मिला</p>
            <p className="mt-2 text-ink-600">दुकान पर 500+ उत्पाद उपलब्ध — कॉल या WhatsApp से पूछें।</p>
            <a
              href={waLink(`नमस्ते! मुझे "${q}" चाहिए। क्या उपलब्ध है?`)}
              target="_blank"
              rel="noreferrer"
              className="btn-gold mt-6"
            >
              <Icon name="MessageCircle" size={18} /> WhatsApp पर पूछें
            </a>
          </Reveal>
        )}

        <Reveal className="mt-12">
          <div className="rounded-2xl border border-gold-500/30 bg-gold-400/10 p-5 flex gap-3 items-start">
            <Icon name="Info" size={20} className="text-gold-600 shrink-0 mt-0.5" />
            <p className="text-sm md:text-[15px] text-ink-600 leading-relaxed">
              <b className="text-pine-900">नोट:</b> दरें बाज़ार अनुसार संकेतिक (MRP/मार्केट रेट 2025-26) —
              ब्रांड/स्तर व सीज़न से थोड़ा बदलाव संभव। यूरिया-DAP सरकारी नियंत्रित दर पर। ताज़ा दाम, स्टॉक व
              बल्क/किसान-मूल्य हेतु कॉल करें: <b className="text-pine-900">+91 79889 50257</b> • ₹5000+ पर
              होम डिलीवरी मुफ्त।
            </p>
          </div>
        </Reveal>
      </div>

      {/* FULL PRODUCT EDITOR MODAL */}
      <ProductEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialData={editorInitialData}
        mode={editorMode}
        onSave={handleSaveProduct}
        saving={saving}
      />
    </div>
  );
};

export default ProductsPage;