import Busboy from "busboy";

export interface MultipartImageUploadFile {
  originalName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface ParsedMultipartImageUploadRequest {
  file: MultipartImageUploadFile;
  source?: string;
}

interface MultipartRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, listener: (chunk?: Buffer | string) => void) => void;
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = headers?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeBusboyHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  const contentType = getHeaderValue(headers, "content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    throw new Error("multipart image upload requires a multipart/form-data content-type.");
  }

  return {
    "content-type": contentType,
  };
}

async function readRequestBodyBuffer(request: MultipartRequestLike): Promise<Buffer> {
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

export async function parseMultipartImageUploadRequest(
  request: MultipartRequestLike,
): Promise<ParsedMultipartImageUploadRequest> {
  const requestBodyBuffer = await readRequestBodyBuffer(request);

  return await new Promise<ParsedMultipartImageUploadRequest>((resolve, reject) => {
    const parser = Busboy({
      headers: normalizeBusboyHeaders(request.headers),
    });

    let parsedFile: MultipartImageUploadFile | undefined;
    let parsedSource: string | undefined;

    parser.on("file", (fieldName, stream, fileInfo) => {
      if (fieldName !== "file") {
        stream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => {
        parsedFile = {
          originalName: fileInfo.filename.trim(),
          mediaType: fileInfo.mimeType || "application/octet-stream",
          bytes: new Uint8Array(Buffer.concat(chunks)),
        };
      });
    });

    parser.on("field", (fieldName, value) => {
      if (fieldName === "source") {
        parsedSource = value;
      }
    });

    parser.on("error", reject);

    parser.on("close", () => {
      if (!parsedFile) {
        reject(new Error("multipart image upload requires a file field."));
        return;
      }

      resolve({
        file: parsedFile,
        source: parsedSource,
      });
    });

    parser.end(requestBodyBuffer);
  });
}
