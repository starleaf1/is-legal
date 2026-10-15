import vuetify from 'eslint-config-vuetify/index.ts.mjs'

export default [
  // The functions package has its own ESLint setup (Google style).
  { ignores: ['functions/**', 'dist/**'] },
  ...vuetify,
]
