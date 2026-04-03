import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortInfo, ProcessInfo } from '../../src/shared/types'

const runExternalCommand = vi.hoisted(() => vi.fn())
const getNetworkPorts = vi.hoisted(() => vi.fn())
const getAllProcesses = vi.hoisted(() => vi.fn())

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

vi.mock('../../src/main/services/profileManager', () => ({
  getActiveProfile: () => null,
}))

import { detectDevServerKind, detectDevServers, getDevToolsOverview, summarizeGitStatusLines } from '../../src/main/services/devToolsOverview'

describe('devToolsOverview helpers', () => {
  beforeEach(() => {
    runExternalCommand.mockReset()
    getNetworkPorts.mockReset()
    getAllProcesses.mockReset()
    getNetworkPorts.mockResolvedValue([])
    getAllProcesses.mockResolvedValue([])
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
  })
})
