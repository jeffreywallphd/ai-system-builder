export interface INodeOutputStore {
  setNodeOutput(nodeId: string, output: Readonly<Record<string, unknown>>): void;
  getNodeOutput(nodeId: string): Readonly<Record<string, unknown>> | undefined;
  hasNodeOutput(nodeId: string): boolean;
  snapshot(): Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  clear(): void;
}
