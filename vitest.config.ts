import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // electron-store / electron-log internally `require('electron')`. As node_modules
    // CJS, those requires bypass resolve.alias and load the real electron package,
    // which throws when the binary isn't installed (CI). Inlining them makes vitest
    // transform the packages so their electron import resolves through the alias stub.
    server: {
      deps: {
        inline: [/electron-store/, /electron-log/, /^conf$/]
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      // Unit tests run in Node, not the Electron runtime — never load the real
      // `electron` package (it needs the binary, which isn't installed on CI).
      // Tests that need specific behaviour override this with vi.mock('electron').
      electron: resolve(__dirname, 'tests/stubs/electron.ts')
    }
  }
})
