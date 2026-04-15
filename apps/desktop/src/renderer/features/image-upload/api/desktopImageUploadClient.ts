import {
  getDesktopPreloadApi,
  type DesktopImageUploadApi,
  type DesktopImageUploadInput,
  type DesktopImageUploadResult,
} from "../../../lib/desktopApi";

export interface ImageUploadClient {
  uploadImage: DesktopImageUploadApi["uploadImage"];
}

function toRendererResult(response: {
  ok: boolean;
  value?: {
    descriptor: {
      key: string;
      mediaType: string;
      sizeBytes: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}): DesktopImageUploadResult {
  if (response.ok && response.value) {
    return {
      ok: true,
      value: {
        descriptor: {
          key: response.value.descriptor.key,
          mediaType: response.value.descriptor.mediaType,
          sizeBytes: response.value.descriptor.sizeBytes,
        },
      },
    };
  }

  return {
    ok: false,
    error: {
      code: response.error?.code ?? "internal",
      message: response.error?.message ?? "Image upload failed.",
    },
  };
}

export function createDesktopImageUploadClient(): ImageUploadClient {
  const desktopPreloadApi = getDesktopPreloadApi();

  return {
    async uploadImage(input: DesktopImageUploadInput): Promise<DesktopImageUploadResult> {
      const response = await desktopPreloadApi.uploadImage(input);
      return toRendererResult(response);
    },
  };
}
