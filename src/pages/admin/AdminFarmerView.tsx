import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Phone,
  MapPin,
  TrendingDown,
  Printer,
  Building2,
  ChevronDown,
  ChevronUp,
  Camera,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { round2, safeNum } from '../../lib/round';
import { format } from 'date-fns';

interface FarmerData {
  id: string;
  farmer_id: string;
  name: string;
  phone: string;
  village: string;
  total_khata_balance: number;
  opening_balance: number;
}

interface PortalBundle {
  bills: any[];
  physical_bills: any[];
  payments: any[];
  returns: any[];
}

const AdminFarmerView: React.FC = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [farmer, setFarmer] = useState<FarmerData | null>(null);
  const [bundle, setBundle] = useState<PortalBundle | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNagadBills, setShowNagadBills] = useState(false);

  // Self-contained admin gate (NO useAuth — avoids AuthProvider crash)
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          setAuthLoading(false);
          return;
        }

        // 1) role in auth metadata
        if (
          user.user_metadata?.role === 'admin' ||
          user.app_metadata?.role === 'admin'
        ) {
          setIsAdmin(true);
          setAuthLoading(false);
          return;
        }

        // 2) fallback: profiles table (select * = schema-safe)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role ?? profile?.user_role ?? '';
        setIsAdmin(String(role).toLowerCase() === 'admin');
      } catch (err) {
        console.error('Admin check failed:', err);
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setError(null);
    setFarmer(null);
    setBundle(null);
    setShowNagadBills(false);

    try {
      // 1. Find Farmer by farmer_id (e.g. SBB-101)
      const { data: farmerData, error: fError } = await supabase
        .from('farmers')
        .select('*')
        .eq('farmer_id', searchTerm.trim().toUpperCase())
        .single();

      if (fError || !farmerData) {
        setError('Farmer not found. Please check the ID.');
        setSearching(false);
        return;
      }

      // Sync credit account so outstanding is fresh
      await supabase.rpc('sync_farmer_credit_account', {
        p_farmer_id: farmerData.id,
      });

      setFarmer({
        id: farmerData.id,
        farmer_id: farmerData.farmer_id,
        name: farmerData.name || farmerData.farmer_name || '—',
        phone: farmerData.phone || farmerData.mobile || '',
        village: farmerData.village || '',
        total_khata_balance: safeNum(
          farmerData.total_khata_balance ?? farmerData.outstanding_balance
        ),
        opening_balance: safeNum(farmerData.opening_balance),
      });

      // 2. Get Portal Bundle using the UUID
      const { data: bundleData, error: bError } = await supabase.rpc(
        'get_farmer_portal_bundle',
        { p_farmer_id: farmerData.id }
      );

      if (bError) throw bError;

      setBundle({
        bills: Array.isArray(bundleData?.bills) ? bundleData.bills : [],
        physical_bills: Array.isArray(bundleData?.physical_bills)
          ? bundleData.physical_bills
          : [],
        payments: Array.isArray(bundleData?.payments) ? bundleData.payments : [],
        returns: Array.isArray(bundleData?.returns) ? bundleData.returns : [],
      });
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setSearching(false);
    }
  };

  // ACCURATE MATH (same as FarmerPortal)
  // Outstanding = Opening + Udhaar Digital + Udhaar Physical − Paid − Returns
  const stats = useMemo(() => {
    if (!bundle || !farmer) {
      return {
        totalUdhaar: 0,
        totalPaid: 0,
        totalReturns: 0,
        totalNagad: 0,
        balance: 0,
      };
    }

    const udhaarDig = bundle.bills.filter(
      (b) => String(b.bill_type || '').toLowerCase() === 'udhaar'
    );
    const udhaarPhy = bundle.physical_bills.filter(
      (pb) => String(pb.transaction_type || '').toLowerCase() === 'udhaar'
    );
    const totalUdhaar =
      udhaarDig.reduce((sum, b) => sum + safeNum(b.total_amount), 0) +
      udhaarPhy.reduce((sum, pb) => sum + safeNum(pb.bill_amount), 0);

    const nagadDig = bundle.bills.filter(
      (b) => String(b.bill_type || '').toLowerCase() !== 'udhaar'
    );
    const nagadPhy = bundle.physical_bills.filter(
      (pb) => String(pb.transaction_type || '').toLowerCase() !== 'udhaar'
    );
    const totalNagad =
      nagadDig.reduce((sum, b) => sum + safeNum(b.total_amount), 0) +
      nagadPhy.reduce((sum, pb) => sum + safeNum(pb.bill_amount), 0);

    const totalReturns = bundle.returns.reduce(
      (sum, r) => sum + safeNum(r.total_amount),
      0
    );
    const totalPaid = bundle.payments.reduce(
      (sum, p) => sum + safeNum(p.payment_amount ?? p.amount),
      0
    );

    return {
      totalUdhaar,
      totalReturns,
      totalPaid,
      totalNagad,
      balance: round2(
        farmer.opening_balance + totalUdhaar - totalReturns - totalPaid
      ),
    };
  }, [bundle, farmer]);

  // LEDGER TIMELINE — Nagad hidden until toggle ON
  const combinedLedger = useMemo(() => {
    if (!bundle || !farmer) return [];

    let items: any[] = [
      ...bundle.bills.map((b) => ({
        ...b,
        itemType: 'bill' as const,
        date: b.bill_date || b.created_at,
        isUdhaar: String(b.bill_type || '').toLowerCase() === 'udhaar',
        isPhysical: false,
        amount: safeNum(b.total_amount),
      })),
      ...bundle.physical_bills.map((pb) => ({
        ...pb,
        itemType: 'bill' as const,
        date: pb.bill_date || pb.created_at,
        isUdhaar: String(pb.transaction_type || '').toLowerCase() === 'udhaar',
        isPhysical: true,
        amount: safeNum(pb.bill_amount),
      })),
      ...bundle.payments.map((p) => ({
        ...p,
        itemType: 'payment' as const,
        date: p.payment_date || p.created_at,
        amount: safeNum(p.payment_amount ?? p.amount),
      })),
      ...bundle.returns.map((r) => ({
        ...r,
        itemType: 'return' as const,
        date: r.return_date || r.created_at,
        amount: safeNum(r.total_amount),
      })),
    ];

    // Hide Nagad/Cash bills when toggle is OFF
    if (!showNagadBills) {
      items = items.filter((item) => !(item.itemType === 'bill' && !item.isUdhaar));
    }

    const sorted = items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Opening Balance as oldest row (bottom of newest-first list)
    if (farmer.opening_balance > 0) {
      sorted.push({
        id: 'opening_bal_static_row',
        itemType: 'opening_balance',
        date: null,
        amount: farmer.opening_balance,
      });
    }

    return sorted;
  }, [bundle, farmer, showNagadBills]);

  // ── Auth loading / denied ──────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
        <p className="text-slate-500 font-bold text-sm">Checking access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <p className="text-red-600 font-bold text-lg mb-4">Access Denied. Admin Only.</p>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold"
        >
          Back to Admin
        </button>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Admin Header */}
      <div className="bg-white border-b sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="p-2 hover:bg-slate-100 rounded-full"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-slate-800">Farmer Ledger (Admin View)</h1>
        <div className="w-10" />
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Enter Farmer ID (e.g. SBB-101)"
              className="w-full pl-10 pr-24 py-4 bg-white border-2 border-emerald-100 rounded-2xl shadow-sm focus:border-emerald-500 focus:ring-0 transition-all text-lg font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-red-500 text-sm font-medium ml-2">{error}</p>
          )}
        </form>

        {farmer && bundle && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Farmer Info Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-90">
                    <User size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      {farmer.farmer_id}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{farmer.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                >
                  <Printer size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-emerald-50">
                  <Phone size={14} />
                  <span className="text-sm">{farmer.phone || 'No Phone'}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-50">
                  <MapPin size={14} />
                  <span className="text-sm">{farmer.village || 'No Village'}</span>
                </div>
              </div>

              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <p className="text-emerald-100 text-xs font-medium uppercase mb-1">
                  Total Outstanding
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black">₹{round2(stats.balance)}</span>
                  <span className="text-emerald-200 text-xs">कुल उधारी</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                  Opening Bal.
                </p>
                <p className="text-lg font-black text-slate-800">
                  ₹{round2(farmer.opening_balance)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                  Udhaar Bills
                </p>
                <p className="text-lg font-black text-slate-800">
                  ₹{round2(stats.totalUdhaar)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-orange-500 font-bold uppercase mb-1">
                  Returns
                </p>
                <p className="text-lg font-black text-orange-600">
                  ₹{round2(stats.totalReturns)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">
                  Paid
                </p>
                <p className="text-lg font-black text-emerald-600">
                  ₹{round2(stats.totalPaid)}
                </p>
              </div>
            </div>

            {/* Nagad Bills Toggle */}
            <button
              type="button"
              onClick={() => setShowNagadBills(!showNagadBills)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-white border border-teal-200 rounded-2xl hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-xl group-hover:bg-teal-200 transition-colors">
                  <Wallet size={20} />
                </div>
                <div className="text-left">
                  <h4 className="font-black text-slate-800 text-sm">
                    दुकान से लिया गया नकद सामान
                  </h4>
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                    Show Cash / Nagad Bills
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="font-mono font-black text-teal-800 text-sm">
                    ₹{round2(stats.totalNagad)}
                  </p>
                </div>
                <div className="p-1.5 bg-white text-teal-600 rounded-lg shadow-sm border border-teal-100 group-hover:border-teal-300">
                  {showNagadBills ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </button>

            {/* Ledger Timeline */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 px-1">
                <Receipt size={18} className="text-emerald-600" />
                Ledger Timeline
              </h3>

              {combinedLedger.map((item, idx) => {
                if (item.itemType === 'opening_balance') {
                  return (
                    <div
                      key={item.id}
                      className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-amber-200 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-700">
                        <Building2 size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-amber-900">
                              Opening Balance (पुराना बकाया)
                            </p>
                            <p className="text-xs text-amber-700 font-medium mt-0.5">
                              खाता शुरू करते समय का बकाया
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-amber-900 text-base">
                              ₹{round2(item.amount)}
                            </p>
                            <span className="text-[9px] font-bold text-amber-700 uppercase bg-amber-200/50 px-1 rounded">
                              OPENING
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isPayment = item.itemType === 'payment';
                const isReturn = item.itemType === 'return';
                const isNagad = item.itemType === 'bill' && !item.isUdhaar;

                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-2xl p-4 shadow-sm border flex items-center gap-4 ${
                      isNagad
                        ? 'bg-teal-50/30 border-teal-100'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isPayment
                          ? 'bg-emerald-100 text-emerald-600'
                          : isReturn
                          ? 'bg-orange-100 text-orange-600'
                          : isNagad
                          ? 'bg-teal-100 text-teal-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isPayment ? (
                        <ArrowDownLeft size={24} />
                      ) : isReturn ? (
                        <TrendingDown size={24} />
                      ) : (
                        <ArrowUpRight size={24} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-800 truncate flex items-center gap-2 flex-wrap">
                            {isPayment
                              ? 'Payment Received'
                              : isReturn
                              ? 'Sales Return'
                              : isNagad
                              ? 'Cash Sale (नकद)'
                              : 'Udhaar Sale (उधारी)'}
                            {item.isPhysical && (
                              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                <Camera size={10} /> Physical
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <Calendar size={12} />
                            {item.date
                              ? format(new Date(item.date), 'dd MMM yyyy')
                              : 'No Date'}
                            <span>•</span>
                            <span className="uppercase font-mono">
                              {item.bill_number ||
                                item.payment_number ||
                                item.return_number ||
                                'Ref: ' + String(item.id || '').slice(0, 5)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-black text-base ${
                              isPayment
                                ? 'text-emerald-600'
                                : isReturn
                                ? 'text-orange-600'
                                : isNagad
                                ? 'text-teal-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {isPayment || isReturn ? '-' : '+'}₹{round2(item.amount)}
                          </p>
                          {isNagad && (
                            <span className="text-[9px] font-bold text-teal-600 uppercase">
                              Paid Cash
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {combinedLedger.length === 0 && (
                <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
                  <Wallet size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">
                    No transactions found for this farmer.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!farmer && !searching && (
          <div className="mt-20 text-center px-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Farmer Ledger Lookup
            </h3>
            <p className="text-slate-500">
              Enter a Farmer ID above to view their complete transaction history,
              udhaar balance, and payments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFarmerView;