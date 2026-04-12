import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowCompletenessIssueCodes,
  ImageWorkflowLifecycleStates,
  ImageWorkflowOperationKinds,
  ImageWorkflowOutputTargetTypes,
  bumpImageWorkflowVersion,
  createImageWorkflowDefinition,
  evaluateImageWorkflowDefinitionCompleteness,
  isImageWorkflowLifecycleTransitionAllowed,
  rehydrateImageWorkflowDefinition,
  setImageWorkflowActivationStatus,
  transitionImageWorkflowLifecycle,
} from "../ImageWorkflowDomain";

function createValidWorkflow() {
  return createImageWorkflowDefinition({
    workflowId: "wf:image:1",
    operationKind: ImageWorkflowOperationKinds.imageToImage,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-1",
      visibility: "private",
    },
    display: {
      title: "Image-to-image editor",
      summary: "Primary image editing workflow",
      tags: ["image", "editing", "image"],
    },
    version: {
      lineageId: "lineage:image-workflows",
      versionTag: "1.0.0",
      revision: 0,
    },
    inputSlots: [{
      inputId: "sourceImage",
      label: "Source image",
      kind: "source-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
      acceptedAssetKinds: ["image-asset"],
    }],
    inputBindings: [{
      bindingId: "bind.input.sourceImage",
      inputId: "sourceImage",
      sourceKind: "selected-image",
      sourceKey: "selection.primary",
      required: true,
    }],
    parameterSpecifications: [{
      parameterId: "variationStrength",
      label: "Variation strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      defaultValue: 0.5,
      sensitivity: "normal",
      validation: {
        minimum: 0,
        maximum: 1,
        step: 0.05,
      },
      ui: {
        control: "slider",
        unitLabel: "%",
      },
    }],
    outputExpectations: [{
      outputId: "images",
      label: "Generated images",
      kind: "generated-image-collection",
      valueType: "image-asset-reference-list",
      required: true,
      allowsMultiple: true,
    }],
    outputBindings: [{
      bindingId: "bind.output.images",
      outputId: "images",
      targetType: ImageWorkflowOutputTargetTypes.outputDataset,
      requiredTargetId: true,
      defaultTargetId: "dataset:output",
    }],
    backendTranslation: {
      translatorId: "image-workflow-execution-adapter",
      contractVersion: "1.0.0",
      templateId: "template:image-to-image",
      inputBindings: [{
        inputId: "sourceImage",
        backendField: "inputs.source_image",
      }],
      parameterBindings: [{
        parameterId: "variationStrength",
        backendField: "params.variation_strength",
      }],
      outputBindings: [{
        outputId: "images",
        backendField: "outputs.images",
      }],
    },
    createdBy: "user-1",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
}

describe("ImageWorkflowDomain", () => {
  it("creates typed, workspace-scoped image workflow definitions", () => {
    const workflow = createValidWorkflow();

    expect(workflow.workflowType).toBe("image-workflow");
    expect(workflow.category).toBe("image-manipulation");
    expect(workflow.operationKind).toBe("image-to-image");
    expect(workflow.ownership.workspaceId).toBe("workspace-alpha");
    expect(workflow.lifecycleState).toBe("draft");
    expect(workflow.activationStatus).toBe("inactive");
    expect(workflow.display.tags).toEqual(["image", "editing"]);
    expect(workflow.createdAt).toBe("2026-04-08T12:00:00.000Z");
  });

  it("rejects unsupported operation kinds and private ownership gaps", () => {
    expect(() => createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:invalid-kind",
      operationKind: "unsupported-op",
      createdBy: "user-1",
    })).toThrow("operationKind");

    expect(() => createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:no-owner",
      ownership: {
        workspaceId: "workspace-alpha",
        visibility: "private",
      },
      createdBy: "user-1",
    })).toThrow("require ownerUserId");
  });

  it("supports mask-guided-edit as a first-class operation kind", () => {
    const workflow = createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:mask-guided",
      operationKind: ImageWorkflowOperationKinds.maskGuidedEdit,
      inputSlots: [
        ...createValidWorkflow().inputSlots,
        {
          inputId: "maskImage",
          label: "Mask image",
          kind: "mask-image",
          valueType: "image-asset-reference",
          required: true,
          allowsMultiple: false,
          acceptedAssetKinds: ["image-asset"],
        },
      ],
      inputBindings: [
        ...createValidWorkflow().inputBindings,
        {
          bindingId: "bind.input.maskImage",
          inputId: "maskImage",
          sourceKind: "runtime-parameter",
          sourceKey: "maskImage",
          required: true,
        },
      ],
      createdBy: "user-1",
    });

    expect(workflow.operationKind).toBe("mask-guided-edit");
  });

  it("enforces parameter invariants and logical references", () => {
    expect(() => createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:bad-parameter-default",
      parameterSpecifications: [{
        parameterId: "mode",
        label: "Mode",
        valueKind: "select",
        semanticMeaning: "custom",
        required: true,
        defaultValue: "c",
        sensitivity: "normal",
        validation: {
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        },
        ui: {
          control: "select",
        },
      }],
      backendTranslation: {
        ...createValidWorkflow().backendTranslation,
        parameterBindings: [{ parameterId: "mode", backendField: "params.mode" }],
      },
      createdBy: "user-1",
    })).toThrow("defaultValue");

    expect(() => createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:path-ref",
      inputBindings: [{
        bindingId: "bind.input.sourceImage",
        inputId: "sourceImage",
        sourceKind: "selected-image",
        sourceKey: "C:\\temp\\file.png",
        required: true,
      }],
      createdBy: "user-1",
    })).toThrow("filesystem path");
  });

  it("supports typed form parameters for boolean/select/reference and visibility hints", () => {
    const workflow = createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:typed-parameters",
      parameterSpecifications: [
        {
          parameterId: "preserveIdentity",
          label: "Preserve identity",
          valueKind: "boolean",
          semanticMeaning: "custom",
          required: false,
          defaultValue: true,
          sensitivity: "normal",
          validation: {},
          ui: {
            control: "switch",
          },
        },
        {
          parameterId: "qualityPreset",
          label: "Quality preset",
          valueKind: "select",
          semanticMeaning: "custom",
          required: true,
          defaultValue: "balanced",
          sensitivity: "normal",
          validation: {
            options: [
              { value: "fast", label: "Fast" },
              { value: "balanced", label: "Balanced" },
              { value: "quality", label: "Quality" },
            ],
          },
          ui: {
            control: "select",
          },
        },
        {
          parameterId: "styleReference",
          label: "Style reference",
          valueKind: "reference-asset-reference",
          semanticMeaning: "style-reference",
          required: false,
          sensitivity: "sensitive",
          validation: {
            acceptedAssetKinds: ["image-asset"],
          },
          visibility: {
            mode: "all",
            rules: [{ parameterId: "qualityPreset", operator: "equals", value: "quality" }],
          },
          ui: {
            control: "reference-slot",
          },
        },
      ],
      backendTranslation: {
        ...createValidWorkflow().backendTranslation,
        parameterBindings: [
          { parameterId: "preserveIdentity", backendField: "params.preserve_identity" },
          { parameterId: "qualityPreset", backendField: "params.quality_preset" },
          { parameterId: "styleReference", backendField: "params.style_reference" },
        ],
      },
      createdBy: "user-1",
    });

    expect(workflow.parameterSpecifications).toHaveLength(3);
    expect(workflow.parameterSpecifications[2]?.ui.control).toBe("reference-slot");
  });

  it("enforces lifecycle transitions and publication completeness", () => {
    const workflow = createValidWorkflow();

    expect(isImageWorkflowLifecycleTransitionAllowed("draft", "review")).toBeTrue();
    expect(isImageWorkflowLifecycleTransitionAllowed("draft", "published")).toBeFalse();

    const review = transitionImageWorkflowLifecycle(workflow, {
      targetState: ImageWorkflowLifecycleStates.review,
      actorUserId: "user-2",
      now: new Date("2026-04-08T12:05:00.000Z"),
    });
    expect(review.lifecycleState).toBe("review");

    const published = transitionImageWorkflowLifecycle(review, {
      targetState: ImageWorkflowLifecycleStates.published,
      actorUserId: "user-2",
      now: new Date("2026-04-08T12:06:00.000Z"),
    });
    expect(published.lifecycleState).toBe("published");

    expect(() => transitionImageWorkflowLifecycle(workflow, {
      targetState: ImageWorkflowLifecycleStates.published,
      actorUserId: "user-2",
    })).toThrow("cannot transition");

    const incomplete = createImageWorkflowDefinition({
      ...createValidWorkflow(),
      workflowId: "wf:image:incomplete",
      inputBindings: [],
      createdBy: "user-1",
    });

    expect(() => transitionImageWorkflowLifecycle(incomplete, {
      targetState: ImageWorkflowLifecycleStates.review,
      actorUserId: "user-2",
    })).not.toThrow();

    expect(() => transitionImageWorkflowLifecycle(
      transitionImageWorkflowLifecycle(incomplete, {
        targetState: ImageWorkflowLifecycleStates.review,
        actorUserId: "user-2",
      }),
      {
        targetState: ImageWorkflowLifecycleStates.published,
        actorUserId: "user-2",
      },
    )).toThrow("not complete");
  });

  it("enforces activation and retirement invariants", () => {
    const draft = createValidWorkflow();
    expect(() => setImageWorkflowActivationStatus(draft, {
      activationStatus: ImageWorkflowActivationStatuses.active,
      actorUserId: "user-2",
    })).toThrow("Only published image workflows");

    const published = transitionImageWorkflowLifecycle(
      transitionImageWorkflowLifecycle(draft, { targetState: "review", actorUserId: "user-2" }),
      { targetState: "published", actorUserId: "user-2" },
    );
    const active = setImageWorkflowActivationStatus(published, {
      activationStatus: "active",
      actorUserId: "user-2",
    });
    expect(active.activationStatus).toBe("active");

    const retired = transitionImageWorkflowLifecycle(active, {
      targetState: "retired",
      actorUserId: "user-2",
    });
    expect(retired.activationStatus).toBe("inactive");
  });

  it("evaluates completeness and supports version-aware evolution", () => {
    const complete = createValidWorkflow();
    expect(evaluateImageWorkflowDefinitionCompleteness(complete)).toEqual([]);

    const incomplete = createImageWorkflowDefinition({
      ...complete,
      workflowId: "wf:image:missing-backend-binding",
      backendTranslation: {
        ...complete.backendTranslation,
        outputBindings: [],
      },
      createdBy: "user-1",
    });
    const issues = evaluateImageWorkflowDefinitionCompleteness(incomplete);
    expect(issues.some((issue) => issue.code === ImageWorkflowCompletenessIssueCodes.backendOutputBindingMissing)).toBeTrue();

    const v2 = bumpImageWorkflowVersion(complete, {
      nextWorkflowId: "wf:image:2",
      versionTag: "1.1.0",
      actorUserId: "user-2",
      now: new Date("2026-04-08T13:00:00.000Z"),
    });

    expect(v2.version.lineageId).toBe(complete.version.lineageId);
    expect(v2.version.supersedesWorkflowId).toBe(complete.workflowId);
    expect(v2.version.revision).toBe(complete.version.revision + 1);
    expect(v2.lifecycleState).toBe("draft");

    expect(rehydrateImageWorkflowDefinition(v2)).toEqual(v2);
  });
});
