const subscribers = new Set<number>()

export function addSystemSubscriber(webContentsId: number): number {
  subscribers.add(webContentsId)
  return subscribers.size
}

export function removeSystemSubscriber(webContentsId: number): number {
  subscribers.delete(webContentsId)
  return subscribers.size
}

export function hasSystemSubscribers(): boolean {
  return subscribers.size > 0
}

export function getSystemSubscriberIds(): number[] {
  return Array.from(subscribers)
}

export function retainSystemSubscribers(activeIds: number[]): number {
  const activeSet = new Set(activeIds)
  for (const id of subscribers) {
    if (!activeSet.has(id)) {
      subscribers.delete(id)
    }
  }
  return subscribers.size
}

export function resetSystemSubscribers(): void {
  subscribers.clear()
}
