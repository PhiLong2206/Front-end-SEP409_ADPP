import React from "react";

interface RoundBannerProps {
  /** e.g. "Vòng 2 – Phản biện"; null while no banner is shown. */
  text: string | null;
}

/**
 * A big notice in the middle of the screen when a round begins. It never takes a click (pointer-events-none), and the
 * live region is always mounted so a screen reader announces the text when it appears.
 */
const RoundBanner: React.FC<RoundBannerProps> = ({ text }) => (
  <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
    {text && (
      <div
        data-testid="round-banner"
        className="animate-fade-in rounded-3xl bg-[#0F172A]/90 dark:bg-[#F8FAFC]/95 px-8 py-5 sm:px-12 sm:py-7 text-center shadow-2xl border border-white/10 dark:border-slate-300/40"
      >
        <p className="text-2xl sm:text-4xl font-black tracking-tight text-white dark:text-[#0F172A]">{text}</p>
      </div>
    )}
  </div>
);

export default RoundBanner;
