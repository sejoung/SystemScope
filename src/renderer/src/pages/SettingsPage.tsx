import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { Card } from '../components/Card'
import type { AlertThresholds } from '@shared/types'

export function SettingsPage() {
  const thresholds = useSettingsStore((s) => s.thresholds)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const [local, setLocal] = useState<AlertThresholds>(thresholds)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.systemScope.getSettings().then((res) => {
      if (res.ok && res.data) {
        const s = res.data as { thresholds: AlertThresholds }
        setLocal(s.thresholds)
        setThresholds(s.thresholds)
      }
    })
  }, [setThresholds])

  const handleSave = async () => {
    const res = await window.systemScope.setSettings({ thresholds: local })
    if (res.ok) {
      setThresholds(local)
      await window.systemScope.updateThresholds(local as unknown as Record<string, number>)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const updateField = (key: keyof AlertThresholds, value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setLocal({ ...local, [key]: num })
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Settings</h2>

      <Card title="Alert Thresholds" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ThresholdGroup
            label="Disk"
            warning={local.diskWarning}
            critical={local.diskCritical}
            onWarningChange={(v) => updateField('diskWarning', v)}
            onCriticalChange={(v) => updateField('diskCritical', v)}
          />
          <ThresholdGroup
            label="Memory"
            warning={local.memoryWarning}
            critical={local.memoryCritical}
            onWarningChange={(v) => updateField('memoryWarning', v)}
            onCriticalChange={(v) => updateField('memoryCritical', v)}
          />
          <ThresholdGroup
            label="GPU Memory"
            warning={local.gpuMemoryWarning}
            critical={local.gpuMemoryCritical}
            onWarningChange={(v) => updateField('gpuMemoryWarning', v)}
            onCriticalChange={(v) => updateField('gpuMemoryCritical', v)}
          />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius)',
                background: 'var(--accent-blue)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            {saved && (
              <span style={{ fontSize: '12px', color: 'var(--accent-green)' }}>Saved!</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function ThresholdGroup({
  label,
  warning,
  critical,
  onWarningChange,
  onCriticalChange
}: {
  label: string
  warning: number
  critical: number
  onWarningChange: (v: string) => void
  onCriticalChange: (v: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Warning (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={warning}
            onChange={(e) => onWarningChange(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Critical (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={critical}
            onChange={(e) => onCriticalChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '80px',
  padding: '6px 10px',
  fontSize: '13px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none'
}
