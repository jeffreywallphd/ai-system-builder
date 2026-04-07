import {
  SharedApiQueryDefaults,
  SharedApiSortDirections,
  type SharedApiSortDirection,
} from "../../contracts/api/SharedApiContractPrimitives";
import {
  SharedApiQueryParamKeys,
  type SharedApiListQueryConventions,
  type SharedApiListQueryPagination,
  type SharedApiListQuerySorting,
} from "../../contracts/api/SharedApiQueryConventions";

export interface SharedApiQuerySchemaValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export class SharedApiQuerySchemaValidationError extends Error {
  public readonly issues: ReadonlyArray<SharedApiQuerySchemaValidationIssue>;

  constructor(issues: ReadonlyArray<SharedApiQuerySchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Query validation failed.";
    super(`Shared API query validation failed: ${summary}`);
    this.name = "SharedApiQuerySchemaValidationError";
    this.issues = issues;
  }
}

function normalizeOptionalString(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  if (!/^-?\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseSharedApiListQueryConventions(searchParams: URLSearchParams): SharedApiListQueryConventions {
  const issues: SharedApiQuerySchemaValidationIssue[] = [];

  const limitInput = searchParams.get(SharedApiQueryParamKeys.limit);
  const limit = parseOptionalInteger(limitInput);
  if (limitInput !== null && (limit === undefined || limit < 1)) {
    issues.push(Object.freeze({
      path: SharedApiQueryParamKeys.limit,
      code: "invalid-integer",
      message: "limit must be an integer >= 1.",
    }));
  }
  if (typeof limit === "number" && limit > SharedApiQueryDefaults.maxLimit) {
    issues.push(Object.freeze({
      path: SharedApiQueryParamKeys.limit,
      code: "max-exceeded",
      message: `limit must be <= ${SharedApiQueryDefaults.maxLimit}.`,
    }));
  }

  const offsetInput = searchParams.get(SharedApiQueryParamKeys.offset);
  const offset = parseOptionalInteger(offsetInput);
  if (offsetInput !== null && (offset === undefined || offset < 0)) {
    issues.push(Object.freeze({
      path: SharedApiQueryParamKeys.offset,
      code: "invalid-integer",
      message: "offset must be an integer >= 0.",
    }));
  }

  const sortBy = normalizeOptionalString(searchParams.get(SharedApiQueryParamKeys.sortBy));
  const sortDirectionInput = normalizeOptionalString(searchParams.get(SharedApiQueryParamKeys.sortDirection));
  const sortDirection = sortDirectionInput as SharedApiSortDirection | undefined;
  if (
    sortDirectionInput
    && sortDirectionInput !== SharedApiSortDirections.ascending
    && sortDirectionInput !== SharedApiSortDirections.descending
  ) {
    issues.push(Object.freeze({
      path: SharedApiQueryParamKeys.sortDirection,
      code: "invalid-enum",
      message: "sortDirection must be one of: asc, desc.",
    }));
  }

  const search = normalizeOptionalString(searchParams.get(SharedApiQueryParamKeys.search));
  if (search && search.length > SharedApiQueryDefaults.maxSearchLength) {
    issues.push(Object.freeze({
      path: SharedApiQueryParamKeys.search,
      code: "max-length-exceeded",
      message: `search must be <= ${SharedApiQueryDefaults.maxSearchLength} characters.`,
    }));
  }

  if (issues.length > 0) {
    throw new SharedApiQuerySchemaValidationError(Object.freeze(issues));
  }

  const pagination: SharedApiListQueryPagination | undefined = typeof limit === "number" || typeof offset === "number"
    ? Object.freeze({
      limit,
      offset,
    })
    : undefined;

  const sorting: SharedApiListQuerySorting | undefined = sortBy || sortDirection
    ? Object.freeze({
      sortBy,
      sortDirection,
    })
    : undefined;

  return Object.freeze({
    workspaceId: normalizeOptionalString(searchParams.get(SharedApiQueryParamKeys.workspaceId)),
    actorWorkspaceId: normalizeOptionalString(searchParams.get(SharedApiQueryParamKeys.actorWorkspaceId)),
    search,
    pagination,
    sorting,
  });
}
