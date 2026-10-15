import {getFirestore} from "firebase-admin/firestore";

// Every tenant's data lives under orgs/{orgId}. Server code builds these
// paths from the caller's verified orgId claim, never from request data.

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const orgRef = (orgId: string) =>
  getFirestore().collection("orgs").doc(orgId);

export const documentsCol = (orgId: string) =>
  orgRef(orgId).collection("documents");

export const chunksCol = (orgId: string) =>
  orgRef(orgId).collection("chunks");

export const conversationsCol = (orgId: string) =>
  orgRef(orgId).collection("conversations");

export const messagesCol = (orgId: string, conversationId: string) =>
  conversationsCol(orgId).doc(conversationId).collection("messages");

export const documentPrefix = (orgId: string, docId: string) =>
  `orgs/${orgId}/documents/${docId}/`;

const SEGMENT = "[A-Za-z0-9_-]{1,128}";
const DOCUMENT_PATH = new RegExp(
  `^orgs/(${SEGMENT})/documents/(${SEGMENT})/([^/]{1,255})$`
);

/**
 * Parses a Storage object name of the form
 * orgs/{orgId}/documents/{docId}/{fileName}.
 * @param {string} name The object name.
 * @return {object|null} The parts, or null if the name doesn't match.
 */
export const parseDocumentPath = (name: string) => {
  const match = DOCUMENT_PATH.exec(name);
  if (!match) return null;
  const [, orgId, docId, fileName] = match;
  if (fileName === "." || fileName === "..") return null;
  return {orgId, docId, fileName};
};
