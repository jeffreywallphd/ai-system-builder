import { describe, expect, it, vi } from "vitest";

import { createDesktopImageUploadSuccessResponse } from "../../../../../../../modules/contracts/ipc";

import { createDesktopImageUploadClient } from "../api/desktopImageUploadClient";

describe("desktop image upload client", () => {
  it("delegates upload requests through the preload-exposed desktop API", async () => {
    const uploadImage = vi.fn().mockResolvedValue(
      createDesktopImageUploadSuccessResponse({
        key: "uploads/cat.png",
        mediaType: "image/png",
        sizeBytes: 3,
      }),
    );

    window.desktopApi = { uploadImage };

    const client = createDesktopImageUploadClient();
    const input = {
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    };

    const response = await client.uploadImage(input);

    expect(uploadImage).toHaveBeenCalledWith(input);
    expect(response.ok).toBe(true);
  });
});
