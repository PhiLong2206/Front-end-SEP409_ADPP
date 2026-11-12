import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { useAuth } from "../../../hooks/useAuth";
import userApi from "../../../api/userApi";
import { debateApi } from "../../../api";
import { countCompletedDebates } from "../../../utils/debateStats";
import { ROLES } from "../../../utils/constants";
import {
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  Camera,
  ShieldCheck,
  Calendar,
} from "lucide-react";

const EMPTY_SKILL_DATA = [
  { subject: "Logic", A: 0, fullMark: 100 },
  { subject: "Dẫn chứng", A: 0, fullMark: 100 },
  { subject: "Liên quan", A: 0, fullMark: 100 },
  { subject: "Cấu trúc", A: 0, fullMark: 100 },
  { subject: "Thuyết phục", A: 0, fullMark: 100 },
];

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

const DebaterProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [joinDate, setJoinDate] = useState(() =>
    user?.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [avgScore100, setAvgScore100] = useState<number | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [skillData, setSkillData] = useState(EMPTY_SKILL_DATA);

  const roleStr = String(user?.role || "");
  const isAdmin =
    location.pathname.startsWith("/admin") ||
    roleStr === ROLES.ADMIN ||
    roleStr.toLowerCase() === "admin" ||
    (user?.roles || []).some(
      (r) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrator"
    );

  const effectiveAvatar =
    (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
    (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);

  useEffect(() => {
    fetchProfile();
    fetchRealDebateStats();
  }, []);

  const fetchRealDebateStats = async () => {
    try {
      const historyRes = await debateApi.getUserHistory();
      if (historyRes?.success && Array.isArray(historyRes.data)) {
        setCompletedCount(countCompletedDebates(historyRes.data));

        const uniqueDays = Array.from(
          new Set(
            historyRes.data
              .filter((item) => item.createdAt)
              .map((item) => new Date(item.createdAt).toISOString().slice(0, 10))
          )
        ).sort((a, b) => (a > b ? -1 : 1));

        if (uniqueDays.length > 0) {
          let streak = 1;
          for (let i = 1; i < uniqueDays.length; i++) {
            const diffDays = Math.round(
              (new Date(uniqueDays[i - 1]).getTime() - new Date(uniqueDays[i]).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (diffDays === 1) streak += 1;
            else break;
          }
          setStreakDays(streak);
        }

        const completedSessions = historyRes.data
          .filter((item) => item.status === 3 || String(item.status) === "Completed")
          .slice(0, 5);

        if (completedSessions.length > 0) {
          const evals = await Promise.allSettled(
            completedSessions.map((s) => debateApi.getEvaluation(s.sessionId))
          );
          const scores: number[] = [];
          const critSums: Record<string, { total: number; count: number }> = {
            Logic: { total: 0, count: 0 },
            "Dẫn chứng": { total: 0, count: 0 },
            "Liên quan": { total: 0, count: 0 },
            "Cấu trúc": { total: 0, count: 0 },
            "Thuyết phục": { total: 0, count: 0 },
          };

          evals.forEach((evRes, idx) => {
            if (evRes.status === "fulfilled" && evRes.value?.success && evRes.value.data) {
              const ev = evRes.value.data;
              const s = completedSessions[idx];
              const isPro = s.userSide === 1 || String(s.userSide) === "PRO";
              const myOverall = isPro
                ? ev.overallScorePro ?? ev.proEvaluation?.overallScore ?? ev.overallScore
                : ev.overallScoreCon ?? ev.conEvaluation?.overallScore ?? ev.overallScore;
              if (typeof myOverall === "number" && myOverall > 0) {
                scores.push(myOverall * 10);
              }
              const myEval = isPro ? ev.proEvaluation : ev.conEvaluation;
              myEval?.roundEvaluations?.forEach((r) => {
                r.criteria?.forEach((c) => {
                  const n = (c.name || "").toLowerCase();
                  const bucket = n.includes("logic")
                    ? "Logic"
                    : n.includes("evidence") || n.includes("bằng chứng") || n.includes("dẫn chứng")
                    ? "Dẫn chứng"
                    : n.includes("relevan") || n.includes("liên quan") || n.includes("trọng tâm")
                    ? "Liên quan"
                    : n.includes("struct") || n.includes("cấu trúc") || n.includes("bố cục")
                    ? "Cấu trúc"
                    : "Thuyết phục";
                  critSums[bucket].total += Number(c.score || 0) * 20;
                  critSums[bucket].count += 1;
                });
              });
            }
          });

          if (scores.length > 0) {
            setAvgScore100(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
          }
          setSkillData(
            Object.entries(critSums).map(([subject, { total, count }]) => ({
              subject,
              A: count > 0 ? Math.round(total / count) : 0,
              fullMark: 100,
            }))
          );
        }
      }
    } catch {
      // Ignore stats error
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await userApi.getMyProfile();
      if (res && res.success && res.data) {
        if (res.data.fullName) setFullName(res.data.fullName);
        if (res.data.email) setEmail(res.data.email);
        if (res.data.phoneNumber) setPhoneNumber(res.data.phoneNumber);
        if (res.data.gender) setGender(normalizeGender(res.data.gender));
        if (res.data.dateOfBirth) {
          const d = new Date(res.data.dateOfBirth);
          if (!isNaN(d.getTime())) {
            setDateOfBirth(d.toISOString().split("T")[0]);
          }
        }
        if (res.data.createdAt) {
          setJoinDate(new Date(res.data.createdAt).toLocaleDateString("vi-VN"));
        }
      }
    } catch {
      // Use fallback defaults
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Họ và tên không được để trống.");
      return;
    }

    setLoading(true);
    try {
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

      const res = await userApi.updateMyProfile(payload);
      if (res && res.success) {
        setSuccess("Cập nhật thông tin thành công!");
        setIsEditing(false);
        if (user) {
          setUser({ ...user, fullName: fullName.trim() });
        }
      } else {
        setError(res?.message || "Cập nhật thất bại.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Lỗi khi lưu thông tin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            {isAdmin ? "Hồ sơ quản trị viên" : "Hồ sơ cá nhân"}
          </h1>
          {isAdmin && (
            <p className="text-xs text-slate-500 mt-1">
              Thông tin tài khoản và quyền hạn quản trị hệ thống ADPP
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#008A64] border border-emerald-200 text-xs font-bold w-fit">
            <ShieldCheck size={16} />
            <span>Quản trị viên hệ thống</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 text-xs sm:text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-fade-in flex items-start gap-2.5">
          <AlertCircle size={17} className="text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 text-xs sm:text-sm rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium animate-fade-in flex items-center gap-2.5">
          <CheckCircle2 size={18} className="text-[#008A64] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid: Tailored for Admin vs Debater */}
      {isAdmin ? (
        /* ADMIN PROFILE LAYOUT: Balanced 2-card layout with NO debater stats or radar chart */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT CARD: Admin Identity & System Summary (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative group mb-4">
                <div className="w-24 h-24 rounded-3xl overflow-hidden bg-[#008A64] text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-[#008A64]/20 border-4 border-slate-100">
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{fullName ? fullName.charAt(0).toUpperCase() : "A"}</span>
                  )}
                </div>
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
                  title="Đổi ảnh đại diện"
                  className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#008A64] hover:border-[#008A64] shadow-md transition-all cursor-pointer"
                >
                  <Camera size={14} />
                </button>
              </div>

              <h2 className="text-lg font-bold text-[#0F172A] leading-tight">
                {fullName || user?.fullName || user?.email?.split("@")[0] || "Quản trị viên"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{email || user?.email || ""}</p>

              <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#008A64] border border-emerald-200/80 text-xs font-bold">
                <ShieldCheck size={14} />
                <span>Quản trị viên</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <ShieldCheck size={15} className="text-[#008A64]" />
                  Vai trò
                </span>
                <span className="font-bold text-[#0F172A]">Quản trị viên</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Calendar size={15} className="text-[#008A64]" />
                  Ngày tham gia
                </span>
                <span className="font-bold text-[#0F172A]">
                  {joinDate || "Chưa cập nhật"}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <CheckCircle2 size={15} className="text-[#008A64]" />
                  Trạng thái
                </span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT CARD: Admin Personal Details Form (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Thông tin chi tiết
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Thông tin liên hệ và hồ sơ cá nhân quản trị viên
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-[#008A64] text-slate-700 hover:text-[#008A64] text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isEditing ? <X size={13} /> : <Edit3 size={13} />}
                <span>{isEditing ? "Hủy" : "Chỉnh sửa"}</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing || loading}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                    isEditing
                      ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                      : "bg-slate-50/80 border-slate-200 text-slate-700"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={!isEditing || loading}
                    placeholder="Chưa cập nhật"
                    className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      isEditing
                        ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                        : "bg-slate-50/80 border-slate-200 text-slate-700"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    disabled={!isEditing || loading}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      isEditing
                        ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                        : "bg-slate-50/80 border-slate-200 text-slate-700"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Giới tính
                  </label>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            gender === opt.value
                              ? "bg-[#008A64] text-white border-[#008A64] shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={GENDER_OPTIONS.find((o) => o.value === gender)?.label || "Chưa cập nhật"}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Vai trò
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value="Quản trị viên"
                      disabled
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50/60 border border-emerald-200 text-[#008A64] cursor-not-allowed"
                    />
                    <ShieldCheck size={16} className="absolute left-3 top-3 text-[#008A64]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Ngày tham gia
                </label>
                <input
                  type="text"
                  value={joinDate}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-500 cursor-not-allowed"
                />
              </div>

              {isEditing && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#008A64] hover:bg-[#007457] shadow-sm shadow-[#008A64]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save size={15} />
                    <span>{loading ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* DEBATER PROFILE LAYOUT: Original 12-column grid with debater stats and radar chart preserved */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Personal Info Form (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-6 flex flex-col justify-between">
            <div>
              {/* Header with Avatar & Name & Edit Button */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="relative group">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#008A64] text-white font-black text-xl flex items-center justify-center shadow-md shadow-[#008A64]/20 border-2 border-slate-100">
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
                      title="Đổi ảnh đại diện"
                      className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-[#008A64] hover:border-[#008A64] shadow-xs transition-all cursor-pointer"
                    >
                      <Camera size={12} />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight">
                      {fullName || user?.fullName || user?.email?.split("@")[0] || "Người dùng"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {email || user?.email || ""}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-[#008A64] text-slate-700 hover:text-[#008A64] text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isEditing ? <X size={13} /> : <Edit3 size={13} />}
                  <span>{isEditing ? "Hủy" : "Chỉnh sửa"}</span>
                </button>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!isEditing || loading}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      isEditing
                        ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                        : "bg-slate-50/80 border-slate-200 text-slate-700"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* 2-Column Row for Phone & DOB */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={!isEditing || loading}
                      placeholder="Chưa cập nhật"
                      className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                        isEditing
                          ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      disabled={!isEditing || loading}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                        isEditing
                          ? "bg-white border-[#008A64] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008A64]/15"
                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                      }`}
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Giới tính
                  </label>
                  {isEditing ? (
                    <div className="flex items-center gap-2.5">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            gender === opt.value
                              ? "bg-[#008A64] text-white border-[#008A64] shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={GENDER_OPTIONS.find((o) => o.value === gender)?.label || "Chưa cập nhật"}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-700 cursor-not-allowed"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Ngày tham gia
                  </label>
                  <input
                    type="text"
                    value={joinDate}
                    disabled
                    className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/80 border border-slate-200 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {isEditing && (
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#008A64] hover:bg-[#007457] shadow-sm shadow-[#008A64]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save size={15} />
                      <span>{loading ? "Đang lưu..." : "Lưu thay đổi"}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Statistics & Skills Radar Chart (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-6">
            {/* Top: Thống kê */}
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">
                Thống kê
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Stat 1 */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
                  <div className="text-xl sm:text-2xl font-black text-[#008A64]">
                    {completedCount}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Phiên hoàn thành
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
                  <div className="text-xl sm:text-2xl font-black text-[#008A64]">
                    {avgScore100 !== null ? avgScore100 : "--"}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Điểm trung bình (/100)
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
                  <div className="text-xl sm:text-2xl font-black text-amber-500">
                    {streakDays}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Ngày liên tiếp
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
                  <div className="text-xl sm:text-2xl font-black text-[#008A64]">
                    {completedCount > 0 ? "Hoạt động" : "Mới"}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Trạng thái
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Kỹ năng Radar Chart */}
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] mb-2">
                Kỹ năng (Rubric 5 tiêu chí)
              </h3>

              <div className="w-full h-64 sm:h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={skillData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      stroke="#cbd5e1"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <Radar
                      name="Kỹ năng"
                      dataKey="A"
                      stroke="#008A64"
                      fill="#008A64"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebaterProfile;


