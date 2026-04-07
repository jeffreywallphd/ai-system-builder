import type { CanonicalRecordValue } from "../../../../../domain/dataset-studio/CanonicalDataShapes";
import {
  normalizeComparableValue,
  toComparableString,
  toStableComparableKey,
  type ValueNormalizationOptions,
} from "./TransformationComparisonUtils";

export const FilteringConditionOperators = Object.freeze({
  equals: "equals",
  notEquals: "not-equals",
  in: "in",
  notIn: "not-in",
  greaterThan: "greater-than",
  greaterThanOrEqual: "greater-than-or-equal",
  lessThan: "less-than",
  lessThanOrEqual: "less-than-or-equal",
  contains: "contains",
  notContains: "not-contains",
  startsWith: "starts-with",
  endsWith: "ends-with",
  isNull: "is-null",
  isNotNull: "is-not-null",
  isEmpty: "is-empty",
  isNotEmpty: "is-not-empty",
} as const);

export type FilteringConditionOperator = typeof FilteringConditionOperators[keyof typeof FilteringConditionOperators];

export const FilteringLogicalOperators = Object.freeze({
  and: "and",
  or: "or",
} as const);

export type FilteringLogicalOperator = typeof FilteringLogicalOperators[keyof typeof FilteringLogicalOperators];

export interface FilteringConditionDefinition {
  readonly id: string;
  readonly fieldName: string;
  readonly operator: FilteringConditionOperator;
  readonly value?: CanonicalRecordValue;
  readonly values?: ReadonlyArray<CanonicalRecordValue>;
}

export interface FilteringEvaluationOptions {
  readonly caseSensitive: boolean;
  readonly trimStrings: boolean;
  readonly treatMissingAsNull: boolean;
}

export interface FilteringConditionEvaluation {
  readonly conditionId: string;
  readonly matched: boolean;
}

function toNormalizationOptions(options: FilteringEvaluationOptions): ValueNormalizationOptions {
  return Object.freeze({
    caseSensitive: options.caseSensitive,
    trimStrings: options.trimStrings,
    treatMissingAsNull: options.treatMissingAsNull,
  });
}

function isNullLike(value: CanonicalRecordValue | undefined, treatMissingAsNull: boolean): boolean {
  if (value === null) {
    return true;
  }
  return value === undefined && treatMissingAsNull;
}

