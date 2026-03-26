import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useI18n } from "../i18n/useI18n";
import { useSettingsStore } from "../stores/useSettingsStore";
import { InstalledApps } from "../features/apps/InstalledApps";
import { LeftoverApps } from "../features/apps/LeftoverApps";
import { RegistryApps } from "../features/apps/RegistryApps";
import {
  type AppsTab,
  PageTab,
  pageDescriptionStyle,
  pageHeaderStyle,
  pageHelpStyle,
  pageTabsStyle,
} from "../features/apps/appsShared";

export function AppsPage() {
  const { t, tk } = useI18n();
  const locale = useSettingsStore((state) => state.locale);
  const [activeTab, setActiveTab] = useState<AppsTab>("installed");
  const isWindows = navigator.userAgent.includes("Windows");

  return (
    <div data-testid="page-apps">
      <div style={pageHeaderStyle}>
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("apps.page.title")}
          </h2>
          <div style={pageDescriptionStyle}>
            {t(
              "Review installed apps, inspect leftover data, and clean obsolete uninstall metadata from one place.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("apps.page.title")}
          style={pageTabsStyle}
        >
          <PageTab
            id="apps-installed"
            active={activeTab === "installed"}
            onClick={() => setActiveTab("installed")}
          >
            {tk("apps.tab.installed")}
          </PageTab>
          <PageTab
            id="apps-leftover"
            active={activeTab === "leftover"}
            onClick={() => setActiveTab("leftover")}
          >
            {tk("apps.tab.leftover")}
          </PageTab>
          {isWindows && (
            <PageTab
              id="apps-registry"
              active={activeTab === "registry"}
              onClick={() => setActiveTab("registry")}
            >
              {tk("apps.tab.registry")}
            </PageTab>
          )}
        </div>
        <div style={pageHelpStyle}>
          {activeTab === "installed"
            ? tk("apps.description.installed")
            : activeTab === "leftover"
              ? tk("apps.description.leftover")
              : tk("apps.description.registry")}
        </div>
      </div>

      {activeTab === "installed" && (
        <ErrorBoundary title={tk("apps.tab.installed")}>
          <InstalledApps key={locale} />
        </ErrorBoundary>
      )}
      {activeTab === "leftover" && (
        <ErrorBoundary title={tk("apps.tab.leftover")}>
          <LeftoverApps key={locale} />
        </ErrorBoundary>
      )}
      {activeTab === "registry" && (
        <ErrorBoundary title={tk("apps.tab.registry")}>
          <RegistryApps key={locale} />
        </ErrorBoundary>
      )}
    </div>
  );
}
