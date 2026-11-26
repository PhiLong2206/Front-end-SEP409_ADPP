import React, { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  id,
  name,
  type = "text",
  placeholder = "",
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  className = "",
  ...props
}) => {
  const inputId = id || name;

  return (
    <div className={`flex flex-col gap-1.5 mb-4 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs sm:text-sm font-semibold text-slate-700 tracking-tight">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`w-full px-4 py-2.5 text-sm sm:text-base bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20"
            : "border-slate-200 focus:border-[#0B5ED7] focus:ring-[#0B5ED7]/20 hover:border-slate-300"
        }`}
        {...props}
      />
      {error && <span className="text-xs text-rose-500 font-medium">{error}</span>}
      {!error && helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </div>
  );
};

export default Input;

