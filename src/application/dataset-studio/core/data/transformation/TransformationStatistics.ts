import { max, mean, median, min, standardDeviation, sum } from "simple-statistics";

export interface NumericSummary {
  readonly count: number;
  readonly sum: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly standardDeviation?: number;
}

export interface NumericSummaryOptions {
  readonly singleValueStandardDeviationZero?: boolean;
}

export function summarizeNumericValues(
  values: ReadonlyArray<number>,
  options?: NumericSummaryOptions,
): NumericSummary | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return Object.freeze({
    count: values.length,
    sum: sum(values),
    mean: mean(values),
    median: median(values),
    min: min(values),
    max: max(values),
    standardDeviation: values.length > 1
      ? standardDeviation(values)
      : options?.singleValueStandardDeviationZero
        ? 0
        : undefined,
  });
}
