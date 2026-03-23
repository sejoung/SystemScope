import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { Accordion } from '../components/Accordion'
import { useToast } from '../components/Toast'
import type { AlertThresholds } from '@shared/types'
import { useI18n } from '../i18n/useI18n'
import type { AppLocale } from '@shared/i18n'

export function SettingsPage() {
  const thresholds = useSettingsStore((s) => s.thresholds)
  const setThresholds = useSettingsStore((s) => s.setThresholds)
  const theme = useSettingsStore((s) => s.theme)
  const locale = useSettingsStore((s) => s.locale)
  const setLocale = useSettingsStore((s) => s.setLocale)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setHasUnsavedSettings = useSettingsStore((s) => s.setHasUnsavedSettings)
  const [local, setLocal] = useState<AlertThresholds>(thresholds)
  const [snapshotInterval, setSnapshotInterval] = useState(60)
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>(theme)
  const [localLocale, setLocalLocale] = useState<AppLocale>(locale)
  const [saved, setSaved] = useState(false)
  const [dataPath, setDataPath] = useState<string | null>(null)
  const [logPath, setLogPath] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasEditedRef = useRef(false)
  const persistedRef = useRef<{
    thresholds: AlertThresholds
    snapshotInterval: number
    theme: 'dark' | 'light'
    locale: AppLocale
  }>({
    thresholds,
    snapshotInterval: 60,
    theme,
    locale
  })
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()

  useEffect(() => {
    window.systemScope.getSettings().then((res) => {
      if (res.ok && res.data) {
        const s = res.data as { thresholds: AlertThresholds; snapshotIntervalMin?: number; theme?: 'dark' | 'light'; locale?: AppLocale }
        persistedRef.current.thresholds = s.thresholds
        persistedRef.current.snapshotInterval = s.snapshotIntervalMin ?? 60
        if (s.theme) {
          persistedRef.current.theme = s.theme
        }
        if (s.locale) {
          persistedRef.current.locale = s.locale
        }

        if (!hasEditedRef.current) {
          setLocal(s.thresholds)
          if (s.snapshotIntervalMin) setSnapshotInterval(s.snapshotIntervalMin)
          if (s.theme) {
            setLocalTheme(s.theme)
          }
          if (s.locale) {
            setLocalLocale(s.locale)
          }
        }

        setThresholds(s.thresholds)
        if (s.theme) {
          setTheme(s.theme)
        }
        if (s.locale) {
          setLocale(s.locale)
        }
      }
    })
    window.systemScope.getDataPath().then((res) => {
      if (res.ok && res.data) setDataPath(res.data as string)
    })
    window.systemScope.getLogPath().then((res) => {
      if (res.ok && res.data) setLogPath(res.data as string)
    })

    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
      setHasUnsavedSettings(false)
    }
  }, [setHasUnsavedSettings, setLocale, setTheme, setThresholds])

  const appearanceDirty = localTheme !== persistedRef.current.theme
  const languageDirty = localLocale !== persistedRef.current.locale
  const alertsDirty = useMemo(
    () => JSON.stringify(local) !== JSON.stringify(persistedRef.current.thresholds),
    [local]
  )
  const snapshotsDirty = snapshotInterval !== persistedRef.current.snapshotInterval
  const isDirty = appearanceDirty || languageDirty || alertsDirty || snapshotsDirty

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
        locale: localLocale,
        snapshotIntervalMin: snapshotInterval
      })
      if (res.ok) {
        persistedRef.current = {
          thresholds: local,
          snapshotInterval,
          theme: localTheme,
          locale: localLocale
        }
        hasEditedRef.current = false
        setThresholds(local)
        setTheme(localTheme)
        setLocale(localLocale)
        setSaved(true)
        if (savedTimerRef.current) {
          clearTimeout(savedTimerRef.current)
        }
        savedTimerRef.current = setTimeout(() => {
          setSaved(false)
          savedTimerRef.current = null
        }, 2000)
      } else {
        showToast(res.error?.message ?? tk('settings.error.save_failed'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (key: keyof AlertThresholds, value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      hasEditedRef.current = true
      setLocal({ ...local, [key]: num })
    }
  }

  const handleOpenPath = async (targetPath: string | null, errorMessage: string) => {
    if (!targetPath) return
    const res = await window.systemScope.openPath(targetPath)
    if (!res.ok) {
      showToast(res.error?.message ?? errorMessage)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{tk('settings.page.title')}</h2>
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
          {isSaving ? tk('settings.status.saving') : saved ? tk('settings.status.saved') : isDirty ? tk('settings.status.unsaved_changes') : tk('settings.status.all_changes_saved')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <Accordion title={tk('settings.section.appearance')} defaultOpen badge={appearanceDirty ? tk('settings.badge.edited') : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {tk('settings.theme.description')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'dark', label: tk('settings.theme.dark') },
                { value: 'light', label: tk('settings.theme.light') }
              ].map((option) => {
                const active = localTheme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      hasEditedRef.current = true
                      setLocalTheme(option.value as 'dark' | 'light')
                    }}
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

        <Accordion title={tk('settings.section.language')} defaultOpen badge={languageDirty ? tk('settings.badge.edited') : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {tk('settings.language.description')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'ko' as const, label: tk('settings.language.korean') },
                { value: 'en' as const, label: tk('settings.language.english') }
              ].map((option) => {
                const active = localLocale === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      hasEditedRef.current = true
                      setLocalLocale(option.value)
                    }}
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
        <Accordion title={tk('settings.section.alerts')} defaultOpen badge={alertsDirty ? tk('settings.badge.edited') : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ThresholdGroup
              label={tk('settings.alerts.storage')}
              warning={local.diskWarning}
              critical={local.diskCritical}
              onWarningChange={(v) => updateField('diskWarning', v)}
              onCriticalChange={(v) => updateField('diskCritical', v)}
            />
            <ThresholdGroup
              label={tk('settings.alerts.memory')}
              warning={local.memoryWarning}
              critical={local.memoryCritical}
              onWarningChange={(v) => updateField('memoryWarning', v)}
              onCriticalChange={(v) => updateField('memoryCritical', v)}
            />
            <ThresholdGroup
              label={tk('settings.alerts.gpu_memory')}
              warning={local.gpuMemoryWarning}
              critical={local.gpuMemoryCritical}
              onWarningChange={(v) => updateField('gpuMemoryWarning', v)}
              onCriticalChange={(v) => updateField('gpuMemoryCritical', v)}
            />
          </div>
        </Accordion>

        {/* Snapshot Settings */}
        <Accordion title={tk('settings.section.snapshots')} defaultOpen badge={snapshotsDirty ? tk('settings.badge.edited') : undefined} badgeColor="var(--accent-yellow)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {tk('settings.snapshots.description')}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { value: 15, label: tk('settings.snapshots.option_15m') },
                { value: 30, label: tk('settings.snapshots.option_30m') },
                { value: 60, label: tk('settings.snapshots.option_1h') },
                { value: 120, label: tk('settings.snapshots.option_2h') },
                { value: 360, label: tk('settings.snapshots.option_6h') }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    hasEditedRef.current = true
                    setSnapshotInterval(opt.value)
                  }}
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
              {tk('settings.snapshots.current', { interval: snapshotInterval, days: Math.round((168 * snapshotInterval) / 60 / 24) })}
            </div>
          </div>
        </Accordion>

        {/* Data Storage */}
        <Accordion title={tk('settings.section.app_data')} defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {tk('settings.app_data.description')}
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
                  onClick={() => void handleOpenPath(dataPath, tk('settings.app_data.open_failed'))}
                  style={btnStyle}
                >
                  {tk('common.open')}
                </button>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <div>{tk('settings.app_data.config')}</div>
              <div>{tk('settings.app_data.window_state')}</div>
              <div>{tk('settings.app_data.snapshots')}</div>
            </div>
          </div>
        </Accordion>

        <Accordion title={tk('settings.section.logs')} defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {tk('settings.logs.description')}
            </div>
            {logPath && (
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
                  {logPath}
                </span>
                <button
                  onClick={() => void handleOpenPath(logPath, tk('settings.logs.open_failed'))}
                  style={btnStyle}
                >
                  {tk('common.open')}
                </button>
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <div>{tk('settings.logs.filename')}</div>
              <div>{tk('settings.logs.retention')}</div>
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
          {isSaving ? tk('settings.status.saving') : isDirty ? tk('settings.save.save_all') : tk('settings.status.saved')}
        </button>
        <span style={{ fontSize: '12px', color: saved ? 'var(--accent-green)' : isDirty ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
          {saved ? tk('settings.footer.saved') : isDirty ? tk('settings.footer.unsaved') : tk('settings.footer.current_saved')}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {tk('settings.footer.description')}
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
  const { tk } = useI18n()

  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            {tk('settings.alerts.warning')}
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
            {tk('settings.alerts.critical')}
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
  color: 'var(--text-primary)'
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
