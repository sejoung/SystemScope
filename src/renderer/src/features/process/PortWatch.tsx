import { PortWatchList } from "./PortWatchList";
import { PortWatchHistory } from "./PortWatchHistory";
import {
  btnStyle,
  errorTextStyle,
  headerStyle,
  inputStyle,
  sectionStyle,
  titleRowStyle,
  titleStyle,
  badgeStyle,
} from "./portWatchStyles";

const POLL_OPTIONS = [
  { value: 1000, label: "1s" },
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

export { shouldUsePortWatchCompactLayout } from "./usePortWatchModel";
import { usePortWatchModel } from "./usePortWatchModel";

export function PortWatch() {
  const { tk, containerRef, watches, statuses, history, monitoring, pollInterval, expandedWatch, watchFilters, removeWatch, clearHistory, setMonitoring, setPollInterval, toggleExpanded, setWatchFilter, input, setInput, setInputError, watchScope, setWatchScope, inputError, statusError, compactLayout, handleAddWatch } = usePortWatchModel()

  return (
    <section style={sectionStyle} ref={containerRef}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("process.port_watch.title")}</span>
          {monitoring && watches.length > 0 && (
            <span style={badgeStyle}>
              {tk("process.port_watch.badge", { count: watches.length })}
            </span>
          )}
        </div>
      </div>

      {/* Input controls */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: "var(--bg-primary)",
            borderRadius: "6px",
            padding: "2px",
            flexWrap: "wrap",
          }}
        >
          {(["local", "remote", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={watchScope === s}
              onClick={() => setWatchScope(s)}
              style={{
                padding: "4px 9px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                background:
                  watchScope === s ? "var(--accent-cyan)" : "transparent",
                color:
                  watchScope === s
                    ? "var(--text-on-accent)"
                    : "var(--text-muted)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (inputError) setInputError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddWatch();
          }}
          placeholder={
            watchScope === "local"
              ? tk("process.port_watch.placeholder_local")
              : watchScope === "remote"
                ? tk("process.port_watch.placeholder_remote")
                : tk("process.port_watch.placeholder_all")
          }
          aria-label={tk("process.port_watch.title")}
          aria-invalid={inputError ? "true" : "false"}
          aria-describedby={inputError ? "port-watch-input-error" : undefined}
          style={{ ...inputStyle, minWidth: compactLayout ? "100%" : inputStyle.minWidth }}
        />
        <button type="button" onClick={handleAddWatch} style={btnStyle}>
          {tk("process.port_watch.add")}
        </button>
        {watches.length > 0 && (
          <button
            type="button"
            onClick={() => setMonitoring(!monitoring)}
            aria-pressed={monitoring}
            style={{
              ...btnStyle,
              background: monitoring
                ? "var(--accent-red)"
                : "var(--accent-green)",
            }}
          >
            {monitoring ? tk("common.pause") : tk("common.resume")}
          </button>
        )}
        {watches.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "2px",
              background: "var(--bg-primary)",
              borderRadius: "6px",
              padding: "2px",
            }}
          >
            {POLL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={pollInterval === opt.value}
                onClick={() => setPollInterval(opt.value)}
                style={{
                  padding: "4px 9px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "5px",
                  background:
                    pollInterval === opt.value
                      ? "var(--accent-cyan)"
                      : "transparent",
                  color:
                    pollInterval === opt.value
                      ? "var(--text-on-accent)"
                      : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {monitoring && watches.length > 0 && (
          <span style={{ fontSize: "13px", color: "var(--accent-green)" }}>
            ● {tk("process.port_watch.monitoring")}
          </span>
        )}
      </div>

      {inputError && (
        <div id="port-watch-input-error" role="alert" style={errorTextStyle}>
          {inputError}
        </div>
      )}
      {statusError && (
        <div role="alert" style={errorTextStyle}>
          {statusError}
        </div>
      )}

      {watches.length === 0 ? (
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            padding: "4px 0",
          }}
        >
          {tk("process.port_watch.description")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <PortWatchList
            watches={watches}
            statuses={statuses}
            expandedWatch={expandedWatch}
            watchFilters={watchFilters}
            compactLayout={compactLayout}
            onToggleExpanded={toggleExpanded}
            onSetWatchFilter={setWatchFilter}
            onRemoveWatch={removeWatch}
          />
          <PortWatchHistory history={history} onClear={clearHistory} />
        </div>
      )}
    </section>
  );
}
