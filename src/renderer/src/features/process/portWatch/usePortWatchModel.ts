import { useCallback, useEffect, useState } from 'react'
import { useInterval } from '../../../hooks/useInterval'
import { useToast } from '../../../components/ui/Toast'
import { usePortWatchStore } from '../../../stores/process/usePortWatchStore'
import type { PortInfo } from '@shared/types'
import { isPortInfoArray } from '@shared/types'
import { useContainerWidth } from '../../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../../hooks/useResponsiveLayout'
import { formatPortAddress, matchWatchPorts, parseWatchPattern } from './portWatchUtils'
import { useI18n } from '../../../i18n/useI18n'

export function shouldUsePortWatchCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.portWatchCompact) }

export function usePortWatchModel() {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [containerRef, containerWidth] = useContainerWidth(1100);
  const {
    watches,
    statuses,
    history,
    monitoring,
    pollInterval,
    expandedWatch,
    watchFilters,
    addWatch: storeAddWatch,
    removeWatch,
    setStatuses,
    addHistory,
    clearHistory,
    setMonitoring,
    setPollInterval,
    toggleExpanded,
    setWatchFilter,
    setPrevMatched,
  } = usePortWatchStore();

  const [input, setInput] = useState("");
  const [watchScope, setWatchScope] = useState<"local" | "remote" | "all">(
    "local",
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const compactLayout = shouldUsePortWatchCompactLayout(containerWidth);

  const handleAddWatch = () => {
    const entry = parseWatchPattern(input, watchScope);
    if (!entry) {
      setInputError(tk("Enter a valid port, IP, or IP:Port."));
      return;
    }
    if (watches.some((w) => w.pattern === entry.pattern)) {
      setInputError(null);
      showToast(tk("process.port_watch.duplicate", { pattern: entry.pattern }));
      return;
    }
    storeAddWatch(entry);
    setInput("");
    setInputError(null);
  };

  const pollPorts = useCallback(async () => {
    if (watches.length === 0) return;

    const res = await window.systemScope.getNetworkPorts();
    if (!res.ok) {
      setStatusError(
        res.error?.message ?? tk("Unable to refresh port watch status."),
      );
      return;
    }
    if (!res.data) return;
    setStatusError(null);
    if (!isPortInfoArray(res.data)) return;
    const ports = res.data;
    const now = Date.now();
    const newStatuses: Record<
      string,
      { id: string; matched: boolean; matches: PortInfo[]; lastChecked: number }
    > = {};
    const newHistory: {
      timestamp: number;
      watchId: string;
      pattern: string;
      event: "connected" | "disconnected";
      process: string;
      detail: string;
    }[] = [];

    const currentPrevMatched = usePortWatchStore.getState().prevMatched;

    for (const watch of watches) {
      const matches = matchWatchPorts(watch, ports);
      const matched = matches.length > 0;
      const prev = currentPrevMatched[watch.id];

      newStatuses[watch.id] = {
        id: watch.id,
        matched,
        matches,
        lastChecked: now,
      };

      if (prev !== undefined && prev !== matched) {
        const proc = matches[0]?.process ?? "-";
        const detail = matched
          ? matches
              .slice(0, 3)
              .map(
                (m) =>
                  `${formatPortAddress(m.localAddress, m.localPort)}→${formatPortAddress(m.peerAddress, m.peerPort)} (${m.state})`,
              )
              .join(", ")
          : "";

        newHistory.push({
          timestamp: now,
          watchId: watch.id,
          pattern: watch.pattern,
          event: matched ? "connected" : "disconnected",
          process: proc,
          detail,
        });

        showToast(
          matched
            ? tk("process.port_watch.connected", {
                pattern: watch.pattern,
                process: proc,
              })
            : tk("process.port_watch.disconnected", { pattern: watch.pattern }),
        );
      }

      setPrevMatched(watch.id, matched);
    }

    setStatuses(newStatuses);
    if (newHistory.length > 0) addHistory(newHistory);
  }, [watches, showToast, setStatuses, addHistory, setPrevMatched]);

  useEffect(() => {
    if (monitoring && watches.length > 0) pollPorts();
  }, [monitoring, watches.length, pollPorts]);

  useInterval(
    pollPorts,
    monitoring && watches.length > 0 ? pollInterval : null,
  );


  return { tk, containerRef, watches, statuses, history, monitoring, pollInterval, expandedWatch, watchFilters, removeWatch, clearHistory, setMonitoring, setPollInterval, toggleExpanded, setWatchFilter, input, setInput, setInputError, watchScope, setWatchScope, inputError, statusError, compactLayout, handleAddWatch, pollPorts }
}
