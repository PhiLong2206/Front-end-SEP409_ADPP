import React, { useState, useRef, useEffect } from "react";
import {
  User as UserIcon,
  Shield,
  Bell,
  Palette,
  Globe,
  CheckCircle2,
  AlertCircle,
  Save,
  Camera,
  Laptop,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useTheme, ThemeMode } from "../../../hooks/useTheme";
import userApi from "../../../api/userApi";
import authApi from "../../../api/authApi";
import PasswordInput from "../../../components/auth/PasswordInput";
import PasswordStrength from "../../../components/auth/PasswordStrength";
import PasswordRequirements from "../../../components/auth/PasswordRequirements";
import ConfirmPasswordInput from "../../../components/auth/ConfirmPasswordInput";

type SettingsTab = "account" | "security" | "notifications" | "appearance" | "language";

const normalizeGender = (g?: string | null): "Male" | "Female" | "Other" => {
  if (!g) return "Male";
  const lower = g.trim().toLowerCase();
  if (lower === "male" || lower === "nam") return "Male";
  if (lower === "female" || lower === "nu" || lower === "nữ") return "Female";
  return "Other";
};

const GENDER_OPTIONS: { value: "Male" | "Female" | "Other"; label: string }[] = [
  { value: "Male", label: "Nam" },
  { value: "Female", label: "Nữ" },
  { value: "Other", label: "Khác" },
];

