import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'

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
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }]
    }
  },
  {
    files: ['src/preload/**/*.ts', 'src/main/ipc/**/*.ts', 'src/shared/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
)
