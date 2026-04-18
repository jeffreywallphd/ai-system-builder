import { describe, expect, it } from "../../../testing/node-test";
import {
  classifyArtifactIntakeCandidate,
  createArtifactIntakeCandidate,
  createDefaultAcceptedArtifactUploadPolicy,
} from "..";

describe("artifact intake classification service", () => {
  it("classifies accepted image uploads into the image intake family", () => {
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
      artifactFamily: "image",
    });
  });

  it("classifies rejected uploads by intake family independently from lifecycle state", () => {
    const result = classifyArtifactIntakeCandidate(
      createArtifactIntakeCandidate({
        fileName: "cat.pdf",
        mediaType: "application/pdf",
        bytesLength: 4,
      }),
      createDefaultAcceptedArtifactUploadPolicy(),
    );

    expect(result.accepted).toBe(false);
    expect(result.artifactFamily).toBe("binary");
    expect(result.reason).toContain("Artifact type is not accepted");
  });
});
