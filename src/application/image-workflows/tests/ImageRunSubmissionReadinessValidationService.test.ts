import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "@application/assets/ports/IAssetRepository";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { GetImageManipulationExecutionReadinessUseCase } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import {
  ImageManipulationExecutionReadinessStates,
} from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import { InitialImageWorkflowTemplateFamilyIds } from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";
import { AssetLifecycleStates, type Asset } from "@domain/assets/AssetDomain";
import {
  createImageWorkflowDefinition,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  createImageSystemDefinition,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import { ImageRunSubmissionReadinessValidationService } from "../ImageRunSubmissionReadinessValidationService";
import type {
  IImageSystemDefinitionRepository,
  IImageWorkflowDefinitionRepository,
} from "../ports";

class InMemoryWorkflowRepository implements Pick<IImageWorkflowDefinitionRepository, "findWorkflowDefinitionById"> {
  public constructor(private readonly workflow?: ImageWorkflowDefinition) {}

  public async findWorkflowDefinitionById(
    workflowId: string,
    query: { readonly workspaceId: string },
  ): Promise<ImageWorkflowDefinition | undefined> {
    if (!this.workflow) {
      return undefined;
    }
    if (this.workflow.workflowId !== workflowId || this.workflow.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    return this.workflow;
  }
}

class InMemorySystemRepository implements Pick<IImageSystemDefinitionRepository, "findSystemDefinitionById"> {
  public constructor(private readonly system?: ImageSystemDefinition) {}

  public async findSystemDefinitionById(
    systemId: string,
    query: { readonly workspaceId: string },
  ): Promise<ImageSystemDefinition | undefined> {
    if (!this.system) {
      return undefined;
    }
    if (this.system.systemId !== systemId || this.system.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    return this.system;
  }
}

class InMemoryAssetRepository implements Pick<IAssetRepository, "findAssetById"> {
  private readonly assets = new Map<string, Asset>();

  public constructor(assets: ReadonlyArray<Asset>) {
    for (const asset of assets) {
      this.assets.set(asset.id, asset);
    }
  }

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.assets.get(assetId);
  }
}

class StubAuthorizationDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public constructor(private readonly deniedAssetIds: ReadonlySet<string>) {}

  public async evaluateDecision(
    request: Parameters<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]>[0],
  ): ReturnType<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]> {
    const denied = request.target.kind === "resource-instance" && this.deniedAssetIds.has(request.target.resource.resourceId);
    return Object.freeze({
      decision: Object.freeze({
        isAllowed: !denied,
        outcome: denied ? "deny" : "allow",
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: denied ? "insufficient-permissions" : "allow",
        reason: denied ? "Actor lacks permission." : "Allowed.",
        denialReason: denied ? "insufficient-permissions" : undefined,
        evaluatedAt: request.asOf ?? "2026-04-08T15:00:00.000Z",
        matchedRoleAssignmentIds: Object.freeze([]),
        matchedPermissionGrantIds: Object.freeze([]),
        matchedSharingGrantIds: Object.freeze([]),
      }),
    });
  }
}

class StubExecutionReadinessUseCase implements Pick<GetImageManipulationExecutionReadinessUseCase, "execute"> {
  public constructor(
    private readonly readiness: {
      readonly readiness: "ready" | "degraded" | "unavailable";
      readonly readyForExecution: boolean;
      readonly issues: ReadonlyArray<{
        readonly code: string;
        readonly severity: "error" | "warning";
        readonly message: string;
      }>;
    },
  ) {}

