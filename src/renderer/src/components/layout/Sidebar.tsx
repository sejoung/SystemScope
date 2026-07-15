import { useSettingsStore } from "../../stores/settings/useSettingsStore";
import { useI18n } from "../../i18n/useI18n";
import { useState } from "react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SidebarNavIcon as NavIcon } from "./SidebarNavIcon";

type NavPage =
  | "dashboard"
  | "timeline"
  | "disk"
  | "docker"
  | "cleanup"
  | "process"
  | "devtools"
  | "apps"
  | "settings";

export function Sidebar({
  compactLayout = false,
}: {
  compactLayout?: boolean;
}) {
  const currentPage = useSettingsStore((s) => s.currentPage);
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings);
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const { tk } = useI18n();
  const [pendingPage, setPendingPage] = useState<NavPage | null>(null);
  const navItems = [
    { id: "dashboard", label: tk("nav.overview"), shortcut: "1" },
    { id: "timeline", label: tk("nav.timeline"), shortcut: "2" },
    { id: "disk", label: tk("nav.storage"), shortcut: "3" },
    { id: "docker", label: tk("nav.docker"), shortcut: "4" },
    { id: "cleanup", label: tk("nav.cleanup"), shortcut: "5" },
    { id: "process", label: tk("nav.activity"), shortcut: "6" },
    { id: "devtools", label: tk("nav.devtools"), shortcut: "7" },
    { id: "apps", label: tk("nav.applications"), shortcut: "8" },
    { id: "settings", label: tk("nav.preferences"), shortcut: "9" },
  ] as const;

  return (
    <>
      <aside
        className="app-sidebar"
        style={{
          width: compactLayout ? "100%" : "var(--sidebar-width)",
          backgroundColor: "var(--bg-secondary)",
          borderRight: compactLayout ? "none" : "1px solid var(--border)",
          borderBottom: compactLayout ? "1px solid var(--border)" : "none",
          display: "flex",
          flexDirection: "column",
          paddingInline: "10px",
          paddingTop: navigator.userAgent.includes("Macintosh")
            ? "48px"
            : "12px",
          paddingBottom: compactLayout ? "12px" : undefined,
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
            flexDirection: compactLayout ? "row" : "column",
            flexWrap: compactLayout ? "wrap" : "nowrap",
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
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  opacity: 0.6,
                  fontWeight: 400,
                }}
              >
                {navigator.userAgent.includes("Macintosh") ? "\u2318" : "Ctrl+"}
                {item.shortcut}
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <ConfirmDialog
        open={pendingPage !== null}
        title={tk("Unsaved Settings")}
        message={tk("confirm.unsaved_settings_leave")}
        details={tk("Unsaved work may be lost.")}
        confirmLabel={tk("Discard Changes")}
        cancelLabel={tk("Cancel")}
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
