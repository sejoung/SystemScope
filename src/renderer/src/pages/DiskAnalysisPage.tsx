import { useCallback } from 'react'
import { useDiskStore } from '../stores/useDiskStore'
import { useIpcListener } from '../hooks/useIpc'
import { TreemapChart } from '../features/disk/TreemapChart'
import { LargeFileList } from '../features/disk/LargeFileList'
import { ExtensionBreakdown } from '../features/disk/ExtensionBreakdown'
import { QuickScan } from '../features/disk/QuickScan'
import { YourStorage } from '../features/disk/YourStorage'
import { GrowthView } from '../features/disk/GrowthView'
import { RecentGrowth } from '../features/disk/RecentGrowth'
import { DuplicateFinder } from '../features/disk/DuplicateFinder'
import { Card } from '../components/Card'
import { Accordion } from '../components/Accordion'
import { formatBytes } from '../utils/format'
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

  // --- scan helpers ---
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

  const handleCancelScan = useCallback(() => {
    if (scanJobId) {
      window.systemScope.cancelJob(scanJobId)
      setScanning(false)
    }
  }, [scanJobId, setScanning])

  // --- manual folder select ---
  const handleSelectFolder = useCallback(async () => {
    const res = await window.systemScope.selectFolder()
    if (res.ok && res.data) {
      startScan(res.data as string)
    }
  }, [startScan])

  // --- job event listeners ---
  const handleJobProgress = useCallback(
    (data: unknown) => {
      const d = data as { id: string; currentStep: string }
      if (d.id === scanJobId) {
        setScanProgress(d.currentStep)
      }
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
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Disk Analysis</h2>

      {/* Your Storage — home directory breakdown + disk capacity */}
      <div style={{ marginBottom: '16px' }}>
        <YourStorage onFolderClick={(folderPath) => {
          if (!isScanning) startScan(folderPath)
        }} />
      </div>

      {/* Growth View — 추세 분석 */}
      <div style={{ marginBottom: '16px' }}>
        <GrowthView />
      </div>

      {/* Quick Scan — cleanable folders */}
      <div style={{ marginBottom: '16px' }}>
        <QuickScan onFolderClick={(folderPath) => {
          if (!isScanning) startScan(folderPath)
        }} />
      </div>

      {/* Scan status bar */}
      <Card style={{ marginBottom: '16px' }}>
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
            위 폴더를 클릭하거나 Browse Folder로 스캔할 폴더를 선택하세요
          </div>
        )}
      </Card>

      {/* Scan results */}
      {scanResult && (
        <>
          <div style={{
            display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px',
            padding: '10px 16px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}>
            <Stat label="Total" value={formatBytes(scanResult.totalSize)} />
            <Stat label="Files" value={scanResult.fileCount.toLocaleString()} />
            <Stat label="Folders" value={scanResult.folderCount.toLocaleString()} />
            <Stat label="Duration" value={`${(scanResult.scanDuration / 1000).toFixed(1)}s`} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Accordion title="Folder Treemap" defaultOpen>
              <TreemapChart data={scanResult.tree} width={800} height={300} />
            </Accordion>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <LargeFileList files={largeFiles} />
            <ExtensionBreakdown data={extensions} />
          </div>

          {/* Insights: Recent Growth + Duplicates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <RecentGrowth folderPath={selectedFolder!} />
            <DuplicateFinder folderPath={selectedFolder!} />
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
  color: 'white',
  cursor: 'pointer'
}
