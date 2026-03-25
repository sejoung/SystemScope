import { useSettingsStore } from "../stores/useSettingsStore";
import { useI18n } from "../i18n/useI18n";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

type NavPage =
  | "dashboard"
  | "disk"
  | "docker"
  | "process"
  | "apps"
  | "settings";

function NavIcon({ id }: { id: string }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      );
    case "disk":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6.5" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    case "docker":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="12" height="10" rx="1.5" />
          <path d="M5 4V2h6v2" />
          <line x1="2" y1="8" x2="14" y2="8" />
        </svg>
      );
    case "process":
      return (
        <svg {...props}>
          <polyline points="1,12 4,8 7,10 10,4 13,6 15,2" />
          <line x1="1" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "apps":
      return (
        <svg {...props}>
          <rect x="1" y="1" width="4" height="4" rx="0.5" />
          <rect x="6" y="1" width="4" height="4" rx="0.5" />
          <rect x="11" y="1" width="4" height="4" rx="0.5" />
          <rect x="1" y="6" width="4" height="4" rx="0.5" />
          <rect x="6" y="6" width="4" height="4" rx="0.5" />
          <rect x="11" y="6" width="4" height="4" rx="0.5" />
          <rect x="1" y="11" width="4" height="4" rx="0.5" />
          <rect x="6" y="11" width="4" height="4" rx="0.5" />
          <rect x="11" y="11" width="4" height="4" rx="0.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const currentPage = useSettingsStore((s) => s.currentPage);
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings);
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const { tk, t } = useI18n();
  const [pendingPage, setPendingPage] = useState<NavPage | null>(null);
  const navItems = [
    { id: "dashboard", label: tk("nav.overview") },
    { id: "disk", label: tk("nav.storage") },
    { id: "docker", label: tk("nav.docker") },
    { id: "process", label: tk("nav.activity") },
    { id: "apps", label: tk("nav.applications") },
    { id: "settings", label: tk("nav.preferences") },
  ] as const;

  return (
    <>
      <aside
        className="app-sidebar"
        style={{
          width: "var(--sidebar-width)",
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          paddingInline: "10px",
          paddingTop: navigator.userAgent.includes("Macintosh")
            ? "48px"
            : "12px",
        }}
      >
        <div
          className="titlebar-drag"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "18px 12px 22px",
            fontSize: "17px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width="28"
            height="28"
            style={{ flexShrink: 0 }}
          >
            <rect
              x="16"
              y="16"
              width="224"
              height="224"
              rx="56"
              fill="var(--bg-primary)"
            />
            <circle
              cx="128"
              cy="128"
              r="64"
              fill="none"
              stroke="#22c55e"
              strokeWidth="10"
            />
            <circle cx="128" cy="128" r="6" fill="#22c55e" />
            <line
              x1="128"
              y1="128"
              x2="176"
              y2="96"
              stroke="#22c55e"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="170" cy="110" r="4" fill="#22c55e" />
            <circle cx="110" cy="160" r="3" fill="#22c55e" opacity="0.7" />
          </svg>
          <span>
            <span style={{ color: "var(--accent-cyan)" }}>System</span>Scope
          </span>
        </div>

        <nav
          className="titlebar-no-drag"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "0 2px",
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-${item.id}`}
              aria-current={currentPage === item.id ? "page" : undefined}
              onClick={() => {
                if (item.id === currentPage) return;
                if (currentPage === "settings" && hasUnsavedSettings) {
                  setPendingPage(item.id);
                  return;
                }
                setCurrentPage(item.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 12px",
                border:
                  currentPage === item.id
                    ? "1px solid var(--nav-active-border)"
                    : "1px solid transparent",
                borderRadius: "calc(var(--radius) + 2px)",
                background:
                  currentPage === item.id
                    ? "var(--nav-active-bg)"
                    : "transparent",
                color:
                  currentPage === item.id
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: currentPage === item.id ? 700 : 500,
                textAlign: "left",
                transition: "all 0.15s ease",
                boxShadow: currentPage === item.id ? "var(--shadow)" : "none",
                position: "relative",
              }}
            >
              {currentPage === item.id ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-2px",
                    top: "8px",
                    bottom: "8px",
                    width: "3px",
                    borderRadius: "999px",
                    background: "var(--accent-blue)",
                  }}
                />
              ) : null}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  opacity: currentPage === item.id ? 1 : 0.7,
                }}
              >
                <NavIcon id={item.id} />
              </span>
              <span style={{ letterSpacing: "-0.01em" }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <ConfirmDialog
        open={pendingPage !== null}
        title={t("Unsaved Settings")}
        message={tk("confirm.unsaved_settings_leave")}
        details={t("Unsaved work may be lost.")}
        confirmLabel={t("Discard Changes")}
        cancelLabel={t("Cancel")}
        tone="danger"
        onCancel={() => setPendingPage(null)}
        onConfirm={() => {
          if (pendingPage) {
            setCurrentPage(pendingPage);
          }
          setPendingPage(null);
        }}
      />
    </>
  );
}
