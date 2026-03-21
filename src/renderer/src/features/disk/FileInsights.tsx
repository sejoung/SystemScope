import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { LargeFile, ExtensionGroup, DuplicateGroup } from '@shared/types'

type Tab = 'types' | 'largest' | 'old' | 'duplicates'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface FileInsightsProps {
  extensions: ExtensionGroup[]
  largeFiles: LargeFile[]
  folderPath: string
}

export function FileInsights({ extensions, largeFiles, folderPath }: FileInsightsProps) {
  const [tab, setTab] = useState<Tab>('types')
  const [oldFiles, setOldFiles] = useState<LargeFile[]>([])
  const [oldFilesLoading, setOldFilesLoading] = useState(false)
  const [oldFilesScanned, setOldFilesScanned] = useState(false)
  const [oldFilesError, setOldFilesError] = useState<string | null>(null)
  const [oldDays, setOldDays] = useState(365)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [dupLoading, setDupLoading] = useState(false)
  const [dupScanned, setDupScanned] = useState(false)
  const [dupError, setDupError] = useState<string | null>(null)
  const [expandedDup, setExpandedDup] = useState<Set<string>>(new Set())

  const handleOldFileScan = async () => {
    setOldFilesLoading(true)
    setOldFilesError(null)
    const res = await window.systemScope.findOldFiles(folderPath, oldDays)
    if (res.ok && res.data) {
      setOldFiles(res.data as LargeFile[])
    } else {
      setOldFiles([])
      setOldFilesError(res.error?.message ?? '오래된 파일 탐색에 실패했습니다.')
    }
    setOldFilesLoading(false)
    setOldFilesScanned(true)
  }

  const handleDupScan = async () => {
    setDupLoading(true)
    setDupError(null)
    const res = await window.systemScope.findDuplicates(folderPath, 100)
    if (res.ok && res.data) {
      setDuplicates(res.data as DuplicateGroup[])
    } else {
      setDuplicates([])
      setDupError(res.error?.message ?? '중복 파일 탐색에 실패했습니다.')
    }
    setDupLoading(false)
    setDupScanned(true)
    setExpandedDup(new Set())
  }

  const totalWaste = duplicates.reduce((acc, r) => acc + r.totalWaste, 0)
  const oldTotalSize = oldFiles.reduce((acc, f) => acc + f.size, 0)

  // Badge summary
  let badge: string | undefined
  if (tab === 'types' && extensions.length > 0) badge = `${extensions.length} types`
  else if (tab === 'largest' && largeFiles.length > 0) badge = `${largeFiles.length} files`
  else if (tab === 'old' && oldFilesScanned) badge = oldFiles.length > 0 ? `${oldFiles.length} old / ${formatBytes(oldTotalSize)}` : 'none'
  else if (tab === 'duplicates' && dupScanned) badge = duplicates.length > 0 ? `${formatBytes(totalWaste)} wasted` : 'none'

  return (
    <Accordion
      title="File Insights"
      defaultOpen
      badge={badge}
      badgeColor={tab === 'duplicates' && totalWaste > 0 ? 'var(--accent-red)' : tab === 'old' && oldTotalSize > 0 ? 'var(--accent-yellow)' : undefined}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
        <TabBtn active={tab === 'types'} onClick={() => setTab('types')}>File Types</TabBtn>
        <TabBtn active={tab === 'largest'} onClick={() => setTab('largest')}>Largest</TabBtn>
        <TabBtn active={tab === 'old'} onClick={() => setTab('old')}>Old Files</TabBtn>
        <TabBtn active={tab === 'duplicates'} onClick={() => setTab('duplicates')}>Duplicates</TabBtn>
      </div>

      {/* Tab content */}
      {tab === 'types' && <TypesTab data={extensions} />}
      {tab === 'largest' && <LargestTab files={largeFiles} />}
      {tab === 'old' && (
        <OldFilesTab
          files={oldFiles}
          loading={oldFilesLoading}
          scanned={oldFilesScanned}
          error={oldFilesError}
          days={oldDays}
          onDaysChange={setOldDays}
          onScan={handleOldFileScan}
        />
      )}
      {tab === 'duplicates' && (
        <DuplicatesTab
          groups={duplicates}
          loading={dupLoading}
          scanned={dupScanned}
          error={dupError}
          expanded={expandedDup}
          onToggle={(hash) => {
            setExpandedDup((prev) => {
              const next = new Set(prev)
              if (next.has(hash)) next.delete(hash); else next.add(hash)
              return next
            })
          }}
          onScan={handleDupScan}
          totalWaste={totalWaste}
        />
      )}
    </Accordion>
  )
}

// ─── Types Tab ───

