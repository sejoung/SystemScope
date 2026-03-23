import { beforeEach, describe, expect, it, vi } from 'vitest'

const runExternalCommand = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/services/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => {
    return Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>)
  }
}))

describe('dockerImages service', () => {
  beforeEach(() => {
    vi.resetModules()
    runExternalCommand.mockReset()
  })

  it('should classify docker unavailable states when CLI is missing', async () => {
    runExternalCommand.mockRejectedValue({
      kind: 'command_not_found',
      code: 'ENOENT',
      message: 'spawn docker ENOENT',
      stdout: '',
      stderr: ''
    })

    const { listDockerImages } = await import('../../src/main/services/dockerImages')
    const result = await listDockerImages()

    expect(result.status).toBe('not_installed')
    expect(result.images).toEqual([])
    expect(result.message).toContain('Docker is not installed')
  })

  it('should return a friendly message when docker daemon is unavailable', async () => {
    runExternalCommand.mockRejectedValue(new Error('failed to connect to the docker API at unix:///Users/test/.docker/run/docker.sock'))

    const { listDockerImages } = await import('../../src/main/services/dockerImages')
    const result = await listDockerImages()

    expect(result.status).toBe('daemon_unavailable')
    expect(result.images).toEqual([])
    expect(result.message).toContain('not currently running')
  })

  it('should parse images and mark in-use containers', async () => {
    runExternalCommand.mockImplementation(async (_file: string, args: string[]) => {
      const joined = args.join(' ')
      if (joined.startsWith('image ls')) {
        return { stdout: [
          '{"ID":"sha256:abc1234567890","Repository":"node","Tag":"20","Size":"1.2GB","CreatedAt":"2026-03-20","CreatedSince":"2 days ago"}',
          '{"ID":"sha256:def1234567890","Repository":"<none>","Tag":"<none>","Size":"120MB","CreatedAt":"2026-03-18","CreatedSince":"4 days ago"}'
        ].join('\n'), stderr: '' }
      }
      if (joined.startsWith('ps -a')) {
        return { stdout: '{"ImageID":"sha256:abc1234567890","Names":"web-app"}', stderr: '' }
      }
      throw new Error(`unexpected args: ${joined}`)
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
    runExternalCommand.mockImplementation(async (_file: string, args: string[]) => {
      const joined = args.join(' ')
      if (joined.startsWith('ps -a --size')) {
        return {
          stdout: [
            '{"ID":"1234567890ab","ImageID":"sha256:abc","Image":"node:20","Command":"npm run dev","Status":"Up 2 hours","RunningFor":"2 hours ago","Names":"web","Ports":"0.0.0.0:3000->3000/tcp","Size":"12.3MB (virtual 1.2GB)"}',
            '{"ID":"abcdef123456","ImageID":"sha256:def","Image":"postgres:16","Command":"postgres","Status":"Exited (0) 3 days ago","RunningFor":"3 days ago","Names":"db-old","Ports":"","Size":"0B"}'
          ].join('\n'),
          stderr: ''
        }
      }
      throw new Error(`unexpected args: ${joined}`)
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

  it('should parse volumes and mark in-use state from mounts', async () => {
    runExternalCommand.mockImplementation(async (_file: string, args: string[]) => {
      const joined = args.join(' ')
      if (joined.startsWith('volume ls')) {
        return {
          stdout: [
            '{"Name":"pgdata","Driver":"local","Mountpoint":"/var/lib/docker/volumes/pgdata/_data"}',
            '{"Name":"unused-cache","Driver":"local","Mountpoint":"/var/lib/docker/volumes/unused-cache/_data"}'
          ].join('\n'),
          stderr: ''
        }
      }
      if (joined.startsWith('ps -a --format')) {
        return { stdout: '{"Names":"db","Mounts":"pgdata"}', stderr: '' }
      }
      throw new Error(`unexpected args: ${joined}`)
    })

    const { listDockerVolumes } = await import('../../src/main/services/dockerImages')
    const result = await listDockerVolumes()

    expect(result.status).toBe('ready')
    expect(result.volumes).toHaveLength(2)
    expect(result.volumes[0]).toMatchObject({ name: 'unused-cache', inUse: false })
    expect(result.volumes[1]).toMatchObject({ name: 'pgdata', inUse: true, containers: ['db'] })
  })

  it('should parse build cache summary', async () => {
    runExternalCommand.mockImplementation(async (_file: string, args: string[]) => {
      const joined = args.join(' ')
      if (joined.startsWith('system df')) {
        return {
          stdout: [
            '{"Type":"Images","TotalCount":"10","Active":"4","Size":"12.4GB","Reclaimable":"2.1GB (16%)"}',
            '{"Type":"Build Cache","TotalCount":"18","Active":"2","Size":"3.5GB","Reclaimable":"2.9GB (82%)"}'
          ].join('\n'),
          stderr: ''
        }
      }
      throw new Error(`unexpected args: ${joined}`)
    })

    const { getDockerBuildCache } = await import('../../src/main/services/dockerImages')
    const result = await getDockerBuildCache()

    expect(result.status).toBe('ready')
    expect(result.summary).toMatchObject({
      totalCount: 18,
      activeCount: 2,
      sizeLabel: '3.5 GB',
      reclaimableLabel: '2.9 GB'
    })
  })
})
