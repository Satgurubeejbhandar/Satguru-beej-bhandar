// src/App.tsx
import { useCallback, useEffect, useState, ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Toaster } from 'react-hot-toast'
import { Phone } from 'lucide-react'

import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { ScrollToTop } from './components/Shared'
import { type PageKey } from './data/content'

// Public Pages
import { HomePage } from './pages/Home'
import { ProductsPage } from './pages/Products'
import { CropsPage } from './pages/Crops'
import { MedicineInfo } from './pages/MedicineInfo'
import { DiseasePage } from './pages/Disease'
import { WeedsPage } from './pages/Weeds'
import { HomeCarePage } from './pages/HomeCare'
import { MandiPage } from './pages/Mandi'
import { MspPage } from './pages/Msp'
import { SchemesPage } from './pages/Schemes'
import { StudentsPage } from './pages/Students'
import Youtube from './pages/Youtube'
import Facebook from './pages/Facebook'
import UdhaarPublic from './pages/UdhaarPublic'
import LoginPage from './pages/LoginPage'
import FarmerPortal from './pages/FarmerPortal'

// Core Admin Pages (Static Import for immediate load)
import AdminLayout from './layouts/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import FarmersMaster from './pages/admin/FarmersMaster'
import GroupUdhaarMaster from './pages/admin/GroupUdhaarMaster'
import CompanyMaster from './pages/admin/CompanyMaster'
import ProductMaster from './pages/admin/ProductMaster'
import SaraSamanInventory from './pages/admin/SaraSamanInventory'
import PurchaseStockIn from './pages/admin/PurchaseStockIn'
import BatchLotManager from './pages/admin/BatchLotManager'
import BillingPOS from './pages/admin/BillingPOS'
import PaymentEntry from './pages/admin/PaymentEntry'
import FarmerLedgerView from './pages/admin/FarmerLedgerView'
import DataResetTool from './pages/admin/DataResetTool'
import BankAccountsMaster from './pages/admin/BankAccountsMaster'
import CompanyPurchaseReturn from './pages/admin/CompanyPurchaseReturn'

/* Safe loader: file ho to load, na ho to placeholder */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 bg-white rounded-2xl border shadow-sm max-w-2xl mx-auto mt-10">
      <h1 className="text-xl font-bold text-emerald-900">{title}</h1>
      <p className="text-gray-500 text-sm mt-2">
        यह मॉड्यूल लेआउट में सेट है। अगर यह पेज नहीं खुल रहा है, तो इसका मतलब है कि फ़ाइल:
        <code className="block mt-2 text-xs bg-slate-100 p-2 rounded text-rose-600 font-mono">
          src/pages/admin/...
        </code>
        अभी तक बनाई या लिंक नहीं की गई है।
      </p>
      <p className="text-xs text-emerald-800 font-bold mt-3">
        Core system (Farmers, Bills, Stock, Payments) सुरक्षित है और चल रहा है।
      </p>
    </div>
  )
}

function lazyPage(
  loader: () => Promise<{ default: ComponentType<any> }>,
  title: string
): ComponentType {
  return function LazySafe() {
    const [Comp, setComp] = useState<ComponentType | null>(null)
    const [fail, setFail] = useState(false)

    useEffect(() => {
      let alive = true
      loader()
        .then((m) => {
          if (alive) setComp(() => m.default)
        })
        .catch((err) => {
          console.error(`Failed to load ${title}:`, err)
          if (alive) setFail(true)
        })
      return () => {
        alive = false
      }
    }, [])

    if (fail) return <Placeholder title={title} />
    if (!Comp) {
      return (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Loading {title}...
        </div>
      )
    }
    return <Comp />
  }
}

