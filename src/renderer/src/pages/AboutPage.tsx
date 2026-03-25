import { useEffect, useState } from 'react'
import type { SystemScopeAboutInfo } from '@shared/contracts/systemScope'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useI18n } from '../i18n/useI18n'

const appIconUrl = new URL('../../../../resources/systemscope_icon.svg', import.meta.url).href

export function AboutPage() {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const [aboutInfo, setAboutInfo] = useState<SystemScopeAboutInfo | null>(null)
  const { tk } = useI18n()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void window.systemScope.getSettings().then((res) => {
      if (!res.ok || !res.data) return
      const settings = res.data as Record<string, unknown>
      if (settings.theme === 'dark' || settings.theme === 'light') setTheme(settings.theme)
      if (settings.locale === 'ko' || settings.locale === 'en') setLocale(settings.locale)
    }).catch(() => {})

    void window.systemScope.getAboutInfo().then((res) => {
      if (res.ok && res.data) setAboutInfo(res.data as SystemScopeAboutInfo)
    }).catch(() => {})
  }, [setLocale, setTheme])

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={markWrapStyle}>
          <img src={appIconUrl} alt="SystemScope Icon" style={markImageStyle} />
        </div>
        <div style={{ display: 'grid', gap: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {aboutInfo?.appName ?? 'SystemScope'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tk('about.subtitle')}</div>
        </div>

        <div style={detailsStyle}>
          <AboutRow label={tk('about.version')} value={aboutInfo?.version ?? '-'} />
          <AboutRow label={tk('about.developer')} value={aboutInfo?.author ?? '-'} />
          <AboutRow label={tk('about.license')} value={aboutInfo?.license ?? '-'} />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {aboutInfo?.homepage && (
            <button onClick={() => { void window.systemScope.openHomepage() }} style={secondaryButtonStyle}>
              {tk('about.github')}
            </button>
          )}
          <button onClick={() => window.close()} style={buttonStyle}>
            {tk('about.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span
        style={{
          minWidth: 0,
          fontSize: '13px',
          color: 'var(--text-primary)',
          textAlign: 'right',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word'
        }}
      >
        {value}
      </span>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '28px',
  background: 'radial-gradient(circle at top, color-mix(in srgb, var(--accent-blue) 14%, transparent), transparent 48%), var(--bg-primary)'
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  display: 'grid',
  gap: '18px',
  justifyItems: 'center',
  padding: '28px',
  borderRadius: '20px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)'
}

const markWrapStyle: React.CSSProperties = {
  width: '72px',
  height: '72px',
  display: 'grid',
  placeItems: 'center',
  padding: '4px'
}

const markImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain'
}

const detailsStyle: React.CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: '10px',
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)'
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'start'
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: '13px',
  fontWeight: 700,
  border: 'none',
  borderRadius: '999px',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: '13px',
  fontWeight: 700,
  border: '1px solid var(--border)',
  borderRadius: '999px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  cursor: 'pointer'
}
