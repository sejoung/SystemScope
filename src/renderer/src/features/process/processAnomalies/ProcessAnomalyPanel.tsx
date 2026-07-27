import { useMemo, useState } from 'react'
import type { ProcessInfo } from '@shared/types'
import { formatBytes } from '../../../utils/format'
import { CopyableValue } from '../../../components/ui/CopyableValue'
import { StatusMessage } from '../../../components/ui/StatusMessage'
import { useI18n } from '../../../i18n/useI18n'
import { useManualProcessTermination } from '../useManualProcessTermination'
import {
  DEFAULT_LONG_RUNNING_THRESHOLD_MS,
  formatProcessDuration,
  getProcessAnomalyEntries
} from './processAnomalyModel'
import { AnomalyBadge, FilterButton, Metric } from './ProcessAnomalyBits'
import {
  actionStyle,
  badgeRowStyle,
  cardHeaderStyle,
  cardStyle,
  checkboxLabelStyle,
  controlLabelStyle,
  controlsStyle,
  countBadgeStyle,
  dangerButtonStyle,
  dangerFilledButtonStyle,
  descriptionStyle,
  emptyStyle,
  filterGroupStyle,
  headerStyle,
  listStyle,
  metricsStyle,
  nameRowStyle,
  nameStyle,
  pidStyle,
  secondaryButtonStyle,
  sectionStyle,
  selectStyle,
  systemBadgeStyle,
  titleStyle,
  zombieHelpStyle
} from './ProcessAnomalyPanel.styles'

type AnomalyFilter = 'all' | 'long_running' | 'cpu' | 'zombie'

const LONG_RUNNING_OPTIONS = [
  { value: 10 * 60 * 1000, label: '10m' },
  { value: 60 * 60 * 1000, label: '1h' },
  { value: 24 * 60 * 60 * 1000, label: '1d' },
  { value: 7 * 24 * 60 * 60 * 1000, label: '7d' }
]

interface ProcessAnomalyPanelProps {
  processes: ProcessInfo[]
  onInspectProcess: (pid: number) => void
}

