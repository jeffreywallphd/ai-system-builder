import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowLifecycleStates,
  createImageWorkflowDefinition,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  createImageSystemDefinition,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import type {
  IImageSystemDefinitionValidationService,
  IImageWorkflowDefinitionValidationService,
  IImageWorkflowSystemCompatibilityService,
  ImageDefinitionValidationResult,
} from "../ports";
import { ImageWorkflowSystemReadinessValidationService } from "../ImageWorkflowSystemReadinessValidationService";

class StaticWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  public constructor(private readonly result: ImageDefinitionValidationResult) {}

  async validateWorkflowDefinition(
    _input: Parameters<IImageWorkflowDefinitionValidationService["validateWorkflowDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return this.result;
  }
}

class StaticSystemValidationService implements IImageSystemDefinitionValidationService {
  public constructor(private readonly result: ImageDefinitionValidationResult) {}

  async validateSystemDefinition(
    _input: Parameters<IImageSystemDefinitionValidationService["validateSystemDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return this.result;
  }
}

class StaticCompatibilityService implements IImageWorkflowSystemCompatibilityService {
  public constructor(
    private readonly outcome: "compatible" | "warnings" | "incompatible",
  ) {}

  async evaluateSystemWorkflowCompatibility(
    _input: Parameters<IImageWorkflowSystemCompatibilityService["evaluateSystemWorkflowCompatibility"]>[0],
  ) {
    return {
      outcome: this.outcome,
      issues: this.outcome === "incompatible"
        ? [{
          code: "workflow-contract-incompatible",
          path: "workflowBinding",
          message: "Workflow/system contract mismatch.",
          severity: "error" as const,
        }]
        : [],
    };
  }
}

function createWorkflow(overrides?: Partial<ImageWorkflowDefinition>): ImageWorkflowDefinition {
  const workflow = createImageWorkflowDefinition({
    workflowId: "workflow-alpha-v1",
    operationKind: "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
    },
    display: {
      title: "Workflow alpha",
      tags: ["image"],
    },
    version: {
      lineageId: "lineage-alpha",
      versionTag: "1.0.0",
      revision: 1,
    },
    lifecycleState: ImageWorkflowLifecycleStates.draft,
    inputSlots: [{
      inputId: "source-image",
      label: "Source image",
      kind: "source-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
      acceptedAssetKinds: ["image-asset"],
    }],
    inputBindings: [{
      bindingId: "bind-input-source",
      inputId: "source-image",
      sourceKind: "selected-image",
      sourceKey: "asset.primary",
      required: true,
    }],
    parameterSpecifications: [{
      parameterId: "strength",
      label: "Strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      validation: {
        minimum: 0,
        maximum: 1,
      },
    }],
    outputExpectations: [{
      outputId: "generated-image",
      label: "Generated image",
      kind: "generated-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
    }],
    outputBindings: [{
      bindingId: "bind-output-image",
      outputId: "generated-image",
      targetType: "output-dataset",
      requiredTargetId: false,
    }],
    backendTranslation: {
      translatorId: "translator:image",
      contractVersion: "1.0.0",
      templateId: "template:image",
      inputBindings: [{ inputId: "source-image", backendField: "inputs.source" }],
      parameterBindings: [{ parameterId: "strength", backendField: "inputs.strength" }],
      outputBindings: [{ outputId: "generated-image", backendField: "outputs.image" }],
    },
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });

  return {
    ...workflow,
    ...overrides,
  };
}

function createSystem(workflow: ImageWorkflowDefinition, overrides?: Partial<ImageSystemDefinition>): ImageSystemDefinition {
  const system = createImageSystemDefinition({
    systemId: "system-alpha",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
    },
    display: {
      title: "System alpha",
      tags: ["system"],
    },
    workflowBinding: {
      workflowId: workflow.workflowId,
      workflowWorkspaceId: workflow.ownership.workspaceId,
      workflowLineageId: workflow.version.lineageId,
      workflowVersionTag: workflow.version.versionTag,
      workflowRevision: workflow.version.revision,
      requiredInputIds: ["source-image"],
      requiredParameterIds: ["strength"],
      requiredOutputIds: ["generated-image"],
    },
    inputAssetSelections: [{
      inputId: "source-image",
      assetReference: "asset://source-image",
    }],
    outputTargetBindings: [{
      outputId: "generated-image",
      targetReference: "dataset-instance://output",
    }],
    parameterBaseline: {
      values: {
        strength: 0.4,
      },
      profileReferences: [],
    },
    lifecycleState: ImageSystemLifecycleStates.ready,
    runtimeStatus: ImageSystemRuntimeStatuses.enabled,
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });

  return {
    ...system,
    ...overrides,
  };
}

