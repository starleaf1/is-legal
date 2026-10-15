<template>
  <ChatView :conversation-id="route.params.conversationId" />
</template>

<script setup lang="ts">
  import { useRoute } from 'vue-router'

  const route = useRoute('/chat/[conversationId]')
</script>

<route lang="yaml">
  meta:
    title: Conversation
</route>
