import {
  SystemPageLayoutKinds,
  type SystemPageLayoutKind,
  type SystemPageRuntimeNavigationDescriptor,
} from "../studio-assets/StudioAssetContracts";

export interface SystemPageMetadata {
  readonly intent?: string;
  readonly audience?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface SystemPageLayoutStructure {
  readonly layoutKind: SystemPageLayoutKind;
  readonly defaultRegionId?: string;
  readonly regionIds: ReadonlyArray<string>;
}

export interface SystemStudioPageModel {
  readonly pageId: string;
  readonly title: string;
  readonly description?: string;
  readonly metadata?: SystemPageMetadata;
  readonly layout: SystemPageLayoutStructure;
  readonly navigation?: SystemPageRuntimeNavigationDescriptor;
}

const defaultLayout: SystemPageLayoutStructure = Object.freeze({
  layoutKind: SystemPageLayoutKinds.workspace,
  defaultRegionId: "workspace",
  regionIds: Object.freeze(["workspace"]),
});

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTags(input: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  const tags = [...new Set(input.map((entry) => normalizeOptional(entry)).filter((entry): entry is string => Boolean(entry)))];
  return tags.length > 0 ? Object.freeze(tags) : undefined;
}

export function normalizeSystemStudioPageModel(entry: Record<string, unknown>, index: number): SystemStudioPageModel {
  const fallbackId = `page-${index + 1}`;
  const pageId = normalizeOptional(entry.pageId) ?? fallbackId;
  const title = normalizeOptional(entry.title) ?? normalizeOptional(entry.heading) ?? `Page ${index + 1}`;
  const description = normalizeOptional(entry.description);

  const metadataRecord = (entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata))
    ? entry.metadata as Record<string, unknown>
    : undefined;

  const layoutRecord = (entry.layout && typeof entry.layout === "object" && !Array.isArray(entry.layout))
    ? entry.layout as Record<string, unknown>
    : undefined;
  const layoutKind = normalizeOptional(layoutRecord?.layoutKind);
  const regionIds = Array.isArray(layoutRecord?.regionIds)
    ? Object.freeze(
      layoutRecord.regionIds
        .map((candidate) => normalizeOptional(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    )
    : defaultLayout.regionIds;

  const navigationRecord = (entry.navigation && typeof entry.navigation === "object" && !Array.isArray(entry.navigation))
    ? entry.navigation as Record<string, unknown>
    : undefined;

  return Object.freeze({
    pageId,
    title,
    description,
    metadata: metadataRecord
      ? Object.freeze({
        intent: normalizeOptional(metadataRecord.intent),
        audience: normalizeOptional(metadataRecord.audience),
        tags: normalizeTags(metadataRecord.tags),
      })
      : undefined,
    layout: Object.freeze({
      layoutKind: Object.values(SystemPageLayoutKinds).includes(layoutKind as SystemPageLayoutKind)
        ? layoutKind as SystemPageLayoutKind
        : defaultLayout.layoutKind,
      defaultRegionId: normalizeOptional(layoutRecord?.defaultRegionId) ?? defaultLayout.defaultRegionId,
      regionIds: regionIds.length > 0 ? regionIds : defaultLayout.regionIds,
    }),
    navigation: navigationRecord
      ? Object.freeze({
        route: normalizeOptional(navigationRecord.route) ?? `/${pageId}`,
        title: normalizeOptional(navigationRecord.title) ?? title,
        supportsDeepLinking: typeof navigationRecord.supportsDeepLinking === "boolean"
          ? navigationRecord.supportsDeepLinking
          : false,
        navGroup: normalizeOptional(navigationRecord.navGroup),
        requiresRuntimeSession: typeof navigationRecord.requiresRuntimeSession === "boolean"
          ? navigationRecord.requiresRuntimeSession
          : false,
      })
      : undefined,
  });
}

export function toSerializableSystemStudioPageModel(page: SystemStudioPageModel): Record<string, unknown> {
  return {
    pageId: page.pageId,
    title: page.title,
    heading: page.title,
    description: page.description,
    metadata: page.metadata,
    layout: page.layout,
    navigation: page.navigation,
  };
}
