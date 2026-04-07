import type {
  EnvironmentConfigValue,
  IEnvironmentConfigProvider,
} from "../../application/ports/interfaces/IEnvironmentConfigProvider";
import { EnvironmentConfig } from "./EnvironmentConfig";

export class EnvironmentConfigProvider implements IEnvironmentConfigProvider {
  private readonly config: EnvironmentConfig;

  constructor(config: EnvironmentConfig) {
    this.config = config;
  }

  public async get(
    key: string
  ): Promise<EnvironmentConfigValue | undefined> {
    return this.config.get(key);
  }

  public async getString(key: string): Promise<string | undefined> {
    return this.config.getString(key);
  }

  public async getNumber(key: string): Promise<number | undefined> {
    return this.config.getNumber(key);
  }

  public async getBoolean(key: string): Promise<boolean | undefined> {
    return this.config.getBoolean(key);
  }

  public async requireString(key: string): Promise<string> {
    const value = this.config.getString(key);

    if (value === undefined) {
      throw new Error(
        `Required configuration value '${key.trim()}' is missing or invalid.`
      );
    }

    return value;
  }

  public async has(key: string): Promise<boolean> {
    return this.config.has(key);
  }

  public async getByPrefix(
    prefix: string
  ): Promise<Readonly<Record<string, EnvironmentConfigValue>>> {
    return this.config.getByPrefix(prefix);
  }

  public static fromEnv(
    env: Readonly<Record<string, string | undefined>>
  ): EnvironmentConfigProvider {
    return new EnvironmentConfigProvider(EnvironmentConfig.fromEnv(env));
  }
}
