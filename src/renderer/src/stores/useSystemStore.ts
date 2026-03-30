import { create } from 'zustand'
import type { SystemStats } from '@shared/types'
import { HISTORY_MAX_POINTS } from '@shared/constants/intervals'

interface RingBuffer {
  push: (stats: SystemStats) => SystemStats[]
  reset: () => void
}

interface SystemState {
  current: SystemStats | null
  history: SystemStats[]
  pushStats: (stats: SystemStats) => void
  reset: () => void
}

function createRingBuffer(): RingBuffer {
  let buffer: SystemStats[] = []
  let index = 0
  let size = 0

  return {
    push(stats: SystemStats): SystemStats[] {
      if (size < HISTORY_MAX_POINTS) {
        buffer.push(stats)
        size++
      } else {
        buffer[index] = stats
        index = (index + 1) % HISTORY_MAX_POINTS
      }
      // Zustand 구독을 위해 올바른 순서의 새 배열 참조 생성
      if (size < HISTORY_MAX_POINTS) {
        return buffer.slice()
      }
      return [
        ...buffer.slice(index),
        ...buffer.slice(0, index)
      ]
    },
    reset() {
      buffer = []
      index = 0
      size = 0
    }
  }
}

const ringBuffer = createRingBuffer()

export const useSystemStore = create<SystemState>((set) => ({
  current: null,
  history: [],

  pushStats: (stats) =>
    set(() => {
      const history = ringBuffer.push(stats)
      return { current: stats, history }
    }),

  reset: () => {
    ringBuffer.reset()
    set({ current: null, history: [] })
  }
}))