/* Extended Admin Modules — Safe Lazy Loading */
const ProductReturns = lazyPage(() => import('./pages/admin/ProductReturns'), 'Product Returns')
const VillageWiseFarmers = lazyPage(() => import('./pages/admin/VillageWiseFarmers'), 'Village-wise Farmers')
const StockLedgerViewer = lazyPage(() => import('./pages/admin/StockLedgerViewer'), 'Stock Ledger')
const LateInterestManager = lazyPage(() => import('./pages/admin/LateInterestManager'), 'Late Interest')
const CashbackManager = lazyPage(() => import('./pages/admin/CashbackManager'), 'Cashback Manager')
const NotificationsCenter = lazyPage(() => import('./pages/admin/NotificationsCenter'), 'Notifications')
const DueReminderGenerator = lazyPage(() => import('./pages/admin/DueReminderGenerator'), 'Due Reminders')
const AdminBillWhatsApp = lazyPage(() => import('./pages/admin/AdminBillWhatsApp'), 'Bill WhatsApp')
const FarmerPinReset = lazyPage(() => import('./pages/admin/FarmerPinReset'), 'PIN Reset')
const ReportsHub = lazyPage(() => import('./pages/admin/ReportsHub'), 'Reports Hub')
const AdminSettings = lazyPage(() => import('./pages/admin/AdminSettings'), 'Settings')
const AuditLogsViewer = lazyPage(() => import('./pages/admin/AuditLogsViewer'), 'Audit Logs')
const PurchaseRegister = lazyPage(() => import('./pages/admin/PurchaseRegister'), 'Purchase Register')
const SalesRegister = lazyPage(() => import('./pages/admin/SalesRegister'), 'Sales Register')
const CompanyPurchaseSummary = lazyPage(() => import('./pages/admin/CompanyPurchaseSummary'), 'Company Summary')
const FarmerStatusControl = lazyPage(() => import('./pages/admin/FarmerStatusControl'), 'Farmer Status')
const CreditLimitManager = lazyPage(() => import('./pages/admin/CreditLimitManager'), 'Credit Limit')
const BillVoidReversal = lazyPage(() => import('./pages/admin/BillVoidReversal'), 'Bill Void')
const DashboardAlerts = lazyPage(() => import('./pages/admin/DashboardAlerts'), 'Live Alerts')
const AdvancedFarmerSearch = lazyPage(() => import('./pages/admin/AdvancedFarmerSearch'), 'Farmer Search')
const SecurityChecklist = lazyPage(() => import('./pages/admin/SecurityChecklist'), 'Security Checklist')
const DailySalesSummary = lazyPage(() => import('./pages/admin/DailySalesSummary'), 'Daily Sales')
const MonthlySalesReport = lazyPage(() => import('./pages/admin/MonthlySalesReport'), 'Monthly Sales')
const ProductWiseSales = lazyPage(() => import('./pages/admin/ProductWiseSales'), 'Product Sales')
const OutstandingReport = lazyPage(() => import('./pages/admin/OutstandingReport'), 'Outstanding Report')
const PaymentRegister = lazyPage(() => import('./pages/admin/PaymentRegister'), 'Payment Register')
const ExpiryReport = lazyPage(() => import('./pages/admin/ExpiryReport'), 'Expiry Report')
const ExpiredStockWriteoff = lazyPage(() => import('./pages/admin/ExpiredStockWriteoff'), 'Expired Write-off')
const ReorderList = lazyPage(() => import('./pages/admin/ReorderList'), 'Reorder List')
const InventoryValuation = lazyPage(() => import('./pages/admin/InventoryValuation'), 'Stock Valuation')
const MobileQuickActions = lazyPage(() => import('./pages/admin/MobileQuickActions'), 'Quick Actions')
const SystemHealthCheck = lazyPage(() => import('./pages/admin/SystemHealthCheck'), 'Health Check')
const DataIntegrityCheck = lazyPage(() => import('./pages/admin/DataIntegrityCheck'), 'Integrity Check')
const ModuleDirectory = lazyPage(() => import('./pages/admin/ModuleDirectory'), 'Module Directory')
const FinalQualityGate = lazyPage(() => import('./pages/admin/FinalQualityGate'), 'Quality Gate')
const GoLiveReadiness = lazyPage(() => import('./pages/admin/GoLiveReadiness'), 'Go-Live')
const ProjectComplete = lazyPage(() => import('./pages/admin/ProjectComplete'), 'Complete')
const GettingStartedGuide = lazyPage(() => import('./pages/admin/GettingStartedGuide'), 'Getting Started')
const ExportFarmersCsv = lazyPage(() => import('./pages/admin/ExportFarmersCsv'), 'Export Farmers')
const SystemMap = lazyPage(() => import('./pages/admin/SystemMap'), 'System Map')
const AboutBusiness = lazyPage(() => import('./pages/admin/AboutBusiness'), 'About')
const AccessMatrix = lazyPage(() => import('./pages/admin/AccessMatrix'), 'Access Matrix')
const BackupReminder = lazyPage(() => import('./pages/admin/BackupReminder'), 'Backup')
const E2ESmokeChecklist = lazyPage(() => import('./pages/admin/E2ESmokeChecklist'), 'E2E Checklist')
const AdminSessionInfo = lazyPage(() => import('./pages/admin/AdminSessionInfo'), 'Admin Session')
const DocumentViewer = lazyPage(() => import('./pages/admin/DocumentViewer'), 'Documents')
const NotificationTemplates = lazyPage(() => import('./pages/admin/NotificationTemplates'), 'Notif Templates')
const GroupMemberUsage = lazyPage(() => import('./pages/admin/GroupMemberUsage'), 'Group Usage')
const UniquenessChecker = lazyPage(() => import('./pages/admin/UniquenessChecker'), 'Uniqueness')
const BillSeriesViewer = lazyPage(() => import('./pages/admin/BillSeriesViewer'), 'Bill Series')
const DataRetentionPolicy = lazyPage(() => import('./pages/admin/DataRetentionPolicy'), 'Retention')
const StepsIndex = lazyPage(() => import('./pages/admin/StepsIndex'), 'Steps Index')
const ProjectHandover = lazyPage(() => import('./pages/admin/ProjectHandover'), 'Handover')
const SecuritySignoff = lazyPage(() => import('./pages/admin/SecuritySignoff'), 'Security Sign-off')
const PerformanceTips = lazyPage(() => import('./pages/admin/PerformanceTips'), 'Performance')
const KnownLimitations = lazyPage(() => import('./pages/admin/KnownLimitations'), 'Limitations')
const AppVersion = lazyPage(() => import('./pages/admin/AppVersion'), 'Version')
const PrintHelp = lazyPage(() => import('./pages/admin/PrintHelp'), 'Print Help')
const MobileOfflineTip = lazyPage(() => import('./pages/admin/MobileOfflineTip'), 'Mobile Tips')
const RlsTestGuide = lazyPage(() => import('./pages/admin/RlsTestGuide'), 'RLS Guide')
const DemoFlowScript = lazyPage(() => import('./pages/admin/DemoFlowScript'), 'Demo Flow')
const DebugTips = lazyPage(() => import('./pages/admin/DebugTips'), 'Debug Tips')
const FeatureFlags = lazyPage(() => import('./pages/admin/FeatureFlags'), 'Feature Flags')
const MaintenanceMode = lazyPage(() => import('./pages/admin/MaintenanceMode'), 'Maintenance')
const TableCounts = lazyPage(() => import('./pages/admin/TableCounts'), 'Table Counts')
const KeyboardShortcuts = lazyPage(() => import('./pages/admin/KeyboardShortcuts'), 'Shortcuts')
const CompanyLedger = lazyPage(() => import('./pages/admin/CompanyLedger'), 'Company Ledger')
const CompanyPayment = lazyPage(() => import('./pages/admin/CompanyPayment'), 'Company Payment')
const DamageProduct = lazyPage(() => import('./pages/admin/DamageProduct'), 'Damage Product')
const GSTCalculation = lazyPage(() => import('./pages/admin/GSTCalculation'), 'GST Calculation')

