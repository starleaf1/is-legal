<template>
  <v-menu location="bottom end">
    <template #activator="{ props }">
      <v-btn v-bind="props" class="mr-2" icon>
        <v-avatar color="primary" size="36">
          <span class="text-body-2 font-weight-bold">{{ initials }}</span>
        </v-avatar>
      </v-btn>
    </template>
    <v-card min-width="260">
      <v-card-text>
        <div class="font-weight-medium">{{ authStore.displayName }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ authStore.user?.email }}</div>
        <div class="mt-2 d-flex ga-2">
          <v-chip prepend-icon="mdi-domain" size="small">{{ authStore.org?.name ?? authStore.orgId }}</v-chip>
          <v-chip :color="authStore.isAdmin ? 'secondary' : undefined" size="small">
            {{ authStore.isAdmin ? 'Admin' : 'Member' }}
          </v-chip>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn block prepend-icon="mdi-logout" @click="signOut">Sign out</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
  import { useAuthStore } from '@/stores/auth'

  const authStore = useAuthStore()

  const initials = computed(() => {
    const name = authStore.user?.displayName || authStore.user?.email || '?'
    return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
  })

  // App.vue redirects to the login page once the auth state changes.
  const signOut = () => authStore.signOut()
</script>
