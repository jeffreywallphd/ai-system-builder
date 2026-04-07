import type {
  EnvironmentConfigValue,
  IEnvironmentConfigProvider,
} from "./interfaces/IEnvironmentConfigProvider";

function normalizeKey(key: string): string {
  const normalized = key.trim();

  if (!normalized) {
    throw new Error("Configuration key cannot be empty.");
  }

  return normalized;
}

function cloneValue(value: EnvironmentConfigValue): EnvironmentConfigValue {
  if (Array.isArray(value)) {
    return Object.freeze([...value]);
  }

  if (value !== null && typeof value === "object") {
    return Object.freeze({ ...value });
  }

  return value;
}

function parseBooleanString(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseNumberString(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class EnvironmentConfigProvider implements IEnvironmentConfigProvider {
  private readonly values: ReadonlyMap<string, EnvironmentConfigValue>;

  constructor(
    values:
      | Readonly<Record<string, EnvironmentConfigValue>>
      | ReadonlyMap<string, EnvironmentConfigValue> = {}
  ) {
    const entries =
      values instanceof Map
        ? [...values.entries()]
        : Object.entries(values);

    this.values = new Map(
      entries.map(([key, value]) => [normalizeKey(key), cloneValue(value)])
    );
  }

  public async get(
    key: string
  ): Promise<EnvironmentConfigValue | undefined> {
    const normalizedKey = normalizeKey(key);
    return this.values.get(normalizedKey);
  }

  public async getString(key: string): Promise<string | undefined> {
    const value = await this.get(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return undefined;
  }

  public async getNumber(key: string): Promise<number | undefined> {
    const value = await this.get(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return parseNumberString(value);
    }

    return undefined;
  }

  public async getBoolean(key: string): Promise<boolean | undefined> {
    const value = await this.get(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return parseBooleanString(value);
    }

    return undefined;
  }

  public async requireString(key: string): Promise<string> {
    const value = await this.getString(key);

    if (value === undefined) {
      throw new Error(`Required configuration value '${normalizeKey(key)}' is missing or invalid.`);
    }

    return value;
  }

  public async has(key: string): Promise<boolean> {
    const normalizedKey = normalizeKey(key);
    return this.values.has(normalizedKey);
  }

  public async getByPrefix(
    prefix: string
  ): Promise<Readonly<Record<string, EnvironmentConfigValue>>> {
    const normalizedPrefix = normalizeKey(prefix);
    const result: Record<string, EnvironmentConfigValue> = {};

    for (const [key, value] of this.values.entries()) {
      if (key === normalizedPrefix || key.startsWith(`${normalizedPrefix}.`)) {
        result[key] = cloneValue(value);
      }
    }

    return Object.freeze(result);
  }

  public withValue(
    key: string,
    value: EnvironmentConfigValue
  ): EnvironmentConfigProvider {
    const next = new Map(this.values);
    next.set(normalizeKey(key), cloneValue(value));
    return new EnvironmentConfigProvider(next);
  }

  public withoutKey(key: string): EnvironmentConfigProvider {
    const next = new Map(this.values);
    next.delete(normalizeKey(key));
    return new EnvironmentConfigProvider(next);
  }

  public static fromEnv(
    env: Readonly<Record<string, string | undefined>>
  ): EnvironmentConfigProvider {
    const values: Record<string, EnvironmentConfigValue> = {};

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        values[key] = value;
      }
    }

    return new EnvironmentConfigProvider(values);
  }
}
