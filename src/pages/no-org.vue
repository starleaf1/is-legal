<template>
  <div class="d-flex align-center justify-center pa-4" style="min-height: 100dvh">
    <v-card max-width="480" width="100%">
      <v-card-item>
        <template #prepend>
          <v-icon color="warning" icon="mdi-domain-off" size="36" />
        </template>
        <v-card-title>No organization</v-card-title>
      </v-card-item>
      <v-card-text>
        You're signed in as <strong>{{ authStore.user?.email }}</strong>, but this account isn't linked to an
        organization yet. Ask your organization's administrator to add you.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn prepend-icon="mdi-logout" @click="authStore.signOut()">Sign out</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { useAuthStore } from '@/stores/auth'

  const authStore = useAuthStore()
</script>

<route lang="yaml">
  meta:
    title: No organization
    layout: blank
</route>
