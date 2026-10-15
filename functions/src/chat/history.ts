import {
  type DocumentReference,
  FieldValue,
} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/https";
import type {MessageData} from "genkit";
import {HISTORY_TURNS} from "../config";
import {conversationsCol} from "../shared/paths";
import type {Answer, Citation, SearchRecord} from "../shared/schemas";

const makeTitle = (message: string) => {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}…` : oneLine;
};

/**
 * Returns the caller's conversation, creating one if no id is given. A
 * conversation belonging to someone else is reported as not found.
 * @param {string} orgId The caller's org.
 * @param {string} uid The caller.
 * @param {string|undefined} conversationId Existing conversation, if any.
 * @param {string} firstMessage Used as the title of a new conversation.
 * @return {Promise<object>} The conversation reference and whether it's new.
 */
export const getOrCreateConversation = async (
  orgId: string,
  uid: string,
  conversationId: string | undefined,
  firstMessage: string
) => {
  if (conversationId) {
    const ref = conversationsCol(orgId).doc(conversationId);
    const snap = await ref.get();
    if (!snap.exists || snap.get("uid") !== uid) {
      throw new HttpsError("not-found", "Conversation not found.");
    }
    return {ref, isNew: false};
  }
  const ref = conversationsCol(orgId).doc();
  await ref.set({
    uid,
    title: makeTitle(firstMessage),
    lastVerdict: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {ref, isNew: true};
};

// Earlier answers' [n] refs pointed at that turn's passages; drop them so the
// model doesn't reuse stale numbers.
const stripRefs = (text: string) => text.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "");

/**
 * Loads recent turns as plain-text model history.
 * @param {DocumentReference} conversation The conversation.
 * @return {Promise<MessageData[]>} Oldest first.
 */
export const loadHistory = async (
  conversation: DocumentReference
): Promise<MessageData[]> => {
  const snapshot = await conversation.collection("messages")
    .orderBy("createdAt", "desc")
    .limit(HISTORY_TURNS * 2)
    .get();
  return snapshot.docs.reverse().flatMap((doc): MessageData[] => {
    if (doc.get("role") === "user") {
      return [{role: "user", content: [{text: doc.get("content")}]}];
    }
    const answer = doc.get("answer") as Answer | undefined;
    if (!answer) return [];
    const text = [
      `Verdict: ${answer.verdict}. ${stripRefs(answer.summary)}`,
      stripRefs(answer.analysis),
      ...answer.conditions.map((c) => `- ${stripRefs(c)}`),
    ].join("\n\n");
    return [{role: "model", content: [{text}]}];
  });
};

export const addUserMessage = (
  conversation: DocumentReference,
  uid: string,
  content: string
) => conversation.collection("messages").add({
  uid,
  role: "user",
  content,
  createdAt: FieldValue.serverTimestamp(),
});

export const addAssistantMessage = async (
  conversation: DocumentReference,
  message: {
    uid: string;
    answer?: Answer;
    citations?: Citation[];
    searches: SearchRecord[];
    error?: string;
    model: string;
    latencyMs: number;
  }
) => {
  // Firestore rejects undefined fields.
  const fields = Object.fromEntries(
    Object.entries(message).filter(([, value]) => value !== undefined)
  );
  const ref = await conversation.collection("messages").add({
    role: "assistant",
    ...fields,
    createdAt: FieldValue.serverTimestamp(),
  });
  await conversation.update({
    updatedAt: FieldValue.serverTimestamp(),
    lastVerdict: message.answer?.verdict ?? null,
  });
  return ref;
};
