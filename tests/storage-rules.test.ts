/**
 * Storage security rules tests for org documents. Run with `pnpm test:rules`,
 * which starts the Storage emulator.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteObject,
  type FirebaseStorage,
  getBytes,
  ref,
  uploadBytes,
} from 'firebase/storage'

let env: RulesTestEnvironment

const CLAIMS: Record<string, { orgId?: string, role?: string }> = {
  alice: { orgId: 'acme', role: 'admin' },
  bob: { orgId: 'acme', role: 'member' },
  gus: { orgId: 'globex', role: 'admin' },
  nobody: {},
}

const storageAs = (uid: string | null): FirebaseStorage => (uid
  ? env.authenticatedContext(uid, CLAIMS[uid]).storage()
  : env.unauthenticatedContext().storage()) as unknown as FirebaseStorage

const pdf = new TextEncoder().encode('%PDF-1.4 sample')
// Unique per test, like the app's generated document ids.
let docId = ''
const docPath = (orgId = 'acme', fileName = 'policy.pdf') =>
  `orgs/${orgId}/documents/${docId}/${fileName}`

const upload = (
  uid: string | null,
  path: string,
  { data = pdf, contentType = 'application/pdf', uploadedBy = uid ?? '' } = {},
) => uploadBytes(ref(storageAs(uid), path), data, {
  contentType,
  customMetadata: { uploadedBy, title: 'Policy' },
})

const seedFile = (path: string) => env.withSecurityRulesDisabled(async ctx => {
  await uploadBytes(ref(ctx.storage() as unknown as FirebaseStorage, path), pdf, {
    contentType: 'application/pdf',
  })
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-is-legal-rules',
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearStorage()
  docId = `d${Date.now()}${Math.random().toString(36).slice(2, 8)}`
})

describe('uploads', () => {
  it('lets an org admin upload a PDF, text or markdown file', async () => {
    await assertSucceeds(upload('alice', docPath()))
    await assertSucceeds(upload('alice', docPath('acme', 'notes.md'), { contentType: 'text/markdown' }))
    await assertSucceeds(upload('alice', docPath('acme', 'law.txt'), { contentType: 'text/plain' }))
  })

  it('denies members and outsiders', async () => {
    await assertFails(upload('bob', docPath()))
    await assertFails(upload('nobody', docPath()))
    await assertFails(upload(null, docPath()))
  })

  it('denies an admin uploading into another org', async () => {
    await assertFails(upload('alice', docPath('globex')))
    await assertFails(upload('gus', docPath('acme')))
  })

  it('denies other file types and oversized files', async () => {
    await assertFails(upload('alice', docPath('acme', 'x.png'), { contentType: 'image/png' }))
    await assertFails(upload('alice', docPath('acme', 'x.exe'), { contentType: 'application/x-msdownload' }))
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    await assertFails(upload('alice', docPath(), { data: big }))
  })

  it('requires uploadedBy to be the uploader', async () => {
    await assertFails(upload('alice', docPath(), { uploadedBy: 'someone-else' }))
  })

  it('denies paths outside the document layout', async () => {
    await assertFails(upload('alice', `orgs/acme/other/${docId}.pdf`))
    await assertFails(upload('alice', `orgs/acme/documents/${docId}.pdf`))
  })
})

describe('existing files', () => {
  it('denies overwriting and deleting, even for admins', async () => {
    await seedFile(docPath())
    await assertFails(upload('alice', docPath()))
    await assertFails(deleteObject(ref(storageAs('alice'), docPath())))
  })

  it('lets anyone in the org read, and no one else', async () => {
    await seedFile(docPath())
    await assertSucceeds(getBytes(ref(storageAs('bob'), docPath())))
    await assertSucceeds(getBytes(ref(storageAs('alice'), docPath())))
    await assertFails(getBytes(ref(storageAs('gus'), docPath())))
    await assertFails(getBytes(ref(storageAs('nobody'), docPath())))
    await assertFails(getBytes(ref(storageAs(null), docPath())))
  })
})
