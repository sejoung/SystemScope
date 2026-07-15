import type { PortInfo } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { getStateStyle } from './portStateStyles'
import { conflictActionsStyle, conflictBadgeStyle, conflictCardStyle, conflictEmptyStyle, conflictHeaderStyle, conflictHintStyle, conflictMainRowStyle, conflictPidStyle, conflictPortStyle, conflictProcessStyle, conflictRowStyle, conflictSubtitleStyle, conflictTitleStyle, inspectBtnStyle, resolveBtnStyle, resolveTreeBtnStyle, stateBadgeStyle } from './ListeningPorts.styles'
import { getExposure, type PortConflict } from './listeningPortUtils'

export function ExposureBadge({ address }: { address: string }) {
  const exposure = getExposure(address);
  return (
    <span
      style={{
        ...stateBadgeStyle,
        minWidth: "96px",
        background: exposure.bg,
        color: exposure.color,
        borderColor: exposure.color,
      }}
      title={exposure.note}
    >
      {exposure.label}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number;
  tone: string;
  note: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
        display: "grid",
        gap: "4px",
      }}
    >
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {note}
      </div>
    </div>
  );
}

export function PortConflictCenterPanel({
  conflicts,
  onKill,
  onInspectPort,
  tk,
}: {
  conflicts: PortConflict[];
  onKill: (port: PortInfo, tree: boolean) => Promise<void>;
  onInspectPort: (port: number) => void;
  tk: TranslateFn;
}) {
  return (
    <div style={conflictCardStyle}>
      <div style={conflictHeaderStyle}>
        <div>
          <div style={conflictTitleStyle}>{tk("Port Conflict Center")}</div>
          <div style={conflictSubtitleStyle}>
            {conflicts.length > 0
              ? tk("Common development ports currently in use")
              : tk("No common development port conflicts detected right now.")}
          </div>
        </div>
        <span style={conflictBadgeStyle}>
          {tk("{count} conflicts", { count: conflicts.length })}
        </span>
      </div>

      {conflicts.length === 0 ? (
        <div style={conflictEmptyStyle}>
          {tk("Ports like 3000, 5173, 5432, and 8080 will appear here when occupied.")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {conflicts.map((conflict) => (
            <div key={`${conflict.port}-${conflict.pid}`} style={conflictRowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={conflictMainRowStyle}>
                  <span style={conflictPortStyle}>{conflict.port}</span>
                  <span style={conflictProcessStyle}>{conflict.process}</span>
                  <span style={conflictPidStyle}>PID {conflict.pid}</span>
                </div>
                <div style={conflictHintStyle}>
                  {tk("{reason} Recommend trying {port} next.", {
                    reason: conflict.reason,
                    port: conflict.recommendedPort,
                  })}
                </div>
              </div>
              <div style={conflictActionsStyle}>
                <button
                  type="button"
                  onClick={() => onInspectPort(conflict.port)}
                  style={inspectBtnStyle}
                >
                  {tk("Inspect")}
                </button>
                <button
                  type="button"
                  onClick={() => void onKill(conflict.portInfo, false)}
                  style={resolveBtnStyle}
                >
                  {tk("Kill PID")}
                </button>
                <button
                  type="button"
                  onClick={() => void onKill(conflict.portInfo, true)}
                  style={resolveTreeBtnStyle}
                  title={tk("process.port_finder.kill_tree")}
                >
                  {tk("process.port_finder.kill_tree")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StateBadge({ state }: { state: string }) {
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

export function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: "5px 11px",
        fontSize: "12px",
        fontWeight: active ? 600 : 400,
        border: "none",
        borderRadius: "5px",
        background: active ? "var(--accent-cyan)" : "var(--bg-card-hover)",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ─── Styles ───
