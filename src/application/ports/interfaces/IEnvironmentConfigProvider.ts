export type EnvironmentConfigValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<string>
  | Readonly<Record<string, string | number | boolean | null>>;

export interface IEnvironmentConfigProvider {
  /**
   * Returns a raw config value by key, or undefined when absent.
   */
  get(key: string): Promise<EnvironmentConfigValue | undefined>;

  /**
   * Returns a string config value.
   */
  getString(key: string): Promise<string | undefined>;

  /**
   * Returns a number config value.
   */
  getNumber(key: string): Promise<number | undefined>;

  /**
   * Returns a boolean config value.
   */
  getBoolean(key: string): Promise<boolean | undefined>;

  /**
   * Returns a required string value or throws if missing/invalid.
   */
  requireString(key: string): Promise<string>;

  /**
   * Returns true when the key exists.
   */
  has(key: string): Promise<boolean>;

  /**
   * Returns a grouped config object by prefix.
   * Useful for provider/runtime-scoped configuration.
   */
  getByPrefix(
    prefix: string
  ): Promise<Readonly<Record<string, EnvironmentConfigValue>>>;
}
