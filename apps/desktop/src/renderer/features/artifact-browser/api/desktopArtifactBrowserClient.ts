import {
  getDesktopApi,
  type DesktopArtifactBrowseItem,
  type DesktopArtifactBrowserLocator,
  type DesktopArtifactContentDescriptor,
  type DesktopArtifactDetail,
  type DesktopLocalizedArtifactFromRepo,
  type DesktopPublishedBacking,
  type DesktopRegisteredArtifactFromRepo,
} from "../../../lib/desktopApi";

export interface DesktopArtifactBrowserClient {
  browseImageArtifacts: () => Promise<DesktopArtifactBrowseItem[]>;
  readArtifactDetail: (locator: DesktopArtifactBrowserLocator) => Promise<DesktopArtifactDetail>;
  readArtifactContent: (locator: DesktopArtifactBrowserLocator) => Promise<DesktopArtifactContentDescriptor>;
  createArtifactMediaViewUrl: (locator: DesktopArtifactBrowserLocator) => Promise<string>;
  publishArtifactToHuggingFace: (input: {
    artifactId: string;
    repository: string;
    path: string;
    revision?: string;
    mediaType?: string;
  }) => Promise<DesktopPublishedBacking>;
  verifyPublishedArtifactBacking: (input: {
    artifactId: string;
  }) => Promise<DesktopPublishedBacking>;
  verifyImportedSourceBacking?: (input: {
    artifactId: string;
  }) => Promise<DesktopPublishedBacking>;
  registerArtifactFromRepo: (input: {
    repository: string;
    path: string;
    revision?: string;
    mediaType?: string;
  }) => Promise<DesktopRegisteredArtifactFromRepo>;
  localizeArtifactFromRepo: (input: {
    artifactId: string;
  }) => Promise<DesktopLocalizedArtifactFromRepo>;
}

function ensureSuccess<T>(
  response: unknown,
  pick: (value: unknown) => T,
  fallback: string,
): T {
  if (typeof response !== "object" || response === null || !("ok" in response)) {
    throw new Error(fallback);
  }

  const envelope = response as { ok: boolean; value?: unknown; error?: { message?: string } };
  if (!envelope.ok) {
    throw new Error(envelope.error?.message ?? fallback);
  }

  return pick(envelope.value);
}

export function createDesktopArtifactBrowserClient(): DesktopArtifactBrowserClient {
  const desktopApi = getDesktopApi();

  return {
    async browseImageArtifacts() {
      return ensureSuccess(
        await desktopApi.browseArtifacts(),
        (value) => {
          const items = (value as { items?: DesktopArtifactBrowseItem[] } | undefined)?.items;
          return Array.isArray(items) ? items : [];
        },
        "Failed to browse artifacts.",
      );
    },

    async readArtifactDetail(locator) {
      return ensureSuccess(
        await desktopApi.readArtifactDetail(locator),
        (value) => {
          const artifact = (value as { artifact?: DesktopArtifactDetail } | undefined)?.artifact;
          if (!artifact) {
            throw new Error("Artifact detail response is missing artifact.");
          }

          return artifact;
        },
        "Failed to read artifact detail.",
      );
    },

    async readArtifactContent(locator) {
      return ensureSuccess(
        await desktopApi.readArtifactContentDescriptor(locator),
        (value) => {
          const content = (value as { content?: DesktopArtifactContentDescriptor } | undefined)?.content;
          if (!content) {
            throw new Error("Artifact content response is missing content descriptor.");
          }

          return content;
        },
        "Failed to read artifact content descriptor.",
      );
    },

    async createArtifactMediaViewUrl(locator) {
      const media = ensureSuccess(
        await desktopApi.readArtifactViewerMedia(locator),
        (value) => value as { mediaType?: string; bytes: Uint8Array },
        "Failed to read artifact media.",
      );

      const blobBytes = Uint8Array.from(media.bytes);
      const blob = new Blob([blobBytes], { type: media.mediaType ?? "application/octet-stream" });
      return URL.createObjectURL(blob);
    },

    async publishArtifactToHuggingFace(input) {
      return ensureSuccess(
        await desktopApi.publishArtifactToRepo({
          artifactId: input.artifactId,
          target: {
            provider: "huggingface",
            repository: input.repository,
            path: input.path,
            revision: input.revision,
          },
          mediaType: input.mediaType,
        }),
        (value) => value as DesktopPublishedBacking,
        "Failed to publish artifact.",
      );
    },

    async verifyPublishedArtifactBacking(input) {
      return ensureSuccess(
        await desktopApi.verifyPublishedArtifactBacking({
          artifactId: input.artifactId,
        }),
        (value) => value as DesktopPublishedBacking,
        "Failed to verify published artifact backing.",
      );
    },

    async verifyImportedSourceBacking(input) {
      if (!desktopApi.verifyImportedArtifactSourceBacking) {
        throw new Error("Desktop preload source verification bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.verifyImportedArtifactSourceBacking({
          artifactId: input.artifactId,
        }),
        (value) => value as DesktopPublishedBacking,
        "Failed to verify imported source backing.",
      );
    },

    async registerArtifactFromRepo(input) {
      return ensureSuccess(
        await desktopApi.registerArtifactFromRepo({
          target: {
            provider: "huggingface",
            repository: input.repository,
            path: input.path,
            revision: input.revision,
          },
          artifactKind: "image",
          mediaType: input.mediaType,
        }),
        (value) => value as DesktopRegisteredArtifactFromRepo,
        "Failed to register artifact from repo.",
      );
    },

    async localizeArtifactFromRepo(input) {
      return ensureSuccess(
        await desktopApi.localizeArtifactFromRepo({
          artifactId: input.artifactId,
        }),
        (value) => value as DesktopLocalizedArtifactFromRepo,
        "Failed to localize artifact from repo.",
      );
    },
  };
}
