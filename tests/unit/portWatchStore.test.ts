import { beforeEach, describe, expect, it } from 'vitest'
import { usePortWatchStore } from '../../src/renderer/src/stores/usePortWatchStore'

describe('usePortWatchStore', () => {
  beforeEach(() => {
    usePortWatchStore.setState({
      watches: [],
      statuses: {},
      history: [],
      monitoring: false,
      pollInterval: 2000,
      expandedWatch: {},
      watchFilters: {},
      prevMatched: {}
    })
  })

  it('should avoid duplicate watches and enable monitoring when first watch is added', () => {
    const entry = { id: 'w1', pattern: '3000', type: 'port' as const, scope: 'local' as const }

    usePortWatchStore.getState().addWatch(entry)
    usePortWatchStore.getState().addWatch({ ...entry, id: 'w2' })

    const state = usePortWatchStore.getState()
    expect(state.watches).toHaveLength(1)
    expect(state.monitoring).toBe(true)
  })

  it('should clean derived records when a watch is removed', () => {
    usePortWatchStore.setState({
      watches: [{ id: 'w1', pattern: '3000', type: 'port', scope: 'local' }],
      statuses: { w1: { id: 'w1', matched: true, matches: [], lastChecked: 1 } },
      expandedWatch: { w1: true },
      watchFilters: { w1: 'LISTEN' },
      prevMatched: { w1: true }
    })

    usePortWatchStore.getState().removeWatch('w1')
    const state = usePortWatchStore.getState()

    expect(state.watches).toHaveLength(0)
    expect(state.statuses).not.toHaveProperty('w1')
    expect(state.expandedWatch).not.toHaveProperty('w1')
    expect(state.watchFilters).not.toHaveProperty('w1')
    expect(state.prevMatched).not.toHaveProperty('w1')
  })

  it('should cap history at 100 entries', () => {
    const entries = Array.from({ length: 120 }, (_, index) => ({
      timestamp: index,
      watchId: `w${index}`,
      pattern: `${index}`,
      event: 'connected' as const,
      process: 'node',
      detail: 'detail'
    }))

    usePortWatchStore.getState().addHistory(entries)
    const state = usePortWatchStore.getState()

    expect(state.history).toHaveLength(100)
    expect(state.history[0].watchId).toBe('w0')
    expect(state.history.at(-1)?.watchId).toBe('w99')
  })
})
