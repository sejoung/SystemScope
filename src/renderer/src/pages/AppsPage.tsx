import { Fragment, useEffect, useMemo, useState } from 'react'
import type { AppRelatedDataItem, AppRemovalResult, InstalledApp } from '@shared/types'
import { useToast } from '../components/Toast'

type PlatformFilter = 'all' | 'mac' | 'windows'

export function AppsPage() {
  const showToast = useToast((s) => s.show)
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [busyAppId, setBusyAppId] = useState<string | null>(null)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [relatedLoadingAppId, setRelatedLoadingAppId] = useState<string | null>(null)
  const [relatedDataByAppId, setRelatedDataByAppId] = useState<Record<string, AppRelatedDataItem[]>>({})
  const [selectedRelatedPathsByAppId, setSelectedRelatedPathsByAppId] = useState<Record<string, string[]>>({})
  const isWindows = navigator.userAgent.includes('Windows')

  const loadApps = async () => {
    setLoading(true)
    const res = await window.systemScope.listInstalledApps()
    if (res.ok && res.data) {
      setApps(res.data as InstalledApp[])
    } else {
      showToast(res.error?.message ?? '설치 앱 목록을 불러오지 못했습니다.')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadApps()
  }, [])

  const filteredApps = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()
    return apps.filter((app) => {
      if (platformFilter !== 'all' && app.platform !== platformFilter) return false
      if (!normalizedQuery) return true
      return [
        app.name,
        app.version,
        app.publisher,
        app.installLocation
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [apps, platformFilter, search])

  const handleUninstall = async (app: InstalledApp) => {
    setBusyAppId(app.id)
    const res = await window.systemScope.uninstallApp({
      appId: app.id,
      relatedDataPaths: selectedRelatedPathsByAppId[app.id] ?? []
    })
    setBusyAppId(null)

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? '앱 제거를 시작하지 못했습니다.')
      return
    }

    const result = res.data as AppRemovalResult
    if (result.cancelled) return

    showToast(result.message ?? (result.completed ? '앱을 제거했습니다.' : '제거 프로그램을 시작했습니다.'))
    void loadApps()
  }

  const handleToggleRelatedData = async (app: InstalledApp) => {
    if (expandedAppId === app.id) {
      setExpandedAppId(null)
      return
    }

    setExpandedAppId(app.id)
    if (relatedDataByAppId[app.id]) {
      return
    }

    setRelatedLoadingAppId(app.id)
    const res = await window.systemScope.getAppRelatedData(app.id)
    setRelatedLoadingAppId(null)

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? '관련 데이터 목록을 불러오지 못했습니다.')
      return
    }

    const items = res.data as AppRelatedDataItem[]
    setRelatedDataByAppId((current) => ({ ...current, [app.id]: items }))
    setSelectedRelatedPathsByAppId((current) => ({ ...current, [app.id]: items.map((item) => item.path) }))
  }

  const handleToggleRelatedPath = (appId: string, targetPath: string) => {
    setSelectedRelatedPathsByAppId((current) => {
      const selected = new Set(current[appId] ?? [])
      if (selected.has(targetPath)) {
        selected.delete(targetPath)
      } else {
        selected.add(targetPath)
      }

      return {
        ...current,
        [appId]: [...selected]
      }
    })
  }

  const handleOpenLocation = async (appId: string) => {
    const res = await window.systemScope.openAppLocation(appId)
    if (!res.ok) {
      showToast(res.error?.message ?? '설치 위치를 열지 못했습니다.')
    }
  }

  const handleOpenSystemSettings = async () => {
    const res = await window.systemScope.openSystemUninstallSettings()
    if (!res.ok) {
      showToast(res.error?.message ?? '시스템 제거 설정을 열지 못했습니다.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Apps</h2>
        <button onClick={() => void loadApps()} style={btnStyle}>Refresh</button>
        {isWindows && (
          <button onClick={() => void handleOpenSystemSettings()} style={{ ...btnStyle, background: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}>
            Open System Settings
          </button>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps"
          style={{ ...inputStyle, minWidth: '220px', flex: '1 1 220px' }}
        />
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)} style={inputStyle}>
          <option value="all">All Platforms</option>
          <option value="mac">macOS</option>
          <option value="windows">Windows</option>
        </select>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '14px', padding: '10px 14px',
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          macOS는 앱 번들을 휴지통으로 이동하고, Windows는 등록된 제거 프로그램을 실행합니다. 펼친 항목에서 관련 데이터도 함께 선택할 수 있습니다.
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {filteredApps.length} apps
        </span>
      </div>

      {loading ? (
        <div style={emptyStyle}>설치 앱 목록을 불러오는 중입니다.</div>
      ) : filteredApps.length === 0 ? (
        <div style={emptyStyle}>표시할 설치 앱이 없습니다.</div>
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Version</th>
                <th style={thStyle}>Publisher</th>
                <th style={thStyle}>Platform</th>
                <th style={thStyle}>Location</th>
                <th style={{ ...thStyle, width: '210px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((entry) => (
                <Fragment key={entry.id}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.name}</span>
                        {entry.protected && (
                          <span style={protectedBadgeStyle}>Protected</span>
                        )}
                      </div>
                      {entry.protectedReason && (
                        <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{entry.protectedReason}</div>
                      )}
                    </td>
                    <td style={tdStyle}>{entry.version ?? '-'}</td>
                    <td style={tdStyle}>{entry.publisher ?? '-'}</td>
                    <td style={tdStyle}>{entry.platform === 'mac' ? 'macOS' : 'Windows'}</td>
                    <td style={{ ...tdStyle, maxWidth: '340px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {entry.installLocation ?? entry.launchPath ?? '-'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => void handleToggleRelatedData(entry)} style={openBtn}>
                        {expandedAppId === entry.id ? 'Hide Data' : 'Related Data'}
                      </button>
                      <button onClick={() => void handleOpenLocation(entry.id)} style={openBtn}>
                        Open
                      </button>
                      <button
                        onClick={() => void handleUninstall(entry)}
                        disabled={entry.protected || busyAppId === entry.id}
                        style={{
                          ...actionBtnStyle,
                          opacity: entry.protected || busyAppId === entry.id ? 0.55 : 1,
                          cursor: entry.protected || busyAppId === entry.id ? 'default' : 'pointer'
                        }}
                      >
                        {busyAppId === entry.id ? 'Working...' : entry.platform === 'mac' ? 'Move to Trash' : 'Uninstall'}
                      </button>
                    </td>
                  </tr>
                  {expandedAppId === entry.id && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: '0 6px 12px 6px' }}>
                        <div style={relatedPanelStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Related Data</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                선택한 경로만 앱 제거와 함께 휴지통으로 이동합니다.
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {(selectedRelatedPathsByAppId[entry.id] ?? []).length} selected
                            </div>
                          </div>

                          {relatedLoadingAppId === entry.id ? (
                            <div style={relatedEmptyStyle}>관련 데이터 후보를 찾는 중입니다.</div>
                          ) : (relatedDataByAppId[entry.id] ?? []).length === 0 ? (
                            <div style={relatedEmptyStyle}>감지된 관련 데이터 경로가 없습니다.</div>
                          ) : (
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {(relatedDataByAppId[entry.id] ?? []).map((item) => {
                                const checked = (selectedRelatedPathsByAppId[entry.id] ?? []).includes(item.path)
                                return (
                                  <label key={item.id} style={relatedItemStyle}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleRelatedPath(entry.id, item.path)}
                                    />
                                    <div style={{ display: 'grid', gap: '3px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.path}</span>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius)',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)'
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 6px',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const tdStyle: React.CSSProperties = {
  padding: '10px 6px',
  color: 'var(--text-secondary)',
  verticalAlign: 'top'
}

const openBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--bg-card-hover)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  marginRight: '6px'
}

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '6px',
  background: 'var(--accent-red)',
  color: 'var(--text-on-accent)',
  cursor: 'pointer'
}

const protectedBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: '999px',
  background: 'var(--alert-yellow-soft)',
  color: 'var(--accent-yellow)'
}

const relatedPanelStyle: React.CSSProperties = {
  marginTop: '4px',
  padding: '12px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '12px'
}

const relatedItemStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px 1fr',
  alignItems: 'start',
  gap: '10px',
  padding: '10px 12px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  cursor: 'pointer'
}

const relatedEmptyStyle: React.CSSProperties = {
  padding: '14px 12px',
  color: 'var(--text-muted)',
  fontSize: '12px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '10px'
}

const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--text-muted)',
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)'
}
