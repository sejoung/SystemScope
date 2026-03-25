import { useEffect, useState } from "react";
import { create } from "zustand";

interface ToastMessage {
  id: string;
  text: string;
  tone?: "default" | "success" | "danger";
}

interface ToastState {
  messages: ToastMessage[];
  show: (message: string, tone?: ToastMessage["tone"]) => void;
  hide: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  messages: [],
  show: (message, tone = "default") =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
          text: message,
          tone,
        },
      ],
    })),
  hide: (id) =>
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== id),
    })),
}));

export function ToastContainer() {
  const messages = useToast((s) => s.messages);
  const hide = useToast((s) => s.hide);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  useEffect(() => {
    if (messages.length === 0) {
      setVisibleIds([]);
      return;
    }

    const nextVisibleIds = messages
      .filter((message) => !visibleIds.includes(message.id))
      .map((message) => message.id);

    if (nextVisibleIds.length === 0) return;

    setVisibleIds((current) => [...current, ...nextVisibleIds]);
    const timers = nextVisibleIds.flatMap((id) => [
      setTimeout(() => {
        setVisibleIds((current) => current.filter((value) => value !== id));
      }, 3000),
      setTimeout(() => {
        hide(id);
      }, 3300),
    ]);

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [messages, hide, visibleIds]);

  if (messages.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        right: "24px",
        bottom: "24px",
        display: "grid",
        gap: "10px",
        zIndex: 9999,
      }}
    >
      {messages.map((message) => {
        const visible = visibleIds.includes(message.id);
        const accent =
          message.tone === "danger"
            ? "var(--accent-red)"
            : message.tone === "success"
              ? "var(--accent-green)"
              : "var(--accent-blue)";

        return (
          <div
            key={message.id}
            role="status"
            style={{
              width: "min(420px, calc(100vw - 32px))",
              transform: `translateY(${visible ? "0" : "14px"})`,
              opacity: visible ? 1 : 0,
              transition: "all 0.25s ease",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderLeft: `4px solid ${accent}`,
              boxShadow: "var(--shadow-lg)",
              fontSize: "13px",
              color: "var(--text-primary)",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
            >
              <div style={{ flex: 1, lineHeight: 1.5 }}>{message.text}</div>
              <button
                type="button"
                onClick={() => hide(message.id)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
