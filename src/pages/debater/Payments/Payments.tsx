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

// DEMO: bảng giá chuẩn, dùng khi API chưa trả gói nào. packageId < 0 = chưa có API thật.
const DEMO_PACKAGES: DebaterCreditPackage[] = [
  { packageId: -1, packageCode: "BASIC", packageName: "Gói Basic", price: 20000, currency: "VNĐ", creditAmount: 2000, bonusCredit: 0 },
  { packageId: -2, packageCode: "STANDARD", packageName: "Gói Standard", price: 50000, currency: "VNĐ", creditAmount: 5000, bonusCredit: 200 },
  { packageId: -3, packageCode: "PREMIUM", packageName: "Gói Premium", price: 100000, currency: "VNĐ", creditAmount: 10000, bonusCredit: 1000 },
];
// DEMO: gói tự do tính 10 VNĐ / credit (giá gói Basic). Sau này lấy từ API.
const CUSTOM_RATE_VND = 10;
const CUSTOM_MIN = 1000;
const CUSTOM_MAX = 100000;
const CUSTOM_PRESETS = [1000, 3000, 8000, 20000];

const Payments: React.FC = () => {
  const [customCredit, setCustomCredit] = useState<number>(3000);
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
    if (pkg.packageId < 0) {
      setErrorMsg("");
      setSuccessMsg(`Bản demo: gói ${pkg.packageName} chưa nối API thanh toán.`);
      return;
    }
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

  const shownPackages = packages.length > 0 ? packages : DEMO_PACKAGES;
  const customValid = Number.isFinite(customCredit) && customCredit >= CUSTOM_MIN && customCredit <= CUSTOM_MAX;
  const customPrice = Math.max(0, customCredit || 0) * CUSTOM_RATE_VND;
  const handleCustomTopUp = () => {
    if (!customValid) return;
    setErrorMsg("");
    setSuccessMsg(`Bản demo: nạp ${customCredit.toLocaleString("vi-VN")} Credit (${customPrice.toLocaleString("vi-VN")} VNĐ), chưa nối API thanh toán.`);
  };

  const surface = "rounded-ap-xl bg-elevated shadow-ap-sm";
  const tabs = [
    { id: "PACKAGES" as const, label: `Danh sách gói nạp (${shownPackages.length + 1})` },
    { id: "HISTORY" as const, label: `Lịch sử biến động ví (${transactions.length})` },
  ];
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (next >= 0) {
      event.preventDefault();
      setActiveTab(tabs[next].id);
      document.getElementById(`pay-tab-${tabs[next].id}`)?.focus();
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Header */}
      <section className="flex flex-col gap-(--s-4) pt-(--s-4) sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[720px] space-y-(--s-2)">
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Ví điểm tín chỉ &amp; Nạp Credit
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Nạp điểm tín chỉ để tham gia luyện tập đối kháng với AI, thi đấu giải đấu và nhận phản hồi chấm điểm chuyên sâu.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex min-h-11 cursor-pointer items-center gap-(--s-2) self-start text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          <span>Làm mới số dư</span>
        </button>
      </section>

      {/* Alerts */}
      {errorMsg && (
        <div role="alert" className="flex items-center justify-between gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) text-label">
          <div className="flex items-center gap-(--s-3)">
            <AlertCircle size={18} className="shrink-0 text-ap-danger" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg("")}
            aria-label="Đóng thông báo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-label-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {successMsg && (
        <div role="status" className="flex items-center justify-between gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label">
          <div className="flex items-center gap-(--s-3)">
            <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            aria-label="Đóng thông báo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-label-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* The balance: a number on a plain surface */}
      <section aria-label="Số dư ví" className={`${surface} flex flex-col gap-(--s-6) p-(--s-6) md:flex-row md:items-center md:justify-between sm:p-(--s-7)`}>
        <div className="space-y-(--s-3)">
          <p className="inline-flex items-center gap-(--s-2) text-(length:--text-callout) text-label-secondary">
            <Wallet size={16} aria-hidden="true" />
            Ví tín chỉ học viên
          </p>
          <p className="flex items-baseline gap-(--s-3)">
            <span className="text-(length:--text-hero) font-bold leading-none tracking-(--tracking-display) tabular-nums">
              {wallet ? wallet.balance.toLocaleString("vi-VN") : "--"}
            </span>
            <span className="text-(length:--text-headline) text-label-secondary">Credit khả dụng</span>
          </p>
          <p className="max-w-[520px] text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
            Điểm tín chỉ dùng để chi trả cho các buổi luyện tập tranh biện cùng AI Coach, chấm điểm tự động và tham gia các giải đấu có thưởng.
          </p>
        </div>

        <div className="flex flex-col gap-(--s-4) md:items-end">
          {rewardStatus && (
            <button
              type="button"
              onClick={handleClaimDailyReward}
              disabled={!rewardStatus.canClaimDailyLogin || claimingReward}
              className={`inline-flex h-12 items-center justify-center gap-(--s-2) rounded-ap-pill px-(--s-5) text-(length:--text-callout) font-medium transition-[background-color,transform] duration-(--t-fast) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 ${
                rewardStatus.canClaimDailyLogin
                  ? "cursor-pointer bg-accent text-accent-contrast hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100"
                  : "cursor-not-allowed bg-canvas-secondary text-label-tertiary"
              }`}
            >
              <Gift size={17} aria-hidden="true" />
              <span>
                {claimingReward
                  ? "Đang nhận thưởng..."
                  : rewardStatus.canClaimDailyLogin
                  ? `Nhận thưởng hôm nay (+${rewardStatus.dailyLoginAmount} Credit)`
                  : "Đã nhận thưởng hàng ngày"}
              </span>
            </button>
          )}
          <dl className="space-y-(--s-1) text-(length:--text-callout)">
            <div className="flex items-center justify-between gap-(--s-5)">
              <dt className="text-label-secondary">Cổng thanh toán</dt>
              <dd className="inline-flex items-center gap-(--s-2) font-medium">
                <ShieldCheck size={15} className="text-accent" aria-hidden="true" /> PayOS / VietQR
              </dd>
            </div>
            <div className="flex items-center justify-between gap-(--s-5)">
              <dt className="text-label-secondary">Xử lý tự động</dt>
              <dd className="font-medium">Cộng điểm tức thì</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Tabs: Packages vs History */}
      <div className="space-y-(--s-5)">
        <div role="tablist" aria-label="Gói nạp và lịch sử" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-ap-pill bg-canvas-secondary p-1">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`pay-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`pay-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-5) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                activeTab === tab.id ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
              }`}
            >
              {tab.id === "PACKAGES" ? <Coins size={15} aria-hidden="true" /> : <Clock size={15} aria-hidden="true" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Packages */}
        {activeTab === "PACKAGES" && (
          <div id="pay-panel-PACKAGES" role="tabpanel" aria-labelledby="pay-tab-PACKAGES" className="space-y-(--s-5)">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Chọn gói nạp điểm phù hợp với bạn</h2>
              <span className="inline-flex items-center gap-(--s-2) text-(length:--text-callout) text-label-secondary">
                <ShieldCheck size={15} className="text-accent" aria-hidden="true" />
                Thanh toán an toàn qua quét mã VietQR ngân hàng
              </span>
            </div>

            {loading ? (
              <div role="status" className={`${surface} space-y-(--s-3) px-(--s-6) py-(--s-8) text-center`}>
                <RefreshCw size={26} className="mx-auto animate-spin text-accent" aria-hidden="true" />
                <p className="text-(length:--text-callout) text-label-secondary">Đang tải danh sách gói nạp khả dụng...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-(--s-5) sm:grid-cols-2 lg:grid-cols-3">
                {shownPackages.map((pkg) => {
                  const totalCredits = pkg.creditAmount + (pkg.bonusCredit || 0);

                  return (
                    <article
                      key={pkg.packageId}
                      className={`${surface} flex flex-col justify-between gap-(--s-5) p-(--s-6) transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-0.5 hover:shadow-ap-md motion-reduce:transform-none`}
                    >
                      <div className="space-y-(--s-5)">
                        <div className="flex items-center justify-between gap-(--s-3)">
                          <span className="text-(length:--text-caption) tabular-nums text-label-tertiary">#{pkg.packageCode}</span>
                          {pkg.bonusCredit > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-(--s-3) py-1 text-(length:--text-caption) font-medium text-accent">
                              <Gift size={12} aria-hidden="true" /> Tặng +{pkg.bonusCredit}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{pkg.packageName}</h3>
                          <p className="mt-(--s-2) flex items-baseline gap-(--s-2)">
                            <span className="text-(length:--text-section) font-semibold leading-none tracking-(--tracking-display) tabular-nums">
                              {pkg.price.toLocaleString("vi-VN")}
                            </span>
                            <span className="text-(length:--text-callout) text-label-secondary">{pkg.currency || "VNĐ"}</span>
                          </p>
                        </div>

                        <dl className="space-y-(--s-2) border-t border-separator pt-(--s-4) text-(length:--text-callout)">
                          <div className="flex items-center justify-between">
                            <dt className="text-label-secondary">Credit cơ bản</dt>
                            <dd className="tabular-nums">{pkg.creditAmount.toLocaleString()} Credit</dd>
                          </div>
                          {pkg.bonusCredit > 0 && (
                            <div className="flex items-center justify-between">
                              <dt className="text-label-secondary">Khuyến mãi thêm</dt>
                              <dd className="tabular-nums text-accent">+{pkg.bonusCredit.toLocaleString()} Credit</dd>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-(--s-2) font-semibold">
                            <dt>Tổng nhận về ví</dt>
                            <dd className="tabular-nums">{totalCredits.toLocaleString()} Credit</dd>
                          </div>
                        </dl>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPackage(pkg)}
                        disabled={redirectingPackageId !== null}
                        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {redirectingPackageId === pkg.packageId ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
                            <span>Đang chuyển sang PayOS...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} aria-hidden="true" />
                            <span>Nạp ngay qua PayOS</span>
                          </>
                        )}
                      </button>
                    </article>
                  );
                })}

                <article className={`${surface} flex flex-col justify-between gap-(--s-5) p-(--s-6)`}>
                  <div className="space-y-(--s-5)">
                    <div className="flex items-center justify-between gap-(--s-3)">
                      <span className="text-(length:--text-caption) text-label-tertiary">TỰ DO</span>
                      <span className="rounded-full bg-canvas-secondary px-(--s-3) py-1 text-(length:--text-caption) font-medium text-label-secondary">
                        {CUSTOM_RATE_VND} VNĐ / Credit
                      </span>
                    </div>

                    <div>
                      <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Gói tự do</h3>
                      <p className="mt-(--s-2) flex items-baseline gap-(--s-2)">
                        <span className="text-(length:--text-section) font-semibold leading-none tracking-(--tracking-display) tabular-nums">
                          {customPrice.toLocaleString("vi-VN")}
                        </span>
                        <span className="text-(length:--text-callout) text-label-secondary">VNĐ</span>
                      </p>
                    </div>

                    <div className="space-y-(--s-3) border-t border-separator pt-(--s-4)">
                      <label htmlFor="custom-credit" className="text-(length:--text-callout) text-label-secondary">
                        Số Credit muốn nạp
                      </label>
                      <input
                        id="custom-credit"
                        type="number"
                        inputMode="numeric"
                        min={CUSTOM_MIN}
                        max={CUSTOM_MAX}
                        step={100}
                        value={Number.isFinite(customCredit) ? customCredit : ""}
                        onChange={(e) => setCustomCredit(e.target.value === "" ? NaN : Number(e.target.value))}
                        aria-invalid={!customValid}
                        className="h-11 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) tabular-nums text-label outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25"
                      />
                      <div className="flex flex-wrap gap-(--s-2)">
                        {CUSTOM_PRESETS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCustomCredit(n)}
                            className={`min-h-9 cursor-pointer rounded-full px-(--s-4) text-(length:--text-callout) font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                              customCredit === n ? "bg-accent-soft text-accent" : "bg-canvas-secondary text-label-secondary hover:text-label"
                            }`}
                          >
                            {n.toLocaleString("vi-VN")}
                          </button>
                        ))}
                      </div>
                      <p className={`text-(length:--text-caption) ${customValid ? "text-label-secondary" : "text-ap-danger"}`}>
                        Tối thiểu {CUSTOM_MIN.toLocaleString("vi-VN")}, tối đa {CUSTOM_MAX.toLocaleString("vi-VN")} Credit.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCustomTopUp}
                    disabled={!customValid || redirectingPackageId !== null}
                    className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CreditCard size={16} aria-hidden="true" />
                    <span>Nạp gói tự do</span>
                  </button>
                </article>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Wallet transactions */}
        {activeTab === "HISTORY" && (
          <div id="pay-panel-HISTORY" role="tabpanel" aria-labelledby="pay-tab-HISTORY" className={`${surface} overflow-hidden`}>
            {transactions.length === 0 ? (
              <div className="px-(--s-6) py-(--s-8) text-center text-(length:--text-callout) text-label-secondary">
                Bạn chưa có biến động số dư nào trong ví điểm tín chỉ.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-(length:--text-callout)">
                  <thead>
                    <tr className="border-b border-separator text-(length:--text-caption) uppercase tracking-wider text-label-secondary">
                      <th className="px-(--s-5) py-(--s-3) font-medium">Mã GD</th>
                      <th className="px-(--s-5) py-(--s-3) font-medium">Loại giao dịch</th>
                      <th className="px-(--s-5) py-(--s-3) font-medium">Số lượng</th>
                      <th className="px-(--s-5) py-(--s-3) font-medium">Số dư sau</th>
                      <th className="px-(--s-5) py-(--s-3) font-medium">Thời gian</th>
                      <th className="px-(--s-5) py-(--s-3) font-medium">Nội dung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-separator">
                    {transactions.map((tx) => {
                      const isCredit = tx.amount > 0 || tx.transactionType?.toLowerCase().includes("topup") || tx.transactionType?.toLowerCase().includes("credit");

                      return (
                        <tr key={tx.walletTransactionId} className="transition-colors hover:bg-canvas-secondary">
                          <td className="px-(--s-5) py-(--s-4) tabular-nums text-label-tertiary">#{tx.walletTransactionId}</td>
                          <td className="px-(--s-5) py-(--s-4)">
                            <span className={`inline-flex items-center gap-1 ${isCredit ? "text-accent" : "text-label-secondary"}`}>
                              {isCredit ? <ArrowDownLeft size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
                              {tx.transactionType === "TopUp" ? "Nạp điểm tín chỉ" : tx.transactionType}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-(--s-5) py-(--s-4) font-medium tabular-nums">
                            <span className={isCredit ? "text-accent" : "text-label"}>
                              {isCredit ? `+${tx.amount.toLocaleString()}` : `-${Math.abs(tx.amount).toLocaleString()}`} Credit
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-(--s-5) py-(--s-4) tabular-nums">{tx.balanceAfter.toLocaleString()} Credit</td>
                          <td className="whitespace-nowrap px-(--s-5) py-(--s-4) text-label-secondary">
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td className="max-w-xs truncate px-(--s-5) py-(--s-4) text-label-secondary">
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
      </div>

      {/* PayOS redirecting overlay */}
      {redirectingPackageId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Đang chuyển sang PayOS"
          className="fixed inset-0 z-50 flex items-center justify-center bg-(--scrim) p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm space-y-(--s-4) rounded-ap-xl bg-elevated p-(--s-7) text-center shadow-ap-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-accent-soft text-accent">
              <ExternalLink size={26} aria-hidden="true" />
            </div>
            <div className="space-y-(--s-2)">
              <h3 className="text-(length:--text-headline) font-semibold">Đang chuyển sang PayOS...</h3>
              <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
                Hệ thống đang mở trang thanh toán chính thức của PayOS để bạn quét mã VietQR và thanh toán an toàn.
              </p>
            </div>
            <div className="flex items-center justify-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent">
              <RefreshCw size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>Đang kết nối cổng thanh toán...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
