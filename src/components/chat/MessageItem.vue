<template>
  <UserBubble v-if="message.role === 'user'" :text="message.content" />
  <v-alert
    v-else-if="message.error || !message.answer"
    class="mb-6"
    icon="mdi-alert-circle-outline"
    type="error"
    variant="tonal"
  >
    {{ message.error || 'No answer was recorded.' }}
  </v-alert>
  <AnswerCard
    v-else
    :answer="message.answer"
    :citations="message.citations"
    :searches="message.searches"
    @follow-up="emit('follow-up', $event)"
  />
</template>

<script setup lang="ts">
  import type { Message } from '@/interfaces/conversation'

  defineProps<{ message: Message }>()
  const emit = defineEmits<{ 'follow-up': [question: string] }>()
</script>
