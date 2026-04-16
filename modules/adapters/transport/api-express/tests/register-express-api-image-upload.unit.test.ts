import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { createContractError } from "../../../../contracts/shared";
import {
  mapApiImageUploadRequest,
  mapApiImageUploadRequestBody,
  mapStoreImageUploadResultToApiResponse,
  registerImageUploadApiRoute,
  type ExpressPostRoutePort,
  type StoreImageUploadUseCasePort,
} from "../image-upload/registerImageUploadApiRoute";

function createUseCaseStub(
  executeImpl?: ReturnType<typeof vi.fn<StoreImageUploadUseCasePort["execute"]>>,
): StoreImageUploadUseCasePort {
  return {
    execute:
      executeImpl
      ?? vi
        .fn<StoreImageUploadUseCasePort["execute"]>()
        .mockRejectedValue(new Error("Missing execute mock implementation.")),
  };
}

function createMultipartRequest(
  boundary: string,
  bytes: number[],
  options?: {
    fileName?: string;
    mediaType?: string;
    source?: string;
  },
): {
  body: undefined;
  headers: Record<string, string>;
  on: (event: string, listener: (chunk?: Buffer) => void) => void;
} {
  const fileName = options?.fileName ?? "cat.png";
  const mediaType = options?.mediaType ?? "image/png";
  const source = options?.source ?? "web.upload.multipart";

  const start =
    `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="source"\r\n\r\n`
    + `${source}\r\n`
    + `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
    + `Content-Type: ${mediaType}\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(start, "utf8"), Buffer.from(bytes), Buffer.from(end, "utf8")]);

  return {
    body: undefined,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    on(event, listener) {
      if (event === "data") {
        listener(body);
      }

      if (event === "end") {
        listener();
      }
    },
  };
}

describe("registerImageUploadApiRoute", () => {
  it("maps legacy json api request payload into application command and command context", () => {
    const mapping = mapApiImageUploadRequestBody({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: [137, 80, 78, 71],
      source: "web.upload.form",
    });

    expect(mapping).toEqual({
      command: {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      commandContext: {
        source: "web.upload.form",
      },
    });
  });

  it("maps multipart request payload into application command and command context", async () => {
    const mapping = await mapApiImageUploadRequest(
      createMultipartRequest("unit-test-boundary", [137, 80, 78, 71]),
    );

    expect(mapping).toEqual({
      command: {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      commandContext: {
        source: "web.upload.multipart",
      },
    });
  });

  it("maps store-image-upload use-case success into an api success envelope", () => {
    const response = mapStoreImageUploadResultToApiResponse(
      {
        ok: true,
        value: {
          descriptor: {
            storage: {
              key: "uploads/cat.png",
              mediaType: "image/png",
              sizeBytes: 4,
            },
            sourceKind: "upload",
          },
        },
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );

    expect(response).toEqual({
      ok: true,
      operation: "image.upload",
      value: {
        descriptor: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
      metadata: undefined,
    });
  });

  it("maps store-image-upload use-case failure into an api failure envelope", () => {
    const response = mapStoreImageUploadResultToApiResponse(
      {
        ok: false,
        error: createContractError("validation", "mediaType must be an image media type.", {
          details: {
            field: "mediaType",
          },
        }),
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
      },
      {
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
      },
    );

    expect(response).toEqual({
      ok: false,
      operation: "image.upload",
      error: {
        operation: "image.upload",
        code: "validation",
        message: "mediaType must be an image media type.",
        details: {
          field: "mediaType",
        },
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
        metadata: undefined,
        kind: "client",
      },
      requestId: "req-upload-2",
      correlationId: "corr-upload-2",
      metadata: undefined,
    });
  });

  it("registers upload route and maps request headers to the use case", async () => {
    let registeredPath: string | undefined;
    let registeredHandler:
      | ((
        request: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[0],
        response: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[1],
      ) => Promise<void>)
      | undefined;

    const app: ExpressPostRoutePort = {
      post: vi.fn((path, handler) => {
        registeredPath = path;
        registeredHandler = handler;
      }),
    };

    const execute = vi.fn<StoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
      },
      requestId: "req-upload-3",
      correlationId: "corr-upload-3",
    });

    registerImageUploadApiRoute({
      app,
      storeImageUploadUseCase: createUseCaseStub(execute),
    });

    expect(app.post).toHaveBeenCalledOnce();
    expect(registeredPath).toBe("/api/image/upload");
    expect(registeredHandler).toBeTypeOf("function");

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await registeredHandler?.(
      {
        ...createMultipartRequest("route-test-boundary", [137, 80, 78, 71], {
          source: "server.web.upload-form",
        }),
        headers: {
          "content-type": "multipart/form-data; boundary=route-test-boundary",
          "x-request-id": "req-upload-3",
          "x-correlation-id": "corr-upload-3",
        },
      },
      {
        status,
        json,
      },
    );

    expect(execute).toHaveBeenCalledWith(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        source: "server.web.upload-form",
      },
      {
        requestId: "req-upload-3",
        correlationId: "corr-upload-3",
      },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      operation: "image.upload",
      value: {
        descriptor: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
      },
      requestId: "req-upload-3",
      correlationId: "corr-upload-3",
      metadata: undefined,
    });
  });

  it("returns a validation error envelope when multipart file is missing", async () => {
    let registeredHandler:
      | ((request: unknown, response: { status: (statusCode: number) => unknown; json: (body: unknown) => void }) => Promise<void>)
      | undefined;

    const app: ExpressPostRoutePort = {
      post: vi.fn((_path, handler) => {
        registeredHandler = handler as typeof registeredHandler;
      }),
    };

    registerImageUploadApiRoute({
      app,
      storeImageUploadUseCase: createUseCaseStub(),
    });

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await registeredHandler?.(
      {
        ...createMultipartRequest("missing-file-boundary", [], { source: "thin-client.image-upload.form" }),
        on(event, listener) {
          if (event === "data") {
            listener(Buffer.from("--missing-file-boundary--\r\n"));
          }
          if (event === "end") {
            listener();
          }
        },
      },
      {
        status,
        json,
      },
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        operation: "image.upload",
        error: expect.objectContaining({
          code: "validation",
          message: "multipart image upload requires a file field.",
        }),
      }),
    );
  });
});

describe("registerExpressApi top-level aggregator surface", () => {
  it("remains a tiny registration-only aggregator without feature helper re-exports", () => {
    const aggregatorPath = fileURLToPath(new URL("../registerExpressApi.ts", import.meta.url));
    const source = readFileSync(aggregatorPath, "utf8");

    expect(source).not.toContain("export type");
    expect(source).not.toContain("mapApiImageUploadRequestBody");
    expect(source).not.toContain("mapStoreImageUploadResultToApiResponse");
  });
});
