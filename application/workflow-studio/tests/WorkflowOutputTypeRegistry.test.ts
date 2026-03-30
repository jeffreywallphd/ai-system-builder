import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  createEmptyWorkflowDraft,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  WorkflowOutputTypeRegistry,
  WorkflowOutputRegistryFieldTargets,
  createDefaultWorkflowOutputTypeRegistry,
} from "../WorkflowOutputTypeRegistry";

describe("WorkflowOutputTypeRegistry", () => {
  it("enumerates canonical output types with stable metadata contracts", () => {
    const registry = createDefaultWorkflowOutputTypeRegistry();
    const entries = registry.list();

    expect(entries.map((entry) => entry.destinationType)).toEqual([
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
      WorkflowDraftOutputDestinationTypes.systemEntry,
    ]);
    expect(entries.every((entry) => entry.label.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.description.trim().length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.configSchemaId.startsWith("workflow.output.destination."))).toBeTrue();
    expect(entries.every((entry) => entry.supportedFormats.length > 0)).toBeTrue();
    expect(entries.every((entry) => entry.configurationFields.length > 0)).toBeTrue();
    expect(entries.some((entry) => entry.capabilities.supportsConversationalOutput)).toBeFalse();
  });

  it("supports lookup and unknown-type handling", () => {
    const registry = createDefaultWorkflowOutputTypeRegistry();

    expect(registry.isSupported(WorkflowDraftOutputDestinationTypes.webViewer)).toBeTrue();
    expect(registry.isSupported("future-output")).toBeFalse();
    expect(registry.get("future-output")).toBeUndefined();
    expect(registry.get(WorkflowDraftOutputDestinationTypes.fileExport)?.configurationFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "format",
          target: WorkflowOutputRegistryFieldTargets.format,
        }),
      ]),
    );
  });

  it("evaluates add constraints and rejects unsupported add requests", () => {
    const registry = createDefaultWorkflowOutputTypeRegistry();
    const draft = createEmptyWorkflowDraft();

    const unsupported = registry.evaluateAddConstraint(draft, "future-output");
    expect(unsupported.allowed).toBeFalse();
    expect(unsupported.reasonCode).toBe("unsupported-type");

    const supported = registry.evaluateAddConstraint(draft, WorkflowDraftOutputDestinationTypes.fileExport);
    expect(supported.allowed).toBeTrue();
  });

  it("rejects duplicate output type registrations", () => {
    expect(() => new WorkflowOutputTypeRegistry([
      {
        destinationType: WorkflowDraftOutputDestinationTypes.fileExport,
        outputType: WorkflowDraftOutputTypes.document,
        label: "File export",
        description: "File export",
        configSchemaId: "workflow.output.destination.file-export.v1",
        supportedFormats: [WorkflowDraftOutputFormats.json],
        defaultFormat: WorkflowDraftOutputFormats.json,
        defaultTarget: "files",
      },
      {
        destinationType: WorkflowDraftOutputDestinationTypes.fileExport,
        outputType: WorkflowDraftOutputTypes.document,
        label: "File export duplicate",
        description: "File export duplicate",
        configSchemaId: "workflow.output.destination.file-export.v1",
        supportedFormats: [WorkflowDraftOutputFormats.json],
        defaultFormat: WorkflowDraftOutputFormats.json,
        defaultTarget: "files",
      },
    ])).toThrow("already registered");
  });
});
