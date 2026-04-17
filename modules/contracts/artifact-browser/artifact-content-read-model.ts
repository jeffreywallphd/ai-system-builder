import {
  normalizeArtifactBrowserLocator,
  type ArtifactBrowserLocator,
} from "./artifact-browser-locator";

export interface ArtifactContentReadModel<TContent = Uint8Array> {
  locator: ArtifactBrowserLocator;
  mediaType?: string;
  content: TContent;
}

export interface ArtifactContentReadSuccessValue<TContent = Uint8Array> {
  content: ArtifactContentReadModel<TContent>;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeArtifactContentReadModel<TContent = Uint8Array>(
  model: ArtifactContentReadModel<TContent>,
): ArtifactContentReadModel<TContent> {
  return {
    ...model,
    locator: normalizeArtifactBrowserLocator(model.locator),
    mediaType: normalizeOptionalText(model.mediaType),
  };
}

export function normalizeArtifactContentReadSuccessValue<TContent = Uint8Array>(
  value: ArtifactContentReadSuccessValue<TContent>,
): ArtifactContentReadSuccessValue<TContent> {
  return {
    content: normalizeArtifactContentReadModel(value.content),
  };
}