const Settings: React.FC = () => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  // Account form
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");

  // Avatar state
  const effectiveAvatar =
    (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
    (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const res = await userApi.getMyProfile();
      if (res && res.success && res.data) {
        if (res.data.fullName) setFullName(res.data.fullName);
        if (res.data.email) setEmail(res.data.email);
        if (res.data.phoneNumber) setPhoneNumber(res.data.phoneNumber);
        if (res.data.gender) setGender(normalizeGender(res.data.gender));
        if (res.data.dateOfBirth) {
          // Format to YYYY-MM-DD for date input
          const d = new Date(res.data.dateOfBirth);
          if (!isNaN(d.getTime())) {
            setDateOfBirth(d.toISOString().split("T")[0]);
          }
        }
        if (res.data.avatarUrl && res.data.avatarUrl !== "string") {
          if (user) setUser({ ...user, avatarUrl: res.data.avatarUrl });
        }
      }
    } catch {
      // Fallback to local user
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError("Dung lượng ảnh không được vượt quá 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        if (user?.email) {
          localStorage.setItem(`adpp_user_avatar_${user.email}`, dataUrl);
        }
        if (user) {
          setUser({ ...user, avatarUrl: dataUrl });
        }
        setSuccess("Cập nhật ảnh đại diện thành công!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    if (user?.email) {
      localStorage.removeItem(`adpp_user_avatar_${user.email}`);
    }
    if (user) {
      setUser({ ...user, avatarUrl: "" });
    }
    setSuccess("Đã gỡ ảnh đại diện!");
    try {
      await userApi.updateMyProfile({
        fullName: fullName.trim(),
        avatarUrl: "",
        phoneNumber: phoneNumber.trim() || undefined,
        gender: gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
      });
    } catch {
      // Ignore API failure on avatar removal
    }
  };

  // Security form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification toggles
  const [notifyDebateInvite, setNotifyDebateInvite] = useState(true);
  const [notifyContest, setNotifyContest] = useState(true);
  const [notifyWeeklyEmail, setNotifyWeeklyEmail] = useState(false);

  // Global Theme Context
  const { theme, setTheme: setGlobalTheme } = useTheme();
  const [language, setLanguage] = useState<"vi" | "en">("vi");

  const handleThemeChange = (newTheme: ThemeMode) => {
    setGlobalTheme(newTheme);
    const label = newTheme === "dark" ? "Tối" : newTheme === "light" ? "Sáng" : "Theo hệ thống";
    setSuccess(`Đã chuyển sang giao diện ${label}!`);
  };

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Họ và tên không được để trống.");
      return;
    }

    setLoading(true);
    try {
      // Only send remote URL (http/https); do not send raw base64 data URLs to avoid DB truncation (NVARCHAR 500)
      const safeAvatarUrl =
        effectiveAvatar && effectiveAvatar.startsWith("http")
          ? effectiveAvatar
          : undefined;

      const payload = {
        fullName: fullName.trim(),
        avatarUrl: safeAvatarUrl,
        phoneNumber: phoneNumber.trim() || undefined,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
      };

      console.log("[Settings] Updating account with payload:", payload);

      const res = await userApi.updateMyProfile(payload);
      if (res && res.success) {
        setSuccess("Cập nhật thông tin tài khoản thành công!");
        if (user) {
          setUser({ ...user, fullName: fullName.trim() });
        }
      } else {
        setError(res?.message || "Cập nhật tài khoản thất bại.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Lỗi cập nhật tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      if (res && res.success) {
        setSuccess("Đổi mật khẩu thành công!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(res?.message || "Mật khẩu hiện tại không chính xác.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Lỗi đổi mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
          Cài đặt & Tùy chọn
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Quản lý tài khoản, bảo mật và tùy chỉnh trải nghiệm.
        </p>
      </div>

      {error && (
        <div className="p-3.5 text-xs sm:text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-fade-in flex items-start gap-2.5">
          <AlertCircle size={17} className="text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 text-xs sm:text-sm rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium animate-fade-in flex items-center gap-2.5">
          <CheckCircle2 size={18} className="text-[#0B5ED7] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid: Left Tabs (4 Cols), Right Content (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT TAB MENU */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0C131F] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-3 shadow-xs space-y-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("account");
              setError("");
              setSuccess("");
            }}
            className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "account"
                ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#131D30]"
            }`}
          >
            <UserIcon size={16} />
            <span>Tài khoản</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("security");
              setError("");
              setSuccess("");
            }}
            className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#131D30]"
            }`}
          >
            <Shield size={16} />
            <span>Bảo mật</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("notifications");
              setError("");
              setSuccess("");
            }}
            className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "notifications"
                ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#131D30]"
            }`}
          >
            <Bell size={16} />
            <span>Thông báo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("appearance");
              setError("");
              setSuccess("");
            }}
            className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "appearance"
                ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Palette size={16} />
            <span>Giao diện</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("language");
              setError("");
              setSuccess("");
            }}
            className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === "language"
                ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#131D30]"
            }`}
          >
            <Globe size={16} />
            <span>Ngôn ngữ</span>
          </button>
        </div>

        {/* RIGHT CONTENT CARD */}
        <div className="lg:col-span-8 bg-white dark:bg-[#0C131F] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 sm:p-8 shadow-xs">
          {/* TAB 1: TÀI KHOẢN */}
          {activeTab === "account" && (
            <form onSubmit={handleUpdateAccount} className="space-y-5">
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] pb-3">
                Tài khoản
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-[rgba(148,163,184,0.2)] hover:border-slate-300 dark:hover:border-[rgba(148,163,184,0.35)] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/15 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c17] border border-slate-200 dark:border-[rgba(148,163,184,0.15)] rounded-xl text-xs sm:text-sm text-slate-500 dark:text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* 2-Column Row for Phone & DOB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Nhập số điện thoại..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-[rgba(148,163,184,0.2)] hover:border-slate-300 dark:hover:border-[rgba(148,163,184,0.35)] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/15 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-[rgba(148,163,184,0.2)] hover:border-slate-300 dark:hover:border-[rgba(148,163,184,0.35)] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/15 transition-all"
                  />
                </div>
              </div>

              {/* Gender Radio / Segmented Options */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Giới tính
                </label>
                <div className="flex items-center gap-3">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGender(option.value)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        gender === option.value
                          ? "bg-[#0B5ED7] text-white border-[#0B5ED7] shadow-xs"
                          : "bg-white dark:bg-[#0D1422] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[rgba(148,163,184,0.2)] hover:border-slate-300 dark:hover:border-[rgba(148,163,184,0.4)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar section */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Ảnh đại diện
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[#0B5ED7] text-white font-black text-lg flex items-center justify-center shadow-xs border-2 border-slate-100">
                    {effectiveAvatar ? (
                      <img
                        src={effectiveAvatar}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{fullName ? fullName.charAt(0).toUpperCase() : "L"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white dark:bg-[#0F1726] hover:bg-slate-50 dark:hover:bg-[#131D30] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.2)] rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera size={14} />
                      <span>Đổi ảnh</span>
                    </button>
                    {effectiveAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Xóa ảnh</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] active:bg-[#072f70] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#0B5ED7]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{loading ? "Đang lưu..." : "Lưu thay đổi"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: BẢO MẬT */}
          {activeTab === "security" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] pb-3">
                Bảo mật & Đổi mật khẩu
              </h2>

              <PasswordInput
                label="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={loading}
              />

              <div>
                <PasswordInput
                  label="Mật khẩu mới"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={loading}
                />
                <PasswordStrength password={newPassword} />
                <PasswordRequirements password={newPassword} />
              </div>

              <ConfirmPasswordInput
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                originalPassword={newPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#0B5ED7]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: THÔNG BÁO */}
          {activeTab === "notifications" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] pb-3">
                Cài đặt Thông báo
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F1726] border border-slate-100 dark:border-[rgba(148,163,184,0.15)]">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Lời mời tranh biện 1 vs 1</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Nhận thông báo khi có học viên thách đấu</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyDebateInvite}
                    onChange={(e) => setNotifyDebateInvite(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0B5ED7] focus:ring-[#0B5ED7]"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F1726] border border-slate-100 dark:border-[rgba(148,163,184,0.15)]">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Sự kiện & Giải đấu mới</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Thông báo khi có giải đấu mở đăng ký</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyContest}
                    onChange={(e) => setNotifyContest(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0B5ED7] focus:ring-[#0B5ED7]"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F1726] border border-slate-100 dark:border-[rgba(148,163,184,0.15)]">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Báo cáo học tập tuần qua Email</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Gửi tổng kết số phiên và điểm Rubric</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyWeeklyEmail}
                    onChange={(e) => setNotifyWeeklyEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0B5ED7] focus:ring-[#0B5ED7]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSuccess("Đã lưu tùy chọn thông báo thành công!")}
                  className="px-6 py-2.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#0B5ED7]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Lưu tùy chọn</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: GIAO DIỆN */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] pb-3">
                Giao diện hiển thị
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Sáng */}
                <div
                  onClick={() => handleThemeChange("light")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    theme === "light"
                      ? "border-[#0B5ED7] bg-blue-50/40 dark:bg-blue-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-[#F5F8FD] border border-slate-200 mb-3 flex items-center justify-center font-bold text-xs text-slate-700 shadow-2xs">
                    Sáng / Nature
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Sáng (Nature)</p>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${theme === "light" ? "border-[#0B5ED7] bg-[#0B5ED7]" : "border-slate-300"}`} />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Giao diện xanh ngọc tự nhiên</p>
                </div>

                {/* 2. Tối */}
                <div
                  onClick={() => handleThemeChange("dark")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    theme === "dark"
                      ? "border-[#0B5ED7] bg-blue-50/40 dark:bg-blue-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-[#060B14] border border-slate-800 mb-3 flex items-center justify-center font-bold text-xs text-blue-400 shadow-2xs">
                    Tối / Dark
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Tối (Dark)</p>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${theme === "dark" ? "border-[#0B5ED7] bg-[#0B5ED7]" : "border-slate-300"}`} />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Dịu mắt khi dùng ban đêm</p>
                </div>

                {/* 3. Theo hệ thống */}
                <div
                  onClick={() => handleThemeChange("system")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    theme === "system"
                      ? "border-[#0B5ED7] bg-blue-50/40 dark:bg-blue-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="w-full h-14 rounded-xl bg-gradient-to-r from-[#F5F8FD] to-[#060B14] border border-slate-300 dark:border-slate-700 mb-3 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shadow-2xs gap-1.5">
                    <Laptop size={14} />
                    <span>Hệ thống</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Theo hệ thống</p>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${theme === "system" ? "border-[#0B5ED7] bg-[#0B5ED7]" : "border-slate-300"}`} />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Tự động theo thiết bị OS</p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSuccess("Đã áp dụng chủ đề giao diện!")}
                  className="px-6 py-2.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#0B5ED7]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Áp dụng giao diện</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: NGÔN NGỮ */}
          {activeTab === "language" && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] pb-3">
                Ngôn ngữ hệ thống
              </h2>

              <div className="space-y-3 max-w-sm">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-[rgba(148,163,184,0.18)] hover:border-[#0B5ED7] cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={language === "vi"}
                    onChange={() => setLanguage("vi")}
                    className="text-[#0B5ED7] focus:ring-[#0B5ED7]"
                  />
                  <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Tiếng Việt (Mặc định)</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-[rgba(148,163,184,0.18)] hover:border-[#0B5ED7] cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    checked={language === "en"}
                    onChange={() => setLanguage("en")}
                    className="text-[#0B5ED7] focus:ring-[#0B5ED7]"
                  />
                  <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">English (International WSDC/BP)</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSuccess("Đã lưu ngôn ngữ hiển thị!")}
                  className="px-6 py-2.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#0B5ED7]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Lưu ngôn ngữ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
