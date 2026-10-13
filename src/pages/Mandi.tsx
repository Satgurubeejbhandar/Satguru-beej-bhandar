import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Edit2, Trash2, X, RefreshCw, Copy, Search, TrendingUp, MapPin, Database, Sparkles } from "lucide-react";

interface MandiItem {
  id?: string;
  market: string;
  district: string;
  commodity: string;
  variety?: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrival_date: string;
  source?: "api" | "manual";
}

interface MandiPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

const SEARCH_ALIASES: Record<string, string[]> = {
  "सरसों": ["mustard", "sarson", "sarso"],
  "गेहूं": ["wheat", "gehu", "gehun"],
  "ग्वार": ["guar", "gwar", "cluster bean"],
  "चना": ["gram", "chana", "channa"],
  "कपास": ["cotton", "kapas"],
  "मूंग": ["moong", "mung", "green gram"],
  "बाजरा": ["bajra", "pearl millet"],
  "मोठ": ["moth", "moath"],
  "मूंगफली": ["groundnut", "mungfali"],
  "जीरा": ["jeera", "cumin"],
  "इसबगोल": ["isabgol", "psyllium"],
  "धनिया": ["coriander", "dhaniya"],
  "सोयाबीन": ["soyabean", "soybean"],
  "लहसुन": ["garlic", "lahsun"],
  "सरदारशहर": ["sardarshahar", "sardarshahr"],
  "नोहर": ["nohar"], "रावतसर": ["rawatsar"], "हनुमानगढ़": ["hanumangarh"],
  "श्रीगंगानगर": ["ganganagar", "sriganganagar"], "चूरू": ["churu"],
  "बीकानेर": ["bikaner"], "जयपुर": ["jaipur"], "कोटा": ["kota"],
  "नागौर": ["nagaur"], "जोधपुर": ["jodhpur"], "अलवर": ["alwar"],
  "भरतपुर": ["bharatpur"], "अजमेर": ["ajmer"], "सीकर": ["sikar"]
};

const EMPTY_FORM = {
  market: "",
  district: "",
  commodity: "",
  variety: "",
  min_price: 0,
  max_price: 0,
  modal_price: 0,
  arrival_date: new Date().toLocaleDateString("hi-IN"),
};

