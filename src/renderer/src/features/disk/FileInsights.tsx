import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { formatBytes } from '../../utils/format'
import { useToast } from '../../components/Toast'
import type { DuplicateFileEntry, LargeFile, ExtensionGroup, DuplicateGroup, TrashResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'
import { CopyableValue } from '../../components/CopyableValue'

type Tab = 'types' | 'largest' | 'old' | 'duplicates'

const COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'
]

interface FileInsightsProps {
  extensions: ExtensionGroup[]
  largeFiles: LargeFile[]
  folderPath: string
  defaultTab?: Tab
  title?: string
  hiddenTabs?: Tab[]
  showDelete?: boolean
  onFilesRemoved?: (paths: string[]) => void
  onRefreshRequested?: () => void
}

interface DeleteTarget {
  id: string
  path: string
}

export function FileInsights({ extensions, largeFiles, folderPath, defaultTab = 'types', title, hiddenTabs = [], showDelete = true, onFilesRemoved, onRefreshRequested }: FileInsightsProps) {
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [tab, setTab] = useState<Tab>(defaultTab)
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
    } else if (!res.ok) {
      setOldFiles([])
      setOldFilesError(res.error?.message ?? tk('disk.file_insights.old_scan_failed'))
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
    } else if (!res.ok) {
      setDuplicates([])
      setDupError(res.error?.message ?? tk('disk.file_insights.dup_scan_failed'))
    }
    setDupLoading(false)
    setDupScanned(true)
    setExpandedDup(new Set())
  }

  const totalWaste = duplicates.reduce((acc, r) => acc + r.totalWaste, 0)
  const oldTotalSize = oldFiles.reduce((acc, f) => acc + f.size, 0)

  const handleTrash = async (targets: DeleteTarget[], description: string, onDone?: (trashedPaths: Set<string>) => void) => {
    if (targets.length === 0) {
      showToast(tk('disk.file_insights.delete_info_missing'))
      return
    }

    const res = await window.systemScope.trashDiskItems({
      itemIds: targets.map((target) => target.id),
      description
    })
    if (res.ok && res.data) {
      const result = res.data as TrashResult
      if (result.successCount > 0) {
        showToast(tk('disk.file_insights.trash_success', {
          count: result.successCount,
          size: formatBytes(result.totalSize)
        }) + ' — ' + tk('disk.file_insights.trash_restore_hint'))
        const trashedSet = new Set(result.trashedPaths)
        onFilesRemoved?.(result.trashedPaths)
        onDone?.(trashedSet)
        void window.systemScope.invalidateScanCache(folderPath).finally(() => {
          onRefreshRequested?.()
        })
        if (result.failCount > 0 && result.errors.length > 0) {
          showToast(tk('disk.file_insights.partial', { message: result.errors[0] }))
        }
      } else if (result.successCount === 0 && result.failCount === 0) {
        // 사용자가 Cancel 클릭
      } else {
        showToast(tk('disk.file_insights.delete_failed', { message: result.errors[0] ?? tk('disk.file_insights.unknown_error') }))
      }
    } else if (!res.ok) {
      showToast(res.error?.message ?? tk('disk.file_insights.trash_failed'))
    }
  }

  // Badge summary
  let badge: string | undefined
  if (tab === 'types' && extensions.length > 0) badge = tk('disk.file_insights.types_badge', { count: extensions.length })
  else if (tab === 'largest' && largeFiles.length > 0) badge = tk('disk.file_insights.files', { count: largeFiles.length })
  else if (tab === 'old' && oldFilesScanned) badge = oldFiles.length > 0 ? tk('disk.file_insights.old_badge', { count: oldFiles.length, size: formatBytes(oldTotalSize) }) : tk('disk.file_insights.none')
  else if (tab === 'duplicates' && dupScanned) badge = duplicates.length > 0 ? tk('disk.file_insights.dup_badge', { size: formatBytes(totalWaste) }) : tk('disk.file_insights.none')

  return (
    <Accordion
      title={title ?? tk('disk.file_insights.title')}
      defaultOpen
      badge={badge}
      badgeColor={tab === 'duplicates' && totalWaste > 0 ? 'var(--accent-red)' : tab === 'old' && oldTotalSize > 0 ? 'var(--accent-yellow)' : undefined}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {!hiddenTabs.includes('types') && <TabBtn active={tab === 'types'} onClick={() => setTab('types')}>{tk('disk.file_insights.tab.types')}</TabBtn>}
        {!hiddenTabs.includes('largest') && <TabBtn active={tab === 'largest'} onClick={() => setTab('largest')}>{tk('disk.file_insights.tab.largest')}</TabBtn>}
        {!hiddenTabs.includes('old') && <TabBtn active={tab === 'old'} onClick={() => setTab('old')}>{tk('disk.file_insights.tab.old')}</TabBtn>}
        {!hiddenTabs.includes('duplicates') && <TabBtn active={tab === 'duplicates'} onClick={() => setTab('duplicates')}>{tk('disk.file_insights.tab.duplicates')}</TabBtn>}
      </div>

      {/* Tab content */}
      {tab === 'types' && <TypesTab data={extensions} />}
      {tab === 'largest' && (
        <LargestTab
          files={largeFiles}
          showDelete={showDelete}
          onTrash={(targets) => handleTrash(targets, tk('disk.file_insights.delete_large'))}
        />
      )}
      {tab === 'old' && (
        <OldFilesTab
          files={oldFiles}
          loading={oldFilesLoading}
          scanned={oldFilesScanned}
          error={oldFilesError}
          days={oldDays}
          onDaysChange={setOldDays}
          onScan={handleOldFileScan}
          onTrash={(targets) => handleTrash(targets, tk('disk.file_insights.delete_old'), (trashed) => {
            setOldFiles((prev) => prev.filter((f) => !trashed.has(f.path)))
          })}
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
          onTrash={(targets) => handleTrash(targets, tk('disk.file_insights.delete_duplicates'), (trashed) => {
            setDuplicates((prev) => prev.map((g) => ({
              ...g,
              files: g.files.filter((f) => !trashed.has(f.path)),
              totalWaste: (g.files.filter((f) => !trashed.has(f.path)).length - 1) * g.size
            })).filter((g) => g.files.length >= 2))
          })}
        />
      )}
    </Accordion>
  )
}