/* Additional Modules */
const SchemeSlabsEditor = lazyPage(() => import('./pages/admin/SchemeSlabsEditor'), 'Scheme Slabs')
const CategoryManager = lazyPage(() => import('./pages/admin/CategoryManager'), 'Categories')
const UnitManager = lazyPage(() => import('./pages/admin/UnitManager'), 'Units')
const DueDateEngine = lazyPage(() => import('./pages/admin/DueDateEngine'), 'Due Date Engine')
const GroupBalanceSync = lazyPage(() => import('./pages/admin/GroupBalanceSync'), 'Group Sync')
const BillWarningEditor = lazyPage(() => import('./pages/admin/BillWarningEditor'), 'Bill Warning')
const PrintableBill = lazyPage(() => import('./pages/admin/PrintableBill'), 'Print Bill')
const InterestReport = lazyPage(() => import('./pages/admin/InterestReport'), 'Interest Report')
const CashbackReport = lazyPage(() => import('./pages/admin/CashbackReport'), 'Cashback Report')
const StockRegisterSummary = lazyPage(() => import('./pages/admin/StockRegisterSummary'), 'Stock Register')
const WhatsAppPermissionManager = lazyPage(() => import('./pages/admin/WhatsAppPermissionManager'), 'WhatsApp Permission')
const ConcurrencyInfo = lazyPage(() => import('./pages/admin/ConcurrencyInfo'), 'Concurrency')
const RateOverrideLogs = lazyPage(() => import('./pages/admin/RateOverrideLogs'), 'Rate Audit')
const FarmerWiseSales = lazyPage(() => import('./pages/admin/FarmerWiseSales'), 'Farmer Sales')
const ShopContactCardPage = lazyPage(() => import('./pages/admin/ShopContactCard'), 'Shop Contact Card')
const Letterpad = lazyPage(() => import('./pages/admin/Letterpad'), 'Letterpads')

