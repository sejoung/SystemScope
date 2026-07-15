import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

const state = vi.hoisted(() => ({ userDataPath: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.userDataPath } }))
vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => ({ history: { eventsRetentionDays: 30 } }),
}))
vi.mock('../../src/main/services/core/logging', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

describe('append-only history stores', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.useRealTimers()
    state.userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-history-'))
  })

  afterEach(async () => {
    vi.useRealTimers()
    await fs.rm(state.userDataPath, { recursive: true, force: true })
  })

  it('filters, limits, clears, and persists events as append-only records', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100)
    const store = await import('../../src/main/services/history/eventStore')
    await store.initEventStore()
    await store.recordEvent('system', 'info', 'first')
    vi.setSystemTime(200)
    await store.recordEvent('alert', 'warning', 'second')
    vi.setSystemTime(300)
    await store.recordEvent('system', 'error', 'third')

    expect((await store.getEventHistory({ category: 'system' })).map((event) => event.title)).toEqual(['third', 'first'])
    expect((await store.getEventHistory({ since: 150, until: 250 })).map((event) => event.title)).toEqual(['second'])
    expect((await store.getRecentEvents(1))[0].title).toBe('third')
    const logPath = path.join(state.userDataPath, 'data', 'events.ndjson')
    expect((await fs.readFile(logPath, 'utf-8')).trim().split('\n')).toHaveLength(3)

    await expect(store.clearEventHistory()).resolves.toBe(3)
    await expect(store.getEventHistory()).resolves.toEqual([])
    expect(await fs.readFile(logPath, 'utf-8')).toBe('')
  })

  it('migrates the legacy event JSON store exactly once', async () => {
    const dataDir = path.join(state.userDataPath, 'data')
    await fs.mkdir(dataDir, { recursive: true })
    const now = Date.now()
    await fs.writeFile(path.join(dataDir, 'events.json'), JSON.stringify({
      schemaVersion: 1,
      entries: [{ id: 'legacy', ts: now, category: 'system', severity: 'info', title: 'legacy event' }],
    }))

    const store = await import('../../src/main/services/history/eventStore')
    await store.initEventStore()
    await expect(store.getEventHistory()).resolves.toMatchObject([{ id: 'legacy', title: 'legacy event' }])
    await expect(fs.access(path.join(dataDir, 'events.json'))).rejects.toThrow()
    expect(await fs.readFile(path.join(dataDir, 'events.ndjson'), 'utf-8')).toContain('legacy event')
  })

  it('collapses fired/resolved alert updates and identifies repeated patterns', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const history = await import('../../src/main/services/alerts/alertHistory')
    await history.initAlertHistory()

    history.onAlertFired('cpu', 'warning', 'first')
    vi.setSystemTime(1_001_000)
    history.onAlertResolved('cpu')
    vi.setSystemTime(1_002_000)
    history.onAlertFired('cpu', 'critical', 'second')
    await vi.waitFor(async () => {
      expect(await history.getAlertHistory()).toHaveLength(2)
    })

    const entries = await history.getAlertHistory()
    expect(entries.find((entry) => entry.message === 'first')).toMatchObject({ resolvedAt: 1_001_000, durationMs: 1_000 })
    const intelligence = await history.getAlertIntelligence()
    expect(intelligence.activeAlerts).toHaveLength(1)
    expect(intelligence.patterns).toMatchObject([{ type: 'cpu', count: 2, period: '24h' }])
  })

  it('marks an unresolved alert as sustained only after five minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const history = await import('../../src/main/services/alerts/alertHistory')
    await history.initAlertHistory()
    history.onAlertFired('memory', 'warning', 'pressure')

    vi.setSystemTime(310_000)
    expect((await history.getAlertIntelligence()).sustainedAlerts).toHaveLength(0)
    vi.setSystemTime(310_001)
    expect((await history.getAlertIntelligence()).sustainedAlerts).toHaveLength(1)
  })
})
