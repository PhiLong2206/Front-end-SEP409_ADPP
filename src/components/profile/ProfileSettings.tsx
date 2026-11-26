import React, { useState, useEffect } from "react";
import Input from "../common/Input";
import PasswordInput from "../auth/PasswordInput";
import PasswordStrength from "../auth/PasswordStrength";
import PasswordRequirements from "../auth/PasswordRequirements";
import ConfirmPasswordInput from "../auth/ConfirmPasswordInput";
import userApi from "../../api/userApi";
import authApi from "../../api/authApi";
import { useAuth } from "../../hooks/useAuth";
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  UploadCloud,
  User as UserIcon,
} from "lucide-react";

interface ProfileSettingsProps {
  portalTitle?: string;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ portalTitle: _portalTitle = "Thông tin cá nhân & Tài khoản" }) => {
  const { user: authUser, setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"info" | "security">("info");
  const [, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState<{
    fullName: string;
    email: string;
    phoneNumber: string;
    gender: string;
    dateOfBirth: string;
    avatarUrl: string;
    roles: string[];
    isEmailVerified: boolean;
    createdAt: string;
  }>({
    fullName: "",
    email: "",
    phoneNumber: "",
    gender: "Male",
    dateOfBirth: "",
    avatarUrl: "",
    roles: [],
    isEmailVerified: true,
    createdAt: "",
  });

  // Password Form State
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Alerts
  const [infoError, setInfoError] = useState("");
  const [infoSuccess, setInfoSuccess] = useState("");
  const [secError, setSecError] = useState("");
  const [secSuccess, setSecSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const normalizeGender = (g?: string) => {
    if (!g) return "Male";
    const lower = g.toLowerCase();
    if (lower === "male" || lower === "nam") return "Male";
    if (lower === "female" || lower === "nu" || lower === "nữ") return "Female";
    return "Other";
  };

  const fetchProfile = async () => {
    setLoading(true);
    setInfoError("");

    try {
      const res = await userApi.getMyProfile();
      if (res && res.success && res.data) {
        const d = res.data;
        const localSavedAvatar = localStorage.getItem(`adpp_user_avatar_${d.email}`);
        const effectiveAvatar = localSavedAvatar || (d.avatarUrl && d.avatarUrl !== "string" ? d.avatarUrl : "");

        setProfileData({
          fullName: d.fullName || "",
          email: d.email || "",
          phoneNumber: d.phoneNumber || "",
          gender: normalizeGender(d.gender),
          dateOfBirth: d.dateOfBirth ? d.dateOfBirth.split("T")[0] : "",
          avatarUrl: effectiveAvatar,
          roles: d.roles || [],
          isEmailVerified: d.isEmailVerified,
          createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString("vi-VN") : "",
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setInfoError(errorObj?.message || "Không thể tải thông tin hồ sơ từ máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setInfoError("Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setInfoError("Dung lượng ảnh không được vượt quá 5MB.");
      return;
    }

    setInfoError("");
    setUploadingAvatar(true);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setProfileData((prev) => ({ ...prev, avatarUrl: result }));
          setInfoSuccess("Đã tải ảnh lên! Hãy bấm 'Lưu thay đổi' để hoàn tất.");
        }
        setUploadingAvatar(false);
      };
      reader.onerror = () => {
        setInfoError("Không thể đọc tệp ảnh từ thiết bị.");
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setInfoError("Không thể tải ảnh lên. Vui lòng thử lại.");
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setProfileData((prev) => ({ ...prev, avatarUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoError("");
    setInfoSuccess("");

    if (!profileData.fullName.trim()) {
      setInfoError("Họ và tên không được để trống.");
      return;
    }

    setSaving(true);

    try {
      let backendAvatarUrl: string | undefined = undefined;
      if (profileData.avatarUrl && profileData.avatarUrl !== "string") {
        if (profileData.avatarUrl.startsWith("http") && profileData.avatarUrl.length <= 500) {
          backendAvatarUrl = profileData.avatarUrl;
        } else {
          backendAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.fullName.trim())}&background=2563eb&color=fff`;
        }
      }

      const payload: {
        fullName: string;
        avatarUrl?: string;
        phoneNumber?: string;
        gender?: string;
        dateOfBirth?: string;
      } = {
        fullName: profileData.fullName.trim(),
        avatarUrl: backendAvatarUrl,
        phoneNumber: profileData.phoneNumber.trim() ? profileData.phoneNumber.trim() : undefined,
        gender: profileData.gender || "Male",
        dateOfBirth: profileData.dateOfBirth
          ? new Date(profileData.dateOfBirth).toISOString()
          : undefined,
      };

      const res = await userApi.updateMyProfile(payload);

      if (res && res.success) {
        setInfoSuccess(res.message || "Cập nhật hồ sơ thành công!");

        if (profileData.avatarUrl && profileData.avatarUrl !== "string") {
          localStorage.setItem(`adpp_user_avatar_${profileData.email}`, profileData.avatarUrl);
        } else {
          localStorage.removeItem(`adpp_user_avatar_${profileData.email}`);
        }

        if (authUser) {
          setUser({
            ...authUser,
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber,
            avatarUrl: profileData.avatarUrl,
          });
        }
      } else {
        setInfoError(res?.message || "Không thể cập nhật hồ sơ.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setInfoError(errorObj?.message || "Lỗi cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError("");
    setSecSuccess("");

    if (!passwords.currentPassword) {
      setSecError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (passwords.newPassword.length < 8) {
      setSecError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setSecError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      if (res && res.success) {
        setSecSuccess(res.message || "Đổi mật khẩu thành công!");
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setSecError(res?.message || "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setSecError(errorObj?.message || "Mật khẩu hiện tại không chính xác.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 text-slate-900 shadow-xs">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            {profileData.avatarUrl && profileData.avatarUrl !== "string" ? (
              <img
                src={profileData.avatarUrl}
                alt={profileData.fullName}
                className="w-18 h-18 rounded-2xl object-cover border-2 border-[#0B5ED7]/40 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-18 h-18 rounded-2xl bg-[#EAF2FF] border border-[#0B5ED7]/30 flex items-center justify-center font-black text-2xl text-[#0B5ED7] shadow-xs shrink-0">
                {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  {profileData.fullName || authUser?.fullName || "Người dùng"}
                </h1>
                <span className="px-3 py-1 rounded-full bg-[#EAF2FF] border border-[#0B5ED7]/30 text-[#0B5ED7] text-xs font-bold uppercase tracking-wider">
                  {profileData.roles?.length
                    ? profileData.roles.map((r) => (r === "Admin" || r === "Administrator" ? "Quản trị viên" : r === "Organizer" || r === "Educator" || r === "Lecturer" ? "Giảng viên" : "Học viên")).join(", ")
                    : authUser?.role === "Administrator" || authUser?.role === "Admin"
                    ? "Quản trị viên"
                    : authUser?.role === "Organizer" || authUser?.role === "Educator" || authUser?.role === "Lecturer"
                    ? "Giảng viên"
                    : "Học viên"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center gap-2">
                <Mail size={16} className="text-[#0B5ED7]" />
                <span>{profileData.email || authUser?.email}</span>
                {profileData.createdAt && (
                  <span className="ml-2 text-slate-400 font-mono">• Tham gia từ {profileData.createdAt}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#EAF2FF] border border-[#0B5ED7]/30 px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold text-blue-800 shadow-xs">
            <Shield size={16} className="text-[#0B5ED7]" />
            <span>Tài khoản đã xác thực OTP</span>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`pb-3.5 px-4 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "info"
              ? "border-[#0B5ED7] text-[#0B5ED7]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserIcon size={16} />
          <span>Thông tin cá nhân</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`pb-3.5 px-4 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "security"
              ? "border-[#0B5ED7] text-[#0B5ED7]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <KeyRound size={16} />
          <span>Bảo mật & Đổi mật khẩu</span>
        </button>
      </div>

      {/* TAB 1: Profile Information Form */}
      {activeTab === "info" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-xs">
          <div className="mb-7">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Chi tiết hồ sơ cá nhân</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Cập nhật thông tin nhận diện và liên hệ của bạn trên hệ thống.
            </p>
          </div>

          {infoError && (
            <div className="p-4 mb-6 text-xs sm:text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-fade-in flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>{infoError}</span>
            </div>
          )}

          {infoSuccess && (
            <div className="p-4 mb-6 text-xs sm:text-sm rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium animate-fade-in flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#0B5ED7] shrink-0" />
              <span>{infoSuccess}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Họ và tên"
                name="fullName"
                value={profileData.fullName}
                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                required
              />

              <Input
                label="Địa chỉ Email (Định danh tài khoản)"
                name="email"
                value={profileData.email}
                disabled
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Input
                label="Số điện thoại"
                name="phoneNumber"
                placeholder="Ví dụ: 0912345678"
                value={profileData.phoneNumber}
                onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
              />

              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-xs sm:text-sm font-semibold text-slate-700">Giới tính</label>
                <select
                  name="gender"
                  value={profileData.gender}
                  onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm sm:text-base bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                >
                  <option value="Male">Nam</option>
                  <option value="Female">Nữ</option>
                  <option value="Other">Khác</option>
                </select>
              </div>

              <Input
                label="Ngày sinh"
                name="dateOfBirth"
                type="date"
                value={profileData.dateOfBirth}
                onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
              />
            </div>

            {/* Avatar Upload Section */}
            <div className="pt-2 pb-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-3">
                Ảnh đại diện (Tải lên từ máy tính hoặc điện thoại)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  title="Nhấn để chọn ảnh mới"
                >
                  {profileData.avatarUrl && profileData.avatarUrl !== "string" ? (
                    <img
                      src={profileData.avatarUrl}
                      alt="Avatar Preview"
                      className="w-24 h-24 rounded-2xl object-cover border-2 border-[#0B5ED7]/40 shadow-xs transition-all group-hover:opacity-80"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-[#EAF2FF] border border-[#0B5ED7]/30 flex items-center justify-center font-black text-3xl text-[#0B5ED7] shadow-xs group-hover:opacity-80 transition-all">
                      {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={22} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">Đổi ảnh</span>
                  </div>

                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-900/80 rounded-2xl flex flex-col items-center justify-center">
                      <Loader2 size={24} className="text-[#0B5ED7] animate-spin" />
                      <span className="text-[10px] text-white mt-1">Đang tải...</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="avatar-upload-input"
                    />

                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-[#EAF2FF] hover:bg-blue-100 text-[#0B5ED7] border border-[#0B5ED7]/30 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 hover:scale-102 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      <span>{uploadingAvatar ? "Đang xử lý ảnh..." : "Chọn ảnh từ thiết bị"}</span>
                    </button>

                    {profileData.avatarUrl && profileData.avatarUrl !== "string" && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        title="Xóa ảnh đại diện"
                      >
                        <Trash2 size={15} />
                        <span>Xóa ảnh</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500">
                    Hỗ trợ định dạng JPG, PNG, WEBP, GIF (Tối đa 5MB). Tương thích mọi trình duyệt và camera điện thoại.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="px-8 py-3.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-sm sm:text-base font-bold rounded-2xl shadow-md shadow-[#0B5ED7]/20 transition-all inline-flex items-center gap-2 disabled:opacity-50 hover:scale-102 cursor-pointer"
              >
                <Save size={18} />
                <span>{saving ? "Đang lưu..." : "Lưu thay đổi"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Change Password Form */}
      {activeTab === "security" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-xs">
          <div className="mb-7">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Thay đổi mật khẩu</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Đảm bảo an toàn tài khoản bằng cách đặt mật khẩu phức tạp có tối thiểu 8 ký tự.
            </p>
          </div>

          {secError && (
            <div className="p-4 mb-6 text-xs sm:text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-fade-in flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>{secError}</span>
            </div>
          )}

          {secSuccess && (
            <div className="p-4 mb-6 text-xs sm:text-sm rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium animate-fade-in flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#0B5ED7] shrink-0" />
              <span>{secSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <PasswordInput
              label="Mật khẩu hiện tại"
              name="currentPassword"
              placeholder="••••••••••••"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
              disabled={changingPassword}
            />

            <div>
              <PasswordInput
                label="Mật khẩu mới"
                name="newPassword"
                placeholder="••••••••••••"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
                disabled={changingPassword}
              />
              <PasswordStrength password={passwords.newPassword} />
              <PasswordRequirements password={passwords.newPassword} />
            </div>

            <ConfirmPasswordInput
              label="Xác nhận mật khẩu mới"
              name="confirmPassword"
              placeholder="••••••••••••"
              value={passwords.confirmPassword}
              originalPassword={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              required
              disabled={changingPassword}
            />

            <div className="pt-3">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-8 py-3.5 bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-sm sm:text-base font-bold rounded-2xl shadow-md shadow-[#0B5ED7]/20 transition-all inline-flex items-center gap-2 disabled:opacity-50 hover:scale-102 cursor-pointer"
              >
                <Lock size={18} />
                <span>{changingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProfileSettings;


