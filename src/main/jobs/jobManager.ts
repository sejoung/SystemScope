import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'

export interface Job {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentStep: string
  abortController: AbortController
}

const jobs = new Map<string, Job>()
let jobCounter = 0

export function createJob(type: string): Job {
  const id = `job-${++jobCounter}-${Date.now()}`
  const job: Job = {
    id,
    type,
    status: 'pending',
    progress: 0,
    currentStep: '',
    abortController: new AbortController()
  }
  jobs.set(id, job)
  return job
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id)
  if (!job || job.status !== 'running') return false
  job.abortController.abort()
  job.status = 'cancelled'
  return true
}

export function sendJobProgress(win: BrowserWindow, job: Job, progress: number, step: string): void {
  job.progress = progress
  job.currentStep = step
  win.webContents.send(IPC_CHANNELS.JOB_PROGRESS, {
    id: job.id,
    progress,
    currentStep: step
  })
}

export function sendJobCompleted(win: BrowserWindow, job: Job, data: unknown): void {
  job.status = 'completed'
  job.progress = 100
  win.webContents.send(IPC_CHANNELS.JOB_COMPLETED, {
    id: job.id,
    data
  })
}

export function sendJobFailed(win: BrowserWindow, job: Job, error: string): void {
  job.status = 'failed'
  win.webContents.send(IPC_CHANNELS.JOB_FAILED, {
    id: job.id,
    error
  })
}
