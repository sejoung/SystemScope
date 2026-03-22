import { useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DockerOverview } from '../features/docker/DockerOverview'
import { DockerContainers } from '../features/docker/DockerContainers'
import { DockerVolumes } from '../features/docker/DockerVolumes'
import { DockerBuildCache } from '../features/docker/DockerBuildCache'
import { DockerImages } from '../features/disk/DockerImages'

type DockerTab = 'overview' | 'containers' | 'images' | 'volumes' | 'build-cache'

export function DockerPage() {
  const [tab, setTab] = useState<DockerTab>('overview')
  const [refreshToken, setRefreshToken] = useState(0)

  const handleChanged = () => setRefreshToken((prev) => prev + 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Docker</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
          <PageTab active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</PageTab>
          <PageTab active={tab === 'containers'} onClick={() => setTab('containers')}>Containers</PageTab>
          <PageTab active={tab === 'images'} onClick={() => setTab('images')}>Images</PageTab>
          <PageTab active={tab === 'volumes'} onClick={() => setTab('volumes')}>Volumes</PageTab>
          <PageTab active={tab === 'build-cache'} onClick={() => setTab('build-cache')}>Build Cache</PageTab>
        </div>
      </div>

      {tab === 'overview' && (
        <ErrorBoundary title="Docker Overview">
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
        <ErrorBoundary title="Docker Containers">
          <DockerContainers
            refreshToken={refreshToken}
            onChanged={handleChanged}
            onOpenImages={() => setTab('images')}
          />
        </ErrorBoundary>
      )}

      {tab === 'images' && (
        <ErrorBoundary title="Docker Images">
          <DockerImages
            refreshToken={refreshToken}
            onChanged={handleChanged}
            onOpenContainers={() => setTab('containers')}
          />
        </ErrorBoundary>
      )}

      {tab === 'volumes' && (
        <ErrorBoundary title="Docker Volumes">
          <DockerVolumes
            refreshToken={refreshToken}
            onChanged={handleChanged}
          />
        </ErrorBoundary>
      )}

      {tab === 'build-cache' && (
        <ErrorBoundary title="Docker Build Cache">
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
