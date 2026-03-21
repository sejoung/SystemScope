import { beforeEach, describe, expect, it } from 'vitest'
import {
  addSystemSubscriber,
  getSystemSubscriberIds,
  hasSystemSubscribers,
  removeSystemSubscriber,
  resetSystemSubscribers,
  retainSystemSubscribers
} from '../../src/main/ipc/systemSubscriptions'

describe('systemSubscriptions', () => {
  beforeEach(() => {
    resetSystemSubscribers()
  })

  it('should keep updates active while at least one subscriber remains', () => {
    addSystemSubscriber(101)
    addSystemSubscriber(202)

    expect(hasSystemSubscribers()).toBe(true)
    expect(removeSystemSubscriber(101)).toBe(1)
    expect(hasSystemSubscribers()).toBe(true)
    expect(getSystemSubscriberIds()).toEqual([202])
  })

  it('should stop being active when the last subscriber is removed', () => {
    addSystemSubscriber(101)

    expect(removeSystemSubscriber(101)).toBe(0)
    expect(hasSystemSubscribers()).toBe(false)
  })

  it('should ignore duplicate subscribe calls for the same webContents', () => {
    addSystemSubscriber(101)
    addSystemSubscriber(101)

    expect(getSystemSubscriberIds()).toEqual([101])
  })

  it('should drop stale subscribers that are no longer active', () => {
    addSystemSubscriber(101)
    addSystemSubscriber(202)
    addSystemSubscriber(303)

    expect(retainSystemSubscribers([202, 303])).toBe(2)
    expect(getSystemSubscriberIds()).toEqual([202, 303])
  })
})
