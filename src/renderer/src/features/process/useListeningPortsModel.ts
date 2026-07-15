import { useEffect, useMemo, useRef } from 'react'
import type { PortInfo, ProcessKillResult } from '@shared/types'
import { useToast } from '../../components/ui/Toast'
import { usePortFinderStore } from '../../stores/process/usePortFinderStore'
import { useI18n } from '../../i18n/useI18n'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'
import { filterPortsBySearch, filterPortsByState, formatEndpoint, getDisplayedPorts, getPortConflicts, isLoopbackAddress, normalizePortState, sortPortsForDisplay } from './listeningPortUtils'

export function shouldUseListeningPortsCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.listeningPortsCompact) }

export function useListeningPortsModel() {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [containerRef, containerWidth] = useContainerWidth(1280);
  const {
    ports,
    loading,
    scanned,
    error,
    requestState,
    stateFilter,
    search,
    searchScope,
    setStateFilter,
    setSearch,
    setSearchScope,
    fetchPorts,
  } = usePortFinderStore();
  const compactLayout = shouldUseListeningPortsCompactLayout(containerWidth);

  useEffect(() => {
    if (!scanned && !loading) {
      void fetchPorts();
    }
  }, [fetchPorts, loading, scanned]);

  const searchFiltered = useMemo(
    () => filterPortsBySearch(ports, search, searchScope),
    [ports, search, searchScope],
  );

  const orderedSearchFiltered = useMemo(() => {
    return sortPortsForDisplay(searchFiltered);
  }, [searchFiltered]);

  const displayRows = useMemo(() => {
    return getDisplayedPorts(ports, search, searchScope, stateFilter);
  }, [ports, search, searchScope, stateFilter]);

  const listenCount = orderedSearchFiltered.filter(
    (p) => normalizePortState(p.state) === "LISTEN",
  ).length;
  const establishedCount = orderedSearchFiltered.filter(
    (p) => normalizePortState(p.state) === "ESTABLISHED",
  ).length;
  const otherCount = orderedSearchFiltered.length - listenCount - establishedCount;
  const listeningPorts = useMemo(
    () => filterPortsByState(orderedSearchFiltered, "LISTEN"),
    [orderedSearchFiltered],
  );
  const portConflicts = useMemo(
    () => getPortConflicts(ports),
    [ports],
  );
  const localhostListenCount = listeningPorts.filter((port) =>
    isLoopbackAddress(port.localAddress),
  ).length;
  const exposedListenCount = listeningPorts.filter((port) =>
    !isLoopbackAddress(port.localAddress),
  ).length;
  const uniqueProcessCount = new Set(
    listeningPorts.map((port) => port.pid),
  ).size;

  // Reentrancy guard: the native confirm dialog doesn't block the renderer, so
  // without this a second kill click would queue another dialog behind the first.
  const killingRef = useRef(false);
  const handleKill = async (portInfo: PortInfo, tree: boolean) => {
    if (killingRef.current) return;
    killingRef.current = true;
    try {
      const remote = formatEndpoint(portInfo.peerAddress, portInfo.peerPort);
      const res = await window.systemScope.killProcess({
        pid: portInfo.pid,
        name: portInfo.process,
        command: `${portInfo.protocol.toUpperCase()} ${portInfo.localAddress}:${portInfo.localPort} -> ${remote}`,
        reason: "Activity > Ports",
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


  return { tk, containerRef, containerWidth, ports, loading, scanned, error, requestState, stateFilter, search, searchScope, setStateFilter, setSearch, setSearchScope, fetchPorts, compactLayout, orderedSearchFiltered, displayRows, listenCount, establishedCount, otherCount, listeningPorts, portConflicts, localhostListenCount, exposedListenCount, uniqueProcessCount, handleKill }
}
