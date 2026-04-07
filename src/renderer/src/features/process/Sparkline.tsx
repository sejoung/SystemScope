import type { PidHistorySample } from './usePidNetworkHistory'

interface SparklineProps {
  samples: PidHistorySample[]
  width?: number
  height?: number
}

export function Sparkline({ samples, width = 80, height = 24 }: SparklineProps) {
  if (samples.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </svg>
    )
  }

  const max = Math.max(
    1,
    ...samples.map((s) => Math.max(s.rxBps, s.txBps))
  )
  const stepX = width / (samples.length - 1)

  const toPoints = (getValue: (s: PidHistorySample) => number) =>
    samples
      .map((s, i) => {
        const x = i * stepX
        const y = height - (getValue(s) / max) * (height - 2) - 1
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--accent-blue, #3b82f6)"
        strokeWidth={1.25}
        points={toPoints((s) => s.rxBps)}
      />
      <polyline
        fill="none"
        stroke="var(--accent-green, #10b981)"
        strokeWidth={1.25}
        points={toPoints((s) => s.txBps)}
      />
    </svg>
  )
}
