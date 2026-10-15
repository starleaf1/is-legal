<template>
  <v-list class="pt-0" density="compact" nav>
    <v-list-subheader>Your questions</v-list-subheader>
    <template v-if="conversationsStore.conversationsLoaded">
      <v-list-item
        v-for="conversation in conversationsStore.conversations"
        :key="conversation.id"
        :to="`/chat/${conversation.id}`"
      >
        <template #prepend>
          <v-icon
            :color="verdictStyle(conversation.lastVerdict).color"
            :icon="conversation.lastVerdict ? verdictStyle(conversation.lastVerdict).icon : 'mdi-chat-outline'"
            size="small"
          />
        </template>
        <v-list-item-title class="text-body-2">{{ conversation.title }}</v-list-item-title>
      </v-list-item>
      <div v-if="!conversationsStore.conversations.length" class="px-4 py-2 text-body-2 text-medium-emphasis">
        Questions you ask will appear here. Only you can see them.
      </div>
    </template>
    <div v-else class="px-2">
      <v-skeleton-loader v-for="i in 3" :key="i" type="list-item" />
    </div>
  </v-list>
</template>

<script setup lang="ts">
  import { useConversationsStore } from '@/stores/conversations'
  import { verdictStyle } from '@/utils/verdicts'

  const conversationsStore = useConversationsStore()

  let unsubscribe = () => {}
  onMounted(() => {
    unsubscribe = conversationsStore.listenConversations()
  })
  onUnmounted(() => unsubscribe())
</script>
