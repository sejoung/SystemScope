import { useState } from 'react'
import { Accordion } from '../../components/ui/Accordion'
import { formatBytes } from '../../utils/format'
import { useToast } from '../../components/ui/Toast'
import type { LargeFile, ExtensionGroup, DuplicateGroup, TrashResult } from '@shared/types'
import { useI18n } from '../../i18n/useI18n'
import { DuplicatesTab, LargestTab, OldFilesTab, TabBtn, TypesTab, type DeleteTarget } from './FileInsightTabs'

type Tab = 'types' | 'largest' | 'old' | 'duplicates'

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
