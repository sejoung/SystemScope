import { useCallback, useRef, useState, useEffect } from 'react'
import { useDiskStore } from '../stores/useDiskStore'
import { useIpcListener } from '../hooks/useIpc'
import { TreemapChart } from '../features/disk/TreemapChart'
import { FileInsights } from '../features/disk/FileInsights'
import { QuickScan } from '../features/disk/QuickScan'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import { RecentGrowth } from '../features/disk/RecentGrowth'
import { Card } from '../components/Card'
import { Accordion } from '../components/Accordion'
import { formatBytes } from '../utils/format'
import { useToast } from '../components/Toast'
import type { DiskScanResult } from '@shared/types'

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

  // Treemap 컨테이너 폭 측정
  const treemapRef = useRef<HTMLDivElement>(null)
  const [treemapWidth, setTreemapWidth] = useState(600)
  useEffect(() => {
    if (!treemapRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setTreemapWidth(Math.floor(entry.contentRect.width))
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
      }
    },
    [clearScan, setSelectedFolder, setScanning, setScanProgress]
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
        <YourStorage onFolderClick={tryScan} />
        <GrowthView />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <QuickScan onFolderClick={tryScan} />
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
            <Accordion title="Folder Map" defaultOpen>
              <TreemapChart data={scanResult.tree} width={treemapWidth - 40} height={300} />
            </Accordion>
          </div>

          {/* File Insights — Types / Largest / Old Files / Duplicates 통합 */}
          <div style={{ marginBottom: '16px' }}>
            <FileInsights
              extensions={extensions}
              largeFiles={largeFiles}
              folderPath={selectedFolder!}
            />
          </div>

          {/* Recent Growth */}
          <div>
            <RecentGrowth folderPath={selectedFolder!} />
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
