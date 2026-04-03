import { describe, expect, it } from "vitest";
import {
  dedupePassivePorts,
  dedupeListeningPorts,
  filterPortsBySearch,
  filterPortsByState,
  formatEndpoint,
  getDisplayedPorts,
  normalizePortState,
  shouldUseListeningPortsCompactLayout,
  sortPortsForDisplay,
} from "../../src/renderer/src/features/process/ListeningPorts";
import type { PortInfo } from "../../src/shared/types";

describe("ListeningPorts helpers", () => {
  const samplePorts: PortInfo[] = [
    {
      protocol: "tcp",
      localAddress: "127.0.0.1",
      localPort: "3000",
      peerAddress: "",
      peerPort: "*",
      state: "LISTEN",
      pid: 123,
      process: "node",
      localPortNum: 3000,
    },
    {
      protocol: "tcp",
      localAddress: "0.0.0.0",
      localPort: "5432",
      peerAddress: "",
      peerPort: "*",
      state: "LISTEN",
      pid: 456,
      process: "postgres",
      localPortNum: 5432,
    },
    {
      protocol: "tcp",
      localAddress: "0.0.0.0",
      localPort: "8080",
      peerAddress: "10.0.0.5",
      peerPort: "443",
      state: "ESTABLISHED",
      pid: 789,
      process: "java",
      localPortNum: 8080,
    },
  ];

  it("formats remote endpoint values with stable fallbacks", () => {
    expect(formatEndpoint("127.0.0.1", "3000")).toBe("127.0.0.1:3000");
    expect(formatEndpoint("127.0.0.1", "0")).toBe("127.0.0.1");
    expect(formatEndpoint("", "443")).toBe(":443");
    expect(formatEndpoint("*", "*")).toBe("-");
  });

  it("filters ports by search scope", () => {
    expect(filterPortsBySearch(samplePorts, "node", "process")).toEqual([
      samplePorts[0],
    ]);
    expect(filterPortsBySearch(samplePorts, "5432", "local")).toEqual([
      samplePorts[1],
    ]);
    expect(filterPortsBySearch(samplePorts, "10.0.0.5", "remote")).toEqual([
      samplePorts[2],
    ]);
    expect(filterPortsBySearch(samplePorts, "789", "all")).toEqual([
      samplePorts[2],
    ]);
  });

  it("filters ports by state", () => {
    expect(filterPortsByState(samplePorts, "LISTEN")).toEqual([
      samplePorts[0],
      samplePorts[1],
    ]);
    expect(filterPortsByState(samplePorts, "ESTABLISHED")).toEqual([
      samplePorts[2],
    ]);
    expect(filterPortsByState(samplePorts, "other")).toEqual([]);
    expect(filterPortsByState(samplePorts, "all")).toEqual(samplePorts);
  });

  it("normalizes platform-specific port states", () => {
    expect(normalizePortState("listen")).toBe("LISTEN");
    expect(normalizePortState(" LISTENING ")).toBe("LISTEN");
    expect(normalizePortState("established")).toBe("ESTABLISHED");
  });

  it("dedupes listening rows by local binding identity", () => {
    const duplicatedListening: PortInfo[] = [
      samplePorts[0],
      { ...samplePorts[0], peerAddress: "10.0.0.8", peerPort: "55123" },
      samplePorts[1],
    ];

    expect(dedupeListeningPorts(duplicatedListening)).toEqual([
      samplePorts[0],
      samplePorts[1],
    ]);
  });

  it("dedupes passive unknown rows by binding identity", () => {
    const udpUnknown: PortInfo = {
      protocol: "udp4",
      localAddress: "*",
      localPort: "*",
      peerAddress: "",
      peerPort: "*",
      state: "UNKNOWN",
      pid: 649,
      process: "identityservicesd",
      localPortNum: 0,
    };

    expect(
      dedupePassivePorts([
        udpUnknown,
        { ...udpUnknown, peerAddress: "-", peerPort: "-" },
        { ...udpUnknown, state: " unknown " },
      ]),
    ).toEqual([udpUnknown]);
  });

  it("keeps filter transitions stable for displayed table rows", () => {
    const ports: PortInfo[] = [
      samplePorts[0],
      { ...samplePorts[0], state: "LISTENING" },
      samplePorts[1],
      samplePorts[2],
      {
        protocol: "udp",
        localAddress: "0.0.0.0",
        localPort: "5353",
        peerAddress: "",
        peerPort: "*",
        state: "CLOSE_WAIT",
        pid: 321,
        process: "mdnsresponder",
        localPortNum: 5353,
      },
      {
        protocol: "udp4",
        localAddress: "*",
        localPort: "*",
        peerAddress: "",
        peerPort: "*",
        state: "UNKNOWN",
        pid: 649,
        process: "identityservicesd",
        localPortNum: 0,
      },
      {
        protocol: "udp4",
        localAddress: "*",
        localPort: "*",
        peerAddress: "",
        peerPort: "*",
        state: "UNKNOWN",
        pid: 649,
        process: "identityservicesd",
        localPortNum: 0,
      },
    ];

    expect(getDisplayedPorts(ports, "", "process", "LISTEN")).toEqual([
      samplePorts[0],
      samplePorts[1],
    ]);

    expect(getDisplayedPorts(ports, "", "process", "ESTABLISHED")).toEqual([
      samplePorts[2],
    ]);

    expect(getDisplayedPorts(ports, "", "process", "other")).toEqual([
      {
        protocol: "udp",
        localAddress: "0.0.0.0",
        localPort: "5353",
        peerAddress: "",
        peerPort: "*",
        state: "CLOSE_WAIT",
        pid: 321,
        process: "mdnsresponder",
        localPortNum: 5353,
      },
      {
        protocol: "udp4",
        localAddress: "*",
        localPort: "*",
        peerAddress: "",
        peerPort: "*",
        state: "UNKNOWN",
        pid: 649,
        process: "identityservicesd",
        localPortNum: 0,
      },
    ]);

    expect(getDisplayedPorts(ports, "", "process", "all")).toEqual([
      samplePorts[0],
      samplePorts[1],
      samplePorts[2],
      {
        protocol: "udp",
        localAddress: "0.0.0.0",
        localPort: "5353",
        peerAddress: "",
        peerPort: "*",
        state: "CLOSE_WAIT",
        pid: 321,
        process: "mdnsresponder",
        localPortNum: 5353,
      },
      {
        protocol: "udp4",
        localAddress: "*",
        localPort: "*",
        peerAddress: "",
        peerPort: "*",
        state: "UNKNOWN",
        pid: 649,
        process: "identityservicesd",
        localPortNum: 0,
      },
    ]);

    expect(getDisplayedPorts(ports, "", "process", "LISTEN")).toEqual([
      samplePorts[0],
      samplePorts[1],
    ]);
  });

  it("sorts ports for display with listeners first", () => {
    expect(sortPortsForDisplay([samplePorts[2], samplePorts[1], samplePorts[0]])).toEqual([
      samplePorts[0],
      samplePorts[1],
      samplePorts[2],
    ]);
  });

  it("switches port finder to compact layout below the width threshold", () => {
    expect(shouldUseListeningPortsCompactLayout(960)).toBe(true);
    expect(shouldUseListeningPortsCompactLayout(1119)).toBe(true);
    expect(shouldUseListeningPortsCompactLayout(1120)).toBe(false);
  });
});
