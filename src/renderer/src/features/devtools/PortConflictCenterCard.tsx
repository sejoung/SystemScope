import { useEffect, useMemo, useRef } from "react";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { usePortFinderStore } from "../../stores/usePortFinderStore";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import {
  PortConflictCenterPanel,
  getPortConflicts,
} from "../process/ListeningPorts";
import type { PortInfo, ProcessKillResult } from "@shared/types";

export function PortConflictCenterCard() {
  const showToast = useToast((s) => s.show);
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const { tk } = useI18n();
  const {
    ports,
    loading,
    scanned,
    fetchPorts,
    setSearch,
    setSearchScope,
    setStateFilter,
  } = usePortFinderStore();

  useEffect(() => {
    if (!scanned && !loading) {
      void fetchPorts();
    }
  }, [fetchPorts, loading, scanned]);

  const conflicts = useMemo(() => getPortConflicts(ports), [ports]);

  // Reentrancy guard: the native confirm dialog doesn't block the renderer, so
  // without this a second kill click would queue another dialog behind the first.
  const killingRef = useRef(false);
  const handleKill = async (portInfo: PortInfo, tree: boolean) => {
    if (killingRef.current) return;
    killingRef.current = true;
    try {
      const res = await window.systemScope.killProcess({
        pid: portInfo.pid,
        name: portInfo.process,
        command: `${portInfo.protocol.toUpperCase()} ${portInfo.localAddress}:${portInfo.localPort}`,
        reason: "DevTools > Port Conflict Center",
        tree,
      });
      if (!res.ok) {
        showToast(res.error?.message ?? tk("process.port_finder.kill_failed"));
        return;
      }

      const result = res.data as ProcessKillResult;
      if (result.cancelled) return;
      if (result.killed) {
        const descendants = result.killedPids.length - 1;
        showToast(
          descendants > 0
            ? tk("process.port_finder.kill_tree_sent", {
                name: result.name,
                count: descendants,
              })
            : tk("process.port_finder.kill_sent", {
                name: result.name,
                pid: result.pid,
              }),
        );
        await fetchPorts();
      }
    } finally {
      killingRef.current = false;
    }
  };

  const handleInspectPort = (port: number) => {
    setSearch(String(port));
    setSearchScope("local");
    setStateFilter("LISTEN");
    setCurrentPage("process");
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={sectionTitleStyle}>{tk("Port Conflict Center")}</div>
        <div style={sectionCopyStyle}>
          {tk(
            "See common development ports in use, kill the owner quickly, or jump into the raw port inspector when you need more detail.",
          )}
        </div>
      </div>
      <PortConflictCenterPanel
        conflicts={conflicts}
        onKill={handleKill}
        onInspectPort={handleInspectPort}
        tk={tk}
      />
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const sectionCopyStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
};
