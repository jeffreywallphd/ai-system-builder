import { describe, expect, it } from "../../../testing/node-test";

import {
  API_ARTIFACT_BROWSE_OPERATION,
  API_ARTIFACT_CONTENT_READ_OPERATION,
  API_ARTIFACT_READ_OPERATION,
  createApiArtifactBrowseRequest,
  createApiArtifactBrowseSuccessResponse,
  createApiArtifactContentReadRequest,
  createApiArtifactContentReadSuccessResponse,
  createApiArtifactReadRequest,
  createApiArtifactReadSuccessResponse,
} from "..";
import {
  ARTIFACT_BROWSE_OPERATION,
  ARTIFACT_CONTENT_READ_OPERATION,
  ARTIFACT_READ_OPERATION,
} from "../../artifact-browser";

describe("artifact-browser api contracts", () => {
  it("reuses canonical artifact-browser operation identity across api transport specialization", () => {
    expect(API_ARTIFACT_BROWSE_OPERATION).toBe(ARTIFACT_BROWSE_OPERATION);
    expect(API_ARTIFACT_READ_OPERATION).toBe(ARTIFACT_READ_OPERATION);
    expect(API_ARTIFACT_CONTENT_READ_OPERATION).toBe(ARTIFACT_CONTENT_READ_OPERATION);
  });

  it("keeps browse and detail responses metadata-oriented and content-read separate", () => {
    const browseResponse = createApiArtifactBrowseSuccessResponse({
      items: [
        {
          storageKey: " staged/images/artifact-21 ",
          artifactKind: "image",
          mediaType: " image/png ",
        },
      ],
    });

    const readResponse = createApiArtifactReadSuccessResponse({
      artifact: {
        locator: {
          storageKey: " staged/images/artifact-21 ",
        },
        artifactKind: "image",
        mediaType: " image/png ",
      },
    });

    const contentResponse = createApiArtifactContentReadSuccessResponse({
      content: {
        locator: {
          storageKey: " staged/images/artifact-21 ",
        },
        mediaType: " image/png ",
        content: new Uint8Array([137, 80, 78, 71]),
      },
    });

    expect(browseResponse).toMatchObject({
      ok: true,
      operation: "artifact.browse",
      value: {
        browse: {
          items: [
            {
              storageKey: "staged/images/artifact-21",
              artifactKind: "image",
              mediaType: "image/png",
            },
          ],
        },
      },
    });
    if (!browseResponse.ok) {
      throw new Error("Expected browse response to be successful.");
    }
    expect("content" in browseResponse.value.browse.items[0]).toBe(false);

    expect(readResponse).toMatchObject({
      ok: true,
      operation: "artifact.read",
      value: {
        read: {
          artifact: {
            locator: {
              storageKey: "staged/images/artifact-21",
            },
            artifactKind: "image",
            mediaType: "image/png",
          },
        },
      },
    });
    if (!readResponse.ok) {
      throw new Error("Expected read response to be successful.");
    }
    expect("content" in readResponse.value.read.artifact).toBe(false);

    expect(contentResponse).toMatchObject({
      ok: true,
      operation: "artifact.content.read",
      value: {
        read: {
          content: {
            locator: {
              storageKey: "staged/images/artifact-21",
            },
            mediaType: "image/png",
          },
        },
      },
    });
    if (!contentResponse.ok) {
      throw new Error("Expected content-read response to be successful.");
    }
    expect(contentResponse.value.read.content.content).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
  });

  it("keeps locator fields storage-key based and avoids filesystem path fields in request payloads", () => {
    const readRequest = createApiArtifactReadRequest({
      locator: {
        storageKey: " staged/images/artifact-22 ",
      },
      boundary: {
        host: "server",
        source: " api.artifact-read ",
      },
    });
    const contentRequest = createApiArtifactContentReadRequest({
      locator: {
        storageKey: " staged/images/artifact-22 ",
      },
      boundary: {
        host: "server",
        source: " api.artifact-content-read ",
      },
    });
    const browseRequest = createApiArtifactBrowseRequest({
      artifactKind: "image",
      boundary: {
        host: "server",
        source: " api.artifact-browse ",
      },
    });

    expect(readRequest.payload.locator.storageKey).toBe("staged/images/artifact-22");
    expect(contentRequest.payload.locator.storageKey).toBe("staged/images/artifact-22");
    expect(browseRequest.payload.artifactKind).toBe("image");
    expect("path" in readRequest.payload.locator).toBe(false);
    expect("path" in contentRequest.payload.locator).toBe(false);
  });
});
