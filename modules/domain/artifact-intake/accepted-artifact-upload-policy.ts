export interface AcceptedArtifactUploadPolicy {
  acceptedMediaTypes: readonly string[];
  acceptedExtensions: readonly string[];
}

export function normalizeAcceptedArtifactUploadPolicy(
  policy: AcceptedArtifactUploadPolicy,
): AcceptedArtifactUploadPolicy {
  return {
    acceptedMediaTypes: Array.from(new Set(policy.acceptedMediaTypes.map((value) => value.trim().toLowerCase()))),
    acceptedExtensions: Array.from(
      new Set(
        policy.acceptedExtensions.map((value) => {
          const normalized = value.trim().toLowerCase();
          return normalized.startsWith(".") ? normalized : `.${normalized}`;
        }),
      ),
    ),
  };
}

export function createDefaultAcceptedArtifactUploadPolicy(): AcceptedArtifactUploadPolicy {
  return normalizeAcceptedArtifactUploadPolicy({
    acceptedMediaTypes: ["image/png", "image/jpeg", "image/webp", "text/plain", "application/json"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".txt", ".json"],
  });
}

export function toHtmlFileAcceptAttribute(policy: AcceptedArtifactUploadPolicy): string {
  return [...policy.acceptedExtensions, ...policy.acceptedMediaTypes].join(",");
}
