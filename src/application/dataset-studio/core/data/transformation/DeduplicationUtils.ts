import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import { compareFuzzyStrings } from "./FuzzyStringMatching";
import {
  normalizeComparableValue,
  projectComparableFields,
  toComparableString,
  toStableComparableKey,
  type ValueNormalizationOptions,
} from "./TransformationComparisonUtils";

export interface DeduplicationComparableRow {
  readonly rowId: string;
  readonly rowIndex: number;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DeduplicationPairConfidence {
  readonly fieldName: string;
  readonly distance: number;
  readonly confidence: number;
}

export interface DeduplicationGroup {
  readonly groupId: string;
  readonly rowIds: ReadonlyArray<string>;
  readonly rowIndexes: ReadonlyArray<number>;
  readonly pairDistances: ReadonlyArray<DeduplicationPairConfidence>;
}

class DisjointSet {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
  }

  public find(index: number): number {
    if (this.parents[index] === index) {
      return index;
    }
    this.parents[index] = this.find(this.parents[index]!);
    return this.parents[index]!;
  }

  public union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parents[rightRoot] = leftRoot;
    }
  }
}

function groupRowsByIndex(rows: ReadonlyArray<DeduplicationComparableRow>, groups: ReadonlyArray<ReadonlyArray<number>>): ReadonlyArray<DeduplicationGroup> {
  return Object.freeze(groups.map((rowIndexes, groupIndex) => Object.freeze({
    groupId: `duplicate-group-${groupIndex + 1}`,
    rowIds: Object.freeze(rowIndexes.map((rowIndex) => rows[rowIndex]!.rowId)),
    rowIndexes: Object.freeze([...rowIndexes]),
    pairDistances: Object.freeze([]),
  })));
}

export function findExactDuplicateGroupsByAllFields(
  rows: ReadonlyArray<DeduplicationComparableRow>,
  options: ValueNormalizationOptions,
): ReadonlyArray<DeduplicationGroup> {
  const grouped = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const normalized = normalizeComparableValue(row.fields, options);
    const key = toStableComparableKey(normalized);
    const collection = grouped.get(key);
    if (collection) {
      collection.push(index);
      return;
    }
    grouped.set(key, [index]);
  });

  const duplicateGroups = [...grouped.values()]
    .filter((indexes) => indexes.length > 1)
    .sort((left, right) => left[0]! - right[0]!);

  return groupRowsByIndex(rows, Object.freeze(duplicateGroups));
}

export function findExactDuplicateGroupsByFields(
  rows: ReadonlyArray<DeduplicationComparableRow>,
  targetFields: ReadonlyArray<string>,
  options: ValueNormalizationOptions,
): ReadonlyArray<DeduplicationGroup> {
  const grouped = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = toStableComparableKey(projectComparableFields(row.fields, targetFields, options));
    const collection = grouped.get(key);
    if (collection) {
      collection.push(index);
      return;
    }
    grouped.set(key, [index]);
  });

  const duplicateGroups = [...grouped.values()]
    .filter((indexes) => indexes.length > 1)
    .sort((left, right) => left[0]! - right[0]!);

  return groupRowsByIndex(rows, Object.freeze(duplicateGroups));
}

export function findFuzzyDuplicateGroupsByFields(
  rows: ReadonlyArray<DeduplicationComparableRow>,
  targetFields: ReadonlyArray<string>,
  options: ValueNormalizationOptions,
  maxDistance: number,
): ReadonlyArray<DeduplicationGroup> {
  if (rows.length <= 1) {
    return Object.freeze([]);
  }

  const unionSet = new DisjointSet(rows.length);
  const pairDistances = new Map<string, DeduplicationPairConfidence[]>();

  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    const leftRow = rows[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const rightRow = rows[rightIndex]!;
      const pairConfidence: DeduplicationPairConfidence[] = [];
      let pairMatched = true;

      for (const fieldName of targetFields) {
        const leftValue = toComparableString(leftRow.fields[fieldName], options);
        const rightValue = toComparableString(rightRow.fields[fieldName], options);
        const leftComparable = leftValue ?? "";
        const rightComparable = rightValue ?? "";
        const result = compareFuzzyStrings(leftComparable, rightComparable, maxDistance);
        pairConfidence.push(Object.freeze({
          fieldName,
          distance: result.distance,
          confidence: result.confidence,
        }));
        if (!result.matched) {
          pairMatched = false;
          break;
        }
      }

      if (!pairMatched) {
        continue;
      }
      unionSet.union(leftIndex, rightIndex);
      pairDistances.set(`${leftIndex}:${rightIndex}`, pairConfidence);
    }
  }

  const groupsByRoot = new Map<number, number[]>();
  for (let index = 0; index < rows.length; index += 1) {
    const root = unionSet.find(index);
    const group = groupsByRoot.get(root);
    if (group) {
      group.push(index);
      continue;
    }
    groupsByRoot.set(root, [index]);
  }

  const groups = [...groupsByRoot.values()]
    .filter((indexes) => indexes.length > 1)
    .map((indexes) => indexes.sort((left, right) => left - right))
    .sort((left, right) => left[0]! - right[0]!);

  return Object.freeze(groups.map((indexes, index) => {
    const distances: DeduplicationPairConfidence[] = [];
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const key = `${indexes[left]}:${indexes[right]}`;
        const pair = pairDistances.get(key);
        if (pair) {
          distances.push(...pair);
        }
      }
    }
    return Object.freeze({
      groupId: `duplicate-group-${index + 1}`,
      rowIds: Object.freeze(indexes.map((rowIndex) => rows[rowIndex]!.rowId)),
      rowIndexes: Object.freeze(indexes),
      pairDistances: Object.freeze(distances),
    } satisfies DeduplicationGroup);
  }));
}

