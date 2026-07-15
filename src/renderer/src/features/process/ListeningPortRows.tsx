import type { PortInfo } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { CompactMetaItem, compactActionsStyle, compactCardHeaderStyle, compactCardStyle, compactListStyle, compactMetaGridStyle } from '../../components/ui/CompactPrimitives'
import { ExposureBadge, StateBadge } from './ListeningPortPanels'
import { formatEndpoint } from './listeningPortUtils'
import { desktopTableWrapStyle, killActionsStyle, killBtnStyle, killTreeBtnStyle, portValueStyle, protocolPillStyle, rowStyle, stickyHeaderRowStyle, tdStyle, thStyle } from './ListeningPorts.styles'

const DESKTOP_PORT_GRID_TEMPLATE = '74px 104px minmax(180px, 1.2fr) 72px 116px minmax(220px, 1fr) 124px 200px'

export function ListeningPortRows({ compactLayout, displayRows, handleKill, tk }: { compactLayout: boolean; displayRows: PortInfo[]; handleKill: (port: PortInfo, tree: boolean) => Promise<void>; tk: TranslateFn }) {
  return (compactLayout ? (
              <div style={compactListStyle}>
                {displayRows.map((p) => (
                  <div
                    key={`${p.protocol}-${p.localAddress}-${p.localPort}-${p.peerAddress}-${p.peerPort}-${p.state}-${p.pid}`}
                    style={compactCardStyle}
                  >
                    <div style={compactCardHeaderStyle}>
                      <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={portValueStyle}>{p.localPort}</span>
                          <span style={protocolPillStyle}>{p.protocol.toUpperCase()}</span>
                          <StateBadge state={p.state} />
                        </div>
                        <CopyableValue
                          value={p.process}
                          fontSize="14px"
                          color="var(--text-primary)"
                          multiline
                        />
                      </div>
                      <ExposureBadge address={p.localAddress} />
                    </div>

                    <div style={compactMetaGridStyle}>
                      <CompactMetaItem
                        label={tk("Local")}
                        value={formatEndpoint(p.localAddress, p.localPort)}
                        mono
                      />
                      <CompactMetaItem
                        label={tk("process.port_finder.remote")}
                        value={formatEndpoint(p.peerAddress, p.peerPort)}
                        mono
                        muted
                      />
                      <CompactMetaItem label="PID" value={String(p.pid)} mono />
                    </div>

                    <div
                      style={{
                        ...compactActionsStyle,
                        justifyContent: "flex-end",
                      }}
                    >
                      <div style={killActionsStyle}>
                        <button
                          onClick={() => void handleKill(p, false)}
                          style={killBtnStyle}
                        >
                          {tk("process.port_finder.kill")}
                        </button>
                        <button
                          onClick={() => void handleKill(p, true)}
                          style={killTreeBtnStyle}
                          title={tk("process.port_finder.kill_tree")}
                        >
                          {tk("process.port_finder.kill_tree")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={desktopTableWrapStyle}>
              <div
                style={{
                  width: "100%",
                  minWidth: "980px",
                  fontSize: "13px",
                }}
              >
                <div
                  role="row"
                  style={{
                    ...stickyHeaderRowStyle,
                    display: "grid",
                    gridTemplateColumns: DESKTOP_PORT_GRID_TEMPLATE,
                  }}
                >
                  <div style={thStyle}>{tk("process.port_finder.proto")}</div>
                  <div style={thStyle}>
                    {tk("process.port_finder.local_port")}
                  </div>
                  <div style={thStyle}>{tk("process.port_finder.process")}</div>
                  <div style={thStyle}>PID</div>
                  <div style={thStyle}>{tk("Exposure")}</div>
                  <div style={thStyle}>{tk("process.port_finder.remote")}</div>
                  <div style={thStyle}>{tk("process.port_finder.state")}</div>
                  <div
                    style={{ ...thStyle, textAlign: "center" }}
                  >
                    {tk("process.port_finder.action")}
                  </div>
                </div>
                <div>
                  {displayRows.map((p) => (
                    <div
                      key={`${p.protocol}-${p.localAddress}-${p.localPort}-${p.peerAddress}-${p.peerPort}-${p.state}-${p.pid}`}
                      style={{
                        ...rowStyle,
                        display: "grid",
                        gridTemplateColumns: DESKTOP_PORT_GRID_TEMPLATE,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {p.protocol}
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "var(--accent-cyan)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={portValueStyle}>{p.localPort}</span>
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                        }}
                      >
                        <CopyableValue
                          value={p.process}
                          fontSize="13px"
                          color="var(--text-primary)"
                          maxWidth="200px"
                        />
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.pid}
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <ExposureBadge address={p.localAddress} />
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: 1.45,
                          overflow: "hidden",
                        }}
                      >
                        <CopyableValue
                          value={formatEndpoint(p.peerAddress, p.peerPort)}
                          fontSize="13px"
                          color="var(--text-muted)"
                          maxWidth="220px"
                        />
                      </div>
                      <div style={tdStyle}>
                        <StateBadge state={p.state} />
                      </div>
                      <div
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={killActionsStyle}>
                          <button
                            onClick={() => void handleKill(p, false)}
                            style={killBtnStyle}
                          >
                            {tk("process.port_finder.kill")}
                          </button>
                          <button
                            onClick={() => void handleKill(p, true)}
                            style={killTreeBtnStyle}
                            title={tk("process.port_finder.kill_tree")}
                          >
                            {tk("process.port_finder.kill_tree")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            ))
}
