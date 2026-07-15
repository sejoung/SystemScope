import { homedir, platform } from 'node:os'
import * as path from 'node:path'
import type { CleanupRule } from '@shared/types'

const home = homedir()
const isMac = platform() === 'darwin'

export const BUILT_IN_RULES: Omit<CleanupRule, 'enabled' | 'minAgeDays'>[] = [
  { id: 'downloads_old_files', name: 'Old Downloads', description: 'Files in Downloads folder older than the configured threshold', category: 'downloads', safetyLevel: 'caution', targetPaths: [path.join(home, 'Downloads')] },
  { id: 'xcode_derived_data', name: 'Xcode DerivedData', description: 'Xcode build cache that can be safely regenerated', category: 'dev_tools', safetyLevel: 'safe', targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/DerivedData')] : [] },
  { id: 'xcode_archives', name: 'Xcode Archives', description: 'Old Xcode archive builds', category: 'dev_tools', safetyLevel: 'risky', targetPaths: isMac ? [path.join(home, 'Library/Developer/Xcode/Archives')] : [] },
  { id: 'npm_cache', name: 'npm Cache', description: 'npm package download cache', category: 'package_managers', safetyLevel: 'safe', targetPaths: [path.join(home, isMac ? '.npm/_cacache' : 'AppData/Local/npm-cache/_cacache')] },
  { id: 'pnpm_cache', name: 'pnpm Cache', description: 'pnpm content-addressable store cache', category: 'package_managers', safetyLevel: 'safe', targetPaths: [path.join(home, isMac ? 'Library/pnpm/store' : 'AppData/Local/pnpm/store')] },
  { id: 'yarn_cache', name: 'Yarn Cache', description: 'Yarn package cache', category: 'package_managers', safetyLevel: 'safe', targetPaths: [path.join(home, isMac ? 'Library/Caches/Yarn' : 'AppData/Local/Yarn/Cache')] },
  { id: 'docker_stopped_containers', name: 'Docker Stopped Containers', description: 'Docker containers that are no longer running', category: 'docker', safetyLevel: 'safe', targetPaths: [] },
  { id: 'old_logs', name: 'Old Log Files', description: 'System and application log files', category: 'system', safetyLevel: 'safe', targetPaths: isMac ? [path.join(home, 'Library/Logs')] : [path.join(home, 'AppData/Local/Temp')] },
  { id: 'temp_files', name: 'Temporary Files', description: 'Temporary files and caches', category: 'system', safetyLevel: 'safe', targetPaths: isMac ? [path.join(home, 'Library/Caches')] : [path.join(home, 'AppData/Local/Temp')] }
]