describe("ImageWorkflowSystemReadinessValidationService", () => {
  it("evaluates workflow readiness for complete draft definitions", () => {
    const service = new ImageWorkflowSystemReadinessValidationService();
    const workflow = createWorkflow();

    const result = service.evaluateWorkflowReadiness(workflow, "2026-04-08T12:00:00.000Z");

    expect(result.readiness.ready).toBeTrue();
    expect(result.readiness.classification).toBe("draft");
    expect(result.readiness.completenessIssues).toEqual([]);
    expect(result.structure.backendTranslation.parameterBindings).toBe(1);
  });

  it("returns blocking workflow authoring assessment for incomplete/invalid definitions", async () => {
    const service = new ImageWorkflowSystemReadinessValidationService();
    const workflow = createWorkflow({
      outputBindings: [],
    });

    const assessment = await service.evaluateWorkflowAuthoring({
      workspaceId: "workspace-alpha",
      workflow,
      validationService: new StaticWorkflowValidationService({
        valid: false,
        evaluatedAt: "2026-04-08T12:00:00.000Z",
        issues: [{
          code: "workflow-schema-invalid",
          path: "outputBindings",
          message: "Output binding schema is invalid.",
          severity: "error",
        }],
      }),
    });

    expect(assessment.blocking).toBeTrue();
    expect(assessment.classification).toBe("incomplete");
    expect(assessment.issues.some((issue) => issue.code === "required-output-binding-missing")).toBeTrue();
    expect(assessment.issues.some((issue) => issue.code === "workflow-schema-invalid")).toBeTrue();
  });

  it("evaluates non-blocking partial system readiness in draft mode", async () => {
    const service = new ImageWorkflowSystemReadinessValidationService();
    const workflow = createWorkflow();
    const system = createSystem(workflow, {
      lifecycleState: ImageSystemLifecycleStates.draft,
      runtimeStatus: ImageSystemRuntimeStatuses.disabled,
      outputTargetBindings: [],
    });

    const assessment = await service.evaluateSystemAuthoring({
      workspaceId: "workspace-alpha",
      workflow,
      system,
      validationService: new StaticSystemValidationService({
        valid: true,
        evaluatedAt: "2026-04-08T12:00:00.000Z",
        issues: [],
      }),
      compatibilityService: new StaticCompatibilityService("compatible"),
    });

    expect(assessment.blocking).toBeFalse();
    expect(assessment.ready).toBeFalse();
    expect(assessment.runnable).toBeFalse();
    expect(assessment.classification).toBe("incomplete");
    expect(assessment.issues.some((issue) => issue.code === "required-output-binding-missing")).toBeTrue();
  });

  it("returns blocking system authoring assessment for compatibility/binding failures", async () => {
    const service = new ImageWorkflowSystemReadinessValidationService();
    const workflow = createWorkflow();
    const system = createSystem(workflow, {
      workflowBinding: {
        ...createSystem(workflow).workflowBinding,
        requiredParameterIds: ["unknown-parameter"],
      },
    });

    const assessment = await service.evaluateSystemAuthoring({
      workspaceId: "workspace-alpha",
      workflow,
      system,
      validationService: new StaticSystemValidationService({
        valid: true,
        evaluatedAt: "2026-04-08T12:00:00.000Z",
        issues: [],
      }),
      compatibilityService: new StaticCompatibilityService("incompatible"),
    });

    expect(assessment.blocking).toBeTrue();
    expect(assessment.issues.some((issue) => issue.code === "required-parameter-not-declared-by-workflow")).toBeTrue();
    expect(assessment.issues.some((issue) => issue.code === "workflow-contract-incompatible")).toBeTrue();
  });
});
