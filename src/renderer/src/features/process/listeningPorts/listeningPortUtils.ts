import type { PortInfo } from '@shared/types'

export function filterPortsBySearch(
  ports: PortInfo[],
  rawQuery: string,
  searchScope: "local" | "remote" | "process" | "all",
): PortInfo[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return ports;
  }

  return ports.filter((port) => {
    if (searchScope === "local") {
      return (
        String(port.localPort).includes(query) ||
        port.localAddress.toLowerCase().includes(query)
      );
    }

    if (searchScope === "remote") {
      return (
        String(port.peerPort).includes(query) ||
        port.peerAddress.toLowerCase().includes(query)
      );
    }

    if (searchScope === "process") {
      return (
        port.process.toLowerCase().includes(query) ||
        String(port.pid).includes(query)
      );
    }

    return (
      String(port.localPort).includes(query) ||
      port.localAddress.toLowerCase().includes(query) ||
      String(port.peerPort).includes(query) ||
      port.peerAddress.toLowerCase().includes(query) ||
      port.process.toLowerCase().includes(query) ||
      String(port.pid).includes(query)
    );
  });
}

export function filterPortsByState(
  ports: PortInfo[],
  stateFilter: "all" | "LISTEN" | "ESTABLISHED" | "other",
): PortInfo[] {
  if (stateFilter === "LISTEN") {
    return ports.filter((port) => normalizePortState(port.state) === "LISTEN");
  }

  if (stateFilter === "ESTABLISHED") {
    return ports.filter((port) => normalizePortState(port.state) === "ESTABLISHED");
  }

  if (stateFilter === "other") {
    return ports.filter(
      (port) => {
        const normalized = normalizePortState(port.state);
        return normalized !== "LISTEN" && normalized !== "ESTABLISHED";
      },
    );
  }

  return ports;
}

export function sortPortsForDisplay(ports: PortInfo[]): PortInfo[] {
  const stateWeight = {
    LISTEN: 0,
    ESTABLISHED: 1,
  } as const;

  return [...ports].sort((left, right) => {
    const stateDiff =
      (stateWeight[normalizePortState(left.state) as keyof typeof stateWeight] ?? 2) -
      (stateWeight[normalizePortState(right.state) as keyof typeof stateWeight] ?? 2);
    if (stateDiff !== 0) return stateDiff;

    const localPortDiff =
      getSortableLocalPort(left) - getSortableLocalPort(right);
    if (localPortDiff !== 0) return localPortDiff;

    return left.process.localeCompare(right.process);
  });
}

export function normalizePortState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (normalized === "LISTENING") {
    return "LISTEN";
  }
  return normalized;
}

export function dedupeListeningPorts(ports: PortInfo[]): PortInfo[] {
  return dedupePassivePorts(ports);
}

export function dedupePassivePorts(ports: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  const result: PortInfo[] = [];

  for (const port of ports) {
    const key = `${port.protocol}:${port.localAddress}:${port.localPort}:${port.pid}:${normalizePortState(port.state)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(port);
  }

  return result;
}

export function getDisplayedPorts(
  ports: PortInfo[],
  search: string,
  searchScope: "local" | "remote" | "process" | "all",
  stateFilter: "all" | "LISTEN" | "ESTABLISHED" | "other",
): PortInfo[] {
  const searchFiltered = filterPortsBySearch(ports, search, searchScope);
  const ordered = sortPortsForDisplay(searchFiltered);
  const stateFiltered = filterPortsByState(ordered, stateFilter);

  if (stateFilter === "LISTEN") {
    return dedupePassivePorts(stateFiltered);
  }

  if (stateFilter === "other") {
    return dedupePassivePorts(stateFiltered);
  }

  if (stateFilter === "all") {
    const establishedRows = stateFiltered.filter(
      (port) => normalizePortState(port.state) === "ESTABLISHED",
    );
    const passiveRows = dedupePassivePorts(
      stateFiltered.filter(
        (port) => normalizePortState(port.state) !== "ESTABLISHED",
      ),
    );

    return sortPortsForDisplay([...passiveRows, ...establishedRows]);
  }

  return stateFiltered;
}

export function isLoopbackAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

export function getExposure(address: string): {
  label: string;
  color: string;
  bg: string;
  note: string;
} {
  const normalized = address.trim().toLowerCase();

  if (isLoopbackAddress(normalized)) {
    return {
      label: "Loopback",
      color: "var(--accent-green)",
      bg: "color-mix(in srgb, var(--accent-green) 16%, transparent)",
      note: "Reachable only from this machine."
    };
  }

  if (
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "*" ||
    normalized === ""
  ) {
    return {
      label: "All Interfaces",
      color: "var(--accent-red)",
      bg: "color-mix(in srgb, var(--accent-red) 16%, transparent)",
      note: "Bound broadly and potentially reachable from other hosts."
    };
  }

  return {
    label: "Specific Host",
    color: "var(--accent-yellow)",
    bg: "color-mix(in srgb, var(--accent-yellow) 16%, transparent)",
    note: "Bound to a non-loopback interface."
  };
}

// ─── Helpers ───

export function formatEndpoint(addr: string, port: string): string {
  const hasAddr = addr && addr !== "*" && addr !== "";
  const hasPort = port && port !== "*" && port !== "0" && port !== "";
  if (hasAddr && hasPort) return `${addr}:${port}`;
  if (hasAddr) return addr;
  if (hasPort) return `:${port}`;
  return "-";
}

export function getSortableLocalPort(port: PortInfo): number {
  if (Number.isFinite(port.localPortNum) && port.localPortNum > 0) {
    return port.localPortNum;
  }

  const parsed = Number(port.localPort);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.MAX_SAFE_INTEGER;
}

export type PortConflict = {
  port: number;
  pid: number;
  process: string;
  reason: string;
  recommendedPort: number;
  portInfo: PortInfo;
};

const COMMON_DEV_PORTS = [
  { port: 3000, reason: "React / Next.js default app port." },
  { port: 3001, reason: "Secondary web app or API dev port." },
  { port: 4173, reason: "Vite preview commonly uses this port." },
  { port: 5173, reason: "Vite dev server commonly uses this port." },
  { port: 5432, reason: "PostgreSQL default port." },
  { port: 6379, reason: "Redis default port." },
  { port: 8000, reason: "Python or backend development default port." },
  { port: 8080, reason: "Java, proxy, or local API default port." },
] as const;

export function getPortConflicts(ports: PortInfo[]): PortConflict[] {
  const listening = dedupeListeningPorts(
    ports.filter((port) => normalizePortState(port.state) === "LISTEN"),
  );
  const occupiedPorts = new Set(listening.map((port) => port.localPortNum));
  const conflicts: PortConflict[] = [];

  for (const candidate of COMMON_DEV_PORTS) {
    const owner = listening.find((port) => port.localPortNum === candidate.port);
    if (!owner) continue;

    conflicts.push({
      port: candidate.port,
      pid: owner.pid,
      process: owner.process,
      reason: candidate.reason,
      recommendedPort: suggestAlternativePort(candidate.port, occupiedPorts),
      portInfo: owner,
    });
  }

  return conflicts;
}

export function suggestAlternativePort(port: number, occupiedPorts: Set<number>): number {
  let nextPort = port + 1;
  while (occupiedPorts.has(nextPort) && nextPort < port + 20) {
    nextPort += 1;
  }
  return nextPort;
}

