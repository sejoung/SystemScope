import { Fragment, startTransition, useEffect, useMemo, useState } from 'react'
import type { AppLeftoverDataItem, AppRelatedDataItem, AppRemovalResult, InstalledApp } from '@shared/types'
import { useToast } from '../components/Toast'

type PlatformFilter = 'all' | 'mac' | 'windows'
type AppsTab = 'installed' | 'leftover'
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low'

export function AppsPage() {
  const showToast = useToast((s) => s.show)
  const [activeTab, setActiveTab] = useState<AppsTab>('installed')
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [leftoverItems, setLeftoverItems] = useState<AppLeftoverDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [installedDraftSearch, setInstalledDraftSearch] = useState('')
  const [installedAppliedSearch, setInstalledAppliedSearch] = useState('')
  const [installedPlatformFilter, setInstalledPlatformFilter] = useState<PlatformFilter>('all')
  const [leftoverDraftSearch, setLeftoverDraftSearch] = useState('')
  const [leftoverAppliedSearch, setLeftoverAppliedSearch] = useState('')
  const [leftoverPlatformFilter, setLeftoverPlatformFilter] = useState<PlatformFilter>('all')
  const [leftoverConfidenceFilter, setLeftoverConfidenceFilter] = useState<ConfidenceFilter>('all')
  const [busyAppId, setBusyAppId] = useState<string | null>(null)
  const [leftoverBusy, setLeftoverBusy] = useState(false)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [relatedLoadingAppId, setRelatedLoadingAppId] = useState<string | null>(null)
  const [relatedDataByAppId, setRelatedDataByAppId] = useState<Record<string, AppRelatedDataItem[]>>({})
  const [selectedRelatedIdsByAppId, setSelectedRelatedIdsByAppId] = useState<Record<string, string[]>>({})
  const [selectedLeftoverIds, setSelectedLeftoverIds] = useState<string[]>([])
  const isWindows = navigator.userAgent.includes('Windows')

  const loadApps = async () => {
    const res = await window.systemScope.listInstalledApps()
    if (res.ok && res.data) {
      setApps(res.data as InstalledApp[])
    } else {
      showToast(res.error?.message ?? '설치 앱 목록을 불러오지 못했습니다.')
    }
  }

  const loadLeftovers = async () => {
    const res = await window.systemScope.listLeftoverAppData()
    if (res.ok && res.data) {
      const items = res.data as AppLeftoverDataItem[]
      setLeftoverItems(items)
      setSelectedLeftoverIds((current) => current.filter((itemId) => items.some((entry) => entry.id === itemId)))
    } else {
      showToast(res.error?.message ?? '잔여 앱 데이터를 불러오지 못했습니다.')
    }
  }

  const refreshCurrentTab = async () => {
    setLoading(true)
    if (activeTab === 'installed') {
      await loadApps()
    } else {
      await loadLeftovers()
    }
    setLoading(false)
  }

  useEffect(() => {
    void refreshCurrentTab()
  }, [activeTab])

  const filteredApps = useMemo(() => {
    const normalizedQuery = installedAppliedSearch.trim().toLowerCase()
    return apps.filter((app) => {
      if (installedPlatformFilter !== 'all' && app.platform !== installedPlatformFilter) return false
      if (!normalizedQuery) return true
      return [
        app.name,
        app.version,
        app.publisher,
        app.installLocation
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [apps, installedAppliedSearch, installedPlatformFilter])

  const filteredLeftovers = useMemo(() => {
    const normalizedQuery = leftoverAppliedSearch.trim().toLowerCase()
    return leftoverItems.filter((item) => {
      if (leftoverPlatformFilter !== 'all' && item.platform !== leftoverPlatformFilter) return false
      if (leftoverConfidenceFilter !== 'all' && item.confidence !== leftoverConfidenceFilter) return false
      if (!normalizedQuery) return true
      return [item.appName, item.label, item.path].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [leftoverAppliedSearch, leftoverConfidenceFilter, leftoverItems, leftoverPlatformFilter])
  const selectedFilteredLeftoverCount = useMemo(
    () => filteredLeftovers.filter((item) => selectedLeftoverIds.includes(item.id)).length,
    [filteredLeftovers, selectedLeftoverIds]
  )
  const allFilteredLeftoversChecked = filteredLeftovers.length > 0 && selectedFilteredLeftoverCount === filteredLeftovers.length

  const applyInstalledSearch = () => {
    startTransition(() => {
      setInstalledAppliedSearch(installedDraftSearch)
    })
  }

  const clearInstalledSearch = () => {
    setInstalledDraftSearch('')
    startTransition(() => {
      setInstalledAppliedSearch('')
    })
  }

  const applyLeftoverSearch = () => {
    startTransition(() => {
      setLeftoverAppliedSearch(leftoverDraftSearch)
    })
  }

  const clearLeftoverSearch = () => {
    setLeftoverDraftSearch('')
    startTransition(() => {
      setLeftoverAppliedSearch('')
    })
  }

  const handleUninstall = async (app: InstalledApp) => {
    setBusyAppId(app.id)
    const res = await window.systemScope.uninstallApp({
      appId: app.id,
      relatedDataIds: selectedRelatedIdsByAppId[app.id] ?? []
    })
    setBusyAppId(null)

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? '앱 제거를 시작하지 못했습니다.')
      return
    }

    const result = res.data as AppRemovalResult
    if (result.cancelled) return

    showToast(result.message ?? (result.completed ? '앱을 제거했습니다.' : '제거 프로그램을 시작했습니다.'))
    await loadApps()
    await loadLeftovers()
  }

  const handleToggleLeftoverId = (itemId: string) => {
    setSelectedLeftoverIds((current) => current.includes(itemId)
      ? current.filter((entry) => entry !== itemId)
      : [...current, itemId]
    )
  }

  const handleRemoveSelectedLeftovers = async () => {
    if (selectedLeftoverIds.length === 0) return

    setLeftoverBusy(true)
    const res = await window.systemScope.removeLeftoverAppData(selectedLeftoverIds)
    setLeftoverBusy(false)

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? '잔여 앱 데이터를 이동하지 못했습니다.')
      return
    }

    const result = res.data as { deletedPaths: string[]; failedPaths: string[] }
    setSelectedLeftoverIds([])
    showToast(
      result.failedPaths.length === 0
        ? `잔여 데이터 ${result.deletedPaths.length}개를 휴지통으로 이동했습니다.`
        : `잔여 데이터 ${result.deletedPaths.length}개 이동, ${result.failedPaths.length}개 실패`
    )
    await loadLeftovers()
  }

  const handleOpenLeftoverPath = async (targetPath: string) => {
    const res = await window.systemScope.openPath(targetPath)
    if (!res.ok) {
      showToast(res.error?.message ?? '경로를 열지 못했습니다.')
    }
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
    setSelectedRelatedIdsByAppId((current) => ({ ...current, [app.id]: items.map((item) => item.id) }))
  }

  const handleToggleRelatedId = (appId: string, itemId: string) => {
    setSelectedRelatedIdsByAppId((current) => {
      const selected = new Set(current[appId] ?? [])
      if (selected.has(itemId)) {
        selected.delete(itemId)
      } else {
        selected.add(itemId)
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
      <div style={stickyHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Apps</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
          <PageTab active={activeTab === 'installed'} onClick={() => setActiveTab('installed')}>Installed</PageTab>
          <PageTab active={activeTab === 'leftover'} onClick={() => setActiveTab('leftover')}>Leftover Data</PageTab>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '14px', padding: '10px 14px',
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {activeTab === 'installed'
            ? 'macOS는 앱 번들을 휴지통으로 이동하고, Windows는 등록된 제거 프로그램을 실행합니다. 펼친 항목에서 관련 데이터도 함께 선택할 수 있습니다.'
            : '앱 본체가 없어도 남아 있는 관련 데이터 후보를 따로 정리할 수 있습니다.'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {activeTab === 'installed' ? `${filteredApps.length} apps` : `${filteredLeftovers.length} items`}
        </span>
        {activeTab === 'installed' && installedAppliedSearch && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Search: <strong style={{ color: 'var(--text-primary)' }}>{installedAppliedSearch}</strong>
          </span>
        )}
        {activeTab === 'leftover' && leftoverAppliedSearch && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Search: <strong style={{ color: 'var(--text-primary)' }}>{leftoverAppliedSearch}</strong>
          </span>
        )}
      </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>{activeTab === 'installed' ? '설치 앱 목록을 불러오는 중입니다.' : '잔여 앱 데이터를 불러오는 중입니다.'}</div>
      ) : activeTab === 'installed' ? (
        filteredApps.length === 0 ? (
          <div style={emptyStyle}>표시할 설치 앱이 없습니다.</div>
        ) : (
          <div>
            <div style={stickyTabControlsWrapStyle}>
            <div style={tabControlsStyle}>
              <button onClick={() => void loadApps()} style={btnStyle}>Refresh</button>
              {isWindows && (
                <button onClick={() => void handleOpenSystemSettings()} style={{ ...btnStyle, background: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}>
                  Open System Settings
                </button>
              )}
              <input
                value={installedDraftSearch}
                onChange={(e) => setInstalledDraftSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyInstalledSearch()
                }}
                placeholder="Search installed apps"
                style={{ ...inputStyle, minWidth: '220px', flex: '1 1 220px' }}
              />
              <button onClick={applyInstalledSearch} style={btnStyle}>Search</button>
              <button
                onClick={clearInstalledSearch}
                disabled={!installedDraftSearch && !installedAppliedSearch}
                style={secondaryBtnStyle(!installedDraftSearch && !installedAppliedSearch)}
              >
                Clear
              </button>
              <select value={installedPlatformFilter} onChange={(e) => setInstalledPlatformFilter(e.target.value as PlatformFilter)} style={inputStyle}>
                <option value="all">All Platforms</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
            </div>
            </div>
            <div style={infoBarStyle}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                설치된 앱을 직접 정리하거나, 앱별 관련 데이터 후보를 펼쳐 함께 휴지통으로 이동할 수 있습니다.
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {filteredApps.length} installed apps
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
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
                      <td style={tdStyle}>
                        {entry.publisher
                          ? <span style={{ color: 'var(--text-secondary)' }}>{entry.publisher}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>
                      <td style={tdStyle}>
                        <Badge text={entry.platform === 'mac' ? 'macOS' : 'Windows'} color={entry.platform === 'mac' ? 'var(--accent-cyan)' : 'var(--accent-yellow)'} />
                      </td>
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
                                {(selectedRelatedIdsByAppId[entry.id] ?? []).length} selected
                              </div>
                            </div>

                            {relatedLoadingAppId === entry.id ? (
                              <div style={relatedEmptyStyle}>관련 데이터 후보를 찾는 중입니다.</div>
                            ) : (relatedDataByAppId[entry.id] ?? []).length === 0 ? (
                              <div style={relatedEmptyStyle}>감지된 관련 데이터 경로가 없습니다.</div>
                            ) : (
                              <div style={{ display: 'grid', gap: '8px' }}>
                                {(relatedDataByAppId[entry.id] ?? []).map((item) => {
                                  const checked = (selectedRelatedIdsByAppId[entry.id] ?? []).includes(item.id)
                                  return (
                                    <label key={item.id} style={relatedItemStyle}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleToggleRelatedId(entry.id, item.id)}
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
        )
      ) : (
        filteredLeftovers.length === 0 ? (
          <div style={emptyStyle}>표시할 잔여 앱 데이터가 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={stickyTabControlsWrapStyle}>
            <div style={tabControlsStyle}>
              <button onClick={() => void loadLeftovers()} style={btnStyle}>Refresh</button>
              <input
                value={leftoverDraftSearch}
                onChange={(e) => setLeftoverDraftSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyLeftoverSearch()
                }}
                placeholder="Search leftover data"
                style={{ ...inputStyle, minWidth: '220px', flex: '1 1 220px' }}
              />
              <button onClick={applyLeftoverSearch} style={btnStyle}>Search</button>
              <button
                onClick={clearLeftoverSearch}
                disabled={!leftoverDraftSearch && !leftoverAppliedSearch}
                style={secondaryBtnStyle(!leftoverDraftSearch && !leftoverAppliedSearch)}
              >
                Clear
              </button>
              <select value={leftoverPlatformFilter} onChange={(e) => setLeftoverPlatformFilter(e.target.value as PlatformFilter)} style={inputStyle}>
                <option value="all">All Platforms</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
              <select value={leftoverConfidenceFilter} onChange={(e) => setLeftoverConfidenceFilter(e.target.value as ConfidenceFilter)} style={inputStyle}>
                <option value="all">All Confidence</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            </div>
            <div style={infoBarStyle}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                설치된 앱과 연결되지 않은 잔여 데이터 후보입니다. 각 카드의 근거와 위험도를 보고 직접 선택하세요.
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {selectedFilteredLeftoverCount} selected
              </span>
            </div>
            <div style={bulkToggleRowStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allFilteredLeftoversChecked}
                  disabled={filteredLeftovers.length === 0}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedLeftoverIds((current) => {
                        const next = new Set(current)
                        filteredLeftovers.forEach((item) => next.add(item.id))
                        return [...next]
                      })
                    } else {
                      setSelectedLeftoverIds((current) => current.filter((itemId) => !filteredLeftovers.some((item) => item.id === itemId)))
                    }
                  }}
                />
                <span>{filteredLeftovers.length} leftover items</span>
              </label>
            </div>
            <div style={{ display: 'grid', gap: '10px', paddingBottom: '84px' }}>
              {filteredLeftovers.map((item) => {
                const checked = selectedLeftoverIds.includes(item.id)
                return (
                  <label key={item.id} style={leftoverCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleLeftoverId(item.id)}
                        style={{ marginTop: '3px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                              {item.appName}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <Badge text={item.platform === 'mac' ? 'macOS' : 'Windows'} color={item.platform === 'mac' ? 'var(--accent-cyan)' : 'var(--accent-yellow)'} />
                              <Badge text={item.label} color="var(--accent-green)" />
                              <Badge text={getConfidenceLabel(item.confidence)} color={getConfidenceColor(item.confidence)} />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              void handleOpenLeftoverPath(item.path)
                            }}
                            style={{ ...openBtn, marginRight: 0 }}
                          >
                            Open
                          </button>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                          {formatPathPreview(item.path)}
                        </div>
                        <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Why:</strong> {item.reason}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Risk:</strong> {item.risk}
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            <div style={stickyActionBarStyle}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {selectedFilteredLeftoverCount} selected
              </div>
              <button
                onClick={() => void handleRemoveSelectedLeftovers()}
                disabled={leftoverBusy || selectedLeftoverIds.length === 0}
                style={{
                  ...actionBtnStyle,
                  minWidth: '170px',
                  opacity: leftoverBusy || selectedLeftoverIds.length === 0 ? 0.55 : 1,
                  cursor: leftoverBusy || selectedLeftoverIds.length === 0 ? 'default' : 'pointer'
                }}
              >
                {leftoverBusy ? 'Working...' : 'Move Selected to Trash'}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function formatPathPreview(targetPath: string): string {
  if (targetPath.length <= 140) {
    return targetPath
  }

  const head = targetPath.slice(0, 72)
  const tail = targetPath.slice(-52)
  return `${head} ... ${tail}`
}

function getConfidenceLabel(confidence: AppLeftoverDataItem['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    default:
      return 'Low confidence'
  }
}

function getConfidenceColor(confidence: AppLeftoverDataItem['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'var(--accent-green)'
    case 'medium':
      return 'var(--accent-yellow)'
    default:
      return 'var(--accent-red)'
  }
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
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

const stickyHeaderStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 5,
  paddingBottom: '8px',
  marginBottom: '8px',
  background: 'color-mix(in srgb, var(--bg-primary) 92%, transparent)',
  backdropFilter: 'blur(10px)'
}

const tabControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  padding: '0 0 12px 0'
}

const stickyTabControlsWrapStyle: React.CSSProperties = {
  position: 'sticky',
  top: '112px',
  zIndex: 4,
  background: 'color-mix(in srgb, var(--bg-primary) 94%, transparent)',
  backdropFilter: 'blur(10px)'
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    ...btnStyle,
    background: 'var(--bg-card-hover)',
    color: 'var(--text-primary)',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'default' : 'pointer'
  }
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

const infoBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  marginBottom: '12px',
  padding: '10px 14px',
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  flexWrap: 'wrap'
}

const bulkToggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '0 4px'
}

const leftoverCardStyle: React.CSSProperties = {
  display: 'block',
  padding: '14px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  cursor: 'pointer'
}

const stickyActionBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 14px',
  background: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow)',
  flexWrap: 'wrap'
}

const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--text-muted)',
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)'
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: '999px',
      background: `${color}20`,
      color,
      whiteSpace: 'nowrap'
    }}>
      {text}
    </span>
  )
}

function PageTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        border: 'none',
        borderRadius: '6px',
        background: active ? 'var(--accent-blue)' : 'transparent',
        color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {children}
    </button>
  )
}
