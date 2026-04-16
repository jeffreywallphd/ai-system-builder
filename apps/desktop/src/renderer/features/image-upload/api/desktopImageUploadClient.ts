import {
  getDesktopApi,
  type DesktopImageUploadApi,
  type DesktopImageUploadInput,
  type DesktopImageUploadResult,
} from "../../../lib/desktopApi";

export interface ImageUploadClient {
  uploadImage: DesktopImageUploadApi["uploadImage"];
}

interface PreloadUploadResponseEnvelope {
  operation: string;
  channel: string;
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
}

function isPreloadUploadResponseEnvelope(value: unknown): value is PreloadUploadResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

function toRendererResult(response: unknown): DesktopImageUploadResult {
  if (!isPreloadUploadResponseEnvelope(response)) {
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Image upload failed.",
      },
    };
  }

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
  const desktopApi = getDesktopApi();

  return {
    async uploadImage(input: DesktopImageUploadInput): Promise<DesktopImageUploadResult> {
      const response = await desktopApi.uploadImage(input);
      return toRendererResult(response);
    },
  };
}
