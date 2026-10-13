// src/data/market.ts

export interface MspRow {
  crop: string;
  en: string;
  category: "cereals" | "pulses" | "oilseeds" | "commercial";
  categoryHindi: "अनाज" | "दलहन" | "तिलहन" | "व्यावसायिक";
  msp: number;         // घोषित MSP (₹ प्रति क्विंटल)
  prev: number;        // पिछले वर्ष का MSP (₹ प्रति क्विंटल)
  cost?: number;       // उत्पादन लागत A2+FL (₹ प्रति क्विंटल)
  margin?: string;     // लागत पर लाभ % (Return over cost)
}

// ==========================================
// 1. रबी विपणन सत्र (RMS 2025-26) — आधिकारिक CCEA घोषणा (16 Oct 2024)
// ==========================================
export const MSP_RABI_2526: MspRow[] = [
  { crop: "गेहूं", en: "Wheat", category: "cereals", categoryHindi: "अनाज", msp: 2425, prev: 2275, cost: 1182, margin: "105%" },
  { crop: "जौ", en: "Barley", category: "cereals", categoryHindi: "अनाज", msp: 1980, prev: 1850, cost: 1179, margin: "68%" },
  { crop: "चना", en: "Gram", category: "pulses", categoryHindi: "दलहन", msp: 5650, prev: 5440, cost: 3410, margin: "66%" },
  { crop: "मसूर (दाल)", en: "Lentil (Masur)", category: "pulses", categoryHindi: "दलहन", msp: 6700, prev: 6425, cost: 3564, margin: "88%" },
  { crop: "सरसों व तोरिया", en: "Rapeseed & Mustard", category: "oilseeds", categoryHindi: "तिलहन", msp: 5950, prev: 5650, cost: 2994, margin: "99%" },
  { crop: "कुसुम (सूरजमुखी बीज)", en: "Safflower", category: "oilseeds", categoryHindi: "तिलहन", msp: 5940, prev: 5800, cost: 3950, margin: "50%" },
];

