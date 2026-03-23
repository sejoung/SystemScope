import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import type { RecentGrowthEntry } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'

interface RecentGrowthProps {
  folderPath: string
}

export function RecentGrowth({ folderPath }: RecentGrowthProps) {
  const { tk } = useI18n()
  const [results, setResults] = useState<RecentGrowthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [days, setDays] = useState(7)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    setLoading(true)
    setError(null)
    const res = await window.systemScope.findRecentGrowth(folderPath, days)
    if (res.ok && res.data) {
      setResults(res.data as RecentGrowthEntry[])
    } else {
      setResults([])
      setError(res.error?.message ?? tk('disk.recent_growth.scan_failed'))
    }
    setLoading(false)
    setScanned(true)
  }

  const totalRecent = results.reduce((acc, r) => acc + r.recentSize, 0)

  return (
    <Accordion
      title={tk('disk.section.recent_growth')}
      badge={scanned && totalRecent > 0 ? tk('disk.recent_growth.badge', { size: formatBytes(totalRecent), days }) : undefined}
      badgeColor="var(--accent-yellow)"
      forceOpen={scanned && results.length > 0}
      actions={
        <>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            style={selectStyle}
          >
            <option value={1}>{tk('disk.recent_growth.day_1')}</option>
            <option value={3}>{tk('disk.recent_growth.day_3')}</option>
            <option value={7}>{tk('disk.recent_growth.day_7')}</option>
            <option value={14}>{tk('disk.recent_growth.day_14')}</option>
            <option value={30}>{tk('disk.recent_growth.day_30')}</option>
          </select>
          <button onClick={() => handleScan()} disabled={loading} style={btnStyle}>
            {loading ? tk('common.scanning') : scanned ? tk('common.rescan') : tk('common.scan')}
          </button>
        </>
      }
    >

      {scanned && error && (
        <div style={{ color: 'var(--accent-red)', fontSize: '13px', padding: '12px 0' }}>
          {error}
        </div>
      )}

      {scanned && !error && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
          {tk('disk.recent_growth.empty', { days })}
        </div>
      )}

      {!error && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflow: 'auto' }}>
          {results.map((entry) => {
            const pct = totalRecent > 0 ? (entry.recentSize / totalRecent) * 100 : 0
            return (
              <div
                key={entry.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '6px',
                  cursor: 'pointer', transition: 'background 0.15s'
                }}
                onClick={() => window.systemScope.showInFolder(entry.path)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '60px', maxWidth: '140px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>

                <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    backgroundColor: 'var(--accent-yellow)',
                    borderRadius: '3px', minWidth: '2px',
                    transition: 'width 0.5s'
                  }} />
                </div>

                <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent-yellow)', width: '70px', textAlign: 'right', flexShrink: 0 }}>
                  +{formatBytes(entry.recentSize)}
                </span>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '50px', textAlign: 'right', flexShrink: 0 }}>
                  {tk('disk.recent_growth.files', { count: entry.recentFiles })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Accordion>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '5px 14px', fontSize: '12px', fontWeight: 600,
  border: 'none', borderRadius: '6px',
  background: 'var(--accent-yellow)', color: 'var(--text-on-accent-strong)', cursor: 'pointer'
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: '12px',
  border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  outline: 'none', cursor: 'pointer'
}
