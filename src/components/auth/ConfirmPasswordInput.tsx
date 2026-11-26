import { useState, forwardRef, InputHTMLAttributes } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";

export interface ConfirmPasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  originalPassword?: string;
  required?: boolean;
  /** "apple": the calm look of the sign-in and sign-up screens. */
  appearance?: "default" | "apple";
}

const ConfirmPasswordInput = forwardRef<HTMLInputElement, ConfirmPasswordInputProps>(
  (
    {
      label = "Xác nhận mật khẩu",
      id,
      name = "confirmPassword",
      placeholder = "••••••••••••",
      value = "",
      originalPassword = "",
      onChange,
      required = true,
      disabled = false,
      className = "",
      appearance = "default",
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState(false);
    const inputId = id || name;

    const valueStr = String(value);
    const isMatching = valueStr.length > 0 && valueStr === originalPassword;
    const isMismatched = touched && valueStr.length > 0 && valueStr !== originalPassword;

    if (appearance === "apple") {
      return (
        <div className={`flex flex-col gap-(--s-2) ${className}`}>
          <div className="flex items-baseline justify-between gap-(--s-3)">
            <label htmlFor={inputId} className="text-(length:--text-caption) font-medium text-label-secondary">
              {label}
              {required && <span className="sr-only"> (bắt buộc)</span>}
            </label>
            {isMatching && (
              <span className="inline-flex items-center gap-1 text-(length:--text-caption) font-medium text-accent">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>Mật khẩu khớp</span>
              </span>
            )}
          </div>
          <div className="relative">
            <input
              ref={ref}
              id={inputId}
              name={name}
              type={showPassword ? "text" : "password"}
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                if (!touched) setTouched(true);
                onChange?.(e);
              }}
              onBlur={() => setTouched(true)}
              disabled={disabled}
              required={required}
              aria-invalid={isMismatched ? true : undefined}
              className={`h-12 w-full rounded-ap-md border bg-canvas-secondary pl-(--s-4) pr-12 text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                isMismatched
                  ? "border-ap-danger focus-visible:ring-ap-danger/25"
                  : "border-transparent focus-visible:border-accent focus-visible:ring-accent/25"
              }`}
              {...props}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={disabled}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-ap-md text-label-secondary transition-colors hover:text-label cursor-pointer focus-visible:outline-none focus-visible:text-accent"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {isMismatched && (
            <span role="alert" className="inline-flex items-center gap-1.5 text-(length:--text-caption) text-label">
              <AlertCircle size={14} className="shrink-0 text-ap-danger" aria-hidden="true" />
              <span>Mật khẩu xác nhận không khớp.</span>
            </span>
          )}
        </div>
      );
    }

    return (
      <div className={`flex flex-col gap-1.5 mb-3.5 ${className}`}>
        <label
          htmlFor={inputId}
          className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC] flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {isMatching && (
            <span className="text-xs text-blue-600 dark:text-[#60A5FA] font-semibold inline-flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>Mật khẩu khớp</span>
            </span>
          )}
        </label>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock size={16} />
          </div>

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={showPassword ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              if (!touched) setTouched(true);
              onChange?.(e);
            }}
            onBlur={() => setTouched(true)}
            disabled={disabled}
            required={required}
            className={`w-full py-2.5 sm:py-3 pl-10 pr-11 text-sm sm:text-base bg-white dark:bg-[#0F1726] border rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none disabled:bg-slate-50 dark:disabled:bg-[#070c17] disabled:text-slate-400 disabled:cursor-not-allowed ${
              isMismatched
                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                : isMatching
                ? "border-blue-400 dark:border-blue-500 focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/15"
                : "border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20"
            }`}
            {...props}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={disabled}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer focus:outline-none focus:text-[#0B5ED7] dark:focus:text-[#3B82F6]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {isMismatched && (
          <span className="text-xs text-rose-500 font-medium inline-flex items-center gap-1 animate-fade-in">
            <AlertCircle size={13} className="shrink-0" />
            <span>Mật khẩu xác nhận không khớp.</span>
          </span>
        )}
      </div>
    );
  }
);

ConfirmPasswordInput.displayName = "ConfirmPasswordInput";

export default ConfirmPasswordInput;
