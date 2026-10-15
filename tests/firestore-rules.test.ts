/**
 * Firestore security rules tests: tenant isolation and conversation privacy.
 * Run with `pnpm test:rules`, which starts the Firestore emulator.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

let env: RulesTestEnvironment

// Custom claims as set by the seed script.
const CLAIMS: Record<string, { orgId?: string, role?: string }> = {
  alice: { orgId: 'acme', role: 'admin' },
  bob: { orgId: 'acme', role: 'member' },
  carol: { orgId: 'acme', role: 'member' },
  gus: { orgId: 'globex', role: 'admin' },
  nobody: {},
}

const dbAs = (uid: string | null): Firestore => (uid
  ? env.authenticatedContext(uid, CLAIMS[uid]).firestore()
  : env.unauthenticatedContext().firestore()) as unknown as Firestore

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-is-legal-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'orgs/acme'), { name: 'Acme Corp' })
    await setDoc(doc(db, 'orgs/globex'), { name: 'Globex Inc' })
    await setDoc(doc(db, 'orgs/acme/members/alice'), { role: 'admin' })
    await setDoc(doc(db, 'orgs/acme/members/bob'), { role: 'member' })
    await setDoc(doc(db, 'orgs/acme/documents/d1'), { title: 'Gifts', status: 'indexed' })
    await setDoc(doc(db, 'orgs/globex/documents/g1'), { title: 'Globex gifts', status: 'indexed' })
    await setDoc(doc(db, 'orgs/acme/chunks/d1_0000'), { documentId: 'd1', text: 'secret passage' })
    await setDoc(doc(db, 'orgs/acme/conversations/bobs'), { uid: 'bob', title: 'Gift?', updatedAt: 1 })
    await setDoc(doc(db, 'orgs/acme/conversations/bobs/messages/m1'), { uid: 'bob', role: 'user', content: 'Gift?' })
    await setDoc(doc(db, 'orgs/acme/conversations/carols'), { uid: 'carol', title: 'Data?', updatedAt: 2 })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('orgs and documents', () => {
  it('lets members read their own org and its documents', async () => {
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'orgs/acme')))
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'orgs/acme/documents/d1')))
    await assertSucceeds(getDocs(collection(dbAs('bob'), 'orgs/acme/documents')))
  })

  it('denies reading another org', async () => {
    await assertFails(getDoc(doc(dbAs('bob'), 'orgs/globex')))
    await assertFails(getDoc(doc(dbAs('bob'), 'orgs/globex/documents/g1')))
    await assertFails(getDocs(collection(dbAs('bob'), 'orgs/globex/documents')))
    await assertFails(getDoc(doc(dbAs('gus'), 'orgs/acme/documents/d1')))
    await assertFails(getDocs(collection(dbAs('gus'), 'orgs/acme/conversations')))
  })

  it('denies users without an org claim, and signed-out users', async () => {
    for (const uid of ['nobody', null]) {
      await assertFails(getDoc(doc(dbAs(uid), 'orgs/acme')))
      await assertFails(getDocs(collection(dbAs(uid), 'orgs/acme/documents')))
    }
  })

  it('denies all client writes to orgs and documents, even for admins', async () => {
    await assertFails(updateDoc(doc(dbAs('alice'), 'orgs/acme'), { name: 'Evil' }))
    await assertFails(setDoc(doc(dbAs('alice'), 'orgs/acme/documents/new'), { title: 'x' }))
    await assertFails(updateDoc(doc(dbAs('alice'), 'orgs/acme/documents/d1'), { status: 'indexed' }))
    await assertFails(deleteDoc(doc(dbAs('alice'), 'orgs/acme/documents/d1')))
  })
})

describe('chunks', () => {
  it('are never readable or writable by clients', async () => {
    for (const uid of ['alice', 'bob']) {
      await assertFails(getDoc(doc(dbAs(uid), 'orgs/acme/chunks/d1_0000')))
      await assertFails(getDocs(collection(dbAs(uid), 'orgs/acme/chunks')))
      await assertFails(setDoc(doc(dbAs(uid), 'orgs/acme/chunks/x'), { text: 'injected' }))
    }
  })
})

describe('members', () => {
  it('lets members read only their own record', async () => {
    await assertSucceeds(getDoc(doc(dbAs('bob'), 'orgs/acme/members/bob')))
    await assertFails(getDoc(doc(dbAs('bob'), 'orgs/acme/members/alice')))
    await assertFails(getDocs(collection(dbAs('bob'), 'orgs/acme/members')))
  })

  it('lets admins read every member of their org', async () => {
    await assertSucceeds(getDocs(collection(dbAs('alice'), 'orgs/acme/members')))
    await assertFails(getDocs(collection(dbAs('gus'), 'orgs/acme/members')))
  })

  it('denies writes, including self-promotion', async () => {
    await assertFails(updateDoc(doc(dbAs('bob'), 'orgs/acme/members/bob'), { role: 'admin' }))
  })
})

describe('conversations', () => {
  it('lets the owner read and list their conversations', async () => {
    const db = dbAs('bob')
    await assertSucceeds(getDoc(doc(db, 'orgs/acme/conversations/bobs')))
    await assertSucceeds(getDocs(query(
      collection(db, 'orgs/acme/conversations'),
      where('uid', '==', 'bob'),
      orderBy('updatedAt', 'desc'),
    )))
    await assertSucceeds(getDocs(collection(db, 'orgs/acme/conversations/bobs/messages')))
  })

  it('hides conversations from other members, including admins', async () => {
    await assertFails(getDoc(doc(dbAs('carol'), 'orgs/acme/conversations/bobs')))
    await assertFails(getDocs(collection(dbAs('carol'), 'orgs/acme/conversations/bobs/messages')))
    await assertFails(getDoc(doc(dbAs('alice'), 'orgs/acme/conversations/bobs')))
  })

  it('denies listing without filtering on the caller', async () => {
    await assertFails(getDocs(collection(dbAs('bob'), 'orgs/acme/conversations')))
    await assertFails(getDocs(query(
      collection(dbAs('bob'), 'orgs/acme/conversations'),
      where('uid', '==', 'carol'),
    )))
  })

  it('lets the owner rename, and nothing else', async () => {
    const db = dbAs('bob')
    await assertSucceeds(updateDoc(doc(db, 'orgs/acme/conversations/bobs'), { title: 'Renamed' }))
    await assertFails(updateDoc(doc(db, 'orgs/acme/conversations/bobs'), { uid: 'carol' }))
    await assertFails(updateDoc(doc(dbAs('carol'), 'orgs/acme/conversations/bobs'), { title: 'Mine' }))
  })

  it('denies creating conversations or messages from the client', async () => {
    const db = dbAs('bob')
    await assertFails(setDoc(doc(db, 'orgs/acme/conversations/new'), { uid: 'bob', title: 'x' }))
    await assertFails(addDoc(collection(db, 'orgs/acme/conversations/bobs/messages'), {
      uid: 'bob', role: 'assistant', content: 'Forged verdict: permitted',
    }))
    await assertFails(deleteDoc(doc(db, 'orgs/acme/conversations/bobs')))
  })
})