  public async execute(): Promise<{
    readonly backendFamily: string;
    readonly checkedAt: string;
    readonly readiness: "ready" | "degraded" | "unavailable";
    readonly readyForExecution: boolean;
    readonly capabilities: {
      readonly backendFamily: string;
      readonly supportsProgressPolling: boolean;
      readonly supportsProgressStreaming: boolean;
      readonly supportsCancellation: boolean;
      readonly supportsOutputDiscovery: boolean;
      readonly supportedOperationKinds: ReadonlyArray<string>;
      readonly supportedTranslationContractVersions: ReadonlyArray<string>;
    };
    readonly nodeAvailability: {
      readonly state: "available" | "constrained" | "unavailable" | "unknown";
      readonly checkedAt: string;
      readonly candidateNodeCount: number;
      readonly eligibleNodeCount: number;
      readonly unavailableNodeCount: number;
      readonly incompatibleNodeCount: number;
      readonly topBlockingReasonCodes: ReadonlyArray<string>;
      readonly topTransientAvailabilityReasonCodes: ReadonlyArray<string>;
      readonly reasonCode?: string;
    };
    readonly issues: ReadonlyArray<{
      readonly code: string;
      readonly severity: "error" | "warning";
      readonly message: string;
    }>;
  }> {
    return Object.freeze({
      backendFamily: "adapter.comfyui.image-manipulation",
      checkedAt: "2026-04-08T15:00:00.000Z",
      readiness: this.readiness.readiness,
      readyForExecution: this.readiness.readyForExecution,
      capabilities: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        supportsProgressPolling: true,
        supportsProgressStreaming: true,
        supportsCancellation: true,
        supportsOutputDiscovery: true,
        supportedOperationKinds: Object.freeze(["image-to-image"]),
        supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
      }),
      nodeAvailability: Object.freeze({
        state: "available" as const,
        checkedAt: "2026-04-08T15:00:00.000Z",
        candidateNodeCount: 1,
        eligibleNodeCount: 1,
        unavailableNodeCount: 0,
        incompatibleNodeCount: 0,
        topBlockingReasonCodes: Object.freeze([]),
        topTransientAvailabilityReasonCodes: Object.freeze([]),
      }),
      issues: this.readiness.issues,
    });
  }
}

