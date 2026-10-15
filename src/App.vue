<template>
  <v-app>
    <router-view />
    <toast />
  </v-app>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useConversationsStore } from '@/stores/conversations'
  import { useDocumentsStore } from '@/stores/documents'

  const authStore = useAuthStore()
  const conversationsStore = useConversationsStore()
  const documentsStore = useDocumentsStore()
  const route = useRoute()
  const router = useRouter()

  // Signed out (here or in another tab): drop cached data and go to login.
  watch(() => authStore.uid, (uid, previous) => {
    if (previous && uid !== previous) {
      conversationsStore.reset()
      documentsStore.reset()
    }
    if (!uid && !route.meta.noAuth) {
      router.replace('/login')
    }
  })
</script>