export const MandiPage = ({ userRole }: MandiPageProps) => {
  const [search, setSearch] = useState("");
  const [rates, setRates] = useState<MandiItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // ── 1. Fetch Rates from Supabase ──
  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mandi_rates")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(2000);

      if (error || !data) {
        setRates([]);
      } else {
        const mapped: MandiItem[] = data.map((row: any) => ({
          id: row.id,
          market: row.mandi_name,
          district: row.district || "राजस्थान",
          commodity: row.crop_name,
          variety: row.variety || "",
          min_price: Number(row.min_price) || 0,
          max_price: Number(row.max_price) || 0,
          modal_price: Number(row.modal_price) || 0,
          arrival_date: row.arrival_date || "आज",
          source: row.source || "manual",
        }));
        setRates(mapped);
      }
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  // ── Bilingual Search ──
  const filteredData = useMemo(() => {
    let list = rates;
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();

    return list.filter((i) => {
      const market = i.market.toLowerCase();
      const district = i.district.toLowerCase();
      const commodity = i.commodity.toLowerCase();
      const variety = (i.variety || "").toLowerCase();

      if (market.includes(q) || district.includes(q) || commodity.includes(q) || variety.includes(q)) {
        return true;
      }

      for (const [hindiTerm, aliases] of Object.entries(SEARCH_ALIASES)) {
        const hit = hindiTerm.includes(q) || aliases.some((a) => a.includes(q) || q.includes(a));
        if (hit && (commodity.includes(hindiTerm) || market.includes(hindiTerm) || district.includes(hindiTerm))) {
          return true;
        }
      }
      return false;
    });
  }, [rates, search]);

  const openModal = (item?: MandiItem, asClone = false) => {
    if (item) {
      setEditingId(asClone ? null : item.id || null);
      setFormData({
        market: item.market || "",
        district: item.district || "",
        commodity: item.commodity || "",
        variety: item.variety || "",
        min_price: item.min_price || 0,
        max_price: item.max_price || 0,
        modal_price: item.modal_price || 0,
        arrival_date: item.arrival_date || new Date().toLocaleDateString("hi-IN"),
      });
    } else {
      setEditingId(null);
      setFormData({ ...EMPTY_FORM });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        mandi_name: formData.market.trim(),
        district: formData.district.trim(),
        crop_name: formData.commodity.trim(),
        variety: formData.variety.trim(),
        min_price: Number(formData.min_price) || 0,
        max_price: Number(formData.max_price) || 0,
        modal_price: Number(formData.modal_price) || 0,
        arrival_date: formData.arrival_date || new Date().toLocaleDateString("hi-IN"),
        source: "manual",
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        await supabase.from("mandi_rates").update(payload).eq("id", editingId);
      } else {
        await supabase.from("mandi_rates").insert([payload]);
      }
      setIsModalOpen(false);
      fetchRates();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("क्या आप इस भाव को हटाना चाहते हैं?")) return;
    await supabase.from("mandi_rates").delete().eq("id", id);
    fetchRates();
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen pt-24 md:pt-28 pb-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ── Header ── */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3.5 rounded-2xl text-emerald-700">
              <TrendingUp size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                राजस्थान मंडी भाव
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {rates.length > 0 ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 border border-emerald-200">
                    <Sparkles size={12} className="text-emerald-500" />
                    आधिकारिक सरकारी आंकड़े ({rates.length} मण्डियाँ)
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 border border-amber-200">
                    सरकारी डेटा प्रतिक्षारत है
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={fetchRates}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-100 transition font-bold text-sm"
              title="रीफ्रेश करें"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-emerald-600" : ""} />
              रीफ्रेश
            </button>

            {userRole === "admin" && (
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl hover:bg-emerald-700 shadow-md transition font-bold text-sm"
              >
                <Plus size={18} /> नया भाव
              </button>
            )}
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="relative w-full shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="मंडी, जिला या फसल खोजें (जैसे: सरदारशहर, नोहर, कोटा, Mustard, सरसों...)"
            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-medium shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── District Chips ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-gray-400 whitespace-nowrap flex items-center gap-1">
            <MapPin size={12}/> प्रमुख ज़िले:
          </span>
          {["सब राजस्थान", "चूरू", "हनुमानगढ़", "श्रीगंगानगर", "बीकानेर", "कोटा", "नागौर", "जयपुर", "जोधपुर", "अलवर", "भरतपुर", "बारां"].map((district) => (
            <button
              key={district}
              onClick={() => setSearch(district === "सब राजस्थान" ? "" : district)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                (district === "सब राजस्थान" && !search) || search === district
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {district}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">मंडी</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">जिला</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">फसल</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">न्यूनतम</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">अधिकतम</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">औसत (Modal)</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">तारीख</th>
                  {userRole === "admin" && <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">एक्शन</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={userRole === "admin" ? 8 : 7} className="p-12 text-center">
                      <RefreshCw className="animate-spin text-emerald-600 mx-auto mb-3" size={32} />
                      <p className="text-gray-500 font-medium">डेटा लोड हो रहा है...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={userRole === "admin" ? 8 : 7} className="p-16 text-center">
                      <div className="flex flex-col items-center">
                        <Database size={40} className="text-gray-300 mb-3" />
                        <p className="text-lg font-bold text-gray-800">
                          {search ? `"${search}" के लिए कोई भाव नहीं मिला` : "आज सरकारी मंडी डेटा उपलब्ध नहीं है"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm">
                          {search ? "कृपया किसी अन्य फसल या मंडी का नाम लिखें।" : "सरकारी पोर्टल से नया डेटा मिलने पर यहाँ स्वतः अपडेट हो जाएगा।"}
                        </p>
                        {search && (
                          <button
                            onClick={() => setSearch("")}
                            className="mt-4 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl text-xs font-bold"
                          >
                            सभी मंडी भाव देखें
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={item.id || `row-${index}`} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{item.market}</div>
                        {item.source === "api" && (
                          <span className="inline-flex mt-1 text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-extrabold tracking-wider uppercase">
                            GOVT API
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-gray-700 font-medium text-xs bg-gray-100 px-2 py-1 rounded-md">
                          {item.district}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-block">
                          {item.commodity}
                        </span>
                        {item.variety ? (
                          <span className="block text-[11px] text-gray-500 mt-1">{item.variety}</span>
                        ) : null}
                      </td>
                      <td className="p-4 text-red-600 font-bold">₹{item.min_price}</td>
                      <td className="p-4 text-emerald-600 font-bold">₹{item.max_price}</td>
                      <td className="p-4 text-gray-900 font-black text-base">₹{item.modal_price}</td>
                      <td className="p-4 text-sm text-gray-500 font-medium">{item.arrival_date}</td>
                      {userRole === "admin" && (
                        <td className="p-4">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => openModal(item)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => openModal(item, true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Copy size={16} />
                            </button>
                            {item.id && (
                              <button onClick={() => handleDelete(item.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{editingId ? "✏️ भाव एडिट" : "➕ नया मंडी भाव"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">मंडी *</label>
                    <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-emerald-500 font-medium" value={formData.market} onChange={(e) => setFormData({ ...formData, market: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">जिला</label>
                    <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-emerald-500 font-medium" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">फसल *</label>
                  <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-emerald-500 font-bold text-emerald-700" value={formData.commodity} onChange={(e) => setFormData({ ...formData, commodity: e.target.value })} required />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-red-600 font-bold text-center mb-1">Min</label>
                    <input type="number" className="w-full p-3 bg-red-50 border rounded-xl text-center font-bold text-red-600" value={formData.min_price || ""} onChange={(e) => setFormData({ ...formData, min_price: Number(e.target.value) })} required min={0} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-800 font-bold text-center mb-1">Modal</label>
                    <input type="number" className="w-full p-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-center font-black" value={formData.modal_price || ""} onChange={(e) => setFormData({ ...formData, modal_price: Number(e.target.value) })} required min={0} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-emerald-600 font-bold text-center mb-1">Max</label>
                    <input type="number" className="w-full p-3 bg-emerald-50 border rounded-xl text-center font-bold text-emerald-600" value={formData.max_price || ""} onChange={(e) => setFormData({ ...formData, max_price: Number(e.target.value) })} required min={0} />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold">रद्द</button>
                  <button type="submit" className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-bold">सेव करें</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MandiPage;