function isEmptyValue(value: CanonicalRecordValue | undefined, options: FilteringEvaluationOptions): boolean {
  if (isNullLike(value, options.treatMissingAsNull)) {
    return true;
  }
  if (typeof value === "string") {
    return options.trimStrings ? value.trim().length === 0 : value.length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

function evaluateOrdering(
  rowValue: CanonicalRecordValue | undefined,
  targetValue: CanonicalRecordValue | undefined,
  options: FilteringEvaluationOptions,
): number | undefined {
  if (typeof rowValue === "number" && typeof targetValue === "number") {
    return rowValue - targetValue;
  }
  if (typeof rowValue === "boolean" && typeof targetValue === "boolean") {
    if (rowValue === targetValue) {
      return 0;
    }
    return rowValue ? 1 : -1;
  }
  if (typeof rowValue === "string" && typeof targetValue === "string") {
    const leftDate = Date.parse(rowValue);
    const rightDate = Date.parse(targetValue);
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
      return leftDate - rightDate;
    }
    const left = toComparableString(rowValue, toNormalizationOptions(options));
    const right = toComparableString(targetValue, toNormalizationOptions(options));
    if (left === undefined || right === undefined) {
      return undefined;
    }
    return left.localeCompare(right);
  }
  return undefined;
}

export function evaluateFilteringCondition(
  row: Readonly<Record<string, CanonicalRecordValue>>,
  condition: FilteringConditionDefinition,
  options: FilteringEvaluationOptions,
): boolean {
  const rowValue = row[condition.fieldName];
  const normalizedRowValue = normalizeComparableValue(rowValue, toNormalizationOptions(options));

  if (condition.operator === FilteringConditionOperators.isNull) {
    return isNullLike(rowValue, options.treatMissingAsNull);
  }
  if (condition.operator === FilteringConditionOperators.isNotNull) {
    return !isNullLike(rowValue, options.treatMissingAsNull);
  }
  if (condition.operator === FilteringConditionOperators.isEmpty) {
    return isEmptyValue(rowValue, options);
  }
  if (condition.operator === FilteringConditionOperators.isNotEmpty) {
    return !isEmptyValue(rowValue, options);
  }

  if (condition.operator === FilteringConditionOperators.in || condition.operator === FilteringConditionOperators.notIn) {
    const normalizedValues = (condition.values ?? []).map((value) => toStableComparableKey(
      normalizeComparableValue(value, toNormalizationOptions(options)),
    ));
    const matched = normalizedValues.includes(toStableComparableKey(normalizedRowValue));
    return condition.operator === FilteringConditionOperators.in ? matched : !matched;
  }

  if (condition.operator === FilteringConditionOperators.contains || condition.operator === FilteringConditionOperators.notContains) {
    const expected = toComparableString(condition.value, toNormalizationOptions(options));
    const rowString = toComparableString(rowValue, toNormalizationOptions(options));
    let matched = false;
    if (expected !== undefined) {
      if (rowString !== undefined) {
        matched = rowString.includes(expected);
      } else if (Array.isArray(rowValue)) {
        matched = rowValue.some((entry) =>
          toStableComparableKey(normalizeComparableValue(entry, toNormalizationOptions(options)))
          === toStableComparableKey(normalizeComparableValue(condition.value, toNormalizationOptions(options))));
      }
    }
    return condition.operator === FilteringConditionOperators.contains ? matched : !matched;
  }

  if (condition.operator === FilteringConditionOperators.startsWith) {
    const expected = toComparableString(condition.value, toNormalizationOptions(options));
    const rowString = toComparableString(rowValue, toNormalizationOptions(options));
    return expected !== undefined && rowString !== undefined ? rowString.startsWith(expected) : false;
  }
  if (condition.operator === FilteringConditionOperators.endsWith) {
    const expected = toComparableString(condition.value, toNormalizationOptions(options));
    const rowString = toComparableString(rowValue, toNormalizationOptions(options));
    return expected !== undefined && rowString !== undefined ? rowString.endsWith(expected) : false;
  }

  if (
    condition.operator === FilteringConditionOperators.greaterThan
    || condition.operator === FilteringConditionOperators.greaterThanOrEqual
    || condition.operator === FilteringConditionOperators.lessThan
    || condition.operator === FilteringConditionOperators.lessThanOrEqual
  ) {
    const compared = evaluateOrdering(rowValue, condition.value, options);
    if (compared === undefined) {
      return false;
    }
    if (condition.operator === FilteringConditionOperators.greaterThan) {
      return compared > 0;
    }
    if (condition.operator === FilteringConditionOperators.greaterThanOrEqual) {
      return compared >= 0;
    }
    if (condition.operator === FilteringConditionOperators.lessThan) {
      return compared < 0;
    }
    return compared <= 0;
  }

  const normalizedConditionValue = normalizeComparableValue(condition.value, toNormalizationOptions(options));
  const matched = toStableComparableKey(normalizedRowValue) === toStableComparableKey(normalizedConditionValue);
  if (condition.operator === FilteringConditionOperators.equals) {
    return matched;
  }
  return !matched;
}

export function evaluateFilteringConditionGroup(
  row: Readonly<Record<string, CanonicalRecordValue>>,
  conditions: ReadonlyArray<FilteringConditionDefinition>,
  logicalOperator: FilteringLogicalOperator,
  options: FilteringEvaluationOptions,
): Readonly<{
  matched: boolean;
  conditionEvaluations: ReadonlyArray<FilteringConditionEvaluation>;
}> {
  const conditionEvaluations = conditions.map((condition) => Object.freeze({
    conditionId: condition.id,
    matched: evaluateFilteringCondition(row, condition, options),
  } satisfies FilteringConditionEvaluation));

  if (conditions.length === 0) {
    return Object.freeze({
      matched: true,
      conditionEvaluations: Object.freeze(conditionEvaluations),
    });
  }

  const matched = logicalOperator === FilteringLogicalOperators.and
    ? conditionEvaluations.every((evaluation) => evaluation.matched)
    : conditionEvaluations.some((evaluation) => evaluation.matched);
  return Object.freeze({
    matched,
    conditionEvaluations: Object.freeze(conditionEvaluations),
  });
}