function ShopContactCardFallback() {
  return (
    <div className="max-w-lg mx-auto space-y-6 mt-10">
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Phone className="text-amber-400" size={28} /> Shop Contact Card
        </h1>
      </div>
      <div className="bg-white p-6 rounded-3xl border text-center space-y-2 shadow-sm">
        <p className="text-4xl">🌾</p>
        <h2 className="text-xl font-black text-emerald-950">SATGURU BEEJ BHANDAR</h2>
        <p className="text-sm text-gray-600">Daloosar, Sardarshahar (Churu), Rajasthan</p>
        <p className="text-xs font-bold text-emerald-800 pt-4">JAI JAWAN JAI KISAN</p>
      </div>
    </div>
  )
}

const PAGE_TITLES: Record<string, string> = {
  home: 'सतगुरु बीज भंडार | दल्लुसर, सरदारशहर (चूरू)',
  products: 'उत्पाद व कीमतें | सतगुरु बीज भंडार',
  crops: 'फसल बुवाई से कटाई तक | सतगुरु बीज भंडार',
  'medicine-info': 'दवाई व साल्ट जानकारी | सतगुरु बीज भंडार',
  disease: 'रोग व दवाई | सतगुरु बीज भंडार',
  weeds: 'खरपतवार प्रबंधन | सतगुरु बीज भंडार',
  homecare: 'होम केयर — घरेलू बगीचा | सतगुरु बीज भंडार',
  mandi: 'मंडी भाव | सतगुरु बीज भंडार',
  msp: 'MSP 2025-26 | सतगुरु बीज भंडार',
  schemes: 'सरकारी योजनाएं | सतगुरु बीज भंडार',
  students: 'स्टूडेंट कॉर्नर | सतगुरु बीज भंडार',
  youtube: 'YouTube वीडियो | सतगुरु बीज भंडार',
  facebook: 'Facebook अपडेट्स | सतगुरु बीज भंडार',
  udhaar: 'किसान उधार कार्ड व समूह योजना | सतगुरु बीज भंडार',
}

function PublicWebsite() {
  const [page, setPage] = useState<string>('home')

  const navigate = useCallback((p: string) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (PAGE_TITLES[page]) document.title = PAGE_TITLES[page]
  }, [page])

  return (
    <div className="min-h-screen bg-amber-50/20">
      <div className="bg-red-600 text-white font-bold text-center py-2 px-3 text-xs md:text-sm sticky top-0 z-40 shadow-md">
        ⚠️ महत्वपूर्ण: डिस्काउंट सिर्फ <strong>दवाइयों और टॉनिक</strong> पर है।{' '}
        <strong>बीज और खाद पर कोई छूट नहीं।</strong>
      </div>

      <Navbar
        page={page as PageKey}
        onNavigate={navigate as any}
        userRole={null}
        onOpenRoleModal={() => {
          window.location.href = '/login'
        }}
      />

      <AnimatePresence mode="wait">
        <motion.main
          key={page}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {page === 'home' && <HomePage onNavigate={navigate as any} />}
          {page === 'products' && <ProductsPage userRole={null} />}
          {page === 'crops' && <CropsPage userRole={null} />}
          {page === 'medicine-info' && <MedicineInfo userRole={null} />}
          {page === 'disease' && <DiseasePage onNavigate={navigate as any} userRole={null} />}
          {page === 'weeds' && <WeedsPage userRole={null} />}
          {page === 'homecare' && <HomeCarePage userRole={null} />}
          {page === 'mandi' && <MandiPage userRole={null} />}
          {page === 'msp' && <MspPage userRole={null} />}
          {page === 'schemes' && <SchemesPage userRole={null} />}
          {page === 'students' && <StudentsPage userRole={null} />}
          {page === 'youtube' && <Youtube />}
          {page === 'facebook' && <Facebook />}
          {page === 'udhaar' && <UdhaarPublic />}
        </motion.main>
      </AnimatePresence>

      <Footer onNavigate={navigate as any} />
      <ScrollToTop />
    </div>
  )
}

