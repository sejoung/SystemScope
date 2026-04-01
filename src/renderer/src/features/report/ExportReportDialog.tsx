import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'
import type { ReportSections } from '@shared/types'
import { isDiagnosticReportData } from '@shared/types/guards'

interface ExportReportDialogProps {
  open: boolean
  onClose: () => void
}

const SECTION_KEYS: { key: keyof ReportSections; labelKey: string }[] = [
  { key: 'systemSummary', labelKey: 'System Summary' },
  { key: 'recentHistory', labelKey: 'Recent History' },
  { key: 'activeAlerts', labelKey: 'Active Alerts' },
  { key: 'topProcesses', labelKey: 'Top Processes' },
  { key: 'diskCleanup', labelKey: 'Disk Cleanup Candidates' },
  { key: 'dockerReclaim', labelKey: 'Docker Resources' },
  { key: 'diagnosis', labelKey: 'Diagnosis' },
]

export function ExportReportDialog({ open, onClose }: ExportReportDialogProps) {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)

  const [sections, setSections] = useState<ReportSections>({
    systemSummary: true,
    recentHistory: true,
    activeAlerts: true,
    topProcesses: true,
    diskCleanup: true,
    dockerReclaim: true,
    diagnosis: true,
  })
  const [maskPaths, setMaskPaths] = useState(true)
  const [building, setBuilding] = useState(false)

  if (!open) return null

  const toggleSection = (key: keyof ReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleExport = async (format: 'markdown' | 'json') => {
    setBuilding(true)
    try {
      const buildRes = await window.systemScope.buildDiagnosticReport({
        sections,
        maskSensitivePaths: maskPaths,
      })

      if (!buildRes.ok || !isDiagnosticReportData(buildRes.data)) {
        showToast(t('Report generation failed.'), 'danger')
        setBuilding(false)
        return
      }

      const saveRes = await window.systemScope.saveDiagnosticReport({
        report: buildRes.data,
        format,
      })

      if (saveRes.ok) {
        showToast(t('Report saved successfully.'), 'success')
        onClose()
      } else if (saveRes.error.message === 'Save cancelled') {
        showToast(t('Save cancelled.'), 'default')
      } else {
        showToast(t('Report generation failed.'), 'danger')
      }
    } catch {
      showToast(t('Report generation failed.'), 'danger')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
          {t('Export diagnostic report')}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {t('Select the sections to include in the report.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {SECTION_KEYS.map(({ key, labelKey }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggleSection(key)}
              />
              {t(labelKey)}
            </label>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={maskPaths}
              onChange={() => setMaskPaths((v) => !v)}
            />
            {t('Mask sensitive paths')}
          </label>
          <p style={{ margin: '4px 0 0 24px', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {t('Replaces home directory and username in the report.')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('Cancel')}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {building ? t('Building report...') : t('Export as JSON')}
          </button>
          <button
            onClick={() => handleExport('markdown')}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {building ? t('Building report...') : t('Export as Markdown')}
          </button>
        </div>
      </div>
    </div>
  )
}
