import { useMemo } from "react";

import { resolveApiBaseUrl } from "../../../lib";
import {
  createApiImageUploadClient,
  type ApiImageUploadClient,
} from "../api/apiImageUploadClient";

export function useImageUploadClient(client?: ApiImageUploadClient): ApiImageUploadClient {
  return useMemo(
    () => client ?? createApiImageUploadClient({ apiBaseUrl: resolveApiBaseUrl() }),
    [client],
  );
}
