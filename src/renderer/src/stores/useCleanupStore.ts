import { create } from 'zustand'
import type { CleanupInbox, CleanupRule, CleanupPreview, CleanupResult } from '@shared/types'
import { isCleanupInbox, isCleanupPreview, isCleanupResult } from '@shared/types'
import { reportRendererError } from '../utils/rendererLogging'

interface CleanupState {
  // Inbox
  inbox: CleanupInbox | null
  inboxLoading: boolean
  // Rules
  rules: CleanupRule[]
  rulesLoading: boolean
  // Preview
  preview: CleanupPreview | null
  previewLoading: boolean
  // Execution
  executing: boolean
  lastResult: CleanupResult | null

  fetchInbox: () => Promise<void>
  fetchRules: () => Promise<void>
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>
  updateRuleMinAge: (ruleId: string, minAgeDays: number) => Promise<void>
  runPreview: () => Promise<void>
  executeCleanup: (paths: string[]) => Promise<void>
  dismissItem: (path: string) => Promise<void>
}

export const useCleanupStore = create<CleanupState>((set, get) => ({
  inbox: null,
  inboxLoading: false,
  rules: [],
  rulesLoading: false,
  preview: null,
  previewLoading: false,
  executing: false,
  lastResult: null,

  fetchInbox: async () => {
    if (get().inboxLoading) return
    set({ inboxLoading: true })
    try {
      const res = await window.systemScope.getCleanupInbox()
      if (res.ok && res.data && isCleanupInbox(res.data)) {
        set({ inbox: res.data, inboxLoading: false })
      } else {
        void reportRendererError('cleanup-inbox', 'Failed to fetch cleanup inbox', { error: !res.ok ? res.error : 'unexpected' })
        set({ inboxLoading: false })
      }
    } catch (error) {
      void reportRendererError('cleanup-inbox', 'Failed to fetch cleanup inbox', { error })
      set({ inboxLoading: false })
    }
  },

  fetchRules: async () => {
    if (get().rulesLoading) return
    set({ rulesLoading: true })
    try {
      const res = await window.systemScope.getCleanupRules()
      if (res.ok && res.data && Array.isArray(res.data)) {
        set({ rules: res.data as CleanupRule[], rulesLoading: false })
      } else {
        void reportRendererError('cleanup-rules', 'Failed to fetch cleanup rules', { error: !res.ok ? res.error : 'unexpected' })
        set({ rulesLoading: false })
      }
    } catch (error) {
      void reportRendererError('cleanup-rules', 'Failed to fetch cleanup rules', { error })
      set({ rulesLoading: false })
    }
  },

  toggleRule: async (ruleId: string, enabled: boolean) => {
    const rule = get().rules.find((r) => r.id === ruleId)
    if (!rule) return
    // Optimistic update
    set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)) })
    try {
      const res = await window.systemScope.setCleanupRuleConfig({ id: rule.id, enabled, minAgeDays: rule.minAgeDays })
      if (!res.ok) {
        // Revert on failure
        set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, enabled: !enabled } : r)) })
        void reportRendererError('cleanup-rules', 'Failed to toggle cleanup rule', { error: !res.ok ? res.error : 'unexpected' })
      }
    } catch (error) {
      set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, enabled: !enabled } : r)) })
      void reportRendererError('cleanup-rules', 'Failed to toggle cleanup rule', { error })
    }
  },

  updateRuleMinAge: async (ruleId: string, minAgeDays: number) => {
    const rule = get().rules.find((r) => r.id === ruleId)
    if (!rule) return
    const prevAge = rule.minAgeDays
    // Optimistic update
    set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, minAgeDays } : r)) })
    try {
      const res = await window.systemScope.setCleanupRuleConfig({ id: rule.id, enabled: rule.enabled, minAgeDays })
      if (!res.ok) {
        set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, minAgeDays: prevAge } : r)) })
        void reportRendererError('cleanup-rules', 'Failed to update rule min age', { error: !res.ok ? res.error : 'unexpected' })
      }
    } catch (error) {
      set({ rules: get().rules.map((r) => (r.id === ruleId ? { ...r, minAgeDays: prevAge } : r)) })
      void reportRendererError('cleanup-rules', 'Failed to update rule min age', { error })
    }
  },

  runPreview: async () => {
    if (get().previewLoading) return
    set({ previewLoading: true })
    try {
      const res = await window.systemScope.previewCleanup()
      if (res.ok && res.data && isCleanupPreview(res.data)) {
        set({ preview: res.data, previewLoading: false })
      } else {
        void reportRendererError('cleanup-preview', 'Failed to run cleanup preview', { error: !res.ok ? res.error : 'unexpected' })
        set({ previewLoading: false })
      }
    } catch (error) {
      void reportRendererError('cleanup-preview', 'Failed to run cleanup preview', { error })
      set({ previewLoading: false })
    }
  },

  executeCleanup: async (paths: string[]) => {
    if (get().executing) return
    set({ executing: true })
    try {
      const res = await window.systemScope.executeCleanup(paths)
      if (res.ok && res.data && isCleanupResult(res.data)) {
        set({ lastResult: res.data, executing: false })
      } else {
        void reportRendererError('cleanup-execute', 'Failed to execute cleanup', { error: !res.ok ? res.error : 'unexpected' })
        set({ executing: false })
      }
    } catch (error) {
      void reportRendererError('cleanup-execute', 'Failed to execute cleanup', { error })
      set({ executing: false })
    }
  },

  dismissItem: async (path: string) => {
    const inbox = get().inbox
    if (!inbox) return
    // Optimistic removal
    const removedItem = inbox.items.find((item) => item.path === path)
    const newItems = inbox.items.filter((item) => item.path !== path)
    const newTotal = newItems.reduce((sum, item) => sum + item.size, 0)
    set({ inbox: { ...inbox, items: newItems, totalReclaimable: newTotal } })
    try {
      const res = await window.systemScope.dismissCleanupItem(path)
      if (!res.ok) {
        // Revert on failure
        if (removedItem) {
          set({ inbox })
        }
        void reportRendererError('cleanup-dismiss', 'Failed to dismiss cleanup item', { error: !res.ok ? res.error : 'unexpected' })
      }
    } catch (error) {
      if (removedItem) {
        set({ inbox })
      }
      void reportRendererError('cleanup-dismiss', 'Failed to dismiss cleanup item', { error })
    }
  },
}))
