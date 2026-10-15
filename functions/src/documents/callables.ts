import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {HttpsError, onCall} from "firebase-functions/https";
import {geminiKey} from "../genkit";
import {indexDocument} from "../indexing/pipeline";
import {requireAdmin} from "../shared/auth";
import {
  chunksCol,
  documentPrefix,
  documentsCol,
  ID_PATTERN,
} from "../shared/paths";

const parseDocumentId = (data: unknown) => {
  const documentId = (data as {documentId?: unknown})?.documentId;
  if (typeof documentId !== "string" || !ID_PATTERN.test(documentId)) {
    throw new HttpsError("invalid-argument", "documentId is required.");
  }
  return documentId;
};

// Both callables build every path from the caller's orgId claim, so an admin
// can only ever touch their own org's documents.

export const deleteDocument = onCall(async ({auth, data}) => {
  const {orgId} = requireAdmin(auth);
  const documentId = parseDocumentId(data);
  const docRef = documentsCol(orgId).doc(documentId);
  if (!(await docRef.get()).exists) {
    throw new HttpsError("not-found", "Document not found.");
  }

  await getStorage().bucket().deleteFiles({
    prefix: documentPrefix(orgId, documentId),
  });
  const chunks = await chunksCol(orgId)
    .where("documentId", "==", documentId)
    .select()
    .get();
  const writer = getFirestore().bulkWriter();
  chunks.docs.forEach((snap) => writer.delete(snap.ref));
  writer.delete(docRef);
  await writer.close();
  return {deleted: true, chunks: chunks.size};
});

export const reindexDocument = onCall(
  {secrets: [geminiKey], memory: "1GiB", timeoutSeconds: 540},
  async ({auth, data}) => {
    const {orgId} = requireAdmin(auth);
    const documentId = parseDocumentId(data);
    const docRef = documentsCol(orgId).doc(documentId);
    const snap = await docRef.get();
    const storagePath = snap.get("storagePath");
    if (
      !snap.exists ||
      typeof storagePath !== "string" ||
      !storagePath.startsWith(documentPrefix(orgId, documentId))
    ) {
      throw new HttpsError("not-found", "Document not found.");
    }

    const file = getStorage().bucket().file(storagePath);
    const [metadata] = await file.getMetadata();
    await indexDocument({
      orgId,
      docId: documentId,
      storagePath,
      contentType: metadata.contentType ?? snap.get("mimeType") ?? "",
      sizeBytes: Number(metadata.size ?? snap.get("sizeBytes") ?? 0),
      metadata: Object.fromEntries(
        Object.entries(metadata.metadata ?? {})
          .map(([key, value]) => [key, String(value)])
      ),
    });
    const after = await docRef.get();
    return {status: after.get("status"), error: after.get("error") ?? null};
  }
);
