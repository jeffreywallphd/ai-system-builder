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
import {
  CreateImageSystemDefinitionUseCase,
  UpdateImageSystemDefinitionUseCase,
  type CreateImageSystemDefinitionRequest,
  type UpdateImageSystemDefinitionRequest,
} from "@application/image-workflows";
import {
  ImageWorkflowCompatibilityOutcomes,
  type IImageSystemDefinitionRepository,
  type IImageSystemDefinitionValidationService,
  type IImageWorkflowDefinitionRepository,
  type IImageWorkflowDefinitionValidationService,
  type IImageWorkflowSystemAuthorizationPort,
  type IImageWorkflowSystemCompatibilityService,
  type IImageWorkflowVersionResolutionService,
  type ImageDefinitionValidationResult,
  type ImageWorkflowSystemAuthorizationDecision,
  type ImageWorkflowSystemAuthorizationRequest,
  type ImageWorkflowSystemDefinitionPorts,
  type ImageWorkflowSystemMutationContext,
  type ImageWorkflowSystemMutationResult,
  type ImageWorkflowVersionResolutionResult,
} from "../ports";
import {
  ImageSystemDefinitionAuthoringError,
  ImageSystemDefinitionAuthoringErrorCodes,
} from "../ImageSystemDefinitionAuthoringErrors";

class InMemoryWorkflowRepository implements IImageWorkflowDefinitionRepository {
  private readonly workflows = new Map<string, ImageWorkflowDefinition>();

  async findWorkflowDefinitionById(
    workflowId: string,
    query: { readonly workspaceId: string; readonly includeRetired?: boolean },
  ): Promise<ImageWorkflowDefinition | undefined> {
    const workflow = this.workflows.get(workflowId.trim());
    if (!workflow || workflow.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    if (!query.includeRetired && workflow.lifecycleState === ImageWorkflowLifecycleStates.retired) {
      return undefined;
    }
    return workflow;
  }

  async resolveWorkflowDefinitionVersion(
    _query: Parameters<IImageWorkflowDefinitionRepository["resolveWorkflowDefinitionVersion"]>[0],
  ): Promise<ImageWorkflowDefinition | undefined> {
    return undefined;
  }

  async listWorkflowDefinitions(
    _query: Parameters<IImageWorkflowDefinitionRepository["listWorkflowDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
    return [];
  }

  async createWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    this.workflows.set(definition.workflowId, definition);
    return {
      changed: true,
      wasReplay: false,
      record: definition,
    };
  }

  async saveWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    this.workflows.set(definition.workflowId, definition);
    return {
      changed: true,
      wasReplay: false,
      record: definition,
    };
  }

  async archiveWorkflowDefinition(
    _workflowId: string,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> | undefined> {
    return undefined;
  }

  async getWorkflowBackendTranslationReference(
    _query: Parameters<IImageWorkflowDefinitionRepository["getWorkflowBackendTranslationReference"]>[0],
  ) {
    return undefined;
  }
}

class InMemorySystemRepository implements IImageSystemDefinitionRepository {
  private readonly systems = new Map<string, ImageSystemDefinition>();
  public lastMutation?: ImageWorkflowSystemMutationContext;

