import type { PortInfo } from '@shared/types'
import { getStateStyle } from './portStateStyles'
import { formatPortAddress } from './portWatchUtils'
import { useI18n } from '../../i18n/useI18n'
import { CompactMetaItem, compactCardStyle, compactListStyle, compactMetaGridStyle } from '../../components/ui/CompactPrimitives'
import { stateBadgeStyle, tdStyle, thStyle, rowStyle } from './portWatchStyles'

const DISPLAY_LIMIT = 100

// ─── Sub-components ───

export function WatchDetailTable({
  display,
  hidden,
  activeFilter,
  filteredCount,
  compactLayout,
}: {
  display: PortInfo[];
  hidden: number;
  activeFilter: string;
  filteredCount: number;
  compactLayout: boolean;
}) {
  const { tk } = useI18n();
  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "6px 10px",
      }}
    >
      {activeFilter !== "all" && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginBottom: "6px",
          }}
        >
          {activeFilter === "LISTEN"
            ? tk("process.port_watch.filtered_listening", {
                count: filteredCount,
              })
            : activeFilter === "ESTABLISHED"
              ? tk("process.port_watch.filtered_established", {
                  count: filteredCount,
                })
              : tk("process.port_watch.filtered_other", {
                  count: filteredCount,
                })}
        </div>
      )}
      <div style={{ maxHeight: compactLayout ? undefined : "250px", overflow: compactLayout ? "visible" : "auto" }}>
        {compactLayout ? (
          <div style={compactListStyle}>
            {display.map((m) => (
              <div
                key={`${m.protocol}-${m.localAddress}-${m.localPort}-${m.peerAddress}-${m.peerPort}`}
                style={compactCardStyle}
              >
                <div style={compactWatchCardHeaderStyle}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={compactWatchProtocolStyle}>{m.protocol.toUpperCase()}</span>
                    <StateBadge state={m.state} />
                  </div>
                  <div style={compactWatchProcessStyle}>{m.process}</div>
                </div>
                <div style={compactMetaGridStyle}>
                  <CompactMetaItem
                    label={tk("process.port_watch.local")}
                    value={formatPortAddress(m.localAddress, m.localPort)}
                    mono
                    multiline
                  />
                  <CompactMetaItem
                    label={tk("process.port_watch.remote")}
                    value={formatPortAddress(m.peerAddress, m.peerPort)}
                    mono
                    multiline
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={thStyle}>{tk("process.port_watch.proto")}</th>
              <th style={thStyle}>{tk("process.port_watch.local")}</th>
              <th style={thStyle}>{tk("process.port_watch.remote")}</th>
              <th style={thStyle}>{tk("process.port_watch.process")}</th>
              <th style={thStyle}>{tk("process.port_watch.state")}</th>
            </tr>
          </thead>
          <tbody>
            {display.map((m) => (
              <tr
                key={`${m.protocol}-${m.localAddress}-${m.localPort}-${m.peerAddress}-${m.peerPort}`}
                style={rowStyle}
              >
                <td
                  style={{
                    ...tdStyle,
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.protocol}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.45,
                  }}
                >
                  {formatPortAddress(m.localAddress, m.localPort)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.45,
                  }}
                >
                  {formatPortAddress(m.peerAddress, m.peerPort)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.45,
                  }}
                >
                  {m.process}
                </td>
                <td style={tdStyle}>
                  <StateBadge state={m.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {hidden > 0 && (
        <div
          style={{
            padding: "8px 0",
            fontSize: "13px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {tk("process.port_watch.more", {
            count: hidden.toLocaleString(),
            limit: DISPLAY_LIMIT,
          })}
        </div>
      )}
    </div>
  );
}

export function StateCount({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const { tk } = useI18n();
  if (count === 0) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 600,
        border: active ? `1px solid ${color}` : "1px solid transparent",
        borderRadius: "999px",
        background: active ? `${color}20` : "transparent",
        color,
        cursor: "pointer",
      }}
      title={tk("process.port_watch.state_filter_title", {
        label:
          label === "L"
            ? tk("process.port_watch.state.listening")
            : label === "E"
              ? tk("process.port_watch.state.established")
              : tk("process.port_watch.state.other"),
      })}
    >
      {label}:{count.toLocaleString()}
    </button>
  );
}

function StateBadge({ state }: { state: string }) {
  const s = getStateStyle(state);
  return (
    <span
      style={{
        ...stateBadgeStyle,
        background: s.bg,
        color: s.color,
        borderColor: s.color,
      }}
      title={s.tip}
    >
      {state}
    </span>
  );
}

const compactWatchCardHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const compactWatchProtocolStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "var(--bg-primary)",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
};

const compactWatchProcessStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
  wordBreak: "break-word",
};
