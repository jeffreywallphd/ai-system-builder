export interface DesktopRuntimeDiagnosticsFeatureFlagOptions {
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

export class DesktopRuntimeDiagnosticsFeatureFlag {
  private readonly env: Readonly<Record<string, string | undefined>>;

  public constructor(options: DesktopRuntimeDiagnosticsFeatureFlagOptions = {}) {
    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    this.env = options.env
      ?? processLike?.env
      ?? import.meta.env
      ?? {};
  }

  public isEnabled(): boolean {
    const explicit = normalizeFlag(
      this.env.VITE_ENABLE_DESKTOP_RUNTIME_DIAGNOSTICS
      ?? this.env.ENABLE_DESKTOP_RUNTIME_DIAGNOSTICS,
    );
    if (typeof explicit === "boolean") {
      return explicit;
    }

    const mode = (this.env.MODE ?? this.env.NODE_ENV ?? "").trim().toLowerCase();
    if (mode === "production") {
      return false;
    }

    const devFlag = (this.env as Readonly<Record<string, unknown>>).DEV;
    return devFlag === true || devFlag === "true" || devFlag === "1" || mode === "development";
  }
}
