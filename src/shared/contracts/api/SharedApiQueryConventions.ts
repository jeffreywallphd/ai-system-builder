import {
  SharedApiQueryDefaults,
  SharedApiSortDirections,
  type SharedApiSortDirection,
} from "./SharedApiContractPrimitives";

export const SharedApiQueryParamKeys = Object.freeze({
  workspaceId: "workspaceId",
  actorWorkspaceId: "actorWorkspaceId",
  limit: "limit",
  offset: "offset",
  sortBy: "sortBy",
  sortDirection: "sortDirection",
  search: "search",
} as const);

export interface SharedApiListQueryPagination {
  readonly limit?: number;
  readonly offset?: number;
}

export interface SharedApiListQuerySorting {
  readonly sortBy?: string;
  readonly sortDirection?: SharedApiSortDirection;
}

export interface SharedApiListQueryConventions {
  readonly workspaceId?: string;
  readonly actorWorkspaceId?: string;
  readonly search?: string;
  readonly pagination?: SharedApiListQueryPagination;
  readonly sorting?: SharedApiListQuerySorting;
}

export type SharedApiQueryKeyPrimitive = string | number | boolean | null;

export interface SharedApiQueryKeyInput {
  readonly domain: string;
  readonly operation: string;
  readonly context?: SharedApiListQueryConventions;
  readonly filters?: Readonly<Record<string, SharedApiQueryKeyPrimitive | ReadonlyArray<SharedApiQueryKeyPrimitive> | undefined>>;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function appendSharedApiListQueryConventions(
  query: URLSearchParams,
  conventions: SharedApiListQueryConventions,
): void {
  const workspaceId = normalizeOptionalString(conventions.workspaceId);
  if (workspaceId) {
    query.set(SharedApiQueryParamKeys.workspaceId, workspaceId);
  }

  const actorWorkspaceId = normalizeOptionalString(conventions.actorWorkspaceId);
  if (actorWorkspaceId) {
    query.set(SharedApiQueryParamKeys.actorWorkspaceId, actorWorkspaceId);
  }

  const search = normalizeOptionalString(conventions.search);
  if (search) {
    query.set(SharedApiQueryParamKeys.search, search);
  }

  if (typeof conventions.pagination?.limit === "number") {
    query.set(SharedApiQueryParamKeys.limit, String(conventions.pagination.limit));
  }
  if (typeof conventions.pagination?.offset === "number") {
    query.set(SharedApiQueryParamKeys.offset, String(conventions.pagination.offset));
  }

  const sortBy = normalizeOptionalString(conventions.sorting?.sortBy);
  if (sortBy) {
    query.set(SharedApiQueryParamKeys.sortBy, sortBy);
  }

  if (conventions.sorting?.sortDirection) {
    query.set(SharedApiQueryParamKeys.sortDirection, conventions.sorting.sortDirection);
  }
}

export function appendSharedApiQueryList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      query.append(key, normalized);
    }
  }
}

export function appendSharedApiQueryValue(query: URLSearchParams, key: string, value?: string): void {
  const normalized = normalizeOptionalString(value);
  if (normalized) {
    query.set(key, normalized);
  }
}

export function appendSharedApiQueryBoolean(query: URLSearchParams, key: string, value: boolean | undefined): void {
  if (typeof value === "boolean") {
    query.set(key, value ? "true" : "false");
  }
}

export function toSharedApiQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function stableComparable(value: SharedApiQueryKeyPrimitive | ReadonlyArray<SharedApiQueryKeyPrimitive> | undefined): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => entry ?? null));
  }
  return value ?? null;
}

function toStableFilters(
  filters?: Readonly<Record<string, SharedApiQueryKeyPrimitive | ReadonlyArray<SharedApiQueryKeyPrimitive> | undefined>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!filters) {
    return undefined;
  }

  const normalizedEntries = Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, stableComparable(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function normalizeQueryKeyContext(context: SharedApiListQueryConventions | undefined): Readonly<Record<string, unknown>> | undefined {
  if (!context) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};
  const workspaceId = normalizeOptionalString(context.workspaceId);
  const actorWorkspaceId = normalizeOptionalString(context.actorWorkspaceId);
  const search = normalizeOptionalString(context.search);

  if (workspaceId) {
    normalized.workspaceId = workspaceId;
  }
  if (actorWorkspaceId) {
    normalized.actorWorkspaceId = actorWorkspaceId;
  }
  if (search) {
    normalized.search = search;
  }

  const limit = context.pagination?.limit;
  const offset = context.pagination?.offset;
  if (typeof limit === "number") {
    normalized.limit = limit;
  }
  if (typeof offset === "number") {
    normalized.offset = offset;
  }

  const sortBy = normalizeOptionalString(context.sorting?.sortBy);
  const sortDirection = context.sorting?.sortDirection;
  if (sortBy) {
    normalized.sortBy = sortBy;
  }
  if (sortDirection) {
    normalized.sortDirection = sortDirection;
  }

  return Object.keys(normalized).length > 0 ? Object.freeze(normalized) : undefined;
}

export function buildSharedApiListQueryKey(input: SharedApiQueryKeyInput): string {
  const domain = normalizeOptionalString(input.domain) ?? "unknown-domain";
  const operation = normalizeOptionalString(input.operation) ?? "unknown-operation";
  const context = normalizeQueryKeyContext(input.context);
  const filters = toStableFilters(input.filters);

  return JSON.stringify(Object.freeze({
    domain,
    operation,
    context,
    filters,
    conventions: Object.freeze({
      defaultLimit: SharedApiQueryDefaults.defaultLimit,
      maxLimit: SharedApiQueryDefaults.maxLimit,
      sortDirections: Object.freeze([SharedApiSortDirections.ascending, SharedApiSortDirections.descending]),
    }),
  }));
}
