import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'

const MAX_FILE_LINES = 300

// Existing oversized modules are frozen at their current effective line count.
// New modules are capped at MAX_FILE_LINES, and each entry must be removed as
// its module is split below the global limit.
const LEGACY_LINE_BUDGETS = {
  'src/main/ipc/disk.ipc.ts': 438,
  'src/main/ipc/docker.ipc.ts': 355,
  'src/main/services/alerts/alertManager.ts': 377,
  'src/main/services/apps/installedApps.ts': 354,
  'src/main/services/devtools/devToolsOverview.ts': 1106,
  'src/main/services/docker/dockerImages.ts': 503,
  'src/renderer/src/features/apps/InstalledApps.tsx': 537,
  'src/renderer/src/features/apps/LeftoverApps.tsx': 466,
  'src/renderer/src/features/apps/RegistryApps.tsx': 393,
  'src/renderer/src/features/devtools/DevToolsOverviewSection.tsx': 722,
  'src/renderer/src/features/disk/QuickScan.tsx': 420,
  'src/renderer/src/features/docker/DockerContainers.tsx': 386,
  'src/renderer/src/features/process/ListeningPorts.tsx': 1288,
  'src/renderer/src/features/process/PortWatch.tsx': 338,
  'src/renderer/src/features/process/ProcessTable.tsx': 759,
  'src/renderer/src/pages/SettingsPage.tsx': 1220,
  'tests/unit/devToolsOverview.test.ts': 692,
  'tests/unit/processIpc.test.ts': 473
}

const maxLinesRule = (max) => ['error', { max, skipBlankLines: true, skipComments: true }]

export default tseslint.config(
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', 'coverage/**', 'playwright.config.d.ts']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser
      }
    }
  },
  {
    plugins: {
      unicorn
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'unicorn/prefer-node-protocol': 'error',
      'eqeqeq': ['error', 'always'],
      'no-template-curly-in-string': 'warn',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'max-lines': maxLinesRule(MAX_FILE_LINES),
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }]
    }
  },
  {
    files: ['src/shared/i18n/locales/*.ts'],
    rules: {
      // Locale catalogs are declarative data, not executable modules with growing responsibilities.
      'max-lines': 'off'
    }
  },
  {
    files: ['src/preload/**/*.ts', 'src/main/ipc/**/*.ts', 'src/shared/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  ...Object.entries(LEGACY_LINE_BUDGETS).map(([file, max]) => ({
    name: `legacy-line-budget:${file}`,
    files: [file],
    rules: {
      'max-lines': maxLinesRule(max)
    }
  }))
)
