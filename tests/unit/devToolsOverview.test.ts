import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { PortInfo, ProcessInfo } from '../../src/shared/types'

const runExternalCommand = vi.hoisted(() => vi.fn())
const getNetworkPorts = vi.hoisted(() => vi.fn())
const getAllProcesses = vi.hoisted(() => vi.fn())
const listDockerContainers = vi.hoisted(() => vi.fn())
const listDockerImages = vi.hoisted(() => vi.fn())
const listDockerVolumes = vi.hoisted(() => vi.fn())
const getDockerBuildCache = vi.hoisted(() => vi.fn())
const getActiveProfile = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/services/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => {
    return Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>)
  },
}))

vi.mock('../../src/main/services/processMonitor', () => ({
  getNetworkPorts,
  getAllProcesses,
}))

vi.mock('../../src/main/services/dockerImages', () => ({
  listDockerContainers,
  listDockerImages,
  listDockerVolumes,
  getDockerBuildCache,
}))

vi.mock('../../src/main/services/profileManager', () => ({
  getActiveProfile,
}))

import {
  detectDevServerKind,
  detectDevServers,
  getDevToolsOverview,
  resetDevToolsOverviewCacheForTest,
  summarizeGitStatusLines,
} from '../../src/main/services/devToolsOverview'

