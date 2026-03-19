export type ToolCapabilityProviderKind = "workflow" | "local" | "mcp";

export interface ToolCapabilityProviderDescriptor {
  readonly kind: ToolCapabilityProviderKind;
  readonly id: string;
  readonly label: string;
}

export interface ToolCapabilitySourceDescriptor {
  readonly workflowId?: string;
  readonly workflowToolId?: string;
  readonly workflowToolSlug?: string;
  readonly localToolName?: string;
  readonly serverId?: string;
  readonly toolName?: string;
}

export interface ToolCapabilityPublicationMetadata {
  readonly isPublished: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly category?: string;
  readonly slug?: string;
}

export interface ToolCapabilityDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly provider: ToolCapabilityProviderDescriptor;
  readonly source: ToolCapabilitySourceDescriptor;
  readonly publication: ToolCapabilityPublicationMetadata;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  readonly annotations?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._:-]+/g, "-");
}

export function buildToolCapabilityId(
  providerKind: ToolCapabilityProviderKind,
  ...segments: ReadonlyArray<string | undefined>
): string {
  const normalizedSegments = segments
    .map((segment) => (segment ? normalizeSegment(segment) : ""))
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    throw new Error("Tool capability ids require at least one provider-scoped segment.");
  }

  return `${providerKind}:${normalizedSegments.join(":")}`;
}
