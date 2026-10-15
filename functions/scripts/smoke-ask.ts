// End-to-end check of the chat agent on the emulators: signs in as seeded
// users through the Auth emulator, calls the askIsLegal callable over HTTP,
// and checks that every citation belongs to the caller's org.
//
// Run (emulators running and seeded): pnpm smoke:ask
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {REGION} from "../src/config";
import type {AskResult} from "../src/shared/schemas";

const PROJECT_ID = "demo-is-legal";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

initializeApp({projectId: PROJECT_ID});
const db = getFirestore();

interface Case {
  email: string;
  orgId: string;
  question: string;
  expect: string[];
  // Phrases that must not appear (another tenant's content).
  forbidden?: RegExp;
}

const CASES: Case[] = [
  {
    email: "member@acme.test",
    orgId: "acme",
    question: "A vendor offered me courtside basketball tickets worth $400. " +
      "They won't be attending. Can I accept?",
    expect: ["prohibited", "permitted_with_conditions", "needs_more_info"],
  },
  {
    email: "member@acme.test",
    orgId: "acme",
    question: "A customs officer says he can clear our shipment today if I " +
      "pay him $20 in cash. Can I?",
    expect: ["prohibited"],
  },
  {
    email: "member@acme.test",
    orgId: "acme",
    question: "Can I paste our customer list into a public AI chatbot to " +
      "draft follow-up emails?",
    expect: ["prohibited"],
  },
  {
    email: "member@acme.test",
    orgId: "acme",
    question: "Can I use my Platinum Hospitality Allowance to take a client " +
      "on a resort trip?",
    expect: ["unclear", "prohibited", "needs_more_info"],
    forbidden: /Globex|2,000 per (calendar )?year|USD 500|\$500|Vice Pres/i,
  },
  {
    email: "admin@globex.test",
    orgId: "globex",
    question: "What's the gift limit for client gifts?",
    expect: ["permitted", "permitted_with_conditions"],
  },
];

const signIn = async (email: string) => {
  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/` +
      "accounts:signInWithPassword?key=demo-key",
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password: "password123",
        returnSecureToken: true}),
    }
  );
  const body = await response.json() as {idToken?: string};
  if (!body.idToken) throw new Error(`Sign-in failed for ${email}`);
  return body.idToken;
};

const ask = async (idToken: string, message: string) => {
  const response = await fetch(
    `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/askIsLegal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({data: {message}}),
    }
  );
  const body = await response.json() as {result?: AskResult; error?: unknown};
  if (!body.result) {
    throw new Error(`askIsLegal failed: ${JSON.stringify(body.error)}`);
  }
  return body.result;
};

const main = async () => {
  let failures = 0;
  for (const c of CASES) {
    console.log(`\n[${c.email}] ${c.question}`);
    const started = Date.now();
    const result = await ask(await signIn(c.email), c.question);
    const {answer, citations} = result;
    console.log(`  verdict: ${answer.verdict} (${answer.confidence}), ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(`  summary: ${answer.summary}`);
    citations.forEach((citation) =>
      console.log(`  [${citation.ref}] ${citation.title}` +
        `${citation.heading ? ` › ${citation.heading}` : ""}`));

    const problems: string[] = [];
    if (!c.expect.includes(answer.verdict)) {
      problems.push(`expected ${c.expect.join(" or ")}`);
    }
    for (const citation of citations) {
      const doc = await db
        .doc(`orgs/${c.orgId}/documents/${citation.documentId}`)
        .get();
      if (!doc.exists) {
        problems.push(`citation ${citation.documentId} is not in ${c.orgId}`);
      }
    }
    if (c.forbidden?.test(JSON.stringify(answer))) {
      problems.push("answer contains another tenant's content");
    }
    if (problems.length) {
      failures++;
      console.log(`  FAIL: ${problems.join("; ")}`);
    } else {
      console.log("  ok");
    }
  }
  console.log(`\n${CASES.length - failures}/${CASES.length} passed`);
  if (failures) process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
