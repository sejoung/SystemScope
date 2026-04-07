import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { GaugeChart } from '../../components/GaugeChart'
import { ProgressBar } from '../../components/ProgressBar'
import { useCompactLayout, useContainerWidth } from '../../hooks/useContainerWidth'
import { useI18n } from '../../i18n/useI18n'

const COMPACT_HEADER_HEIGHT = 108
const DEFAULT_WIDGET_WIDTH = 360

export function CpuWidget() {
  const cpu = useSystemStore((s) => s.current?.cpu)
  const { tk } = useI18n()
  const [ref, width] = useContainerWidth(DEFAULT_WIDGET_WIDTH)
  const isCompact = useCompactLayout(width)

  if (!cpu) {
    return (
      <Accordion title={tk('monitoring.cpu.title')} defaultOpen>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tk('monitoring.loading')}</div>
      </Accordion>
    )
  }

  const avgCore = cpu.cores.length > 0
    ? cpu.cores.reduce((sum, value) => sum + value, 0) / cpu.cores.length
    : cpu.usage
  const peakCore = cpu.cores.length > 0 ? Math.max(...cpu.cores) : cpu.usage

  return (
    <Accordion title={tk('monitoring.cpu.title')} defaultOpen>
      <div
        ref={ref}
        style={{
          display: 'flex',
          gap: isCompact ? '12px' : '20px',
          alignItems: isCompact ? 'stretch' : 'flex-start',
          flexDirection: isCompact ? 'column' : 'row'
        }}
      >
        {isCompact ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              height: `${COMPACT_HEADER_HEIGHT}px`,
              padding: '4px 0 0'
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: cpu.usage > 80 ? 'var(--accent-red)' : cpu.usage > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)',
                lineHeight: 1
              }}
            >
              {cpu.usage.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
              {tk('monitoring.cpu.usage')}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              marginTop: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              color: cpu.usage > 80 ? 'var(--accent-red)' : cpu.usage > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)',
              background: cpu.usage > 80 ? 'var(--alert-red-soft)' : cpu.usage > 50 ? 'var(--alert-yellow-soft)' : 'var(--success-soft)',
            }}>
              {cpu.usage > 80 ? tk('monitoring.cpu.status.critical') : cpu.usage > 50 ? tk('monitoring.cpu.status.high') : tk('monitoring.cpu.status.normal')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
              {cpu.model}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
              {tk('monitoring.cpu.cores', { count: cpu.cores.length, speed: cpu.speed })}
              {cpu.temperature !== null && ` / ${cpu.temperature}°C`}
            </div>
          </div>
        ) : (
          <GaugeChart
            value={cpu.usage}
            label={tk('monitoring.cpu.usage')}
            color={cpu.usage > 80 ? 'var(--accent-red)' : cpu.usage > 50 ? 'var(--accent-yellow)' : 'var(--accent-green)'}
            subtitle={cpu.model}
            size={120}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isCompact ? '8px' : '6px', minWidth: 0 }}>
          {isCompact ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              <CompactStat
                label={tk('monitoring.cpu.avg_core')}
                value={`${avgCore.toFixed(0)}%`}
                color="var(--accent-green)"
              />
              <CompactStat
                label={tk('monitoring.cpu.peak_core')}
                value={`${peakCore.toFixed(0)}%`}
                color={peakCore > 80 ? 'var(--accent-red)' : 'var(--accent-yellow)'}
              />
              {cpu.cores.slice(0, 4).map((core, coreIndex) => (
                <CompactStat
                  key={`core-${coreIndex}`}
                  label={`Core ${coreIndex}`}
                  value={`${core.toFixed(0)}%`}
                  color={core > 80 ? 'var(--accent-red)' : 'var(--accent-blue)'}
                />
              ))}
            </div>
          ) : (
            <>
              {cpu.cores.slice(0, 8).map((core, coreIndex) => (
                <ProgressBar
                  key={`core-${coreIndex}`}
                  value={core}
                  label={`Core ${coreIndex}`}
                  height={4}
                  color={core > 80 ? 'var(--accent-red)' : 'var(--accent-blue)'}
                  showValue={false}
                />
              ))}
              {cpu.cores.length > 8 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {tk('monitoring.cpu.more_cores', { count: cpu.cores.length - 8 })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Accordion>
  )
}

function CompactStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '2px',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'color-mix(in srgb, var(--bg-card-hover) 72%, transparent)'
      }}
    >
      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
