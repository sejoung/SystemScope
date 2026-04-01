import { useEffect, useRef, useState } from 'react'
import { useProfileStore } from '../../stores/useProfileStore'
import { useI18n } from '../../i18n/useI18n'

export function ProfileSelector() {
  const { t } = useI18n()
  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile)
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void fetchProfiles() }, [fetchProfiles])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (profiles.length === 0) return null

  const activeProfile = profiles.find((p) => p.id === activeProfileId)
  const label = activeProfile ? `${activeProfile.icon} ${activeProfile.name}` : t('Global (No Profile)')

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
          cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 180,
          borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden',
        }}>
          <button onClick={() => { void setActiveProfile(null); setOpen(false) }}
            style={{ ...menuItemStyle, fontWeight: activeProfileId === null ? 700 : 400 }}>
            {t('Global (No Profile)')}
          </button>
          {profiles.map((profile) => (
            <button key={profile.id}
              onClick={() => { void setActiveProfile(profile.id); setOpen(false) }}
              style={{ ...menuItemStyle, fontWeight: activeProfileId === profile.id ? 700 : 400 }}>
              {profile.icon} {profile.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px', border: 'none',
  backgroundColor: 'transparent', color: 'var(--text-primary)',
  cursor: 'pointer', fontSize: 12, textAlign: 'left',
}
