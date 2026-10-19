// Seeds a real Firebase project with the same orgs, users and sample
// documents as seed.ts, which only runs against the emulators. Uploads go
// through the deployed onDocumentUploaded trigger, so deploy first.
//
// Safe to re-run: existing users keep their passwords, files already in
// Storage are skipped, and nothing is deleted.
//
// Run with Admin SDK credentials for the project, e.g. a service account key
// kept outside the repo, and the password to give new users (unlike seed.ts,
// it isn't hardcoded: the accounts are real and this repo is public):
//   read -rs SEED_PASSWORD && export SEED_PASSWORD
//   SEED_PROJECT_ID=your-project-id \
//     GOOGLE_APPLICATION_CREDENTIALS=~/keys/your-project-id.json \
//     npx tsx scripts/seed-live.ts
// SEED_BUCKET overrides the default bucket ({project}.firebasestorage.app).
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

const PROJECT_ID = process.env.SEED_PROJECT_ID;
const PASSWORD = process.env.SEED_PASSWORD;
if (!PROJECT_ID || !PASSWORD) {
  console.error("Set SEED_PROJECT_ID to the project to seed and " +
    "SEED_PASSWORD to the password for new users.");
  process.exit(1);
}
const emulatorVars = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST"].filter((name) => process.env[name]);
if (emulatorVars.length) {
  console.error(`Unset ${emulatorVars.join(", ")}: this script seeds a ` +
    "real project. Use seed.ts for the emulators.");
  process.exit(1);
}

initializeApp({
  projectId: PROJECT_ID,
  storageBucket: process.env.SEED_BUCKET ??
    `${PROJECT_ID}.firebasestorage.app`,
});
const db = getFirestore();
const bucket = getStorage().bucket();

const SEED_DIR = join(__dirname, "..", "seed-data");
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

const upsertOrg = async (org: OrgSeed) => {
  const ref = db.doc(`orgs/${org.id}`);
  const exists = (await ref.get()).exists;
  await ref.set({
    name: org.name,
    defaultJurisdiction: org.defaultJurisdiction,
    ...(exists ? {} : {createdAt: FieldValue.serverTimestamp()}),
  }, {merge: true});
  return exists;
};

const upsertUser = async (
  orgId: string,
  user: OrgSeed["users"][number]
) => {
  const auth = getAuth();
  let created = false;
  const record = await auth.getUserByEmail(user.email).catch((error) => {
    if (error.code !== "auth/user-not-found") throw error;
    created = true;
    return auth.createUser({
      email: user.email,
      password: PASSWORD,
      displayName: user.displayName,
      emailVerified: true,
    });
  });
  await auth.setCustomUserClaims(record.uid, {orgId, role: user.role});
  await db.doc(`orgs/${orgId}/members/${record.uid}`).set({
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
  return {uid: record.uid, created};
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
    console.log(`  upload  ${fileName} -> ${docId}`);
  }
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
  console.log(`Seeding project ${PROJECT_ID} (bucket ${bucket.name})`);
  for (const org of ORGS) {
    const existed = await upsertOrg(org);
    console.log(`\n${org.name} (${org.id})` +
      (existed ? ", already exists" : ""));
    const uids = [];
    for (const user of org.users) {
      const {uid, created} = await upsertUser(org.id, user);
      uids.push(uid);
      console.log(`  user    ${user.email} (${user.role})` +
        (created ? "" : ", already exists"));
    }
    await uploadDocuments(org.id, uids[0]);
  }

  console.log("\nIndexing (runs in the deployed onDocumentUploaded)…");
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

  console.log(`\nSign in at https://${PROJECT_ID}.web.app with any of these ` +
    "(new users get SEED_PASSWORD):");
  ORGS.forEach((org) => org.users.forEach((user) =>
    console.log(`  ${user.email.padEnd(20)} ${org.name}, ${user.role}`)));
  if (failed) {
    console.log("\nSome documents didn't index. Check the logs with " +
      "`firebase functions:log --only onDocumentUploaded`.");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
