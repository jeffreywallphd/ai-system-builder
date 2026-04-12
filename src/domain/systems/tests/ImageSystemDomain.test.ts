import { describe, expect, it } from "bun:test";
import {
  ImageSystemLifecycleStates,
  ImageSystemReadinessIssueCodes,
  ImageSystemRuntimeStatuses,
  createImageSystemDefinition,
  evaluateImageSystemReadiness,
  isImageSystemLifecycleTransitionAllowed,
  isImageSystemRunnable,
  rebindImageSystemWorkflow,
  rehydrateImageSystemDefinition,
  setImageSystemRuntimeStatus,
  transitionImageSystemLifecycle,
} from "../ImageSystemDomain";

function createValidSystem() {
  return createImageSystemDefinition({
    systemId: "img-system:reference-1",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-1",
      visibility: "private",
    },
    display: {
      title: "Reference Image Editor",
      summary: "Reusable image manipulation system",
      tags: ["image", "reference", "image"],
    },
    workflowBinding: {
      workflowId: "wf:image:1",
      workflowWorkspaceId: "workspace-alpha",
      workflowLineageId: "lineage:image-wf",
      workflowVersionTag: "1.0.0",
      workflowRevision: 0,
      requiredInputIds: ["sourceImage"],
      requiredParameterIds: ["variationStrength"],
      requiredOutputIds: ["images"],
    },
    inputAssetSelections: [{
      inputId: "sourceImage",
      assetReference: "asset:image:source-1",
    }],
    outputTargetBindings: [{
      outputId: "images",
      targetReference: "dataset-instance://workspace-alpha/generated",
    }],
    parameterBaseline: {
      values: {
        variationStrength: 0.5,
      },
      profileReferences: [],
    },
    createdBy: "user-1",
    now: new Date("2026-04-08T15:00:00.000Z"),
  });
}

