"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Content rendered between the description and the action buttons. */
  detail?: React.ReactNode;
  confirmLabel: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A lightweight inline confirm dialog rendered as a `<dialog>` element.
 * No third-party dependency — uses the native HTML dialog API so it gets
 * focus-trap and backdrop handling for free in modern browsers.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     title="Pause transfers"
 *     description="Are you sure?"
 *     confirmLabel="Yes, pause"
 *     onConfirm={() => { setOpen(false); doTheThing(); }}
 *     onCancel={() => setOpen(false)}
 *   />
 */
export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  confirmClassName = "btn-primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  // Close on backdrop click (click outside the inner panel).
  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onCancel();
  }

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      onCancel={(e) => {
        // Prevent the native Escape key from closing without going through
        // our onCancel callback so state stays in sync.
        e.preventDefault();
        onCancel();
      }}
      className={[
        // Reset native dialog styles.
        "rounded-2xl border border-white/10 bg-base-900 p-0 shadow-2xl backdrop:bg-base-950/70 backdrop:backdrop-blur-sm",
        "max-w-sm w-full",
        "open:animate-fade-in",
      ].join(" ")}
    >
      <div className="p-6 space-y-3">
        <h2 className="text-base font-semibold text-base-100">{title}</h2>
        <p className="text-sm leading-relaxed text-base-100/60">{description}</p>
        {detail && <div className="text-sm text-base-100/70">{detail}</div>}
      </div>
      <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
        <button
          onClick={onCancel}
          className="btn-secondary"
          autoFocus
        >
          Cancel
        </button>
        <button onClick={onConfirm} className={confirmClassName}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
