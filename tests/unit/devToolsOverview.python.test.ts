import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

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
  getDevToolsOverview,
  resetDevToolsOverviewCacheForTest,
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

  it('reports missing PyTorch when the python probe says torch is not installed', async () => {
      runExternalCommand.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'git') return { stdout: '', stderr: '' }
        if (command === 'which' || command === 'where') {
          return { stdout: '/usr/bin/python3\n', stderr: '' }
        }
        if (command === 'python3' && args[0] === '--version') {
          return { stdout: 'Python 3.12.0', stderr: '' }
        }
        if (command === '/usr/bin/python3' && args[0] === '-c') {
          return { stdout: JSON.stringify({ ok: false, reason: 'missing' }) + '\n', stderr: '' }
        }
        if (command === 'java') return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        const err = Object.assign(new Error('not found'), { kind: 'command_not_found' })
        if (command === 'nvcc' || command === 'nvidia-smi') throw err
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()
      expect(result.healthChecks.find((entry) => entry.id === 'pytorch')).toEqual(
        expect.objectContaining({ status: 'missing', version: null }),
      )
    })

  it('detects workspace .venv with PyTorch installed', async () => {
      const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-pyenv-'))
      const interpreterSubpath = process.platform === 'win32'
        ? path.join('Scripts', 'python.exe')
        : path.join('bin', 'python')
      const venvDir = path.join(workspaceRoot, '.venv')
      const interpreterPath = path.join(venvDir, interpreterSubpath)
      await fs.mkdir(path.dirname(interpreterPath), { recursive: true })
      await fs.writeFile(interpreterPath, '#!/usr/bin/env python3\n', { mode: 0o755 })
      await fs.writeFile(path.join(workspaceRoot, 'pyproject.toml'), '[project]\nname="ml"')
      // Static metadata read instead of executing the interpreter (security).
      await fs.writeFile(path.join(venvDir, 'pyvenv.cfg'), 'home = /usr/bin\nversion = 3.10.12\n')
      const sitePackages = process.platform === 'win32'
        ? path.join(venvDir, 'Lib', 'site-packages')
        : path.join(venvDir, 'lib', 'python3.10', 'site-packages')
      await fs.mkdir(path.join(sitePackages, 'torch'), { recursive: true })
      await fs.writeFile(
        path.join(sitePackages, 'torch', 'version.py'),
        "__version__ = '2.3.0+cu121'\ncuda: str = '12.1'\n",
      )

      getActiveProfile.mockReturnValue({
        id: 'profile-pyenv',
        workspacePaths: [workspaceRoot],
      })
      runExternalCommand.mockImplementation(async (command: string) => {
        if (command === 'git') return { stdout: '', stderr: '' }
        if (command === 'which' || command === 'where') {
          return { stdout: '/usr/bin/python3\n', stderr: '' }
        }
        if (command === 'java') return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()
      const workspace = result.workspaces.find((entry) => entry.path === workspaceRoot)

      // The interpreter must never be executed during workspace scanning.
      expect(runExternalCommand).not.toHaveBeenCalledWith(interpreterPath, expect.anything(), expect.anything())
      expect(workspace?.pythonEnv).toEqual(
        expect.objectContaining({
          envType: 'venv',
          envPath: venvDir,
          interpreterPath,
          pythonVersion: '3.10.12',
          torchVersion: '2.3.0+cu121',
          torchCudaAvailable: true,
        }),
      )
    })

  it('detects workspace .venv but flags PyTorch as not installed', async () => {
      const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-pyenv-no-torch-'))
      const interpreterSubpath = process.platform === 'win32'
        ? path.join('Scripts', 'python.exe')
        : path.join('bin', 'python')
      const venvDir = path.join(workspaceRoot, '.venv')
      const interpreterPath = path.join(venvDir, interpreterSubpath)
      await fs.mkdir(path.dirname(interpreterPath), { recursive: true })
      await fs.writeFile(interpreterPath, '#!/usr/bin/env python3\n', { mode: 0o755 })
      // Static metadata read instead of executing the interpreter (security).
      await fs.writeFile(path.join(venvDir, 'pyvenv.cfg'), 'home = /usr/bin\nversion = 3.11.0\n')

      getActiveProfile.mockReturnValue({
        id: 'profile-pyenv-empty',
        workspacePaths: [workspaceRoot],
      })
      runExternalCommand.mockImplementation(async (command: string) => {
        if (command === 'git') return { stdout: '', stderr: '' }
        if (command === 'which' || command === 'where') {
          return { stdout: '/usr/bin/python3\n', stderr: '' }
        }
        if (command === 'java') return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()
      const workspace = result.workspaces.find((entry) => entry.path === workspaceRoot)

      expect(runExternalCommand).not.toHaveBeenCalledWith(interpreterPath, expect.anything(), expect.anything())
      expect(workspace?.pythonEnv).toEqual(
        expect.objectContaining({
          envType: 'venv',
          interpreterPath,
          pythonVersion: '3.11.0',
          torchVersion: null,
          torchCudaAvailable: null,
        }),
      )
      expect(workspace?.pythonEnv?.detectionNote).toMatch(/not detected/i)
    })
})
