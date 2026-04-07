export interface McpToolDependencyReference {
  readonly kind: "workflow";
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

export interface IMcpToolDependencyScanner {
  scanToolReferences(toolId: string): Promise<ReadonlyArray<McpToolDependencyReference>>;
}
