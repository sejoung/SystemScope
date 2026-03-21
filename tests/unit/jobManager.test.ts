import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelJob,
  createJob,
  getJob,
  getJobCount,
  resetJobs,
  sendJobCompleted,
  sendJobFailed
} from '../../src/main/jobs/jobManager'

function makeWindow() {
  return {
    webContents: {
      send: vi.fn()
    }
  }
}

describe('jobManager', () => {
  beforeEach(() => {
    resetJobs()
  })

  it('should remove completed jobs from the registry', () => {
    const job = createJob('diskScan')
    const win = makeWindow()

    sendJobCompleted(win as never, job, { ok: true })

    expect(getJob(job.id)).toBeUndefined()
    expect(getJobCount()).toBe(0)
  })

  it('should remove failed jobs from the registry', () => {
    const job = createJob('diskScan')
    const win = makeWindow()

    sendJobFailed(win as never, job, 'failed')

    expect(getJob(job.id)).toBeUndefined()
    expect(getJobCount()).toBe(0)
  })

  it('should remove cancelled jobs from the registry', () => {
    const job = createJob('diskScan')
    job.status = 'running'

    expect(cancelJob(job.id)).toBe(true)
    expect(getJob(job.id)).toBeUndefined()
    expect(getJobCount()).toBe(0)
  })

  it('should not cancel jobs that are not running', () => {
    const job = createJob('diskScan')

    expect(cancelJob(job.id)).toBe(false)
    expect(getJob(job.id)).toBeDefined()
    expect(getJobCount()).toBe(1)
  })
})