// 🔒 SECURED: ADMIN GUARD
// Yahan `!!user` hta diya gaya hai aur `localStorage` pe trust khatam kar diya gaya hai.
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-white font-bold">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-200">Admin session check...</p>
        </div>
      </div>
    )
  }

  // Sirf tabhi admin allow hoga jab secure backend context se role === 'admin' milega
  const isAdmin = role === 'admin'

  if (!user || !isAdmin) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Farmers use custom PIN auth (sessionStorage `farmer_session`), not Supabase Auth.
// FarmerPortal validates that session itself — do not gate on useAuth().user.

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          <Route path="/" element={<PublicWebsite />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ADMIN ROUTES */}
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <AdminLayout />
              </AdminOnly>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="farmers/*" element={<FarmersMaster />} />
            <Route path="groups/*" element={<GroupUdhaarMaster />} />
            <Route path="companies/*" element={<CompanyMaster />} />
            <Route path="products/*" element={<ProductMaster />} />
            <Route path="sara-saman/*" element={<SaraSamanInventory />} />
            <Route path="purchase/*" element={<PurchaseStockIn />} />
            <Route path="batches/*" element={<BatchLotManager />} />
            <Route path="bills/*" element={<BillingPOS />} />
            <Route path="payments/*" element={<PaymentEntry />} />
            <Route path="ledger/*" element={<FarmerLedgerView />} />
            <Route path="data-reset" element={<DataResetTool />} />
            <Route path="bank-accounts/*" element={<BankAccountsMaster />} />
            <Route path="company-purchase-return/*" element={<CompanyPurchaseReturn />} />

            <Route path="returns/*" element={<ProductReturns />} />
            <Route path="sales-register/*" element={<SalesRegister />} />
            <Route path="daily-sales/*" element={<DailySalesSummary />} />
            <Route path="monthly-sales/*" element={<MonthlySalesReport />} />
            <Route path="product-sales/*" element={<ProductWiseSales />} />
            <Route path="farmer-sales/*" element={<FarmerWiseSales />} />
            <Route path="company-sales/*" element={<CompanyPurchaseSummary />} />

            <Route path="purchase-register/*" element={<PurchaseRegister />} />
            <Route path="company-summary/*" element={<CompanyPurchaseSummary />} />
            <Route path="company-ledger/*" element={<CompanyLedger />} />
            <Route path="company-payment/*" element={<CompanyPayment />} />
            <Route path="letterpad/*" element={<Letterpad />} />


            <Route path="stock-ledger/*" element={<StockLedgerViewer />} />
            <Route path="stock-register/*" element={<StockRegisterSummary />} />
            <Route path="expiry-report/*" element={<ExpiryReport />} />
            <Route path="expired-writeoff/*" element={<ExpiredStockWriteoff />} />
            <Route path="damage-product/*" element={<DamageProduct />} />
            <Route path="reorder/*" element={<ReorderList />} />
            <Route path="valuation/*" element={<InventoryValuation />} />

            <Route path="villages/*" element={<VillageWiseFarmers />} />
            <Route path="farmer-status/*" element={<FarmerStatusControl />} />
            <Route path="farmer-search/*" element={<AdvancedFarmerSearch />} />
            <Route path="credit-limit/*" element={<CreditLimitManager />} />
            <Route path="pin-reset/*" element={<FarmerPinReset />} />
            <Route path="export-farmers/*" element={<ExportFarmersCsv />} />
            <Route path="group-usage/*" element={<GroupMemberUsage />} />
            <Route path="group-sync/*" element={<GroupBalanceSync />} />

            <Route path="bill-void/*" element={<BillVoidReversal />} />
            <Route path="bill-whatsapp/*" element={<AdminBillWhatsApp />} />
            <Route path="bill-series/*" element={<BillSeriesViewer />} />
            <Route path="bill-warning/*" element={<BillWarningEditor />} />
            <Route path="print-bill/*" element={<PrintableBill />} />
            <Route path="gst-calculation/*" element={<GSTCalculation />} />
            <Route path="rate-audit/*" element={<RateOverrideLogs />} />

            <Route path="payment-register/*" element={<PaymentRegister />} />
            <Route path="outstanding/*" element={<OutstandingReport />} />
            <Route path="interest/*" element={<LateInterestManager />} />
            <Route path="interest-report/*" element={<InterestReport />} />
            <Route path="cashback/*" element={<CashbackManager />} />
            <Route path="cashback-report/*" element={<CashbackReport />} />
            <Route path="due-engine/*" element={<DueDateEngine />} />
            <Route path="reminders/*" element={<DueReminderGenerator />} />

            <Route path="notifications/*" element={<NotificationsCenter />} />
            <Route path="notif-templates/*" element={<NotificationTemplates />} />
            <Route path="whatsapp-permission/*" element={<WhatsAppPermissionManager />} />

            <Route path="schemes/*" element={<SchemeSlabsEditor />} />
            <Route path="categories/*" element={<CategoryManager />} />
            <Route path="units/*" element={<UnitManager />} />

            <Route path="reports/*" element={<ReportsHub />} />

            <Route path="settings/*" element={<AdminSettings />} />
            <Route path="audit/*" element={<AuditLogsViewer />} />
            <Route path="alerts/*" element={<DashboardAlerts />} />
            <Route path="health/*" element={<SystemHealthCheck />} />
            <Route path="integrity/*" element={<DataIntegrityCheck />} />
            <Route path="modules/*" element={<ModuleDirectory />} />
            <Route path="table-counts/*" element={<TableCounts />} />
            <Route path="uniqueness/*" element={<UniquenessChecker />} />
            <Route path="concurrency/*" element={<ConcurrencyInfo />} />
            <Route path="feature-flags/*" element={<FeatureFlags />} />
            <Route path="maintenance/*" element={<MaintenanceMode />} />
            <Route path="session/*" element={<AdminSessionInfo />} />
            <Route path="access-matrix/*" element={<AccessMatrix />} />
            <Route path="security/*" element={<SecurityChecklist />} />
            <Route path="security-signoff/*" element={<SecuritySignoff />} />
            <Route path="backup/*" element={<BackupReminder />} />
            <Route path="retention/*" element={<DataRetentionPolicy />} />
            <Route path="rls-guide/*" element={<RlsTestGuide />} />

            <Route path="getting-started/*" element={<GettingStartedGuide />} />
            <Route path="documents/*" element={<DocumentViewer />} />
            <Route path="system-map/*" element={<SystemMap />} />
            <Route path="about/*" element={<AboutBusiness />} />
            <Route path="shop-contact/*" element={<ShopContactCardPage />} />
            <Route path="shop-contact-fallback" element={<ShopContactCardFallback />} />
            <Route path="quick/*" element={<MobileQuickActions />} />
            <Route path="mobile-tips/*" element={<MobileOfflineTip />} />
            <Route path="shortcuts/*" element={<KeyboardShortcuts />} />
            <Route path="print-help/*" element={<PrintHelp />} />
            <Route path="performance/*" element={<PerformanceTips />} />
            <Route path="limitations/*" element={<KnownLimitations />} />
            <Route path="debug-tips/*" element={<DebugTips />} />
            <Route path="demo-flow/*" element={<DemoFlowScript />} />

            <Route path="e2e/*" element={<E2ESmokeChecklist />} />
            <Route path="quality-gate/*" element={<FinalQualityGate />} />
            <Route path="golive/*" element={<GoLiveReadiness />} />
            <Route path="complete/*" element={<ProjectComplete />} />
            <Route path="handover/*" element={<ProjectHandover />} />
            <Route path="steps-index/*" element={<StepsIndex />} />
            <Route path="version/*" element={<AppVersion />} />

            <Route path="*" element={<AdminOverview />} />
          </Route>

          {/* Farmer PIN session is managed inside FarmerPortal (sessionStorage). */}
          <Route path="/farmer-portal" element={<Navigate to="/farmer" replace />} />
          <Route path="/farmer/*" element={<FarmerPortal />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}