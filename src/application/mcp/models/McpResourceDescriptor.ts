export interface McpResourceDescriptor {
  readonly serverId: string;
  readonly uri: string;
  readonly name?: string;
  readonly title?: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
