export interface ArtifactUploadAcceptedTypePolicy {
  acceptedMediaTypes: readonly string[];
  acceptedExtensions: readonly string[];
}

export function toHtmlFileAcceptAttribute(policy: ArtifactUploadAcceptedTypePolicy): string {
  return [...policy.acceptedExtensions, ...policy.acceptedMediaTypes].join(",");
}
