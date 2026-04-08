import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowActivationStatuses,
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
  GetImageSystemDefinitionUseCase,
  GetImageWorkflowDefinitionUseCase,
  ListImageSystemDefinitionsUseCase,
  ListImageWorkflowDefinitionsUseCase,
} from "@application/image-workflows";
import {
  ImageWorkflowSystemQueryError,
  ImageWorkflowSystemQueryErrorCodes,
} from "../ImageWorkflowSystemQueryErrors";
import type {
  IImageSystemDefinitionRepository,
  IImageSystemDefinitionValidationService,
  IImageWorkflowDefinitionRepository,
  IImageWorkflowDefinitionValidationService,
  IImageWorkflowSystemAuthorizationPort,
  IImageWorkflowSystemCompatibilityService,
  IImageWorkflowVersionResolutionService,
  ImageDefinitionValidationResult,
  ImageWorkflowSystemAuthorizationDecision,
  ImageWorkflowSystemAuthorizationRequest,
  ImageWorkflowSystemDefinitionPorts,
  ImageWorkflowSystemMutationContext,
  ImageWorkflowSystemMutationResult,
  ImageWorkflowVersionResolutionResult,
} from "../ports";

class InMemoryWorkflowRepository implements IImageWorkflowDefinitionRepository {
  private readonly workflows = new Map<string, ImageWorkflowDefinition>();

