import React, { useState, useEffect } from "react";
import Modal from "../../common/Modal";
import Button from "../../common/Button";
import competitionApi from "../../../api/competitionApi";
import paymentApi from "../../../api/paymentApi";
import { useCredit } from "../../../hooks/useCredit";
import { CompetitionDetail, CreateCompetitionDto, PatchCompetitionDto, CompetitionType } from "../../../types";
import { toDateInputString, parseApiDate } from "../../../utils/formatDate";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  competitionToEdit?: CompetitionDetail | null;
  onSuccess: (createdOrUpdatedComp?: CompetitionDetail) => void;
}

interface FormErrors {
  title?: string;
  registrationStart?: string;
  registrationEnd?: string;
  startDate?: string;
  endDate?: string;
  maxParticipants?: string;
}

// Business Rule: Bất kỳ Authenticated user nào cũng có thể tạo cuộc thi (Creator tự động thành Judge). Khi Backend bổ sung Credit Cost API sau này sẽ integrate tiếp.

const CompetitionFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  competitionToEdit,
  onSuccess,
}) => {
  const isEditing = Boolean(competitionToEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [competitionType, setCompetitionType] = useState<CompetitionType>("INDIVIDUAL");
  const [formatId, setFormatId] = useState<number | "">("");
  const [maxParticipants, setMaxParticipants] = useState<number | "">("");
  const [registrationStart, setRegistrationStart] = useState("");
  const [registrationEnd, setRegistrationEnd] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { balance: liveBalance, loading: creditLoading } = useCredit();
  const [walletBalance, setWalletBalance] = useState<number | null>(liveBalance);
  const [walletLoading, setWalletLoading] = useState(creditLoading);

  useEffect(() => {
    if (typeof liveBalance === "number") {
      setWalletBalance(liveBalance);
    }
  }, [liveBalance]);

  useEffect(() => {
    setWalletLoading(creditLoading);
  }, [creditLoading]);

  useEffect(() => {
    if (isOpen && !isEditing && walletBalance === null) {
      setWalletLoading(true);
      paymentApi
        .getMyWallet()
        .then((res) => {
          if (res.success && res.data) {
            setWalletBalance(res.data.balance);
          }
        })
        .catch(() => {
          setWalletBalance(null);
        })
        .finally(() => {
          setWalletLoading(false);
        });
    }
  }, [isOpen, isEditing, walletBalance]);

  const participantCount = Number(maxParticipants) || 16;
  const [dynamicRequiredCredits, setDynamicRequiredCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || isEditing) return;
    const timer = setTimeout(() => {
      paymentApi
        .getCompetitionPrice({
          type: competitionType,
          maxParticipants: participantCount,
        })
        .then((res) => {
          if (res?.success && res.data?.requiredCredits) {
            setDynamicRequiredCredits(res.data.requiredCredits);
          }
        })
        .catch(() => {
          setDynamicRequiredCredits(null);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen, isEditing, competitionType, participantCount]);

  const estimatedCredits =
    dynamicRequiredCredits ??
    (participantCount <= 8 ? 500 : participantCount <= 16 ? 1200 : 2500);
  const isBalanceInsufficient = walletBalance !== null && walletBalance < estimatedCredits;

  useEffect(() => {
    if (competitionToEdit) {
      setTitle(competitionToEdit.title || "");
      setDescription(competitionToEdit.description || "");
      setCompetitionType(competitionToEdit.competitionType || "INDIVIDUAL");
      setFormatId(competitionToEdit.formatId ?? "");
      setMaxParticipants(competitionToEdit.maxParticipants ?? "");
      setRegistrationStart(toDateInputString(competitionToEdit.registrationStart));
      setRegistrationEnd(toDateInputString(competitionToEdit.registrationEnd));
      setStartDate(toDateInputString(competitionToEdit.startDate));
      setEndDate(toDateInputString(competitionToEdit.endDate));
      setIsPublic(competitionToEdit.isPublic ?? true);
    } else {
      // Default dates for new competition in local time
      const now = new Date();
      const inOneWeek = new Date(now.getTime() + 7 * 86400000);
      const inTwoWeeks = new Date(now.getTime() + 14 * 86400000);
      const inThreeWeeks = new Date(now.getTime() + 21 * 86400000);

      setTitle("");
      setDescription("");
      setCompetitionType("INDIVIDUAL");
      setFormatId(2);
      setMaxParticipants(16);
      setRegistrationStart(toDateInputString(now));
      setRegistrationEnd(toDateInputString(inOneWeek));
      setStartDate(toDateInputString(inTwoWeeks));
      setEndDate(toDateInputString(inThreeWeeks));
      setIsPublic(true);
    }
    setFieldErrors({});
    setServerError(null);
  }, [competitionToEdit, isOpen]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!title.trim()) {
      errors.title = "Tên cuộc thi là bắt buộc.";
    } else if (title.trim().length > 200) {
      errors.title = "Tên cuộc thi không được vượt quá 200 ký tự.";
    }

    if (maxParticipants !== "" && Number(maxParticipants) <= 0) {
      errors.maxParticipants = "Số lượng tối đa phải lớn hơn 0.";
    }

    if (!registrationStart) {
      errors.registrationStart = "Thời gian bắt đầu đăng ký là bắt buộc.";
    }

    if (!registrationEnd) {
      errors.registrationEnd = "Thời gian kết thúc đăng ký là bắt buộc.";
    } else if (registrationStart && new Date(registrationEnd) <= new Date(registrationStart)) {
      errors.registrationEnd = "Thời gian kết thúc đăng ký phải sau thời gian bắt đầu đăng ký.";
    }

    if (!startDate) {
      errors.startDate = "Thời gian bắt đầu thi đấu là bắt buộc.";
    } else if (registrationEnd && new Date(startDate) < new Date(registrationEnd)) {
      errors.startDate = "Thời gian bắt đầu thi đấu phải từ hoặc sau thời gian kết thúc đăng ký.";
    }

    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = "Thời gian kết thúc cuộc thi phải từ hoặc sau thời gian bắt đầu thi đấu.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setServerError(null);

    try {
      if (isEditing && competitionToEdit) {
        // PATCH only updated fields (partial update)
        const patchData: PatchCompetitionDto = {};

        if (title.trim() !== competitionToEdit.title) {
          patchData.title = title.trim();
        }
        if ((description.trim() || undefined) !== (competitionToEdit.description || undefined)) {
          patchData.description = description.trim();
        }
        if ((formatId ? Number(formatId) : null) !== (competitionToEdit.formatId ?? null)) {
          patchData.formatId = formatId ? Number(formatId) : null;
        }
        if ((maxParticipants ? Number(maxParticipants) : null) !== (competitionToEdit.maxParticipants ?? null)) {
          patchData.maxParticipants = maxParticipants ? Number(maxParticipants) : null;
        }
        const origRegStartISO = parseApiDate(competitionToEdit.registrationStart)?.toISOString();
        const regStartISO = new Date(registrationStart).toISOString();
        if (regStartISO !== origRegStartISO) {
          patchData.registrationStart = regStartISO;
        }

        const origRegEndISO = parseApiDate(competitionToEdit.registrationEnd)?.toISOString();
        const regEndISO = new Date(registrationEnd).toISOString();
        if (regEndISO !== origRegEndISO) {
          patchData.registrationEnd = regEndISO;
        }

        const origStartDateISO = parseApiDate(competitionToEdit.startDate)?.toISOString();
        const startDateISO = new Date(startDate).toISOString();
        if (startDateISO !== origStartDateISO) {
          patchData.startDate = startDateISO;
        }

        const origEndDateISO = competitionToEdit.endDate ? parseApiDate(competitionToEdit.endDate)?.toISOString() : null;
        const endDateISO = endDate ? new Date(endDate).toISOString() : null;
        if (endDateISO !== origEndDateISO) {
          patchData.endDate = endDateISO;
        }
        if (isPublic !== competitionToEdit.isPublic) {
          patchData.isPublic = isPublic;
        }

        const res = await competitionApi.patchCompetition(competitionToEdit.competitionId, patchData);
        if (res.success) {
          onSuccess(res.data);
          onClose();
        } else {
          setServerError(res.message || "Cập nhật cuộc thi thất bại.");
        }
      } else {
        // POST create new competition
        // Backend handles CreatedBy from JWT, and initial status is Draft
        const createData: CreateCompetitionDto = {
          title: title.trim(),
          description: description.trim() || undefined,
          competitionType,
          formatId: formatId ? Number(formatId) : undefined,
          maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
          registrationStart: new Date(registrationStart).toISOString(),
          registrationEnd: new Date(registrationEnd).toISOString(),
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          isPublic,
        };

        const res = await competitionApi.createCompetition(createData);
        if (res.success) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("wallet_updated"));
          }
          onSuccess(res.data);
          onClose();
        } else {
          setServerError(res.message || "Tạo cuộc thi thất bại.");
        }
      }
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        code?: string;
        status?: number;
        statusCode?: number;
        errors?: Record<string, string[]> | string | { requiredCredits?: number; currentCredits?: number; missingCredits?: number };
        data?: { requiredCredits?: number; currentCredits?: number; missingCredits?: number };
      };

      const httpStatus = e.status || e.statusCode;
      const isInsufficient =
        e.code === "INSUFFICIENT_CREDITS" ||
        Boolean(e.data?.requiredCredits) ||
        (typeof e.errors === "object" && e.errors !== null && "requiredCredits" in e.errors);

      if (isInsufficient) {
        const req = e.data?.requiredCredits ?? (e.errors as { requiredCredits?: number })?.requiredCredits;
        const cur = e.data?.currentCredits ?? (e.errors as { currentCredits?: number })?.currentCredits ?? (walletBalance ?? 0);
        setServerError(
          `Số dư Credit không đủ để tạo giải đấu (Cần ${req ? Number(req).toLocaleString() : estimatedCredits.toLocaleString()} Credit, hiện có ${Number(cur).toLocaleString()} Credit). Vui lòng nạp thêm Credit để tiếp tục.`
        );
      } else if (httpStatus === 401) {
        setServerError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.");
      } else if (httpStatus === 403 || e.errors === "FORBIDDEN" || e.code === "FORBIDDEN") {
        setServerError("Bạn không có quyền thực hiện thao tác này trên cuộc thi.");
      } else if (e.errors && typeof e.errors === "object" && !Array.isArray(e.errors)) {
        const firstErr = Object.values(e.errors)
          .flat()
          .find((val) => typeof val === "string");
        setServerError(firstErr || e.message || "Đã xảy ra lỗi khi lưu cuộc thi.");
      } else if (typeof e.errors === "string" && e.errors.trim()) {
        setServerError(e.message || e.errors || "Đã xảy ra lỗi khi lưu cuộc thi.");
      } else {
        setServerError(e.message || "Đã xảy ra lỗi khi lưu cuộc thi.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh sửa thông tin cuộc thi" : "Tạo cuộc thi / giải đấu mới"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {serverError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl text-xs">
            {serverError}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Tên giải đấu <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden transition-colors ${
              fieldErrors.title ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
            }`}
            placeholder="Ví dụ: Giải Tranh Biện Sinh Viên Toàn Quốc 2026..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
            }}
          />
          {fieldErrors.title && (
            <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Mô tả thể lệ & nội dung</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden"
            placeholder="Chi tiết về chủ đề, quy tắc chấm điểm, cơ cấu giải thưởng..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Competition Type & Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Hình thức thi đấu <span className="text-rose-500">*</span>
            </label>
            <select
              id="competitionType"
              name="competitionType"
              disabled={isEditing}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
              value={competitionType}
              onChange={(e) => {
                const nextType = e.target.value as CompetitionType;
                setCompetitionType(nextType);
                if (nextType === "INDIVIDUAL") {
                  setFormatId(2);
                } else if (nextType === "TEAM") {
                  setFormatId(4);
                }
              }}
            >
              <option value="INDIVIDUAL">Cá nhân (INDIVIDUAL - 1v1)</option>
              <option value="TEAM">Đồng đội (TEAM - 2v2)</option>
            </select>
            {isEditing && (
              <p className="text-[10px] text-slate-400 mt-0.5">Không thể đổi hình thức thi đấu khi đã tạo.</p>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Thể thức tranh biện</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden"
              value={formatId}
              onChange={(e) => setFormatId(e.target.value ? Number(e.target.value) : "")}
            >
              {competitionType === "INDIVIDUAL" ? (
                <option value="2">1 vs 1 Đối kháng (FormatId: 2)</option>
              ) : (
                <option value="4">Team Debate 2v2 (FormatId: 4)</option>
              )}
            </select>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {competitionType === "INDIVIDUAL"
                ? "Giải đấu đối kháng trực tiếp 1v1 giữa hai thí sinh."
                : "Giải đấu đối kháng 2v2 (Captain và 1 thành viên mỗi đội)."}
            </p>
          </div>
        </div>

        {/* Max Participants */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Số lượng tối đa ({competitionType === "TEAM" ? "Đội" : "Thí sinh"})
          </label>
          <input
            type="number"
            min={2}
            className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden ${
              fieldErrors.maxParticipants ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
            }`}
            placeholder="Ví dụ: 16"
            value={maxParticipants}
            onChange={(e) => {
              setMaxParticipants(e.target.value ? Number(e.target.value) : "");
              if (fieldErrors.maxParticipants) setFieldErrors((prev) => ({ ...prev, maxParticipants: undefined }));
            }}
          />
          {fieldErrors.maxParticipants && (
            <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.maxParticipants}</p>
          )}
        </div>

        {/* Registration Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Bắt đầu đăng ký <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden ${
                fieldErrors.registrationStart ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              }`}
              value={registrationStart}
              onChange={(e) => {
                setRegistrationStart(e.target.value);
                if (fieldErrors.registrationStart) setFieldErrors((prev) => ({ ...prev, registrationStart: undefined }));
              }}
            />
            {fieldErrors.registrationStart && (
              <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.registrationStart}</p>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Kết thúc đăng ký <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden ${
                fieldErrors.registrationEnd ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              }`}
              value={registrationEnd}
              onChange={(e) => {
                setRegistrationEnd(e.target.value);
                if (fieldErrors.registrationEnd) setFieldErrors((prev) => ({ ...prev, registrationEnd: undefined }));
              }}
            />
            {fieldErrors.registrationEnd && (
              <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.registrationEnd}</p>
            )}
          </div>
        </div>

        {/* Competition Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Bắt đầu thi đấu <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden ${
                fieldErrors.startDate ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              }`}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
              }}
            />
            {fieldErrors.startDate && (
              <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.startDate}</p>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Dự kiến kết thúc</label>
            <input
              type="datetime-local"
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-[#0B5ED7] focus:outline-hidden ${
                fieldErrors.endDate ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              }`}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (fieldErrors.endDate) setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
              }}
            />
            {fieldErrors.endDate && (
              <p className="text-rose-600 text-[11px] font-medium mt-1">{fieldErrors.endDate}</p>
            )}
          </div>
        </div>

        {/* Public Toggle */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 text-[#0B5ED7] rounded-sm focus:ring-[#0B5ED7] accent-[#0B5ED7]"
          />
          <label htmlFor="isPublic" className="font-semibold text-slate-700 cursor-pointer">
            Công khai cuộc thi (Hiển thị cho tất cả thí sinh)
          </label>
        </div>

        {!isEditing && (
          <div
            className={`p-3.5 rounded-xl border space-y-2 transition-all ${
              isBalanceInsufficient
                ? "bg-rose-50/80 border-rose-200 text-rose-900"
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
              <span className="flex items-center gap-1.5">
                <span>💰 Chi phí khởi tạo giải đấu:</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg border bg-amber-100 text-amber-800 border-amber-300">
                  {estimatedCredits.toLocaleString()} Credit
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-slate-600">Số dư ví của bạn:</span>
                <span
                  className={`font-mono font-extrabold ${
                    isBalanceInsufficient ? "text-rose-600" : "text-[#008A64]"
                  }`}
                >
                  {walletLoading
                    ? "Đang tải..."
                    : walletBalance !== null
                    ? `${walletBalance.toLocaleString()} Credit`
                    : "--"}
                </span>
              </span>
            </div>

            <p className="text-[11px] leading-relaxed opacity-90">
              * Quy mô: {participantCount <= 8 ? "Nhỏ (≤ 8 cá nhân / 4 đội - 500 Credit)" : participantCount <= 16 ? "Vừa (≤ 16 cá nhân / 8 đội - 1.200 Credit)" : "Lớn (≤ 32 cá nhân / 16 đội - 2.500 Credit)"}. Credit sẽ được trừ một lần từ ví của người tạo khi tạo giải thành công. Thí sinh tham gia thi đấu hoàn toàn miễn phí (0 Credit).
            </p>

            {isBalanceInsufficient && (
              <div className="flex items-center justify-between pt-1 border-t border-rose-200/80 text-xs flex-wrap gap-2">
                <span className="font-semibold text-rose-700">
                  ⚠️ Số dư hiện tại không đủ (thiếu {(estimatedCredits - (walletBalance ?? 0)).toLocaleString()} Credit).
                </span>
                <a
                  href="/debater/payments"
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                >
                  Nạp thêm Credit →
                </a>
              </div>
            )}
          </div>
        )}

        {!isEditing && (
          <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            * Sau khi tạo, cuộc thi sẽ ở trạng thái <strong>Bản nháp (Draft)</strong> và bạn sẽ tự động là Giám khảo. Bạn có thể mở đăng ký khi đã sẵn sàng.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={loading}>
            {loading ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo cuộc thi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CompetitionFormModal;
