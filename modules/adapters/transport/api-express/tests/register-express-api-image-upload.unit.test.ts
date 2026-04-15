import { describe, expect, it } from "vitest";

import { createContractError } from "../../../../contracts/shared";
import {
  mapApiImageUploadRequestToCommand,
  mapStoreImageUploadResultToApiResponse,
} from "../registerExpressApi";

describe("registerExpressApi image upload mappings", () => {
  it("maps api request payload into the store image upload command", () => {
    const command = mapApiImageUploadRequestToCommand({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: [137, 80, 78, 71],
      source: "web.upload.form",
    });

    expect(command).toEqual({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
  });

  it("maps store-image-upload use-case success into an api success envelope", () => {
    const response = mapStoreImageUploadResultToApiResponse(
      {
        ok: true,
        value: {
          descriptor: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
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
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
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
});
