import type { DesktopImageUploadResponse } from "../../../../../../../modules/contracts/ipc";

import { getDesktopApi, type DesktopImageUploadApi } from "../../../lib/desktopApi";

export interface ImageUploadClient {
  uploadImage: DesktopImageUploadApi["uploadImage"];
}

export function createDesktopImageUploadClient(): ImageUploadClient {
  const desktopApi = getDesktopApi();

  return {
    uploadImage(input): Promise<DesktopImageUploadResponse> {
      return desktopApi.uploadImage(input);
    },
  };
}
