import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  createImageWorkflowDefinition,
  transitionImageWorkflowLifecycle,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  createImageSystemDefinition,
  transitionImageSystemLifecycle,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import {
  ImageDefinitionValidationSeverities,
  ImageWorkflowCompatibilityOutcomes,
  ImageWorkflowSystemPermissionActions,
  ImageWorkflowSystemAuthorizationResourceKinds,
  ImageWorkflowVersionSelectionStrategies,
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
  type ImageWorkflowVersionResolutionRequest,
  type ImageWorkflowVersionResolutionResult,
  type ImageWorkflowVersionSelector,
} from "../ports";

function createWorkflowDefinition(input: {
  readonly workflowId: string;
  readonly versionTag: string;
  readonly revision: number;
  readonly lifecycleState?: ImageWorkflowDefinition["lifecycleState"];
  readonly activationStatus?: ImageWorkflowDefinition["activationStatus"];
  readonly visibility?: ImageWorkflowDefinition["ownership"]["visibility"];
}): ImageWorkflowDefinition {
  return createImageWorkflowDefinition({
    workflowId: input.workflowId,
    operationKind: "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: input.visibility ?? "team",
    },
    display: {
      title: `Workflow ${input.workflowId}`,
      tags: ["image", "slice"],
    },
    version: {
      lineageId: "workflow-lineage-alpha",
      versionTag: input.versionTag,
      revision: input.revision,
    },
    lifecycleState: input.lifecycleState ?? ImageWorkflowLifecycleStates.draft,
    activationStatus: input.activationStatus ?? ImageWorkflowActivationStatuses.inactive,
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
      bindingId: "input-binding-source-image",
      inputId: "source-image",
      sourceKind: "selected-image",
      sourceKey: "selection.primary",
      required: true,
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
      bindingId: "output-binding-generated-image",
      outputId: "generated-image",
      targetType: "output-dataset",
      requiredTargetId: false,
    }],
    backendTranslation: {
      translatorId: "translator:image-to-image",
      contractVersion: "1.0.0",
      templateId: "template:image-to-image",
      inputBindings: [{
        inputId: "source-image",
        backendField: "inputs.source",
      }],
      parameterBindings: [],
      outputBindings: [{
        outputId: "generated-image",
        backendField: "outputs.images[0]",
      }],
    },
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
}

