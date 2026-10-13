import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { waLink } from "../data/content";
import { Icon, Reveal } from "../components/Shared";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Search,
  Download,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  BookOpen,
  FileText,
  Lock,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

// ============================================
// INTERFACES
// ============================================
interface StudentData {
  id?: string;
  login_id: string;
  name: string;
  password: string;
  pdf_url: string;
  course_days?: number;
  course_level?: string;
  phone?: string;
  email?: string;
  address?: string;
  enrollment_date?: string;
  certificate_issued?: boolean;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface StudentsPageProps {
  userRole?: "admin" | "farmer" | "guest" | null;
}

// ============================================
// INITIAL FORM STATE - Har field empty/default
// ============================================
const EMPTY_FORM: StudentData = {
  login_id: "",
  name: "",
  password: "",
  pdf_url: "/certificates/",
  course_days: 30,
  course_level: "Foundation",
  phone: "",
  email: "",
  address: "",
  enrollment_date: new Date().toISOString().split("T")[0],
  certificate_issued: false,
  status: "active",
  notes: "",
};

// ============================================
// COURSE DURATIONS DATA
// ============================================
const COURSE_DURATIONS = [
  {
    days: 15,
    level: "Basic Level",
    fee: "₹1,500/-",
    protection: [
      "खेत में जाकर मुख्य कीटों की लाइव पहचान",
      "फंगल व बैक्टीरियल बीमारियों को खेत में देखना",
      "दवाइयों के लेबल पढ़ना व सुरक्षा",
      "स्प्रे पंप की सेटिंग और नोजल का उपयोग",
    ],
    sales: [
      "दुकान पर असली किसानों से बातचीत",
      "कीटनाशकों का स्टॉक समझना",
      "काउंटर पर प्रोडक्ट निकालने की ट्रेनिंग",
    ],
  },
  {
    days: 30,
    level: "Foundation",
    fee: "₹2,500/-",
    protection: [
      "15 Days के सभी टॉपिक + IPM लागू करना",
      "बीज उपचार (Seed Treatment) अपने हाथों से करना",
      "बायो-पेस्टीसाइड्स का घोल बनाना",
      "रोग आने से पहले की रोकथाम",
    ],
    sales: [
      "स्टॉक रजिस्टर मेन्टेन करना",
      "किसानों के साथ फील्ड मीटिंग",
      "Tank Mix (दवाई का कॉम्बिनेशन) समझाना",
      "बिलिंग सॉफ्टवेयर की ट्रेनिंग",
    ],
  },
  {
    days: 45,
    level: "Advanced",
    fee: "₹4,000/-",
    protection: [
      "30 Days के टॉपिक + रेजिस्टेंस मैनेजमेंट",
      "बागवानी (सब्जियां व फल) के लाइव केस स्टडी",
      "PGR और माइक्रोन्यूट्रिएंट्स का डोज़",
      "ड्रोन स्प्रे (Drone Spraying) की जानकारी",
    ],
    sales: [
      "टेरिटरी मैनेजमेंट (किस गांव में क्या बिकेगी)",
      "'उधार' (Credit) मैनेजमेंट",
      "कंपनियों के डिस्ट्रीब्यूटर से बातचीत",
      "लाइसेंस का पूरा प्रोसेस",
    ],
  },
  {
    days: 60,
    level: "Professional",
    fee: "₹5,500/-",
    protection: [
      "45 Days के टॉपिक + ऑर्गेनिक फार्मिंग",
      "लाइव डायग्नोसिस कैंप (Farmer Clinic)",
      "फसल नुकसान (Crop Loss) असेसमेंट",
      "मंडी क्वालिटी विश्लेषण",
    ],
    sales: [
      "खुद की दुकान/एग्री-क्लीनिक का सेटअप",
      "किसानों का CRM और व्हाट्सएप मार्केटिंग",
      "सेल्स टीम को लीड करना",
      "फाइनल लाइव टेस्ट (दुकान पर हैंडलिंग)",
    ],
  },
];

const COURSE_LEVELS = [
  { days: 15, level: "Basic Level" },
  { days: 30, level: "Foundation" },
  { days: 45, level: "Advanced" },
  { days: 60, level: "Professional" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active (चालू)", color: "bg-green-100 text-green-700" },
  { value: "completed", label: "Completed (पूरा)", color: "bg-blue-100 text-blue-700" },
  { value: "dropped", label: "Dropped (छोड़ा)", color: "bg-red-100 text-red-700" },
];

// ============================================
// MAIN COMPONENT
// ============================================
export const StudentsPage: React.FC<StudentsPageProps> = ({ userRole }) => {
  // Course Selection
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const activeCourse =
    COURSE_DURATIONS.find((c) => c.days === selectedDuration) || COURSE_DURATIONS[1];

  // Student Login States
  const [step, setStep] = useState<"LOGIN" | "CERTIFICATE">("LOGIN");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loggedInStudent, setLoggedInStudent] = useState<StudentData | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Admin States
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StudentData>({ ...EMPTY_FORM });
  const [searchQuery, setSearchQuery] = useState("");
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "course" | "extra">("basic");

  // ============================================
  // FETCH STUDENTS (Admin)
  // ============================================
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setStudents(data);
      } else if (error) {
        console.error("Fetch error:", error.message);
      }
    } catch (err) {
      console.error("Fetch exception:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userRole === "admin") {
      fetchStudents();
    }
  }, [userRole, fetchStudents]);

  // ============================================
  // STUDENT LOGIN
  // ============================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);

    const cleanId = loginId.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .or(`login_id.eq.${cleanId},login_id.eq.${loginId.trim()}`)
        .eq("password", password)
        .maybeSingle();

      if (error || !data) {
        setLoginError("गलत ID या Password! सही Gmail / Mobile + Password डालें।");
        setIsLoading(false);
        return;
      }

      setLoggedInStudent(data);
      setStep("CERTIFICATE");
    } catch {
      setLoginError("लॉगिन में समस्या आई। कृपया दोबारा कोशिश करें।");
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setLoggedInStudent(null);
    setStep("LOGIN");
    setLoginId("");
    setPassword("");
    setLoginError("");
  };

  // ============================================
  // ADMIN: OPEN MODAL (New / Edit)
  // ============================================
  const openModal = (student?: StudentData) => {
    // Reset message and tab
    setSaveMessage(null);
    setActiveTab("basic");
    setShowFormPassword(false);

    if (student && student.id) {
      // ===== EDIT MODE =====
      // Har ek field ko existing data se fill karo
      setEditingId(student.id);
      setFormData({
        login_id: student.login_id || "",
        name: student.name || "",
        password: student.password || "",
        pdf_url: student.pdf_url || "/certificates/",
        course_days: student.course_days ?? 30,
        course_level: student.course_level || "Foundation",
        phone: student.phone || "",
        email: student.email || "",
        address: student.address || "",
        enrollment_date:
          student.enrollment_date ||
          new Date().toISOString().split("T")[0],
        certificate_issued: student.certificate_issued ?? false,
        status: student.status || "active",
        notes: student.notes || "",
      });
    } else {
      // ===== NEW STUDENT MODE =====
      // Sab fields empty/default rakho + auto password
      setEditingId(null);
      setFormData({
        ...EMPTY_FORM,
        password: generatePassword(),
        enrollment_date: new Date().toISOString().split("T")[0],
      });
    }
    setIsModalOpen(true);
  };

  // Auto generate random password
  const generatePassword = (): string => {
    const chars = "abcdefghijkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // ============================================
  // ADMIN: HANDLE FORM FIELD CHANGE
  // ============================================
  const handleFieldChange = (
    field: keyof StudentData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-sync course_level jab course_days badle
      if (field === "course_days") {
        const match = COURSE_LEVELS.find((c) => c.days === Number(value));
        if (match) {
          updated.course_level = match.level;
        }
      }

      // Auto-sync course_days jab course_level badle
      if (field === "course_level") {
        const match = COURSE_LEVELS.find((c) => c.level === value);
        if (match) {
          updated.course_days = match.days;
        }
      }

      return updated;
    });
  };

  // ============================================
  // ADMIN: SAVE STUDENT (Create / Update)
  // ============================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveMessage(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setSaveMessage({ type: "error", text: "Student का नाम डालें!" });
      setLoading(false);
      return;
    }
    if (!formData.login_id.trim()) {
      setSaveMessage({
        type: "error",
        text: "Login ID (Mobile/Gmail) डालें!",
      });
      setLoading(false);
      return;
    }
    if (!formData.password.trim()) {
      setSaveMessage({ type: "error", text: "Password डालें!" });
      setLoading(false);
      return;
    }

    // Prepare data object
    const saveData = {
      login_id: formData.login_id.trim().toLowerCase(),
      name: formData.name.trim(),
      password: formData.password,
      pdf_url: formData.pdf_url.trim() || "/certificates/",
      course_days: formData.course_days ?? 30,
      course_level: formData.course_level || "Foundation",
      phone: formData.phone?.trim() || "",
      email: formData.email?.trim() || "",
      address: formData.address?.trim() || "",
      enrollment_date:
        formData.enrollment_date ||
        new Date().toISOString().split("T")[0],
      certificate_issued: formData.certificate_issued ?? false,
      status: formData.status || "active",
      notes: formData.notes?.trim() || "",
    };

    try {
      if (editingId) {
        // ===== UPDATE =====
        const { error } = await supabase
          .from("students")
          .update(saveData)
          .eq("id", editingId);

        if (error) throw error;

        setSaveMessage({
          type: "success",
          text: `✅ "${saveData.name}" सफलतापूर्वक अपडेट हो गया!`,
        });
      } else {
        // ===== INSERT =====
        const { error } = await supabase
          .from("students")
          .insert([saveData]);

        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            throw new Error(
              `Login ID "${saveData.login_id}" पहले से मौजूद है! दूसरी ID डालें।`
            );
          }
          throw error;
        }

        setSaveMessage({
          type: "success",
          text: `✅ "${saveData.name}" सफलतापूर्वक जोड़ा गया!`,
        });
      }

      // Refresh list
      await fetchStudents();

      // Close modal after short delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSaveMessage(null);
      }, 1500);
    } catch (err: any) {
      setSaveMessage({
        type: "error",
        text: `❌ Error: ${err.message || "कुछ गलत हो गया"}`,
      });
    }
    setLoading(false);
  };

  // ============================================
  // ADMIN: DELETE STUDENT
  // ============================================
  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `क्या आप "${name}" को हटाना चाहते हैं?\n\nयह कार्य वापस नहीं होगा!`
      )
    )
      return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchStudents();
    } catch (err: any) {
      alert("Delete Error: " + err.message);
    }
    setLoading(false);
  };

  // ============================================
  // FILTERED STUDENTS (Search)
  // ============================================
  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.login_id.toLowerCase().includes(q) ||
      (s.phone || "").includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.course_level || "").toLowerCase().includes(q) ||
      (s.status || "").toLowerCase().includes(q)
    );
  });

  // Status badge
  const getStatusBadge = (status?: string) => {
    const found = STATUS_OPTIONS.find((s) => s.value === status);
    if (!found)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
          Unknown
        </span>
      );
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-bold ${found.color}`}
      >
        {found.label}
      </span>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 selection:bg-blue-200">
      {/* ===== HERO SECTION ===== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="absolute inset-0 bg-[url('/images/sarson.jpg')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-5 relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-sm font-bold tracking-widest uppercase mb-4 border border-blue-400/30 backdrop-blur-md">
            <Icon name="GraduationCap" size={16} /> Students Corner
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            प्रैक्टिकल ट्रेनिंग व{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
              सर्टिफिकेट
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-blue-100/80 leading-relaxed font-medium">
            कृषि छात्रों के लिए सतगुरु बीज भंडार द्वारा डिज़ाइन किया गया 100%
            फील्ड कोर्स।
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
        {/* ===== ADMIN PANEL ===== */}
        {userRole === "admin" && (
          <div className="mb-10 p-5 md:p-6 bg-amber-50 border border-amber-200 rounded-2xl">
            {/* Admin Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-lg">
                <ShieldCheck size={22} />
                Admin Panel: Students Management
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchStudents}
                  className="p-2.5 bg-white border border-amber-300 rounded-xl hover:bg-amber-100 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin text-amber-600" : "text-amber-700"}
                  />
                </button>
                <button
                  onClick={() => openModal()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-amber-600/20"
                >
                  <Plus size={16} /> नया Student जोड़ें
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400"
              />
              <input
                type="text"
                placeholder="नाम, मोबाइल, ईमेल, कोर्स या स्टेटस से खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Student Count */}
            <div className="mb-3 text-xs text-amber-700 font-medium">
              कुल: {students.length} Students
              {searchQuery && ` | दिखा रहे: ${filteredStudents.length}`}
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
              <table className="w-full text-sm text-left">
                <thead className="bg-amber-100/80 text-amber-900">
                  <tr>
                    <th className="p-3 font-bold">Name</th>
                    <th className="p-3 font-bold">Login ID</th>
                    <th className="p-3 font-bold">Password</th>
                    <th className="p-3 font-bold">Phone</th>
                    <th className="p-3 font-bold">Course</th>
                    <th className="p-3 font-bold">Status</th>
                    <th className="p-3 font-bold">Certificate</th>
                    <th className="p-3 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-amber-50 hover:bg-amber-50/50 transition-colors"
                    >
                      <td className="p-3 font-semibold text-slate-800">
                        {s.name}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600">
                        {s.login_id}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {s.password}
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        {s.phone || "—"}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          {s.course_days || 30}D - {s.course_level || "Foundation"}
                        </span>
                      </td>
                      <td className="p-3">{getStatusBadge(s.status)}</td>
                      <td className="p-3 text-center">
                        {s.certificate_issued ? (
                          <CheckCircle
                            size={16}
                            className="text-green-500 mx-auto"
                          />
                        ) : (
                          <X size={16} className="text-slate-300 mx-auto" />
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => openModal(s)}
                            className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id!, s.name)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-slate-400"
                      >
                        {searchQuery
                          ? `"${searchQuery}" से कोई Student नहीं मिला`
                          : 'अभी कोई Student नहीं है। "नया Student जोड़ें" दबाएं।'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== COURSE HIGHLIGHTS ===== */}
        <Reveal>
          <div className="text-center mb-12">
            <span className="inline-block py-1.5 px-4 rounded-full bg-blue-100 text-blue-700 font-bold text-xs tracking-widest uppercase mb-4">
              <Icon name="Award" size={14} className="inline mr-1" /> Designed
              by Satguru Beej Bhandar
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">
              100% Practical Course in <br />
              <span className="text-blue-600">
                Crop Protection & Agri Sales
              </span>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <span className="px-5 py-2.5 bg-white shadow-sm border border-slate-200 text-slate-600 font-bold text-sm rounded-xl">
                ❌ कोई किताबी ज्ञान नहीं
              </span>
              <span className="px-5 py-2.5 bg-green-50 shadow-sm border border-green-200 text-green-700 font-bold text-sm rounded-xl">
                ✅ सीधे खेतों में ट्रेनिंग
              </span>
              <span className="px-5 py-2.5 bg-indigo-50 shadow-sm border border-indigo-200 text-indigo-700 font-bold text-sm rounded-xl">
                ✅ काउंटर पर लाइव प्रैक्टिस
              </span>
            </div>
          </div>
        </Reveal>

        {/* ===== SYLLABUS TABS ===== */}
        <Reveal className="mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap md:flex-nowrap gap-2 max-w-4xl mx-auto">
            {COURSE_DURATIONS.map((c) => (
              <button
                key={c.days}
                onClick={() => setSelectedDuration(c.days)}
                className={`flex-1 relative overflow-hidden rounded-xl py-4 px-2 text-center transition-all duration-300 ${
                  selectedDuration === c.days
                    ? "bg-blue-600 text-white font-bold shadow-md scale-[1.02]"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium"
                }`}
              >
                <span className="block text-xl md:text-2xl font-black mb-1">
                  {c.days} Days
                </span>
                <span className="text-[10px] md:text-xs uppercase tracking-wider block opacity-90">
                  {c.level}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* ===== SYLLABUS CONTENT ===== */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDuration}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid lg:grid-cols-12 gap-6 items-start mb-20 max-w-6xl mx-auto"
          >
            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm h-full">
                <h3 className="text-2xl font-black text-slate-800 mb-6 pb-4 border-b border-slate-100">
                  {activeCourse.days} दिनों का प्रैक्टिकल सिलेबस
                </h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-green-600 mb-4 flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                      <Icon name="Sprout" size={18} /> फील्ड में फसल सुरक्षा
                    </h4>
                    <ul className="space-y-3">
                      {activeCourse.protection.map((item, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm text-slate-600 font-medium"
                        >
                          <Icon
                            name="CheckCircle2"
                            size={18}
                            className="text-green-500 shrink-0"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-600 mb-4 flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg">
                      <Icon name="Store" size={18} /> व्यापार ज्ञान (Agri Sales)
                    </h4>
                    <ul className="space-y-3">
                      {activeCourse.sales.map((item, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm text-slate-600 font-medium"
                        >
                          <Icon
                            name="CheckCircle2"
                            size={18}
                            className="text-indigo-500 shrink-0"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6 h-full">
              <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-8 shadow-xl text-center relative overflow-hidden h-full flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <h4 className="text-sm uppercase tracking-widest text-blue-200 font-bold mb-3">
                  कोर्स की फीस
                </h4>
                <span className="text-5xl font-black text-white drop-shadow-md">
                  {activeCourse.fee}
                </span>
                <p className="text-xs text-blue-100/70 mt-4 mb-8 font-medium">
                  (प्रैक्टिकल ट्रेनिंग, फील्ड विजिट और सर्टिफिकेट शामिल है)
                </p>
                <a
                  href={waLink(
                    `नमस्ते! मैं ${activeCourse.days} Days की ट्रेनिंग लेना चाहता हूँ।`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 mt-auto"
                >
                  <Icon name="MessageCircle" size={18} /> एडमिशन हेतु मैसेज करें
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ===== CONTACT + CERTIFICATE LOGIN ===== */}
        <Reveal className="mb-24">
          <div className="grid lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
            {/* LEFT: CONTACT */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6 justify-center shadow-lg shadow-blue-900/5 h-full min-h-[300px]">
              <div className="w-24 h-24 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 rotate-3">
                <Icon name="Headphones" size={40} />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm text-slate-500 font-bold mb-1 uppercase tracking-wider">
                  ट्रेनिंग संपर्क
                </p>
                <h3 className="text-2xl font-black text-slate-800 mb-4">
                  Deepanshu Verma
                </h3>
                <a
                  href="tel:+917494968080"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <Icon name="PhoneCall" size={20} /> 74949 68080
                </a>
              </div>
            </div>

            {/* RIGHT: CERTIFICATE LOGIN */}
            <div className="rounded-3xl bg-white p-6 md:p-8 shadow-2xl shadow-blue-900/10 border border-slate-100 min-h-[300px] flex flex-col justify-center">
              {step === "LOGIN" && (
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                    <Icon name="UserCheck" size={28} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800 mb-1">
                    सर्टिफिकेट डाउनलोड करें
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium">
                    अपना Gmail या मोबाइल नंबर और पासवर्ड डालें
                  </p>

                  <form
                    onSubmit={handleLogin}
                    className="flex flex-col gap-3 max-w-sm mx-auto"
                  >
                    <input
                      type="text"
                      placeholder="Gmail या मोबाइल नंबर"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none text-center font-bold text-base transition-all"
                      required
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="पासवर्ड"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none text-center font-bold text-base transition-all pr-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    {loginError && (
                      <p className="text-red-500 text-sm font-bold bg-red-50 py-2 rounded-lg">
                        {loginError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || !loginId || !password}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          जाँच हो रही है...
                        </>
                      ) : (
                        <>
                          लॉगिन करें{" "}
                          <Icon name="ArrowRight" size={18} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {step === "CERTIFICATE" && loggedInStudent && (
                <div className="w-full text-center">
                  <div className="mx-auto w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                    <Icon name="CheckCircle2" size={28} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800 mb-1">
                    🎉 बधाई हो, {loggedInStudent.name}!
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium">
                    आपका सर्टिफिकेट तैयार है
                  </p>

                  <div className="flex flex-col gap-3 max-w-sm mx-auto">
                    <a
                      href={loggedInStudent.pdf_url}
                      download
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md flex justify-center items-center gap-2 transition-all"
                    >
                      <Download size={18} /> PDF डाउनलोड करें
                    </a>
                    <a
                      href={loggedInStudent.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex justify-center items-center gap-2 transition-all"
                    >
                      नई Tab में खोलें
                    </a>
                    <button
                      onClick={handleLogout}
                      className="w-full py-2 text-red-500 hover:text-red-600 text-sm font-bold transition-all"
                    >
                      लॉगआउट
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ===== ADMIN ADD/EDIT MODAL ===== */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/80">
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  {editingId ? (
                    <>
                      <Edit2 size={18} className="text-amber-600" />
                      Student Edit करें
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="text-green-600" />
                      नया Student जोड़ें
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 bg-white">
                {[
                  {
                    id: "basic" as const,
                    label: "मूल जानकारी",
                    icon: <User size={14} />,
                  },
                  {
                    id: "course" as const,
                    label: "कोर्स डिटेल",
                    icon: <BookOpen size={14} />,
                  },
                  {
                    id: "extra" as const,
                    label: "अतिरिक्त",
                    icon: <FileText size={14} />,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600 bg-blue-50/50"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Body - Scrollable */}
              <form
                onSubmit={handleSave}
                className="flex-1 overflow-y-auto"
              >
                <div className="p-5 space-y-4">
                  {/* ===== TAB: BASIC INFO ===== */}
                  {activeTab === "basic" && (
                    <>
                      {/* Name */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <User size={13} /> Student का नाम *
                        </label>
                        <input
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="पूरा नाम लिखें"
                          value={formData.name}
                          onChange={(e) =>
                            handleFieldChange("name", e.target.value)
                          }
                          required
                        />
                      </div>

                      {/* Login ID */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Mail size={13} /> Login ID (Mobile / Gmail) *
                        </label>
                        <input
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="7494968080 या email@gmail.com"
                          value={formData.login_id}
                          onChange={(e) =>
                            handleFieldChange("login_id", e.target.value)
                          }
                          required
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          यही ID Student लॉगिन में use करेगा
                        </p>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Lock size={13} /> Password *
                        </label>
                        <div className="relative">
                          <input
                            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors pr-24"
                            placeholder="Password"
                            type={showFormPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) =>
                              handleFieldChange("password", e.target.value)
                            }
                            required
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setShowFormPassword(!showFormPassword)
                              }
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                              title={showFormPassword ? "Hide" : "Show"}
                            >
                              {showFormPassword ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleFieldChange(
                                  "password",
                                  generatePassword()
                                )
                              }
                              className="p-1.5 text-blue-500 hover:text-blue-700 rounded"
                              title="Auto Generate"
                            >
                              <RefreshCw size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Phone size={13} /> Phone नंबर
                        </label>
                        <input
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="मोबाइल नंबर"
                          value={formData.phone || ""}
                          onChange={(e) =>
                            handleFieldChange("phone", e.target.value)
                          }
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Mail size={13} /> Email
                        </label>
                        <input
                          type="email"
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="email@example.com"
                          value={formData.email || ""}
                          onChange={(e) =>
                            handleFieldChange("email", e.target.value)
                          }
                        />
                      </div>

                      {/* Address */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <MapPin size={13} /> पता (Address)
                        </label>
                        <input
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="गांव/शहर, जिला, राज्य"
                          value={formData.address || ""}
                          onChange={(e) =>
                            handleFieldChange("address", e.target.value)
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* ===== TAB: COURSE DETAILS ===== */}
                  {activeTab === "course" && (
                    <>
                      {/* Course Days */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Calendar size={13} /> Course Duration (Days)
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {COURSE_LEVELS.map((c) => (
                            <button
                              type="button"
                              key={c.days}
                              onClick={() =>
                                handleFieldChange("course_days", c.days)
                              }
                              className={`py-3 px-2 rounded-xl text-center transition-all border-2 ${
                                formData.course_days === c.days
                                  ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                              }`}
                            >
                              <span className="block text-lg font-black">
                                {c.days}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider">
                                {c.level}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Course Level (auto filled) */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <BookOpen size={13} /> Course Level
                        </label>
                        <select
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-colors bg-white appearance-none"
                          value={formData.course_level || "Foundation"}
                          onChange={(e) =>
                            handleFieldChange("course_level", e.target.value)
                          }
                        >
                          {COURSE_LEVELS.map((c) => (
                            <option key={c.level} value={c.level}>
                              {c.level} ({c.days} Days)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Enrollment Date */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <Calendar size={13} /> Enrollment Date
                        </label>
                        <input
                          type="date"
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-colors"
                          value={formData.enrollment_date || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              "enrollment_date",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <ChevronDown size={13} /> Status
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() =>
                                handleFieldChange("status", opt.value)
                              }
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all border-2 ${
                                formData.status === opt.value
                                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Certificate Issued */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <CheckCircle size={13} /> Certificate जारी किया?
                        </label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldChange("certificate_issued", true)
                            }
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${
                              formData.certificate_issued
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-slate-200 text-slate-400"
                            }`}
                          >
                            <CheckCircle size={16} /> हां, दे दिया
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldChange("certificate_issued", false)
                            }
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${
                              !formData.certificate_issued
                                ? "border-red-400 bg-red-50 text-red-600"
                                : "border-slate-200 text-slate-400"
                            }`}
                          >
                            <X size={16} /> नहीं, अभी नहीं
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ===== TAB: EXTRA ===== */}
                  {activeTab === "extra" && (
                    <>
                      {/* PDF URL */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <FileText size={13} /> Certificate PDF URL / Path *
                        </label>
                        <input
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none transition-colors"
                          placeholder="/certificates/student-name.pdf"
                          value={formData.pdf_url}
                          onChange={(e) =>
                            handleFieldChange("pdf_url", e.target.value)
                          }
                          required
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Public folder ya Supabase Storage URL डालें
                        </p>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5">
                          <FileText size={13} /> नोट्स / टिप्पणी
                        </label>
                        <textarea
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors resize-none"
                          placeholder="कोई भी extra जानकारी लिखें..."
                          rows={4}
                          value={formData.notes || ""}
                          onChange={(e) =>
                            handleFieldChange("notes", e.target.value)
                          }
                        />
                      </div>

                      {/* Preview: All Data Summary */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          📋 Data Summary (Preview)
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Name:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.name || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Login:</span>{" "}
                            <span className="font-mono font-bold text-slate-700">
                              {formData.login_id || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Phone:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.phone || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Email:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.email || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Address:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.address || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Course:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.course_days}D -{" "}
                              {formData.course_level}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Status:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Certificate:</span>{" "}
                            <span className="font-bold text-slate-700">
                              {formData.certificate_issued ? "✅" : "❌"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">PDF:</span>{" "}
                            <span className="font-mono font-bold text-slate-700 break-all">
                              {formData.pdf_url || "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Save Message */}
                {saveMessage && (
                  <div
                    className={`mx-5 mb-3 p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
                      saveMessage.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {saveMessage.type === "success" ? (
                      <CheckCircle size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    {saveMessage.text}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-600/20"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        सेव हो रहा है...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        {editingId ? "अपडेट करें" : "सेव करें"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};