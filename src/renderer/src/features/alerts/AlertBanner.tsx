import { useMemo } from 'react'
import { useAlertStore } from '../../stores/useAlertStore'

export function AlertBanner() {
  const allAlerts = useAlertStore((s) => s.alerts)
  const dismissAlert = useAlertStore((s) => s.dismissAlert)
  const alerts = useMemo(() => allAlerts.filter((a) => !a.dismissed), [allAlerts])

  if (alerts.length === 0) return null

  const latestAlerts = alerts.slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      {latestAlerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: 'var(--radius)',
            backgroundColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
            border: `1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
            fontSize: '13px'
          }}
        >
          <span style={{ color: alert.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
            {alert.severity === 'critical' ? 'CRITICAL' : 'WARNING'}: {alert.message}
          </span>
          <button
            onClick={() => {
              dismissAlert(alert.id)
              window.systemScope.dismissAlert(alert.id)
            }}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px'
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}
