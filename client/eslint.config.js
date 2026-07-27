import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.2' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      /*
        eslint-plugin-react-hooks 7 folds the React Compiler rules into its
        recommended set, at error severity. They flag 22 pre-existing patterns
        in this codebase -- 17 of them setState called synchronously inside an
        effect -- none of which this dependency work introduced.

        They are downgraded to warnings rather than switched off: the findings
        are real and worth seeing, but every fix means restructuring an effect,
        and restructuring effects changes when things render. That is a
        behavioural change, and it does not belong inside a dependency upgrade
        whose entire premise is that nothing renders differently.

        Fixing them is a genuine follow-up task. Deleting these four lines is
        how you start it.
      */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // Was a warning under the plugin's v5 recommended config; v7 raises it to
      // an error. Kept as it was, for the same reason as above.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
