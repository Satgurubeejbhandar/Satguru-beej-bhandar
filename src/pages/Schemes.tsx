import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CENTRAL_SCHEMES, RAJASTHAN_SCHEMES, type Scheme } from "../data/schemes";
import { waLink } from "../data/content";
import { Icon, PageHero, Reveal } from "../components/Shared";
import { supabase } from "../lib/supabase";
import { Plus, Edit2, Trash2, X, Check, RefreshCw, ShieldCheck } from "lucide-react";

interface SchemesPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

const SchemeCard = ({
  s,
  index,
  accent,
  userRole,
  onEdit,
  onDelete,
}: {
  s: Scheme & { id?: string };
  index: number;
  accent: string;
  userRole?: "admin" | "farmer" | "guest" | null;
  onEdit?: (s: any) => void;
  onDelete?: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 22 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    className="card grain relative flex h-full flex-col p-6 overflow-hidden"
  >
    <span className={`absolute top-0 left-0 right-0 h-1.5 ${accent}`} aria-hidden />
    
    {userRole === "admin" && (
      <div className="absolute top-3 left-3 z-10 flex gap-1">
        <button onClick={() => onEdit?.(s)} className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg">
          <Edit2 size={14} />
        </button>
        {s.id && (
          <button onClick={() => onDelete?.(s.id!)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    )}

    {s.tag && <span className="pill pill-gold absolute top-4 right-4">{s.tag}</span>}
    <p className="text-[10px] font-chunk font-bold tracking-[0.2em] uppercase text-gold-600">{s.short}</p>
    <h3 className="mt-1.5 font-chunk font-bold text-lg md:text-xl text-pine-900 leading-snug pr-16">{s.name}</h3>

    <div className="mt-4 space-y-3 grow">
      <div className="flex gap-2.5">
        <Icon name="HandCoins" size={17} className="text-leaf-500 shrink-0 mt-0.5" />
        <p className="text-sm text-ink-600 leading-relaxed"><b className="text-pine-800">लाभ:</b> {s.benefit}</p>
      </div>
      <div className="flex gap-2.5">
        <Icon name="BadgeCheck" size={17} className="text-pine-700 shrink-0 mt-0.5" />
        <p className="text-sm text-ink-600 leading-relaxed"><b className="text-pine-800">पात्रता:</b> {s.eligibility}</p>
      </div>
      <div className="flex gap-2.5">
        <Icon name="ClipboardList" size={17} className="text-clay-500 shrink-0 mt-0.5" />
        <p className="text-sm text-ink-600 leading-relaxed"><b className="text-pine-800">आवेदन:</b> {s.apply}</p>
      </div>
    </div>

    <a
      href={s.link}
      target="_blank"
      rel="noreferrer"
      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-pine-700/20 text-pine-800 font-chunk font-bold text-sm px-4 py-2.5 hover:bg-pine-700 hover:text-cream hover:border-pine-700 transition-all"
    >
      <Icon name="ExternalLink" size={15} />
      आधिकारिक पोर्टल खोलें
    </a>
  </motion.div>
);

export const SchemesPage = ({ userRole }: SchemesPageProps) => {
  const [govt, setGovt] = useState<"central" | "raj">("central");
  const [dbSchemes, setDbSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    short: "नई योजना",
    benefit: "",
    eligibility: "",
    apply: "",
    link: "https://",
    tag: "",
    category: "central",
  });

  const fetchDb = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("schemes").select("*").order("created_at", { ascending: false });
      if (data) setDbSchemes(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDb(); }, []);

  const staticData = govt === "central" ? CENTRAL_SCHEMES : RAJASTHAN_SCHEMES;
  
  // Map DB to Scheme format
  const dbMapped = dbSchemes
    .filter((s) => (govt === "central" ? s.category !== "raj" : s.category === "raj"))
    .map((s) => ({
      id: s.id,
      name: s.title,
      short: s.short || "योजना",
      benefit: s.benefits || s.description || "",
      eligibility: s.eligibility || "",
      apply: s.apply_link ? "ऑनलाइन आवेदन" : "विभाग से संपर्क करें",
      link: s.apply_link || "#",
      tag: s.tag || "नया",
    }));

  const data = [...dbMapped, ...staticData];

  const openModal = (item?: any) => {
    if (item?.id) {
      setEditingId(item.id);
      setFormData({
        title: item.name || item.title,
        short: item.short || "",
        benefit: item.benefit || "",
        eligibility: item.eligibility || "",
        apply: item.apply || "",
        link: item.link || "https://",
        tag: item.tag || "",
        category: govt === "central" ? "central" : "raj",
      });
    } else {
      setEditingId(null);
      setFormData({
        title: "", short: "नई योजना", benefit: "", eligibility: "", apply: "", link: "https://", tag: "नया", category: govt === "central" ? "central" : "raj",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.benefit,
        benefits: formData.benefit,
        eligibility: formData.eligibility,
        apply_link: formData.link,
        category: formData.category,
      };
      if (editingId) {
        await supabase.from("schemes").update(payload).eq("id", editingId);
      } else {
        await supabase.from("schemes").insert([payload]);
      }
      setIsModalOpen(false);
      fetchDb();
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("हटाना चाहते हैं?")) return;
    await supabase.from("schemes").delete().eq("id", id);
    fetchDb();
  };

  return (
    <div>
      <PageHero
        eyebrow="किसान हित • Govt Schemes"
        title={<>सरकारी <span className="text-gold-400">योजनाएं</span></>}
        sub="केंद्र सरकार व राजस्थान सरकार की प्रमुख कृषि योजनाएं — लाभ, पात्रता व आवेदन की पूरी जानकारी।"
        image="/images/hero.jpg"
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        {userRole === "admin" && (
          <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldCheck size={18} /> Admin Mode: योजना जोड़ें / बदलें
            </div>
            <div className="flex gap-2">
              <button onClick={fetchDb} className="p-2 bg-white/60 border rounded-xl">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => openModal()} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Plus size={16} /> नई योजना जोड़ें
              </button>
            </div>
          </div>
        )}

        <div className="inline-flex rounded-full border-2 border-pine-700/15 bg-cream-2 p-1.5 gap-1">
          <button onClick={() => setGovt("central")} className={`flex items-center gap-2 rounded-full px-5 md:px-8 py-2.5 font-chunk font-bold text-sm md:text-base transition-all ${govt === "central" ? "bg-pine-700 text-cream shadow-md" : "text-pine-800 hover:bg-pine-700/5"}`}>
            <Icon name="Landmark" size={17} /> केंद्र सरकार
          </button>
          <button onClick={() => setGovt("raj")} className={`flex items-center gap-2 rounded-full px-5 md:px-8 py-2.5 font-chunk font-bold text-sm md:text-base transition-all ${govt === "raj" ? "bg-gold-500 text-pine-950 shadow-md" : "text-pine-800 hover:bg-pine-700/5"}`}>
            <Icon name="MapPin" size={17} /> राजस्थान सरकार
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={govt} className="mt-8">
            <div className="flex items-center gap-3 mb-6">
              <span className={`pill ${govt === "central" ? "pill-green" : "pill-gold"}`}>{data.length} योजनाएं</span>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {data.map((s, i) => (
                <SchemeCard
                  key={(s as any).id || s.name + i}
                  s={s as any}
                  index={i}
                  accent={govt === "central" ? "bg-pine-700" : "bg-gold-500"}
                  userRole={userRole}
                  onEdit={openModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <Reveal className="mt-14">
          <div className="relative overflow-hidden rounded-3xl bg-pine-950 grain p-7 md:p-10">
            <div className="absolute inset-0 dot-grid opacity-15" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <h3 className="display-xl text-2xl md:text-3xl text-cream">योजना का लाभ लेने में <span className="text-gold-400">परेशानी?</span></h3>
                <p className="mt-3 text-cream/70 leading-relaxed text-sm md:text-base">PM-KISAN e-KYC, फसल बीमा, KCC — दुकान पर आएं या कॉल करें।</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="tel:+917988950257" className="btn-gold"><Icon name="PhoneCall" size={18} /> कॉल करें</a>
                <a href={waLink("नमस्ते! मुझे सरकारी योजना की जानकारी चाहिए।")} target="_blank" rel="noreferrer" className="btn-outline"><Icon name="MessageCircle" size={18} /> WhatsApp करें</a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingId ? "✏️ योजना बदलें" : "➕ नई योजना"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <input className="w-full p-3 border rounded-xl text-sm" placeholder="योजना का नाम" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
              <textarea className="w-full p-3 border rounded-xl text-sm" placeholder="लाभ (Benefit)" rows={2} value={formData.benefit} onChange={(e) => setFormData({...formData, benefit: e.target.value})} />
              <textarea className="w-full p-3 border rounded-xl text-sm" placeholder="पात्रता (Eligibility)" rows={2} value={formData.eligibility} onChange={(e) => setFormData({...formData, eligibility: e.target.value})} />
              <input className="w-full p-3 border rounded-xl text-sm" placeholder="आधिकारिक लिंक" value={formData.link} onChange={(e) => setFormData({...formData, link: e.target.value})} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border rounded-xl text-xs font-bold">रद्द</button>
                <button type="submit" className="flex-1 py-2.5 bg-pine-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                  <Check size={16} /> सेव करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};