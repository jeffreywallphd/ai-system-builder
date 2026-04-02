export const SystemNavigationModes = Object.freeze({
  top: "top",
  side: "side",
  hidden: "hidden",
});

export type SystemNavigationMode = typeof SystemNavigationModes[keyof typeof SystemNavigationModes];

export interface SystemThemeHookSettings {
  readonly presetId?: string;
  readonly tokenSetId?: string;
}

export interface SystemRuntimeBehaviorSettings {
  readonly confirmBeforeExit: boolean;
  readonly showHelpTips: boolean;
  readonly rememberLastPage: boolean;
}

export interface SystemSettingsModel {
  readonly systemName: string;
  readonly systemDescription: string;
  readonly defaultLandingPageId?: string;
  readonly navigation: {
    readonly mode: SystemNavigationMode;
    readonly structure: SystemNavigationStructureModel;
  };
  readonly theme: SystemThemeHookSettings;
  readonly runtimeBehavior: SystemRuntimeBehaviorSettings;
}

export const SystemNavigationPlacementKinds = Object.freeze({
  primary: "primary",
  secondary: "secondary",
});

export type SystemNavigationPlacement = typeof SystemNavigationPlacementKinds[keyof typeof SystemNavigationPlacementKinds];

export interface SystemNavigationStructureItem {
  readonly pageId: string;
  readonly label: string;
  readonly route: string;
  readonly visible: boolean;
  readonly group?: string;
  readonly placement: SystemNavigationPlacement;
}

export interface SystemNavigationStructureModel {
  readonly items: ReadonlyArray<SystemNavigationStructureItem>;
}

export interface SystemSettingsPageReference {
  readonly pageId: string;
  readonly title: string;
  readonly navigation?: {
    readonly route?: string;
    readonly title?: string;
    readonly navGroup?: string;
    readonly includeInNavigation?: boolean;
    readonly navPlacement?: "primary" | "secondary";
  };
}

const defaultSystemSettings: SystemSettingsModel = Object.freeze({
  systemName: "",
  systemDescription: "",
  defaultLandingPageId: undefined,
  navigation: Object.freeze({
    mode: SystemNavigationModes.top,
    structure: Object.freeze({
      items: Object.freeze([]),
    }),
  }),
  theme: Object.freeze({
    presetId: undefined,
    tokenSetId: undefined,
  }),
  runtimeBehavior: Object.freeze({
    confirmBeforeExit: false,
    showHelpTips: true,
    rememberLastPage: true,
  }),
});

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNavigationPlacement(value: unknown): SystemNavigationPlacement {
  const candidate = normalizeOptionalText(value);
  return Object.values(SystemNavigationPlacementKinds).includes(candidate as SystemNavigationPlacement)
    ? candidate as SystemNavigationPlacement
    : SystemNavigationPlacementKinds.primary;
}

function normalizeNavigationStructureItems(input: unknown): ReadonlyArray<SystemNavigationStructureItem> {
  if (!Array.isArray(input)) {
    return Object.freeze([]);
  }
  const normalized = input
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => {
      const pageId = normalizeOptionalText(entry.pageId);
      if (!pageId) {
        return undefined;
      }
      return Object.freeze({
        pageId,
        label: normalizeOptionalText(entry.label) ?? pageId,
        route: normalizeOptionalText(entry.route) ?? `/${pageId}`,
        visible: typeof entry.visible === "boolean" ? entry.visible : true,
        group: normalizeOptionalText(entry.group),
        placement: normalizeNavigationPlacement(entry.placement),
      } satisfies SystemNavigationStructureItem);
    })
    .filter((entry): entry is SystemNavigationStructureItem => Boolean(entry));
  return Object.freeze(normalized);
}

function reconcileNavigationStructure(input: {
  readonly pages: ReadonlyArray<SystemSettingsPageReference>;
  readonly existingItems: ReadonlyArray<SystemNavigationStructureItem>;
}): SystemNavigationStructureModel {
  const existingByPageId = new Map(input.existingItems.map((entry) => [entry.pageId, entry] as const));
  return Object.freeze({
    items: Object.freeze(input.pages.map((page) => {
      const existing = existingByPageId.get(page.pageId);
      const pageNavigationTitle = page.navigation?.title?.trim();
      const pageNavigationRoute = page.navigation?.route?.trim();
      const pageNavigationGroup = page.navigation?.navGroup?.trim();
      return Object.freeze({
        pageId: page.pageId,
        label: existing?.label ?? pageNavigationTitle ?? page.title,
        route: pageNavigationRoute ?? existing?.route ?? `/${page.pageId}`,
        visible: existing?.visible ?? page.navigation?.includeInNavigation ?? true,
        group: existing?.group ?? pageNavigationGroup ?? undefined,
        placement: existing?.placement ?? normalizeNavigationPlacement(page.navigation?.navPlacement),
      } satisfies SystemNavigationStructureItem);
    })),
  });
}

