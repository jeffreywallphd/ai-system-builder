export interface BuildEntryFeatureFlagOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function normalizeFlag(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }
  return undefined;
}

export class BuildEntryFeatureFlag {
  private readonly env: Readonly<Record<string, string | undefined>>;

  constructor(options: BuildEntryFeatureFlagOptions = {}) {
    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    this.env = options.env
      ?? processLike?.env
      ?? import.meta.env
      ?? {};
  }

  public isEnabled(): boolean {
    const explicit = normalizeFlag(this.env.VITE_FEATURE_BUILD_ENTRY ?? this.env.FEATURE_BUILD_ENTRY);
    if (typeof explicit === "boolean") {
      return explicit;
    }

    const rollout = normalizeFlag(this.env.VITE_ENABLE_INTENT_UX ?? this.env.ENABLE_INTENT_UX);
    return rollout === true;
  }
}

