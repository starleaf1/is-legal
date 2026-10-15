import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {logger} from "firebase-functions";
import {CHUNK_CHARS, CHUNK_OVERLAP} from "../config";
import {chunksCol, documentsCol, orgRef} from "../shared/paths";
import {CATEGORY_TO_SCOPE, CategorySchema} from "../shared/schemas";
import {chunkText} from "./chunk";
import {classifyDocument} from "./classify";
import {embedPassages} from "./embed";
import {extractText, normalizeContentType} from "./extract";

export interface IndexRequest {
  orgId: string;
  docId: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  // Custom metadata set by the uploader: title, uploadedBy, categoryHint.
  metadata: Record<string, string>;
}

export const chunkId = (docId: string, index: number) =>
  `${docId}_${String(index).padStart(4, "0")}`;

/**
 * Extracts, classifies, chunks and embeds one uploaded document, recording
 * progress and the outcome on orgs/{orgId}/documents/{docId}. Never throws:
 * failures are stored on the document so the admin UI can show them, and so
 * a storage trigger never retries in a loop.
 * @param {IndexRequest} request The uploaded object.
 */
export const indexDocument = async (request: IndexRequest) => {
  const {orgId, docId, storagePath, sizeBytes, metadata} = request;
  if (!(await orgRef(orgId).get()).exists) {
    logger.warn("Upload for an unknown org; ignoring", {orgId, storagePath});
    return;
  }

  const docRef = documentsCol(orgId).doc(docId);
  const fileName = storagePath.split("/").pop() ?? storagePath;
  const contentType = normalizeContentType(request.contentType, fileName);
  const uploaderTitle = metadata.title?.trim().slice(0, 200) || undefined;
  const hint = CategorySchema.safeParse(metadata.categoryHint);
  const categoryHint = hint.success ? hint.data : undefined;

  const existing = await docRef.get();
  await docRef.set({
    title: existing.get("title") ?? uploaderTitle ??
      fileName.replace(/\.[^.]+$/, ""),
    fileName,
    storagePath,
    mimeType: contentType,
    sizeBytes,
    uploadedBy: metadata.uploadedBy ?? null,
    status: "processing",
    stage: "extracting",
    error: FieldValue.delete(),
    ...(existing.exists ? {} : {createdAt: FieldValue.serverTimestamp()}),
  }, {merge: true});

  try {
    const [data] = await getStorage().bucket().file(storagePath).download();
    const extracted = await extractText(data, contentType, fileName);
    const fullText = extracted.pages.join("\n\n");
    if (fullText.trim().length < 20) {
      throw new Error("No readable text was found in this file.");
    }

    await docRef.update({
      stage: "classifying",
      pageCount: extracted.paged ? extracted.pages.length : null,
      extraction: extracted.method,
    });
    const classification = await classifyDocument({
      fileName,
      title: uploaderTitle,
      text: fullText,
      categoryHint,
    });
    const scope = CATEGORY_TO_SCOPE[classification.category];
    const title = uploaderTitle ?? classification.title;

    await docRef.update({
      stage: "embedding",
      title,
      classification: {...classification, scope},
    });
    const chunks = chunkText(extracted.pages, {
      paged: extracted.paged,
      markdown: extracted.markdown,
      maxChars: CHUNK_CHARS,
      overlap: CHUNK_OVERLAP,
    });
    if (!chunks.length) throw new Error("The document produced no passages.");
    const vectors = await embedPassages(
      chunks.map((c) => `${title}\n${c.heading ?? ""}\n\n${c.text}`),
      title
    );

    const writer = getFirestore().bulkWriter();
    const ids = new Set<string>();
    chunks.forEach((chunk, i) => {
      const id = chunkId(docId, i);
      ids.add(id);
      writer.set(chunksCol(orgId).doc(id), {
        documentId: docId,
        title,
        category: classification.category,
        scope,
        jurisdiction: classification.jurisdiction,
        effectiveDate: classification.effectiveDate,
        heading: chunk.heading,
        page: chunk.page,
        index: i,
        text: chunk.text,
        embedding: FieldValue.vector(vectors[i]),
      });
    });
    // Remove passages left over from a previous, longer version.
    const previous = await chunksCol(orgId)
      .where("documentId", "==", docId)
      .select()
      .get();
    previous.docs
      .filter((snap) => !ids.has(snap.id))
      .forEach((snap) => writer.delete(snap.ref));
    await writer.close();

    await docRef.update({
      status: "indexed",
      stage: FieldValue.delete(),
      chunkCount: chunks.length,
      indexedAt: FieldValue.serverTimestamp(),
    });
    logger.info("Indexed document", {
      orgId, docId, category: classification.category, chunks: chunks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Indexing failed", {orgId, docId, storagePath, error});
    // The document may have been deleted meanwhile; don't recreate it.
    await docRef.update({
      status: "error",
      stage: FieldValue.delete(),
      error: message.slice(0, 500),
    }).catch(() => undefined);
  }
};
