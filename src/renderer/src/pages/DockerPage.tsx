import { useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DockerOverview } from '../features/docker/DockerOverview'
import { DockerContainers } from '../features/docker/DockerContainers'
import { DockerVolumes } from '../features/docker/DockerVolumes'
import { DockerBuildCache } from '../features/docker/DockerBuildCache'
import { DockerImages } from '../features/disk/DockerImages'
import { useI18n } from '../i18n/useI18n'

type DockerTab = 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache'

export function DockerPage() {
  const [tab, setTab] = useState<DockerTab>('overview')
  const [refreshToken, setRefreshToken] = useState(0)
  const { tk } = useI18n()

  const handleChanged = () => setRefreshToken((prev) => prev + 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{tk('docker.page.title')}</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
          <PageTab active={tab === 'overview'} onClick={() => setTab('overview')}>{tk('docker.tab.overview')}</PageTab>
          <PageTab active={tab === 'containers'} onClick={() => setTab('containers')}>{tk('docker.tab.containers')}</PageTab>
          <PageTab active={tab === 'images'} onClick={() => setTab('images')}>{tk('docker.tab.images')}</PageTab>
          <PageTab active={tab === 'volumes'} onClick={() => setTab('volumes')}>{tk('docker.tab.volumes')}</PageTab>
          <PageTab active={tab === 'build-cache'} onClick={() => setTab('build-cache')}>{tk('docker.tab.build_cache')}</PageTab>
        </div>
      </div>

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
    </div>
  )
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
