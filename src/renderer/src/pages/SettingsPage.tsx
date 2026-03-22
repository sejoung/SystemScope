import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { Accordion } from '../components/Accordion'
import { useToast } from '../components/Toast'
import type { AlertThresholds } from '@shared/types'

export function SettingsPage() {
  const thresholds = useSettingsStore((s) => s.thresholds)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setHasUnsavedSettings = useSettingsStore((s) => s.setHasUnsavedSettings)
  const [local, setLocal] = useState<AlertThresholds>(thresholds)
  const [snapshotInterval, setSnapshotInterval] = useState(60)
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>(theme)
  const [saved, setSaved] = useState(false)
  const [dataPath, setDataPath] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistedRef = useRef<{
    thresholds: AlertThresholds
    snapshotInterval: number
    theme: 'dark' | 'light'
  }>({
    thresholds,
    snapshotInterval: 60,
    theme
  })
  const showToast = useToast((s) => s.show)

  useEffect(() => {
    window.systemScope.getSettings().then((res) => {
      if (res.ok && res.data) {
        const s = res.data as { thresholds: AlertThresholds; snapshotIntervalMin?: number; theme?: 'dark' | 'light' }
        setLocal(s.thresholds)
        setThresholds(s.thresholds)
        persistedRef.current.thresholds = s.thresholds
        if (s.snapshotIntervalMin) setSnapshotInterval(s.snapshotIntervalMin)
        persistedRef.current.snapshotInterval = s.snapshotIntervalMin ?? 60
        if (s.theme) {
          setLocalTheme(s.theme)
          setTheme(s.theme)
          persistedRef.current.theme = s.theme
        }
      }
    })
    window.systemScope.getDataPath().then((res) => {
      if (res.ok && res.data) setDataPath(res.data as string)
    })

    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
      setHasUnsavedSettings(false)
    }
  }, [setHasUnsavedSettings, setTheme, setThresholds])

  const appearanceDirty = localTheme !== persistedRef.current.theme
  const alertsDirty = useMemo(
    () => JSON.stringify(local) !== JSON.stringify(persistedRef.current.thresholds),
    [local]
  )
  const snapshotsDirty = snapshotInterval !== persistedRef.current.snapshotInterval
  const isDirty = appearanceDirty || alertsDirty || snapshotsDirty

  useEffect(() => {
    setHasUnsavedSettings(isDirty)
    if (isDirty && saved) {
      setSaved(false)
    }
  }, [isDirty, saved, setHasUnsavedSettings])

  const handleSave = async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)
    try {
      const res = await window.systemScope.setSettings({
        thresholds: local,
        theme: localTheme,
        snapshotIntervalMin: snapshotInterval
      })
      if (res.ok) {
        persistedRef.current = {
          thresholds: local,
          snapshotInterval,
          theme: localTheme
        }
        setThresholds(local)
        setTheme(localTheme)
        setSaved(true)
        if (savedTimerRef.current) {
          clearTimeout(savedTimerRef.current)
        }
        savedTimerRef.current = setTimeout(() => {
          setSaved(false)
          savedTimerRef.current = null
        }, 2000)
      } else {
        showToast(res.error?.message ?? '설정을 저장하지 못했습니다.')
      }
    } finally {
      setIsSaving(false)
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Preferences</h2>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '999px',
            background: isDirty ? 'rgba(245, 158, 11, 0.16)' : 'rgba(34, 197, 94, 0.16)',
            color: isDirty ? 'var(--accent-yellow)' : 'var(--accent-green)'
          }}
        >
          {isSaving ? 'Saving...' : saved ? 'Saved' : isDirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <Accordion title="Appearance" defaultOpen badge={appearanceDirty ? 'Edited' : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              앱 전체 색상 테마를 선택합니다.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' }
              ].map((option) => {
                const active = localTheme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setLocalTheme(option.value as 'dark' | 'light')}
                    style={{
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius)',
                      border: active ? '1px solid transparent' : '1px solid var(--border)',
                      background: active ? 'var(--accent-blue)' : 'var(--bg-card)',
                      color: active ? 'var(--text-on-accent)' : 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Accordion>

        {/* Alert Thresholds */}
        <Accordion title="Alerts" defaultOpen badge={alertsDirty ? 'Edited' : undefined} badgeColor="var(--accent-yellow)">
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
          </div>
        </Accordion>

        {/* Snapshot Settings */}
        <Accordion title="Snapshots" defaultOpen badge={snapshotsDirty ? 'Edited' : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Growth View에서 폴더 크기 변화를 추적하기 위한 스냅샷 주기입니다.
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { value: 15, label: '15분' },
                { value: 30, label: '30분' },
                { value: 60, label: '1시간' },
                { value: 120, label: '2시간' },
                { value: 360, label: '6시간' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSnapshotInterval(opt.value)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    background: snapshotInterval === opt.value ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                    color: snapshotInterval === opt.value ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              현재: <strong style={{ color: 'var(--text-primary)' }}>{snapshotInterval}분</strong> 간격 /
              최대 보관: <strong style={{ color: 'var(--text-primary)' }}>168개</strong> (약 {Math.round((168 * snapshotInterval) / 60 / 24)}일분)
            </div>
          </div>
        </Accordion>

        {/* Data Storage */}
        <Accordion title="App Data" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              설정, 스냅샷, 로그 등 앱 데이터가 저장되는 경로입니다.
            </div>
            {dataPath && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)'
              }}>
                <span style={{
                  flex: 1, fontSize: '13px', fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {dataPath}
                </span>
                <button
                  onClick={() => window.systemScope.openPath(dataPath)}
                  style={btnStyle}
                >
                  Open
                </button>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <div>config.json — 알림 임계치, 테마 설정</div>
              <div>window-state.json — 창 크기/위치</div>
              <div>snapshots/growth.json — 폴더 크기 스냅샷 (Growth View용)</div>
            </div>
          </div>
        </Accordion>
      </div>

      {/* Save bar — 하단 고정 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginTop: '20px', padding: '12px 16px',
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)'
      }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          style={{
            ...btnStyle,
            opacity: !isDirty || isSaving ? 0.55 : 1,
            cursor: !isDirty || isSaving ? 'default' : 'pointer'
          }}
        >
          {isSaving ? 'Saving...' : isDirty ? 'Save All' : 'Saved'}
        </button>
        <span style={{ fontSize: '12px', color: saved ? 'var(--accent-green)' : isDirty ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
          {saved ? '모든 변경사항이 저장되었습니다.' : isDirty ? '저장하지 않은 변경사항이 있습니다.' : '현재 표시 중인 설정은 저장된 상태입니다.'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          테마, 알림 임계치, 스냅샷 주기를 함께 저장합니다
        </span>
      </div>
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

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}
