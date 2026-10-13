// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── हिंदी मैपिंग ──
const MANDI_HINDI: Record<string, string> = {
  "Sardarshahar": "सरदारशहर",
  "Nohar": "नोहर",
  "Rawatsar": "रावतसर",
  "Hanumangarh": "हनुमानगढ़",
  "Sri Ganganagar": "श्रीगंगानगर",
  "Sriganganagar": "श्रीगंगानगर",
  "Churu": "चूरू",
  "Sangaria": "संगरिया",
  "Taranagar": "तारानगर",
  "Bikaner": "बीकानेर",
  "Jaipur": "जयपुर",
  "Jodhpur": "जोधपुर",
  "Kota": "कोटा",
  "Barmer": "बाड़मेर",
  "Nagaur": "नागौर",
  "Merta City": "मेड़ता",
};

const DISTRICT_HINDI: Record<string, string> = {
  "Churu": "चूरू",
  "Hanumangarh": "हनुमानगढ़",
  "Sri Ganganagar": "श्रीगंगानगर",
  "Sriganganagar": "श्रीगंगानगर",
  "Bikaner": "बीकानेर",
  "Jaipur": "जयपुर",
  "Jodhpur": "जोधपुर",
  "Kota": "कोटा",
  "Barmer": "बाड़मेर",
  "Nagaur": "नागौर",
};

const CROP_HINDI: Record<string, string> = {
  "Wheat": "गेहूं",
  "Mustard": "सरसों",
  "Guar": "ग्वार",
  "Guar Seed(Cluster Beans Seed)": "ग्वार",
  "Bajra(Pearl Millet/Cumbu)": "बाजरा",
  "Bajra": "बाजरा",
  "Green Gram (Moong)(Whole)": "मूंग",
  "Moath Dal": "मोठ",
  "Gram": "चना",
  "Groundnut": "मूंगफली",
  "Cotton": "कपास",
  "Cummin Seed(Jeera)": "जीरा",
  "Isabgol": "इसबगोल",
  "Coriander(Leaves)": "धनिया",
  "Coriander": "धनिया",
  "Barley (Jau)": "जौ",
  "Maize": "मक्का",
  "Soyabean": "सोयाबीन",
  "Paddy(Dhan)(Common)": "धान",
};

const LOCAL_MARKETS_SET = new Set([
  "सरदारशहर", "नोहर", "रावतसर", "हनुमानगढ़",
  "श्रीगंगानगर", "चूरू", "संगरिया", "तारानगर"
]);

// Deno.serve (Modern Supabase Function)
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("DATA_GOV_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!API_KEY) {
      throw new Error("DATA_GOV_API_KEY not set in Supabase secrets");
    }

    const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

    // data.gov.in Rajasthan Live Mandi API
    const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${API_KEY}&format=json&limit=1000&filters[state]=Rajasthan`;

    console.log("🔄 Fetching from data.gov.in...");
    const response = await fetch(url);
    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No records found from API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map data
    const rows = data.records.map((r: any) => {
      const marketEn = r.market || "";
      const districtEn = r.district || "";
      const commodityEn = r.commodity || "";

      const marketHi = MANDI_HINDI[marketEn] || marketEn;
      const districtHi = DISTRICT_HINDI[districtEn] || districtEn;
      const commodityHi = CROP_HINDI[commodityEn] || commodityEn;

      return {
        mandi_name: marketHi,
        district: districtHi,
        state: "Rajasthan",
        crop_name: commodityHi,
        variety: r.variety || "",
        min_price: Number(r.min_price) || 0,
        max_price: Number(r.max_price) || 0,
        modal_price: Number(r.modal_price) || 0,
        arrival_date: r.arrival_date || new Date().toLocaleDateString("hi-IN"),
        is_local: LOCAL_MARKETS_SET.has(marketHi),
        source: "api",
        updated_at: new Date().toISOString(),
      };
    });

    // Save to Supabase DB
    const { error } = await supabase
      .from("mandi_rates")
      .upsert(rows, {
        onConflict: "mandi_name,crop_name,variety,arrival_date",
        ignoreDuplicates: false,
      });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        count: rows.length,
        message: `✅ ${rows.length} मंडी भाव अपडेट हो गए`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});