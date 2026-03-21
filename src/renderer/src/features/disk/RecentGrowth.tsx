import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import type { RecentGrowthEntry } from '@shared/types'

interface RecentGrowthProps {
  folderPath: string
}

export function RecentGrowth({ folderPath }: RecentGrowthProps) {
  const [results, setResults] = useState<RecentGrowthEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [days, setDays] = useState(7)

  const handleScan = async () => {
    setLoading(true)
    const res = await window.systemScope.findRecentGrowth(folderPath, days)
    if (res.ok && res.data) {
      setResults(res.data as RecentGrowthEntry[])
    }
    setLoading(false)
    setScanned(true)
  }

  const totalRecent = results.reduce((acc, r) => acc + r.recentSize, 0)

  return (
    <Accordion
      title="Recent Growth"
      badge={scanned && totalRecent > 0 ? `+${formatBytes(totalRecent)} in ${days}d` : undefined}
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
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={() => handleScan()} disabled={loading} style={btnStyle}>
            {loading ? 'Scanning...' : scanned ? 'Rescan' : 'Scan'}
          </button>
        </>
      }
    >

      {scanned && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
          최근 {days}일 내 급격히 커진 폴더가 없습니다
        </div>
      )}

      {results.length > 0 && (
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
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', width: '160px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  {entry.recentFiles} files
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
