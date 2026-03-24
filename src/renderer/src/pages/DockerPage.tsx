import { useState, useEffect, useCallback } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DockerOverview } from '../features/docker/DockerOverview'
import { DockerContainers } from '../features/docker/DockerContainers'
import { DockerVolumes } from '../features/docker/DockerVolumes'
import { DockerBuildCache } from '../features/docker/DockerBuildCache'
import { DockerImages } from '../features/disk/DockerImages'
import { useI18n } from '../i18n/useI18n'
import type { DockerContainersScanResult } from '@shared/types'

type DockerTab = 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache'
type DockerAvailability = 'checking' | 'ready' | 'not_installed' | 'daemon_unavailable'

export function DockerPage() {
  const [tab, setTab] = useState<DockerTab>('overview')
  const [refreshToken, setRefreshToken] = useState(0)
  const [availability, setAvailability] = useState<DockerAvailability>('checking')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const { tk } = useI18n()

  const handleChanged = () => setRefreshToken((prev) => prev + 1)

  const checkDocker = useCallback(async () => {
    setAvailability('checking')
    const res = await window.systemScope.listDockerContainers()
    if (!res.ok || !res.data) {
      setAvailability('daemon_unavailable')
      setStatusMessage(res.error?.message ?? null)
      return
    }
    const data = res.data as DockerContainersScanResult
    if (data.status !== 'ready') {
      setAvailability(data.status)
      setStatusMessage(data.message)
      return
    }
    setAvailability('ready')
    setStatusMessage(null)
  }, [])

  useEffect(() => { void checkDocker() }, [checkDocker])

  const dockerUnavailable = availability === 'not_installed' || availability === 'daemon_unavailable'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{tk('docker.page.title')}</h2>
        {!dockerUnavailable && (
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
            <PageTab active={tab === 'overview'} onClick={() => setTab('overview')}>{tk('docker.tab.overview')}</PageTab>
            <PageTab active={tab === 'containers'} onClick={() => setTab('containers')}>{tk('docker.tab.containers')}</PageTab>
            <PageTab active={tab === 'images'} onClick={() => setTab('images')}>{tk('docker.tab.images')}</PageTab>
            <PageTab active={tab === 'volumes'} onClick={() => setTab('volumes')}>{tk('docker.tab.volumes')}</PageTab>
            <PageTab active={tab === 'build-cache'} onClick={() => setTab('build-cache')}>{tk('docker.tab.build_cache')}</PageTab>
          </div>
        )}
      </div>

      {availability === 'checking' && (
        <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          {tk('docker.common.check_status')}
        </div>
      )}

      {dockerUnavailable && (
        <div style={{ padding: '40px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {availability === 'not_installed' ? tk('main.docker.status.not_installed') : tk('main.docker.status.daemon_unavailable')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {statusMessage ?? tk('docker.common.check_status')}
          </div>
          <button onClick={() => void checkDocker()} style={retryBtnStyle}>
            {tk('docker.page.retry')}
          </button>
        </div>
      )}

      {availability === 'ready' && (
        <>
          {tab === 'overview' && (
            <ErrorBoundary title={tk('docker.section.overview')}>
              <DockerOverview
                refreshToken={refreshToken}
                onOpenContainers={() => setTab('containers')}
                onOpenImages={() => setTab('images')}
                onOpenVolumes={() => setTab('volumes')}
                onOpenBuildCache={() => setTab('build-cache')}
              />
            </ErrorBoundary>
          )}

          {tab === 'containers' && (
            <ErrorBoundary title={tk('docker.section.containers')}>
              <DockerContainers
                refreshToken={refreshToken}
                onChanged={handleChanged}
                onOpenImages={() => setTab('images')}
              />
            </ErrorBoundary>
          )}

          {tab === 'images' && (
            <ErrorBoundary title={tk('docker.section.images')}>
              <DockerImages
                refreshToken={refreshToken}
                onChanged={handleChanged}
                onOpenContainers={() => setTab('containers')}
              />
            </ErrorBoundary>
          )}

          {tab === 'volumes' && (
            <ErrorBoundary title={tk('docker.section.volumes')}>
              <DockerVolumes
                refreshToken={refreshToken}
                onChanged={handleChanged}
              />
            </ErrorBoundary>
          )}

          {tab === 'build-cache' && (
            <ErrorBoundary title={tk('docker.section.build_cache')}>
              <DockerBuildCache
                refreshToken={refreshToken}
                onChanged={handleChanged}
              />
            </ErrorBoundary>
          )}
        </>
      )}
    </div>
  )
}

const retryBtnStyle: React.CSSProperties = {
  padding: '6px 16px', fontSize: '12px', fontWeight: 600,
  border: 'none', borderRadius: '6px',
  background: 'var(--accent-blue)', color: 'var(--text-on-accent)', cursor: 'pointer'
}

function PageTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        border: 'none',
        borderRadius: '6px',
        background: active ? 'var(--accent-blue)' : 'transparent',
        color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}
