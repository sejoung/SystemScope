import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { DockerOverview } from "../features/docker/DockerOverview";
import { DockerContainers } from "../features/docker/DockerContainers";
import { DockerVolumes } from "../features/docker/DockerVolumes";
import { DockerBuildCache } from "../features/docker/DockerBuildCache";
import { DockerImages } from "../features/disk/DockerImages";
import { useI18n } from "../i18n/useI18n";
import { isDockerContainersScanResult } from "@shared/types";
import { StatusMessage } from "../components/StatusMessage";
import { PageLoading } from "../components/PageLoading";
import { PageTab } from "../components/PageTab";

type DockerTab =
  | "overview"
  | "containers"
  | "images"
  | "volumes"
  | "build-cache";
type DockerAvailability =
  | "checking"
  | "ready"
  | "not_installed"
  | "daemon_unavailable";

export function DockerPage() {
  const [tab, setTab] = useState<DockerTab>("overview");
  const [refreshToken, setRefreshToken] = useState(0);
  const [availability, setAvailability] =
    useState<DockerAvailability>("checking");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { tk, t } = useI18n();

  const handleChanged = () => setRefreshToken((prev) => prev + 1);

  const checkDocker = useCallback(async () => {
    setAvailability("checking");
    const res = await window.systemScope.listDockerContainers();
    if (!res.ok) {
      setAvailability("daemon_unavailable");
      setStatusMessage(res.error?.message ?? null);
      return;
    }
    if (!res.data) {
      setAvailability("daemon_unavailable");
      setStatusMessage(null);
      return;
    }
    if (!isDockerContainersScanResult(res.data)) {
      setAvailability("daemon_unavailable");
      setStatusMessage(null);
      return;
    }
    const data = res.data;
    if (data.status !== "ready") {
      setAvailability(data.status);
      setStatusMessage(data.message);
      return;
    }
    setAvailability("ready");
    setStatusMessage(null);
  }, []);

  useEffect(() => {
    void checkDocker();
  }, [checkDocker]);

  // Auto-recheck Docker availability every 10s when unavailable
  useEffect(() => {
    if (availability !== "daemon_unavailable") return;
    const timer = setInterval(() => void checkDocker(), 10_000);
    return () => clearInterval(timer);
  }, [availability, checkDocker]);

  const dockerUnavailable =
    availability === "not_installed" || availability === "daemon_unavailable";

  return (
    <div data-testid="page-docker">
      <div
        style={{
          display: "grid",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("docker.page.title")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t(
              "Inspect container, image, volume, and build cache usage before cleaning up Docker resources.",
            )}
          </div>
        </div>
        {!dockerUnavailable && (
          <div
            role="tablist"
            aria-label={tk("docker.page.title")}
            style={{
              display: "flex",
              gap: "4px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            <PageTab
              id="docker-overview"
              active={tab === "overview"}
              onClick={() => setTab("overview")}
            >
              {tk("docker.tab.overview")}
            </PageTab>
            <PageTab
              id="docker-containers"
              active={tab === "containers"}
              onClick={() => setTab("containers")}
            >
              {tk("docker.tab.containers")}
            </PageTab>
            <PageTab
              id="docker-images"
              active={tab === "images"}
              onClick={() => setTab("images")}
            >
              {tk("docker.tab.images")}
            </PageTab>
            <PageTab
              id="docker-volumes"
              active={tab === "volumes"}
              onClick={() => setTab("volumes")}
            >
              {tk("docker.tab.volumes")}
            </PageTab>
            <PageTab
              id="docker-build-cache"
              active={tab === "build-cache"}
              onClick={() => setTab("build-cache")}
            >
              {tk("docker.tab.build_cache")}
            </PageTab>
          </div>
        )}
      </div>

      {availability === "checking" && <PageLoading />}

      {dockerUnavailable && (
        <StatusMessage
          tone="error"
          title={
            availability === "not_installed"
              ? tk("main.docker.status.not_installed")
              : tk("main.docker.status.daemon_unavailable")
          }
          message={statusMessage ?? tk("docker.common.check_status")}
          action={
            <button onClick={() => void checkDocker()} style={retryBtnStyle}>
              {tk("docker.page.retry")}
            </button>
          }
        />
      )}

      {availability === "ready" && (
        <>
          {tab === "overview" && (
            <ErrorBoundary title={tk("docker.section.overview")}>
              <DockerOverview
                refreshToken={refreshToken}
                onOpenContainers={() => setTab("containers")}
                onOpenImages={() => setTab("images")}
                onOpenVolumes={() => setTab("volumes")}
                onOpenBuildCache={() => setTab("build-cache")}
              />
            </ErrorBoundary>
          )}

          {tab === "containers" && (
            <ErrorBoundary title={tk("docker.section.containers")}>
              <DockerContainers
                refreshToken={refreshToken}
                onChanged={handleChanged}
                onOpenImages={() => setTab("images")}
              />
            </ErrorBoundary>
          )}

          {tab === "images" && (
            <ErrorBoundary title={tk("docker.section.images")}>
              <DockerImages
                refreshToken={refreshToken}
                onChanged={handleChanged}
                onOpenContainers={() => setTab("containers")}
              />
            </ErrorBoundary>
          )}

          {tab === "volumes" && (
            <ErrorBoundary title={tk("docker.section.volumes")}>
              <DockerVolumes
                refreshToken={refreshToken}
                onChanged={handleChanged}
              />
            </ErrorBoundary>
          )}

          {tab === "build-cache" && (
            <ErrorBoundary title={tk("docker.section.build_cache")}>
              <DockerBuildCache
                refreshToken={refreshToken}
                onChanged={handleChanged}
              />
            </ErrorBoundary>
          )}
        </>
      )}
    </div>
  );
}

const retryBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

