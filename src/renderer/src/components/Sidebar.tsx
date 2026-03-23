import { useSettingsStore } from '../stores/useSettingsStore'
import { useI18n } from '../i18n/useI18n'

export function Sidebar() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const hasUnsavedSettings = useSettingsStore((s) => s.hasUnsavedSettings)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { tk } = useI18n()
  const navItems = [
    { id: 'dashboard', label: tk('nav.overview'), icon: '⊞' },
    { id: 'disk', label: tk('nav.storage'), icon: '⊚' },
    { id: 'docker', label: tk('nav.docker'), icon: '◈' },
    { id: 'process', label: tk('nav.activity'), icon: '⊡' },
    { id: 'apps', label: tk('nav.applications'), icon: '◫' },
    { id: 'settings', label: tk('nav.preferences'), icon: '⊙' }
  ] as const

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
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '18px 12px 22px',
          fontSize: '17px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="28" height="28" style={{ flexShrink: 0 }}>
          <rect x="16" y="16" width="224" height="224" rx="56" fill="#0b0f14"/>
          <circle cx="128" cy="128" r="64" fill="none" stroke="#22c55e" strokeWidth="10"/>
          <circle cx="128" cy="128" r="6" fill="#22c55e"/>
          <line x1="128" y1="128" x2="176" y2="96" stroke="#22c55e" strokeWidth="10" strokeLinecap="round"/>
          <circle cx="170" cy="110" r="4" fill="#22c55e"/>
          <circle cx="110" cy="160" r="3" fill="#22c55e" opacity="0.7"/>
        </svg>
        <span><span style={{ color: 'var(--accent-cyan)' }}>System</span>Scope</span>
      </div>

      <nav className="titlebar-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 2px' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === currentPage) return
              if (currentPage === 'settings' && hasUnsavedSettings) {
                const confirmed = window.confirm(tk('confirm.unsaved_settings_leave'))
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
