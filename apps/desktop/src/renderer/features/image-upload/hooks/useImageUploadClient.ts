import { useMemo } from "react";

import {
  createDesktopImageUploadClient,
  type ImageUploadClient,
} from "../api/desktopImageUploadClient";

export function useImageUploadClient(client?: ImageUploadClient): ImageUploadClient {
  return useMemo(() => client ?? createDesktopImageUploadClient(), [client]);
}
