import { beforeEach, describe, expect, it, vi } from 'vitest'

const execFile = vi.hoisted(() => vi.fn())

vi.mock('child_process', () => ({
  execFile
}))

describe('dockerImages service', () => {
  beforeEach(() => {
    vi.resetModules()
    execFile.mockReset()
  })

  it('should classify docker unavailable states when CLI is missing', async () => {
    execFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error) => void
      callback(Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' }))
    })

    const { listDockerImages } = await import('../../src/main/services/dockerImages')
    const result = await listDockerImages()

    expect(result.status).toBe('not_installed')
    expect(result.images).toEqual([])
    expect(result.message).toContain('Docker가 설치되어 있지 않습니다')
  })

  it('should return a friendly message when docker daemon is unavailable', async () => {
    execFile.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error) => void
      callback(new Error('failed to connect to the docker API at unix:///Users/test/.docker/run/docker.sock'))
    })

    const { listDockerImages } = await import('../../src/main/services/dockerImages')
    const result = await listDockerImages()

    expect(result.status).toBe('daemon_unavailable')
    expect(result.images).toEqual([])
    expect(result.message).toContain('현재 실행 중이 아닙니다')
  })

  it('should parse images and mark in-use containers', async () => {
    execFile.mockImplementation((...callArgs: unknown[]) => {
      const file = callArgs[0] as string
      const args = callArgs[1] as string[]
      const callback = callArgs[callArgs.length - 1] as (error: Error | null, stdout?: string, stderr?: string) => void
      const joined = Array.isArray(args) ? args.join(' ') : ''
      if (joined.startsWith('image ls')) {
        callback(null, [
          '{"ID":"sha256:abc1234567890","Repository":"node","Tag":"20","Size":"1.2GB","CreatedAt":"2026-03-20","CreatedSince":"2 days ago"}',
          '{"ID":"sha256:def1234567890","Repository":"<none>","Tag":"<none>","Size":"120MB","CreatedAt":"2026-03-18","CreatedSince":"4 days ago"}'
        ].join('\n'), '')
        return
      }
      if (joined.startsWith('ps -a')) {
        callback(null, '{"ImageID":"sha256:abc1234567890","Names":"web-app"}', '')
        return
      }
      callback(new Error(`unexpected args: ${file} ${joined}`))
    })

    const { listDockerImages } = await import('../../src/main/services/dockerImages')
    const result = await listDockerImages()

    expect(result.status).toBe('ready')
    expect(result.images).toHaveLength(2)
    expect(result.images[0]).toMatchObject({
      repository: 'node',
      tag: '20',
      inUse: true,
      dangling: false
    })
    expect(result.images[1]).toMatchObject({
      repository: '<none>',
      tag: '<none>',
      inUse: false,
      dangling: true
    })
  })

  it('should parse containers and mark running state', async () => {
    execFile.mockImplementation((...callArgs: unknown[]) => {
      const args = callArgs[1] as string[]
      const callback = callArgs[callArgs.length - 1] as (error: Error | null, stdout?: string, stderr?: string) => void
      const joined = Array.isArray(args) ? args.join(' ') : ''
      if (joined.startsWith('ps -a --size')) {
        callback(
          null,
          [
            '{"ID":"1234567890ab","ImageID":"sha256:abc","Image":"node:20","Command":"npm run dev","Status":"Up 2 hours","RunningFor":"2 hours ago","Names":"web","Ports":"0.0.0.0:3000->3000/tcp","Size":"12.3MB (virtual 1.2GB)"}',
            '{"ID":"abcdef123456","ImageID":"sha256:def","Image":"postgres:16","Command":"postgres","Status":"Exited (0) 3 days ago","RunningFor":"3 days ago","Names":"db-old","Ports":"","Size":"0B"}'
          ].join('\n'),
          ''
        )
        return
      }
      callback(new Error(`unexpected args: ${joined}`))
    })

    const { listDockerContainers } = await import('../../src/main/services/dockerImages')
    const result = await listDockerContainers()

    expect(result.status).toBe('ready')
    expect(result.containers).toHaveLength(2)
    expect(result.containers[0]).toMatchObject({
      name: 'web',
      image: 'node:20',
      running: true
    })
    expect(result.containers[1]).toMatchObject({
      name: 'db-old',
      running: false
    })
  })
})
