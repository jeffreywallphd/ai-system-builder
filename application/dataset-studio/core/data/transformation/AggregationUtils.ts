import type { CanonicalRecordValue } from "../../../../../domain/dataset-studio/CanonicalDataShapes";

export const AggregationOperations = Object.freeze({
  count: "count",
  sum: "sum",
  avg: "avg",
  min: "min",
  max: "max",
  distinctCount: "distinct-count",
  first: "first",
  last: "last",
} as const);

export type AggregationOperation = typeof AggregationOperations[keyof typeof AggregationOperations];

export const AggregationNullHandlingModes = Object.freeze({
  exclude: "exclude",
  include: "include",
} as const);

export type AggregationNullHandlingMode = typeof AggregationNullHandlingModes[keyof typeof AggregationNullHandlingModes];

export interface AggregationDefinition {
  readonly operation: AggregationOperation;
  readonly sourceField?: string;
  readonly outputField: string;
}

export interface AggregationRow {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface AggregationGroup {
  readonly groupKey: string;
  readonly groupValues: Readonly<Record<string, CanonicalRecordValue>>;
  readonly rows: ReadonlyArray<AggregationRow>;
}

export interface AggregationSkippedDefinition {
  readonly operation: AggregationOperation;
  readonly sourceField?: string;
  readonly outputField: string;
  readonly reason: string;
}

function canonicalizeValueForKey(value: CanonicalRecordValue | undefined): CanonicalRecordValue {
  return value === undefined ? null : value;
}

function isIncludedValue(value: CanonicalRecordValue | undefined, nullHandlingMode: AggregationNullHandlingMode): boolean {
  if (value === undefined) {
    return false;
  }
  if (value === null && nullHandlingMode === AggregationNullHandlingModes.exclude) {
    return false;
  }
  return true;
}

function toComparableNumber(value: CanonicalRecordValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function toDistinctToken(value: CanonicalRecordValue): string {
  return JSON.stringify(value);
}

export function createDefaultAggregationOutputField(definition: {
  readonly operation: AggregationOperation;
  readonly sourceField?: string;
}): string {
  if (definition.operation === AggregationOperations.count && !definition.sourceField) {
    return "count";
  }
  if (definition.sourceField) {
    return `${definition.sourceField}_${definition.operation}`;
  }
  return definition.operation;
}

export function groupAggregationRows(
  rows: ReadonlyArray<AggregationRow>,
  groupByFields: ReadonlyArray<string>,
): ReadonlyArray<AggregationGroup> {
  const grouped = new Map<string, { values: Record<string, CanonicalRecordValue>; rows: AggregationRow[] }>();
  for (const row of rows) {
    const groupValues: Record<string, CanonicalRecordValue> = {};
    for (const fieldName of groupByFields) {
      groupValues[fieldName] = canonicalizeValueForKey(row.fields[fieldName]);
    }
    const groupKey = JSON.stringify(groupByFields.map((fieldName) => groupValues[fieldName]));
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    grouped.set(groupKey, { values: groupValues, rows: [row] });
  }

  return Object.freeze(
    [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, entry]) => Object.freeze({
        groupKey,
        groupValues: Object.freeze({ ...entry.values }),
        rows: Object.freeze([...entry.rows]),
      })),
  );
}

export function determineSkippedAggregations(
  rows: ReadonlyArray<AggregationRow>,
  definitions: ReadonlyArray<AggregationDefinition>,
  nullHandlingMode: AggregationNullHandlingMode,
): ReadonlyArray<AggregationSkippedDefinition> {
  const skipped: AggregationSkippedDefinition[] = [];

  for (const definition of definitions) {
    const requiresField = definition.operation !== AggregationOperations.count || Boolean(definition.sourceField);
    if (!requiresField) {
      continue;
    }

    const sourceField = definition.sourceField;
    if (!sourceField) {
      skipped.push(Object.freeze({
        operation: definition.operation,
        outputField: definition.outputField,
        reason: `Operation '${definition.operation}' requires a sourceField.`,
      }));
      continue;
    }

    const values = rows
      .map((row) => row.fields[sourceField])
      .filter((value): value is CanonicalRecordValue => isIncludedValue(value, nullHandlingMode));

    if (values.length === 0) {
      skipped.push(Object.freeze({
        operation: definition.operation,
        sourceField,
        outputField: definition.outputField,
        reason: `No values were available for source field '${sourceField}'.`,
      }));
      continue;
    }

    if (
      definition.operation === AggregationOperations.sum
      || definition.operation === AggregationOperations.avg
      || definition.operation === AggregationOperations.min
      || definition.operation === AggregationOperations.max
    ) {
      const numericCount = values.filter((value) => typeof value === "number").length;
      if (numericCount === 0) {
        skipped.push(Object.freeze({
          operation: definition.operation,
          sourceField,
          outputField: definition.outputField,
          reason: `Operation '${definition.operation}' requires numeric values in source field '${sourceField}'.`,
        }));
      }
    }
  }

  return Object.freeze(skipped);
}

export function evaluateAggregationDefinition(
  rows: ReadonlyArray<AggregationRow>,
  definition: AggregationDefinition,
  nullHandlingMode: AggregationNullHandlingMode,
): CanonicalRecordValue {
  if (definition.operation === AggregationOperations.count && !definition.sourceField) {
    return rows.length;
  }

  const sourceField = definition.sourceField;
  if (!sourceField) {
    return null;
  }

  const values = rows
    .map((row) => row.fields[sourceField])
    .filter((value): value is CanonicalRecordValue => isIncludedValue(value, nullHandlingMode));

  if (definition.operation === AggregationOperations.count) {
    return values.length;
  }
  if (definition.operation === AggregationOperations.distinctCount) {
    return new Set(values.map((value) => toDistinctToken(value))).size;
  }
  if (definition.operation === AggregationOperations.first) {
    return values.length > 0 ? values[0]! : null;
  }
  if (definition.operation === AggregationOperations.last) {
    return values.length > 0 ? values[values.length - 1]! : null;
  }

  const numericValues = values
    .map((value) => toComparableNumber(value))
    .filter((value): value is number => value !== undefined);

  if (numericValues.length === 0) {
    return null;
  }

  if (definition.operation === AggregationOperations.sum) {
    return numericValues.reduce((total, value) => total + value, 0);
  }
  if (definition.operation === AggregationOperations.avg) {
    return numericValues.reduce((total, value) => total + value, 0) / numericValues.length;
  }
  if (definition.operation === AggregationOperations.min) {
    return Math.min(...numericValues);
  }
  if (definition.operation === AggregationOperations.max) {
    return Math.max(...numericValues);
  }

  return null;
}
