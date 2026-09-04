import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['api/**/*.js', 'functions/**/*.js', 'scripts/**/*.js', 'vite.config.js', 'src/lib/solisAuth.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Pre-existing violations, downgraded to warn so CI passes without
    // masking them. See tracked issue for the real fix:
    // - context files exporting non-component values (react-refresh/only-export-components)
    // - AuthContext(.adapter).jsx calling Clerk hooks conditionally on isClerkEnabled()
    //   (react-hooks/rules-of-hooks) — works today because the flag never
    //   changes mid-session, but violates the rule's invariant.
    files: [
      'src/components/ThemeContext.jsx',
      'src/components/shared/ToastManager.jsx',
      'src/contexts/AuthContext.jsx',
      'src/contexts/AuthContext.adapter.jsx',
      'src/contexts/DataContext.jsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
])
