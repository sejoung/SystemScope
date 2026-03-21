import { create } from 'zustand'
import type { Alert } from '@shared/types'

interface AlertState {
  alerts: Alert[]
  addAlerts: (newAlerts: Alert[]) => void
  dismissAlert: (id: string) => void
  setAlerts: (alerts: Alert[]) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],

  addAlerts: (newAlerts) =>
    set((state) => ({
      alerts: [...newAlerts, ...state.alerts].slice(0, 100)
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
    })),

  setAlerts: (alerts) => set({ alerts })
}))