  async findSystemDefinitionById(
    systemId: string,
    query: { readonly workspaceId: string; readonly includeArchived?: boolean },
  ): Promise<ImageSystemDefinition | undefined> {
    const system = this.systems.get(systemId.trim());
    if (!system || system.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    if (!query.includeArchived && system.lifecycleState === ImageSystemLifecycleStates.archived) {
      return undefined;
    }
    return system;
  }

  async listSystemDefinitions(
    _query: Parameters<IImageSystemDefinitionRepository["listSystemDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageSystemDefinition>> {
    return [];
  }

  async createSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    this.systems.set(definition.systemId, definition);
    this.lastMutation = mutation;
    return {
      changed: true,
      wasReplay: false,
      record: definition,
    };
  }

  async saveSystemDefinition(
    definition: ImageSystemDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    const previous = this.systems.get(definition.systemId);
    this.systems.set(definition.systemId, definition);
    this.lastMutation = mutation;
    return {
      changed: JSON.stringify(previous) !== JSON.stringify(definition),
      wasReplay: false,
      record: definition,
    };
  }

  async archiveSystemDefinition(
    _systemId: string,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined> {
    return undefined;
  }
}

class AllowAuthorizationPort implements IImageWorkflowSystemAuthorizationPort {
  public constructor(private readonly allowed: boolean = true) {}

  async authorizeImageWorkflowSystemAction(
    _request: ImageWorkflowSystemAuthorizationRequest,
  ): Promise<ImageWorkflowSystemAuthorizationDecision> {
    return {
      allowed: this.allowed,
      reasonCode: this.allowed ? "allowed" : "denied",
      reason: this.allowed ? undefined : "denied by policy",
      evaluatedAt: "2026-04-08T18:00:00.000Z",
    };
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
    private readonly result = {
      outcome: ImageWorkflowCompatibilityOutcomes.compatible,
      issues: [],
    } as const,
  ) {}

  async evaluateSystemWorkflowCompatibility(
    _input: Parameters<IImageWorkflowSystemCompatibilityService["evaluateSystemWorkflowCompatibility"]>[0],
  ) {
    return this.result;
  }
}

class StubWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  async validateWorkflowDefinition(
    _input: Parameters<IImageWorkflowDefinitionValidationService["validateWorkflowDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return {
      valid: true,
      evaluatedAt: "2026-04-08T18:00:00.000Z",
      issues: [],
    };
  }
}

class StubVersionResolutionService implements IImageWorkflowVersionResolutionService {
  async resolveWorkflowDefinitionVersion(
    _request: Parameters<IImageWorkflowVersionResolutionService["resolveWorkflowDefinitionVersion"]>[0],
  ): Promise<ImageWorkflowVersionResolutionResult> {
    return {
      resolved: false,
      reasonCode: "not-used",
    };
  }
}

function createWorkflow(input: {
  readonly workflowId: string;
  readonly versionTag: string;
  readonly revision: number;
}): ImageWorkflowDefinition {
  return createImageWorkflowDefinition({
    workflowId: input.workflowId,
    operationKind: "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
    },
    display: {
      title: "Workflow",
      tags: ["image"],
    },
    version: {
      lineageId: "workflow-lineage-alpha",
      versionTag: input.versionTag,
      revision: input.revision,
    },
    lifecycleState: ImageWorkflowLifecycleStates.published,
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
      bindingId: "input-source",
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
      bindingId: "output-image",
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
    now: new Date("2026-04-08T18:00:00.000Z"),
  });
}

function buildCreateRequest(
  workflow: ImageWorkflowDefinition,
  overrides?: Partial<CreateImageSystemDefinitionRequest>,
): CreateImageSystemDefinitionRequest {
  return {
    workspaceId: "workspace-alpha",
    actorUserId: "user-author",
    operationKey: "system-create-op-1",
    occurredAt: "2026-04-08T18:00:00.000Z",
    system: {
      systemId: "system-alpha",
      ownership: {
        workspaceId: "workspace-alpha",
        ownerUserId: "user-author",
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
        assetReference: "asset://source-1",
      }],
      outputTargetBindings: [{
        outputId: "generated-image",
        targetReference: "dataset-instance://generated",
      }],
      parameterBaseline: {
        values: {
          strength: 0.6,
        },
        profileReferences: [],
      },
    },
    ...overrides,
  };
}

