import { afterEach, describe, expect, it, vi } from "vitest";

import { getDesktopImageUploadApi } from "../desktopImageUploadApi";
import type { DesktopImageUploadApi } from "../desktopImageUploadApi";

describe("desktopImageUploadApi bridge access", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("returns the preload-exposed desktop API when present", async () => {
    const uploadImage = vi.fn<DesktopImageUploadApi["uploadImage"]>().mockRejectedValue(
      new Error("not implemented"),
    );
    window.desktopApi = { uploadImage };

    const api = getDesktopImageUploadApi();

    expect(api).toBe(window.desktopApi);
    await expect(
      api.uploadImage({
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("not implemented");
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when preload has not exposed the desktop API", () => {
    expect(() => getDesktopImageUploadApi()).toThrow("Desktop preload API is unavailable.");
  });
});
