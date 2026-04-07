import type { INodeOutputStore } from "@application/ports/interfaces/INodeOutputStore";

export class DefaultNodeOutputStore implements INodeOutputStore {
  private readonly outputs = new Map<string, Readonly<Record<string, unknown>>>();

  public setNodeOutput(nodeId: string, output: Readonly<Record<string, unknown>>): void {
    this.outputs.set(nodeId.trim(), Object.freeze({ ...output }));
  }

  public getNodeOutput(nodeId: string): Readonly<Record<string, unknown>> | undefined {
    return this.outputs.get(nodeId.trim());
  }

  public hasNodeOutput(nodeId: string): boolean {
    return this.outputs.has(nodeId.trim());
  }

  public snapshot(): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
    return Object.freeze(Object.fromEntries(this.outputs.entries()));
  }

  public clear(): void {
    this.outputs.clear();
  }
}

