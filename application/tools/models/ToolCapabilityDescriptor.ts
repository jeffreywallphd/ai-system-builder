export type ToolCapabilityProviderKind = "workflow" | "local" | "mcp";

export type ToolCapabilitySerializableValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<ToolCapabilitySerializableValue>
  | { readonly [key: string]: ToolCapabilitySerializableValue };

export interface ToolCapabilityIdentityDescriptor {
  readonly stableId: string;
  readonly providerScopedId: string;
}

export interface ToolCapabilityProviderDescriptor {
  readonly kind: ToolCapabilityProviderKind;
  readonly id: string;
  readonly label: string;
}

export interface ToolCapabilitySourceDescriptor {
  readonly kind?: ToolCapabilityProviderKind;
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
  readonly identity: ToolCapabilityIdentityDescriptor;
  readonly routingName: string;
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

export interface CreateToolCapabilityDescriptorParams {
  readonly id: string;
  readonly identity: ToolCapabilityIdentityDescriptor;
  readonly routingName?: string;
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

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneJsonValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneToolCapabilityRecord(
  value?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.freeze(cloneJsonValue(value));
}

export function createToolCapabilityDescriptor(
  params: CreateToolCapabilityDescriptorParams
): ToolCapabilityDescriptor {
  const id = params.id.trim();
  const stableId = params.identity.stableId.trim();
  const providerScopedId = params.identity.providerScopedId.trim();
  const displayName = params.displayName.trim();
  const routingName = (params.routingName?.trim() || displayName || providerScopedId).trim();
  const description = normalizeOptionalString(params.description);

  if (!id) {
    throw new Error("Tool capability descriptors require an id.");
  }

  if (!stableId) {
    throw new Error("Tool capability descriptors require an identity.stableId.");
  }

  if (!providerScopedId) {
    throw new Error("Tool capability descriptors require an identity.providerScopedId.");
  }

  if (!displayName) {
    throw new Error("Tool capability descriptors require a displayName.");
  }

  if (!routingName) {
    throw new Error("Tool capability descriptors require a routingName.");
  }

  return Object.freeze({
    id,
    identity: Object.freeze({
      stableId,
      providerScopedId,
    }),
    routingName,
    displayName,
    description,
    provider: Object.freeze({
      kind: params.provider.kind,
      id: params.provider.id.trim(),
      label: params.provider.label.trim(),
    }),
    source: Object.freeze({
      ...(params.source.kind ? { kind: params.source.kind } : {}),
      ...(normalizeOptionalString(params.source.workflowId)
        ? { workflowId: normalizeOptionalString(params.source.workflowId) }
        : {}),
      ...(normalizeOptionalString(params.source.workflowToolId)
        ? { workflowToolId: normalizeOptionalString(params.source.workflowToolId) }
        : {}),
      ...(normalizeOptionalString(params.source.workflowToolSlug)
        ? { workflowToolSlug: normalizeOptionalString(params.source.workflowToolSlug) }
        : {}),
      ...(normalizeOptionalString(params.source.localToolName)
        ? { localToolName: normalizeOptionalString(params.source.localToolName) }
        : {}),
      ...(normalizeOptionalString(params.source.serverId)
        ? { serverId: normalizeOptionalString(params.source.serverId) }
        : {}),
      ...(normalizeOptionalString(params.source.toolName)
        ? { toolName: normalizeOptionalString(params.source.toolName) }
        : {}),
    }),
    publication: Object.freeze({
      isPublished: params.publication.isPublished,
      title: normalizeOptionalString(params.publication.title),
      description: normalizeOptionalString(params.publication.description),
      category: normalizeOptionalString(params.publication.category),
      slug: normalizeOptionalString(params.publication.slug),
    }),
    inputSchema: cloneToolCapabilityRecord(params.inputSchema),
    outputSchema: cloneToolCapabilityRecord(params.outputSchema),
    annotations: cloneToolCapabilityRecord(params.annotations),
    metadata: cloneToolCapabilityRecord(params.metadata),
  });
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
