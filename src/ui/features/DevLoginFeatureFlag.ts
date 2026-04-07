export interface DevLoginFeatureFlagOptions {
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

export class DevLoginFeatureFlag {
  private readonly env: Readonly<Record<string, string | undefined>>;

  public constructor(options: DevLoginFeatureFlagOptions = {}) {
    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    this.env = options.env
      ?? processLike?.env
      ?? import.meta.env
      ?? {};
  }

  public isEnabled(): boolean {
    const explicit = normalizeFlag(this.env.VITE_ENABLE_DEV_LOGIN ?? this.env.ENABLE_DEV_LOGIN);
    if (typeof explicit === "boolean") {
      return explicit;
    }

    const mode = (this.env.MODE ?? this.env.NODE_ENV ?? "").trim().toLowerCase();
    if (mode === "production") {
      return false;
    }

    return this.env.DEV === "true" || this.env.DEV === "1" || mode === "development";
  }
}
