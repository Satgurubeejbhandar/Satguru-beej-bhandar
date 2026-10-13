export interface HomeCareProblem {
  pest: string;
  en: string;
  symptoms: string;
  chemical: string;
  dosePerLitre: string;
  phi: string;
  brands: string;
}

export interface HomeCarePlant {
  id: string;
  plant: string;
  en: string;
  type: "सब्जी" | "फल" | "सजावटी";
  problems: HomeCareProblem[];
}

export const HOMECARE_PLANTS: HomeCarePlant[] = [
  // ==================== सब्जियां (Vegetables) ====================
  {
    id: "tamatar",
    plant: "टमाटर",
    en: "Tomato",
    type: "सब्जी",
    problems: [
      { pest: "फल छेदक (सुंडी)", en: "Fruit Borer", symptoms: "फलों में गोल छेद, अंदर सुंडी; पके फल सड़ जाते हैं।", chemical: "इमामेक्टिन बेंजोएट 5% SG", dosePerLitre: "0.4 ग्रा. / लीटर पानी", phi: "3 दिन", brands: "प्रोक्लेम" },
      { pest: "अगेती/पछेती झुलसा", en: "Early/Late Blight", symptoms: "पत्तों पर भूरे धब्बे, तना काला पड़ना।", chemical: "मैंकोज़ेब 75% WP", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "5 दिन", brands: "M-45" },
      { pest: "सफेद मक्खी (लीफ कर्ल)", en: "Whitefly", symptoms: "पत्ते सिकुड़े-चिपचिपे; पीली पत्तियां (लीफ कर्ल वायरस)।", chemical: "इमिडाक्लोरिड 17.8% SL", dosePerLitre: "0.5 मि.ली. / लीटर पानी", phi: "5 दिन", brands: "कॉन्फिडोर" }
    ]
  },
  {
    id: "mirch",
    plant: "मिर्च / शिमला मिर्च",
    en: "Chilli / Capsicum",
    type: "सब्जी",
    problems: [
      { pest: "थ्रिप्स व माइट्स", en: "Thrips / Mites", symptoms: "पत्ते ऊपर की ओर मुड़कर नाव जैसे (लीफ कर्ल)।", chemical: "फिप्रोनिल 5% SC / प्रोपरजाइट 57% EC", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "7 दिन", brands: "रिजेंट / ओमाइट" },
      { pest: "फल गलन (एंथ्रेक्नोज़)", en: "Die-back / Anthracnose", symptoms: "मिर्च पर काले-भूरे धब्बे; डाली ऊपर से सूखना।", chemical: "एज़ोक्सीस्ट्रोबिन 23% SC", dosePerLitre: "1 मि.ली. / लीटर", phi: "5 दिन", brands: "एमिस्टार" }
    ]
  },
  {
    id: "baingan",
    plant: "बैंगन",
    en: "Brinjal",
    type: "सब्जी",
    problems: [
      { pest: "तना व फल छेदक", en: "Shoot & Fruit Borer", symptoms: "डंठल झुककर सूखना; फलों में छेद व सड़न।", chemical: "क्लोरेंट्रानिलिप्रोल 18.5% SC", dosePerLitre: "0.3 मि.ली. / लीटर", phi: "5 दिन", brands: "कोराजन" },
      { pest: "लाल मकड़ी (माइट्स)", en: "Red Spider Mite", symptoms: "पत्ते पीले-कांस्य रंग के, नीचे बारीक जाला।", chemical: "प्रोपरजाइट 57% EC", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "7 दिन", brands: "ओमाइट" }
    ]
  },
  {
    id: "bhindi",
    plant: "भिंडी",
    en: "Okra",
    type: "सब्जी",
    problems: [
      { pest: "सफेद मक्खी (पीला मोज़ेक)", en: "Whitefly (YVMV)", symptoms: "पत्तों की नसें पीली पड़ना (पीला नस मोज़ेक)।", chemical: "एसिटामिप्रिड 20% SP", dosePerLitre: "0.3 ग्रा. / लीटर पानी", phi: "3 दिन", brands: "मानिक" },
      { pest: "फल छेदक", en: "Fruit Borer", symptoms: "भिंडी में छेद; सुंडी आधी अंदर-आधी बाहर।", chemical: "इमामेक्टिन बेंजोएट 5% SG", dosePerLitre: "0.4 ग्रा. / लीटर पानी", phi: "3 दिन", brands: "प्रोक्लेम" }
    ]
  },
  {
    id: "karela",
    plant: "करेला",
    en: "Bitter Gourd",
    type: "सब्जी",
    problems: [
      { pest: "फल मक्खी", en: "Fruit Fly", symptoms: "फलों का पीला होकर सड़ना, अंदर सफेद सूंडियां।", chemical: "नीम तेल 10000 ppm / मैलाथियॉन", dosePerLitre: "3 मि.ली. / लीटर (नीम)", phi: "0 दिन", brands: "नीम ऑयल / सिथेल" },
      { pest: "डाउनी मिल्ड्यू", en: "Downy Mildew", symptoms: "पत्तों पर पीले धब्बे, नीचे सफेद फफूंद।", chemical: "मैंकोज़ेब 75% WP", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "5 दिन", brands: "M-45" }
    ]
  },
  {
    id: "lauki",
    plant: "लौकी / तोरी",
    en: "Bottle Gourd / Sponge Gourd",
    type: "सब्जी",
    problems: [
      { pest: "लाल कद्दू भृंग (रेड बीटल)", en: "Red Pumpkin Beetle", symptoms: "लाल रंग का कीड़ा जो पत्तों को जालीदार बना देता है।", chemical: "साइपरमेथ्रिन 25% EC", dosePerLitre: "1 मि.ली. / लीटर पानी", phi: "5 दिन", brands: "उस्ताद" },
      { pest: "चूर्णिल आसित (पाउडरी मिल्ड्यू)", en: "Powdery Mildew", symptoms: "पत्तों पर सफेद टेलकम पाउडर जैसी परत।", chemical: "हेक्साकोनाज़ोल 5% EC", dosePerLitre: "2 मि.ली. / लीटर पानी", phi: "5 दिन", brands: "कॉन्टाफ" }
    ]
  },
  {
    id: "kheera",
    plant: "खीरा / ककड़ी",
    en: "Cucumber",
    type: "सब्जी",
    problems: [
      { pest: "माहु व थ्रिप्स", en: "Aphids / Thrips", symptoms: "पत्ते सिकुड़ना, पौधों का विकास रुक जाना।", chemical: "थायोमेथोक्सम 25% WG", dosePerLitre: "0.5 ग्रा. / लीटर पानी", phi: "3 दिन", brands: "एकतारा" },
      { pest: "मोज़ेक वायरस", en: "Mosaic Virus", symptoms: "पत्ते चितकबरे (हल्के-गहरे हरे) व सिकुड़े हुए।", chemical: "वायरस का इलाज नहीं; माहु रोकने हेतु इमिडाक्लोरिड डालें", dosePerLitre: "0.5 मि.ली. / लीटर", phi: "3 दिन", brands: "कॉन्फिडोर" }
    ]
  },
  {
    id: "palak",
    plant: "पालक",
    en: "Spinach",
    type: "सब्जी",
    problems: [
      { pest: "पत्ती धब्बा (लीफ स्पॉट)", en: "Leaf Spot", symptoms: "पत्तों पर गोल भूरे धब्बे, पत्ते पीले होकर सूखना।", chemical: "कॉपर ऑक्सीक्लोराइड 50% WP", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "7 दिन (अच्छी तरह धोएं)", brands: "ब्लाइटॉक्स" },
      { pest: "इल्ली (कैटरपिलर)", en: "Caterpillar", symptoms: "पत्तियों को किनारों से या बीच से खाकर जाली बनाना।", chemical: "नीम ऑयल या स्पाइनोसैड 45% SC", dosePerLitre: "0.3 मि.ली. / लीटर (ट्रेसर)", phi: "3 दिन", brands: "ट्रेसर / बायो-नीम" }
    ]
  },
  {
    id: "dhaniya",
    plant: "धनिया",
    en: "Coriander",
    type: "सब्जी",
    problems: [
      { pest: "माहु (चेपा)", en: "Aphid", symptoms: "फूलों व कोमल तनों पर चिपचिपे हरे/काले कीड़े।", chemical: "नीम ऑयल (रसायन से बचें क्योंकि पत्ते कच्चे खाते हैं)", dosePerLitre: "5 मि.ली. / लीटर पानी", phi: "1 दिन", brands: "नीम ऑयल" },
      { pest: "स्टेम गॉल (तना गांठ)", en: "Stem Gall", symptoms: "तनों व पत्तों पर फफोले या गांठें बनना।", chemical: "कार्बेन्डाज़िम 50% WP", dosePerLitre: "1.5 ग्रा. / लीटर पानी", phi: "10 दिन", brands: "बाविस्टिन" }
    ]
  },
  {
    id: "pudina",
    plant: "पुदीना",
    en: "Mint",
    type: "सब्जी",
    problems: [
      { pest: "रतुआ (रस्ट)", en: "Rust", symptoms: "पत्तों की निचली सतह पर लाल-भूरे जंग जैसे धब्बे।", chemical: "सल्फर 80% WDG", dosePerLitre: "2 ग्रा. / लीटर पानी", phi: "5 दिन", brands: "कासावेट / सल्फैक्स" },
      { pest: "पत्ती खाने वाली इल्ली", en: "Leaf eating caterpillar", symptoms: "पत्तियों में छेद।", chemical: "नीम ऑयल + तरल साबुन", dosePerLitre: "5 मि.ली. / लीटर", phi: "0 दिन", brands: "नीम की खली/तेल" }
    ]
  },
  {
    id: "pyaz",
    plant: "प्याज / लहसुन",
    en: "Onion / Garlic",
    type: "सब्जी",
    problems: [
      { pest: "थ्रिप्स (जूं)", en: "Thrips", symptoms: "पत्तियों पर सफेद/चांदी जैसी धारियां; पत्तियां मुड़ जाना।", chemical: "फिप्रोनिल 5% SC", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "7 दिन", brands: "रिजेंट" },
      { pest: "पर्पल ब्लॉच", en: "Purple Blotch", symptoms: "पत्तों पर पानी जैसे धब्बे जो बाद में बैंगनी/भूरे हो जाते हैं।", chemical: "टेबुकोनाज़ोल 25.9% EC", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "14 दिन", brands: "फोलिकुर" }
    ]
  },
  {
    id: "gobhi",
    plant: "पत्ता गोभी / फूल गोभी",
    en: "Cabbage / Cauliflower",
    type: "सब्जी",
    problems: [
      { pest: "हीरक पीठ पतंगा (DBM)", en: "Diamondback Moth", symptoms: "हल्के हरे रंग की सूंडियां पत्तों को खाकर जाली बनाती हैं।", chemical: "स्पाइनोसैड 45% SC", dosePerLitre: "0.3 मि.ली. / लीटर पानी", phi: "3 दिन", brands: "ट्रेसर" },
      { pest: "काला सड़ांध (ब्लैक रॉट)", en: "Black Rot", symptoms: "पत्तियों के किनारों से 'V' आकार का पीलापन व नसें काली पड़ना।", chemical: "स्ट्रेप्टोमाइसिन + कॉपर ऑक्सीक्लोराइड", dosePerLitre: "0.1 ग्रा + 2.5 ग्रा / लीटर", phi: "10 दिन", brands: "प्लांटोमाइसिन + ब्लाइटॉक्स" }
    ]
  },
  {
    id: "mooli",
    plant: "मूली / गाजर / शलगम",
    en: "Radish / Carrot",
    type: "सब्जी",
    problems: [
      { pest: "सफेद रतुआ (व्हाइट रस्ट)", en: "White Rust", symptoms: "पत्तियों पर सफेद रंग के फफोले (पाउडर)।", chemical: "मेटालैक्सिल + मैंकोज़ेब", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "7 दिन", brands: "रिडोमिल गोल्ड" },
      { pest: "फ्ली बीटल (भृंग)", en: "Flea Beetle", symptoms: "पत्तों में छोटे-छोटे गोल छर्रे जैसे छेद।", chemical: "इमिडाक्लोरिड 17.8% SL", dosePerLitre: "0.5 मि.ली. / लीटर पानी", phi: "7 दिन", brands: "कॉन्फिडोर" }
    ]
  },
  {
    id: "aloo",
    plant: "आलू",
    en: "Potato",
    type: "सब्जी",
    problems: [
      { pest: "पछेती झुलसा", en: "Late Blight", symptoms: "पत्तियों पर जलने जैसे बड़े भूरे धब्बे, सफेद फफूंद।", chemical: "साइमोक्सानिल 8% + मैंकोज़ेब 64%", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "14 दिन", brands: "कर्जेट" },
      { pest: "माहु व लीफ माइनर", en: "Aphid / Leaf Miner", symptoms: "पत्तों में सफेद लकीरें व रस चूसने वाले कीट।", chemical: "थायोमेथोक्सम 25% WG", dosePerLitre: "0.5 ग्रा. / लीटर पानी", phi: "7 दिन", brands: "एकतारा" }
    ]
  },
  {
    id: "matar",
    plant: "मटर",
    en: "Peas",
    type: "सब्जी",
    problems: [
      { pest: "फली छेदक", en: "Pod Borer", symptoms: "फलियों में छेद, अंदर हरी सुंडी जो दाने खाती है।", chemical: "इमामेक्टिन बेंजोएट 5% SG", dosePerLitre: "0.4 ग्रा. / लीटर पानी", phi: "5 दिन", brands: "प्रोक्लेम" },
      { pest: "पाउडरी मिल्ड्यू", en: "Powdery Mildew", symptoms: "पत्तों और फलियों पर सफेद पाउडर।", chemical: "सल्फर 80% WDG", dosePerLitre: "2 ग्रा. / लीटर पानी", phi: "5 दिन", brands: "सल्फैक्स" }
    ]
  },
  {
    id: "kaddu",
    plant: "कद्दू / सीताफल",
    en: "Pumpkin",
    type: "सब्जी",
    problems: [
      { pest: "फल मक्खी", en: "Fruit Fly", symptoms: "छोटे फल पीले होकर सड़ना।", chemical: "मैलाथियॉन + गुड़", dosePerLitre: "1.5 मि.ली. / लीटर", phi: "7 दिन", brands: "सिथेल" },
      { pest: "मोज़ेक वायरस", en: "Mosaic", symptoms: "पत्ते चितकबरे पीले-हरे।", chemical: "नीम तेल या इमिडाक्लोरिड (वाहक कीटों हेतु)", dosePerLitre: "0.5 मि.ली. / लीटर", phi: "5 दिन", brands: "कॉन्फिडोर" }
    ]
  },
  {
    id: "tarbooz",
    plant: "तरबूज / खरबूजा",
    en: "Watermelon / Melon",
    type: "सब्जी",
    problems: [
      { pest: "थ्रिप्स व माइट्स", en: "Thrips / Mites", symptoms: "बेल का विकास रुकना, पत्ते मुड़ना।", chemical: "फिप्रोनिल 5% SC", dosePerLitre: "1.5 मि.ली. / लीटर", phi: "7 दिन", brands: "रिजेंट" },
      { pest: "फ्यूजेरियम विल्ट (उकठा)", en: "Fusarium Wilt", symptoms: "हरी-भरी बेल अचानक सूख जाना।", chemical: "ट्राइकोडर्मा (जैविक) जड़ों में दें", dosePerLitre: "10 ग्रा. / लीटर पानी (जमीन में)", phi: "0 दिन", brands: "संजीवनी (ट्राइकोडर्मा)" }
    ]
  },
  {
    id: "beans",
    plant: "बीन्स / ग्वार फली / लोबिया",
    en: "Beans / Cowpea",
    type: "सब्जी",
    problems: [
      { pest: "काली चेपा (ब्लैक एफिड)", en: "Black Aphid", symptoms: "कोमल तनों व फलियों पर काले कीड़ों का झुंड।", chemical: "डाइमेथोएट 30% EC", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "7 दिन", brands: "रोगोर" },
      { pest: "रतुआ (रस्ट)", en: "Rust", symptoms: "पत्तों के नीचे लाल-भूरे पाउडर वाले धब्बे।", chemical: "प्रोपिकोनाज़ोल 25% EC", dosePerLitre: "1 मि.ली. / लीटर पानी", phi: "10 दिन", brands: "टिल्ट" }
    ]
  },

  // ==================== फल (Fruits) ====================
  {
    id: "nimbu",
    plant: "नींबू / संतरा / किन्नू",
    en: "Citrus",
    type: "फल",
    problems: [
      { pest: "लीफ माइनर व सिट्रस सिला", en: "Leaf Miner / Psylla", symptoms: "नए पत्तों में चांदी की सुरंगें, मुड़े पत्ते।", chemical: "इमिडाक्लोरिड 17.8% SL", dosePerLitre: "0.5 मि.ली. / लीटर (नई कोपल पर)", phi: "15 दिन", brands: "कॉन्फिडोर" },
      { pest: "सिट्रस कैंकर (नासूर)", en: "Citrus Canker", symptoms: "पत्तों, टहनियों और फलों पर खुरदरे भूरे/कार्क जैसे धब्बे।", chemical: "कॉपर ऑक्सीक्लोराइड + स्ट्रेप्टोमाइसिन", dosePerLitre: "2.5 ग्रा. + 0.1 ग्रा. / लीटर पानी", phi: "15 दिन", brands: "ब्लाइटॉक्स + प्लांटोमाइसिन" }
    ]
  },
  {
    id: "aam",
    plant: "आम",
    en: "Mango",
    type: "फल",
    problems: [
      { pest: "मैंगो हॉपर (भुनगा)", en: "Mango Hopper", symptoms: "बौर (मांजर) सूखना, कीड़े रस चूसते हैं।", chemical: "थायोमेथोक्सम 25% WG", dosePerLitre: "0.5 ग्रा. / लीटर (बौर आने पर)", phi: "15 दिन", brands: "एकतारा" },
      { pest: "पाउडरी मिल्ड्यू व एंथ्रेक्नोज़", en: "Powdery Mildew", symptoms: "बौर पर सफेद पाउडर — फूल झड़ना।", chemical: "हेक्साकोनाज़ोल 5% EC", dosePerLitre: "2 मि.ली. / लीटर", phi: "15 दिन", brands: "कॉन्टाफ" }
    ]
  },
  {
    id: "amrud",
    plant: "अमरूद",
    en: "Guava",
    type: "फल",
    problems: [
      { pest: "फल मक्खी", en: "Fruit Fly", symptoms: "अमरूद में चुभन, अंदर सफेद कीड़े।", chemical: "मिथाइल यूजेनॉल जाल (पेड़ पर लटकाएं)", dosePerLitre: "रसायन मुक्त ट्रैप", phi: "0 दिन", brands: "फ्रूट फ्लाई ट्रैप" },
      { pest: "मिलीबग (सफेद कीड़ा)", en: "Mealybug", symptoms: "सफेद रुई जैसे चिपचिपे कीड़े तनों व फलों पर।", chemical: "प्रोफेनोफोस 50% EC", dosePerLitre: "2 मि.ली. / लीटर पानी", phi: "10 दिन", brands: "क्यूराक्रॉन" }
    ]
  },
  {
    id: "papeeta",
    plant: "पपीता",
    en: "Papaya",
    type: "फल",
    problems: [
      { pest: "लीफ कर्ल / रिंग स्पॉट वायरस", en: "Ring Spot Virus", symptoms: "पत्ते बुरी तरह सिकुड़ना, फलों पर गोल छल्ले।", chemical: "वाहक (सफेद मक्खी/माहु) हेतु एसिटामिप्रिड 20% SP", dosePerLitre: "0.3 ग्रा. / लीटर पानी", phi: "7 दिन", brands: "मानिक" },
      { pest: "मिलीबग", en: "Mealybug", symptoms: "पत्तों के नीचे सफेद रुईदार कीड़े, फफूंद लगना।", chemical: "नीम ऑयल या बुप्रोफेज़िन 25% SC", dosePerLitre: "5 मि.ली. (नीम) या 1.5 मि.ली. (रसायन) / लीटर", phi: "7 दिन", brands: "नीम / अप्प्लाउड" }
    ]
  },
  {
    id: "anar",
    plant: "अनार",
    en: "Pomegranate",
    type: "फल",
    problems: [
      { pest: "अनार तितली (फल छेदक)", en: "Fruit Borer", symptoms: "फलों में छेद, सड़ांध।", chemical: "क्लोरेंट्रानिलिप्रोल 18.5% SC", dosePerLitre: "0.3 मि.ली. / लीटर", phi: "7 दिन", brands: "कोराजन" },
      { pest: "बैक्टीरियल ब्लाइट (तेल्या)", en: "Bacterial Blight", symptoms: "फलों और पत्तों पर तैलीय, पानी भरे काले धब्बे।", chemical: "कासुगामाइसिन + कॉपर ऑक्सीक्लोराइड", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "15 दिन", brands: "कासु बी / ब्लाइटॉक्स" }
    ]
  },
  {
    id: "kela",
    plant: "केला",
    en: "Banana",
    type: "फल",
    problems: [
      { pest: "बंची टॉप वायरस (गुच्छा रोग)", en: "Bunchy Top", symptoms: "पत्ते छोटे, गुच्छेदार; पौधे का विकास ठप्प। माहु से फैलता है।", chemical: "इमिडाक्लोरिड 17.8% SL (माहु हेतु)", dosePerLitre: "0.5 मि.ली. / लीटर", phi: "15 दिन", brands: "कॉन्फिडोर" },
      { pest: "सिगाटोका (लीफ स्पॉट)", en: "Sigatoka", symptoms: "पत्तियों पर पीले-भूरे धब्बे, पत्ते सूखकर लटकना।", chemical: "कार्बेन्डाज़िम + मैंकोज़ेब", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "10 दिन", brands: "साफ (SAAF)" }
    ]
  },
  {
    id: "chikoo",
    plant: "चीकू",
    en: "Sapota",
    type: "फल",
    problems: [
      { pest: "बीज छेदक (सीड बोरर)", en: "Seed Borer", symptoms: "बाहर से फल ठीक, अंदर सुंडी बीज खाती है।", chemical: "इमामेक्टिन बेंजोएट 5% SG", dosePerLitre: "0.4 ग्रा. / लीटर", phi: "10 दिन", brands: "प्रोक्लेम" },
      { pest: "लीफ वेबर (पत्ता जाला कीट)", en: "Leaf Webber", symptoms: "पत्तियां जाले से चिपकी हुई, अंदर सूंडियां।", chemical: "प्रोफेनोफोस + साइपरमेथ्रिन", dosePerLitre: "1.5 मि.ली. / लीटर पानी", phi: "14 दिन", brands: "रॉकेट" }
    ]
  },
  {
    id: "sitaphal",
    plant: "सीताफल / शरीफा",
    en: "Custard Apple",
    type: "फल",
    problems: [
      { pest: "मिलीबग", en: "Mealybug", symptoms: "फलों के छिलकों की दरारों में सफेद कीड़े।", chemical: "डाइमेथोएट 30% EC + 1ml शैम्पू", dosePerLitre: "2 मि.ली. / लीटर पानी", phi: "15 दिन", brands: "रोगोर" },
      { pest: "फल सड़न", en: "Fruit Rot", symptoms: "फल काले पड़कर पत्थर जैसे हो जाना या सड़ना।", chemical: "कॉपर ऑक्सीक्लोराइड 50% WP", dosePerLitre: "2.5 ग्रा. / लीटर", phi: "10 दिन", brands: "ब्लाइटॉक्स" }
    ]
  },
  {
    id: "ber",
    plant: "बेर",
    en: "Jujube / Ber",
    type: "फल",
    problems: [
      { pest: "फल मक्खी", en: "Fruit Fly", symptoms: "फलों के अंदर कीड़े, फल का गिरना।", chemical: "मैलाथियॉन 50% EC", dosePerLitre: "1.5 मि.ली. / लीटर", phi: "14 दिन", brands: "सिथेल" },
      { pest: "पाउडरी मिल्ड्यू", en: "Powdery Mildew", symptoms: "पत्तों और छोटे फलों पर सफेद पाउडर।", chemical: "डाइफेनोकोनाज़ोल 25% EC", dosePerLitre: "1 मि.ली. / लीटर", phi: "10 दिन", brands: "स्कोर" }
    ]
  },
  {
    id: "angoor",
    plant: "अंगूर",
    en: "Grapes",
    type: "फल",
    problems: [
      { pest: "डाउनी मिल्ड्यू", en: "Downy Mildew", symptoms: "पत्तियों के नीचे सफेद फफूंद, ऊपर पीले धब्बे।", chemical: "मेटालैक्सिल + मैंकोज़ेब", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "14 दिन", brands: "रिडोमिल गोल्ड" },
      { pest: "थ्रिप्स व जस्सीड", en: "Thrips", symptoms: "गुच्छों व पत्तों पर भूरे निशान।", chemical: "थायोमेथोक्सम 25% WG", dosePerLitre: "0.5 ग्रा. / लीटर", phi: "10 दिन", brands: "एकतारा" }
    ]
  },
  {
    id: "anjeer",
    plant: "अंजीर",
    en: "Fig",
    type: "फल",
    problems: [
      { pest: "रतुआ (रस्ट)", en: "Rust", symptoms: "पत्तियों के नीचे छोटे, लाल-भूरे धब्बे।", chemical: "प्रोपिकोनाज़ोल 25% EC", dosePerLitre: "1 मि.ली. / लीटर पानी", phi: "15 दिन", brands: "टिल्ट" },
      { pest: "तना छेदक (स्टेम बोरर)", en: "Stem Borer", symptoms: "तने में छेद, लकड़ी का बुरादा बाहर आना।", chemical: "छेद में मिट्टी का तेल डालकर रुई व कीचड़ से बंद करें", dosePerLitre: "मैलाथियॉन ड्रॉप्स (छेद में)", phi: "-", brands: "-" }
    ]
  },
  {
    id: "strawberry",
    plant: "स्ट्रॉबेरी",
    en: "Strawberry",
    type: "फल",
    problems: [
      { pest: "बोट्राइटिस (ग्रे मोल्ड)", en: "Grey Mold", symptoms: "फलों पर भूरे/स्लेटी रंग की फफूंद।", chemical: "कसुगामाइसिन (Kasugamycin)", dosePerLitre: "1.5 मि.ली. / लीटर", phi: "3 दिन", brands: "कासु बी" },
      { pest: "स्पाइडर माइट", en: "Spider Mite", symptoms: "पत्तियों के नीचे जाले, पौधे पीले पड़ना।", chemical: "स्पाइरोमेसिफेन 22.9% SC", dosePerLitre: "1 मि.ली. / लीटर", phi: "5 दिन", brands: "ओबेरॉन" }
    ]
  },
  {
    id: "jamun",
    plant: "जामुन / शहतूत",
    en: "Jamun / Mulberry",
    type: "फल",
    problems: [
      { pest: "लीफ माइनर व कैटरपिलर", en: "Leaf Miner / Caterpillar", symptoms: "पत्तियों में सफेद लकीरें, जाले।", chemical: "नीम ऑयल या इमामेक्टिन", dosePerLitre: "5 मि.ली (नीम) या 0.4 ग्रा (इमामेक्टिन)", phi: "15 दिन", brands: "प्रोक्लेम" },
      { pest: "सफेद मक्खी (व्हाइटफ्लाई)", en: "Whitefly", symptoms: "काली फफूंद (सूटी मोल्ड) का पत्तों पर जमना।", chemical: "एसिटामिप्रिड 20% SP", dosePerLitre: "0.3 ग्रा. / लीटर", phi: "10 दिन", brands: "मानिक" }
    ]
  },
  {
    id: "seb",
    plant: "सेब (पहाड़ी क्षेत्र)",
    en: "Apple",
    type: "फल",
    problems: [
      { pest: "एप्पल स्कैब", en: "Apple Scab", symptoms: "पत्तों और फलों पर गहरे भूरे, खुरदरे धब्बे।", chemical: "डाइफेनोकोनाज़ोल 25% EC", dosePerLitre: "0.5 मि.ली. / लीटर पानी", phi: "20 दिन", brands: "स्कोर" },
      { pest: "वूली एफिड (रुईदार चेपा)", en: "Woolly Aphid", symptoms: "तनों और जड़ों के पास सफेद रुई जैसे कीड़े।", chemical: "क्लोरोपायरीफोस 20% EC", dosePerLitre: "2 मि.ली. / लीटर (तनों पर)", phi: "20 दिन", brands: "डरमेट" }
    ]
  },
  {
    id: "kathal",
    plant: "कटहल",
    en: "Jackfruit",
    type: "फल",
    problems: [
      { pest: "तना व फल छेदक", en: "Shoot & Fruit Borer", symptoms: "कच्चे फलों व नई टहनियों में छेद, चिपचिपा पदार्थ निकलना।", chemical: "प्रोफेनोफोस 50% EC", dosePerLitre: "2 मि.ली. / लीटर पानी", phi: "15 दिन", brands: "क्यूराक्रॉन" },
      { pest: "फल सड़न (फ्रूट रॉट)", en: "Fruit Rot", symptoms: "छोटे फल काले होकर गिर जाना।", chemical: "कॉपर ऑक्सीक्लोराइड 50% WP", dosePerLitre: "2.5 ग्रा. / लीटर", phi: "10 दिन", brands: "ब्लाइटॉक्स" }
    ]
  },

  // ==================== सजावटी / जड़ी-बूटी (Ornamentals & Herbs) ====================
  {
    id: "gulab",
    plant: "गुलाब",
    en: "Rose",
    type: "सजावटी",
    problems: [
      { pest: "थ्रिप्स व माहु", en: "Thrips / Aphid", symptoms: "कलियां मुड़ना, फूल ठीक से न खिलना।", chemical: "इमिडाक्लोरिड 17.8% SL", dosePerLitre: "0.5 मि.ली. / लीटर पानी", phi: "-", brands: "कॉन्फिडोर" },
      { pest: "ब्लैक स्पॉट (काला धब्बा)", en: "Black Spot", symptoms: "पत्तों पर काले गोल धब्बे, पत्तियां पीली होकर झड़ना।", chemical: "कार्बेन्डाज़िम + मैंकोज़ेब", dosePerLitre: "2.5 ग्रा. / लीटर पानी", phi: "-", brands: "साफ (SAAF)" }
    ]
  },
  {
    id: "tulsi",
    plant: "तुलसी",
    en: "Holy Basil",
    type: "सजावटी",
    problems: [
      { pest: "काले कीड़े (लेस बग / माहु)", en: "Lace Bug / Aphid", symptoms: "पत्तों के नीचे काले/हरे कीड़े, पत्ते पीले-सफेद होना।", chemical: "नीम ऑयल (रसायन का प्रयोग न करें, क्योंकि इसे खाया जाता है)", dosePerLitre: "5 मि.ली. / लीटर पानी (हफ्ते में एक बार)", phi: "0 दिन", brands: "जैविक नीम तेल" },
      { pest: "लीफ स्पॉट", en: "Leaf Spot", symptoms: "पत्तों पर भूरे धब्बे।", chemical: "हल्दी पानी या नीम अर्क का छिड़काव", dosePerLitre: "-", phi: "0 दिन", brands: "घरेलू उपचार" }
    ]
  },
  {
    id: "gudhal",
    plant: "गुड़हल",
    en: "Hibiscus",
    type: "सजावटी",
    problems: [
      { pest: "मिलीबग (सफेद चिपचिपा कीड़ा)", en: "Mealybug", symptoms: "कलियों और तनों पर सफेद रुई का गुच्छा।", chemical: "इमिडाक्लोरिड या 1 चम्मच शैम्पू + नीम ऑयल", dosePerLitre: "0.5 मि.ली. (रसायन) या 5 मि.ली. नीम / लीटर", phi: "-", brands: "कॉन्फिडोर / नीम ऑयल" },
      { pest: "कलियों का गिरना (बड ड्रॉप)", en: "Bud Drop", symptoms: "कलियां बिना खिले पीली होकर गिरना (पोषण या कीट)।", chemical: "माइक्रोन्यूट्रिएंट्स स्प्रे + कीटनाशक", dosePerLitre: "निर्देशानुसार", phi: "-", brands: "एग्रोमिन" }
    ]
  },
  {
    id: "genda",
    plant: "गेंदा",
    en: "Marigold",
    type: "सजावटी",
    problems: [
      { pest: "लाल मकड़ी (रेड माइट)", en: "Red Mite", symptoms: "पत्तों पर लाल जाला, पत्ते सफेद/पीले पड़ना।", chemical: "एबामेक्टिन 1.9% EC या प्रोपरजाइट", dosePerLitre: "1 मि.ली. / लीटर", phi: "-", brands: "ओबेरॉन / ओमाइट" },
      { pest: "बड बोरर (कली छेदक)", en: "Bud Borer", symptoms: "फूलों के अंदर इल्ली।", chemical: "इमामेक्टिन बेंजोएट 5% SG", dosePerLitre: "0.4 ग्रा. / लीटर", phi: "-", brands: "प्रोक्लेम" }
    ]
  },
  {
    id: "aloevera",
    plant: "एलोवेरा (घृतकुमारी)",
    en: "Aloe Vera",
    type: "सजावटी",
    problems: [
      { pest: "रूट रॉट (जड़ गलन)", en: "Root Rot", symptoms: "पत्तियां पिलपिली व आधार से काली/भूरी होना। (अधिक पानी के कारण)", chemical: "पानी कम दें, फफूंदनाशक ट्राइकोडर्मा (जैविक) मिट्टी में मिलाएं", dosePerLitre: "5 ग्रा. / गमले में", phi: "-", brands: "संजीवनी" },
      { pest: "लीफ स्पॉट / रस्ट", en: "Leaf Spot / Rust", symptoms: "पत्तों पर भूरे या काले धब्बे।", chemical: "कॉपर ऑक्सीक्लोराइड 50% WP", dosePerLitre: "2 ग्रा. / लीटर", phi: "15 दिन (खाने से पहले)", brands: "ब्लाइटॉक्स" }
    ]
  },
  {
    id: "chameli",
    plant: "चमेली / मोगरा",
    en: "Jasmine / Mogra",
    type: "सजावटी",
    problems: [
      { pest: "कली छेदक (बड वर्म)", en: "Bud Worm", symptoms: "कलियों में छेद, फूल नहीं खिलना।", chemical: "क्लोरपायरीफोस 20% EC", dosePerLitre: "2 मि.ली. / लीटर", phi: "-", brands: "डरमेट" },
      { pest: "पत्ती खाने वाली इल्ली", en: "Leaf Roller", symptoms: "पत्तियां एक-दूसरे से जुड़ी हुई जाले में।", chemical: "प्रोफेनोफोस + साइपरमेथ्रिन", dosePerLitre: "1.5 मि.ली. / लीटर", phi: "-", brands: "रॉकेट" }
    ]
  },
  {
    id: "moneyplant",
    plant: "मनी प्लांट",
    en: "Money Plant",
    type: "सजावटी",
    problems: [
      { pest: "रूट रॉट / पीली पत्तियां", en: "Root Rot", symptoms: "अत्यधिक पानी से जड़ सड़ना, पत्तियां पीली होना।", chemical: "पानी कम करें। बाविस्टिन (कार्बेन्डाज़िम) जड़ों में दें।", dosePerLitre: "1 ग्रा. / लीटर (गमले में डालें)", phi: "-", brands: "बाविस्टिन" },
      { pest: "स्केल कीड़े / मिलीबग", en: "Scale / Mealybug", symptoms: "तने और पत्तों पर भूरे चिपके हुए धब्बे।", chemical: "नीम ऑयल + तरल साबुन से पोंछें", dosePerLitre: "5 मि.ली. / लीटर", phi: "-", brands: "-" }
    ]
  },
  {
    id: "bougainvillea",
    plant: "बोगनविलिया",
    en: "Bougainvillea",
    type: "सजावटी",
    problems: [
      { pest: "लीफ माइनर / एफिड", en: "Aphid / Miner", symptoms: "पत्ते मुड़ना, फूल कम आना।", chemical: "इमिडाक्लोरिड 17.8% SL", dosePerLitre: "0.5 मि.ली. / लीटर पानी", phi: "-", brands: "कॉन्फिडोर" },
      { pest: "पत्तों का पीलापन", en: "Chlorosis", symptoms: "नसें हरी, बाकी पत्ता पीला (सूक्ष्म पोषक तत्वों की कमी)।", chemical: "जिंक/आयरन सल्फेट या माइक्रोन्यूट्रिएंट स्प्रे", dosePerLitre: "2 ग्रा. / लीटर", phi: "-", brands: "एग्रोमिन" }
    ]
  },
  {
    id: "kadi_patta",
    plant: "कड़ी पत्ता (मीठा नीम)",
    en: "Curry Leaves",
    type: "सजावटी",
    problems: [
      { pest: "सिट्रस सिला / स्केल कीट", en: "Citrus Psylla / Scale", symptoms: "पत्तों पर चिपचिपे भूरे कीड़े, पत्तों का आकार बिगड़ना।", chemical: "नीम ऑयल (केमिकल से बचें क्योंकि पत्ते रसोई में उपयोग होते हैं)", dosePerLitre: "5 मि.ली. / लीटर", phi: "1-2 दिन", brands: "जैविक नीम" },
      { pest: "लीफ स्पॉट", en: "Leaf Spot", symptoms: "पत्तों पर भूरे-काले धब्बे।", chemical: "खट्टी छाछ (जैविक फफूंदनाशक) का स्प्रे", dosePerLitre: "1 कप / लीटर पानी", phi: "0 दिन", brands: "घरेलू उपचार" }
    ]
  },
  {
    id: "palm",
    plant: "पाम / साइकस",
    en: "Palm / Cycas",
    type: "सजावटी",
    problems: [
      { pest: "स्केल कीट (Scale Insects)", en: "Scale", symptoms: "पत्तों के पीछे सफेद/भूरे सख्त खुरदरे धब्बे।", chemical: "डाइमेथोएट 30% EC", dosePerLitre: "2 मि.ली. / लीटर", phi: "-", brands: "रोगोर" },
      { pest: "लीफ ब्लाइट (पत्ती झुलसना)", en: "Leaf Blight", symptoms: "पत्तियों के सिरे (Tips) भूरे होकर सूखना।", chemical: "कॉपर ऑक्सीक्लोराइड 50% WP", dosePerLitre: "2.5 ग्रा. / लीटर", phi: "-", brands: "ब्लाइटॉक्स" }
    ]
  },
  {
    id: "guldaudi",
    plant: "गुलदाउदी (क्राइसेंथेमम)",
    en: "Chrysanthemum",
    type: "सजावटी",
    problems: [
      { pest: "माहु (चेपा)", en: "Aphids", symptoms: "कलियों पर काले/हरे कीड़ों का भारी झुंड।", chemical: "एसिटामिप्रिड 20% SP", dosePerLitre: "0.3 ग्रा. / लीटर", phi: "-", brands: "मानिक" },
      { pest: "विल्ट (उकठा)", en: "Wilt", symptoms: "पौधा अचानक मुरझा कर सूख जाना।", chemical: "कार्बेन्डाज़िम 50% WP (ड्रेन्चिंग - मिट्टी में दें)", dosePerLitre: "2 ग्रा. / लीटर (गमले में)", phi: "-", brands: "बाविस्टिन" }
    ]
  }
];

