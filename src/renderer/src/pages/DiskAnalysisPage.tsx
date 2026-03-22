import { lazy, Suspense, useCallback, useRef, useState, useEffect } from 'react'
import { useDiskStore } from '../stores/useDiskStore'
import { useIpcListener } from '../hooks/useIpc'
import { Card } from '../components/Card'
import { Accordion } from '../components/Accordion'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { formatBytes } from '../utils/format'
import { useToast } from '../components/Toast'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import type { DiskScanResult } from '@shared/types'

const TreemapChart = lazy(async () => import('../features/disk/TreemapChart').then((mod) => ({ default: mod.TreemapChart })))
const FileInsights = lazy(async () => import('../features/disk/FileInsights').then((mod) => ({ default: mod.FileInsights })))
const QuickScan = lazy(async () => import('../features/disk/QuickScan').then((mod) => ({ default: mod.QuickScan })))
const RecentGrowth = lazy(async () => import('../features/disk/RecentGrowth').then((mod) => ({ default: mod.RecentGrowth })))

export function DiskAnalysisPage() {
  const {
    scanResult,
    largeFiles,
    extensions,
    isScanning,
    scanJobId,
    scanProgress,
    selectedFolder,
    setScanResult,
    setLargeFiles,
    setExtensions,
    setScanning,
    setScanProgress,
    setSelectedFolder,
    clearScan
  } = useDiskStore()

  const showToast = useToast((s) => s.show)
  const sectionResetKey = `${selectedFolder ?? 'none'}:${scanResult?.rootPath ?? 'none'}:${scanResult?.scanDuration ?? 0}:${isScanning ? 'scan' : 'idle'}`

  // Treemap 컨테이너 폭 측정
  const treemapRef = useRef<HTMLDivElement>(null)
  const [treemapWidth, setTreemapWidth] = useState(600)
  const safeTreemapWidth = Math.max(treemapWidth - 40, 320)
  useEffect(() => {
    if (!treemapRef.current) return
    if (typeof ResizeObserver === 'undefined') {
      setTreemapWidth(Math.max(treemapRef.current.clientWidth, 600))
      return
    }

    setTreemapWidth(Math.max(treemapRef.current.clientWidth, 600))
    const observer = new ResizeObserver(([entry]) => {
      setTreemapWidth(Math.max(Math.floor(entry.contentRect.width), 320))
    })
    observer.observe(treemapRef.current)
    return () => observer.disconnect()
  }, [scanResult])

  const startScan = useCallback(
    async (folderPath: string) => {
      clearScan()
      setSelectedFolder(folderPath)
      setScanning(true)
      const res = await window.systemScope.scanFolder(folderPath)
      if (res.ok && res.data) {
        setScanning(true, (res.data as { jobId: string }).jobId)
      } else {
        setScanning(false)
        setScanProgress(res.error?.message ?? '스캔 실패')
        showToast(res.error?.message ?? '폴더 스캔을 시작하지 못했습니다.')
      }
    },
    [clearScan, setSelectedFolder, setScanning, setScanProgress, showToast]
  )

  const tryScan = useCallback(
    (folderPath: string) => {
      if (isScanning) {
        showToast('스캔이 진행 중입니다. 완료 후 다시 시도해주세요.')
        return
      }
      startScan(folderPath)
    },
    [isScanning, startScan, showToast]
  )

  const handleCancelScan = useCallback(() => {
    if (scanJobId) {
      window.systemScope.cancelJob(scanJobId)
      setScanning(false)
    }
  }, [scanJobId, setScanning])

  const handleSelectFolder = useCallback(async () => {
    if (isScanning) {
      showToast('스캔이 진행 중입니다. 완료 후 다시 시도해주세요.')
      return
    }
    const res = await window.systemScope.selectFolder()
    if (res.ok && res.data) {
      startScan(res.data as string)
    }
  }, [isScanning, startScan, showToast])

  const handleJobProgress = useCallback(
    (data: unknown) => {
      const d = data as { id: string; currentStep: string }
      if (d.id === scanJobId) setScanProgress(d.currentStep)
    },
    [scanJobId, setScanProgress]
  )
  useIpcListener(window.systemScope.onJobProgress, handleJobProgress)

  const handleJobCompleted = useCallback(
    (data: unknown) => {
      const d = data as { id: string; data: DiskScanResult }
      if (d.id === scanJobId) {
        setScanResult(d.data)
        if (selectedFolder) {
          window.systemScope.getLargeFiles(selectedFolder, 50).then((res) => {
            if (res.ok && res.data) setLargeFiles(res.data)
          })
          window.systemScope.getExtensionBreakdown(selectedFolder).then((res) => {
            if (res.ok && res.data) setExtensions(res.data)
          })
        }
      }
    },
    [scanJobId, selectedFolder, setScanResult, setLargeFiles, setExtensions]
  )
  useIpcListener(window.systemScope.onJobCompleted, handleJobCompleted)

  const handleJobFailed = useCallback(
    (data: unknown) => {
      const d = data as { id: string; error: string }
      if (d.id === scanJobId) {
        setScanning(false)
        setScanProgress(d.error)
      }
    },
    [scanJobId, setScanning, setScanProgress]
  )
  useIpcListener(window.systemScope.onJobFailed, handleJobFailed)

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Storage</h2>

      {/* Scan status bar */}
      <div style={{ marginBottom: '16px' }}>
        <Card>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleSelectFolder} disabled={isScanning} style={btnStyle}>
              Browse Folder
            </button>
            {selectedFolder && (
              <>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFolder}
                </span>
                <button
                  onClick={() => window.systemScope.showInFolder(selectedFolder)}
                  style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  Open
                </button>
              </>
            )}
            {isScanning && (
              <button onClick={handleCancelScan} style={{ ...btnStyle, background: 'var(--accent-red)' }}>
                Cancel
              </button>
            )}
          </div>
          {isScanning && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '14px', height: '14px',
                  border: '2px solid var(--accent-blue)',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {scanProgress || '스캔 준비 중...'}
                </span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {!isScanning && !selectedFolder && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              폴더를 선택하면 용량 분포, 대용량 파일, 중복 파일을 바로 분석합니다.
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <ErrorBoundary title="Home Storage" resetKey={sectionResetKey}>
          <YourStorage onFolderClick={tryScan} />
        </ErrorBoundary>
        <ErrorBoundary title="Storage Growth" resetKey={sectionResetKey}>
          <GrowthView />
        </ErrorBoundary>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <ErrorBoundary title="Quick Cleanup" resetKey={sectionResetKey}>
          <Suspense fallback={<SectionFallback title="Quick Cleanup" />}>
            <QuickScan onFolderClick={tryScan} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Scan results */}
      {scanResult && (
        <>
          <div style={{
            display: 'flex', gap: '12px', flexWrap: 'wrap' as const, marginBottom: '16px', fontSize: '13px',
            padding: '10px 16px', background: 'var(--bg-card)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)'
          }}>
            <Stat label="Total" value={formatBytes(scanResult.totalSize)} />
            <Stat label="Files" value={scanResult.fileCount.toLocaleString()} />
            <Stat label="Folders" value={scanResult.folderCount.toLocaleString()} />
            <Stat label="Duration" value={`${(scanResult.scanDuration / 1000).toFixed(1)}s`} />
          </div>

          <div ref={treemapRef} style={{ marginBottom: '16px' }}>
            <ErrorBoundary title="Folder Map" resetKey={sectionResetKey}>
              <Suspense fallback={<SectionFallback title="Folder Map" />}>
                <Accordion title="Folder Map" defaultOpen>
                  <TreemapChart data={scanResult.tree} width={safeTreemapWidth} height={300} />
                </Accordion>
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* File Insights — Types / Largest / Old Files / Duplicates 통합 */}
          <div style={{ marginBottom: '16px' }}>
            <ErrorBoundary title="File Insights" resetKey={sectionResetKey}>
              <Suspense fallback={<SectionFallback title="File Insights" />}>
                <FileInsights
                  extensions={extensions}
                  largeFiles={largeFiles}
                  folderPath={selectedFolder!}
                />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Recent Growth */}
          <div>
            <ErrorBoundary title="Recent Growth" resetKey={sectionResetKey}>
              <Suspense fallback={<SectionFallback title="Recent Growth" />}>
                <RecentGrowth folderPath={selectedFolder!} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
    </span>
  )
}

function SectionFallback({ title }: { title: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px'
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        로딩 중...
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}
