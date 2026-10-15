<template>
  <v-navigation-drawer v-model="drawer" :width="300">
    <div class="pa-3">
      <v-btn
        block
        color="primary"
        prepend-icon="mdi-plus"
        size="large"
        to="/chat"
        variant="flat"
      >
        New question
      </v-btn>
    </div>
    <ConversationList />
    <template #append>
      <v-divider />
      <v-list density="comfortable" nav>
        <v-list-item
          prepend-icon="mdi-chat-question-outline"
          title="Ask"
          to="/chat"
        />
        <v-list-item
          v-if="authStore.isAdmin"
          prepend-icon="mdi-file-document-multiple-outline"
          title="Documents"
          to="/documents"
        />
      </v-list>
    </template>
  </v-navigation-drawer>

  <v-app-bar border="b" color="surface" flat>
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title>
      <span class="font-weight-bold text-primary">Is Legal?</span>
      <span v-if="authStore.org" class="text-medium-emphasis text-body-1 ml-2">{{ authStore.org.name }}</span>
    </v-app-bar-title>
    <template #append>
      <UserMenu />
    </template>
  </v-app-bar>

  <v-main>
    <router-view />
  </v-main>
</template>

<script setup lang="ts">
  import { useDisplay } from 'vuetify'
  import { useAuthStore } from '@/stores/auth'

  const authStore = useAuthStore()
  const { mdAndUp } = useDisplay()
  const drawer = ref(mdAndUp.value)
</script>