function TypesTab({ data }: { data: ExtensionGroup[] }) {
  const top10 = data.slice(0, 10).map((d) => ({ ...d, sizeGB: d.totalSize / (1024 * 1024 * 1024) }))

  if (top10.length === 0) return <Empty>데이터가 없습니다</Empty>

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={top10} layout="vertical" margin={{ left: 60 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => formatBytes(v * 1024 * 1024 * 1024)} />
        <YAxis type="category" dataKey="extension" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={55} />
        <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => formatBytes(val * 1024 * 1024 * 1024)} />
        <Bar dataKey="sizeGB" radius={[0, 4, 4, 0]}>
          {top10.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Largest Tab ───

function LargestTab({ files }: { files: LargeFile[] }) {
  if (files.length === 0) return <Empty>대용량 파일이 없습니다</Empty>

  return (
    <div style={{ maxHeight: '300px', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>Name</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Size</th>
            <th style={{ ...thStyle, width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{f.path}</div>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--accent-yellow)' }}>
                {formatBytes(f.size)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button onClick={() => window.systemScope.showInFolder(f.path)} style={openBtn}>Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Old Files Tab ───

function OldFilesTab({ files, loading, scanned, days, onDaysChange, onScan }: {
  files: LargeFile[]
  loading: boolean
  scanned: boolean
  error: string | null
  days: number
  onDaysChange: (d: number) => void
  onScan: () => void
}) {
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <select value={days} onChange={(e) => onDaysChange(Number(e.target.value))} style={selectStyle}>
          <option value={90}>90일</option>
          <option value={180}>180일</option>
          <option value={365}>1년</option>
          <option value={730}>2년</option>
        </select>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>이상 미사용 / 1MB 이상</span>
        <button onClick={onScan} disabled={loading} style={actionBtnStyle}>
          {loading ? 'Scanning...' : scanned ? 'Rescan' : 'Scan'}
        </button>
        {scanned && totalSize > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--accent-yellow)', fontWeight: 600, marginLeft: 'auto' }}>
            {files.length} files / {formatBytes(totalSize)}
          </span>
        )}
      </div>

      {!scanned ? (
        <Empty>오래된 파일을 찾으려면 Scan 버튼을 클릭하세요</Empty>
      ) : error ? (
        <Empty>{error}</Empty>
      ) : files.length === 0 ? (
        <Empty>해당 기간 내 오래된 파일이 없습니다</Empty>
      ) : (
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Last Modified</th>
                <th style={{ ...thStyle, width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{f.path}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {formatBytes(f.size)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--accent-yellow)' }}>
                    {new Date(f.modified).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button onClick={() => window.systemScope.showInFolder(f.path)} style={openBtn}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Duplicates Tab ───

function DuplicatesTab({ groups, loading, scanned, expanded, onToggle, onScan, totalWaste }: {
  groups: DuplicateGroup[]
  loading: boolean
  scanned: boolean
  error: string | null
  expanded: Set<string>
  onToggle: (hash: string) => void
  onScan: () => void
  totalWaste: number
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button onClick={onScan} disabled={loading} style={{ ...actionBtnStyle, background: 'var(--accent-red)', color: 'var(--text-on-accent)' }}>
          {loading ? 'Scanning...' : scanned ? 'Rescan' : 'Find Duplicates'}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100KB 이상</span>
        {scanned && groups.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600, marginLeft: 'auto' }}>
            {groups.length} groups / {formatBytes(totalWaste)} wasted
          </span>
        )}
      </div>

      {!scanned ? (
        <Empty>중복 파일을 찾으려면 Find Duplicates 버튼을 클릭하세요</Empty>
      ) : error ? (
        <Empty>{error}</Empty>
      ) : groups.length === 0 ? (
        <Empty>중복 파일을 찾지 못했습니다</Empty>
      ) : (
        <div style={{ maxHeight: '350px', overflow: 'auto' }}>
          {groups.map((group) => {
            const isOpen = expanded.has(group.hash)
            return (
              <div key={group.hash}>
                <div
                  onClick={() => onToggle(group.hash)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 8px', borderRadius: '6px', cursor: 'pointer',
                    background: isOpen ? 'var(--bg-card-hover)' : 'transparent'
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '16px' }}>
                    {isOpen ? '▼' : '▶'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.files[0].name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--alert-red-soft)', color: 'var(--accent-red)' }}>
                    {group.files.length} copies
                  </span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)', width: '65px', textAlign: 'right' }}>
                    {formatBytes(group.size)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent-red)', width: '80px', textAlign: 'right' }}>
                    -{formatBytes(group.totalWaste)}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ marginLeft: '26px', marginBottom: '4px' }}>
                    {group.files.map((file, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', fontSize: '12px', borderLeft: '2px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.path}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(file.path) }} style={openBtn}>Open</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Shared ───

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', fontSize: '12px', fontWeight: active ? 600 : 400,
      border: 'none', borderRadius: '6px',
      background: active ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
      color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
      cursor: 'pointer'
    }}>
      {children}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>{children}</div>
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const tdStyle: React.CSSProperties = { padding: '6px 4px', color: 'var(--text-secondary)' }
const openBtn: React.CSSProperties = { padding: '3px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '5px', background: 'var(--bg-card-hover)', color: 'var(--text-primary)', cursor: 'pointer' }
const actionBtnStyle: React.CSSProperties = { padding: '5px 14px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', background: 'var(--accent-yellow)', color: 'var(--text-on-accent-strong)', cursor: 'pointer' }
const selectStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }
const tooltipStyle: React.CSSProperties = { backgroundColor: 'var(--chart-tooltip-bg)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--chart-tooltip-shadow)', color: 'var(--text-primary)', fontSize: '12px' }
