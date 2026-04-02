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

const defaultLayoutKind: SystemPageLayoutKind = SystemPageLayoutKinds.workspace;

export interface SystemPageLayoutTemplate {
  readonly layoutKind: SystemPageLayoutKind;
  readonly title: string;
  readonly summary: string;
  readonly defaultRegionId: string;
  readonly regionIds: ReadonlyArray<string>;
}

export const systemPageLayoutTemplates: ReadonlyArray<SystemPageLayoutTemplate> = Object.freeze([
  Object.freeze({
    layoutKind: SystemPageLayoutKinds.workspace,
    title: "Workspace",
    summary: "Main work area with optional side support panels.",
    defaultRegionId: "workspace",
    regionIds: Object.freeze(["workspace", "inspector"]),
  }),
  Object.freeze({
    layoutKind: SystemPageLayoutKinds.twoPane,
    title: "Split view",
    summary: "Two primary side-by-side panels for compare and review flows.",
    defaultRegionId: "left-pane",
    regionIds: Object.freeze(["left-pane", "right-pane"]),
  }),
  Object.freeze({
    layoutKind: SystemPageLayoutKinds.singleColumn,
    title: "Single column",
    summary: "A focused vertical page with one main panel stream.",
    defaultRegionId: "main",
    regionIds: Object.freeze(["main"]),
  }),
  Object.freeze({
    layoutKind: SystemPageLayoutKinds.custom,
    title: "Custom",
    summary: "Start from a flexible base and shape regions in canvas.",
    defaultRegionId: "workspace",
    regionIds: Object.freeze(["workspace"]),
  }),
]);

function resolveLayoutTemplate(layoutKind: SystemPageLayoutKind): SystemPageLayoutTemplate {
  return systemPageLayoutTemplates.find((template) => template.layoutKind === layoutKind)
    ?? systemPageLayoutTemplates[0];
}

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

function normalizePageLayout(entry: Record<string, unknown>): SystemPageLayoutStructure {
  const layoutRecord = (entry.layout && typeof entry.layout === "object" && !Array.isArray(entry.layout))
    ? entry.layout as Record<string, unknown>
    : undefined;
  const layoutKindCandidate = normalizeOptional(layoutRecord?.layoutKind);
  const layoutKind = Object.values(SystemPageLayoutKinds).includes(layoutKindCandidate as SystemPageLayoutKind)
    ? layoutKindCandidate as SystemPageLayoutKind
    : defaultLayoutKind;
  const template = resolveLayoutTemplate(layoutKind);
  const regionIds = Array.isArray(layoutRecord?.regionIds)
    ? Object.freeze(
      layoutRecord.regionIds
        .map((candidate) => normalizeOptional(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    )
    : template.regionIds;

  return Object.freeze({
    layoutKind: template.layoutKind,
    defaultRegionId: normalizeOptional(layoutRecord?.defaultRegionId) ?? template.defaultRegionId,
    regionIds: regionIds.length > 0 ? regionIds : template.regionIds,
  });
}

export function normalizeSystemStudioPageModel(entry: Record<string, unknown>, index: number): SystemStudioPageModel {
  const fallbackId = `page-${index + 1}`;
  const pageId = normalizeOptional(entry.pageId) ?? fallbackId;
  const title = normalizeOptional(entry.title) ?? normalizeOptional(entry.heading) ?? `Page ${index + 1}`;
  const description = normalizeOptional(entry.description);

  const metadataRecord = (entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata))
    ? entry.metadata as Record<string, unknown>
    : undefined;

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
    layout: normalizePageLayout(entry),
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

function createUniquePageId(existing: ReadonlyArray<SystemStudioPageModel>): string {
  const usedIds = new Set(existing.map((page) => page.pageId));
  let index = existing.length + 1;
  while (usedIds.has(`page-${index}`)) {
    index += 1;
  }
  return `page-${index}`;
}

function toRouteSegment(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug.length > 0 ? slug : "";
}

export function createSystemStudioPageModel(input: {
  readonly existingPages: ReadonlyArray<SystemStudioPageModel>;
  readonly title?: string;
  readonly description?: string;
  readonly layoutKind?: SystemPageLayoutKind;
}): SystemStudioPageModel {
  const pageId = createUniquePageId(input.existingPages);
  const safeTitle = normalizeOptional(input.title) ?? `Page ${input.existingPages.length + 1}`;
  const template = resolveLayoutTemplate(input.layoutKind ?? defaultLayoutKind);
  const routeSegment = toRouteSegment(safeTitle);
  return Object.freeze({
    pageId,
    title: safeTitle,
    description: normalizeOptional(input.description),
    layout: Object.freeze({
      layoutKind: template.layoutKind,
      defaultRegionId: template.defaultRegionId,
      regionIds: template.regionIds,
    }),
    navigation: Object.freeze({
      route: routeSegment ? `/${routeSegment}` : `/${pageId}`,
      title: safeTitle,
      supportsDeepLinking: false,
      requiresRuntimeSession: false,
    }),
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
