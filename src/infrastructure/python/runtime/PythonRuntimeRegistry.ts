import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

export class PythonRuntimeRegistry {
  private readonly config: PythonRuntimeConfig;
  private readonly client?: IPythonRuntimeClient;

  constructor(params: { config: PythonRuntimeConfig; client?: IPythonRuntimeClient }) {
    this.config = params.config;
    this.client = params.client;
  }

  public getConfig(): PythonRuntimeConfig {
    return this.config;
  }

  public isEnabled(): boolean {
    return this.config.isEnabled && !!this.client;
  }

  public getClient(): IPythonRuntimeClient | undefined {
    return this.client;
  }
}
