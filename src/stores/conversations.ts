import type { AskChunk, AskInput, AskResult, PartialAnswer, SearchRecord } from '@/interfaces/answer'
import type { Conversation, Message } from '@/interfaces/conversation'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, functions } from '@/plugins/firebase'
import { useAuthStore } from './auth'

// A question that's been sent but whose answer isn't in Firestore yet. It's
// shown below the thread, streaming, until the persisted messages arrive.
export interface PendingTurn {
  question: string
  conversationId: string | null
  // Messages already in the thread when the question was sent; once the
  // thread grows past this, the persisted question is showing.
  baseCount: number
  searches: SearchRecord[]
  partial: PartialAnswer | null
  result: AskResult | null
}

const askIsLegal = httpsCallable<AskInput, AskResult, AskChunk>(
  functions,
  'askIsLegal',
  { timeout: 300_000 },
)

export const useConversationsStore = defineStore('conversations', () => {
  const authStore = useAuthStore()

  const conversations = ref<Conversation[]>([])
  const conversationsLoaded = ref(false)
  const messages = ref<Message[]>([])
  const messagesFor = ref<string | null>(null)
  const pending = ref<PendingTurn | null>(null)

  const conversationsPath = () => `orgs/${authStore.orgId}/conversations`

  /** Live list of the signed-in user's conversations. Returns unsubscribe. */
  const listenConversations = () => {
    if (!authStore.orgId || !authStore.uid) return () => {}
    // The security rules only allow listing conversations filtered to the
    // caller's own uid.
    const q = query(
      collection(db, conversationsPath()),
      where('uid', '==', authStore.uid),
      orderBy('updatedAt', 'desc'),
      limit(50),
    )
    return onSnapshot(q, snapshot => {
      conversations.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation)
      conversationsLoaded.value = true
    }, error => console.warn('[conversations] listener stopped', error))
  }

  /** Live messages of one conversation. Returns unsubscribe. */
  const listenMessages = (conversationId: string) => {
    if (messagesFor.value !== conversationId) {
      messages.value = []
    }
    messagesFor.value = conversationId
    const q = query(
      collection(db, conversationsPath(), conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, snapshot => {
      messages.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Message)
      // The persisted answer replaces the streamed one.
      const done = pending.value?.result?.messageId
      if (done && messages.value.some(m => m.id === done)) {
        pending.value = null
      }
    }, error => console.warn('[messages] listener stopped', error))
  }

  /**
   * Sends a question, streaming search activity and the partial answer into
   * `pending`. Calls onConversation as soon as the conversation id is known
   * (immediately for a new conversation).
   */
  const ask = async (
    question: string,
    conversationId: string | null,
    onConversation?: (id: string) => void,
  ) => {
    pending.value = {
      question,
      conversationId,
      baseCount: conversationId && messagesFor.value === conversationId ? messages.value.length : 0,
      searches: [],
      partial: null,
      result: null,
    }
    const turn = pending.value
    try {
      const { stream, data } = await askIsLegal.stream({
        message: question,
        ...(conversationId ? { conversationId } : {}),
      })
      for await (const chunk of stream) {
        if (pending.value !== turn) break
        switch (chunk.type) {
          case 'meta': {
            turn.conversationId = chunk.conversationId
            onConversation?.(chunk.conversationId)
            break
          }
          case 'search': {
            turn.searches.push({ query: chunk.query, scope: chunk.scope, results: chunk.results })
            break
          }
          case 'answer': {
            turn.partial = chunk.partial
            break
          }
        }
      }
      const result = await data
      if (pending.value !== turn) return
      turn.result = result
      turn.partial = result.answer
      if (messagesFor.value === result.conversationId
        && messages.value.some(m => m.id === result.messageId)) {
        pending.value = null
      }
    } catch (error) {
      if (pending.value === turn) pending.value = null
      throw error
    }
  }

  const reset = () => {
    conversations.value = []
    conversationsLoaded.value = false
    messages.value = []
    messagesFor.value = null
    pending.value = null
  }

  return {
    conversations,
    conversationsLoaded,
    messages,
    messagesFor,
    pending,
    listenConversations,
    listenMessages,
    ask,
    reset,
  }
})
