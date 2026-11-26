import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  BarChart2,
  Globe,
  Compass,
  Mic,
  LineChart,
  UserPlus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Gavel,
  Timer,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES } from "../../../utils/constants";
import GoogleLoginButton from "../../../components/auth/GoogleLoginButton";
import PasswordInput from "../../../components/auth/PasswordInput";
import PasswordStrength from "../../../components/auth/PasswordStrength";
import PasswordRequirements from "../../../components/auth/PasswordRequirements";
import ConfirmPasswordInput from "../../../components/auth/ConfirmPasswordInput";
import FeaturedLearners from "../../../components/home/FeaturedLearners";
import authApi from "../../../api/authApi";
import { getAuthErrorMessage } from "../../../utils/authError";


const Home: React.FC = () => {
  const navigate = useNavigate();
  const { login, googleLogin, isAuthenticated, role, user, logout } = useAuth();

  // Auth Card State
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRoleRedirect = (userRole?: string) => {
    const r = String(userRole || role);
    if (r === "Administrator" || r === "Admin" || r === ROLES.ADMIN) {
      navigate("/admin/dashboard");
    } else if (r === "Organizer" || r === ROLES.ORGANIZER) {
      navigate("/organizer/dashboard");
    } else {
      navigate("/debater/dashboard");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password });
      if (result.success && result.user) {
        handleRoleRedirect(result.user.role);
      } else {
        setError(getAuthErrorMessage(result, "Email hoặc mật khẩu không chính xác."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Email hoặc mật khẩu không chính xác."));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessMsg("");

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin đăng ký.");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      if (res && res.success) {
        setSuccessMsg("Mã OTP đã được gửi đến email của bạn. Đang chuyển đến trang xác thực...");
        setTimeout(() => {
          navigate("/verify-otp", { state: { email: email.trim(), type: "Registration" } });
        }, 1500);
      } else {
        setError(getAuthErrorMessage(res, "Đăng ký không thành công."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Lỗi đăng ký tài khoản."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await googleLogin(idToken);
      if (result.success && result.user) {
        handleRoleRedirect(result.user.role);
      } else {
        setError(getAuthErrorMessage(result, "Xác thực Google thất bại."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Lỗi đăng nhập Google."));
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = user?.role === "Administrator" ? "Quản trị viên" : user?.role === "Organizer" ? "Giảng viên" : "Học viên";

  const switchMode = (mode: "login" | "register") => {
    setAuthMode(mode);
    setError("");
    setSuccessMsg("");
  };

  const fieldClass =
    "h-12 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-(length:--text-caption) font-medium text-label-secondary";
  const primaryButton =
    "flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60";

  const errorAlert = error && (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) leading-(--leading-snug) text-label"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
      <span className="break-words">{error}</span>
    </div>
  );

  const features = [
    {
      icon: Brain,
      title: "AI đối kháng thông minh",
      text: "Đối thủ AI phản biện đa chiều, bám sát luận điểm của bạn và đổi chiến thuật theo từng lượt.",
    },
    {
      icon: BarChart2,
      title: "Chấm điểm Rubric tự động",
      text: "Đánh giá khách quan theo nhiều tiêu chí, kèm gợi ý cụ thể để bạn sửa ngay ở lượt sau.",
    },
    {
      icon: Globe,
      title: "Đa dạng chủ đề thực tế",
      text: "Từ giáo dục, công nghệ đến xã hội: luôn có kiến nghị phù hợp với trình độ của bạn.",
    },
  ];

  const featuredTopics = [
    {
      category: "Giáo dục",
      title: "Học sinh nên được sử dụng điện thoại trong lớp học",
      text: "Cân bằng giữa công cụ học tập số và sự tập trung trong giờ học.",
      goal: "Luyện lập luận có dẫn chứng và phản biện theo bối cảnh.",
    },
    {
      category: "Công nghệ",
      title: "Trí tuệ nhân tạo sẽ làm nhiều việc hơn là tạo ra việc làm",
      text: "Tác động của AI tới thị trường lao động và kỹ năng tương lai.",
      goal: "Luyện phân tích hai mặt và dùng số liệu thuyết phục.",
    },
    {
      category: "Xã hội",
      title: "Mạng xã hội gây hại nhiều hơn lợi cho giới trẻ",
      text: "Kết nối và cơ hội đối lập với áp lực tâm lý và nghiện màn hình.",
      goal: "Luyện cấu trúc luận điểm rõ ràng và kết luận gọn.",
    },
  ];

  const steps = [
    { icon: Compass, title: "Chọn kiến nghị", text: "Chọn chủ đề và phe của bạn, rồi dành một phút chuẩn bị." },
    { icon: Mic, title: "Tranh biện với AI", text: "Nói hoặc gõ lập luận theo luật WSDC & BP, từng vòng có đồng hồ riêng." },
    { icon: LineChart, title: "Nhận phản hồi", text: "Xem điểm Rubric, điểm mạnh, điểm yếu và luyện lại ngay." },
  ];

  const proofs = [
    { icon: Gavel, label: "Luật WSDC & BP" },
    { icon: BarChart2, label: "Rubric đa tiêu chí" },
    { icon: Timer, label: "Phản hồi thời gian thực" },
  ];

  const cardShell =
    "relative z-10 mx-auto w-full max-w-[440px] rounded-ap-xl border border-separator bg-elevated/90 p-(--s-6) shadow-ap-lg backdrop-blur-xl";

  return (
    <div className="page-modern relative isolate overflow-hidden bg-canvas font-apple text-label">
      {/* Backdrop: two soft lights and a fine grid, nothing else */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-40 left-[-10%] h-[620px] w-[620px] rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--accent) 22%, transparent)" }}
        />
        <div
          className="absolute top-20 right-[-8%] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--accent-2) 20%, transparent)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
          style={{
            backgroundImage:
              "linear-gradient(var(--separator) 1px, transparent 1px), linear-gradient(90deg, var(--separator) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 100%)",
          }}
        />
      </div>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-(--s-7) px-5 py-(--s-8) sm:px-8 lg:grid-cols-12 lg:gap-(--s-6) lg:py-(--s-9)">
        <div className="space-y-(--s-5) lg:col-span-7">
          <div className="inline-flex items-center gap-(--s-2) rounded-ap-pill border border-separator bg-elevated/80 px-(--s-4) py-(--s-2) text-(length:--text-caption) font-medium text-label-secondary backdrop-blur">
            <Sparkles size={14} className="text-accent" aria-hidden="true" />
            <span>Nền tảng tranh biện AI thế hệ mới</span>
          </div>

          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display) text-balance">
            Lập luận sắc bén.
            <br />
            <span className="bg-gradient-to-r from-(--accent) to-(--accent-2) bg-clip-text text-transparent">
              Tranh biện đỉnh cao.
            </span>
          </h1>

          <p className="max-w-[560px] text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Luyện tư duy phản biện cùng đối thủ AI mô phỏng luật WSDC & BP, với hệ thống phân tích logic và chấm điểm
            Rubric đa tiêu chí ngay sau mỗi lượt nói.
          </p>

          <div className="flex flex-wrap items-center gap-(--s-3) pt-(--s-2)">
            <Link
              to={isAuthenticated ? "/debater/dashboard" : "/debater/topics"}
              className="group inline-flex h-12 items-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast shadow-ap-md transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
            >
              <span>Bắt đầu luyện tập</span>
              <ArrowRight size={18} className="transition-transform duration-(--t-base) group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center gap-(--s-2) rounded-ap-pill px-(--s-5) text-(length:--text-body) font-medium text-accent shadow-[inset_0_0_0_1px_var(--accent)] transition-colors duration-(--t-fast) hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
            >
              Xem cách hoạt động
            </a>
          </div>

          <ul className="flex flex-wrap gap-x-(--s-5) gap-y-(--s-2) pt-(--s-3) text-(length:--text-callout) text-label-secondary">
            {proofs.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-(--s-2)">
                <Icon size={16} className="text-accent" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ===================== AUTH CARD ===================== */}
        <div className="lg:col-span-5">
          {isAuthenticated && user ? (
            <div className={`${cardShell} space-y-(--s-5) text-center`}>
              <div className="flex flex-col items-center gap-(--s-3)">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-(--accent) to-(--accent-2) p-[3px]">
                  <img
                    src={
                      (user.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`
                    }
                    alt={user.fullName}
                    className="h-full w-full rounded-full bg-elevated object-cover"
                  />
                </div>
                <div>
                  <p className="text-(length:--text-caption) font-medium uppercase tracking-wider text-accent">Bạn đã đăng nhập</p>
                  <h2 className="mt-(--s-1) text-(length:--text-title) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
                    {user.fullName}
                  </h2>
                  <p className="mt-(--s-1) text-(length:--text-callout) text-label-secondary">{user.email}</p>
                  <span className="mt-(--s-3) inline-block rounded-ap-pill bg-accent-soft px-(--s-3) py-(--s-1) text-(length:--text-caption) font-medium text-accent">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-(--s-3) border-t border-separator pt-(--s-5)">
                <button type="button" onClick={() => handleRoleRedirect(user.role)} className={primaryButton}>
                  <span>Vào Bảng điều khiển</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(user.role === "Administrator" ? "/admin/settings" : user.role === "Organizer" ? "/organizer/settings" : "/debater/profile")
                  }
                  className="flex h-12 w-full cursor-pointer items-center justify-center rounded-ap-pill bg-canvas-secondary text-(length:--text-callout) font-medium text-label transition-colors duration-(--t-fast) hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                >
                  Xem hồ sơ cá nhân
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                  className="flex min-h-(--touch-target) w-full cursor-pointer items-center justify-center gap-(--s-2) text-(length:--text-callout) font-medium text-label-secondary hover:text-label focus-visible:outline-none focus-visible:underline"
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>Đăng xuất (đổi tài khoản khác)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className={cardShell}>
              <div className="mb-(--s-5) text-center">
                <h2 className="text-(length:--text-title) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
                  {authMode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
                </h2>
                <p className="mt-(--s-2) text-(length:--text-callout) leading-(--leading-snug) text-label-secondary">
                  {authMode === "login"
                    ? "Đăng nhập để tiếp tục hành trình luyện tranh biện cùng AI."
                    : "Bắt đầu đấu trường tranh biện học thuật cùng AI."}
                </p>
              </div>

              {/* Segmented control */}
              <div role="tablist" aria-label="Đăng nhập hoặc tạo tài khoản" className="mb-(--s-5) grid grid-cols-2 rounded-ap-pill bg-canvas-secondary p-1">
                {(["login", "register"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={authMode === mode}
                    onClick={() => switchMode(mode)}
                    className={`min-h-10 cursor-pointer rounded-ap-pill px-(--s-3) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                      authMode === mode ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
                    }`}
                  >
                    {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                  </button>
                ))}
              </div>

              {successMsg && (
                <div role="status" className="mb-(--s-4) flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label">
                  <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
                  <span>{successMsg}</span>
                </div>
              )}

              <GoogleLoginButton
                onSuccess={handleGoogleSuccess}
                onError={(msg) => setError(getAuthErrorMessage(msg, "Đăng nhập bằng Google thất bại."))}
                disabled={loading}
                text="Tiếp tục với Google"
              />

              <div className="my-(--s-5) flex items-center gap-(--s-3)" role="separator" aria-label="hoặc dùng email">
                <span className="h-px flex-1 bg-separator" />
                <span className="text-(length:--text-caption) text-label-tertiary">hoặc dùng email</span>
                <span className="h-px flex-1 bg-separator" />
              </div>

              {authMode === "login" ? (
                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-(--s-4)">
                  <div className="flex flex-col gap-(--s-2)">
                    <label htmlFor="home-email" className={labelClass}>
                      Địa chỉ Email<span className="sr-only"> (bắt buộc)</span>
                    </label>
                    <input
                      id="home-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                      disabled={loading}
                      className={fieldClass}
                    />
                  </div>

                  <PasswordInput
                    appearance="apple"
                    id="home-password"
                    label="Mật khẩu"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    labelAction={
                      <Link
                        to="/forgot-password"
                        className="text-(length:--text-caption) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Quên mật khẩu?
                      </Link>
                    }
                  />

                  <label className="flex min-h-(--touch-target) cursor-pointer select-none items-center gap-(--s-3) text-(length:--text-callout) text-label-secondary">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                      className="h-5 w-5 cursor-pointer rounded-ap-sm accent-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                    />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>

                  {errorAlert}

                  <button type="submit" disabled={loading} className={primaryButton}>
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Đang đăng nhập" />
                    ) : (
                      <>
                        <span>Đăng nhập</span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-(--s-4)">
                  <div className="flex flex-col gap-(--s-2)">
                    <label htmlFor="home-fullname" className={labelClass}>
                      Họ và tên<span className="sr-only"> (bắt buộc)</span>
                    </label>
                    <input
                      id="home-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      autoComplete="name"
                      required
                      disabled={loading}
                      className={fieldClass}
                    />
                  </div>

                  <div className="flex flex-col gap-(--s-2)">
                    <label htmlFor="home-register-email" className={labelClass}>
                      Địa chỉ Email<span className="sr-only"> (bắt buộc)</span>
                    </label>
                    <input
                      id="home-register-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="your.email@example.com"
                      autoComplete="email"
                      required
                      disabled={loading}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <PasswordInput
                      appearance="apple"
                      id="home-register-password"
                      label="Mật khẩu"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                    <PasswordStrength appearance="apple" password={password} />
                    <PasswordRequirements appearance="apple" password={password} />
                  </div>

                  <ConfirmPasswordInput
                    appearance="apple"
                    label="Xác nhận mật khẩu"
                    value={confirmPassword}
                    originalPassword={password}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError("");
                    }}
                    required
                    disabled={loading}
                  />

                  {errorAlert}

                  <button type="submit" disabled={loading} className={primaryButton}>
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Đang tạo tài khoản" />
                    ) : (
                      <>
                        <UserPlus size={18} aria-hidden="true" />
                        <span>Tạo tài khoản & nhận OTP</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section id="methods" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-5 py-(--s-8) sm:px-8 lg:py-(--s-9)">
        <div className="mx-auto mb-(--s-7) max-w-[680px] text-center">
          <h2 className="text-(length:--text-section) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
            Mọi thứ để tranh biện tốt hơn
          </h2>
          <p className="mt-(--s-3) text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Luyện tập có đối thủ, có điểm số và có hướng dẫn cải thiện sau từng lượt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-(--s-5) md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="group rounded-ap-xl border border-separator bg-elevated p-(--s-6) transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-1 hover:shadow-ap-md motion-reduce:transform-none"
            >
              <div className="mb-(--s-5) flex h-12 w-12 items-center justify-center rounded-ap-md bg-accent-soft text-accent">
                <Icon size={24} aria-hidden="true" />
              </div>
              <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{title}</h3>
              <p className="mt-(--s-2) text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============================ FEATURED TOPICS ============================ */}
      <section id="featured-topics" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-5 pb-(--s-8) sm:px-8 lg:pb-(--s-9)">
        <div className="mx-auto mb-(--s-7) max-w-[680px] text-center">
          <h2 className="text-(length:--text-section) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
            Chủ đề nổi bật
          </h2>
          <p className="mt-(--s-3) text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Ba kiến nghị đang được luyện nhiều nhất, mỗi đề có một mục tiêu kỹ năng rõ ràng.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-(--s-5) md:grid-cols-3">
          {featuredTopics.map((t) => (
            <article key={t.title} className="flex flex-col rounded-ap-xl border border-separator bg-elevated p-(--s-6)">
              <span className="text-(length:--text-caption) font-medium text-accent">{t.category}</span>
              <h3 className="mt-(--s-2) text-(length:--text-headline) font-semibold leading-(--leading-snug)">{t.title}</h3>
              <p className="mt-(--s-2) text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{t.text}</p>
              <p className="mt-(--s-4) border-t border-separator pt-(--s-4) text-(length:--text-callout) leading-(--leading-body)">
                <span className="font-medium">Mục tiêu: </span>
                <span className="text-label-secondary">{t.goal}</span>
              </p>
            </article>
          ))}
        </div>

        <div className="mt-(--s-6) text-center">
          <Link
            to="/debater/topics"
            className="inline-flex min-h-11 items-center gap-(--s-2) text-(length:--text-body) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
          >
            <span>Xem toàn bộ kho đề tài</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <FeaturedLearners />

      {/* ============================ HOW IT WORKS ============================ */}
      <section id="how-it-works" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-5 pb-(--s-8) sm:px-8 lg:pb-(--s-9)">
        <div className="rounded-ap-xl bg-canvas-secondary p-(--s-6) sm:p-(--s-7)">
          <h2 className="text-center text-(length:--text-section) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
            Ba bước cho mỗi trận
          </h2>
          <ol className="mt-(--s-7) grid grid-cols-1 gap-(--s-6) md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="relative">
                <div className="mb-(--s-4) flex items-center gap-(--s-3)">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-(--accent) to-(--accent-2) text-(length:--text-callout) font-semibold text-accent-contrast">
                    {index + 1}
                  </span>
                  <Icon size={20} className="text-label-secondary" aria-hidden="true" />
                </div>
                <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{title}</h3>
                <p className="mt-(--s-2) text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="mx-auto w-full max-w-[1200px] px-5 pb-(--s-9) sm:px-8">
        <div className="relative overflow-hidden rounded-ap-xl bg-gradient-to-br from-(--accent) to-(--accent-2) px-(--s-6) py-(--s-8) text-center text-accent-contrast">
          <h2 className="text-(length:--text-section) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
            Sẵn sàng bước vào đấu trường?
          </h2>
          <p className="mx-auto mt-(--s-3) max-w-[520px] text-(length:--text-body) leading-(--leading-body) text-accent-contrast/85">
            Chọn một kiến nghị và bắt đầu trận đầu tiên của bạn ngay hôm nay.
          </p>
          <Link
            to={isAuthenticated ? "/debater/dashboard" : "/debater/topics"}
            className="mt-(--s-5) inline-flex h-12 items-center gap-(--s-2) rounded-ap-pill bg-white px-(--s-6) text-(length:--text-body) font-medium text-slate-900 transition-transform duration-(--t-fast) ease-ap hover:scale-[1.02] active:scale-[0.97] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
          >
            <span>{isAuthenticated ? "Vào Bảng điều khiển" : "Khám phá kho đề tài"}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
