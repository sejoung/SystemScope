import { useEffect, useMemo, useState } from 'react'
import { useStartupStore } from '../../stores/useStartupStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'
import type { StartupItem } from '@shared/types'

const TYPE_LABELS: Record<string, string> = {
  launch_agent: 'Launch Agent',
  launch_daemon: 'Launch Daemon',
  login_item: 'Login Item',
  registry_run: 'Registry',
  startup_folder: 'Startup Folder',
}

const SCOPE_COLORS: Record<string, string> = {
  user: 'var(--accent-blue)',
  system: 'var(--accent-yellow)',
}

export function StartupItemList() {
  const { tk } = useI18n()
  const items = useStartupStore((s) => s.items)
  const loading = useStartupStore((s) => s.loading)
  const error = useStartupStore((s) => s.error)
  const fetchItems = useStartupStore((s) => s.fetchItems)
  const toggleItem = useStartupStore((s) => s.toggleItem)
  const showToast = useToast((s) => s.show)
  const [search, setSearch] = useState('')

  useEffect(() => { void fetchItems() }, [fetchItems])

  const handleToggle = async (item: StartupItem) => {
    const ok = await toggleItem(item.id, !item.enabled)
    if (ok) {
      showToast(tk(item.enabled ? 'Startup item disabled.' : 'Startup item enabled.'))
    } else {
      showToast(tk('Failed to toggle startup item.'), 'danger')
    }
  }

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q),
    )
  }, [items, search])

  if (loading && items.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tk('Loading...')}</p>
  }

  if (error) {
    return <p style={{ fontSize: 13, color: 'var(--accent-red)' }}>{error}</p>
  }

  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tk('No startup items found.')}</p>
  }

  const userItems = filteredItems.filter((i) => i.scope === 'user')
  const systemItems = filteredItems.filter((i) => i.scope === 'system')

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tk('startup.search_placeholder')}
            aria-label={tk('startup.search_placeholder')}
            style={{ ...searchInputStyle, paddingRight: 30 }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={tk('Clear search')}
              style={{
                position: 'absolute',
                right: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 2px',
              }}
            >
              &times;
            </button>
          )}
        </div>
        {search.trim() && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {filteredItems.length > 0
              ? tk('startup.search_results', { count: filteredItems.length })
              : tk('startup.search_no_results', { query: search })}
          </span>
        )}
      </div>

      {userItems.length > 0 && (
        <ItemGroup title={tk('User')} items={userItems} onToggle={handleToggle} />
      )}
      {systemItems.length > 0 && (
        <ItemGroup title={tk('System')} items={systemItems} onToggle={handleToggle} />
      )}
      {filteredItems.length === 0 && search.trim() && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
          {tk('startup.search_no_results', { query: search })}
        </p>
      )}
    </div>
  )
}

const searchInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '13px',
  width: '240px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none',
}

function ItemGroup({ title, items, onToggle }: { title: string; items: StartupItem[]; onToggle: (item: StartupItem) => void }) {
  return (
    <div>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
        {title} ({items.length})
      </h4>
      <div style={{ display: 'grid', gap: 4 }}>
        {items.map((item) => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)',
            opacity: item.enabled ? 1 : 0.6,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  backgroundColor: 'var(--bg-tertiary)', color: SCOPE_COLORS[item.scope] ?? 'var(--text-secondary)',
                  fontWeight: 600,
                }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
              </div>
              {item.description && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.description}
                </div>
              )}
            </div>
            <button
              onClick={() => onToggle(item)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, marginLeft: 8,
                backgroundColor: item.enabled ? 'var(--bg-card)' : 'color-mix(in srgb, var(--accent-green) 15%, var(--bg-card))',
                color: item.enabled ? 'var(--text-secondary)' : 'var(--accent-green)',
              }}
            >
              {item.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
