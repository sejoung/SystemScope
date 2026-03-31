import { useEffect, useId, useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "danger";
  details?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default",
  details,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId();
  const titleId = `${id}-confirm-title`;
  const messageId = `${id}-confirm-message`;
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Store previously focused element when dialog opens, restore on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Auto-focus cancel button (safer default)
      requestAnimationFrame(() => {
        cancelButtonRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Escape key to close + focus trap
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = [
          cancelButtonRef.current,
          confirmButtonRef.current,
        ].filter(Boolean) as HTMLElement[];

        if (focusableElements.length === 0) return;

        const currentIndex = focusableElements.indexOf(
          document.activeElement as HTMLElement,
        );

        event.preventDefault();

        if (event.shiftKey) {
          const prevIndex =
            currentIndex <= 0
              ? focusableElements.length - 1
              : currentIndex - 1;
          focusableElements[prevIndex].focus();
        } else {
          const nextIndex =
            currentIndex >= focusableElements.length - 1
              ? 0
              : currentIndex + 1;
          focusableElements[nextIndex].focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div style={overlayStyle} role="presentation" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        style={dialogStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={titleStyle} id={titleId}>
          {title}
        </div>
        <div style={messageStyle} id={messageId}>
          {message}
        </div>
        {details ? <div style={detailsStyle}>{details}</div> : null}
        <div style={actionsStyle}>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            style={{
              ...primaryButtonStyle,
              background:
                tone === "danger" ? "var(--accent-red)" : "var(--accent-blue)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(15, 23, 42, 0.5)",
  backdropFilter: "blur(6px)",
  zIndex: 10000,
};

const dialogStyle: React.CSSProperties = {
  width: "min(100%, 480px)",
  display: "grid",
  gap: "12px",
  padding: "20px",
  borderRadius: "16px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-lg)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const messageStyle: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.6,
  color: "var(--text-secondary)",
};

const detailsStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.6,
  color: "var(--text-muted)",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 700,
  borderRadius: "8px",
  border: "none",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};
