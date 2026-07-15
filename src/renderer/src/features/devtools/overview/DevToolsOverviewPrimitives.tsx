import { metaPillStyle, secondaryActionButtonStyle, sectionDescriptionStyle, sectionTitleStyle, serverActionRowStyle } from './DevToolsOverviewSection.styles'

export function OverviewRefreshButton({
  loading,
  label,
  onClick,
}: {
  loading: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={loading} style={secondaryActionButtonStyle}>
      {label}
    </button>
  )
}

export function DockerOpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={secondaryActionButtonStyle}>
      {label}
    </button>
  )
}

export function DockerQuickActions({
  labels,
  onOpenContainers,
  onOpenImages,
  onOpenVolumes,
  onOpenBuildCache,
}: {
  labels: {
    containers: string
    images: string
    volumes: string
    buildCache: string
  }
  onOpenContainers: () => void
  onOpenImages: () => void
  onOpenVolumes: () => void
  onOpenBuildCache: () => void
}) {
  return (
    <div style={serverActionRowStyle}>
      <button type="button" onClick={onOpenContainers} style={secondaryActionButtonStyle}>
        {labels.containers}
      </button>
      <button type="button" onClick={onOpenImages} style={secondaryActionButtonStyle}>
        {labels.images}
      </button>
      <button type="button" onClick={onOpenVolumes} style={secondaryActionButtonStyle}>
        {labels.volumes}
      </button>
      <button type="button" onClick={onOpenBuildCache} style={secondaryActionButtonStyle}>
        {labels.buildCache}
      </button>
    </div>
  )
}

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={sectionDescriptionStyle}>{description}</div>
    </div>
  )
}

export function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span style={metaPillStyle}>
      {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
    </span>
  )
}

export function getStatusStyle(status: 'healthy' | 'warning' | 'missing') {
  if (status === 'healthy') {
    return { color: 'var(--accent-green)', borderColor: 'color-mix(in srgb, var(--accent-green) 35%, transparent)' }
  }
  if (status === 'warning') {
    return { color: 'var(--accent-yellow)', borderColor: 'color-mix(in srgb, var(--accent-yellow) 35%, transparent)' }
  }
  return { color: 'var(--accent-red)', borderColor: 'color-mix(in srgb, var(--accent-red) 35%, transparent)' }
}

