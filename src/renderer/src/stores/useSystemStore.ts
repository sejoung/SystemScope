import { create } from 'zustand'
import type { SystemStats } from '@shared/types'
import { HISTORY_MAX_POINTS } from '@shared/constants/intervals'

interface SystemState {
  current: SystemStats | null
  history: SystemStats[]
  pushStats: (stats: SystemStats) => void
}

// Ring buffer: 내부 배열을 mutate하고 새 참조만 생성
const ringBuffer: SystemStats[] = []
let ringIndex = 0
let ringSize = 0

function pushToRing(stats: SystemStats): SystemStats[] {
  if (ringSize < HISTORY_MAX_POINTS) {
    ringBuffer.push(stats)
    ringSize++
  } else {
    ringBuffer[ringIndex] = stats
    ringIndex = (ringIndex + 1) % HISTORY_MAX_POINTS
  }
  // Zustand 구독을 위해 올바른 순서의 새 배열 참조 생성
  if (ringSize < HISTORY_MAX_POINTS) {
    return ringBuffer.slice()
  }
  return [
    ...ringBuffer.slice(ringIndex),
    ...ringBuffer.slice(0, ringIndex)
  ]
}

export const useSystemStore = create<SystemState>((set) => ({
  current: null,
  history: [],

  pushStats: (stats) =>
    set(() => {
      const history = pushToRing(stats)
      return { current: stats, history }
    })
}))
