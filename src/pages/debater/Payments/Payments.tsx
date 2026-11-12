import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Coins,
  CreditCard,
  Gift,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  X,
} from "lucide-react";
import paymentApi from "../../../api/paymentApi";
import {
  DebaterCreditPackage,
  WalletInfo,
  WalletTransactionItem,
  RewardStatusResponse,
} from "../../../types";

const Payments: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [packages, setPackages] = useState<DebaterCreditPackage[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [rewardStatus, setRewardStatus] = useState<RewardStatusResponse | null>(null);
  const [claimingReward, setClaimingReward] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [redirectingPackageId, setRedirectingPackageId] = useState<number | null>(null);

  // Messages
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Active Tab: Gói nạp vs Lịch sử giao dịch
  const [activeTab, setActiveTab] = useState<"PACKAGES" | "HISTORY">("PACKAGES");

  // Fetch Wallet & Active Packages
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [walletRes, packagesRes, txnsRes, rewardRes] = await Promise.all([
        paymentApi.getMyWallet().catch(() => null),
        paymentApi.getActivePackages().catch(() => null),
        paymentApi.getMyWalletTransactions({ page: 1, pageSize: 20 }).catch(() => null),
        typeof paymentApi.getRewardStatus === "function"
          ? paymentApi.getRewardStatus().catch(() => null)
          : Promise.resolve(null),
      ]);

      if (walletRes && walletRes.success && walletRes.data) {
        setWallet(walletRes.data);
      }

      if (packagesRes && packagesRes.success && packagesRes.data) {
        setPackages(packagesRes.data);
      }

      if (txnsRes && txnsRes.success && txnsRes.data) {
        setTransactions(txnsRes.data);
      }

      if (rewardRes && rewardRes.success && rewardRes.data) {
        setRewardStatus(rewardRes.data);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi tải thông tin ví và gói nạp.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClaimDailyReward = async () => {
    setClaimingReward(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await paymentApi.claimDailyLoginReward();
      if (res && res.success && res.data) {
        setSuccessMsg(
          `Điểm danh thành công! Bạn đã nhận +${res.data.creditAmount} Credit (Số dư mới: ${res.data.newBalance} Credit).`
        );
        await fetchData();
      } else {
        setErrorMsg(res?.message || "Bạn đã nhận thưởng hôm nay hoặc không thể nhận thưởng lúc này.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Không thể nhận thưởng điểm danh hàng ngày.");
    } finally {
      setClaimingReward(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle PayOS redirect return params (?status=PAID / ?cancel=true / ?code=00)
  useEffect(() => {
    const status = searchParams.get("status");
    const cancel = searchParams.get("cancel");
    const code = searchParams.get("code");
    const orderCode = searchParams.get("orderCode");

    if (status === "PAID" || code === "00") {
      setSuccessMsg(
        `Thanh toán đơn hàng ${orderCode ? `#${orderCode} ` : ""}thành công qua PayOS! Điểm tín chỉ đã được cộng vào ví của bạn.`
      );
      fetchData();
      setSearchParams({}, { replace: true });
    } else if (cancel === "true" || status === "CANCELLED") {
      setErrorMsg(`Giao dịch đơn hàng ${orderCode ? `#${orderCode} ` : ""}đã bị hủy.`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchData]);

  // Handle Select Package to Top Up: POST /api/payments/top-up -> trực tiếp chuyển hướng sang PayOS
  const handleSelectPackage = async (pkg: DebaterCreditPackage) => {
    setRedirectingPackageId(pkg.packageId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await paymentApi.createTopUpPayment({ packageId: pkg.packageId });
      if (res && res.success && res.data?.checkoutUrl) {
        // Chuyển hướng trực tiếp tới trang thanh toán chính thức của PayOS
        window.location.href = res.data.checkoutUrl;
      } else {
        setErrorMsg(res?.message || "Không thể tạo liên kết thanh toán PayOS.");
        setRedirectingPackageId(null);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi khởi tạo liên kết thanh toán PayOS.");
      setRedirectingPackageId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Coins className="text-amber-500" size={26} />
            <span>Ví điểm tín chỉ & Nạp Credit</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Nạp điểm tín chỉ để tham gia luyện tập đối kháng với AI, thi đấu giải đấu và nhận phản hồi chấm điểm chuyên sâu.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#1A2E26] hover:bg-slate-100 dark:hover:bg-[#233F34] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-[#008A64]" : ""} />
          <span>Làm mới số dư</span>
        </button>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-600">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#008A64] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-emerald-500 hover:text-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Wallet Balance Card Banner */}
      <div className="bg-gradient-to-br from-[#008A64] via-[#007454] to-[#014D38] rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-[#008A64]/15 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/15 backdrop-blur-xs text-amber-300">
                <Wallet size={20} />
              </span>
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-100">
                Ví tín chỉ học viên
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono">
                {wallet ? wallet.balance.toLocaleString("vi-VN") : "--"}
              </span>
              <span className="text-base font-bold text-emerald-200">Credit khả dụng</span>
            </div>

            <p className="text-xs text-emerald-100/80 max-w-lg leading-relaxed">
              Điểm tín chỉ dùng để chi trả cho các buổi luyện tập tranh biện cùng AI Coach, chấm điểm tự động và tham gia các giải đấu có thưởng.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {rewardStatus && (
              <button
                type="button"
                onClick={handleClaimDailyReward}
                disabled={!rewardStatus.canClaimDailyLogin || claimingReward}
                className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  rewardStatus.canClaimDailyLogin
                    ? "bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-200 cursor-pointer shadow-md"
                    : "bg-white/10 text-emerald-100 border-white/15 opacity-80 cursor-not-allowed"
                }`}
              >
                <Gift size={16} />
                <span>
                  {claimingReward
                    ? "Đang nhận thưởng..."
                    : rewardStatus.canClaimDailyLogin
                    ? `Nhận thưởng hôm nay (+${rewardStatus.dailyLoginAmount} Credit)`
                    : "Đã nhận thưởng hàng ngày"}
                </span>
              </button>
            )}
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 text-xs text-emerald-50 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-200">Cổng thanh toán:</span>
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-300" /> PayOS / VietQR
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-200">Xử lý tự động:</span>
                <span className="font-bold text-amber-300">Cộng điểm tức thì</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selection: Packages vs History */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[rgba(148,163,184,0.18)] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("PACKAGES")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "PACKAGES"
              ? "bg-[#008A64] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#12231C]"
          }`}
        >
          <Coins size={14} />
          <span>Danh sách gói nạp ({packages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "HISTORY"
              ? "bg-[#008A64] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#12231C]"
          }`}
        >
          <Clock size={14} />
          <span>Lịch sử biến động ví ({transactions.length})</span>
        </button>
      </div>

      {/* Tab 1: Packages List */}
      {activeTab === "PACKAGES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Chọn gói nạp điểm phù hợp với bạn
            </h2>
            <span className="text-xs text-[#008A64] font-bold">
              Thanh toán an toàn qua quét mã VietQR ngân hàng
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]">
              <RefreshCw size={24} className="animate-spin text-[#008A64] mx-auto mb-2" />
              <span>Đang tải danh sách gói nạp khả dụng...</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]">
              Hiện tại chưa có gói nạp nào được mở bán. Vui lòng quay lại sau!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packages.map((pkg) => {
                const totalCredits = pkg.creditAmount + (pkg.bonusCredit || 0);

                return (
                  <div
                    key={pkg.packageId}
                    className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 shadow-xs flex flex-col justify-between transition-all hover:border-[#008A64] hover:shadow-lg hover:shadow-[#008A64]/5 group relative"
                  >
                    <div className="space-y-4">
                      {/* Top Bar */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          #{pkg.packageCode}
                        </span>

                        {pkg.bonusCredit > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/40">
                            <Gift size={11} /> Tặng +{pkg.bonusCredit}
                          </span>
                        )}
                      </div>

                      {/* Package Name & Price */}
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          {pkg.packageName}
                        </h3>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-[#008A64]">
                            {pkg.price.toLocaleString("vi-VN")}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {pkg.currency || "VNĐ"}
                          </span>
                        </div>
                      </div>

                      {/* Credit Breakdown */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B1713] space-y-2 border border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Coins size={14} className="text-amber-500" />
                            Credit cơ bản:
                          </span>
                          <span className="font-bold">{pkg.creditAmount.toLocaleString()} Credit</span>
                        </div>

                        {pkg.bonusCredit > 0 && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <Gift size={14} className="text-rose-500" />
                              Khuyến mãi thêm:
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{pkg.bonusCredit.toLocaleString()} Credit
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between font-bold">
                          <span className="text-slate-800 dark:text-slate-200">Tổng nhận về ví:</span>
                          <span className="text-sm font-black text-[#008A64]">
                            {totalCredits.toLocaleString()} Credit
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectPackage(pkg)}
                      disabled={redirectingPackageId !== null}
                      className="mt-5 w-full py-2.5 rounded-xl bg-[#008A64] hover:bg-[#007454] disabled:opacity-60 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 group-hover:shadow-md group-hover:shadow-[#008A64]/20"
                    >
                      {redirectingPackageId === pkg.packageId ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Đang chuyển sang PayOS...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard size={14} />
                          <span>Nạp ngay qua PayOS</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Wallet Transactions History */}
      {activeTab === "HISTORY" && (
        <div className="bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Bạn chưa có biến động số dư nào trong ví điểm tín chỉ.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0B1713] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã GD</th>
                    <th className="px-5 py-3.5">Loại giao dịch</th>
                    <th className="px-5 py-3.5">Số lượng</th>
                    <th className="px-5 py-3.5">Số dư sau</th>
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-5 py-3.5">Nội dung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
                  {transactions.map((tx) => {
                    const isCredit = tx.amount > 0 || tx.transactionType?.toLowerCase().includes("topup") || tx.transactionType?.toLowerCase().includes("credit");

                    return (
                      <tr key={tx.walletTransactionId} className="hover:bg-slate-50/60 dark:hover:bg-[#1A2E26]/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-400">
                          #{tx.walletTransactionId}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                              isCredit
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                            {tx.transactionType === "TopUp" ? "Nạp điểm tín chỉ" : tx.transactionType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold font-mono">
                          <span className={isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600"}>
                            {isCredit ? `+${tx.amount.toLocaleString()}` : `-${Math.abs(tx.amount).toLocaleString()}`} Credit
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold font-mono text-slate-700 dark:text-slate-300">
                          {tx.balanceAfter.toLocaleString()} Credit
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {tx.description || "Giao dịch nạp điểm tín chỉ"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PayOS Redirecting Overlay */}
      {redirectingPackageId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#12231C] w-full max-w-sm rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-7 text-center space-y-4 animate-scale-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] flex items-center justify-center animate-pulse">
              <ExternalLink size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Đang chuyển sang PayOS...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hệ thống đang mở trang thanh toán chính thức của PayOS để bạn quét mã VietQR và thanh toán an toàn.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#008A64] pt-1">
              <RefreshCw size={14} className="animate-spin" />
              <span>Đang kết nối cổng thanh toán...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
