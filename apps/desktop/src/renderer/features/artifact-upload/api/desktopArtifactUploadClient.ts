import {
  getDesktopApi,
  type DesktopArtifactUploadApi,
  type DesktopArtifactUploadInput,
  type DesktopArtifactUploadResult,
} from "../../../lib/desktopApi";

export interface ArtifactUploadAcceptedTypePolicy {
  acceptedMediaTypes: readonly string[];
  acceptedExtensions: readonly string[];
}

export interface ArtifactUploadClient {
  uploadArtifact: DesktopArtifactUploadApi["uploadArtifact"];
  getAcceptedTypes: () => Promise<ArtifactUploadAcceptedTypePolicy>;
}

interface PreloadUploadResponseEnvelope {
  operation: string;
  channel: string;
  ok: boolean;
  value?: {
    descriptor: {
      storage: {
        key: string;
        mediaType: string;
        sizeBytes: number;
      };
    };
    policy?: ArtifactUploadAcceptedTypePolicy;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

function isPreloadUploadResponseEnvelope(value: unknown): value is PreloadUploadResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

function toRendererResult(response: unknown): DesktopArtifactUploadResult {
  if (!isPreloadUploadResponseEnvelope(response)) {
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Artifact upload failed.",
      },
    };
  }

  if (response.ok && response.value) {
    return {
      ok: true,
      value: {
        descriptor: {
          key: response.value.descriptor.storage.key,
          mediaType: response.value.descriptor.storage.mediaType,
          sizeBytes: response.value.descriptor.storage.sizeBytes,
        },
      },
    };
  }

  return {
    ok: false,
    error: {
      code: response.error?.code ?? "internal",
      message: response.error?.message ?? "Artifact upload failed.",
    },
  };
}

export function createDesktopArtifactUploadClient(): ArtifactUploadClient {
  const desktopApi = getDesktopApi();

  return {
    async uploadArtifact(input: DesktopArtifactUploadInput): Promise<DesktopArtifactUploadResult> {
      const response = await desktopApi.uploadArtifact(input);
      return toRendererResult(response);
    },
    async getAcceptedTypes(): Promise<ArtifactUploadAcceptedTypePolicy> {
      const response = await desktopApi.getArtifactUploadPolicy();
      if (!isPreloadUploadResponseEnvelope(response) || !response.ok || !response.value?.policy) {
        throw new Error("Failed to read accepted artifact upload types.");
      }

      return response.value.policy;
    },
  };
}
