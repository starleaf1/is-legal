<template>
  <div class="login d-flex align-center justify-center pa-4">
    <v-card class="pa-2" max-width="420" width="100%">
      <v-card-item class="text-center">
        <v-icon color="primary" icon="mdi-scale-balance" size="48" />
        <v-card-title class="text-h5 font-weight-bold mt-2">Is Legal?</v-card-title>
        <v-card-subtitle>Compliance answers grounded in your organization's documents</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-form @submit.prevent="signIn">
          <v-text-field
            v-model="email"
            autocomplete="username"
            class="mb-2"
            label="Work email"
            prepend-inner-icon="mdi-email-outline"
            type="email"
            variant="outlined"
          />
          <v-text-field
            v-model="password"
            autocomplete="current-password"
            label="Password"
            prepend-inner-icon="mdi-lock-outline"
            type="password"
            variant="outlined"
          />
          <v-alert
            v-if="error"
            class="mb-4"
            density="compact"
            type="error"
            variant="tonal"
          >{{ error }}</v-alert>
          <v-btn
            block
            color="primary"
            :loading="loading"
            size="large"
            type="submit"
            variant="flat"
          >Sign in</v-btn>
        </v-form>
      </v-card-text>

      <v-card-text v-if="useEmulators" class="pt-0">
        <v-divider class="mb-3" />
        <div class="text-caption text-medium-emphasis mb-2">
          Demo accounts from <code>pnpm seed</code> (password <code>password123</code>):
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip v-for="account in DEMO_ACCOUNTS" :key="account.email" size="small" @click="fill(account.email)">
            {{ account.email }} · {{ account.label }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { FirebaseError } from 'firebase/app'
  import { useRoute, useRouter } from 'vue-router'
  import { useEmulators } from '@/plugins/firebase'
  import { useAuthStore } from '@/stores/auth'

  const DEMO_ACCOUNTS = [
    { email: 'member@acme.test', label: 'Acme member' },
    { email: 'admin@acme.test', label: 'Acme admin' },
    { email: 'member2@acme.test', label: 'Acme member' },
    { email: 'admin@globex.test', label: 'Globex admin' },
  ]

  const UNAVAILABLE_MESSAGE = useEmulators
    ? 'Could not sign in. Is the Auth emulator running?'
    : 'Could not sign in. Check your connection and try again.'

  const authStore = useAuthStore()
  const route = useRoute()
  const router = useRouter()

  const email = ref('')
  const password = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fill = (account: string) => {
    email.value = account
    password.value = 'password123'
  }

  const signIn = async () => {
    error.value = null
    loading.value = true
    try {
      await authStore.signIn(email.value.trim(), password.value)
      const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/chat'
      await router.replace(redirect)
    } catch (error_) {
      const code = error_ instanceof FirebaseError ? error_.code : ''
      error.value = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)
        ? 'Wrong email or password.'
        : UNAVAILABLE_MESSAGE
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
.login {
  min-height: 100dvh;
}
</style>

<route lang="yaml">
  meta:
    title: Sign in
    layout: blank
    noAuth: true
</route>
