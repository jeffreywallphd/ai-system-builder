import type { IPythonRuntimeClient, IPythonRuntimeHealthResponse } from "@application/ports/interfaces/IPythonRuntimeClient";

export class PythonRuntimeHealthMonitor {
  private readonly client: IPythonRuntimeClient;

  constructor(client: IPythonRuntimeClient) {
    this.client = client;
  }

  public async checkHealth(): Promise<IPythonRuntimeHealthResponse> {
    return this.client.health();
  }

  public async isHealthy(): Promise<boolean> {
    try {
      return (await this.client.health()).status === "ok";
    } catch {
      return false;
    }
  }
}

