import React from "react";

interface RoundBannerProps {
  /** e.g. "Vòng 2 – Phản biện"; null while no banner is shown. */
  text: string | null;
}

/**
 * A big line of text in the middle of the screen when a round begins: no box around it, so it stays readable on any
 * background through the colour and a soft shadow. It never takes a click (pointer-events-none), and the live region is
 * always mounted so a screen reader announces the text when it appears.
 */
const RoundBanner: React.FC<RoundBannerProps> = ({ text }) => (
  <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
    {text && (
      <p
        data-testid="round-banner"
        // A soft shadow on top of the colour, for the light and the dark background alike
        style={{ textShadow: "0 2px 14px rgba(0, 0, 0, 0.35), 0 0 2px rgba(0, 0, 0, 0.25)" }}
        className="animate-fade-in text-center text-4xl sm:text-6xl font-black tracking-tight text-[#008A64] dark:text-emerald-400 drop-shadow-lg"
      >
        {text}
      </p>
    )}
  </div>
);

export default RoundBanner;
