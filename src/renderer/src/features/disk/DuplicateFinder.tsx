import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import type { DuplicateGroup } from '@shared/types'

interface DuplicateFinderProps {
  folderPath: string
}

export function DuplicateFinder({ folderPath }: DuplicateFinderProps) {
  const [results, setResults] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const handleScan = async () => {
    setLoading(true)
    const res = await window.systemScope.findDuplicates(folderPath, 100)
    if (res.ok && res.data) {
      setResults(res.data as DuplicateGroup[])
    }
    setLoading(false)
    setScanned(true)
    setExpanded(new Set())
  }

  const toggleExpand = (hash: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(hash)) next.delete(hash)
      else next.add(hash)
      return next
    })
  }

  const totalWaste = results.reduce((acc, r) => acc + r.totalWaste, 0)
  const totalGroups = results.length

  return (
    <Accordion
      title="Duplicate Files"
      badge={scanned && totalGroups > 0 ? `${totalGroups} groups / ${formatBytes(totalWaste)} wasted` : undefined}
      badgeColor="var(--accent-red)"
      forceOpen={scanned && totalGroups > 0}
      actions={
        <button onClick={() => handleScan()} disabled={loading} style={btnStyle}>
          {loading ? 'Scanning...' : scanned ? 'Rescan' : 'Find Duplicates'}
        </button>
      }
    >

      {scanned && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
          중복 파일을 찾지 못했습니다
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' }}>
          {results.map((group) => {
            const isOpen = expanded.has(group.hash)
            return (
              <div key={group.hash}>
                {/* Group header */}
                <div
                  onClick={() => toggleExpand(group.hash)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '6px',
                    cursor: 'pointer', transition: 'background 0.15s',
                    background: isOpen ? 'var(--bg-card-hover)' : 'transparent'
                  }}
                  onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '16px', flexShrink: 0 }}>
                    {isOpen ? '▼' : '▶'}
                  </span>

                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.files[0].name}
                  </span>

                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                    borderRadius: '4px', background: 'var(--alert-red-soft)',
                    color: 'var(--accent-red)', flexShrink: 0
                  }}>
                    {group.files.length} copies
                  </span>

                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', width: '65px', textAlign: 'right', flexShrink: 0 }}>
                    {formatBytes(group.size)}
                  </span>

                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'monospace', width: '80px', textAlign: 'right', flexShrink: 0 }}>
                    -{formatBytes(group.totalWaste)}
                  </span>
                </div>

                {/* Expanded file list */}
                {isOpen && (
                  <div style={{ marginLeft: '26px', marginBottom: '4px' }}>
                    {group.files.map((file, fi) => (
                      <div
                        key={fi}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '5px 10px', fontSize: '12px',
                          borderLeft: '2px solid var(--border)'
                        }}
                      >
                        <span style={{
                          color: 'var(--text-muted)', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {file.path}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(file.path) }}
                          style={{
                            padding: '2px 8px', fontSize: '11px', fontWeight: 600,
                            border: 'none', borderRadius: '5px',
                            background: 'var(--bg-card-hover)', color: 'var(--text-primary)',
                            cursor: 'pointer', flexShrink: 0
                          }}
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
  background: 'var(--accent-red)', color: 'var(--text-on-accent)', cursor: 'pointer'
}
