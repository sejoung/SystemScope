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

  it('detects non-Node dependency tooling for Python, JVM, Go, and Rust workspaces', async () => {
      const baseRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-devtools-multi-'))
      const pythonRoot = path.join(baseRoot, 'python-api')
      const jvmRoot = path.join(baseRoot, 'spring-app')
      const goRoot = path.join(baseRoot, 'go-api')
      const rustRoot = path.join(baseRoot, 'rust-api')

      await fs.mkdir(pythonRoot, { recursive: true })
      await fs.mkdir(jvmRoot, { recursive: true })
      await fs.mkdir(goRoot, { recursive: true })
      await fs.mkdir(rustRoot, { recursive: true })

      await fs.writeFile(path.join(pythonRoot, 'pyproject.toml'), '[project]\nname="api"')
      await fs.writeFile(path.join(pythonRoot, 'uv.lock'), '')
      await fs.mkdir(path.join(pythonRoot, '.venv'))
      await fs.writeFile(path.join(jvmRoot, 'build.gradle.kts'), 'plugins {}')
      await fs.mkdir(path.join(jvmRoot, '.gradle'))
      await fs.writeFile(path.join(goRoot, 'go.mod'), 'module example.com/app')
      await fs.writeFile(path.join(rustRoot, 'Cargo.toml'), '[package]\nname="app"\nversion="0.1.0"')
      await fs.mkdir(path.join(rustRoot, 'target'))

      getActiveProfile.mockReturnValue({
        id: 'profile-2',
        workspacePaths: [pythonRoot, jvmRoot, goRoot, rustRoot],
      })
      runExternalCommand.mockImplementation(async (command: string, args: string[], options?: { cwd?: string }) => {
        if (command === 'git' && args[0] === 'rev-parse') {
          return { stdout: `${options?.cwd ?? ''}\n`, stderr: '' }
        }
        if (command === 'git' && ['branch', 'status', 'stash', 'log'].includes(args[0] ?? '')) {
          return { stdout: '', stderr: '' }
        }
        if (command === 'java') {
          return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()

      expect(result.workspaces.find((workspace) => workspace.path === pythonRoot)).toEqual(
        expect.objectContaining({
          packageManager: 'uv',
          stacks: expect.arrayContaining(['Python']),
          artifactDirectories: expect.arrayContaining(['.venv']),
        }),
      )
      expect(result.workspaces.find((workspace) => workspace.path === jvmRoot)).toEqual(
        expect.objectContaining({
          packageManager: 'gradle',
          stacks: expect.arrayContaining(['JVM']),
          artifactDirectories: expect.arrayContaining(['.gradle']),
        }),
      )
      expect(result.workspaces.find((workspace) => workspace.path === goRoot)).toEqual(
        expect.objectContaining({
          packageManager: 'go',
          stacks: expect.arrayContaining(['Go']),
        }),
      )
      expect(result.workspaces.find((workspace) => workspace.path === rustRoot)).toEqual(
        expect.objectContaining({
          packageManager: 'cargo',
          stacks: expect.arrayContaining(['Rust']),
          artifactDirectories: expect.arrayContaining(['target']),
        }),
      )
    })

  it('detects Rust workspaces when Cargo.toml exists one level below the tracked folder', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-rust-nested-'))
      const crateRoot = path.join(root, 'crates', 'api')
      await fs.mkdir(crateRoot, { recursive: true })
      await fs.writeFile(path.join(crateRoot, 'Cargo.toml'), '[package]\nname="api"\nversion="0.1.0"')

      getActiveProfile.mockReturnValue({
        id: 'profile-rust-nested',
        workspacePaths: [path.join(root, 'crates')],
      })
      runExternalCommand.mockImplementation(async (command: string, args: string[], options?: { cwd?: string }) => {
        if (command === 'git' && args[0] === 'rev-parse') {
          return { stdout: `${options?.cwd ?? ''}\n`, stderr: '' }
        }
        if (command === 'git' && ['branch', 'status', 'stash', 'log'].includes(args[0] ?? '')) {
          return { stdout: '', stderr: '' }
        }
        if (command === 'java') {
          return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()

      expect(result.workspaces[0]).toEqual(expect.objectContaining({
        path: path.join(root, 'crates'),
        packageManager: 'cargo',
        stacks: expect.arrayContaining(['Rust']),
      }))
    })

  it('detects Tauri Rust workspaces when src-tauri is nested below the tracked folder', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-tauri-nested-'))
      const appRoot = path.join(root, 'apps', 'desktop')
      const tauriRoot = path.join(appRoot, 'src-tauri')
      await fs.mkdir(tauriRoot, { recursive: true })
      await fs.writeFile(path.join(appRoot, 'package.json'), '{"name":"desktop"}')
      await fs.writeFile(path.join(tauriRoot, 'Cargo.toml'), '[package]\nname="desktop"\nversion="0.1.0"')
      await fs.writeFile(path.join(tauriRoot, 'tauri.conf.json'), '{"build":{}}')
      await fs.mkdir(path.join(tauriRoot, 'target'))

      getActiveProfile.mockReturnValue({
        id: 'profile-tauri-nested',
        workspacePaths: [path.join(root, 'apps')],
      })
      runExternalCommand.mockImplementation(async (command: string, args: string[], options?: { cwd?: string }) => {
        if (command === 'git' && args[0] === 'rev-parse') {
          return { stdout: `${options?.cwd ?? ''}\n`, stderr: '' }
        }
        if (command === 'git' && ['branch', 'status', 'stash', 'log'].includes(args[0] ?? '')) {
          return { stdout: '', stderr: '' }
        }
        if (command === 'java') {
          return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()

      expect(result.workspaces[0]).toEqual(expect.objectContaining({
        path: path.join(root, 'apps'),
        packageManager: 'cargo',
        stacks: expect.arrayContaining(['Tauri', 'Rust', 'Node.js']),
        artifactDirectories: expect.arrayContaining(['target']),
      }))
    })

  it('detects Python, CUDA Toolkit, NVIDIA driver, and system PyTorch when available', async () => {
      if (process.platform === 'darwin') {
        // macOS doesn't expose nvidia-smi/nvcc; skip non-portable parts by asserting the python branch only.
      }

      runExternalCommand.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'git') return { stdout: '', stderr: '' }
        if (command === 'which' || command === 'where') {
          return { stdout: '/usr/bin/python3\n', stderr: '' }
        }
        if (command === 'python3' && args[0] === '--version') {
          return { stdout: 'Python 3.11.6', stderr: '' }
        }
        if (command === '/usr/bin/python3' && args[0] === '-c') {
          return {
            stdout: JSON.stringify({ ok: true, version: '2.4.1', cuda: true }) + '\n',
            stderr: '',
          }
        }
        if (command === 'nvcc' && args[0] === '--version') {
          return {
            stdout:
              'nvcc: NVIDIA (R) Cuda compiler driver\nCuda compilation tools, release 12.4, V12.4.131',
            stderr: '',
          }
        }
        if (command === 'nvidia-smi') {
          return { stdout: '535.183.01, NVIDIA GeForce RTX 4090\n', stderr: '' }
        }
        if (command === 'java') return { stdout: '', stderr: 'openjdk version "21.0.2"' }
        return { stdout: `${command} 1.0.0`, stderr: '' }
      })

      const result = await getDevToolsOverview()

      expect(result.healthChecks.find((entry) => entry.id === 'python')).toEqual(
        expect.objectContaining({ status: 'healthy', version: 'Python 3.11.6' }),
      )

      if (process.platform !== 'darwin') {
        expect(result.healthChecks.find((entry) => entry.id === 'cuda')).toEqual(
          expect.objectContaining({ status: 'healthy', version: '12.4' }),
        )
        const nvidia = result.healthChecks.find((entry) => entry.id === 'nvidia-driver')
        expect(nvidia).toEqual(expect.objectContaining({ status: 'healthy', version: '535.183.01' }))
        expect(nvidia?.extra?.gpuModel).toBe('NVIDIA GeForce RTX 4090')
      } else {
        expect(result.healthChecks.find((entry) => entry.id === 'cuda')).toBeUndefined()
        expect(result.healthChecks.find((entry) => entry.id === 'nvidia-driver')).toBeUndefined()
      }

      const torch = result.healthChecks.find((entry) => entry.id === 'pytorch')
      expect(torch).toEqual(
        expect.objectContaining({
          status: 'healthy',
          version: '2.4.1',
        }),
      )
      expect(torch?.extra?.torchCudaAvailable).toBe(true)
    })
})
