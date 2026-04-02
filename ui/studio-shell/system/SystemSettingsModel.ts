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
  };
  readonly theme: SystemThemeHookSettings;
  readonly runtimeBehavior: SystemRuntimeBehaviorSettings;
}

const defaultSystemSettings: SystemSettingsModel = Object.freeze({
  systemName: "",
  systemDescription: "",
  defaultLandingPageId: undefined,
  navigation: Object.freeze({
    mode: SystemNavigationModes.top,
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

export function normalizeSystemSettingsModel(input: unknown): SystemSettingsModel {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultSystemSettings;
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

  return Object.freeze({
    systemName: normalizeOptionalText(record.systemName) ?? defaultSystemSettings.systemName,
    systemDescription: normalizeOptionalText(record.systemDescription) ?? defaultSystemSettings.systemDescription,
    defaultLandingPageId: normalizeOptionalText(record.defaultLandingPageId),
    navigation: Object.freeze({
      mode: navigationMode,
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
    },
    theme: {
      presetId: settings.theme.presetId,
      tokenSetId: settings.theme.tokenSetId,
    },
    runtimeBehavior: settings.runtimeBehavior,
  };
}
