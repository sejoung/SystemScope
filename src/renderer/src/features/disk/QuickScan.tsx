import { useState, useMemo } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'

type ScanCategory = 'system' | 'homebrew' | 'devtools' | 'packages' | 'containers' | 'browsers'

interface QuickScanFolder {
  name: string
  path: string
  description: string
  size: number
  exists: boolean
  cleanable: boolean
  category: ScanCategory
}

const CATEGORY_LABELS: Record<ScanCategory, string> = {
  system: 'System',
  homebrew: 'Homebrew',
  devtools: 'Dev Tools',
  packages: 'Package Managers',
  containers: 'Containers',
  browsers: 'Browsers'
}

const CATEGORY_ORDER: ScanCategory[] = ['system', 'homebrew', 'devtools', 'packages', 'containers', 'browsers']

function sizeColor(size: number): string {
  if (size > 5 * 1024 * 1024 * 1024) return 'var(--accent-red)'
  if (size > 1 * 1024 * 1024 * 1024) return 'var(--accent-yellow)'
  if (size > 100 * 1024 * 1024) return 'var(--accent-blue)'
  return 'var(--text-secondary)'
}

interface QuickScanProps {
  onFolderClick: (path: string) => void
}

export function QuickScan({ onFolderClick }: QuickScanProps) {
  const [results, setResults] = useState<QuickScanFolder[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)

  const handleScan = async () => {
    setScanning(true)
    const res = await window.systemScope.quickScan()
    if (res.ok && res.data) {
      setResults(res.data as QuickScanFolder[])
    }
    setScanning(false)
    setScanned(true)
  }

  const totalSize = results.reduce((acc, r) => acc + r.size, 0)
  const cleanableSize = results.filter((r) => r.cleanable).reduce((acc, r) => acc + r.size, 0)

  // Group by category, preserve order, only categories that have results
  const grouped = useMemo(() => {
    return CATEGORY_ORDER
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        items: results.filter((r) => r.category === cat).sort((a, b) => b.size - a.size),
        total: results.filter((r) => r.category === cat).reduce((acc, r) => acc + r.size, 0)
      }))
      .filter((g) => g.items.length > 0)
  }, [results])

  return (
    <Accordion
      title="Quick Scan — common folders"
      badge={scanned ? formatBytes(cleanableSize) + ' cleanable' : undefined}
      badgeColor="var(--accent-green)"
      forceOpen={scanned}
      actions={
        <button
          onClick={() => { handleScan() }}
          disabled={scanning}
          style={btnStyle}
        >
          {scanning ? 'Scanning...' : scanned ? 'Rescan' : 'Quick Scan'}
        </button>
      }
    >
      {!scanned ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
          캐시, 로그, 다운로드 등 주요 폴더의 용량을 빠르게 확인합니다
        </div>
      ) : (
        <div>
          {/* Summary */}
          <div style={{
            display: 'flex', gap: '20px', marginBottom: '16px',
            padding: '10px 14px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius)',
            fontSize: '13px'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(totalSize)}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Cleanable: <strong style={{ color: 'var(--accent-green)' }}>{formatBytes(cleanableSize)}</strong>
            </span>
          </div>

          {/* Folder list grouped by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {grouped.map((group) => (
              <div key={group.category}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '6px', padding: '0 4px'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {formatBytes(group.total)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.items.map((folder) => (
              <div
                key={folder.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-primary)',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                {/* Size */}
                <div style={{ width: '60px', textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: sizeColor(folder.size)
                  }}>
                    {formatBytes(folder.size)}
                  </span>
                </div>

                {/* Bar visual */}
                <div style={{ width: '80px', flexShrink: 0 }}>
                  <div style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'var(--border)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((folder.size / (totalSize || 1)) * 100, 100)}%`,
                      background: sizeColor(folder.size),
                      borderRadius: '3px',
                      minWidth: folder.size > 0 ? '2px' : '0'
                    }} />
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {folder.name}
                    </span>
                    {folder.cleanable && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(34,197,94,0.15)',
                        color: 'var(--accent-green)',
                        fontWeight: 600
                      }}>
                        CLEANABLE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {folder.description}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(folder.path) }}
                    title="Open in Finder / Explorer"
                    style={actionBtn}
                  >
                    Open
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFolderClick(folder.path) }}
                    title="Scan this folder"
                    style={{ ...actionBtn, background: 'var(--accent-blue)', color: 'white' }}
                  >
                    Scan
                  </button>
                </div>
              </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Accordion>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: '13px',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--accent-cyan)',
  color: 'white',
  cursor: 'pointer'
}

const btnSmall: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-card-hover)',
  color: 'var(--text-primary)',
  cursor: 'pointer'
}

const actionBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--bg-card-hover)',
  color: 'var(--text-primary)',
  cursor: 'pointer'
}
