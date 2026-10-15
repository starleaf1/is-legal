/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
registerPlugins(app)

// Mount once Firebase Auth has restored the session (or found none), so the
// first screen already knows who the user is and which org they belong to.
useAuthStore().init().then(() => app.mount('#app'))
