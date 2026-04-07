import { BuildEntryFeatureFlag } from "./BuildEntryFeatureFlag";

export interface IntentNavigationFeatureFlagOptions {
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

export class IntentNavigationFeatureFlag {
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly buildEntryFlag: BuildEntryFeatureFlag;

  constructor(options: IntentNavigationFeatureFlagOptions = {}) {
    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    this.env = options.env
      ?? processLike?.env
      ?? import.meta.env
      ?? {};
    this.buildEntryFlag = new BuildEntryFeatureFlag({ env: this.env });
  }

  public isEnabled(): boolean {
    const explicit = normalizeFlag(this.env.VITE_FEATURE_INTENT_NAVIGATION ?? this.env.FEATURE_INTENT_NAVIGATION);
    if (typeof explicit === "boolean") {
      return explicit;
    }

    return this.buildEntryFlag.isEnabled();
  }
}
