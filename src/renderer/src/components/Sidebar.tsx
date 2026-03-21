import { useSettingsStore } from '../stores/useSettingsStore'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'disk', label: 'Disk Analysis', icon: '⊚' },
  { id: 'process', label: 'Processes', icon: '⊡' },
  { id: 'settings', label: 'Settings', icon: '⊙' }
]

export function Sidebar() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: navigator.userAgent.includes('Macintosh') ? '48px' : '12px'
      }}
    >
      <div
        className="titlebar-drag"
        style={{
          padding: '16px 20px 24px',
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--accent-cyan)'
        }}
      >
        SystemScope
      </div>

      <nav className="titlebar-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: currentPage === item.id ? 'var(--bg-card-hover)' : 'transparent',
              color: currentPage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: currentPage === item.id ? 600 : 400,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '16px', opacity: 0.8 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