describe('devToolsOverview helpers', () => {
  beforeEach(() => {
    resetDevToolsOverviewCacheForTest()
    runExternalCommand.mockReset()
    getNetworkPorts.mockReset()
    getAllProcesses.mockReset()
    listDockerContainers.mockReset()
    listDockerImages.mockReset()
    listDockerVolumes.mockReset()
    getDockerBuildCache.mockReset()
    getActiveProfile.mockReset()
    getNetworkPorts.mockResolvedValue([])
    getAllProcesses.mockResolvedValue([])
    getActiveProfile.mockReturnValue(null)
    listDockerContainers.mockResolvedValue({ status: 'ready', containers: [], message: null })
    listDockerImages.mockResolvedValue({ status: 'ready', images: [], message: null })
    listDockerVolumes.mockResolvedValue({ status: 'ready', volumes: [], message: null })
    getDockerBuildCache.mockResolvedValue({
      status: 'ready',
      summary: {
        totalCount: 0,
        activeCount: 0,
        sizeBytes: 0,
        sizeLabel: '0 B',
        reclaimableBytes: 0,
        reclaimableLabel: '0 B',
      },
      message: null,
    })
  })

  it('summarizes git porcelain lines', () => {
    expect(
      summarizeGitStatusLines([
        ' M src/app.ts',
        '?? coverage/report.html',
        'A  src/new-file.ts',
        '?? dist/build.log',
      ]),
    ).toEqual({
      dirtyFileCount: 2,
      untrackedFiles: ['coverage/report.html', 'dist/build.log'],
    })
  })

  it('classifies common development server kinds', () => {
    const port: PortInfo = {
      protocol: 'tcp',
      localAddress: '127.0.0.1',
      localPort: '5173',
      peerAddress: '',
      peerPort: '*',
      state: 'LISTEN',
      pid: 300,
      process: 'node',
      localPortNum: 5173,
    }
    const processInfo: ProcessInfo = {
      pid: 300,
      name: 'node',
      cpu: 0,
      memory: 0,
      memoryBytes: 0,
      command: 'node ./node_modules/vite/bin/vite.js',
    }

    expect(detectDevServerKind(port, processInfo)).toBe('Vite')
  })

  it('attaches workspace matches to detected development servers', () => {
    const ports: PortInfo[] = [
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '3000',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 101,
        process: 'node',
        localPortNum: 3000,
      },
    ]
    const processes: ProcessInfo[] = [
      {
        pid: 101,
        name: 'node',
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: '/Users/test/work/app/node_modules/.bin/next dev',
      },
    ]

    const result = detectDevServers(ports, processes, ['/Users/test/work/app'])
    expect(result).toHaveLength(1)
    expect(result[0]?.workspaceName).toBe('app')
    expect(result[0]?.kind).toBe('Next.js')
  })

  it('includes Java in environment health checks and reads version output from stderr', async () => {
    runExternalCommand.mockImplementation(async (command: string) => {
      if (command === 'java') {
        return {
          stdout: '',
          stderr: 'openjdk version "21.0.2" 2024-01-16',
        }
      }

      return {
        stdout: `${command} 1.0.0`,
        stderr: '',
      }
    })

    const result = await getDevToolsOverview()
    const javaCheck = result.healthChecks.find((entry) => entry.id === 'java')

    expect(javaCheck).toEqual(expect.objectContaining({
      id: 'java',
      label: 'Java',
      status: 'healthy',
      version: 'openjdk version "21.0.2" 2024-01-16',
    }))
    expect(result.docker).toEqual(expect.objectContaining({
      status: 'healthy',
      runningContainers: 0,
      reclaimableBuildCacheLabel: '0 B',
    }))
  })

  it('marks docker summary missing when Docker is not installed', async () => {
    runExternalCommand.mockResolvedValue({ stdout: 'tool 1.0.0', stderr: '' })
    listDockerContainers.mockResolvedValue({ status: 'not_installed', containers: [], message: 'Docker not installed' })
    listDockerImages.mockResolvedValue({ status: 'not_installed', images: [], message: 'Docker not installed' })
    listDockerVolumes.mockResolvedValue({ status: 'not_installed', volumes: [], message: 'Docker not installed' })
    getDockerBuildCache.mockResolvedValue({ status: 'not_installed', summary: null, message: 'Docker not installed' })

    const result = await getDevToolsOverview()

    expect(result.healthChecks.find((entry) => entry.id === 'docker')).toEqual(expect.objectContaining({
      label: 'Docker CLI',
      status: 'healthy',
    }))
    expect(result.docker).toEqual(expect.objectContaining({
      status: 'missing',
      detail: 'Docker is not installed.',
      hint: 'Docker not installed',
    }))
  })

  it('marks docker summary warning when Docker daemon is unavailable', async () => {
    runExternalCommand.mockResolvedValue({ stdout: 'tool 1.0.0', stderr: '' })
    listDockerContainers.mockResolvedValue({
      status: 'daemon_unavailable',
      containers: [],
      message: 'Docker is installed but not currently running.',
    })

    const result = await getDevToolsOverview()

    expect(result.docker).toEqual(expect.objectContaining({
      status: 'warning',
      detail: 'Docker needs attention.',
      hint: 'Docker is installed but not currently running.',
    }))
  })

  it('counts reclaimable docker resources when scans are ready', async () => {
    runExternalCommand.mockResolvedValue({ stdout: 'tool 1.0.0', stderr: '' })
    listDockerContainers.mockResolvedValue({
      status: 'ready',
      containers: [
        { id: '1', shortId: '1', name: 'api', image: 'api:latest', command: '', status: 'Up', ports: '', sizeBytes: 0, running: true },
        { id: '2', shortId: '2', name: 'db', image: 'postgres:16', command: '', status: 'Exited', ports: '', sizeBytes: 0, running: false },
      ],
      message: null,
    })
    listDockerImages.mockResolvedValue({
      status: 'ready',
      images: [
        { id: 'img1', shortId: 'img1', repository: 'api', tag: 'latest', sizeBytes: 100, sizeLabel: '100 B', createdSince: '1d', inUse: true, dangling: false, containers: [] },
        { id: 'img2', shortId: 'img2', repository: '<none>', tag: '<none>', sizeBytes: 200, sizeLabel: '200 B', createdSince: '1d', inUse: false, dangling: true, containers: [] },
      ],
      message: null,
    })
    listDockerVolumes.mockResolvedValue({
      status: 'ready',
      volumes: [
        { name: 'used', driver: 'local', mountpoint: '/tmp/used', inUse: true, containers: ['api'] },
        { name: 'unused', driver: 'local', mountpoint: '/tmp/unused', inUse: false, containers: [] },
      ],
      message: null,
    })
    getDockerBuildCache.mockResolvedValue({
      status: 'ready',
      summary: {
        totalCount: 2,
        activeCount: 1,
        sizeBytes: 500,
        sizeLabel: '500 B',
        reclaimableBytes: 300,
        reclaimableLabel: '300 B',
      },
      message: null,
    })

    const result = await getDevToolsOverview()

    expect(result.docker).toEqual(expect.objectContaining({
      status: 'healthy',
      runningContainers: 1,
      stoppedContainers: 1,
      unusedImages: 1,
      unusedVolumes: 1,
      reclaimableBuildCacheBytes: 300,
      reclaimableBuildCacheLabel: '300 B',
    }))
  })

  it('collects workspace environment signals, artifact folders, and matched dev server ports', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-devtools-'))
    await fs.writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"demo"}')
    await fs.writeFile(path.join(workspaceRoot, 'tsconfig.json'), '{}')
    await fs.writeFile(path.join(workspaceRoot, '.env.local'), 'PORT=3000')
    await fs.writeFile(path.join(workspaceRoot, 'vite.config.ts'), 'export default {}')
    await fs.writeFile(path.join(workspaceRoot, 'Dockerfile'), 'FROM node:20')
    await fs.mkdir(path.join(workspaceRoot, 'node_modules'))
    await fs.mkdir(path.join(workspaceRoot, 'dist'))

    getActiveProfile.mockReturnValue({
      id: 'profile-1',
      workspacePaths: [workspaceRoot],
    })
    getNetworkPorts.mockResolvedValue([
      {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '5173',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 3100,
        process: 'node',
        localPortNum: 5173,
      },
    ])
    getAllProcesses.mockResolvedValue([
      {
        pid: 3100,
        name: 'node',
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: `${workspaceRoot}/node_modules/.bin/vite`,
      },
    ])
    runExternalCommand.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: `${workspaceRoot}\n`, stderr: '' }
      }
      if (command === 'git' && args[0] === 'branch') {
        return { stdout: 'main\n', stderr: '' }
      }
      if (command === 'git' && args[0] === 'status') {
        return { stdout: '?? coverage/report.html\n', stderr: '' }
      }
      if (command === 'git' && args[0] === 'stash') {
        return { stdout: '', stderr: '' }
      }
      if (command === 'git' && args[0] === 'log') {
        return { stdout: '1712200000\n', stderr: '' }
      }
      if (command === 'java') {
        return { stdout: '', stderr: 'openjdk version "21.0.2"' }
      }
      return { stdout: `${command} 1.0.0`, stderr: '' }
    })

    const result = await getDevToolsOverview()
    const workspace = result.workspaces[0]

    expect(workspace).toEqual(expect.objectContaining({
      path: workspaceRoot,
      hasEnvFile: true,
      hasDockerConfig: true,
      hasTypeScriptConfig: true,
      manifestCount: 1,
      artifactDirectories: expect.arrayContaining(['node_modules', 'dist']),
      stacks: expect.arrayContaining(['Vite', 'Node.js', 'Docker']),
      activeDevServerCount: 1,
      activeDevServerPorts: [5173],
    }))
    expect(result.devServers[0]).toEqual(expect.objectContaining({
      workspacePath: workspaceRoot,
      workspaceName: path.basename(workspaceRoot),
      kind: 'Vite',
    }))
  })
})
