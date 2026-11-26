import React from "react";

export const MAX_GUIDE_LENGTH = 1000;

interface TopicGuideFieldsProps {
  idPrefix: string;
  proValue: string;
  conValue: string;
  onProChange: (value: string) => void;
  onConChange: (value: string) => void;
  /**
   * The Backend's default texts, shown as the placeholder while the field is empty (a topic without its own guides):
   * the default is never copied into the field, so it is never saved into the database.
   */
  proPlaceholder?: string;
  conPlaceholder?: string;
  /** Shown under the fields (what an empty field means). */
  hint?: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]";

const Field: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ id, label, value, onChange, placeholder }) => {
  const nearLimit = value.length >= MAX_GUIDE_LENGTH * 0.9;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="block font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span
          data-testid={`${id}-counter`}
          className={`text-[11px] tabular-nums ${nearLimit ? "font-bold text-amber-600" : "text-slate-400"}`}
        >
          {value.length}/{MAX_GUIDE_LENGTH}
        </span>
      </div>
      <textarea
        id={id}
        rows={4}
        maxLength={MAX_GUIDE_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_GUIDE_LENGTH))}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
};

/** The two task descriptions of a topic ("Nhiệm vụ phe PRO" / "Nhiệm vụ phe CON"), up to 1000 characters each. */
const TopicGuideFields: React.FC<TopicGuideFieldsProps> = ({
  idPrefix,
  proValue,
  conValue,
  onProChange,
  onConChange,
  proPlaceholder,
  conPlaceholder,
  hint,
}) => (
  <div className="space-y-3" data-testid={`${idPrefix}-guide-fields`}>
    <Field
      id={`${idPrefix}-pro-guide`}
      label="Nhiệm vụ phe PRO"
      value={proValue}
      onChange={onProChange}
      placeholder={proPlaceholder || "Để trống để dùng nội dung mặc định của hệ thống."}
    />
    <Field
      id={`${idPrefix}-con-guide`}
      label="Nhiệm vụ phe CON"
      value={conValue}
      onChange={onConChange}
      placeholder={conPlaceholder || "Để trống để dùng nội dung mặc định của hệ thống."}
    />
    {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
  </div>
);

export default TopicGuideFields;
