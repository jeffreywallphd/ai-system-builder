import { describe, expect, it } from "../../../testing/node-test";

import {
  API_ARTIFACT_PUBLISH_OPERATION,
  createApiArtifactPublishRequest,
  createApiArtifactPublishSuccessResponse,
} from "..";

describe("artifact publish api contract", () => {
  it("normalizes artifact publish request payload", () => {
    const request = createApiArtifactPublishRequest({
      artifactId: " uploads/a.png ",
      target: {
        provider: " huggingface ",
        repository: " openai/demo ",
        revision: " main ",
        path: " images/a.png ",
      },
      source: " thin-client.artifact-browser ",
    });

    expect(API_ARTIFACT_PUBLISH_OPERATION).toBe("artifact.publish");
    expect(request.payload).toEqual({
      artifactId: "uploads/a.png",
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        revision: "main",
        path: "images/a.png",
      },
      mediaType: undefined,
      verify: true,
      source: "thin-client.artifact-browser",
    });
  });

  it("maps success response through the shared API envelope", () => {
    const response = createApiArtifactPublishSuccessResponse({
      provider: "huggingface",
      repository: "openai/demo",
      path: "images/a.png",
      revision: "main",
      exists: true,
    });

    expect(response).toMatchObject({
      ok: true,
      operation: "artifact.publish",
      value: {
        exists: true,
      },
    });
  });
});
