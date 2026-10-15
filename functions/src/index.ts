import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";
import {REGION} from "./config";

initializeApp();

// For cost control, cap the number of containers per function. Per-function
// options (memory, timeouts, secrets) are set where each function is defined.
setGlobalOptions({maxInstances: 10, region: REGION});

export {onDocumentUploaded} from "./indexing/trigger";
export {deleteDocument, reindexDocument} from "./documents/callables";
export {askIsLegal} from "./chat/flow";
