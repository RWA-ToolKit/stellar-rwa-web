interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Minimal accessible spinner. */
export function Spinner({ size = 20, className = "", label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-brand-400 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Full-panel loading state used inside cards and page sections. */
export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-base-100/50">
      <Spinner size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
