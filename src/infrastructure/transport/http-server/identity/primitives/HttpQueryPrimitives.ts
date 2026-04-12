import {
  SharedApiQuerySchemaValidationError,
  parseSharedApiListQueryConventions,
} from "@shared/schemas/api/SharedApiQuerySchemaContracts";

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function parseOptionalCsvEnumList<TValue extends string>(
  value: string | null,
  enumeration: ReadonlyArray<TValue>,
): { readonly ok: true; readonly value?: ReadonlyArray<TValue> } | { readonly ok: false } {
  if (!value) {
    return { ok: true, value: undefined };
  }

  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (values.length < 1) {
    return { ok: true, value: undefined };
  }

  const normalized: TValue[] = [];
  for (const candidate of values) {
    if (!enumeration.includes(candidate as TValue)) {
      return { ok: false };
    }
    normalized.push(candidate as TValue);
  }

  return {
    ok: true,
    value: Object.freeze(normalized),
  };
}

export function parseOptionalMultiEnumList<TValue extends string>(
  searchParams: URLSearchParams,
  repeatedKey: string,
  csvFallbackKey: string,
  enumeration: ReadonlyArray<TValue>,
): { readonly ok: true; readonly value?: ReadonlyArray<TValue> } | { readonly ok: false } {
  const repeatedValues = searchParams.getAll(repeatedKey)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (repeatedValues.length > 0) {
    return parseOptionalCsvEnumList(repeatedValues.join(","), enumeration);
  }

  return parseOptionalCsvEnumList(searchParams.get(csvFallbackKey), enumeration);
}

export function parseOptionalStringList(
  searchParams: URLSearchParams,
  repeatedKey: string,
  csvFallbackKey: string,
): ReadonlyArray<string> | undefined {
  const repeatedValues = searchParams.getAll(repeatedKey)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const csvValues = (searchParams.get(csvFallbackKey) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const merged = [...repeatedValues, ...csvValues];
  if (merged.length < 1) {
    return undefined;
  }
  return Object.freeze([...new Set(merged)]);
}

export function mergeOptionalStringLists(
  first: ReadonlyArray<string> | undefined,
  second: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> | undefined {
  const merged = [...(first ?? []), ...(second ?? [])];
  if (merged.length < 1) {
    return undefined;
  }
  return Object.freeze([...new Set(merged)]);
}

export function parseSharedListPaginationFromQuery(
  searchParams: URLSearchParams,
):
  | { readonly ok: true; readonly limit: number | undefined; readonly offset: number | undefined }
  | { readonly ok: false; readonly issue: SharedApiQuerySchemaValidationError["issues"][number] } {
  try {
    const parsed = parseSharedApiListQueryConventions(searchParams);
    return {
      ok: true,
      limit: parsed.pagination?.limit,
      offset: parsed.pagination?.offset,
    };
  } catch (error) {
    if (error instanceof SharedApiQuerySchemaValidationError) {
      return {
        ok: false,
        issue: error.issues[0] ?? Object.freeze({
          path: "query",
          code: "invalid-request",
          message: "Query validation failed.",
        }),
      };
    }

    return {
      ok: false,
      issue: Object.freeze({
        path: "query",
        code: "invalid-request",
        message: "Query validation failed.",
      }),
    };
  }
}