// ==========================================
// 2. खरीफ विपणन सत्र (KMS 2025-26) — आधिकारिक CCEA दरें
// ==========================================
export const MSP_KHARIF_2526: MspRow[] = [
  // अनाज (Cereals)
  { crop: "धान (सामान्य)", en: "Paddy (Common)", category: "cereals", categoryHindi: "अनाज", msp: 2300, prev: 2183, cost: 1533, margin: "50%" },
  { crop: "धान (ग्रेड-ए)", en: "Paddy (Grade A)", category: "cereals", categoryHindi: "अनाज", msp: 2320, prev: 2203, cost: 1533, margin: "51%" },
  { crop: "ज्वार (हाइब्रिड)", en: "Jowar (Hybrid)", category: "cereals", categoryHindi: "अनाज", msp: 3371, prev: 3180, cost: 2247, margin: "50%" },
  { crop: "ज्वार (मालदंडी)", en: "Jowar (Maldandi)", category: "cereals", categoryHindi: "अनाज", msp: 3421, prev: 3225, cost: 2247, margin: "52%" },
  { crop: "बाजरा", en: "Bajra", category: "cereals", categoryHindi: "अनाज", msp: 2625, prev: 2500, cost: 1483, margin: "77%" },
  { crop: "रागी", en: "Ragi", category: "cereals", categoryHindi: "अनाज", msp: 4290, prev: 3846, cost: 2860, margin: "50%" },
  { crop: "मक्का", en: "Maize", category: "cereals", categoryHindi: "अनाज", msp: 2225, prev: 2090, cost: 1483, margin: "50%" },
  
  // दलहन (Pulses)
  { crop: "अरहर / तुअर", en: "Arhar / Tur", category: "pulses", categoryHindi: "दलहन", msp: 7550, prev: 7000, cost: 4749, margin: "59%" },
  { crop: "मूंग", en: "Moong", category: "pulses", categoryHindi: "दलहन", msp: 8682, prev: 8558, cost: 5788, margin: "50%" },
  { crop: "उड़द", en: "Urad", category: "pulses", categoryHindi: "दलहन", msp: 7400, prev: 6950, cost: 4933, margin: "50%" },
  
  // तिलहन (Oilseeds)
  { crop: "मूंगफली (छिलका सहित)", en: "Groundnut", category: "oilseeds", categoryHindi: "तिलहन", msp: 6783, prev: 6377, cost: 4522, margin: "50%" },
  { crop: "सूरजमुखी बीज", en: "Sunflower Seed", category: "oilseeds", categoryHindi: "तिलहन", msp: 7280, prev: 6760, cost: 4853, margin: "50%" },
  { crop: "सोयाबीन (पीला)", en: "Soyabean (Yellow)", category: "oilseeds", categoryHindi: "तिलहन", msp: 4892, prev: 4600, cost: 3261, margin: "50%" },
  { crop: "तिल (Sesamum)", en: "Sesamum (Til)", category: "oilseeds", categoryHindi: "तिलहन", msp: 9267, prev: 8635, cost: 6178, margin: "50%" },
  { crop: "रामतिल (Nigerseed)", en: "Nigerseed", category: "oilseeds", categoryHindi: "तिलहन", msp: 8717, prev: 7734, cost: 5811, margin: "50%" },
  
  // व्यावसायिक (Commercial)
  { crop: "कपास (मध्यम रेशा)", en: "Cotton (Medium Staple)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 7121, prev: 6620, cost: 4747, margin: "50%" },
  { crop: "कपास (लंबा रेशा)", en: "Cotton (Long Staple)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 7521, prev: 7020, cost: 4747, margin: "58%" },
];

// ==========================================
// 3. रबी विपणन सत्र (RMS 2026-27) — नवीनतम CACP/CCEA बेंचमार्क
// ==========================================
export const MSP_RABI_2627: MspRow[] = [
  { crop: "गेहूं", en: "Wheat", category: "cereals", categoryHindi: "अनाज", msp: 2580, prev: 2425, cost: 1250, margin: "106%" },
  { crop: "जौ", en: "Barley", category: "cereals", categoryHindi: "अनाज", msp: 2110, prev: 1980, cost: 1255, margin: "68%" },
  { crop: "चना", en: "Gram", category: "pulses", categoryHindi: "दलहन", msp: 5875, prev: 5650, cost: 3540, margin: "66%" },
  { crop: "मसूर (दाल)", en: "Lentil (Masur)", category: "pulses", categoryHindi: "दलहन", msp: 7000, prev: 6700, cost: 3720, margin: "88%" },
  { crop: "सरसों व तोरिया", en: "Rapeseed & Mustard", category: "oilseeds", categoryHindi: "तिलहन", msp: 6275, prev: 5950, cost: 3150, margin: "99%" },
  { crop: "कुसुम (सूरजमुखी बीज)", en: "Safflower", category: "oilseeds", categoryHindi: "तिलहन", msp: 6100, prev: 5940, cost: 4060, margin: "50%" },
];

// ==========================================
// 4. खरीफ विपणन सत्र (KMS 2026-27) — नवीनतम अनुमानित/घोषित दरें
// ==========================================
export const MSP_KHARIF_2627: MspRow[] = [
  { crop: "धान (सामान्य)", en: "Paddy (Common)", category: "cereals", categoryHindi: "अनाज", msp: 2425, prev: 2300, cost: 1610, margin: "51%" },
  { crop: "धान (ग्रेड-ए)", en: "Paddy (Grade A)", category: "cereals", categoryHindi: "अनाज", msp: 2450, prev: 2320, cost: 1610, margin: "52%" },
  { crop: "ज्वार (हाइब्रिड)", en: "Jowar (Hybrid)", category: "cereals", categoryHindi: "अनाज", msp: 3550, prev: 3371, cost: 2360, margin: "50%" },
  { crop: "ज्वार (मालदंडी)", en: "Jowar (Maldandi)", category: "cereals", categoryHindi: "अनाज", msp: 3600, prev: 3421, cost: 2360, margin: "53%" },
  { crop: "बाजरा", en: "Bajra", category: "cereals", categoryHindi: "अनाज", msp: 2775, prev: 2625, cost: 1560, margin: "78%" },
  { crop: "रागी", en: "Ragi", category: "cereals", categoryHindi: "अनाज", msp: 4550, prev: 4290, cost: 3030, margin: "50%" },
  { crop: "मक्का", en: "Maize", category: "cereals", categoryHindi: "अनाज", msp: 2360, prev: 2225, cost: 1570, margin: "50%" },
  { crop: "अरहर / तुअर", en: "Arhar / Tur", category: "pulses", categoryHindi: "दलहन", msp: 7950, prev: 7550, cost: 5000, margin: "59%" },
  { crop: "मूंग", en: "Moong", category: "pulses", categoryHindi: "दलहन", msp: 8950, prev: 8682, cost: 5960, margin: "50%" },
  { crop: "उड़द", en: "Urad", category: "pulses", categoryHindi: "दलहन", msp: 7750, prev: 7400, cost: 5160, margin: "50%" },
  { crop: "मूंगफली (छिलका सहित)", en: "Groundnut", category: "oilseeds", categoryHindi: "तिलहन", msp: 7150, prev: 6783, cost: 4760, margin: "50%" },
  { crop: "सूरजमुखी बीज", en: "Sunflower Seed", category: "oilseeds", categoryHindi: "तिलहन", msp: 7650, prev: 7280, cost: 5100, margin: "50%" },
  { crop: "सोयाबीन (पीला)", en: "Soyabean (Yellow)", category: "oilseeds", categoryHindi: "तिलहन", msp: 5150, prev: 4892, cost: 3430, margin: "50%" },
  { crop: "तिल (Sesamum)", en: "Sesamum (Til)", category: "oilseeds", categoryHindi: "तिलहन", msp: 9850, prev: 9267, cost: 6560, margin: "50%" },
  { crop: "रामतिल (Nigerseed)", en: "Nigerseed", category: "oilseeds", categoryHindi: "तिलहन", msp: 9250, prev: 8717, cost: 6160, margin: "50%" },
  { crop: "कपास (मध्यम रेशा)", en: "Cotton (Medium Staple)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 7520, prev: 7121, cost: 5010, margin: "50%" },
  { crop: "कपास (लंबा रेशा)", en: "Cotton (Long Staple)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 7920, prev: 7521, cost: 5010, margin: "58%" },
];

// ==========================================
// 5. अन्य अनिवार्य फसलें (Jute, Copra & Sugarcane FRP)
// ==========================================
export const MSP_OTHER_COMMERCIAL: MspRow[] = [
  { crop: "कच्चा पटसन (Raw Jute)", en: "Raw Jute (TDN-3)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 5650, prev: 5335, cost: 3100, margin: "82%" },
  { crop: "खोपरा मिलिंग (Milling Copra)", en: "Copra (Milling)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 11580, prev: 11160, cost: 7420, margin: "56%" },
  { crop: "खोपरा गोला (Ball Copra)", en: "Copra (Ball)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 12300, prev: 12000, cost: 7750, margin: "59%" },
  { crop: "गन्ना (FRP दर प्रति क्विंटल)*", en: "Sugarcane (FRP at 10.25% recovery)", category: "commercial", categoryHindi: "व्यावसायिक", msp: 355, prev: 340, cost: 171, margin: "107%" },
];

// ===================== MANDI =====================
export interface MandiItem {
  market: string;       // Hindi mandi name
  district: string;     // Hindi jila
  commodity: string;    // Hindi fasal name
  variety?: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrival_date: string;
  isLocal?: boolean;
}

export const MANDI_LAST_UPDATED = "09/03/2026, शाम 5:00";

// Quick buttons ke liye (Hindi)
export const LOCAL_MARKETS = [
  "सरदारशहर",
  "नोहर",
  "रावतसर",
  "हनुमानगढ़",
  "श्रीगंगानगर",
  "चूरू",
  "संगरिया",
  "तारानगर",
];

export const MANDI_DATA: MandiItem[] = [
  // ---------- सरदारशहर (चूरू) ----------
  { market: "सरदारशहर", district: "चूरू", commodity: "ग्वार", min_price: 4800, max_price: 5400, modal_price: 5150, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "मूंग", min_price: 7600, max_price: 8300, modal_price: 7950, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "मोठ", min_price: 4400, max_price: 5050, modal_price: 4750, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "बाजरा", min_price: 2150, max_price: 2380, modal_price: 2280, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "गेहूं", min_price: 2420, max_price: 2580, modal_price: 2500, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "सरसों", min_price: 5450, max_price: 5850, modal_price: 5650, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "मूंगफली", min_price: 5600, max_price: 6200, modal_price: 5900, arrival_date: "09/03/2026", isLocal: true },
  { market: "सरदारशहर", district: "चूरू", commodity: "चना", min_price: 5200, max_price: 5700, modal_price: 5450, arrival_date: "09/03/2026", isLocal: true },

  // ---------- नोहर (हनुमानगढ़) ----------
  { market: "नोहर", district: "हनुमानगढ़", commodity: "ग्वार", min_price: 4900, max_price: 5450, modal_price: 5200, arrival_date: "09/03/2026", isLocal: true },
  { market: "नोहर", district: "हनुमानगढ़", commodity: "कपास", min_price: 6900, max_price: 7350, modal_price: 7100, arrival_date: "09/03/2026", isLocal: true },
  { market: "नोहर", district: "हनुमानगढ़", commodity: "गेहूं", min_price: 2450, max_price: 2600, modal_price: 2520, arrival_date: "09/03/2026", isLocal: true },
  { market: "नोहर", district: "हनुमानगढ़", commodity: "सरसों", min_price: 5500, max_price: 5900, modal_price: 5700, arrival_date: "09/03/2026", isLocal: true },
  { market: "नोहर", district: "हनुमानगढ़", commodity: "मूंग", min_price: 7700, max_price: 8400, modal_price: 8050, arrival_date: "09/03/2026", isLocal: true },
  { market: "नोहर", district: "हनुमानगढ़", commodity: "बाजरा", min_price: 2200, max_price: 2400, modal_price: 2320, arrival_date: "09/03/2026", isLocal: true },

  // ---------- रावतसर ----------
  { market: "रावतसर", district: "हनुमानगढ़", commodity: "ग्वार", min_price: 4850, max_price: 5350, modal_price: 5120, arrival_date: "09/03/2026", isLocal: true },
  { market: "रावतसर", district: "हनुमानगढ़", commodity: "कपास", min_price: 6850, max_price: 7280, modal_price: 7050, arrival_date: "09/03/2026", isLocal: true },
  { market: "रावतसर", district: "हनुमानगढ़", commodity: "गेहूं", min_price: 2430, max_price: 2570, modal_price: 2500, arrival_date: "09/03/2026", isLocal: true },
  { market: "रावतसर", district: "हनुमानगढ़", commodity: "सरसों", min_price: 5480, max_price: 5880, modal_price: 5680, arrival_date: "09/03/2026", isLocal: true },
  { market: "रावतसर", district: "हनुमानगढ़", commodity: "मूंग", min_price: 7650, max_price: 8250, modal_price: 7950, arrival_date: "09/03/2026", isLocal: true },

  // ---------- हनुमानगढ़ ----------
  { market: "हनुमानगढ़", district: "हनुमानगढ़", commodity: "कपास", min_price: 7000, max_price: 7450, modal_price: 7220, arrival_date: "09/03/2026", isLocal: true },
  { market: "हनुमानगढ़", district: "हनुमानगढ़", commodity: "गेहूं", min_price: 2460, max_price: 2620, modal_price: 2540, arrival_date: "09/03/2026", isLocal: true },
  { market: "हनुमानगढ़", district: "हनुमानगढ़", commodity: "सरसों", min_price: 5550, max_price: 5950, modal_price: 5750, arrival_date: "09/03/2026", isLocal: true },
  { market: "हनुमानगढ़", district: "हनुमानगढ़", commodity: "ग्वार", min_price: 4950, max_price: 5500, modal_price: 5250, arrival_date: "09/03/2026", isLocal: true },
  { market: "हनुमानगढ़", district: "हनुमानगढ़", commodity: "मूंग", min_price: 7800, max_price: 8500, modal_price: 8150, arrival_date: "09/03/2026", isLocal: true },

  // ---------- श्रीगंगानगर ----------
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "कपास", min_price: 7100, max_price: 7550, modal_price: 7320, arrival_date: "09/03/2026", isLocal: true },
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "गेहूं", min_price: 2480, max_price: 2650, modal_price: 2560, arrival_date: "09/03/2026", isLocal: true },
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "सरसों", min_price: 5600, max_price: 6000, modal_price: 5800, arrival_date: "09/03/2026", isLocal: true },
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "ग्वार", min_price: 5000, max_price: 5550, modal_price: 5280, arrival_date: "09/03/2026", isLocal: true },
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "मूंग", min_price: 7900, max_price: 8600, modal_price: 8250, arrival_date: "09/03/2026", isLocal: true },
  { market: "श्रीगंगानगर", district: "श्रीगंगानगर", commodity: "किन्नू", min_price: 1200, max_price: 1800, modal_price: 1500, arrival_date: "09/03/2026", isLocal: true },

  // ---------- संगरिया ----------
  { market: "संगरिया", district: "हनुमानगढ़", commodity: "कपास", min_price: 6950, max_price: 7400, modal_price: 7150, arrival_date: "09/03/2026", isLocal: true },
  { market: "संगरिया", district: "हनुमानगढ़", commodity: "गेहूं", min_price: 2440, max_price: 2590, modal_price: 2510, arrival_date: "09/03/2026", isLocal: true },

  // ---------- चूरू ----------
  { market: "चूरू", district: "चूरू", commodity: "ग्वार", min_price: 4750, max_price: 5300, modal_price: 5050, arrival_date: "09/03/2026", isLocal: true },
  { market: "चूरू", district: "चूरू", commodity: "मूंग", min_price: 7500, max_price: 8200, modal_price: 7850, arrival_date: "09/03/2026", isLocal: true },
  { market: "चूरू", district: "चूरू", commodity: "मोठ", min_price: 4300, max_price: 4900, modal_price: 4600, arrival_date: "09/03/2026", isLocal: true },
  { market: "चूरू", district: "चूरू", commodity: "बाजरा", min_price: 2100, max_price: 2320, modal_price: 2220, arrival_date: "09/03/2026", isLocal: true },

  // ---------- तारानगर ----------
  { market: "तारानगर", district: "चूरू", commodity: "ग्वार", min_price: 4700, max_price: 5250, modal_price: 5000, arrival_date: "09/03/2026", isLocal: true },

  // ---------- बीकानेर ----------
  { market: "बीकानेर", district: "बीकानेर", commodity: "मोठ", min_price: 4500, max_price: 5100, modal_price: 4850, arrival_date: "09/03/2026" },
  { market: "बीकानेर", district: "बीकानेर", commodity: "ग्वार", min_price: 4700, max_price: 5250, modal_price: 5000, arrival_date: "09/03/2026" },
  { market: "बीकानेर", district: "बीकानेर", commodity: "मूंगफली", min_price: 5400, max_price: 6000, modal_price: 5700, arrival_date: "09/03/2026" },

  // ---------- जयपुर ----------
  { market: "जयपुर", district: "जयपुर", commodity: "गेहूं", min_price: 2450, max_price: 2600, modal_price: 2525, arrival_date: "09/03/2026" },
  { market: "जयपुर", district: "जयपुर", commodity: "सरसों", min_price: 5400, max_price: 5800, modal_price: 5600, arrival_date: "09/03/2026" },

  // ---------- जोधपुर ----------
  { market: "जोधपुर", district: "जोधपुर", commodity: "जीरा", min_price: 28500, max_price: 32500, modal_price: 30500, arrival_date: "09/03/2026" },
  { market: "जोधपुर", district: "जोधपुर", commodity: "ग्वार", min_price: 4900, max_price: 5450, modal_price: 5200, arrival_date: "09/03/2026" },
  { market: "जोधपुर", district: "जोधपुर", commodity: "इसबगोल", min_price: 12500, max_price: 14800, modal_price: 13600, arrival_date: "09/03/2026" },

  // ---------- कोटा ----------
  { market: "कोटा", district: "कोटा", commodity: "धनिया", min_price: 7200, max_price: 8100, modal_price: 7650, arrival_date: "09/03/2026" },

  // ---------- बाड़मेर ----------
  { market: "बाड़मेर", district: "बाड़मेर", commodity: "जीरा", min_price: 27800, max_price: 31500, modal_price: 29600, arrival_date: "09/03/2026" },

  // ---------- नागौर ----------
  { market: "नागौर", district: "नागौर", commodity: "जीरा", min_price: 28000, max_price: 32000, modal_price: 30000, arrival_date: "09/03/2026" },
  { market: "मेड़ता", district: "नागौर", commodity: "इसबगोल", min_price: 12200, max_price: 14500, modal_price: 13300, arrival_date: "09/03/2026" },
];