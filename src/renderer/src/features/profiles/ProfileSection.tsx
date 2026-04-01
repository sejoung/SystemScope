import { useEffect, useState } from 'react'
import { useProfileStore } from '../../stores/useProfileStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'
import { ProfileEditDialog } from './ProfileEditDialog'
import type { WorkspaceProfile } from '@shared/types'
import { MAX_PROFILES } from '@shared/types'

export function ProfileSection() {
  const { t } = useI18n()
  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles)
  const deleteProfile = useProfileStore((s) => s.deleteProfile)
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile)
  const showToast = useToast((s) => s.show)
  const [editingProfile, setEditingProfile] = useState<WorkspaceProfile | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => { void fetchProfiles() }, [fetchProfiles])

  async function handleDelete(profile: WorkspaceProfile) {
    const ok = await deleteProfile(profile.id)
    if (ok) showToast(t('Profile deleted.'))
  }

  async function handleToggleActive(profileId: string) {
    if (activeProfileId === profileId) {
      const ok = await setActiveProfile(null)
      if (ok) showToast(t('Profile deactivated. Using global settings.'))
    } else {
      const ok = await setActiveProfile(profileId)
      if (ok) showToast(t('Profile activated.'))
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('Workspace Profiles')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('Manage workspace profiles with custom thresholds, cleanup rules, and dashboard layout.')}
          </p>
        </div>
        <button
          onClick={() => { setEditingProfile(null); setDialogOpen(true) }}
          disabled={profiles.length >= MAX_PROFILES}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
            cursor: profiles.length >= MAX_PROFILES ? 'not-allowed' : 'pointer',
            fontSize: 12, opacity: profiles.length >= MAX_PROFILES ? 0.5 : 1,
          }}
        >
          {t('Create Profile')}
        </button>
      </div>

      {profiles.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {t('No profiles yet. Create one to customize thresholds and dashboard layout per workspace.')}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {profiles.map((profile) => (
            <div key={profile.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              border: activeProfileId === profile.id ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{profile.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.name}</div>
                  {profile.hiddenWidgets.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {profile.hiddenWidgets.length} {t('Hidden Widgets').toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => void handleToggleActive(profile.id)}
                  style={{ ...btnStyle, color: activeProfileId === profile.id ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                  {activeProfileId === profile.id ? t('Active Profile') : t('Switch Profile')}
                </button>
                <button onClick={() => { setEditingProfile(profile); setDialogOpen(true) }} style={btnStyle}>
                  {t('Edit Profile')}
                </button>
                <button onClick={() => void handleDelete(profile)}
                  style={{ ...btnStyle, color: 'var(--accent-red, #e53e3e)' }}>
                  {t('Delete Profile')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <ProfileEditDialog
          profile={editingProfile}
          onClose={() => { setDialogOpen(false); setEditingProfile(null) }}
          onSaved={() => { setDialogOpen(false); setEditingProfile(null); showToast(t('Profile saved.')) }}
        />
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
  backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
}
