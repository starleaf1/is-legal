<template>
  <div class="chat">
    <div ref="scroller" class="chat-scroll">
      <v-container class="chat-column py-6">
        <div v-if="isEmpty" class="empty text-center py-8">
          <v-icon color="primary" icon="mdi-scale-balance" size="56" />
          <h1 class="text-h5 font-weight-bold mt-3">Is it allowed?</h1>
          <p class="text-body-1 text-medium-emphasis mt-2 mb-6">
            Describe what you're planning to do. I'll check {{ authStore.org?.name ?? 'your organization' }}'s
            policies, the laws it has on file and past cases, and tell you whether it's allowed, with sources.
          </p>
          <v-row dense>
            <v-col v-for="suggestion in SUGGESTIONS" :key="suggestion" cols="12" sm="6">
              <v-card class="suggestion h-100 text-left" variant="outlined" @click="send(suggestion)">
                <v-card-text class="text-body-2">{{ suggestion }}</v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <v-alert v-if="notFound" class="mb-6" type="warning" variant="tonal">
          This conversation doesn't exist or isn't yours.
        </v-alert>

        <MessageItem
          v-for="message in threadMessages"
          :key="message.id"
          :message="message"
          @follow-up="setDraft"
        />

        <template v-if="pendingHere">
          <UserBubble v-if="threadMessages.length <= pendingHere.baseCount" :text="pendingHere.question" />
          <AnswerCard
            :answer="pendingHere.partial"
            :citations="pendingHere.result?.citations"
            :searches="pendingHere.searches"
            :streaming="!pendingHere.result"
          />
        </template>
      </v-container>
    </div>

    <div class="composer-bar">
      <v-container class="chat-column pt-2 pb-3">
        <ChatComposer ref="composer" v-model="draft" :loading="!!conversationsStore.pending" @submit="send" />
        <div class="text-caption text-center text-medium-emphasis mt-1">
          Is Legal can make mistakes. It's guidance, not legal advice.
        </div>
      </v-container>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useConversationsStore } from '@/stores/conversations'
  import { useToastStore } from '@/stores/toast'

  const props = defineProps<{ conversationId: string | null }>()

  const SUGGESTIONS = [
    'A vendor offered me courtside basketball tickets worth $400. They won\'t attend. Can I accept?',
    'A customs officer asked for a $20 "fee" in cash to clear our shipment today. Can I pay it?',
    'Can I paste our customer list into a public AI chatbot to draft follow-up emails?',
    'Can I take a paid advisory role at a startup that sells to us?',
  ]

  const authStore = useAuthStore()
  const conversationsStore = useConversationsStore()
  const toastStore = useToastStore()
  const router = useRouter()

  const draft = ref('')
  const scroller = ref<HTMLElement | null>(null)
  const composer = ref<{ focus: () => void } | null>(null)

  const threadMessages = computed(() =>
    props.conversationId && conversationsStore.messagesFor === props.conversationId
      ? conversationsStore.messages
      : [])

  const pendingHere = computed(() => {
    const pending = conversationsStore.pending
    if (!pending) return null
    return pending.conversationId === props.conversationId ? pending : null
  })

  const isEmpty = computed(() => !props.conversationId && !pendingHere.value)

  const notFound = computed(() =>
    !!props.conversationId
    && conversationsStore.conversationsLoaded
    && !conversationsStore.conversations.some(c => c.id === props.conversationId)
    && !pendingHere.value)

  let unsubscribe = () => {}
  watch(() => props.conversationId, id => {
    unsubscribe()
    unsubscribe = id ? conversationsStore.listenMessages(id) : () => {}
  }, { immediate: true })
  onUnmounted(() => unsubscribe())

  const scrollToBottom = async () => {
    await nextTick()
    const el = scroller.value
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
  watch(() => [threadMessages.value.length, pendingHere.value?.searches.length, pendingHere.value?.partial], scrollToBottom)

  const setDraft = (text: string) => {
    draft.value = text
    composer.value?.focus()
  }

  const send = async (question: string) => {
    if (conversationsStore.pending) return
    draft.value = ''
    try {
      await conversationsStore.ask(question, props.conversationId, id => {
        if (id !== props.conversationId) router.replace(`/chat/${id}`)
      })
    } catch (error) {
      console.error(error)
      draft.value = question
      toastStore.displayToast({
        content: 'Sorry, I couldn\'t answer that. Please try again.',
        toastType: 'error',
      })
    }
  }
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--v-layout-top, 64px));
}
.chat-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
}
.chat-column {
  max-width: 820px;
}
.composer-bar {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-background));
}
.suggestion {
  cursor: pointer;
}
</style>
