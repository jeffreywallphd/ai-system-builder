import type { EnvironmentConfigValue } from "@application/ports/interfaces/IEnvironmentConfigProvider";

function normalizeKey(key: string): string {
  const normalized = key.trim();

  if (!normalized) {
    throw new Error("Environment config key cannot be empty.");
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

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class EnvironmentConfig {
  private readonly values: ReadonlyMap<string, EnvironmentConfigValue>;

  constructor(
    values:
      | Readonly<Record<string, EnvironmentConfigValue>>
      | ReadonlyMap<string, EnvironmentConfigValue> = {}
  ) {
    const entries =
      values instanceof Map ? [...values.entries()] : Object.entries(values);

    this.values = new Map(
      entries.map(([key, value]) => [normalizeKey(key), cloneValue(value)])
    );
  }

  public get(key: string): EnvironmentConfigValue | undefined {
    return this.values.get(normalizeKey(key));
  }

  public getString(key: string): string | undefined {
    const value = this.get(key);

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

  public getNumber(key: string): number | undefined {
    const value = this.get(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return parseNumber(value);
    }

    return undefined;
  }

  public getBoolean(key: string): boolean | undefined {
    const value = this.get(key);

    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return parseBoolean(value);
    }

    return undefined;
  }

  public has(key: string): boolean {
    return this.values.has(normalizeKey(key));
  }

  public getByPrefix(
    prefix: string
  ): Readonly<Record<string, EnvironmentConfigValue>> {
    const normalizedPrefix = normalizeKey(prefix);
    const result: Record<string, EnvironmentConfigValue> = {};

    for (const [key, value] of this.values.entries()) {
      if (key === normalizedPrefix || key.startsWith(`${normalizedPrefix}.`)) {
        result[key] = cloneValue(value);
      }
    }

    return Object.freeze(result);
  }

  public withValue(key: string, value: EnvironmentConfigValue): EnvironmentConfig {
    const next = new Map(this.values);
    next.set(normalizeKey(key), cloneValue(value));
    return new EnvironmentConfig(next);
  }

  public withoutKey(key: string): EnvironmentConfig {
    const next = new Map(this.values);
    next.delete(normalizeKey(key));
    return new EnvironmentConfig(next);
  }

  public toObject(): Readonly<Record<string, EnvironmentConfigValue>> {
    const result: Record<string, EnvironmentConfigValue> = {};

    for (const [key, value] of this.values.entries()) {
      result[key] = cloneValue(value);
    }

    return Object.freeze(result);
  }

  public static fromEnv(
    env: Readonly<Record<string, string | undefined>>
  ): EnvironmentConfig {
    const values: Record<string, EnvironmentConfigValue> = {};

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        values[key] = value;
      }
    }

    return new EnvironmentConfig(values);
  }
}

