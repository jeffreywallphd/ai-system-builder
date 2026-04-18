import type { ArtifactIntakeCandidate } from "./artifact-intake-candidate";
import type { AcceptedArtifactUploadPolicy } from "./accepted-artifact-upload-policy";
import type { ArtifactIntakeFamily } from "./artifact-intake-family";

export interface ArtifactIntakeClassification {
  accepted: boolean;
  artifactFamily: ArtifactIntakeFamily;
  reason?: string;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dot).toLowerCase();
}

function classifyArtifactFamily(mediaType: string): ArtifactIntakeFamily {
  if (mediaType.startsWith("image/")) {
    return "image";
  }

  if (mediaType.startsWith("text/")) {
    return "text";
  }

  if (mediaType === "application/json") {
    return "json";
  }

  return "binary";
}

export function classifyArtifactIntakeCandidate(
  candidate: ArtifactIntakeCandidate,
  policy: AcceptedArtifactUploadPolicy,
): ArtifactIntakeClassification {
  if (candidate.fileName.length === 0) {
    return { accepted: false, artifactFamily: "binary", reason: "fileName must be provided." };
  }

  if (candidate.mediaType.length === 0) {
    return { accepted: false, artifactFamily: "binary", reason: "mediaType must be provided." };
  }

  if (candidate.bytesLength <= 0) {
    return { accepted: false, artifactFamily: "binary", reason: "bytes must not be empty." };
  }

  const extension = extensionOf(candidate.fileName);
  const mediaTypeAccepted = policy.acceptedMediaTypes.includes(candidate.mediaType);
  const extensionAccepted = extension.length > 0 && policy.acceptedExtensions.includes(extension);

  if (!mediaTypeAccepted && !extensionAccepted) {
    return {
      accepted: false,
      artifactFamily: classifyArtifactFamily(candidate.mediaType),
      reason: `Artifact type is not accepted: ${candidate.mediaType}.`,
    };
  }

  return {
    accepted: true,
    artifactFamily: classifyArtifactFamily(candidate.mediaType),
  };
}
