import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../common/AppLogo";

export interface AppleAuthShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /** A line under the card (the link to the other auth page). */
  footer?: ReactNode;
}

/**
 * A calm, centred sign-in screen: one column, a soft light from the top, one card. Everything comes from the design
 * tokens (tokens.css), so the light and the dark theme both follow them.
 */
const AppleAuthShell: React.FC<AppleAuthShellProps> = ({ children, title, subtitle, footer }) => (
  <div className="page-modern relative min-h-[calc(100vh-80px)] overflow-hidden bg-canvas font-apple text-label flex flex-col items-center justify-center px-4 py-(--s-7) sm:py-(--s-8)">
    {/* Two soft lights (the same as the home page): the only decoration */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        className="absolute -top-40 left-[-10%] h-[560px] w-[560px] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)" }}
      />
      <div
        className="absolute top-10 right-[-10%] h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--accent-2) 18%, transparent)" }}
      />
    </div>

    <main className="relative z-10 w-full max-w-[420px] animate-fade-in motion-reduce:animate-none">
      <div className="flex flex-col items-center text-center mb-(--s-6)">
        <Link
          to="/"
          aria-label="ADPP - về trang chủ"
          className="mb-(--s-4) flex items-center justify-center rounded-ap-lg transition-transform duration-(--t-base) ease-ap hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
        >
          <AppLogo size={56} />
        </Link>
        <h1 className="font-semibold tracking-(--tracking-display) leading-(--leading-tight) text-(length:--text-title) text-label">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-(--s-2) text-(length:--text-callout) leading-(--leading-snug) text-label-secondary">{subtitle}</p>
        )}
      </div>

      <div className="rounded-ap-xl border border-separator bg-elevated p-(--s-6) sm:p-(--s-6) shadow-ap-lg">
        {children}
      </div>

      {footer && <div className="mt-(--s-5) text-center text-(length:--text-callout) text-label-secondary">{footer}</div>}
    </main>
  </div>
);

export default AppleAuthShell;
