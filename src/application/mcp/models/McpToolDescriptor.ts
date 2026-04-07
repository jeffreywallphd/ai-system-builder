import { buildMcpToolId } from "@domain/mcp/McpToolIdentity";

export interface McpToolDescriptorSource {
  readonly kind: "mcp-server";
  readonly serverId: string;
}

export interface McpToolArgumentDescriptor {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: ReadonlyArray<string | number | boolean | null>;
  readonly format?: string;
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface McpToolDescriptor {
  readonly id: string;
  readonly serverId: string;
  readonly source: McpToolDescriptorSource;
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  readonly arguments: ReadonlyArray<McpToolArgumentDescriptor>;
  readonly categories: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<string>;
  readonly annotations?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly publicationState?: "unpublished" | "published-live" | "published-stale" | "disabled";
  readonly live?: boolean;
  readonly stale?: boolean;
}

export interface McpPromptDescriptor {
  readonly serverId: string;
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly arguments?: ReadonlyArray<McpToolArgumentDescriptor>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function buildMcpToolDescriptorId(serverId: string, toolName: string): string {
  return buildMcpToolId(serverId, toolName);
}

export function normalizeMcpToolDescriptor(
  descriptor: Partial<McpToolDescriptor> & {
    readonly serverId: string;
    readonly name: string;
    readonly inputSchema?: Readonly<Record<string, unknown>>;
    readonly outputSchema?: Readonly<Record<string, unknown>>;
    readonly annotations?: Readonly<Record<string, unknown>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly categories?: ReadonlyArray<string>;
    readonly tags?: ReadonlyArray<string>;
    readonly arguments?: ReadonlyArray<Partial<McpToolArgumentDescriptor>>;
    readonly source?: Partial<McpToolDescriptorSource>;
  }
): McpToolDescriptor {
  const serverId = descriptor.serverId.trim();
  const name = descriptor.name.trim();
  const metadata = cloneRecord(descriptor.metadata);
  const annotations = cloneRecord(descriptor.annotations);
  const inputSchema = ensureRecord(descriptor.inputSchema);
  const outputSchema = hasContent(descriptor.outputSchema) ? ensureRecord(descriptor.outputSchema) : undefined;

  return Object.freeze({
    id: descriptor.id?.trim() || buildMcpToolDescriptorId(serverId, name),
    serverId,
    source: Object.freeze({
      kind: "mcp-server",
      serverId: descriptor.source?.serverId?.trim() || serverId,
    }),
    name,
    title: descriptor.title?.trim() || undefined,
    description: descriptor.description?.trim() || undefined,
    inputSchema,
    outputSchema,
    arguments: normalizeArguments(descriptor.arguments, inputSchema),
    categories: normalizeStringList(
      descriptor.categories,
      metadata?.category,
      metadata?.categories,
      annotations?.category,
      annotations?.categories,
    ),
    tags: normalizeStringList(descriptor.tags, metadata?.tags, annotations?.tags),
    annotations,
    metadata,
    publicationState: descriptor.publicationState,
    live: descriptor.live === true,
    stale: descriptor.stale === true,
  });
}

function normalizeArguments(
  explicitArguments: ReadonlyArray<Partial<McpToolArgumentDescriptor>> | undefined,
  inputSchema: Readonly<Record<string, unknown>>
): ReadonlyArray<McpToolArgumentDescriptor> {
  if (explicitArguments && explicitArguments.length > 0) {
    return Object.freeze(
      explicitArguments
        .map((argument) => normalizeArgument(argument))
        .sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  const properties = ensurePlainRecord(inputSchema.properties);
  const requiredNames = new Set<string>(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)
      : []
  );

  return Object.freeze(
    Object.keys(properties)
      .sort((left, right) => left.localeCompare(right))
      .map((propertyName) => {
        const schema = ensureRecord(properties[propertyName]);
        return normalizeArgument({
          name: propertyName,
          title: typeof schema.title === "string" ? schema.title : undefined,
          description: typeof schema.description === "string" ? schema.description : undefined,
          type: normalizeType(schema.type),
          required: requiredNames.has(propertyName),
          defaultValue: schema.default,
          enumValues: normalizeEnumValues(schema.enum),
          format: typeof schema.format === "string" ? schema.format : undefined,
          schema,
        });
      })
  );
}

function normalizeArgument(argument: Partial<McpToolArgumentDescriptor>): McpToolArgumentDescriptor {
  const schema = ensureRecord(argument.schema);
  return Object.freeze({
    name: String(argument.name ?? "").trim(),
    title: argument.title?.trim() || undefined,
    description: argument.description?.trim() || undefined,
    type: normalizeType(argument.type ?? schema.type),
    required: argument.required === true,
    defaultValue: cloneUnknown(argument.defaultValue ?? schema.default),
    enumValues: normalizeEnumValues(argument.enumValues ?? schema.enum),
    format: argument.format?.trim() || (typeof schema.format === "string" ? schema.format : undefined),
    schema,
  });
}

function normalizeType(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return normalized.join(" | ") || "unknown";
  }
  return "unknown";
}

function normalizeEnumValues(value: unknown): ReadonlyArray<string | number | boolean | null> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.filter(
    (item): item is string | number | boolean | null =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null
  );
  return normalized.length > 0 ? Object.freeze([...normalized]) : undefined;
}

function normalizeStringList(...groups: ReadonlyArray<unknown>): ReadonlyArray<string> {
  const normalized = new Set<string>();
  for (const group of groups) {
    const values = Array.isArray(group) ? group : [group];
    for (const value of values) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed) normalized.add(trimmed);
    }
  }
  return Object.freeze([...normalized].sort((left, right) => left.localeCompare(right)));
}

function ensureRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ type: "object" });
  }
  return Object.freeze(cloneUnknown(value) as Record<string, unknown>);
}

function ensurePlainRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  return Object.freeze(cloneUnknown(value) as Record<string, unknown>);
}

function cloneRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze(cloneUnknown(value) as Record<string, unknown>);
}

function cloneUnknown<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasContent(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

