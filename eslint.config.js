import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Per-task Claude Code worktrees (scratch, per-task isolation -- see
    // .gitignore's own comment on these) -- were never actually excluded
    // here before, so a worktree sitting alongside the repo at lint time
    // would get swept in and linted as if it were part of this checkout.
    '.worktrees/**',
    '.claude/worktrees/**',
    '.pytest_cache/**',
    'runtime/**',
    // Built deck ZIPs and their generated catalog, not source.
    'public/decks/**',
  ]),
  {
    // The React app itself -- browser runtime, JSX, React Hooks rules.
    // tools/symmetry_draw/renderer.js is also browser code (runs inside
    // a canvas/DOM context the build tooling drives, not under Node) --
    // grouped here rather than with the Node tooling block below.
    files: ['src/**/*.{js,jsx}', 'tools/symmetry_draw/renderer.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // `const { omitMe, ...rest } = obj` is the standard way to drop a
      // field before using the remainder -- omitMe is deliberately never
      // read, not a mistake.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // Everything else that's JS in this repo: the backend (Node
    // http-server, no framework), deck-build/asset tooling under tools/,
    // deploy/CLI scripts, the landing site's zero-dependency static
    // server, and root-level build config files (vite.config.js,
    // eslint.config.js itself). All Node-runtime, no browser/React rules.
    // This block didn't exist before -- .mjs files (the entire backend)
    // were silently never linted at all, since the old config's only
    // `files` pattern was '**/*.{js,jsx}'.
    files: [
      'backend/**/*.mjs',
      'scripts/**/*.mjs',
      'tools/**/*.{js,mjs}',
      'landing/**/*.mjs',
      '*.config.{js,mjs}',
      'deploy*.mjs',
    ],
    ignores: ['tools/symmetry_draw/renderer.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
])
