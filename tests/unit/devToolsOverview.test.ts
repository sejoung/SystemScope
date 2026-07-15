import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortInfo, ProcessInfo } from '../../src/shared/types'

const runExternalCommand = vi.hoisted(() => vi.fn())
const getNetworkPorts = vi.hoisted(() => vi.fn())
const getAllProcesses = vi.hoisted(() => vi.fn())
const listDockerContainers = vi.hoisted(() => vi.fn())
const listDockerImages = vi.hoisted(() => vi.fn())
const listDockerVolumes = vi.hoisted(() => vi.fn())
const getDockerBuildCache = vi.hoisted(() => vi.fn())
const getActiveProfile = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/services/core/externalCommand', () => ({
  runExternalCommand,
  isExternalCommandError: (error: unknown) => {
    return Boolean(error) && typeof error === 'object' && 'kind' in (error as Record<string, unknown>)
  },
}))

vi.mock('../../src/main/services/process/processMonitor', () => ({
  getNetworkPorts,
  getAllProcesses,
}))

vi.mock('../../src/main/services/docker/dockerImages', () => ({
  listDockerContainers,
  listDockerImages,
  listDockerVolumes,
  getDockerBuildCache,
}))

vi.mock('../../src/main/services/profile/profileManager', () => ({
  getActiveProfile,
}))

import {
  detectDevServerKind,
  detectDevServers,
  resetDevToolsOverviewCacheForTest,
  summarizeGitStatusLines,
} from '../../src/main/services/devtools/devToolsOverview'

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
        ppid: 1,
        parentName: null,
        descendantCount: 0,
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: 'node ./node_modules/vite/bin/vite.js',
      }

      expect(detectDevServerKind(port, processInfo)).toBe('Vite')
    })

  it('classifies Python and JVM development server kinds', () => {
      const pythonPort: PortInfo = {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '8000',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 410,
        process: 'python',
        localPortNum: 8000,
      }
      const pythonProcess: ProcessInfo = {
        pid: 410,
        name: 'python',
        ppid: 1,
        parentName: null,
        descendantCount: 0,
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: 'python -m uvicorn app.main:app --reload',
      }
      const jvmPort: PortInfo = {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '8080',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 510,
        process: 'java',
        localPortNum: 8080,
      }
      const jvmProcess: ProcessInfo = {
        pid: 510,
        name: 'java',
        ppid: 1,
        parentName: null,
        descendantCount: 0,
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: 'java -jar build/libs/app.jar org.springframework.boot.loader.launch.JarLauncher',
      }

      expect(detectDevServerKind(pythonPort, pythonProcess)).toBe('FastAPI / Uvicorn')
      expect(detectDevServerKind(jvmPort, jvmProcess)).toBe('Spring Boot')
    })

  it('classifies Rust runtime commands beyond cargo run', () => {
      const rustPort: PortInfo = {
        protocol: 'tcp',
        localAddress: '127.0.0.1',
        localPort: '3000',
        peerAddress: '',
        peerPort: '*',
        state: 'LISTEN',
        pid: 610,
        process: 'api',
        localPortNum: 3000,
      }
      const targetProcess: ProcessInfo = {
        pid: 610,
        name: 'api',
        ppid: 1,
        parentName: null,
        descendantCount: 0,
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: '/Users/test/work/rust-api/target/debug/api',
      }
      const trunkProcess: ProcessInfo = {
        pid: 611,
        name: 'cargo',
        ppid: 1,
        parentName: null,
        descendantCount: 0,
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
        command: 'trunk serve --open',
      }

      expect(detectDevServerKind(rustPort, targetProcess)).toBe('Rust App')
      expect(detectDevServerKind(rustPort, trunkProcess)).toBe('Trunk')
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
          ppid: 1,
          parentName: null,
          descendantCount: 0,
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
})