describe("ImageRunSubmissionReadinessValidationService", () => {
  it("returns ready state for valid queue-eligible run submissions", async () => {
    const workflow = createWorkflow();
    const system = createSystem(workflow);
    const asset = createAssetRecord("asset-source-1");
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      assetRepository: new InMemoryAssetRepository([asset]),
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(new Set()),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.ready,
        readyForExecution: true,
        issues: Object.freeze([]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      parameters: Object.freeze({
        strength: 0.7,
      }),
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
      inputAssetBindingIds: Object.freeze(["source-image"]),
      outputBindingIds: Object.freeze(["generated-image"]),
      referencedAssetIds: Object.freeze(["asset-source-1"]),
    });

    expect(result.state).toBe("ready");
    expect(result.readyForQueueing).toBeTrue();
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.advisoryIssues).toHaveLength(0);
  });

  it("returns blocked state for missing assets, unauthorized references, and unavailable backend", async () => {
    const workflow = createWorkflow();
    const system = createSystem(workflow);
    const asset = createAssetRecord("asset-forbidden-1");
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      assetRepository: new InMemoryAssetRepository([asset]),
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(new Set(["asset-forbidden-1"])),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.unavailable,
        readyForExecution: false,
        issues: Object.freeze([Object.freeze({
          code: "backend-unavailable",
          severity: "error",
          message: "Execution backend is unavailable.",
        })]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      parameters: Object.freeze({
        strength: 0.7,
      }),
      inputAssetBindingIds: Object.freeze([]),
      outputBindingIds: Object.freeze([]),
      referencedAssetIds: Object.freeze([
        "asset-missing-1",
        "asset-forbidden-1",
      ]),
    });

    expect(result.state).toBe("blocked");
    expect(result.readyForQueueing).toBeFalse();
    expect(result.blockingIssues.some((issue) => issue.code === "submission-required-input-binding-missing")).toBeTrue();
    expect(result.blockingIssues.some((issue) => issue.code === "submission-referenced-asset-not-found")).toBeTrue();
    expect(result.blockingIssues.some((issue) => issue.code === "submission-referenced-asset-not-authorized")).toBeTrue();
    expect(result.blockingIssues.some((issue) => issue.code === "backend-unavailable")).toBeTrue();
    expect(result.policyDenials.some((entry) => entry.code === "submission-referenced-asset-not-authorized")).toBeTrue();
  });

  it("returns advisory state for partially ready submissions with non-blocking backend degradation", async () => {
    const workflow = createWorkflow();
    const system = createSystem(workflow);
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.degraded,
        readyForExecution: true,
        issues: Object.freeze([Object.freeze({
          code: "backend-degraded",
          severity: "warning",
          message: "Execution backend is degraded.",
        })]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      parameters: Object.freeze({
        strength: 0.3,
      }),
      inputAssetBindingIds: Object.freeze(["source-image"]),
      outputBindingIds: Object.freeze(["generated-image"]),
      referencedAssetIds: Object.freeze([]),
    });

    expect(result.state).toBe("advisory");
    expect(result.readyForQueueing).toBeTrue();
    expect(result.blockingIssues).toHaveLength(0);
    expect(result.advisoryIssues.some((issue) => issue.code === "backend-degraded")).toBeTrue();
  });

  it("blocks stale workflow template version/template-id mismatches", async () => {
    const workflow = createWorkflow({
      backendTranslation: Object.freeze({
        ...createWorkflow().backendTranslation,
        templateVersion: "0.9.0",
        templateId: "image-template:legacy-stale:v0",
      }),
    });
    const system = createSystem(workflow);
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.ready,
        readyForExecution: true,
        issues: Object.freeze([]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      inputAssetBindingIds: Object.freeze(["source-image"]),
      outputBindingIds: Object.freeze(["generated-image"]),
    });

    expect(result.state).toBe("blocked");
    expect(result.blockingIssues.some((issue) => issue.code === "submission-workflow-template-id-mismatch")).toBeTrue();
    expect(result.blockingIssues.some((issue) => issue.code === "submission-workflow-template-version-mismatch")).toBeTrue();
  });

  it("validates asset references from persisted system input selections", async () => {
    const workflow = createWorkflow();
    const system = createSystem(workflow, {
      inputAssetSelections: [Object.freeze({
        inputId: "source-image",
        assetReference: "asset://asset-missing-from-system-selection",
      })],
    });
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      assetRepository: new InMemoryAssetRepository([]),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.ready,
        readyForExecution: true,
        issues: Object.freeze([]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      inputAssetBindingIds: Object.freeze(["source-image"]),
      outputBindingIds: Object.freeze(["generated-image"]),
    });

    expect(result.state).toBe("blocked");
    expect(result.blockingIssues.some((issue) => issue.code === "submission-referenced-asset-not-found")).toBeTrue();
  });

  it("normalizes readiness findings with taxonomy/recovery guidance", async () => {
    const workflow = createWorkflow();
    const system = createSystem(workflow);
    const service = new ImageRunSubmissionReadinessValidationService({
      workflowRepository: new InMemoryWorkflowRepository(workflow),
      systemRepository: new InMemorySystemRepository(system),
      executionReadinessUseCase: new StubExecutionReadinessUseCase({
        readiness: ImageManipulationExecutionReadinessStates.degraded,
        readyForExecution: true,
        issues: Object.freeze([Object.freeze({
          code: "backend-degraded",
          severity: "warning",
          message: "Execution backend is degraded.",
        })]),
      }),
      now: () => new Date("2026-04-08T15:00:00.000Z"),
    });

    const result = await service.resolveRunSubmissionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-alpha",
      workflowId: workflow.workflowId,
      actorUserIdentityId: "user-owner",
      inputAssetBindingIds: Object.freeze(["source-image"]),
      outputBindingIds: Object.freeze(["generated-image"]),
    });
    const advisory = result.advisoryIssues.find((issue) => issue.code === "backend-degraded");

    expect(advisory?.classification?.issueCode).toContain("im.node.operational.");
    expect(advisory?.recovery?.retry.retryEligible).toBeTrue();
  });
});

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
    lifecycleState: "published",
    activationStatus: "active",
    inputSlots: [Object.freeze({
      inputId: "source-image",
      label: "Source image",
      kind: "source-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
      acceptedAssetKinds: ["image-asset"],
    })],
    inputBindings: [Object.freeze({
      bindingId: "bind-input-source",
      inputId: "source-image",
      sourceKind: "selected-image",
      sourceKey: "asset.primary",
      required: true,
    })],
    parameterSpecifications: [Object.freeze({
      parameterId: "strength",
      label: "Strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      validation: Object.freeze({
        minimum: 0,
        maximum: 1,
      }),
    })],
    outputExpectations: [Object.freeze({
      outputId: "generated-image",
      label: "Generated image",
      kind: "generated-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
    })],
    outputBindings: [Object.freeze({
      bindingId: "bind-output-image",
      outputId: "generated-image",
      targetType: "output-dataset",
      requiredTargetId: false,
    })],
    backendTranslation: Object.freeze({
      translatorId: "translator:image",
      contractVersion: "1.0.0",
      templateId: InitialImageWorkflowTemplateFamilyIds.imageToImageRestyle,
      inputBindings: [Object.freeze({ inputId: "source-image", backendField: "inputs.source" })],
      parameterBindings: [Object.freeze({ parameterId: "strength", backendField: "inputs.strength" })],
      outputBindings: [Object.freeze({ outputId: "generated-image", backendField: "outputs.image" })],
    }),
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
    workflowBinding: Object.freeze({
      workflowId: workflow.workflowId,
      workflowWorkspaceId: workflow.ownership.workspaceId,
      workflowLineageId: workflow.version.lineageId,
      workflowVersionTag: workflow.version.versionTag,
      workflowRevision: workflow.version.revision,
      requiredInputIds: ["source-image"],
      requiredParameterIds: ["strength"],
      requiredOutputIds: ["generated-image"],
    }),
    inputAssetSelections: [Object.freeze({
      inputId: "source-image",
      assetReference: "asset://source-image",
    })],
    outputTargetBindings: [Object.freeze({
      outputId: "generated-image",
      targetReference: "dataset-instance://output",
    })],
    parameterBaseline: Object.freeze({
      values: Object.freeze({
        strength: 0.4,
      }),
      profileReferences: Object.freeze([]),
    }),
    lifecycleState: "ready",
    runtimeStatus: "enabled",
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
  return {
    ...system,
    ...overrides,
  };
}

function createAssetRecord(assetId: string): Asset {
  return Object.freeze({
    id: assetId,
    kind: "uploaded-file",
    ownership: Object.freeze({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-08T12:00:00.000Z",
      lastModifiedBy: "user-owner",
      lastModifiedAt: "2026-04-08T12:00:00.000Z",
    }),
    visibility: "workspace",
    sharingPolicyRef: undefined,
    storageBinding: Object.freeze({
      storageInstanceId: "storage-alpha",
      uri: "storage-instance://storage-alpha",
    }),
    versions: Object.freeze([Object.freeze({
      versionId: "v1",
      revision: 1,
      location: Object.freeze({
        storageInstance: Object.freeze({
          storageInstanceId: "storage-alpha",
          uri: "storage-instance://storage-alpha",
        }),
        objectKey: "assets/source.png",
        objectVersionId: "obj-v1",
        area: "input",
      }),
      content: Object.freeze({
        mimeType: "image/png",
        sizeBytes: 1024,
        checksum: Object.freeze({
          algorithm: "sha256",
          digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
        originalFileName: "source.png",
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-08T12:00:00.000Z",
    })]),
    currentVersionId: "v1",
    lifecycle: Object.freeze({
      state: AssetLifecycleStates.active,
    }),
  });
}