export function ProcessAnomalyPanel({
  processes,
  onInspectProcess
}: ProcessAnomalyPanelProps) {
  const { tk } = useI18n()
  const [thresholdMs, setThresholdMs] = useState(DEFAULT_LONG_RUNNING_THRESHOLD_MS)
  const [filter, setFilter] = useState<AnomalyFilter>('all')
  const [includeSystemProcesses, setIncludeSystemProcesses] = useState(false)
  const { terminatingPid, requestTermination } = useManualProcessTermination(
    'Activity > Process anomalies'
  )

  const entries = useMemo(
    () => getProcessAnomalyEntries(processes, thresholdMs, includeSystemProcesses),
    [processes, thresholdMs, includeSystemProcesses]
  )

  const filtered = useMemo(
    () => entries.filter((entry) => {
      if (filter === 'all') return true
      if (filter === 'cpu') {
        return entry.kinds.includes('high_cpu')
          || entry.kinds.includes('sustained_cpu')
      }
      return entry.kinds.includes(filter)
    }),
    [entries, filter]
  )

  const counts = useMemo(() => ({
    all: entries.length,
    long_running: entries.filter((entry) => entry.kinds.includes('long_running')).length,
    cpu: entries.filter((entry) =>
      entry.kinds.includes('high_cpu') || entry.kinds.includes('sustained_cpu')
    ).length,
    zombie: entries.filter((entry) => entry.kinds.includes('zombie')).length
  }), [entries])

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>{tk('process.anomaly.title')}</h3>
          <p style={descriptionStyle}>{tk('process.anomaly.description')}</p>
        </div>
        <span style={countBadgeStyle}>{filtered.length}</span>
      </div>

      <StatusMessage message={tk('process.anomaly.manual_only')} />

      <div style={controlsStyle}>
        <div style={filterGroupStyle} role="group" aria-label={tk('process.anomaly.filter_label')}>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            {tk('process.anomaly.filter.all', { count: counts.all })}
          </FilterButton>
          <FilterButton
            active={filter === 'long_running'}
            onClick={() => setFilter('long_running')}
          >
            {tk('process.anomaly.filter.long', { count: counts.long_running })}
          </FilterButton>
          <FilterButton active={filter === 'cpu'} onClick={() => setFilter('cpu')}>
            {tk('process.anomaly.filter.cpu', { count: counts.cpu })}
          </FilterButton>
          <FilterButton
            active={filter === 'zombie'}
            onClick={() => setFilter('zombie')}
          >
            {tk('process.anomaly.filter.zombie', { count: counts.zombie })}
          </FilterButton>
        </div>

        <label style={controlLabelStyle}>
          <span>{tk('process.anomaly.long_threshold')}</span>
          <select
            value={thresholdMs}
            onChange={(event) => setThresholdMs(Number(event.target.value))}
            style={selectStyle}
          >
            {LONG_RUNNING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={includeSystemProcesses}
            onChange={(event) => setIncludeSystemProcesses(event.target.checked)}
          />
          {tk('process.anomaly.include_system')}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div style={emptyStyle}>{tk('process.anomaly.empty')}</div>
      ) : (
        <div style={listStyle}>
          {filtered.map(({ process: processInfo, kinds, systemProcess }) => {
            const zombie = kinds.includes('zombie')
            const parentAvailable = processInfo.ppid > 1
              && processes.some((candidate) => candidate.pid === processInfo.ppid)

            return (
              <article key={processInfo.pid} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={nameRowStyle}>
                      <strong style={nameStyle}>{processInfo.name}</strong>
                      <span style={pidStyle}>PID {processInfo.pid}</span>
                      {systemProcess && (
                        <span style={systemBadgeStyle}>
                          {tk('process.anomaly.system_badge')}
                        </span>
                      )}
                    </div>
                    <div style={badgeRowStyle}>
                      {kinds.map((kind) => (
                        <AnomalyBadge key={kind} kind={kind} />
                      ))}
                    </div>
                  </div>

                  <div style={actionStyle}>
                    {zombie ? (
                      <button
                        type="button"
                        disabled={!parentAvailable}
                        onClick={() => onInspectProcess(processInfo.ppid)}
                        style={secondaryButtonStyle}
                        title={tk('process.anomaly.zombie_parent_help')}
                      >
                        {tk('process.anomaly.inspect_parent')}
                      </button>
                    ) : systemProcess ? (
                      <button
                        type="button"
                        onClick={() => onInspectProcess(processInfo.pid)}
                        style={secondaryButtonStyle}
                        title={tk('process.anomaly.system_review_help')}
                      >
                        {tk('process.anomaly.inspect_process')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={terminatingPid !== null}
                          onClick={() => void requestTermination(processInfo, false)}
                          style={dangerButtonStyle}
                        >
                          {tk('process.anomaly.review_terminate')}
                        </button>
                        {processInfo.descendantCount > 0 && (
                          <button
                            type="button"
                            disabled={terminatingPid !== null}
                            onClick={() => void requestTermination(processInfo, true)}
                            style={dangerFilledButtonStyle}
                          >
                            {tk('process.table.kill_tree_with_count', {
                              count: processInfo.descendantCount
                            })}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div style={metricsStyle}>
                  <Metric
                    label={tk('process.anomaly.runtime')}
                    value={formatProcessDuration(processInfo.uptimeMs)}
                  />
                  <Metric
                    label={tk('process.anomaly.cpu_now')}
                    value={`${processInfo.cpu.toFixed(1)}%`}
                  />
                  <Metric
                    label={tk('process.anomaly.cpu_average')}
                    value={
                      processInfo.cpuObservedMs >= 60_000
                        && processInfo.cpuAverage5m !== null
                        ? `${processInfo.cpuAverage5m.toFixed(1)}%`
                        : tk('process.anomaly.collecting')
                    }
                  />
                  <Metric
                    label={tk('process.table.memory')}
                    value={formatBytes(processInfo.memoryBytes)}
                  />
                  <Metric
                    label={tk('process.anomaly.state')}
                    value={processInfo.state}
                  />
                  <Metric
                    label={tk('process.anomaly.user')}
                    value={processInfo.user || '—'}
                  />
                </div>

                {processInfo.command && processInfo.command !== processInfo.name && (
                  <CopyableValue
                    value={processInfo.command}
                    fontSize="12px"
                    color="var(--text-muted)"
                    multiline
                  />
                )}

                {zombie && (
                  <p style={zombieHelpStyle}>
                    {tk('process.anomaly.zombie_help')}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
