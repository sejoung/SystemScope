import { create } from 'zustand'
import type { SystemStats } from '@shared/types'
import { HISTORY_MAX_POINTS } from '@shared/constants/intervals'

interface SystemState {
  current: SystemStats | null
  history: SystemStats[]
  pushStats: (stats: SystemStats) => void
}

function createRingBuffer() {
  const buffer: SystemStats[] = []
  let index = 0
  let size = 0

  return function push(stats: SystemStats): SystemStats[] {
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
  }
}

const pushToRing = createRingBuffer()

export const useSystemStore = create<SystemState>((set) => ({
  current: null,
  history: [],

  pushStats: (stats) =>
    set(() => {
      const history = pushToRing(stats)
      return { current: stats, history }
    })
}))
