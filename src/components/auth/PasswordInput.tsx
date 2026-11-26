import { useState, forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
  showIcon?: boolean;
  required?: boolean;
  /** "apple": the calm look of the sign-in screen (design tokens). The default is the look every other form has. */
  appearance?: "default" | "apple";
  /** Beside the label, on its right (the apple look only): e.g. the "forgot password" link. */
  labelAction?: ReactNode;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label = "Mật khẩu",
      id,
      name = "password",
      placeholder = "••••••••••••",
      value,
      onChange,
      error,
      helperText,
      showIcon = true,
      required = false,
      disabled = false,
      className = "",
      appearance = "default",
      labelAction,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || name;

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    if (appearance === "apple") {
      return (
        <div className={`flex flex-col gap-(--s-2) ${className}`}>
          <div className="flex items-baseline justify-between gap-(--s-3)">
            <label htmlFor={inputId} className="text-(length:--text-caption) font-medium text-label-secondary">
              {label}
              {required && <span className="sr-only"> (bắt buộc)</span>}
            </label>
            {labelAction}
          </div>
          <div className="relative">
            <input
              ref={ref}
              id={inputId}
              name={name}
              type={showPassword ? "text" : "password"}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              disabled={disabled}
              required={required}
              aria-invalid={error ? true : undefined}
              className={`w-full h-12 rounded-ap-md bg-canvas-secondary pl-(--s-4) pr-12 text-(length:--text-body) text-label placeholder:text-label-tertiary border transition-[box-shadow,border-color] duration-(--t-fast) ease-ap outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 disabled:opacity-60 disabled:cursor-not-allowed ${
                error ? "border-ap-danger" : "border-transparent"
              }`}
              {...props}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              disabled={disabled}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-ap-md text-label-secondary hover:text-label transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-accent"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <span className="text-(length:--text-caption) text-label">{error}</span>}
          {!error && helperText && <span className="text-(length:--text-caption) text-label-secondary">{helperText}</span>}
        </div>
      );
    }

    return (
      <div className={`flex flex-col gap-1.5 mb-3.5 ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC] flex items-center justify-between"
          >
            <span>
              {label} {required && <span className="text-rose-500">*</span>}
            </span>
          </label>
        )}

        <div className="relative">
          {showIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={16} />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={showPassword ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={`w-full py-2.5 sm:py-3 pr-11 text-sm sm:text-base bg-white dark:bg-[#0F1726] border rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none disabled:bg-slate-50 dark:disabled:bg-[#070c17] disabled:text-slate-400 disabled:cursor-not-allowed ${
              showIcon ? "pl-10" : "pl-4"
            } ${
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                : "border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20"
            }`}
            {...props}
          />

          <button
            type="button"
            onClick={togglePasswordVisibility}
            disabled={disabled}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer focus:outline-none focus:text-[#0B5ED7] dark:focus:text-[#3B82F6]"
            tabIndex={0}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <span className="text-xs text-rose-500 font-medium animate-fade-in">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-500">{helperText}</span>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