// ─── Types Tab ───

function TypesTab({ data }: { data: ExtensionGroup[] }) {
  const top10 = data.slice(0, 10)
  const maxSize = top10[0]?.totalSize ?? 0

  const { tk } = useI18n()
  if (top10.length === 0) return <Empty>{tk('disk.file_insights.no_data')}</Empty>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {top10.map((entry, index) => {
        const widthRatio = maxSize > 0 ? Math.max((entry.totalSize / maxSize) * 100, 4) : 0
        return (
          <div key={`${entry.extension}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ minWidth: '64px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {entry.extension || '(none)'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {tk('disk.file_insights.files', { count: entry.count })}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {formatBytes(entry.totalSize)}
              </span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: 'var(--bg-card-hover)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${widthRatio}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: COLORS[index % COLORS.length]
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Largest Tab ───

function LargestTab({ files, showDelete = true, onTrash }: { files: LargeFile[]; showDelete?: boolean; onTrash: (targets: DeleteTarget[]) => void }) {
  const { tk } = useI18n()
  if (files.length === 0) return <Empty>{tk('disk.file_insights.large_empty')}</Empty>

  return (
    <div style={{ maxHeight: '300px', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle}>{tk('disk.file_insights.name')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{tk('disk.file_insights.size')}</th>
            <th style={{ ...thStyle, width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.path} style={rowStyle}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5, maxWidth: '360px' }}>
                  <CopyableValue value={f.path} fontSize="12px" color="var(--text-muted)" multiline maxWidth="360px" />
                </div>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--accent-yellow)', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(f.size)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button onClick={() => window.systemScope.showInFolder(f.path)} style={openBtn}>{tk('common.open')}</button>
                {showDelete && f.deletionKey && (
                  <button onClick={() => onTrash([{ id: f.deletionKey!, path: f.path }])} style={trashBtn}>{tk('common.delete')}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Old Files Tab ───

function OldFilesTab({ files, loading, scanned, error, days, onDaysChange, onScan, onTrash }: {
  files: LargeFile[]
  loading: boolean
  scanned: boolean
  error: string | null
  days: number
  onDaysChange: (d: number) => void
  onScan: () => void
  onTrash: (targets: DeleteTarget[]) => void
}) {
  const { tk } = useI18n()
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <select value={days} onChange={(e) => onDaysChange(Number(e.target.value))} style={selectStyle}>
          <option value={90}>{tk('disk.file_insights.days_90')}</option>
          <option value={180}>{tk('disk.file_insights.days_180')}</option>
          <option value={365}>{tk('disk.file_insights.days_365')}</option>
          <option value={730}>{tk('disk.file_insights.days_730')}</option>
        </select>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{tk('disk.file_insights.old_filter_hint')}</span>
        <button onClick={onScan} disabled={loading} style={actionBtnStyle}>
          {loading ? tk('common.scanning') : scanned ? tk('common.rescan') : tk('common.scan')}
        </button>
        {scanned && totalSize > 0 && (
          <span style={{ fontSize: '13px', color: 'var(--accent-yellow)', fontWeight: 600, marginLeft: 'auto' }}>
            {tk('disk.file_insights.files_size', { count: files.length, size: formatBytes(totalSize) })}
          </span>
        )}
      </div>

      {!scanned ? (
        <Empty>{tk('disk.file_insights.old_empty_prompt')}</Empty>
      ) : error ? (
        <Empty>{error}</Empty>
      ) : files.length === 0 ? (
        <Empty>{tk('disk.file_insights.old_empty')}</Empty>
      ) : (
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>{tk('disk.file_insights.name')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{tk('disk.file_insights.size')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{tk('disk.file_insights.last_modified')}</th>
                <th style={{ ...thStyle, width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path} style={rowStyle}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5, maxWidth: '360px' }}>
                      <CopyableValue value={f.path} fontSize="12px" color="var(--text-muted)" multiline maxWidth="360px" />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {formatBytes(f.size)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--accent-yellow)', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(f.modified).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => window.systemScope.showInFolder(f.path)} style={openBtn}>{tk('common.open')}</button>
                    {f.deletionKey && <button onClick={() => onTrash([{ id: f.deletionKey!, path: f.path }])} style={trashBtn}>{tk('common.delete')}</button>}
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

function DuplicatesTab({ groups, loading, scanned, error, expanded, onToggle, onScan, totalWaste, onTrash }: {
  groups: DuplicateGroup[]
  loading: boolean
  scanned: boolean
  error: string | null
  expanded: Set<string>
  onToggle: (hash: string) => void
  onScan: () => void
  totalWaste: number
  onTrash: (targets: DeleteTarget[]) => void
}) {
  const { tk } = useI18n()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button onClick={onScan} disabled={loading} style={{ ...actionBtnStyle, background: 'var(--accent-red)', color: 'var(--text-on-accent)' }}>
          {loading ? tk('common.scanning') : scanned ? tk('common.rescan') : tk('disk.file_insights.find_duplicates')}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tk('disk.file_insights.dup_filter_hint')}</span>
        {scanned && groups.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600, marginLeft: 'auto' }}>
            {tk('disk.file_insights.dup_summary', { count: groups.length, size: formatBytes(totalWaste) })}
          </span>
        )}
      </div>

      {!scanned ? (
        <Empty>{tk('disk.file_insights.dup_empty_prompt')}</Empty>
      ) : error ? (
        <Empty>{error}</Empty>
      ) : groups.length === 0 ? (
        <Empty>{tk('disk.file_insights.dup_empty')}</Empty>
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
                    {tk('disk.file_insights.copies', { count: group.files.length })}
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
                      <div key={file.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', fontSize: '12px', borderLeft: '2px solid var(--border)' }}>
                        {fi === 0 && (
                          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'var(--success-soft)', color: 'var(--accent-green)', fontWeight: 600, flexShrink: 0 }}>
                            {tk('disk.file_insights.keep')}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.path}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); window.systemScope.showInFolder(file.path) }} style={openBtn}>{tk('common.open')}</button>
                        {fi > 0 && file.deletionKey && (
                          <button onClick={(e) => { e.stopPropagation(); onTrash([toDeleteTarget(file)!]) }} style={trashBtn}>{tk('common.delete')}</button>
                        )}
                      </div>
                    ))}
                    {group.files.length > 2 && (
                      <div style={{ padding: '6px 10px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onTrash(group.files.slice(1).map(toDeleteTarget).filter((target): target is DeleteTarget => target !== null))
                          }}
                          style={{ ...trashBtn, padding: '4px 12px' }}
                        >
                          {tk('disk.file_insights.delete_all_keep_first')}
                        </button>
                      </div>
                    )}
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

function toDeleteTarget(file: LargeFile | DuplicateFileEntry): DeleteTarget | null {
  return file.deletionKey ? { id: file.deletionKey, path: file.path } : null
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
  return <div style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, padding: '12px 0' }}>{children}</div>
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }
const tdStyle: React.CSSProperties = { padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.4, verticalAlign: 'top' }
const openBtn: React.CSSProperties = { padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '5px', background: 'var(--bg-card-hover)', color: 'var(--text-primary)', cursor: 'pointer', marginRight: '4px' }
const trashBtn: React.CSSProperties = { padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '5px', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)', cursor: 'pointer' }
const actionBtnStyle: React.CSSProperties = { padding: '7px 14px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px', background: 'var(--accent-yellow)', color: 'var(--text-on-accent-strong)', cursor: 'pointer' }
const selectStyle: React.CSSProperties = { padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }
const rowStyle: React.CSSProperties = { borderBottom: '1px solid var(--border)' }
