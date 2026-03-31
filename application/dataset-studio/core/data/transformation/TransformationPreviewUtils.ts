import type {
  CanonicalRecordValue,
  CanonicalTableColumn,
  CanonicalTableRow,
} from "../../../../../domain/dataset-studio/CanonicalDataShapes";

export interface TransformationPreviewFieldDelta {
  readonly fieldName: string;
  readonly before: CanonicalRecordValue | undefined;
  readonly after: CanonicalRecordValue | undefined;
  readonly changed: boolean;
  readonly note?: string;
}

export interface TransformationPreviewRowDelta {
  readonly rowId: string;
  readonly before: Readonly<Record<string, CanonicalRecordValue>>;
  readonly after: Readonly<Record<string, CanonicalRecordValue>>;
  readonly dropped?: boolean;
  readonly fieldDeltas: ReadonlyArray<TransformationPreviewFieldDelta>;
}

function inferColumnValueType(value: CanonicalRecordValue | undefined): CanonicalTableColumn["valueType"] {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

export function buildPreviewRowDeltas(input: {
  readonly beforeRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly afterRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly rowIds: ReadonlyArray<string>;
  readonly afterRowIds?: ReadonlyArray<string>;
  readonly targetFields: ReadonlyArray<string>;
  readonly notesByField?: Readonly<Record<string, string>>;
  readonly droppedRowIds?: ReadonlySet<string>;
  readonly sampleSize: number;
}): ReadonlyArray<TransformationPreviewRowDelta> {
  const afterById = new Map<string, Readonly<Record<string, CanonicalRecordValue>>>();
  for (let index = 0; index < input.afterRows.length; index += 1) {
    const rowId = input.afterRowIds?.[index] ?? input.rowIds[index];
    const row = input.afterRows[index];
    if (!rowId || !row) {
      continue;
    }
    afterById.set(rowId, row);
  }

  const deltas: TransformationPreviewRowDelta[] = [];
  for (let index = 0; index < input.beforeRows.length; index += 1) {
    if (deltas.length >= input.sampleSize) {
      break;
    }

    const rowId = input.rowIds[index];
    const before = input.beforeRows[index];
    if (!rowId || !before) {
      continue;
    }

    const after = afterById.get(rowId) ?? Object.freeze({}) as Readonly<Record<string, CanonicalRecordValue>>;
    const dropped = input.droppedRowIds?.has(rowId) ?? false;
    const fieldDeltas = input.targetFields.map((fieldName) => {
      const beforeValue = before[fieldName];
      const afterValue = dropped ? undefined : after[fieldName];
      return Object.freeze({
        fieldName,
        before: beforeValue,
        after: afterValue,
        changed: JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null),
        note: input.notesByField?.[fieldName],
      } satisfies TransformationPreviewFieldDelta);
    });

    deltas.push(Object.freeze({
      rowId,
      before,
      after,
      dropped,
      fieldDeltas: Object.freeze(fieldDeltas),
    } satisfies TransformationPreviewRowDelta));
  }

  return Object.freeze(deltas);
}

export function rebuildTableColumnsFromRows(
  existingColumns: ReadonlyArray<CanonicalTableColumn>,
  rows: ReadonlyArray<CanonicalTableRow>,
): ReadonlyArray<CanonicalTableColumn> {
  const orderedColumnIds = [
    ...existingColumns.map((column) => column.columnId),
    ...rows.flatMap((row) => Object.keys(row.cells)),
  ].filter((columnId, index, source) => source.indexOf(columnId) === index);

  return Object.freeze(orderedColumnIds.map((columnId) => {
    const existing = existingColumns.find((column) => column.columnId === columnId);
    const value = rows.find((row) => columnId in row.cells)?.cells[columnId];
    return Object.freeze({
      columnId,
      label: existing?.label ?? columnId,
      valueType: value === undefined ? existing?.valueType ?? "unknown" : inferColumnValueType(value),
    } satisfies CanonicalTableColumn);
  }));
}
