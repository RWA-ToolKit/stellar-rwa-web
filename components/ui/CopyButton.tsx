"use client";

import { useState } from "react";

interface CopyButtonProps {
  value: string;
  /** Optional visible label; when omitted only the icon shows. */
  label?: string;
  className?: string;
}

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({ value, label, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be unavailable (insecure context); fail silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : `Copy ${label ?? value}`}
      className={`inline-flex items-center gap-1.5 text-base-100/50 transition-colors hover:text-brand-400 ${className}`}
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {label && <span className="text-xs font-medium">{copied ? "Copied" : label}</span>}
    </button>
  );
}
