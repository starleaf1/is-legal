/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          'primary': '#1F3A5F',
          'secondary': '#B8892F',
          'background': '#F6F7F9',
          'surface': '#FFFFFF',
          'surface-variant': '#E8ECF2',
          'on-surface-variant': '#1F3A5F',
        },
      },
    },
  },
  defaults: {
    VBtn: { style: 'text-transform: none; letter-spacing: normal;' },
    VCard: { rounded: 'lg' },
    VChip: { rounded: 'lg' },
  },
})