function buildPorts(input: {
  readonly workflowRepository: InMemoryWorkflowRepository;
  readonly systemRepository: InMemorySystemRepository;
  readonly authorizationAllowed?: boolean;
  readonly validationResult?: ImageDefinitionValidationResult;
  readonly compatibilityResult?: {
    readonly outcome: "compatible" | "warnings" | "incompatible";
    readonly issues: ReadonlyArray<{
      readonly code: string;
      readonly path: string;
      readonly message: string;
      readonly severity: "error" | "warning" | "info";
    }>;
  };
}): ImageWorkflowSystemDefinitionPorts {
  return {
    workflowRepository: input.workflowRepository,
    systemRepository: input.systemRepository,
    authorization: new AllowAuthorizationPort(input.authorizationAllowed ?? true),
    workflowValidation: new StubWorkflowValidationService(),
    systemValidation: new StaticSystemValidationService(input.validationResult ?? {
      valid: true,
      evaluatedAt: "2026-04-08T18:00:00.000Z",
      issues: [],
    }),
    compatibility: new StaticCompatibilityService(
      input.compatibilityResult ?? {
        outcome: ImageWorkflowCompatibilityOutcomes.compatible,
        issues: [],
      },
    ),
    versionResolution: new StubVersionResolutionService(),
  };
}

async function seedWorkflow(
  repository: InMemoryWorkflowRepository,
  input: {
    readonly workflowId: string;
    readonly versionTag: string;
    readonly revision: number;
  },
): Promise<ImageWorkflowDefinition> {
  const workflow = createWorkflow(input);
  await repository.createWorkflowDefinition(workflow, {
    operationKey: "seed-workflow",
    actorUserId: "user-owner",
  });
  return workflow;
}

async function seedSystem(
  repository: InMemorySystemRepository,
  workflow: ImageWorkflowDefinition,
): Promise<ImageSystemDefinition> {
  const system = createImageSystemDefinition({
    ...buildCreateRequest(workflow).system,
    lifecycleState: ImageSystemLifecycleStates.ready,
    runtimeStatus: ImageSystemRuntimeStatuses.enabled,
    createdBy: "user-owner",
    now: new Date("2026-04-08T18:00:00.000Z"),
  });
  await repository.createSystemDefinition(system, {
    operationKey: "seed-system",
    actorUserId: "user-owner",
  });
  return system;
}

