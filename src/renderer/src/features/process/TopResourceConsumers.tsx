import { useProcessStore } from '../../stores/useProcessStore'
import { useSystemStore } from '../../stores/useSystemStore'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'

export function TopResourceConsumers() {
  const cpuProcesses = useProcessStore((s) => s.cpuProcesses)
  const memoryProcesses = useProcessStore((s) => s.memoryProcesses)
  const gpu = useSystemStore((s) => s.current?.gpu)

  const topCpu = cpuProcesses.slice(0, 3)
  const topMem = memoryProcesses.slice(0, 3)

  const hasData = topCpu.length > 0

  return (
    <Accordion title="Top Resource Consumers" defaultOpen>
      {!hasData ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 로딩 중...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* CPU */}
          <Section icon="var(--accent-blue)" label="CPU">
            {topCpu.map((p) => (
              <ProcessRow
                key={p.pid}
                name={p.name}
                value={`${p.cpu.toFixed(1)}%`}
                pct={p.cpu}
                color="var(--accent-blue)"
              />
            ))}
          </Section>

          {/* Memory */}
          <Section icon="var(--accent-green)" label="Memory">
            {topMem.map((p) => (
              <ProcessRow
                key={p.pid}
                name={p.name}
                value={formatBytes(p.memoryBytes)}
                pct={p.memory}
                color="var(--accent-green)"
              />
            ))}
          </Section>

          {/* GPU */}
          <Section icon="var(--accent-purple)" label="GPU">
            {gpu?.available && gpu.memoryUsed !== null && gpu.memoryTotal !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{gpu.model ?? 'GPU'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-purple)' }}>
                    {formatBytes(gpu.memoryUsed)} / {formatBytes(gpu.memoryTotal)}
                  </span>
                </div>
                <div style={{ height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min((gpu.memoryUsed / gpu.memoryTotal) * 100, 100)}%`,
                    height: '100%',
                    backgroundColor: 'var(--accent-purple)',
                    borderRadius: '2px',
                    transition: 'width 0.5s'
                  }} />
                </div>
                {gpu.usage !== null && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Utilization: {gpu.usage}%
                    {gpu.temperature !== null && ` / ${gpu.temperature}°C`}
                  </div>
                )}
              </div>
            ) : gpu?.available && gpu.model ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {gpu.model}
                <br />
                <span style={{ fontSize: '11px' }}>통합 메모리 — 별도 GPU 모니터링 불가</span>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                GPU를 감지할 수 없습니다
              </div>
            )}
          </Section>
        </div>
      )}
    </Accordion>
  )
}

function Section({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: icon }} />
        <span style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '14px' }}>
        {children}
      </div>
    </div>
  )
}

function ProcessRow({ name, value, pct, color }: { name: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)',
        width: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0
      }}>
        {name}
      </span>
      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          backgroundColor: pct > 50 ? 'var(--accent-red)' : color,
          borderRadius: '2px',
          minWidth: pct > 0 ? '2px' : '0',
          transition: 'width 0.5s'
        }} />
      </div>
      <span style={{
        fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
        color: pct > 50 ? 'var(--accent-red)' : 'var(--text-primary)',
        width: '65px', textAlign: 'right', flexShrink: 0
      }}>
        {value}
      </span>
    </div>
  )
}
