import type { DevToolsOverview } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { cardStyle, detailStyle, emptyStyle, errorStyle, gridStyle, hintStyle, statusPillStyle, tileHeaderStyle, tileStyle, tileTitleStyle } from './DevToolsOverviewSection.styles'
import { SectionHeader, getStatusStyle } from './DevToolsOverviewPrimitives'

export function DevToolsHealthPanel({ compact, error, loading, overview, tk }: {
  compact: boolean
  error: string | null
  loading: boolean
  overview: DevToolsOverview | null
  tk: TranslateFn
}) {
  const checks = compact ? (overview?.healthChecks ?? []).slice(0, 6) : (overview?.healthChecks ?? [])
  return <section style={cardStyle}>
    <SectionHeader title={tk('Environment Health')} description={tk('Check whether local developer tools are installed and ready before you start a session.')} />
    {error ? <div style={errorStyle}>{error}</div> : null}
    <div style={gridStyle}>
      {checks.map((check) => {
        const gpuModel = typeof check.extra?.gpuModel === 'string' ? check.extra.gpuModel : null
        const torchCudaAvailable = typeof check.extra?.torchCudaAvailable === 'boolean' ? check.extra.torchCudaAvailable : null
        return <div key={check.id} style={tileStyle}>
          <div style={tileHeaderStyle}>
            <span style={tileTitleStyle}>{check.label}</span>
            <span style={{ ...statusPillStyle, ...getStatusStyle(check.status) }}>{tk(check.status === 'healthy' ? 'Ready' : check.status === 'warning' ? 'Needs Review' : 'Missing')}</span>
          </div>
          <div style={detailStyle}>{check.version ?? check.detail}</div>
          {gpuModel ? <div style={hintStyle}>GPU: {gpuModel}</div> : null}
          {torchCudaAvailable !== null ? <div style={hintStyle}>{tk('CUDA Available')}: {torchCudaAvailable ? tk('Yes') : tk('No')}</div> : null}
          {check.hint && !gpuModel ? <div style={hintStyle}>{check.hint}</div> : null}
        </div>
      })}
      {!loading && checks.length === 0 ? <div style={emptyStyle}>{tk('No environment checks are available right now.')}</div> : null}
    </div>
  </section>
}
