"use client";

import { useTheme, type ThemePreference } from "@/hooks/useTheme";

/**
 * Compact three-way theme toggle: System / Light / Dark.
 * Renders as a segmented control next to the header actions.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const options: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    {
      value: "system",
      label: "System",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: "light",
      label: "Light",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5"
    >
      {options.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setPreference(opt.value)}
            aria-pressed={active}
            aria-label={`${opt.label} theme`}
            title={opt.label}
            className={[
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
              active
                ? "bg-white/15 text-base-100"
                : "text-base-100/50 hover:text-base-100",
            ].join(" ")}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
