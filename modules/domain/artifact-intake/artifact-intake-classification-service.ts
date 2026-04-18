import type { ArtifactKind } from "../../contracts/artifact";
import type { ArtifactIntakeCandidate } from "./artifact-intake-candidate";
import type { AcceptedArtifactUploadPolicy } from "./accepted-artifact-upload-policy";

export interface ArtifactIntakeClassification {
  accepted: boolean;
  artifactKind: ArtifactKind;
  reason?: string;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dot).toLowerCase();
}

function classifyArtifactKind(_mediaType: string): ArtifactKind {
  return "raw-staged";
}

export function classifyArtifactIntakeCandidate(
  candidate: ArtifactIntakeCandidate,
  policy: AcceptedArtifactUploadPolicy,
): ArtifactIntakeClassification {
  if (candidate.fileName.length === 0) {
    return { accepted: false, artifactKind: "raw-staged", reason: "fileName must be provided." };
  }

  if (candidate.mediaType.length === 0) {
    return { accepted: false, artifactKind: "raw-staged", reason: "mediaType must be provided." };
  }

  if (candidate.bytesLength <= 0) {
    return { accepted: false, artifactKind: "raw-staged", reason: "bytes must not be empty." };
  }

  const extension = extensionOf(candidate.fileName);
  const mediaTypeAccepted = policy.acceptedMediaTypes.includes(candidate.mediaType);
  const extensionAccepted = extension.length > 0 && policy.acceptedExtensions.includes(extension);

  if (!mediaTypeAccepted && !extensionAccepted) {
    return {
      accepted: false,
      artifactKind: classifyArtifactKind(candidate.mediaType),
      reason: `Artifact type is not accepted: ${candidate.mediaType}.`,
    };
  }

  return {
    accepted: true,
    artifactKind: classifyArtifactKind(candidate.mediaType),
  };
}
