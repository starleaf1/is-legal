import type { Org, Role } from '@/interfaces/org'
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import { auth, db } from '@/plugins/firebase'

export const useAuthStore = defineStore('auth', () => {
  // Keep the Firebase User out of Vue's deep reactivity.
  const user = shallowRef<User | null>(null)
  const orgId = ref<string | null>(null)
  const role = ref<Role | null>(null)
  const org = ref<Org | null>(null)
  const isReady = ref(false)

  let resolveReady: () => void = () => {}
  // Resolves once the first auth state (signed in or not) is known.
  const ready = new Promise<void>(resolve => {
    resolveReady = resolve
  })

  const uid = computed(() => user.value?.uid ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')

  // Claims are set by the seed script; they decide which org's data the
  // security rules and functions let this user see.
  const load = async (next: User | null) => {
    if (!next) {
      user.value = null
      orgId.value = null
      role.value = null
      org.value = null
      return
    }
    const { claims } = await next.getIdTokenResult()
    user.value = markRaw(next)
    orgId.value = typeof claims.orgId === 'string' ? claims.orgId : null
    role.value = claims.role === 'admin' ? 'admin' : (orgId.value ? 'member' : null)
    org.value = null
    if (orgId.value) {
      try {
        const snapshot = await getDoc(doc(db, 'orgs', orgId.value))
        if (snapshot.exists()) {
          org.value = { id: snapshot.id, ...snapshot.data() } as Org
        }
      } catch (error) {
        console.warn('[auth] Could not load org', error)
      }
    }
  }

  const init = () => {
    onAuthStateChanged(auth, async next => {
      await load(next)
      isReady.value = true
      resolveReady()
    })
    return ready
  }

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    // Load claims now, so the caller can navigate as soon as this resolves.
    await load(credential.user)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    await load(null)
  }

  return {
    user,
    uid,
    orgId,
    role,
    org,
    isAdmin,
    displayName,
    isReady,
    ready,
    init,
    signIn,
    signOut,
  }
})
