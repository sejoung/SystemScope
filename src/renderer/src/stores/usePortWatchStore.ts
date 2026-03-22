import { create } from 'zustand'
import type { PortInfo } from '@shared/types'

interface WatchEntry {
  id: string
  pattern: string
  type: 'port' | 'ip' | 'ip:port'
  scope: 'local' | 'remote' | 'all'
}

interface WatchStatus {
  id: string
  matched: boolean
  matches: PortInfo[]
  lastChecked: number
}

interface HistoryEntry {
  timestamp: number
  watchId: string
  pattern: string
  event: 'connected' | 'disconnected'
  process: string
  detail: string
}

interface PortWatchState {
  watches: WatchEntry[]
  statuses: Map<string, WatchStatus>
  history: HistoryEntry[]
  monitoring: boolean
  pollInterval: number
  expandedWatch: Set<string>
  watchFilters: Map<string, string>
  prevMatched: Map<string, boolean>

  addWatch: (entry: WatchEntry) => void
  removeWatch: (id: string) => void
  setStatuses: (statuses: Map<string, WatchStatus>) => void
  addHistory: (entries: HistoryEntry[]) => void
  clearHistory: () => void
  setMonitoring: (val: boolean) => void
  setPollInterval: (ms: number) => void
  toggleExpanded: (id: string) => void
  setWatchFilter: (id: string, filter: string) => void
  setPrevMatched: (id: string, matched: boolean) => void
}

export const usePortWatchStore = create<PortWatchState>((set, get) => ({
  watches: [],
  statuses: new Map(),
  history: [],
  monitoring: false,
  pollInterval: 2000,
  expandedWatch: new Set(),
  watchFilters: new Map(),
  prevMatched: new Map(),

  addWatch: (entry) => set((s) => {
    if (s.watches.some((w) => w.pattern === entry.pattern)) return s
    return { watches: [...s.watches, entry], monitoring: true }
  }),

  removeWatch: (id) => set((s) => {
    const statuses = new Map(s.statuses)
    statuses.delete(id)
    const expandedWatch = new Set(s.expandedWatch)
    expandedWatch.delete(id)
    const watchFilters = new Map(s.watchFilters)
    watchFilters.delete(id)
    const prevMatched = new Map(s.prevMatched)
    prevMatched.delete(id)
    return {
      watches: s.watches.filter((w) => w.id !== id),
      statuses, expandedWatch, watchFilters, prevMatched
    }
  }),

  setStatuses: (statuses) => set({ statuses }),

  addHistory: (entries) => set((s) => ({
    history: [...entries, ...s.history].slice(0, 100)
  })),

  clearHistory: () => set({ history: [] }),
  setMonitoring: (val) => set({ monitoring: val }),
  setPollInterval: (ms) => set({ pollInterval: ms }),

  toggleExpanded: (id) => set((s) => {
    const next = new Set(s.expandedWatch)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { expandedWatch: next }
  }),

  setWatchFilter: (id, filter) => set((s) => {
    const next = new Map(s.watchFilters)
    const current = next.get(id) ?? 'all'
    next.set(id, filter === current ? 'all' : filter)
    return { watchFilters: next }
  }),

  setPrevMatched: (id, matched) => set((s) => {
    const next = new Map(s.prevMatched)
    next.set(id, matched)
    return { prevMatched: next }
  })
}))

export type { WatchEntry, WatchStatus, HistoryEntry }
