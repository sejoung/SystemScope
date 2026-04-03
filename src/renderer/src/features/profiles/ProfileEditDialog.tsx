import { useState } from 'react'
import { useProfileStore } from '../../stores/useProfileStore'
import { useI18n } from '../../i18n/useI18n'
import type { WorkspaceProfile, AlertThresholds, DashboardWidgetKey } from '@shared/types'
import { DEFAULT_THRESHOLDS, DASHBOARD_WIDGET_KEYS, PROFILE_NAME_MAX_LENGTH, MAX_WORKSPACE_PATHS } from '@shared/types'

const ICON_OPTIONS = ['\u{1F4BB}', '\u{1F3E0}', '\u{1F3A8}', '\u{1F680}', '\u{1F9EA}', '\u{1F4CA}', '\u{1F527}', '\u{1F4D6}', '\u{26A1}', '\u{1F3AF}']

const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  cpu: 'CPU', memory: 'Memory', gpu: 'GPU', disk: 'Disk', network: 'Network',
  realtimeChart: 'Realtime Chart', storage: 'Storage', growth: 'Growth', topProcesses: 'Top Processes',
}

interface ProfileEditDialogProps {
  profile: WorkspaceProfile | null
  onClose: () => void
  onSaved: () => void
}

export function ProfileEditDialog({ profile, onClose, onSaved }: ProfileEditDialogProps) {
  const { tk } = useI18n()
  const saveProfile = useProfileStore((s) => s.saveProfile)
  const [name, setName] = useState(profile?.name ?? '')
  const [icon, setIcon] = useState(profile?.icon ?? ICON_OPTIONS[0])
  const [thresholds, setThresholds] = useState<AlertThresholds>(profile?.thresholds ?? { ...DEFAULT_THRESHOLDS })
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetKey[]>(profile?.hiddenWidgets ?? [])
  const [workspacePaths, setWorkspacePaths] = useState<string[]>(profile?.workspacePaths ?? [])
  const [automationSchedule, setAutomationSchedule] = useState<WorkspaceProfile['automationSchedule']>(
    profile?.automationSchedule ?? null
  )
  const [saving, setSaving] = useState(false)

  function toggleWidget(key: DashboardWidgetKey) {
    setHiddenWidgets((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  const thresholdError = (() => {
    const t = thresholds
    if (t.cpuWarning >= t.cpuCritical) return 'CPU Warning must be less than Critical'
    if (t.memoryWarning >= t.memoryCritical) return 'Memory Warning must be less than Critical'
    if (t.diskWarning >= t.diskCritical) return 'Disk Warning must be less than Critical'
    if (t.gpuMemoryWarning >= t.gpuMemoryCritical) return 'GPU Memory Warning must be less than Critical'
    for (const v of Object.values(t)) {
      if (v < 0 || v > 100) return 'Threshold values must be 0-100'
    }
    return null
  })()

  async function handleSave() {
    if (!name.trim() || thresholdError) return
    setSaving(true)
    const saved = await saveProfile({
      id: profile?.id ?? '',
      name: name.trim(),
      icon,
      thresholds,
      cleanupRules: profile?.cleanupRules ?? [],
      hiddenWidgets,
      workspacePaths,
      automationSchedule,
    })
    setSaving(false)
    if (saved) onSaved()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={profile ? tk('Edit Profile') : tk('Create Profile')}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
          {profile ? tk('Edit Profile') : tk('Create Profile')}
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Profile Name')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, PROFILE_NAME_MAX_LENGTH))}
            placeholder={tk('Profile Name')} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Profile Icon')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICON_OPTIONS.map((emoji) => (
              <button key={emoji} onClick={() => setIcon(emoji)} style={{
                fontSize: 20, padding: '4px 8px', borderRadius: 6,
                border: icon === emoji ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                backgroundColor: icon === emoji ? 'color-mix(in srgb, var(--accent-blue) 15%, var(--bg-card))' : 'transparent',
                cursor: 'pointer',
              }}>{emoji}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Alerts')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.keys(thresholds) as (keyof AlertThresholds)[]).map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 120 }}>{key}</span>
                <input type="number" min={0} max={100} value={thresholds[key]}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 60, padding: '4px 6px' }} />
              </div>
            ))}
          </div>
          {thresholdError && (
            <div style={{ fontSize: 11, color: 'var(--accent-red, #e53e3e)', marginTop: 4 }}>{thresholdError}</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Hidden Widgets')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DASHBOARD_WIDGET_KEYS.map((key) => (
              <button key={key} onClick={() => toggleWidget(key)} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                backgroundColor: hiddenWidgets.includes(key)
                  ? 'color-mix(in srgb, var(--accent-red, #e53e3e) 15%, var(--bg-card))' : 'var(--bg-secondary)',
                color: hiddenWidgets.includes(key) ? 'var(--accent-red, #e53e3e)' : 'var(--text-primary)',
                cursor: 'pointer', fontSize: 11,
                textDecoration: hiddenWidgets.includes(key) ? 'line-through' : 'none',
              }}>{WIDGET_LABELS[key]}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Tracked Workspaces')}</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {workspacePaths.map((workspacePath) => (
              <div key={workspacePath} style={workspaceRowStyle}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{workspacePath}</span>
                <button
                  type="button"
                  onClick={() => setWorkspacePaths((prev) => prev.filter((entry) => entry !== workspacePath))}
                  style={removeButtonStyle}
                >
                  {tk('Remove')}
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={workspacePaths.length >= MAX_WORKSPACE_PATHS}
              onClick={() => {
                void window.systemScope.selectFolder().then((res) => {
                  if (res.ok && typeof res.data === 'string' && !workspacePaths.includes(res.data)) {
                    const nextPath = res.data
                    setWorkspacePaths((prev) => [...prev, nextPath])
                  }
                })
              }}
              style={{
                ...inputStyle,
                cursor: workspacePaths.length >= MAX_WORKSPACE_PATHS ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: workspacePaths.length >= MAX_WORKSPACE_PATHS ? 0.5 : 1
              }}
            >
              {tk('Add workspace folder')}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{tk('Profile Automation')}</label>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={automationSchedule !== null}
                onChange={(event) => {
                  setAutomationSchedule(event.target.checked ? { enabled: true, frequency: 'weekly' } : null)
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tk('Override global automation schedule')}</span>
            </label>
            {automationSchedule && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={automationSchedule.enabled}
                    onChange={(event) => setAutomationSchedule((prev) => prev ? { ...prev, enabled: event.target.checked } : prev)}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tk('Enable automated scanning')}</span>
                </label>
                <select
                  value={automationSchedule.frequency}
                  onChange={(event) => setAutomationSchedule((prev) => prev ? {
                    ...prev,
                    frequency: event.target.value as NonNullable<WorkspaceProfile['automationSchedule']>['frequency']
                  } : prev)}
                  style={inputStyle}
                >
                  <option value="daily">{tk('Daily')}</option>
                  <option value="weekly">{tk('Weekly')}</option>
                  <option value="manual">{tk('Manual only')}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {tk('Cancel')}
          </button>
          <button onClick={() => void handleSave()} disabled={!name.trim() || saving || !!thresholdError}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)', cursor: 'pointer', opacity: !name.trim() || saving || thresholdError ? 0.5 : 1 }}>
            {saving ? '...' : tk('Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const workspaceRowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }
const removeButtonStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--accent-red, #e53e3e)', cursor: 'pointer', fontSize: 11 }
