import { describe, expect, it } from "../../../testing/node-test";

import {
  DESKTOP_ARTIFACT_BROWSE_OPERATION,
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_OPERATION,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_READ_OPERATION,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopArtifactBrowseSuccessResponse,
  createDesktopArtifactContentReadRequest,
  createDesktopArtifactContentReadSuccessResponse,
  createDesktopArtifactReadRequest,
  createDesktopArtifactReadSuccessResponse,
} from "..";
import {
  ARTIFACT_BROWSE_OPERATION,
  ARTIFACT_CONTENT_READ_OPERATION,
  ARTIFACT_READ_OPERATION,
} from "../../artifact-browser";

describe("desktop artifact-browser ipc contract", () => {
  it("reuses canonical operation identity and helper-derived channel naming for read operations", () => {
    expect(DESKTOP_ARTIFACT_BROWSE_OPERATION).toBe(ARTIFACT_BROWSE_OPERATION);
    expect(DESKTOP_ARTIFACT_READ_OPERATION).toBe(ARTIFACT_READ_OPERATION);
    expect(DESKTOP_ARTIFACT_CONTENT_READ_OPERATION).toBe(ARTIFACT_CONTENT_READ_OPERATION);

    expect(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value).toBe(
      "ipc.artifact.browse.request",
    );
    expect(DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL.value).toBe(
      "ipc.artifact.browse.response",
    );
    expect(DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value).toBe(
      "ipc.artifact.read.request",
    );
    expect(DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL.value).toBe(
      "ipc.artifact.read.response",
    );
    expect(DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value).toBe(
      "ipc.artifact.content.read.request",
    );
    expect(DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL.value).toBe(
      "ipc.artifact.content.read.response",
    );
  });

  it("keeps browse and detail payloads metadata-oriented while content-read stays descriptor-oriented", () => {
    const browseResponse = createDesktopArtifactBrowseSuccessResponse({
      items: [
        {
          storageKey: " staged/images/artifact-31 ",
          artifactKind: "image",
          mediaType: " image/png ",
        },
      ],
    });
    const readResponse = createDesktopArtifactReadSuccessResponse({
      artifact: {
        locator: {
          storageKey: " staged/images/artifact-31 ",
        },
        artifactKind: "image",
      },
    });
    const contentResponse = createDesktopArtifactContentReadSuccessResponse({
      content: {
        locator: {
          storageKey: " staged/images/artifact-31 ",
        },
        mediaType: " image/png ",
        sizeBytes: 4,
        availability: "available",
        retrieval: "deferred",
      },
    });

    if (!browseResponse.ok) {
      throw new Error("Expected browse response to be successful.");
    }
    expect(browseResponse.value.items[0].storageKey).toBe("staged/images/artifact-31");
    expect("content" in browseResponse.value.items[0]).toBe(false);

    if (!readResponse.ok) {
      throw new Error("Expected read response to be successful.");
    }
    expect(readResponse.value.artifact.locator.storageKey).toBe(
      "staged/images/artifact-31",
    );
    expect("content" in readResponse.value.artifact).toBe(false);

    if (!contentResponse.ok) {
      throw new Error("Expected content-read response to be successful.");
    }
    expect(contentResponse.value.content.locator.storageKey).toBe(
      "staged/images/artifact-31",
    );
    expect(contentResponse.value.content).toMatchObject({
      mediaType: "image/png",
      sizeBytes: 4,
      availability: "available",
      retrieval: "deferred",
    });
    expect("bytes" in contentResponse.value.content).toBe(false);
  });

  it("keeps read and content-read request locators storage-key based with no filesystem path fields", () => {
    const readRequest = createDesktopArtifactReadRequest({
      locator: {
        storageKey: " staged/images/artifact-32 ",
      },
      boundary: {
        host: "desktop",
        source: " desktop.renderer.artifact-read ",
      },
    });
    const contentRequest = createDesktopArtifactContentReadRequest({
      locator: {
        storageKey: " staged/images/artifact-32 ",
      },
      boundary: {
        host: "desktop",
        source: " desktop.renderer.artifact-content-read ",
      },
    });
    const browseRequest = createDesktopArtifactBrowseRequest({
      artifactKind: "image",
      boundary: {
        host: "desktop",
        source: " desktop.renderer.artifact-browse ",
      },
    });

    expect(readRequest.payload.locator.storageKey).toBe("staged/images/artifact-32");
    expect(contentRequest.payload.locator.storageKey).toBe("staged/images/artifact-32");
    expect(browseRequest.payload.artifactKind).toBe("image");
    expect("path" in readRequest.payload.locator).toBe(false);
    expect("path" in contentRequest.payload.locator).toBe(false);
  });
});