function resolveDefaultLandingPageId(input: {
  readonly pages: ReadonlyArray<SystemSettingsPageReference>;
  readonly structure: SystemNavigationStructureModel;
  readonly requestedDefaultPageId?: string;
}): string | undefined {
  const pageIds = new Set(input.pages.map((page) => page.pageId));
  if (input.requestedDefaultPageId && pageIds.has(input.requestedDefaultPageId)) {
    return input.requestedDefaultPageId;
  }
  const firstVisible = input.structure.items.find((item) => item.visible && pageIds.has(item.pageId));
  if (firstVisible) {
    return firstVisible.pageId;
  }
  return input.pages[0]?.pageId;
}

export function normalizeSystemSettingsModel(
  input: unknown,
  options?: {
    readonly pages?: ReadonlyArray<SystemSettingsPageReference>;
  },
): SystemSettingsModel {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const pages = options?.pages ?? Object.freeze([]);
    const structure = reconcileNavigationStructure({
      pages,
      existingItems: Object.freeze([]),
    });
    return Object.freeze({
      ...defaultSystemSettings,
      defaultLandingPageId: resolveDefaultLandingPageId({
        pages,
        structure,
      }),
      navigation: Object.freeze({
        ...defaultSystemSettings.navigation,
        structure,
      }),
    });
  }
  const record = input as Record<string, unknown>;
  const navigationRecord = (record.navigation && typeof record.navigation === "object" && !Array.isArray(record.navigation))
    ? record.navigation as Record<string, unknown>
    : {};
  const runtimeBehaviorRecord = (
    record.runtimeBehavior
    && typeof record.runtimeBehavior === "object"
    && !Array.isArray(record.runtimeBehavior)
  )
    ? record.runtimeBehavior as Record<string, unknown>
    : {};
  const themeRecord = (record.theme && typeof record.theme === "object" && !Array.isArray(record.theme))
    ? record.theme as Record<string, unknown>
    : {};

  const navigationModeCandidate = normalizeOptionalText(navigationRecord.mode);
  const navigationMode = Object.values(SystemNavigationModes).includes(navigationModeCandidate as SystemNavigationMode)
    ? navigationModeCandidate as SystemNavigationMode
    : defaultSystemSettings.navigation.mode;
  const pages = options?.pages ?? Object.freeze([]);
  const structure = reconcileNavigationStructure({
    pages,
    existingItems: normalizeNavigationStructureItems(
      (navigationRecord.structure as Record<string, unknown> | undefined)?.items,
    ),
  });
  const requestedDefaultLandingPageId = normalizeOptionalText(record.defaultLandingPageId);

  return Object.freeze({
    systemName: normalizeOptionalText(record.systemName) ?? defaultSystemSettings.systemName,
    systemDescription: normalizeOptionalText(record.systemDescription) ?? defaultSystemSettings.systemDescription,
    defaultLandingPageId: resolveDefaultLandingPageId({
      pages,
      structure,
      requestedDefaultPageId: requestedDefaultLandingPageId,
    }),
    navigation: Object.freeze({
      mode: navigationMode,
      structure,
    }),
    theme: Object.freeze({
      presetId: normalizeOptionalText(themeRecord.presetId),
      tokenSetId: normalizeOptionalText(themeRecord.tokenSetId),
    }),
    runtimeBehavior: Object.freeze({
      confirmBeforeExit: typeof runtimeBehaviorRecord.confirmBeforeExit === "boolean"
        ? runtimeBehaviorRecord.confirmBeforeExit
        : defaultSystemSettings.runtimeBehavior.confirmBeforeExit,
      showHelpTips: typeof runtimeBehaviorRecord.showHelpTips === "boolean"
        ? runtimeBehaviorRecord.showHelpTips
        : defaultSystemSettings.runtimeBehavior.showHelpTips,
      rememberLastPage: typeof runtimeBehaviorRecord.rememberLastPage === "boolean"
        ? runtimeBehaviorRecord.rememberLastPage
        : defaultSystemSettings.runtimeBehavior.rememberLastPage,
    }),
  });
}

export function toSerializableSystemSettingsModel(settings: SystemSettingsModel): Record<string, unknown> {
  return {
    systemName: settings.systemName.trim(),
    systemDescription: settings.systemDescription.trim() || undefined,
    defaultLandingPageId: settings.defaultLandingPageId,
    navigation: {
      mode: settings.navigation.mode,
      structure: settings.navigation.structure,
    },
    theme: {
      presetId: settings.theme.presetId,
      tokenSetId: settings.theme.tokenSetId,
    },
    runtimeBehavior: settings.runtimeBehavior,
  };
}
