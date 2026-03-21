import type { LargeFile } from '@shared/types'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'

interface LargeFileListProps {
  files: LargeFile[]
}

export function LargeFileList({ files }: LargeFileListProps) {
  return (
    <Accordion title={`Largest Files (${files.length})`} defaultOpen>
      {files.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>대용량 파일이 없습니다</div>
      ) : (
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size</th>
                <th style={{ ...thStyle, textAlign: 'center', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {f.path}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--accent-yellow)' }}>
                    {formatBytes(f.size)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => window.systemScope.showInFolder(f.path)}
                      title="Open in Finder / Explorer"
                      style={openBtn}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Accordion>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 4px',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const tdStyle: React.CSSProperties = {
  padding: '8px 4px',
  color: 'var(--text-secondary)'
}

const openBtn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '11px',
  fontWeight: 500,
  border: '1px solid var(--border)',
  borderRadius: '5px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer'
}
