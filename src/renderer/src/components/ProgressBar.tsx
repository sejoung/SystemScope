interface ProgressBarProps {
  value: number
  color?: string
  height?: number
  label?: string
  showValue?: boolean
}

export function ProgressBar({
  value,
  color = 'var(--accent-blue)',
  height = 8,
  label,
  showValue = true
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100)

  return (
    <div>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '12px'
          }}
        >
          {label && <span style={{ color: 'var(--text-secondary)' }}>{label}</span>}
          {showValue && <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{clamped.toFixed(1)}%</span>}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          backgroundColor: 'var(--border)',
          borderRadius: height / 2,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: height / 2,
            transition: 'width 0.5s ease'
          }}
        />
      </div>
    </div>
  )
}
