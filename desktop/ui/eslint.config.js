import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const layerZones = [
  {
    target: './src/lib',
    from: [
      './src/app',
      './src/pages',
      './src/features',
      './src/components',
      './src/state',
      './src/styles',
    ],
  },
  {
    target: './src/components',
    from: [
      './src/app',
      './src/pages',
      './src/features',
      './src/state',
    ],
  },
  {
    target: './src/features',
    from: [
      './src/app',
      './src/pages',
    ],
  },
  {
    target: './src/pages',
    from: ['./src/app'],
  },
  {
    target: './src/state',
    from: [
      './src/app',
      './src/pages',
      './src/features',
      './src/components',
    ],
  },
  {
    target: './src/features/date-range',
    from: [
      './src/features/export-dashboard',
      './src/features/range-notice',
    ],
  },
  {
    target: './src/features/export-dashboard',
    from: [
      './src/features/date-range',
      './src/features/range-notice',
    ],
  },
  {
    target: './src/features/range-notice',
    from: [
      './src/features/date-range',
      './src/features/export-dashboard',
    ],
  },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/no-restricted-paths': ['error', { zones: layerZones }],
    },
  },
])
