import { describe, expect, it } from "../../testing/node-test";

import {
  ARTIFACT_BROWSE_KINDS,
  ARTIFACT_BROWSE_OPERATION,
  ARTIFACT_CONTENT_READ_OPERATION,
  ARTIFACT_READ_OPERATION,
  createArtifactBrowserLocator,
  normalizeArtifactBrowseSuccessValue,
  normalizeArtifactContentReadSuccessValue,
  normalizeArtifactReadSuccessValue,
} from ".";

describe("artifact-browser contracts", () => {
  it("defines helper-driven operation identities for browse, read, and content-read", () => {
    expect(ARTIFACT_BROWSE_OPERATION).toBe("artifact.browse");
    expect(ARTIFACT_READ_OPERATION).toBe("artifact.read");
    expect(ARTIFACT_CONTENT_READ_OPERATION).toBe("artifact.content.read");
  });

  it("normalizes browse metadata items and preserves metadata-only browse shape", () => {
    const browse = normalizeArtifactBrowseSuccessValue({
      items: [
        {
          storageKey: " staged/images/kitten-1 ",
          artifactKind: "image",
          mediaType: " image/png ",
          sourceKind: " Upload ",
          originalName: " kitten.png ",
        },
      ],
    });

    expect(ARTIFACT_BROWSE_KINDS).toEqual(["image"]);
    expect(browse).toEqual({
      items: [
        {
          storageKey: "staged/images/kitten-1",
          artifactKind: "image",
          mediaType: "image/png",
          sizeBytes: undefined,
          sourceKind: "upload",
          originalName: "kitten.png",
          createdAt: undefined,
        },
      ],
    });
    expect("content" in browse.items[0]).toBe(false);
  });

  it("keeps detail and content read models distinct while sharing a storage-key locator", () => {
    const locator = createArtifactBrowserLocator(" staged/images/kitten-2 ");

    const detail = normalizeArtifactReadSuccessValue({
      artifact: {
        locator,
        artifactKind: "image",
        mediaType: " image/jpeg ",
        sourceKind: " upload ",
      },
    });

    const content = normalizeArtifactContentReadSuccessValue({
      content: {
        locator,
        mediaType: " image/jpeg ",
        content: new Uint8Array([255, 216, 255]),
      },
    });

    expect(detail.artifact.locator.storageKey).toBe("staged/images/kitten-2");
    expect(content.content.locator.storageKey).toBe("staged/images/kitten-2");
    expect("content" in detail.artifact).toBe(false);
    expect(content.content.content).toEqual(new Uint8Array([255, 216, 255]));
  });
});
