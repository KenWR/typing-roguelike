import { handleWorkerRequest } from "./worker/http.ts";

export { handleWorkerRequest };

export default {
  fetch: handleWorkerRequest,
};