describe("ImageSystemDomain", () => {
  it("creates a durable, workspace-scoped image system with workflow binding", () => {
    const system = createValidSystem();

    expect(system.systemType).toBe("image-manipulation-system");
    expect(system.ownership.workspaceId).toBe("workspace-alpha");
    expect(system.lifecycleState).toBe("draft");
    expect(system.runtimeStatus).toBe("disabled");
    expect(system.display.tags).toEqual(["image", "reference"]);
    expect(system.createdAt).toBe("2026-04-08T15:00:00.000Z");
  });

  it("rejects invalid workflow binding scope, semver, and filesystem references", () => {
    expect(() => createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:invalid-scope",
      workflowBinding: {
        ...createValidSystem().workflowBinding,
        workflowWorkspaceId: "workspace-beta",
      },
      createdBy: "user-1",
    })).toThrow("workspace must match system workspace");

    expect(() => createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:invalid-semver",
      workflowBinding: {
        ...createValidSystem().workflowBinding,
        workflowVersionTag: "v1",
      },
      createdBy: "user-1",
    })).toThrow("semantic version");

    expect(() => createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:path-ref",
      inputAssetSelections: [{
        inputId: "sourceImage",
        assetReference: "C:\\temp\\image.png",
      }],
      createdBy: "user-1",
    })).toThrow("filesystem path");
  });

  it("evaluates readiness issues for missing inputs, outputs, and unresolved required parameters", () => {
    const incomplete = createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:incomplete",
      inputAssetSelections: [],
      outputTargetBindings: [],
      parameterBaseline: {
        values: {},
        profileReferences: [],
      },
      createdBy: "user-1",
    });

    const issueCodes = evaluateImageSystemReadiness(incomplete).map((issue) => issue.code);
    expect(issueCodes).toContain(ImageSystemReadinessIssueCodes.requiredInputSelectionMissing);
    expect(issueCodes).toContain(ImageSystemReadinessIssueCodes.requiredOutputBindingMissing);
    expect(issueCodes).toContain(ImageSystemReadinessIssueCodes.requiredParametersUnresolved);
  });

  it("allows readiness via parameter profile references when direct parameter values are not present", () => {
    const profileBacked = createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:profile-backed",
      parameterBaseline: {
        values: {},
        profileReferences: ["parameter-profile:default-image"],
      },
      createdBy: "user-1",
    });

    const issueCodes = evaluateImageSystemReadiness(profileBacked).map((issue) => issue.code);
    expect(issueCodes).not.toContain(ImageSystemReadinessIssueCodes.requiredParametersUnresolved);
  });

  it("enforces lifecycle transitions, ready-state validation, and runnable gating", () => {
    const draft = createValidSystem();

    expect(isImageSystemLifecycleTransitionAllowed("draft", "ready")).toBeTrue();
    expect(isImageSystemLifecycleTransitionAllowed("archived", "ready")).toBeFalse();

    const ready = transitionImageSystemLifecycle(draft, {
      targetState: ImageSystemLifecycleStates.ready,
      actorUserId: "user-2",
      now: new Date("2026-04-08T15:05:00.000Z"),
    });

    expect(ready.lifecycleState).toBe("ready");
    expect(isImageSystemRunnable(ready)).toBeFalse();

    const enabled = setImageSystemRuntimeStatus(ready, {
      runtimeStatus: ImageSystemRuntimeStatuses.enabled,
      actorUserId: "user-2",
      now: new Date("2026-04-08T15:06:00.000Z"),
    });

    expect(isImageSystemRunnable(enabled)).toBeTrue();

    const archived = transitionImageSystemLifecycle(enabled, {
      targetState: ImageSystemLifecycleStates.archived,
      actorUserId: "user-2",
      now: new Date("2026-04-08T15:07:00.000Z"),
    });

    expect(archived.runtimeStatus).toBe("disabled");
    expect(isImageSystemRunnable(archived)).toBeFalse();

    const incomplete = createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:not-ready",
      inputAssetSelections: [],
      createdBy: "user-1",
    });

    expect(() => transitionImageSystemLifecycle(incomplete, {
      targetState: ImageSystemLifecycleStates.ready,
      actorUserId: "user-2",
    })).toThrow("not runnable");
  });

  it("resets runtime posture to draft-disabled when rebinding to a new workflow version", () => {
    const readyEnabled = setImageSystemRuntimeStatus(
      transitionImageSystemLifecycle(createValidSystem(), {
        targetState: ImageSystemLifecycleStates.ready,
        actorUserId: "user-2",
      }),
      {
        runtimeStatus: ImageSystemRuntimeStatuses.enabled,
        actorUserId: "user-2",
      },
    );

    const rebound = rebindImageSystemWorkflow(readyEnabled, {
      workflowBinding: {
        ...readyEnabled.workflowBinding,
        workflowId: "wf:image:2",
        workflowVersionTag: "1.1.0",
        workflowRevision: 1,
      },
      actorUserId: "user-3",
      now: new Date("2026-04-08T15:30:00.000Z"),
    });

    expect(rebound.lifecycleState).toBe("draft");
    expect(rebound.runtimeStatus).toBe("disabled");
    expect(rebound.workflowBinding.workflowId).toBe("wf:image:2");
  });

  it("supports lineage metadata for future run/output continuity and rehydration", () => {
    const withLineage = createImageSystemDefinition({
      ...createValidSystem(),
      systemId: "img-system:lineage",
      lineage: {
        latestRunId: "run:123",
        latestRunOccurredAt: "2026-04-08T16:00:00.000Z",
        latestOutputAssetIds: ["asset:image:out-1", "asset:image:out-1", "asset:image:out-2"],
      },
      createdBy: "user-1",
    });

    expect(withLineage.lineage.latestRunId).toBe("run:123");
    expect(withLineage.lineage.latestOutputAssetIds).toEqual(["asset:image:out-1", "asset:image:out-2"]);
    expect(rehydrateImageSystemDefinition(withLineage)).toEqual(withLineage);
  });
});