describe("image system definition authoring use cases", () => {
  it("creates a system definition and returns structured readiness/validation metadata", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const useCase = new CreateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    const result = await useCase.execute(buildCreateRequest(workflow));

    expect(result.system.systemId).toBe("system-alpha");
    expect(result.readiness.state).toBe("configuration-ready");
    expect(result.readiness.ready).toBeTrue();
    expect(result.validation.valid).toBeTrue();
    expect(result.compatibility.outcome).toBe("compatible");
    expect(result.structure.requirements.requiredInputs).toBe(1);
    expect(systemRepository.lastMutation?.operationKey).toBe("system-create-op-1");
  });

  it("persists draft systems with readiness issues and returns issue details", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const useCase = new CreateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    const result = await useCase.execute(buildCreateRequest(workflow, {
      system: {
        ...buildCreateRequest(workflow).system,
        outputTargetBindings: [],
      },
    }));

    expect(result.readiness.state).toBe("configuration-incomplete");
    expect(result.readiness.issues.some((issue) => issue.code === "required-output-binding-missing")).toBeTrue();
  });

  it("rejects create when workflow version metadata does not match authoritative workflow", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const useCase = new CreateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    try {
      await useCase.execute(buildCreateRequest(workflow, {
        system: {
          ...buildCreateRequest(workflow).system,
          workflowBinding: {
            ...buildCreateRequest(workflow).system.workflowBinding,
            workflowVersionTag: "1.1.0",
          },
        },
      }));
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageSystemDefinitionAuthoringError);
      const failure = error as ImageSystemDefinitionAuthoringError;
      expect(failure.code).toBe(ImageSystemDefinitionAuthoringErrorCodes.invalidRequest);
    }
  });

  it("rejects create when workflow binding requirements are incompatible with workflow definition", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const useCase = new CreateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    try {
      await useCase.execute(buildCreateRequest(workflow, {
        system: {
          ...buildCreateRequest(workflow).system,
          workflowBinding: {
            ...buildCreateRequest(workflow).system.workflowBinding,
            requiredParameterIds: ["unknown-parameter"],
          },
        },
      }));
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageSystemDefinitionAuthoringError);
      const failure = error as ImageSystemDefinitionAuthoringError;
      expect(failure.code).toBe(ImageSystemDefinitionAuthoringErrorCodes.incompatible);
    }
  });

  it("rejects create when compatibility service reports an incompatible result", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const useCase = new CreateImageSystemDefinitionUseCase(
      buildPorts({
        workflowRepository,
        systemRepository,
        compatibilityResult: {
          outcome: "incompatible",
          issues: [{
            code: "workflow-contract-incompatible",
            path: "workflowBinding",
            message: "System binding contract is incompatible.",
            severity: "error",
          }],
        },
      }),
    );

    try {
      await useCase.execute(buildCreateRequest(workflow));
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageSystemDefinitionAuthoringError);
      const failure = error as ImageSystemDefinitionAuthoringError;
      expect(failure.code).toBe(ImageSystemDefinitionAuthoringErrorCodes.incompatible);
    }
  });

  it("rebinds workflow on update and resets runtime posture to draft-disabled", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflowV1 = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const workflowV2 = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v2",
      versionTag: "1.1.0",
      revision: 2,
    });

    await seedSystem(systemRepository, workflowV1);

    const useCase = new UpdateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    const request: UpdateImageSystemDefinitionRequest = {
      workspaceId: "workspace-alpha",
      actorUserId: "user-editor",
      systemId: "system-alpha",
      operationKey: "system-update-op-1",
      expectedRevision: 4,
      changes: {
        workflowBinding: {
          workflowId: workflowV2.workflowId,
          workflowWorkspaceId: workflowV2.ownership.workspaceId,
          workflowLineageId: workflowV2.version.lineageId,
          workflowVersionTag: workflowV2.version.versionTag,
          workflowRevision: workflowV2.version.revision,
          requiredInputIds: ["source-image"],
          requiredParameterIds: ["strength"],
          requiredOutputIds: ["generated-image"],
        },
        lifecycleState: ImageSystemLifecycleStates.ready,
        runtimeStatus: ImageSystemRuntimeStatuses.enabled,
      },
    };

    const result = await useCase.execute(request);

    expect(result.system.workflowBinding.workflowId).toBe("workflow-alpha-v2");
    expect(result.system.lifecycleState).toBe("draft");
    expect(result.system.runtimeStatus).toBe("disabled");
    expect(systemRepository.lastMutation?.expectedRevision).toBe(4);
  });

  it("rejects forbidden lifecycle transitions during update when workflow is not being rebound", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    const readySystem = await seedSystem(systemRepository, workflow);
    await systemRepository.saveSystemDefinition({
      ...readySystem,
      lifecycleState: ImageSystemLifecycleStates.archived,
      runtimeStatus: ImageSystemRuntimeStatuses.disabled,
      updatedAt: "2026-04-08T18:30:00.000Z",
    }, {
      operationKey: "seed-archived",
      actorUserId: "user-owner",
    });

    const useCase = new UpdateImageSystemDefinitionUseCase(
      buildPorts({ workflowRepository, systemRepository }),
    );

    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-editor",
        systemId: "system-alpha",
        changes: {
          lifecycleState: ImageSystemLifecycleStates.ready,
        },
      });
      throw new Error("expected update to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageSystemDefinitionAuthoringError);
      const failure = error as ImageSystemDefinitionAuthoringError;
      expect(failure.code).toBe(ImageSystemDefinitionAuthoringErrorCodes.lifecycleTransitionDenied);
    }
  });

  it("rejects unauthorized update requests", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = await seedWorkflow(workflowRepository, {
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
    });
    await seedSystem(systemRepository, workflow);

    const useCase = new UpdateImageSystemDefinitionUseCase(
      buildPorts({
        workflowRepository,
        systemRepository,
        authorizationAllowed: false,
      }),
    );

    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-denied",
        systemId: "system-alpha",
        changes: {
          display: {
            title: "Denied update",
            tags: ["denied"],
          },
        },
      });
      throw new Error("expected update to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageSystemDefinitionAuthoringError);
      const failure = error as ImageSystemDefinitionAuthoringError;
      expect(failure.code).toBe(ImageSystemDefinitionAuthoringErrorCodes.unauthorized);
    }
  });
});
