import { describe, expect, it } from "bun:test";
import {
  DataLineageDiagnosticSeverities,
  DataLineageReferenceKinds,
  DataLineageStepKinds,
  DataLineageStepStatuses,
  createDataLineageDiagnosticNote,
  createDataLineageExecutionStep,
  createDataLineageMetadata,
  createDataLineageReference,
} from "../DataLineageMetadata";

describe("DataLineageMetadata", () => {
  it("creates normalized lineage metadata with deduped references and steps", () => {
    const inputRef = createDataLineageReference({
      referenceId: " input-1 ",
      kind: DataLineageReferenceKinds.sourceReference,
      label: " customers.csv ",
      assetId: " source-asset ",
      versionId: " v1 ",
    });
    const outputRef = createDataLineageReference({
      referenceId: "output-1",
      kind: DataLineageReferenceKinds.canonicalShape,
      shapeKind: "records",
    });

    const lineage = createDataLineageMetadata({
      capturedAt: "2026-03-31T12:00:00.000Z",
      producer: {
        assetId: "dataset-asset-1",
        versionId: "v2",
        name: "Customer Dataset",
      },
      execution: {
        executionId: "exec-1",
        requestId: "req-1",
        startedAt: "2026-03-31T12:00:00.000Z",
        completedAt: "2026-03-31T12:00:01.000Z",
      },
      inputs: [inputRef, inputRef],
      steps: [
        createDataLineageExecutionStep({
          stepId: "step-1",
          kind: DataLineageStepKinds.convert,
          status: DataLineageStepStatuses.completed,
          startedAt: "2026-03-31T12:00:00.000Z",
          completedAt: "2026-03-31T12:00:01.000Z",
          inputReferenceIds: [inputRef.referenceId],
          outputReferenceIds: [outputRef.referenceId],
        }),
        createDataLineageExecutionStep({
          stepId: "step-1",
          kind: DataLineageStepKinds.convert,
          status: DataLineageStepStatuses.completed,
          startedAt: "2026-03-31T12:00:00.000Z",
          completedAt: "2026-03-31T12:00:01.000Z",
        }),
      ],
      outputs: [outputRef],
      diagnostics: [
        createDataLineageDiagnosticNote({
          code: "converter_notice",
          severity: DataLineageDiagnosticSeverities.info,
          message: "Converted with inferred schema.",
        }),
      ],
      notes: ["  sample note  "],
    });

    expect(lineage.schemaVersion).toBe("1.0.0");
    expect(lineage.inputs).toHaveLength(1);
    expect(lineage.steps).toHaveLength(1);
    expect(lineage.inputs[0]?.referenceId).toBe("input-1");
    expect(lineage.inputs[0]?.label).toBe("customers.csv");
    expect(lineage.notes).toEqual(["sample note"]);
  });

  it("rejects empty required identifiers", () => {
    expect(() =>
      createDataLineageDiagnosticNote({
        code: "",
        severity: DataLineageDiagnosticSeverities.error,
        message: "oops",
      }),
    ).toThrow("cannot be empty");

    expect(() =>
      createDataLineageReference({
        referenceId: " ",
        kind: DataLineageReferenceKinds.asset,
      }),
    ).toThrow("cannot be empty");
  });
});
