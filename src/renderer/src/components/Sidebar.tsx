import { useSettingsStore } from '../stores/useSettingsStore'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: '⊞' },
  { id: 'disk', label: 'Storage', icon: '⊚' },
  { id: 'docker', label: 'Docker', icon: '◈' },
  { id: 'process', label: 'Activity', icon: '⊡' },
  { id: 'apps', label: 'Applications', icon: '◫' },
  { id: 'settings', label: 'Preferences', icon: '⊙' }
] as const

export function Sidebar() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        paddingInline: '10px',
        paddingTop: navigator.userAgent.includes('Macintosh') ? '48px' : '12px'
      }}
    >
      <div
        className="titlebar-drag"
        style={{
          padding: '18px 12px 22px',
          fontSize: '17px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)'
        }}
      >
        <span style={{ color: 'var(--accent-cyan)' }}>System</span>Scope
      </div>

      <nav className="titlebar-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 2px' }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === currentPage) return
              if (currentPage === 'settings' && hasUnsavedSettings) {
                const confirmed = window.confirm('저장하지 않은 설정 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?')
                if (!confirmed) return
              }
              setCurrentPage(item.id)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 12px',
              border: currentPage === item.id ? '1px solid var(--nav-active-border)' : '1px solid transparent',
              borderRadius: 'calc(var(--radius) + 2px)',
              background: currentPage === item.id ? 'var(--nav-active-bg)' : 'transparent',
              color: currentPage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: currentPage === item.id ? 700 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxShadow: currentPage === item.id ? 'var(--shadow)' : 'none'
            }}
          >
            <span style={{ fontSize: '16px', opacity: currentPage === item.id ? 1 : 0.7 }}>{item.icon}</span>
            <span style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
