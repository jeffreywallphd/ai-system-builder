export interface ThinClientImageUploadInput {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  source?: string;
}

export interface ThinClientImageUploadSuccessResult {
  ok: true;
  value: {
    descriptor: {
      key: string;
      mediaType?: string;
      sizeBytes?: number;
    };
  };
}

export interface ThinClientImageUploadFailureResult {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ThinClientImageUploadResult =
  | ThinClientImageUploadSuccessResult
  | ThinClientImageUploadFailureResult;

interface ApiResponseEnvelope {
  ok: boolean;
  value?: {
    descriptor?: {
      key?: string;
      mediaType?: string;
      sizeBytes?: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ApiImageUploadClient {
  uploadImage: (input: ThinClientImageUploadInput) => Promise<ThinClientImageUploadResult>;
}

export interface CreateApiImageUploadClientOptions {
  apiBaseUrl?: string;
}

const DEFAULT_UPLOAD_SOURCE = "thin-client.image-upload.form";

function isApiResponseEnvelope(value: unknown): value is ApiResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

function createUploadUrl(apiBaseUrl: string): string {
  const trimmedBaseUrl = apiBaseUrl.trim();
  const baseUrl = trimmedBaseUrl.length > 0 ? trimmedBaseUrl : "/api";
  return `${baseUrl.replace(/\/+$/, "")}/image/upload`;
}

function createHttpErrorMessage(response: Response): string {
  const normalizedStatusText = response.statusText.trim();
  if (normalizedStatusText.length > 0) {
    return `Image upload failed (${response.status} ${normalizedStatusText}).`;
  }

  return `Image upload failed (HTTP ${response.status}).`;
}

async function readApiResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function toRendererResult(responseBody: unknown): ThinClientImageUploadResult {
  if (!isApiResponseEnvelope(responseBody)) {
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Image upload failed.",
      },
    };
  }

  if (responseBody.ok && responseBody.value?.descriptor?.key) {
    return {
      ok: true,
      value: {
        descriptor: {
          key: responseBody.value.descriptor.key,
          mediaType: responseBody.value.descriptor.mediaType,
          sizeBytes: responseBody.value.descriptor.sizeBytes,
        },
      },
    };
  }

  return {
    ok: false,
    error: {
      code: responseBody.error?.code ?? "internal",
      message: responseBody.error?.message ?? "Image upload failed.",
    },
  };
}

function createUploadFormData(input: ThinClientImageUploadInput): FormData {
  const formData = new FormData();
  const file = new File([input.bytes], input.fileName, { type: input.mediaType });

  formData.append("file", file);
  formData.append("source", input.source ?? DEFAULT_UPLOAD_SOURCE);

  return formData;
}

export function createApiImageUploadClient(
  options: CreateApiImageUploadClientOptions = {},
): ApiImageUploadClient {
  const uploadUrl = createUploadUrl(options.apiBaseUrl ?? "/api");

  return {
    async uploadImage(input: ThinClientImageUploadInput): Promise<ThinClientImageUploadResult> {
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: createUploadFormData(input),
      });

      const responseBody = await readApiResponseBody(response);
      if (!response.ok && !isApiResponseEnvelope(responseBody)) {
        return {
          ok: false,
          error: {
            code: "internal",
            message: createHttpErrorMessage(response),
          },
        };
      }

      return toRendererResult(responseBody);
    },
  };
}
