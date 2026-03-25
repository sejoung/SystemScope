import { create } from 'zustand'
import type { PortInfo } from '@shared/types'

export interface WatchEntry {
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
  statuses: Record<string, WatchStatus>
  history: HistoryEntry[]
  monitoring: boolean
  pollInterval: number
  expandedWatch: Record<string, true>
  watchFilters: Record<string, string>
  prevMatched: Record<string, boolean>

  addWatch: (entry: WatchEntry) => void
  removeWatch: (id: string) => void
  setStatuses: (statuses: Record<string, WatchStatus>) => void
  addHistory: (entries: HistoryEntry[]) => void
  clearHistory: () => void
  setMonitoring: (val: boolean) => void
  setPollInterval: (ms: number) => void
  toggleExpanded: (id: string) => void
  setWatchFilter: (id: string, filter: string) => void
  setPrevMatched: (id: string, matched: boolean) => void
}

export const usePortWatchStore = create<PortWatchState>((set) => ({
  watches: [],
  statuses: {},
  history: [],
  monitoring: false,
  pollInterval: 2000,
  expandedWatch: {},
  watchFilters: {},
  prevMatched: {},

  addWatch: (entry) => set((s) => {
    if (s.watches.some((w) => w.pattern === entry.pattern)) return s
    return { watches: [...s.watches, entry], monitoring: true }
  }),

  removeWatch: (id) => set((s) => {
    const statuses = { ...s.statuses }
    const expandedWatch = { ...s.expandedWatch }
    const watchFilters = { ...s.watchFilters }
    const prevMatched = { ...s.prevMatched }
    delete statuses[id]
    delete expandedWatch[id]
    delete watchFilters[id]
    delete prevMatched[id]
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
    if (s.expandedWatch[id]) {
      const next = { ...s.expandedWatch }
      delete next[id]
      return { expandedWatch: next }
    }
    return { expandedWatch: { ...s.expandedWatch, [id]: true } }
  }),

  setWatchFilter: (id, filter) => set((s) => {
    const current = s.watchFilters[id] ?? 'all'
    return { watchFilters: { ...s.watchFilters, [id]: filter === current ? 'all' : filter } }
  }),

  setPrevMatched: (id, matched) => set((s) => ({
    prevMatched: { ...s.prevMatched, [id]: matched }
  }))
}))
