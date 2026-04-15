import { describe, expect, it } from "vitest";

import {
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopImageUploadRequest,
  createDesktopImageUploadSuccessResponse,
  getDesktopImageUploadChannel,
  isDesktopImageUploadRequestChannel,
  isDesktopImageUploadResponseChannel,
} from "..";

describe("desktop image upload ipc contract", () => {
  it("keeps operation identity and channel names derived from shared helpers", () => {
    expect(DESKTOP_IMAGE_UPLOAD_OPERATION).toBe("image.upload");
    expect(DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL).toEqual({
      operation: "image.upload",
      kind: "request",
      value: "ipc.image.upload.request",
    });
    expect(DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL).toEqual({
      operation: "image.upload",
      kind: "response",
      value: "ipc.image.upload.response",
    });
    expect(getDesktopImageUploadChannel("request")).toEqual(
      DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
    );
    expect(getDesktopImageUploadChannel("response")).toEqual(
      DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
    );
  });

  it("creates a minimal upload request payload for desktop ipc transport", () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);

    const request = createDesktopImageUploadRequest(
      {
        fileName: "  kitten.png  ",
        mediaType: " image/png ",
        bytes,
        boundary: {
          host: "desktop",
          source: "  desktop.renderer.upload-form  ",
        },
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );

    expect(request).toEqual({
      channel: "ipc.image.upload.request",
      operation: "image.upload",
      payload: {
        fileName: "kitten.png",
        mediaType: "image/png",
        bytes,
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
      metadata: undefined,
    });
    expect(isDesktopImageUploadRequestChannel(request.channel)).toBe(true);
    expect(isDesktopImageUploadResponseChannel(request.channel)).toBe(false);
  });

  it("creates an upload success response that returns storage descriptor details", () => {
    const response = createDesktopImageUploadSuccessResponse(
      {
        key: " workspace/ws-42/uploads/kitten.png ",
        mediaType: "image/png",
        sizeBytes: 1204,
      },
      {
        requestId: "req-upload-2",
      },
    );

    expect(response).toEqual({
      ok: true,
      value: {
        descriptor: {
          key: "workspace/ws-42/uploads/kitten.png",
          mediaType: "image/png",
          sizeBytes: 1204,
        },
      },
      requestId: "req-upload-2",
      correlationId: undefined,
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      metadata: undefined,
    });
    expect(isDesktopImageUploadResponseChannel(response.channel)).toBe(true);
    expect(isDesktopImageUploadRequestChannel(response.channel)).toBe(false);
  });

  it("rejects invalid request payload fields with basic validation errors", () => {
    expect(() =>
      createDesktopImageUploadRequest({
        fileName: "   ",
        mediaType: "image/png",
        bytes: new Uint8Array([1]),
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      }),
    ).toThrow("fileName must be a non-empty, trimmed string.");

    expect(() =>
      createDesktopImageUploadRequest({
        fileName: "kitten.png",
        mediaType: "image/png",
        bytes: new Uint8Array([]),
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      }),
    ).toThrow("bytes must contain at least one byte.");
  });
});
