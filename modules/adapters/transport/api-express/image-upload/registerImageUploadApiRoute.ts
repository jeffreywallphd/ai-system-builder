import {
  API_IMAGE_UPLOAD_OPERATION,
  createApiImageUploadSuccessResponse,
  createApiError,
  createApiFailureResponse,
  type ApiImageUploadResponse,
} from "../../../../contracts/api";
import type {
  StoreImageUploadCommand,
  StoreImageUploadCommandContext,
  StoreImageUploadUseCaseResult,
} from "../../../../application/use-cases";

export interface StoreImageUploadUseCasePort {
  execute: (
    command: StoreImageUploadCommand,
    commandContext: StoreImageUploadCommandContext,
    context?: {
      requestId?: string;
      correlationId?: string;
    },
  ) => Promise<StoreImageUploadUseCaseResult>;
}

interface MultipartFileLike {
  originalname: string;
  mimetype: string;
  buffer: Uint8Array;
}

interface ApiImageUploadMultipartRequestBody {
  source?: string;
}

export interface ApiImageUploadJsonRequestBody {
  fileName: string;
  mediaType: string;
  bytes: number[];
  source: string;
}

export interface ExpressRequestLike {
  body?: ApiImageUploadJsonRequestBody | ApiImageUploadMultipartRequestBody;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, listener: (chunk?: Buffer | string) => void) => void;
}

export interface ExpressResponseLike {
  status: (statusCode: number) => ExpressResponseLike;
  json: (body: ApiImageUploadResponse) => void;
}

export interface ExpressPostRoutePort {
  post: (
    path: string,
    handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>,
  ) => void;
}

export interface RegisterImageUploadApiRouteDependencies {
  app: ExpressPostRoutePort;
  storeImageUploadUseCase: StoreImageUploadUseCasePort;
}

function getRequestHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = headers?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeSource(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "thin-client.image-upload.form";
  }

  return normalized;
}

function getMultipartBoundary(contentType: string | undefined): string | null {
  if (!contentType) {
    return null;
  }

  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  return boundary?.trim() || null;
}

async function readRequestBodyBuffer(request: ExpressRequestLike): Promise<Buffer> {
  if (!request.on) {
    return Buffer.alloc(0);
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on?.("data", (chunk) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
        return;
      }

      if (chunk) {
        chunks.push(chunk);
      }
    });

    request.on?.("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on?.("error", (error) => {
      reject(error);
    });
  });
}

function parseMultipartContentDisposition(value: string): {
  name?: string;
  filename?: string;
} {
  const nameMatch = /name="([^"]+)"/.exec(value);
  const fileNameMatch = /filename="([^"]+)"/.exec(value);

  return {
    name: nameMatch?.[1],
    filename: fileNameMatch?.[1],
  };
}

function parseMultipartUploadRequest(
  bodyBuffer: Buffer,
  boundary: string,
): {
  file?: MultipartFileLike;
  source?: string;
} {
  const sourceDelimiter = `--${boundary}`;
  const content = bodyBuffer.toString("latin1");
  const rawParts = content
    .split(sourceDelimiter)
    .slice(1, -1)
    .map((part) => part.replace(/^\r\n/, "").replace(/\r\n$/, ""))
    .filter((part) => part.length > 0);

  let source: string | undefined;
  let file: MultipartFileLike | undefined;

  for (const rawPart of rawParts) {
    const headerEnd = rawPart.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      continue;
    }

    const headersText = rawPart.slice(0, headerEnd);
    const dataText = rawPart.slice(headerEnd + 4).replace(/\r\n$/, "");
    const headers = headersText.split("\r\n");
    const dispositionHeader = headers.find((header) =>
      header.toLowerCase().startsWith("content-disposition:"),
    );

    if (!dispositionHeader) {
      continue;
    }

    const { name, filename } = parseMultipartContentDisposition(dispositionHeader);

    if (name === "source") {
      source = dataText;
      continue;
    }

    if (name === "file" && filename) {
      const contentTypeHeader = headers
        .find((header) => header.toLowerCase().startsWith("content-type:"))
        ?.split(":")[1]
        ?.trim();

      file = {
        originalname: filename,
        mimetype: contentTypeHeader ?? "application/octet-stream",
        buffer: new Uint8Array(Buffer.from(dataText, "latin1")),
      };
    }
  }

  return {
    file,
    source,
  };
}

