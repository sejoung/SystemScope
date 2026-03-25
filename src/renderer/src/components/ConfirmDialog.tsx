import type { ReactNode } from "react";

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
  if (!open) return null;

  return (
    <div style={overlayStyle} role="presentation" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="systemscope-confirm-title"
        aria-describedby="systemscope-confirm-message"
        style={dialogStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={titleStyle} id="systemscope-confirm-title">
          {title}
        </div>
        <div style={messageStyle} id="systemscope-confirm-message">
          {message}
        </div>
        {details ? <div style={detailsStyle}>{details}</div> : null}
        <div style={actionsStyle}>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            {cancelLabel}
          </button>
          <button
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
