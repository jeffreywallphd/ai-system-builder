import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiImageUploadClient } from "../api/apiImageUploadClient";

describe("api image upload client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends multipart upload requests to the express image-upload route and maps success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        operation: "image.upload",
        value: {
          descriptor: {
            storage: {
              key: "uploads/cat.png",
              mediaType: "image/png",
              sizeBytes: 3,
            },
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createApiImageUploadClient();
    const input = {
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    };

    const result = await client.uploadImage(input);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/image/upload");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);

    const formData = options.body as FormData;
    expect(formData.get("source")).toBe("thin-client.image-upload.form");
    const file = formData.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("cat.png");
    expect((file as File).type).toBe("image/png");

    expect(result).toEqual({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 3,
        },
      },
    });
  });

  it("maps api error envelopes into renderer-facing failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        ok: false,
        operation: "image.upload",
        error: {
          code: "validation",
          message: "mediaType must be an image media type.",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createApiImageUploadClient({ apiBaseUrl: "http://localhost:3000/api" });
    const result = await client.uploadImage({
      fileName: "bad.pdf",
      mediaType: "application/pdf",
      bytes: new Uint8Array([1, 2]),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/image/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });
  });

  it("returns a meaningful failure when the server returns a non-json error response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: vi.fn().mockRejectedValue(new Error("Unexpected token < in JSON")),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createApiImageUploadClient();
    const result = await client.uploadImage({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "internal",
        message: "Image upload failed (500 Internal Server Error).",
      },
    });
  });
});
