import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  type CanonicalRecordItem,
  type CanonicalRecordsShape,
  type CanonicalTableRow,
} from "../../../../../domain/dataset-studio/CanonicalDataShapes";
import type { TransformationInputData } from "./TransformationContracts";

function normalizeSampleSize(sampleSize: number | undefined, totalCount: number): number {
  if (!Number.isFinite(sampleSize) || sampleSize === undefined) {
    return totalCount;
  }

  const normalized = Math.floor(sampleSize);
  if (normalized < 1) {
    return Math.min(1, totalCount);
  }

  return Math.min(normalized, totalCount);
}

function sampleRecords(records: ReadonlyArray<CanonicalRecordItem>, sampleSize?: number): ReadonlyArray<CanonicalRecordItem> {
  const size = normalizeSampleSize(sampleSize, records.length);
  return Object.freeze(records.slice(0, size));
}

function sampleRows(rows: ReadonlyArray<CanonicalTableRow>, sampleSize?: number): ReadonlyArray<CanonicalTableRow> {
  const size = normalizeSampleSize(sampleSize, rows.length);
  return Object.freeze(rows.slice(0, size));
}

export function sampleTransformationInputData(
  data: TransformationInputData,
  sampleSize?: number,
): TransformationInputData {
  if (data.kind === "records") {
    return createCanonicalRecordsShape({
      records: sampleRecords(data.records, sampleSize),
      metadata: data.metadata,
    });
  }

  return createCanonicalTableShape({
    columns: data.columns,
    rows: sampleRows(data.rows, sampleSize),
    metadata: data.metadata,
  });
}