  async findWorkflowDefinitionById(
    workflowId: string,
    query: Parameters<IImageWorkflowDefinitionRepository["findWorkflowDefinitionById"]>[1],
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
    query: Parameters<IImageWorkflowDefinitionRepository["listWorkflowDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
    const rows = [...this.workflows.values()]
      .filter((workflow) => workflow.ownership.workspaceId === query.workspaceId)
      .filter((workflow) => !query.ownerUserIds || query.ownerUserIds.length === 0 || query.ownerUserIds.includes(workflow.ownership.ownerUserId ?? ""))
      .filter((workflow) => !query.visibilities || query.visibilities.length === 0 || query.visibilities.includes(workflow.ownership.visibility))
      .filter((workflow) => !query.operationKinds || query.operationKinds.length === 0 || query.operationKinds.includes(workflow.operationKind))
      .filter((workflow) => !query.lifecycleStates || query.lifecycleStates.length === 0 || query.lifecycleStates.includes(workflow.lifecycleState))
      .filter((workflow) => !query.activationStatuses || query.activationStatuses.length === 0 || query.activationStatuses.includes(workflow.activationStatus))
      .filter((workflow) => !query.lineageIds || query.lineageIds.length === 0 || query.lineageIds.includes(workflow.version.lineageId))
      .filter((workflow) => !query.tags || query.tags.length === 0 || query.tags.some((tag) => workflow.display.tags.includes(tag)))
      .filter((workflow) => query.includeRetired || workflow.lifecycleState !== ImageWorkflowLifecycleStates.retired)
      .sort((left, right) => right.version.revision - left.version.revision);

    return page(rows, query.limit, query.offset);
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

  async findSystemDefinitionById(
    systemId: string,
    query: Parameters<IImageSystemDefinitionRepository["findSystemDefinitionById"]>[1],
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
    query: Parameters<IImageSystemDefinitionRepository["listSystemDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageSystemDefinition>> {
    const rows = [...this.systems.values()]
      .filter((system) => system.ownership.workspaceId === query.workspaceId)
      .filter((system) => !query.ownerUserIds || query.ownerUserIds.length === 0 || query.ownerUserIds.includes(system.ownership.ownerUserId ?? ""))
      .filter((system) => !query.visibilities || query.visibilities.length === 0 || query.visibilities.includes(system.ownership.visibility))
      .filter((system) => !query.sharingPolicyIds || query.sharingPolicyIds.length === 0 || query.sharingPolicyIds.includes(system.ownership.sharingPolicyId ?? ""))
      .filter((system) => !query.workflowIds || query.workflowIds.length === 0 || query.workflowIds.includes(system.workflowBinding.workflowId))
      .filter((system) => !query.workflowLineageIds || query.workflowLineageIds.length === 0 || query.workflowLineageIds.includes(system.workflowBinding.workflowLineageId))
      .filter((system) => !query.lifecycleStates || query.lifecycleStates.length === 0 || query.lifecycleStates.includes(system.lifecycleState))
      .filter((system) => !query.runtimeStatuses || query.runtimeStatuses.length === 0 || query.runtimeStatuses.includes(system.runtimeStatus))
      .filter((system) => !query.tags || query.tags.length === 0 || query.tags.some((tag) => system.display.tags.includes(tag)))
      .filter((system) => query.includeArchived || system.lifecycleState !== ImageSystemLifecycleStates.archived)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return page(rows, query.limit, query.offset);
  }

  async createSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    this.systems.set(definition.systemId, definition);
    return {
      changed: true,
      wasReplay: false,
      record: definition,
    };
  }

  async saveSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    this.systems.set(definition.systemId, definition);
    return {
      changed: true,
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

class PolicyAuthorizationPort implements IImageWorkflowSystemAuthorizationPort {
  public constructor(private readonly input?: {
    readonly denyListActions?: ReadonlyArray<string>;
    readonly deniedResourceIds?: ReadonlyArray<string>;
  }) {}

  async authorizeImageWorkflowSystemAction(
    request: ImageWorkflowSystemAuthorizationRequest,
  ): Promise<ImageWorkflowSystemAuthorizationDecision> {
    const denyAction = this.input?.denyListActions?.includes(request.action);
    if (denyAction) {
      return denied("action-denied");
    }

    if (request.workspaceId !== "workspace-alpha") {
      return denied("workspace-denied");
    }

    if (this.input?.deniedResourceIds?.includes(request.resource.resourceId ?? "")) {
      return denied("resource-denied");
    }

    if (request.action.endsWith(".read")) {
      const visibility = request.resource.visibility;
      const owner = request.resource.ownerUserId;
      if (visibility === "private" && owner && owner !== request.actorUserId) {
        return denied("private-owner-only");
      }
    }

    return {
      allowed: true,
      reasonCode: "allowed",
      evaluatedAt: "2026-04-08T21:00:00.000Z",
    };
  }
}

class StubWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  async validateWorkflowDefinition(
    _input: Parameters<IImageWorkflowDefinitionValidationService["validateWorkflowDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return {
      valid: true,
      evaluatedAt: "2026-04-08T21:00:00.000Z",
      issues: [],
    };
  }
}

class StubSystemValidationService implements IImageSystemDefinitionValidationService {
  async validateSystemDefinition(
    _input: Parameters<IImageSystemDefinitionValidationService["validateSystemDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return {
      valid: true,
      evaluatedAt: "2026-04-08T21:00:00.000Z",
      issues: [],
    };
  }
}

class StubCompatibilityService implements IImageWorkflowSystemCompatibilityService {
  async evaluateSystemWorkflowCompatibility(
    _input: Parameters<IImageWorkflowSystemCompatibilityService["evaluateSystemWorkflowCompatibility"]>[0],
  ) {
    return {
      outcome: "compatible" as const,
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

function buildPorts(input?: {
  readonly denyListActions?: ReadonlyArray<string>;
  readonly deniedResourceIds?: ReadonlyArray<string>;
  readonly workflowRepository?: InMemoryWorkflowRepository;
  readonly systemRepository?: InMemorySystemRepository;
}): ImageWorkflowSystemDefinitionPorts {
  return {
    workflowRepository: input?.workflowRepository ?? new InMemoryWorkflowRepository(),
    systemRepository: input?.systemRepository ?? new InMemorySystemRepository(),
    authorization: new PolicyAuthorizationPort({
      denyListActions: input?.denyListActions,
      deniedResourceIds: input?.deniedResourceIds,
    }),
    workflowValidation: new StubWorkflowValidationService(),
    systemValidation: new StubSystemValidationService(),
    compatibility: new StubCompatibilityService(),
    versionResolution: new StubVersionResolutionService(),
  };
}

function createWorkflow(input: {
  readonly workflowId: string;
  readonly ownerUserId: string;
  readonly visibility: "private" | "team" | "public";
  readonly operationKind?: string;
  readonly lifecycleState?: ImageWorkflowDefinition["lifecycleState"];
  readonly activationStatus?: ImageWorkflowDefinition["activationStatus"];
  readonly lineageId?: string;
  readonly versionTag: string;
  readonly revision: number;
  readonly tags?: ReadonlyArray<string>;
  readonly title?: string;
  readonly summary?: string;
}): ImageWorkflowDefinition {
  return createImageWorkflowDefinition({
    workflowId: input.workflowId,
    operationKind: input.operationKind ?? "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
    },
    display: {
      title: input.title ?? `Workflow ${input.workflowId}`,
      summary: input.summary,
      tags: input.tags ?? ["image", "workflow"],
    },
    version: {
      lineageId: input.lineageId ?? "lineage-alpha",
      versionTag: input.versionTag,
      revision: input.revision,
    },
    lifecycleState: input.lifecycleState ?? ImageWorkflowLifecycleStates.published,
    activationStatus: input.activationStatus ?? ImageWorkflowActivationStatuses.active,
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
      sourceKey: "selection.primary",
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
    createdBy: input.ownerUserId,
    now: new Date("2026-04-08T21:00:00.000Z"),
  });
}

function createSystem(input: {
  readonly systemId: string;
  readonly ownerUserId: string;
  readonly visibility: "private" | "team" | "public";
  readonly workflow: ImageWorkflowDefinition;
  readonly lifecycleState?: ImageSystemDefinition["lifecycleState"];
  readonly runtimeStatus?: ImageSystemDefinition["runtimeStatus"];
  readonly tags?: ReadonlyArray<string>;
  readonly title?: string;
  readonly summary?: string;
}): ImageSystemDefinition {
  return createImageSystemDefinition({
    systemId: input.systemId,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
      sharingPolicyId: "sharing-policy-alpha",
      sharingPolicyVersion: "1",
    },
    display: {
      title: input.title ?? `System ${input.systemId}`,
      summary: input.summary,
      tags: input.tags ?? ["system", "image"],
    },
    workflowBinding: {
      workflowId: input.workflow.workflowId,
      workflowWorkspaceId: input.workflow.ownership.workspaceId,
      workflowLineageId: input.workflow.version.lineageId,
      workflowVersionTag: input.workflow.version.versionTag,
      workflowRevision: input.workflow.version.revision,
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
        strength: 0.5,
      },
      profileReferences: [],
    },
    lifecycleState: input.lifecycleState ?? ImageSystemLifecycleStates.ready,
    runtimeStatus: input.runtimeStatus ?? ImageSystemRuntimeStatuses.enabled,
    createdBy: input.ownerUserId,
    now: new Date("2026-04-08T21:00:00.000Z"),
  });
}

async function seedWorkflow(
  repository: InMemoryWorkflowRepository,
  workflow: ImageWorkflowDefinition,
): Promise<void> {
  await repository.createWorkflowDefinition(workflow, {
    operationKey: `seed:${workflow.workflowId}`,
    actorUserId: workflow.createdBy,
  });
}

async function seedSystem(
  repository: InMemorySystemRepository,
  system: ImageSystemDefinition,
): Promise<void> {
  await repository.createSystemDefinition(system, {
    operationKey: `seed:${system.systemId}`,
    actorUserId: system.createdBy,
  });
}

describe("image workflow/system query use cases", () => {
  it("retrieves workflow detail with readiness and structure metadata for authorized callers", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const workflow = createWorkflow({
      workflowId: "workflow-alpha-v1",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.0.0",
      revision: 1,
    });
    await seedWorkflow(workflowRepository, workflow);

    const useCase = new GetImageWorkflowDefinitionUseCase(buildPorts({ workflowRepository }));

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserId: "user-reader",
      workflowId: "workflow-alpha-v1",
    });

    expect(result.workflow.workflowId).toBe("workflow-alpha-v1");
    expect(result.readiness.ready).toBeTrue();
    expect(result.structure.parameters.required).toBe(1);
  });

  it("rejects workflow detail access when policy denies resource-level read", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const workflow = createWorkflow({
      workflowId: "workflow-private",
      ownerUserId: "user-owner",
      visibility: "private",
      versionTag: "1.0.0",
      revision: 1,
    });
    await seedWorkflow(workflowRepository, workflow);
    const useCase = new GetImageWorkflowDefinitionUseCase(buildPorts({ workflowRepository }));

    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-reader",
        workflowId: "workflow-private",
      });
      throw new Error("expected detail read to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowSystemQueryError);
      expect((error as ImageWorkflowSystemQueryError).code).toBe(ImageWorkflowSystemQueryErrorCodes.unauthorized);
    }
  });

  it("lists workflows with scope/filter/search/version controls and per-item authorization filtering", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const workflowA = createWorkflow({
      workflowId: "workflow-alpha-v1",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.0.0",
      revision: 1,
      tags: ["picker", "portrait"],
      title: "Portrait Alpha",
      summary: "Editor flow",
    });
    const workflowB = createWorkflow({
      workflowId: "workflow-alpha-v2",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.1.0",
      revision: 2,
      tags: ["picker", "landscape"],
      title: "Landscape Beta",
      summary: "Reopen flow",
    });
    const workflowPrivate = createWorkflow({
      workflowId: "workflow-private-v1",
      ownerUserId: "user-owner",
      visibility: "private",
      versionTag: "1.0.0",
      revision: 1,
      tags: ["picker"],
      title: "Private",
    });
    await seedWorkflow(workflowRepository, workflowA);
    await seedWorkflow(workflowRepository, workflowB);
    await seedWorkflow(workflowRepository, workflowPrivate);

    const useCase = new ListImageWorkflowDefinitionsUseCase(buildPorts({ workflowRepository }));
    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserId: "user-reader",
      operationKinds: ["image-to-image"],
      lifecycleStates: [ImageWorkflowLifecycleStates.published],
      activationStatuses: [ImageWorkflowActivationStatuses.active],
      tags: ["picker"],
      versionTags: ["1.1.0"],
      revisions: [2],
      search: "landscape",
      limit: 10,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.workflowId).toBe("workflow-alpha-v2");
    expect(result.items[0]?.readiness.ready).toBeTrue();
    expect(result.pagination.hasMore).toBeFalse();
  });

  it("retrieves system detail with readiness/structure metadata for authorized callers", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflow = createWorkflow({
      workflowId: "workflow-alpha-v1",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.0.0",
      revision: 1,
    });
    await seedWorkflow(workflowRepository, workflow);
    const system = createSystem({
      systemId: "system-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
      workflow,
    });
    await seedSystem(systemRepository, system);

    const useCase = new GetImageSystemDefinitionUseCase(buildPorts({
      workflowRepository,
      systemRepository,
    }));
    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserId: "user-reader",
      systemId: "system-alpha",
    });

    expect(result.system.systemId).toBe("system-alpha");
    expect(result.readiness.state).toBe("configuration-runnable");
    expect(result.structure.requirements.requiredOutputs).toBe(1);
  });

  it("lists systems with workflow/runtime filters and returns pagination for visible items only", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const systemRepository = new InMemorySystemRepository();
    const workflowV1 = createWorkflow({
      workflowId: "workflow-alpha-v1",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.0.0",
      revision: 1,
      lineageId: "lineage-alpha",
    });
    const workflowV2 = createWorkflow({
      workflowId: "workflow-alpha-v2",
      ownerUserId: "user-owner",
      visibility: "team",
      versionTag: "1.1.0",
      revision: 2,
      lineageId: "lineage-alpha",
    });
    await seedWorkflow(workflowRepository, workflowV1);
    await seedWorkflow(workflowRepository, workflowV2);

    await seedSystem(systemRepository, createSystem({
      systemId: "system-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
      workflow: workflowV2,
      title: "System Alpha",
      summary: "Reopen target",
      tags: ["picker", "reopen"],
    }));
    await seedSystem(systemRepository, createSystem({
      systemId: "system-beta",
      ownerUserId: "user-owner",
      visibility: "team",
      workflow: workflowV1,
      lifecycleState: ImageSystemLifecycleStates.draft,
      runtimeStatus: ImageSystemRuntimeStatuses.disabled,
      title: "System Beta",
      tags: ["picker"],
    }));

    const useCase = new ListImageSystemDefinitionsUseCase(buildPorts({
      workflowRepository,
      systemRepository,
      deniedResourceIds: ["system-beta"],
    }));
    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserId: "user-reader",
      workflowLineageIds: ["lineage-alpha"],
      workflowVersionTags: ["1.1.0"],
      workflowRevisions: [2],
      lifecycleStates: [ImageSystemLifecycleStates.ready],
      runtimeStatuses: [ImageSystemRuntimeStatuses.enabled],
      tags: ["reopen"],
      search: "alpha",
      limit: 1,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.systemId).toBe("system-alpha");
    expect(result.pagination.limit).toBe(1);
    expect(result.pagination.returned).toBe(1);
    expect(result.pagination.hasMore).toBeFalse();
  });

  it("rejects list requests when list authorization is denied", async () => {
    const useCase = new ListImageSystemDefinitionsUseCase(buildPorts({
      denyListActions: ["image-system.list"],
    }));
    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-reader",
      });
      throw new Error("expected list to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowSystemQueryError);
      expect((error as ImageWorkflowSystemQueryError).code).toBe(ImageWorkflowSystemQueryErrorCodes.unauthorized);
    }
  });
});

function page<TValue>(
  values: ReadonlyArray<TValue>,
  limit?: number,
  offset?: number,
): ReadonlyArray<TValue> {
  const normalizedOffset = offset && offset > 0 ? offset : 0;
  const normalizedLimit = limit && limit > 0 ? limit : undefined;
  const withOffset = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
  return normalizedLimit ? withOffset.slice(0, normalizedLimit) : withOffset;
}

function denied(reasonCode: string): ImageWorkflowSystemAuthorizationDecision {
  return {
    allowed: false,
    reasonCode,
    evaluatedAt: "2026-04-08T21:00:00.000Z",
  };
}
