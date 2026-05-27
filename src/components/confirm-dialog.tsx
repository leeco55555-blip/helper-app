"use client";

import { useEffect } from "react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="sheet flex flex-col gap-4">
        <div className="sheet-handle" aria-hidden />
        <h3 className="text-2xl font-bold">{title}</h3>
        {message && <p className="text-base text-[var(--muted-strong)]">{message}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn-primary flex-1"
            style={
              danger
                ? {
                    background: "var(--danger)",
                    borderColor: "var(--danger)",
                    boxShadow: "0 6px 16px rgba(192, 41, 31, 0.28)",
                  }
                : undefined
            }
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
