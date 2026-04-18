import { describe, expect, it } from "../../../testing/node-test";
import {
  classifyArtifactIntakeCandidate,
  createArtifactIntakeCandidate,
  createDefaultAcceptedArtifactUploadPolicy,
} from "..";

describe("artifact intake classification service", () => {
  it("classifies accepted image uploads as raw-staged lifecycle artifacts", () => {
    const result = classifyArtifactIntakeCandidate(
      createArtifactIntakeCandidate({
        fileName: "cat.png",
        mediaType: "image/png",
        bytesLength: 4,
      }),
      createDefaultAcceptedArtifactUploadPolicy(),
    );

    expect(result).toEqual({
      accepted: true,
      artifactKind: "raw-staged",
    });
  });

  it("keeps rejected media-type classifications in raw-staged lifecycle state", () => {
    const result = classifyArtifactIntakeCandidate(
      createArtifactIntakeCandidate({
        fileName: "cat.pdf",
        mediaType: "application/pdf",
        bytesLength: 4,
      }),
      createDefaultAcceptedArtifactUploadPolicy(),
    );

    expect(result.accepted).toBe(false);
    expect(result.artifactKind).toBe("raw-staged");
    expect(result.reason).toContain("Artifact type is not accepted");
  });
});
