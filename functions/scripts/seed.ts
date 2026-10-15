// Seeds the Firebase emulators with two orgs, users with custom claims, and
// the sample documents in seed-data/. Uploads go through the real pipeline:
// each file lands at orgs/{orgId}/documents/{docId}/{file} and the
// onDocumentUploaded trigger indexes it, so the functions emulator must be
// running (`pnpm emulators`).
//
// Run: pnpm seed            (skips files already uploaded)
//      pnpm seed -- --reset (deletes and re-uploads each org's documents)
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

const PROJECT_ID = "demo-is-legal";
process.env.GCLOUD_PROJECT ??= PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
if (!process.env.GCLOUD_PROJECT.startsWith("demo-")) {
  console.error("Refusing to seed a non-demo project.");
  process.exit(1);
}

initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com`,
});
const db = getFirestore();
const bucket = getStorage().bucket();

const PASSWORD = "password123";
const SEED_DIR = join(__dirname, "..", "seed-data");
const RESET = process.argv.includes("--reset");
const TIMEOUT_MS = Number(process.env.SEED_TIMEOUT_MS ?? 4 * 60_000);

interface OrgSeed {
  id: string;
  name: string;
  defaultJurisdiction: string | null;
  users: Array<{email: string; displayName: string; role: "admin" | "member"}>;
}

const ORGS: OrgSeed[] = [
  {
    id: "acme",
    name: "Acme Corp",
    defaultJurisdiction: "Northland",
    users: [
      {email: "admin@acme.test", displayName: "Ada Admin", role: "admin"},
      {email: "member@acme.test", displayName: "Max Member", role: "member"},
      {email: "member2@acme.test", displayName: "Mia Member", role: "member"},
    ],
  },
  {
    id: "globex",
    name: "Globex Inc",
    defaultJurisdiction: null,
    users: [
      {email: "admin@globex.test", displayName: "Gus Admin", role: "admin"},
    ],
  },
];

const upsertUser = async (
  orgId: string,
  user: OrgSeed["users"][number]
) => {
  const auth = getAuth();
  const record = await auth.getUserByEmail(user.email).catch(() =>
    auth.createUser({
      email: user.email,
      password: PASSWORD,
      displayName: user.displayName,
      emailVerified: true,
    }));
  await auth.setCustomUserClaims(record.uid, {orgId, role: user.role});
  await db.doc(`orgs/${orgId}/members/${record.uid}`).set({
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
  return record.uid;
};

const resetOrgDocuments = async (orgId: string) => {
  await bucket.deleteFiles({prefix: `orgs/${orgId}/documents/`});
  for (const collection of ["documents", "chunks"]) {
    await db.recursiveDelete(db.collection(`orgs/${orgId}/${collection}`));
  }
};

const titleOf = (markdown: string, fileName: string) =>
  /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ??
  fileName.replace(/\.[^.]+$/, "");

const uploadDocuments = async (orgId: string, uploadedBy: string) => {
  const dir = join(SEED_DIR, orgId);
  const files = readdirSync(dir).filter((f) => /\.(md|txt)$/.test(f)).sort();
  // Check Storage rather than Firestore: the document records only appear
  // once the trigger has run.
  const [existing] = await bucket.getFiles({
    prefix: `orgs/${orgId}/documents/`,
  });
  const existingNames = new Set(existing.map((f) => f.name.split("/").pop()));
  const uploaded: string[] = [];
  for (const fileName of files) {
    if (existingNames.has(fileName)) {
      console.log(`  skip    ${fileName} (already uploaded)`);
      continue;
    }
    const docId = db.collection("_").doc().id;
    const content = readFileSync(join(dir, fileName));
    await bucket.file(`orgs/${orgId}/documents/${docId}/${fileName}`).save(
      content,
      {
        contentType: fileName.endsWith(".md") ? "text/markdown" : "text/plain",
        metadata: {
          metadata: {title: titleOf(content.toString("utf8"), fileName),
            uploadedBy},
        },
      }
    );
    uploaded.push(docId);
    console.log(`  upload  ${fileName} -> ${docId}`);
  }
  return uploaded;
};

// Waits until every uploaded file has a document record (created by the
// trigger) that is no longer processing.
const waitForIndexing = async (orgId: string) => {
  const started = Date.now();
  const [files] = await bucket.getFiles({prefix: `orgs/${orgId}/documents/`});
  for (;;) {
    const snapshot = await db.collection(`orgs/${orgId}/documents`).get();
    const done = snapshot.docs
      .filter((d) => d.get("status") !== "processing").length;
    const waiting = Math.max(files.length - done, 0);
    if (!waiting || Date.now() - started > TIMEOUT_MS) return snapshot;
    process.stdout.write(`\r  waiting for ${waiting} document(s)…  `);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

const main = async () => {
  for (const org of ORGS) {
    console.log(`\n${org.name} (${org.id})`);
    await db.doc(`orgs/${org.id}`).set({
      name: org.name,
      defaultJurisdiction: org.defaultJurisdiction,
      createdAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    const uids = [];
    for (const user of org.users) {
      uids.push(await upsertUser(org.id, user));
      console.log(`  user    ${user.email} (${user.role})`);
    }
    if (RESET) {
      await resetOrgDocuments(org.id);
      console.log("  reset   deleted existing documents");
    }
    await uploadDocuments(org.id, uids[0]);
  }

  console.log("\nIndexing (the functions emulator must be running)…");
  let failed = false;
  for (const org of ORGS) {
    const snapshot = await waitForIndexing(org.id);
    process.stdout.write("\r");
    console.log(`\n${org.name}`);
    for (const doc of snapshot.docs) {
      const status = doc.get("status") ?? "missing";
      const category = doc.get("classification.category") ?? "-";
      const detail = status === "error" ?
        doc.get("error") :
        `${category}, ${doc.get("chunkCount") ?? 0} chunks`;
      if (status !== "indexed") failed = true;
      console.log(`  ${status.padEnd(10)} ${doc.get("fileName")}: ${detail}`);
    }
    if (!snapshot.size) {
      failed = true;
      console.log("  no documents found");
    }
  }

  console.log("\nSign in at http://localhost:3000 with any of these " +
    `(password "${PASSWORD}"):`);
  ORGS.forEach((org) => org.users.forEach((user) =>
    console.log(`  ${user.email.padEnd(20)} ${org.name}, ${user.role}`)));
  if (failed) {
    console.log("\nSome documents didn't index. Check the functions logs " +
      "in the Emulator UI (http://127.0.0.1:4000/logs).");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