export const HOMECARE_TIPS = [
  { title: "पहले पहचान, फिर दवा", desc: "कीट/रोग की सही पहचान के बिना दवा न डालें — फोटो लेकर दुकान पर दिखाएं, सही सलाह मिलेगी।" },
  { title: "छोटी मात्रा, सही मात्रा", desc: "घर के लिए हमेशा लीटर के हिसाब से मात्रा मापें — ज्यादा गाढ़ी दवा पत्तों को झुलसा देती है।" },
  { title: "सुबह या शाम छिड़काव", desc: "धूप तेज होने पर छिड़काव न करें — दवा उड़ जाती है व पत्ते जल सकते हैं।" },
  { title: "कटाई से पहले ठहराव (PHI)", desc: "सब्जी/फल तोड़ने से पहले लिखित दिनों का (PHI) गैप जरूर रखें; तोड़कर अच्छी तरह धो लें।" },
  { title: "बच्चों से दूर", desc: "दवाई की बोतलें बच्चों व पालतू जानवरों की पहुंच से दूर, ऊंचे स्थान पर रखें।" },
  { title: "नीम का विकल्प", desc: "हल्के संक्रमण में नीम ऑयल 5 मि.ली./लीटर + 2-3 बूंद तरल साबुन — जैविक प्रथम विकल्प (साप्ताहिक छिड़काव)।" },
  { title: "खाद्य पौधों पर सुरक्षा", desc: "कड़ी पत्ता, तुलसी, पुदीना जैसी रोजमर्रा की जड़ी-बूटियों पर जहरीले रसायनों के बजाय नीम या खट्टी छाछ का प्रयोग करें।" }
];