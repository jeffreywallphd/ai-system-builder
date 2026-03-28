export const LegacyNavigationCompatibilityModes = Object.freeze({
  visible: "visible",
  compatibility: "compatibility",
  sunset: "sunset",
});

export type LegacyNavigationCompatibilityMode = typeof LegacyNavigationCompatibilityModes[keyof typeof LegacyNavigationCompatibilityModes];

export interface LegacyNavigationFeatureFlagOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function normalizeMode(value: string | undefined): LegacyNavigationCompatibilityMode | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === LegacyNavigationCompatibilityModes.visible) {
    return LegacyNavigationCompatibilityModes.visible;
  }
  if (normalized === LegacyNavigationCompatibilityModes.compatibility || normalized === "compat") {
    return LegacyNavigationCompatibilityModes.compatibility;
  }
  if (normalized === LegacyNavigationCompatibilityModes.sunset) {
    return LegacyNavigationCompatibilityModes.sunset;
  }
  return undefined;
}

export class LegacyNavigationFeatureFlag {
  private readonly env: Readonly<Record<string, string | undefined>>;

  constructor(options: LegacyNavigationFeatureFlagOptions = {}) {
    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    this.env = options.env
      ?? processLike?.env
      ?? import.meta.env
      ?? {};
  }

  public resolveMode(defaultMode: LegacyNavigationCompatibilityMode): LegacyNavigationCompatibilityMode {
    return normalizeMode(this.env.VITE_FEATURE_LEGACY_NAVIGATION ?? this.env.FEATURE_LEGACY_NAVIGATION)
      ?? normalizeMode(this.env.VITE_LEGACY_NAVIGATION_MODE ?? this.env.LEGACY_NAVIGATION_MODE)
      ?? defaultMode;
  }
}
