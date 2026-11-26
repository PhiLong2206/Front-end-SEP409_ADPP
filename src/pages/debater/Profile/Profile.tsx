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

  const surface = "rounded-ap-xl bg-elevated shadow-ap-sm";
  const labelClass = "mb-(--s-2) block text-(length:--text-callout) font-medium text-label-secondary";
  const fieldBase =
    "h-11 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-callout) text-label outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap placeholder:text-label-tertiary focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-default";
  const fieldClass = (editable: boolean) => `${fieldBase} ${editable ? "" : "text-label-secondary"}`;
  const displayName = fullName || user?.fullName || user?.email?.split("@")[0] || (isAdmin ? "Quản trị viên" : "Người dùng");

  const avatar = (size: "sm" | "lg") => (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent ${
          size === "lg" ? "h-24 w-24 text-(length:--text-title)" : "h-16 w-16 text-(length:--text-headline)"
        }`}
      >
        {effectiveAvatar ? (
          <img src={effectiveAvatar} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          <span>{fullName ? fullName.charAt(0).toUpperCase() : isAdmin ? "A" : "L"}</span>
        )}
      </div>
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Đổi ảnh đại diện"
        aria-label="Đổi ảnh đại diện"
        className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-elevated text-label-secondary shadow-ap-md transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
      >
        <Camera size={15} aria-hidden="true" />
      </button>
    </div>
  );

  const editButton = (
    <button
      type="button"
      onClick={() => setIsEditing(!isEditing)}
      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
    >
      {isEditing ? <X size={15} aria-hidden="true" /> : <Edit3 size={15} aria-hidden="true" />}
      <span>{isEditing ? "Hủy" : "Chỉnh sửa"}</span>
    </button>
  );

  const form = (
    <form onSubmit={handleSaveProfile} className="space-y-(--s-4)">
      <div>
        <label htmlFor="profile-name" className={labelClass}>Họ và tên</label>
        <input
          id="profile-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={!isEditing || loading}
          className={fieldClass(isEditing)}
        />
      </div>

      <div>
        <label htmlFor="profile-email" className={labelClass}>Email</label>
        <input id="profile-email" type="email" value={email} disabled className={fieldClass(false)} />
      </div>

      <div className="grid grid-cols-1 gap-(--s-4) sm:grid-cols-2">
        <div>
          <label htmlFor="profile-phone" className={labelClass}>Số điện thoại</label>
          <input
            id="profile-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={!isEditing || loading}
            placeholder="Chưa cập nhật"
            className={fieldClass(isEditing)}
          />
        </div>
        <div>
          <label htmlFor="profile-dob" className={labelClass}>Ngày sinh</label>
          <input
            id="profile-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            disabled={!isEditing || loading}
            className={fieldClass(isEditing)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-(--s-4) sm:grid-cols-2">
        <div>
          <span className={labelClass}>Giới tính</span>
          {isEditing ? (
            <div role="group" aria-label="Giới tính" className="inline-flex gap-1 rounded-ap-pill bg-canvas-secondary p-1">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={gender === opt.value}
                  onClick={() => setGender(opt.value)}
                  className={`min-h-9 cursor-pointer rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                    gender === opt.value ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              aria-label="Giới tính"
              value={GENDER_OPTIONS.find((o) => o.value === gender)?.label || "Chưa cập nhật"}
              disabled
              className={fieldClass(false)}
            />
          )}
        </div>

        {isAdmin ? (
          <div>
            <label htmlFor="profile-role" className={labelClass}>Vai trò</label>
            <input id="profile-role" type="text" value="Quản trị viên" disabled className={`${fieldClass(false)} font-medium text-accent`} />
          </div>
        ) : (
          <div>
            <label htmlFor="profile-joined" className={labelClass}>Ngày tham gia</label>
            <input id="profile-joined" type="text" value={joinDate} disabled className={fieldClass(false)} />
          </div>
        )}
      </div>

      {isAdmin && (
        <div>
          <label htmlFor="profile-joined" className={labelClass}>Ngày tham gia</label>
          <input id="profile-joined" type="text" value={joinDate} disabled className={fieldClass(false)} />
        </div>
      )}

      {isEditing && (
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} aria-hidden="true" />
          <span>{loading ? "Đang lưu..." : "Lưu thay đổi"}</span>
        </button>
      )}
    </form>
  );

  const stats = [
    { label: "Phiên hoàn thành", value: String(completedCount) },
    { label: "Điểm trung bình (/100)", value: avgScore100 !== null ? String(avgScore100) : "--" },
    { label: "Ngày liên tiếp", value: String(streakDays) },
    { label: "Trạng thái", value: completedCount > 0 ? "Hoạt động" : "Mới" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Title */}
      <section className="space-y-(--s-2) pt-(--s-4)">
        <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
          {isAdmin ? "Hồ sơ quản trị viên" : "Hồ sơ cá nhân"}
        </h1>
        {isAdmin && (
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Thông tin tài khoản và quyền hạn quản trị hệ thống ADPP
          </p>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) text-label animate-fade-in">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {isAdmin ? (
        <div className="grid grid-cols-1 items-start gap-(--s-5) lg:grid-cols-12">
          {/* Identity */}
          <section className={`${surface} space-y-(--s-5) p-(--s-6) lg:col-span-5`}>
            <div className="flex flex-col items-center text-center">
              {avatar("lg")}
              <h2 className="mt-(--s-4) text-(length:--text-headline) font-semibold leading-(--leading-snug)">{displayName}</h2>
              <p className="mt-(--s-1) text-(length:--text-callout) text-label-secondary">{email || user?.email || ""}</p>
            </div>

            <dl className="space-y-(--s-3) border-t border-separator pt-(--s-4) text-(length:--text-callout)">
              <div className="flex items-center justify-between gap-(--s-3)">
                <dt className="inline-flex items-center gap-(--s-2) text-label-secondary">
                  <ShieldCheck size={15} aria-hidden="true" /> Vai trò
                </dt>
                <dd className="font-medium">Quản trị viên</dd>
              </div>
              <div className="flex items-center justify-between gap-(--s-3)">
                <dt className="inline-flex items-center gap-(--s-2) text-label-secondary">
                  <Calendar size={15} aria-hidden="true" /> Ngày tham gia
                </dt>
                <dd className="font-medium">{joinDate || "Chưa cập nhật"}</dd>
              </div>
              <div className="flex items-center justify-between gap-(--s-3)">
                <dt className="inline-flex items-center gap-(--s-2) text-label-secondary">
                  <CheckCircle2 size={15} aria-hidden="true" /> Trạng thái
                </dt>
                <dd className="inline-flex items-center gap-(--s-2) font-medium">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ap-success" />
                  Đang hoạt động
                </dd>
              </div>
            </dl>
          </section>

          {/* Details */}
          <section className={`${surface} space-y-(--s-5) p-(--s-6) lg:col-span-7`}>
            <div className="flex items-center justify-between gap-(--s-3)">
              <div>
                <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Thông tin chi tiết</h3>
                <p className="text-(length:--text-callout) text-label-secondary">Thông tin liên hệ và hồ sơ cá nhân quản trị viên</p>
              </div>
              {editButton}
            </div>
            {form}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-(--s-5) lg:grid-cols-12">
          {/* Personal info */}
          <section className={`${surface} space-y-(--s-5) p-(--s-6) lg:col-span-5`}>
            <div className="flex items-center justify-between gap-(--s-3)">
              <div className="flex min-w-0 items-center gap-(--s-4)">
                {avatar("sm")}
                <div className="min-w-0">
                  <h2 className="truncate text-(length:--text-headline) font-semibold leading-(--leading-snug)">{displayName}</h2>
                  <p className="truncate text-(length:--text-callout) text-label-secondary">{email || user?.email || ""}</p>
                </div>
              </div>
              {editButton}
            </div>
            {form}
          </section>

          {/* Statistics and skills */}
          <div className="space-y-(--s-5) lg:col-span-7">
            <section aria-label="Thống kê" className={surface}>
              <h3 className="px-(--s-6) pt-(--s-5) text-(length:--text-caption) font-medium uppercase tracking-wider text-label-secondary">
                Thống kê
              </h3>
              <div className="grid grid-cols-2 divide-separator sm:grid-cols-4 sm:divide-x">
                {stats.map((s) => (
                  <div key={s.label} className="p-(--s-5)">
                    <div className="text-(length:--text-title) font-semibold leading-none tracking-(--tracking-display) tabular-nums">{s.value}</div>
                    <div className="mt-(--s-2) text-(length:--text-callout) text-label-secondary">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${surface} p-(--s-6)`}>
              <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Kỹ năng (Rubric 5 tiêu chí)</h3>
              <div className="mt-(--s-3) flex h-64 w-full items-center justify-center sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={skillData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="var(--separator)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--label-secondary)", fontSize: 13 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--separator)" tick={{ fill: "var(--label-tertiary)", fontSize: 11 }} />
                    <Radar name="Kỹ năng" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebaterProfile;