async function extractMultipartUpload(
  request: ExpressRequestLike,
): Promise<{
  file?: MultipartFileLike;
  source?: string;
}> {
  const boundary = getMultipartBoundary(getRequestHeader(request.headers, "content-type"));

  if (!boundary) {
    return {};
  }

  const bodyBuffer = await readRequestBodyBuffer(request);
  return parseMultipartUploadRequest(bodyBuffer, boundary);
}

export function mapApiImageUploadRequestBody(
  requestBody: ApiImageUploadJsonRequestBody,
): {
  command: StoreImageUploadCommand;
  commandContext: StoreImageUploadCommandContext;
} {
  return {
    command: {
      fileName: requestBody.fileName,
      mediaType: requestBody.mediaType,
      bytes: new Uint8Array(requestBody.bytes),
    },
    commandContext: {
      source: requestBody.source,
    },
  };
}

function mapMultipartImageUploadRequest(
  multipartUpload: {
    file?: MultipartFileLike;
    source?: string;
  },
): {
  command: StoreImageUploadCommand;
  commandContext: StoreImageUploadCommandContext;
} {
  if (!multipartUpload.file) {
    throw new Error("multipart image upload requires a file field.");
  }

  return {
    command: {
      fileName: multipartUpload.file.originalname,
      mediaType: multipartUpload.file.mimetype,
      bytes: multipartUpload.file.buffer,
    },
    commandContext: {
      source: normalizeSource(multipartUpload.source),
    },
  };
}

export async function mapApiImageUploadRequest(
  request: ExpressRequestLike,
): Promise<{
  command: StoreImageUploadCommand;
  commandContext: StoreImageUploadCommandContext;
}> {
  const multipartBoundary = getMultipartBoundary(getRequestHeader(request.headers, "content-type"));
  if (multipartBoundary) {
    const multipartUpload = await extractMultipartUpload(request);
    return mapMultipartImageUploadRequest(multipartUpload);
  }

  return mapApiImageUploadRequestBody(request.body as ApiImageUploadJsonRequestBody);
}

export function mapStoreImageUploadResultToApiResponse(
  result: StoreImageUploadUseCaseResult,
  context: {
    requestId?: string;
    correlationId?: string;
  },
): ApiImageUploadResponse {
  if (result.ok) {
    return createApiImageUploadSuccessResponse(result.value.descriptor, {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    });
  }

  return createApiFailureResponse(
    createApiError(
      API_IMAGE_UPLOAD_OPERATION,
      result.error.code,
      result.error.message,
      {
        details: result.error.details,
        requestId: result.requestId ?? context.requestId,
        correlationId: result.correlationId ?? context.correlationId,
      },
    ),
    {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    },
  );
}

function resolveStatusCode(response: ApiImageUploadResponse): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error.kind) {
    case "client":
      return 400;
    case "transient":
      return 503;
    default:
      return 500;
  }
}

export function registerImageUploadApiRoute(
  dependencies: RegisterImageUploadApiRouteDependencies,
): void {
  dependencies.app.post("/api/image/upload", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");

    let mapping;

    try {
      mapping = await mapApiImageUploadRequest(request);
    } catch (error) {
      const apiResponse = createApiFailureResponse(
        createApiError(
          API_IMAGE_UPLOAD_OPERATION,
          "validation",
          error instanceof Error ? error.message : "Invalid upload request.",
          {
            requestId,
            correlationId,
          },
        ),
        {
          requestId,
          correlationId,
        },
      );

      response.status(resolveStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.storeImageUploadUseCase.execute(
      mapping.command,
      mapping.commandContext,
      {
        requestId,
        correlationId,
      },
    );

    const apiResponse = mapStoreImageUploadResultToApiResponse(result, {
      requestId,
      correlationId,
    });

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });
}
