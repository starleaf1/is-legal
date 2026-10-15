import {logger} from "firebase-functions";
import {onObjectFinalized} from "firebase-functions/storage";
import {geminiKey} from "../genkit";
import {parseDocumentPath} from "../shared/paths";
import {indexDocument} from "./pipeline";

// Fires for every object written to the default bucket, whether uploaded by
// an org admin in the app (storage.rules check they're an admin of the org in
// the path) or by the seed script.
export const onDocumentUploaded = onObjectFinalized(
  {secrets: [geminiKey], memory: "1GiB", timeoutSeconds: 540},
  async (event) => {
    const {name, contentType, size, metadata} = event.data;
    const parsed = parseDocumentPath(name);
    if (!parsed) {
      logger.debug("Ignoring object outside orgs/*/documents", {name});
      return;
    }
    await indexDocument({
      orgId: parsed.orgId,
      docId: parsed.docId,
      storagePath: name,
      contentType: contentType ?? "",
      sizeBytes: Number(size),
      metadata: metadata ?? {},
    });
  }
);