function createSystemDefinition(workflow: ImageWorkflowDefinition): ImageSystemDefinition {
  return createImageSystemDefinition({
    systemId: "system-alpha",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
      sharingPolicyId: "sharing-policy-alpha",
      sharingPolicyVersion: "3",
    },
    display: {
      title: "Reference image system",
      tags: ["system", "image"],
    },
    workflowBinding: {
      workflowId: workflow.workflowId,
      workflowWorkspaceId: workflow.ownership.workspaceId,
      workflowLineageId: workflow.version.lineageId,
      workflowVersionTag: workflow.version.versionTag,
      workflowRevision: workflow.version.revision,
      requiredInputIds: ["source-image"],
      requiredParameterIds: [],
      requiredOutputIds: ["generated-image"],
    },
    inputAssetSelections: [{
      inputId: "source-image",
      assetReference: "asset://image/source-1",
    }],
    outputTargetBindings: [{
      outputId: "generated-image",
      targetReference: "dataset-instance://output-images",
    }],
    parameterBaseline: {
      values: {},
      profileReferences: [],
    },
    lifecycleState: ImageSystemLifecycleStates.ready,
    runtimeStatus: ImageSystemRuntimeStatuses.enabled,
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
}

class InMemoryImageDefinitionRepository
  implements IImageWorkflowDefinitionRepository, IImageSystemDefinitionRepository {
  private readonly workflows = new Map<string, ImageWorkflowDefinition>();
  private readonly systems = new Map<string, ImageSystemDefinition>();

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
    query: { readonly workspaceId: string; readonly selector: ImageWorkflowVersionSelector },
  ): Promise<ImageWorkflowDefinition | undefined> {
    const matches = [...this.workflows.values()]
      .filter((workflow) => workflow.ownership.workspaceId === query.workspaceId)
      .filter((workflow) => {
        const selector = query.selector;
        switch (selector.strategy) {
          case ImageWorkflowVersionSelectionStrategies.workflowId:
            return selector.workflowId === workflow.workflowId;
          case ImageWorkflowVersionSelectionStrategies.lineageAndVersionTag:
            return workflow.version.lineageId === selector.lineageId
              && workflow.version.versionTag === selector.versionTag;
          case ImageWorkflowVersionSelectionStrategies.lineageAndRevision:
            return workflow.version.lineageId === selector.lineageId
              && workflow.version.revision === selector.revision;
          case ImageWorkflowVersionSelectionStrategies.latestRevisionInLineage:
            return workflow.version.lineageId === selector.lineageId;
          case ImageWorkflowVersionSelectionStrategies.latestPublishedInLineage:
            return workflow.version.lineageId === selector.lineageId
              && workflow.lifecycleState === ImageWorkflowLifecycleStates.published;
          case ImageWorkflowVersionSelectionStrategies.activePublishedInLineage:
            return workflow.version.lineageId === selector.lineageId
              && workflow.lifecycleState === ImageWorkflowLifecycleStates.published
              && workflow.activationStatus === ImageWorkflowActivationStatuses.active;
          default:
            return false;
        }
      })
      .sort((left, right) => right.version.revision - left.version.revision);

    return matches[0];
  }

  async listWorkflowDefinitions(query: {
    readonly workspaceId: string;
    readonly ownerUserIds?: ReadonlyArray<string>;
    readonly visibilities?: ReadonlyArray<ImageWorkflowDefinition["ownership"]["visibility"]>;
    readonly operationKinds?: ReadonlyArray<string>;
    readonly lifecycleStates?: ReadonlyArray<ImageWorkflowDefinition["lifecycleState"]>;
    readonly activationStatuses?: ReadonlyArray<ImageWorkflowDefinition["activationStatus"]>;
    readonly lineageIds?: ReadonlyArray<string>;
    readonly tags?: ReadonlyArray<string>;
    readonly includeRetired?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
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

    return this.page(rows, query.limit, query.offset);
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
    const previous = this.workflows.get(definition.workflowId);
    this.workflows.set(definition.workflowId, definition);
    return {
      changed: JSON.stringify(previous) !== JSON.stringify(definition),
      wasReplay: false,
      record: definition,
    };
  }

  async archiveWorkflowDefinition(
    workflowId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> | undefined> {
    const current = this.workflows.get(workflowId.trim());
    if (!current) {
      return undefined;
    }
    const archived = transitionImageWorkflowLifecycle(current, {
      targetState: ImageWorkflowLifecycleStates.retired,
      actorUserId: mutation.actorUserId,
      now: mutation.occurredAt ? new Date(mutation.occurredAt) : undefined,
    });
    this.workflows.set(archived.workflowId, archived);
    return {
      changed: true,
      wasReplay: false,
      record: archived,
    };
  }

  async getWorkflowBackendTranslationReference(
    query: { readonly workspaceId: string; readonly selector: ImageWorkflowVersionSelector },
  ) {
    const workflow = await this.resolveWorkflowDefinitionVersion(query);
    return workflow?.backendTranslation;
  }

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

  async listSystemDefinitions(query: {
    readonly workspaceId: string;
    readonly ownerUserIds?: ReadonlyArray<string>;
    readonly visibilities?: ReadonlyArray<ImageSystemDefinition["ownership"]["visibility"]>;
    readonly sharingPolicyIds?: ReadonlyArray<string>;
    readonly workflowIds?: ReadonlyArray<string>;
    readonly workflowLineageIds?: ReadonlyArray<string>;
    readonly lifecycleStates?: ReadonlyArray<ImageSystemDefinition["lifecycleState"]>;
    readonly runtimeStatuses?: ReadonlyArray<ImageSystemDefinition["runtimeStatus"]>;
    readonly tags?: ReadonlyArray<string>;
    readonly includeArchived?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<ImageSystemDefinition>> {
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
      .filter((system) => query.includeArchived || system.lifecycleState !== ImageSystemLifecycleStates.archived);

    return this.page(rows, query.limit, query.offset);
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
    const previous = this.systems.get(definition.systemId);
    this.systems.set(definition.systemId, definition);
    return {
      changed: JSON.stringify(previous) !== JSON.stringify(definition),
      wasReplay: false,
      record: definition,
    };
  }

  async archiveSystemDefinition(
    systemId: string,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined> {
    const current = this.systems.get(systemId.trim());
    if (!current) {
      return undefined;
    }
    const archived = transitionImageSystemLifecycle(current, {
      targetState: ImageSystemLifecycleStates.archived,
      actorUserId: mutation.actorUserId,
      now: mutation.occurredAt ? new Date(mutation.occurredAt) : undefined,
    });
    this.systems.set(archived.systemId, archived);
    return {
      changed: true,
      wasReplay: false,
      record: archived,
    };
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = offset && offset > 0 ? offset : 0;
    const normalizedLimit = limit && limit > 0 ? limit : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

class AllowTeamVisibilityAuthorizationPort implements IImageWorkflowSystemAuthorizationPort {
  async authorizeImageWorkflowSystemAction(
    request: ImageWorkflowSystemAuthorizationRequest,
  ): Promise<ImageWorkflowSystemAuthorizationDecision> {
    const allowed = request.workspaceId === "workspace-alpha"
      && (request.resource.visibility ?? "team") !== "private";

    return {
      allowed,
      reasonCode: allowed ? "allowed" : "denied-by-visibility-policy",
      evaluatedAt: "2026-04-08T12:00:00.000Z",
    };
  }
}

class DomainBackedWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  async validateWorkflowDefinition(input: {
    readonly workspaceId: string;
    readonly workflow: ImageWorkflowDefinition;
    readonly mode?: "authoring" | "publish" | "runtime";
  }): Promise<ImageDefinitionValidationResult> {
    if (input.workflow.ownership.workspaceId !== input.workspaceId) {
      return {
        valid: false,
        evaluatedAt: "2026-04-08T12:00:00.000Z",
        issues: [{
          code: "workspace-mismatch",
          path: "ownership.workspaceId",
          message: "Workflow workspace scope must match request workspace scope.",
          severity: ImageDefinitionValidationSeverities.error,
        }],
      };
    }

    return {
      valid: true,
      evaluatedAt: "2026-04-08T12:00:00.000Z",
      issues: [],
    };
  }
}

class DomainBackedSystemValidationService implements IImageSystemDefinitionValidationService {
  async validateSystemDefinition(input: {
    readonly workspaceId: string;
    readonly system: ImageSystemDefinition;
    readonly mode?: "authoring" | "ready" | "runtime";
  }): Promise<ImageDefinitionValidationResult> {
    if (input.system.ownership.workspaceId !== input.workspaceId) {
      return {
        valid: false,
        evaluatedAt: "2026-04-08T12:00:00.000Z",
        issues: [{
          code: "workspace-mismatch",
          path: "ownership.workspaceId",
          message: "System workspace scope must match request workspace scope.",
          severity: ImageDefinitionValidationSeverities.error,
        }],
      };
    }

    return {
      valid: true,
      evaluatedAt: "2026-04-08T12:00:00.000Z",
      issues: [],
    };
  }
}

class WorkflowSystemCompatibilityService implements IImageWorkflowSystemCompatibilityService {
  async evaluateSystemWorkflowCompatibility(input: {
    readonly workspaceId: string;
    readonly workflow: ImageWorkflowDefinition;
    readonly system: ImageSystemDefinition;
    readonly mode?: "strict" | "balanced" | "permissive";
  }) {
    const workflowInputIds = new Set(input.workflow.inputSlots.map((slot) => slot.inputId));
    const missingInputIds = input.system.workflowBinding.requiredInputIds.filter((inputId) => !workflowInputIds.has(inputId));

    if (missingInputIds.length > 0) {
      return {
        outcome: ImageWorkflowCompatibilityOutcomes.incompatible,
        issues: missingInputIds.map((inputId) => ({
          code: "required-input-not-declared",
          path: `workflowBinding.requiredInputIds.${inputId}`,
          message: `Required input '${inputId}' is not declared by workflow definition.`,
          severity: ImageDefinitionValidationSeverities.error,
        })),
      };
    }

    return {
      outcome: ImageWorkflowCompatibilityOutcomes.compatible,
      issues: [],
    };
  }
}

class RepositoryBackedVersionResolutionService implements IImageWorkflowVersionResolutionService {
  public constructor(private readonly repository: IImageWorkflowDefinitionRepository) {}

  async resolveWorkflowDefinitionVersion(
    request: ImageWorkflowVersionResolutionRequest,
  ): Promise<ImageWorkflowVersionResolutionResult> {
    const workflow = await this.repository.resolveWorkflowDefinitionVersion({
      workspaceId: request.workspaceId,
      selector: request.selector,
    });

    if (!workflow) {
      return {
        resolved: false,
        reasonCode: "version-not-found",
      };
    }

    if (
      request.requireActivePublished
      && (
        workflow.lifecycleState !== ImageWorkflowLifecycleStates.published
        || workflow.activationStatus !== ImageWorkflowActivationStatuses.active
      )
    ) {
      return {
        resolved: false,
        reasonCode: "version-not-active-published",
      };
    }

    return {
      workflow,
      resolved: true,
      reasonCode: "resolved",
    };
  }
}

describe("image workflow/system definition application ports", () => {
  it("supports workflow create/read/list/version-resolution/archive and translation-reference lookup", async () => {
    const repository = new InMemoryImageDefinitionRepository();
    const v1 = createWorkflowDefinition({
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.inactive,
      visibility: "team",
    });
    const v2 = createWorkflowDefinition({
      workflowId: "workflow-alpha-v2",
      versionTag: "1.1.0",
      revision: 2,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.active,
      visibility: "team",
    });

    await repository.createWorkflowDefinition(v1, {
      operationKey: "wf-create-1",
      actorUserId: "user-owner",
    });
    await repository.createWorkflowDefinition(v2, {
      operationKey: "wf-create-2",
      actorUserId: "user-owner",
    });

    const listed = await repository.listWorkflowDefinitions({
      workspaceId: "workspace-alpha",
      visibilities: ["team"],
      activationStatuses: [ImageWorkflowActivationStatuses.active],
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.workflowId).toBe("workflow-alpha-v2");

    const resolved = await repository.resolveWorkflowDefinitionVersion({
      workspaceId: "workspace-alpha",
      selector: {
        strategy: ImageWorkflowVersionSelectionStrategies.activePublishedInLineage,
        lineageId: "workflow-lineage-alpha",
      },
    });
    expect(resolved?.workflowId).toBe("workflow-alpha-v2");

    const translationReference = await repository.getWorkflowBackendTranslationReference({
      workspaceId: "workspace-alpha",
      selector: {
        strategy: ImageWorkflowVersionSelectionStrategies.workflowId,
        workflowId: "workflow-alpha-v2",
      },
    });
    expect(translationReference?.translatorId).toBe("translator:image-to-image");

    const archived = await repository.archiveWorkflowDefinition("workflow-alpha-v2", {
      operationKey: "wf-archive-1",
      actorUserId: "user-owner",
    });
    expect(archived?.record.lifecycleState).toBe(ImageWorkflowLifecycleStates.retired);

    const hiddenRetired = await repository.findWorkflowDefinitionById("workflow-alpha-v2", {
      workspaceId: "workspace-alpha",
    });
    expect(hiddenRetired).toBeUndefined();

    const includedRetired = await repository.findWorkflowDefinitionById("workflow-alpha-v2", {
      workspaceId: "workspace-alpha",
      includeRetired: true,
    });
    expect(includedRetired?.lifecycleState).toBe(ImageWorkflowLifecycleStates.retired);
  });

  it("supports system create/read/list/archive with sharing/visibility filters and compatibility checks", async () => {
    const repository = new InMemoryImageDefinitionRepository();
    const workflow = createWorkflowDefinition({
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.active,
    });
    await repository.createWorkflowDefinition(workflow, {
      operationKey: "wf-create-1",
      actorUserId: "user-owner",
    });

    const system = createSystemDefinition(workflow);
    await repository.createSystemDefinition(system, {
      operationKey: "system-create-1",
      actorUserId: "user-owner",
    });

    const listed = await repository.listSystemDefinitions({
      workspaceId: "workspace-alpha",
      visibilities: ["team"],
      sharingPolicyIds: ["sharing-policy-alpha"],
      workflowLineageIds: ["workflow-lineage-alpha"],
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.systemId).toBe("system-alpha");

    const compatibilityService = new WorkflowSystemCompatibilityService();
    const compatibility = await compatibilityService.evaluateSystemWorkflowCompatibility({
      workspaceId: "workspace-alpha",
      workflow,
      system,
      mode: "strict",
    });
    expect(compatibility.outcome).toBe(ImageWorkflowCompatibilityOutcomes.compatible);

    const archived = await repository.archiveSystemDefinition("system-alpha", {
      operationKey: "system-archive-1",
      actorUserId: "user-owner",
    });
    expect(archived?.record.lifecycleState).toBe(ImageSystemLifecycleStates.archived);
    expect(archived?.record.runtimeStatus).toBe(ImageSystemRuntimeStatuses.disabled);
  });

  it("supports aggregate application port wiring for validation, authorization, and version resolution", async () => {
    const repository = new InMemoryImageDefinitionRepository();
    const workflow = createWorkflowDefinition({
      workflowId: "workflow-alpha-v1",
      versionTag: "1.0.0",
      revision: 1,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.active,
    });
    await repository.createWorkflowDefinition(workflow, {
      operationKey: "wf-create-1",
      actorUserId: "user-owner",
    });

    const ports: ImageWorkflowSystemDefinitionPorts = {
      workflowRepository: repository,
      systemRepository: repository,
      authorization: new AllowTeamVisibilityAuthorizationPort(),
      workflowValidation: new DomainBackedWorkflowValidationService(),
      systemValidation: new DomainBackedSystemValidationService(),
      compatibility: new WorkflowSystemCompatibilityService(),
      versionResolution: new RepositoryBackedVersionResolutionService(repository),
    };

    const authorization = await ports.authorization.authorizeImageWorkflowSystemAction({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      action: ImageWorkflowSystemPermissionActions.workflowRead,
      resource: {
        kind: ImageWorkflowSystemAuthorizationResourceKinds.workflowDefinition,
        resourceId: workflow.workflowId,
        ownerUserId: workflow.ownership.ownerUserId,
        visibility: workflow.ownership.visibility,
      },
    });
    expect(authorization.allowed).toBeTrue();

    const validation = await ports.workflowValidation.validateWorkflowDefinition({
      workspaceId: "workspace-alpha",
      workflow,
      mode: "publish",
    });
    expect(validation.valid).toBeTrue();

    const resolvedVersion = await ports.versionResolution.resolveWorkflowDefinitionVersion({
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      selector: {
        strategy: ImageWorkflowVersionSelectionStrategies.activePublishedInLineage,
        lineageId: workflow.version.lineageId,
      },
      requireActivePublished: true,
    });

    expect(resolvedVersion.resolved).toBeTrue();
    expect(resolvedVersion.workflow?.workflowId).toBe(workflow.workflowId);
  });
});
