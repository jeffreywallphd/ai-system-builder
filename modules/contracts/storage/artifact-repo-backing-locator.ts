import type { ArtifactRepoTarget } from "./artifact-repo-target";

export interface ArtifactRepoBackingLocator {
  repository: string;
  path: string;
}

export function encodeArtifactRepoBackingLocator(target: Pick<ArtifactRepoTarget, "repository" | "path">): string {
  const repository = target.repository.trim();
  const normalizedPath = target.path?.trim();
  if (!repository) {
    throw new Error("Artifact repo backing locator repository must be a non-empty string.");
  }
  if (!normalizedPath) {
    throw new Error("Artifact repo backing locator path must be a non-empty string.");
  }

  return `${repository}/${normalizedPath}`;
}

export function decodeArtifactRepoBackingLocator(locator: string): ArtifactRepoBackingLocator {
  const normalizedLocator = locator.trim();
  if (!normalizedLocator) {
    throw new Error("Artifact repo backing locator must be a non-empty string.");
  }

  const segments = normalizedLocator.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 3) {
    throw new Error(
      `Artifact repo backing locator must include "owner/repository/path". Received "${locator}".`,
    );
  }

  return {
    repository: `${segments[0]}/${segments[1]}`,
    path: segments.slice(2).join("/"),
  };
}
