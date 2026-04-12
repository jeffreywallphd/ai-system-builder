import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  createImageWorkflowDefinition,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  CreateImageWorkflowDefinitionUseCase,
  UpdateImageWorkflowDefinitionUseCase,
  type CreateImageWorkflowDefinitionRequest,
  type ImageWorkflowDefinitionAuthoringResult,
  type UpdateImageWorkflowDefinitionRequest,
} from "@application/image-workflows";
import {
  ImageDefinitionValidationSeverities,
  ImageWorkflowCompatibilityOutcomes,
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
} from "../ports";
import type { ImageSystemDefinition } from "@domain/systems/ImageSystemDomain";
import {
  ImageWorkflowDefinitionAuthoringError,
  ImageWorkflowDefinitionAuthoringErrorCodes,
} from "../ImageWorkflowDefinitionAuthoringErrors";

class InMemoryWorkflowRepository implements IImageWorkflowDefinitionRepository {
  private readonly workflows = new Map<string, ImageWorkflowDefinition>();
  public lastMutation?: ImageWorkflowSystemMutationContext;

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

  async resolveWorkflowDefinitionVersion(query: {
    readonly workspaceId: string;
    readonly selector: Parameters<IImageWorkflowDefinitionRepository["resolveWorkflowDefinitionVersion"]>[0]["selector"];
  }): Promise<ImageWorkflowDefinition | undefined> {
    const matches = [...this.workflows.values()]
      .filter((workflow) => workflow.ownership.workspaceId === query.workspaceId)
      .filter((workflow) => {
        switch (query.selector.strategy) {
          case ImageWorkflowVersionSelectionStrategies.workflowId:
            return workflow.workflowId === query.selector.workflowId;
          case ImageWorkflowVersionSelectionStrategies.lineageAndVersionTag:
            return workflow.version.lineageId === query.selector.lineageId
              && workflow.version.versionTag === query.selector.versionTag;
          case ImageWorkflowVersionSelectionStrategies.lineageAndRevision:
            return workflow.version.lineageId === query.selector.lineageId
              && workflow.version.revision === query.selector.revision;
          default:
            return false;
        }
      });

    return matches[0];
  }

  async listWorkflowDefinitions(
    query: Parameters<IImageWorkflowDefinitionRepository["listWorkflowDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
    if (query.workspaceId.trim() === "") {
      return [];
    }
    return [...this.workflows.values()];
  }

  async createWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    this.workflows.set(definition.workflowId, definition);
    this.lastMutation = mutation;
    return {
      changed: true,
      wasReplay: false,
      record: definition,
    };
  }

  async saveWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    const previous = this.workflows.get(definition.workflowId);
    this.workflows.set(definition.workflowId, definition);
    this.lastMutation = mutation;
    return {
      changed: JSON.stringify(previous) !== JSON.stringify(definition),
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

  async getWorkflowBackendTranslationReference(query: {
    readonly workspaceId: string;
    readonly selector: Parameters<IImageWorkflowDefinitionRepository["getWorkflowBackendTranslationReference"]>[0]["selector"];
  }) {
    return (await this.resolveWorkflowDefinitionVersion(query))?.backendTranslation;
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
      evaluatedAt: "2026-04-08T14:00:00.000Z",
    };
  }
}

class StaticWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  public constructor(private readonly result: ImageDefinitionValidationResult) {}

  async validateWorkflowDefinition(
    _input: Parameters<IImageWorkflowDefinitionValidationService["validateWorkflowDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return this.result;
  }
}

class StubSystemRepository implements IImageSystemDefinitionRepository {
  async findSystemDefinitionById(
    _systemId: string,
    _query: Parameters<IImageSystemDefinitionRepository["findSystemDefinitionById"]>[1],
  ): Promise<ImageSystemDefinition | undefined> { return undefined; }
  async listSystemDefinitions(
    _query: Parameters<IImageSystemDefinitionRepository["listSystemDefinitions"]>[0],
  ): Promise<ReadonlyArray<ImageSystemDefinition>> { return []; }
  async createSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    return { changed: true, wasReplay: false, record: definition };
  }
  async saveSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    return { changed: false, wasReplay: false, record: definition };
  }
  async archiveSystemDefinition(
    _systemId: string,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined> { return undefined; }
}

class StubSystemValidationService implements IImageSystemDefinitionValidationService {
  async validateSystemDefinition(
    _input: Parameters<IImageSystemDefinitionValidationService["validateSystemDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return {
      valid: true,
      evaluatedAt: "2026-04-08T14:00:00.000Z",
      issues: [],
    };
  }
}

class StubCompatibilityService implements IImageWorkflowSystemCompatibilityService {
  async evaluateSystemWorkflowCompatibility(
    _input: Parameters<IImageWorkflowSystemCompatibilityService["evaluateSystemWorkflowCompatibility"]>[0],
  ) {
    return {
      outcome: ImageWorkflowCompatibilityOutcomes.compatible,
      issues: [],
    };
  }
}

class StubVersionResolutionService implements IImageWorkflowVersionResolutionService {
  async resolveWorkflowDefinitionVersion(
    _request: Parameters<IImageWorkflowVersionResolutionService["resolveWorkflowDefinitionVersion"]>[0],
  ) {
    return {
      resolved: false,
      reasonCode: "not-used",
    };
  }
}

function buildCreateRequest(overrides?: Partial<CreateImageWorkflowDefinitionRequest>): CreateImageWorkflowDefinitionRequest {
  return {
    workspaceId: "workspace-alpha",
    actorUserId: "user-author",
    operationKey: "wf-create-op-1",
    occurredAt: "2026-04-08T14:00:00.000Z",
    workflow: {
      workflowId: "workflow-alpha-v1",
      operationKind: "image-to-image",
      ownership: {
        workspaceId: "workspace-alpha",
        ownerUserId: "user-author",
        visibility: "team",
      },
      display: {
        title: "Alpha workflow",
        tags: ["image", "alpha"],
      },
      version: {
        lineageId: "lineage-alpha",
        versionTag: "1.0.0",
        revision: 1,
      },
      lifecycleState: ImageWorkflowLifecycleStates.draft,
      activationStatus: ImageWorkflowActivationStatuses.inactive,
      inputSlots: [{
        inputId: "source",
        label: "Source image",
        kind: "source-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
        acceptedAssetKinds: ["image-asset"],
      }],
      inputBindings: [{
        bindingId: "input-source",
        inputId: "source",
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
        defaultValue: 0.5,
        sensitivity: "normal",
        validation: {
          minimum: 0,
          maximum: 1,
          step: 0.1,
        },
        ui: {
          control: "slider",
        },
      }],
      outputExpectations: [{
        outputId: "image",
        label: "Generated image",
        kind: "generated-image",
        valueType: "image-asset-reference",
        required: true,
        allowsMultiple: false,
      }],
      outputBindings: [{
        bindingId: "output-image",
        outputId: "image",
        targetType: "output-dataset",
        requiredTargetId: false,
      }],
      backendTranslation: {
        translatorId: "translator:image-v1",
        contractVersion: "1.0.0",
        templateId: "template:image-v1",
        inputBindings: [{ inputId: "source", backendField: "inputs.source" }],
        parameterBindings: [{ parameterId: "strength", backendField: "inputs.strength" }],
        outputBindings: [{ outputId: "image", backendField: "outputs.image" }],
      },
    },
    ...overrides,
  };
}

function buildPorts(input: {
  readonly repository: InMemoryWorkflowRepository;
  readonly authorizationAllowed?: boolean;
  readonly validationResult?: ImageDefinitionValidationResult;
}): ImageWorkflowSystemDefinitionPorts {
  return {
    workflowRepository: input.repository,
    systemRepository: new StubSystemRepository(),
    authorization: new AllowAuthorizationPort(input.authorizationAllowed ?? true),
    workflowValidation: new StaticWorkflowValidationService(input.validationResult ?? {
      valid: true,
      evaluatedAt: "2026-04-08T14:00:00.000Z",
      issues: [],
    }),
    systemValidation: new StubSystemValidationService(),
    compatibility: new StubCompatibilityService(),
    versionResolution: new StubVersionResolutionService(),
  };
}

async function seedWorkflow(repository: InMemoryWorkflowRepository): Promise<ImageWorkflowDefinition> {
  const workflow = createImageWorkflowDefinition({
    workflowId: "workflow-alpha-v1",
    operationKind: "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-author",
      visibility: "team",
    },
    display: {
      title: "Seeded workflow",
      tags: ["seeded"],
    },
    version: {
      lineageId: "lineage-alpha",
      versionTag: "1.0.0",
      revision: 1,
    },
    inputSlots: [{
      inputId: "source",
      label: "Source image",
      kind: "source-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
      acceptedAssetKinds: ["image-asset"],
    }],
    inputBindings: [{
      bindingId: "input-source",
      inputId: "source",
      sourceKind: "selected-image",
      sourceKey: "asset.primary",
      required: true,
    }],
    parameterSpecifications: [],
    outputExpectations: [{
      outputId: "image",
      label: "Generated image",
      kind: "generated-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
    }],
    outputBindings: [{
      bindingId: "output-image",
      outputId: "image",
      targetType: "output-dataset",
      requiredTargetId: false,
    }],
    backendTranslation: {
      translatorId: "translator:image-v1",
      contractVersion: "1.0.0",
      templateId: "template:image-v1",
      inputBindings: [{ inputId: "source", backendField: "inputs.source" }],
      parameterBindings: [],
      outputBindings: [{ outputId: "image", backendField: "outputs.image" }],
    },
    createdBy: "user-author",
    now: new Date("2026-04-08T14:00:00.000Z"),
  });

  await repository.createWorkflowDefinition(workflow, {
    operationKey: "seed-op",
    actorUserId: "user-author",
  });
  return workflow;
}

describe("image workflow definition authoring use cases", () => {
  it("creates a workflow definition with readiness and structure summaries", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    const result = await useCase.execute(buildCreateRequest());

    expect(result.workflow.workflowId).toBe("workflow-alpha-v1");
    expect(result.readiness.ready).toBeTrue();
    expect(result.readiness.classification).toBe("draft");
    expect(result.readiness.summary.length).toBeGreaterThan(0);
    expect(result.validation.valid).toBeTrue();
    expect(result.structure.inputSlots.total).toBe(1);
    expect(result.structure.parameters.required).toBe(1);
    expect(result.structure.backendTranslation.parameterBindings).toBe(1);
    expect(repository.lastMutation?.operationKey).toBe("wf-create-op-1");
  });

  it("rejects create when workspace scope does not match workflow ownership", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({ repository }));
    try {
      await useCase.execute(buildCreateRequest({
        workspaceId: "workspace-beta",
      }));
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest);
    }
  });

  it("rejects incomplete create payloads", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    const request = buildCreateRequest({
      workflow: {
        ...buildCreateRequest().workflow,
        outputBindings: [],
      },
    });

    try {
      await useCase.execute(request);
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.incomplete);
    }
  });

  it("rejects create requests outside the initial supported workflow operation set", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    try {
      await useCase.execute(buildCreateRequest({
        workflow: {
          ...buildCreateRequest().workflow,
          operationKind: "batch-transform",
        },
      }));
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.invalidRequest);
      expect(failure.message).toContain("initial supported workflow set");
    }
  });

  it("rejects unauthorized create requests", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({
      repository,
      authorizationAllowed: false,
    }));

    try {
      await useCase.execute(buildCreateRequest());
      throw new Error("expected create to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.unauthorized);
    }
  });

  it("updates a workflow definition and forwards expectedRevision in mutation context", async () => {
    const repository = new InMemoryWorkflowRepository();
    await seedWorkflow(repository);
    const useCase = new UpdateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    const request: UpdateImageWorkflowDefinitionRequest = {
      workspaceId: "workspace-alpha",
      actorUserId: "user-editor",
      workflowId: "workflow-alpha-v1",
      operationKey: "wf-update-op-1",
      expectedRevision: 4,
      occurredAt: "2026-04-08T15:00:00.000Z",
      changes: {
        display: {
          title: "Updated seeded workflow",
          summary: "Updated summary",
          tags: ["updated"],
        },
        lifecycleState: ImageWorkflowLifecycleStates.review,
      },
    };

    const result = await useCase.execute(request);

    expect(result.workflow.display.title).toBe("Updated seeded workflow");
    expect(result.workflow.lifecycleState).toBe(ImageWorkflowLifecycleStates.review);
    expect(result.workflow.lastModifiedBy).toBe("user-editor");
    expect(repository.lastMutation?.expectedRevision).toBe(4);
  });

  it("rejects forbidden lifecycle transitions during update", async () => {
    const repository = new InMemoryWorkflowRepository();
    const seeded = await seedWorkflow(repository);
    await repository.saveWorkflowDefinition({
      ...seeded,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      updatedAt: "2026-04-08T15:00:00.000Z",
    }, {
      operationKey: "seed-published",
      actorUserId: "user-author",
    });

    const useCase = new UpdateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-editor",
        workflowId: "workflow-alpha-v1",
        changes: {
          lifecycleState: ImageWorkflowLifecycleStates.draft,
        },
      });
      throw new Error("expected update to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.lifecycleTransitionDenied);
    }
  });

  it("rejects updates when validation reports errors", async () => {
    const repository = new InMemoryWorkflowRepository();
    await seedWorkflow(repository);
    const useCase = new UpdateImageWorkflowDefinitionUseCase(buildPorts({
      repository,
      validationResult: {
        valid: false,
        evaluatedAt: "2026-04-08T16:00:00.000Z",
        issues: [{
          code: "missing-slot-contract",
          path: "inputSlots",
          message: "Input slot contract is invalid.",
          severity: ImageDefinitionValidationSeverities.error,
        }],
      },
    }));

    try {
      await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserId: "user-editor",
        workflowId: "workflow-alpha-v1",
        changes: {
          display: {
            title: "Updated title",
            tags: ["updated"],
          },
        },
      });
      throw new Error("expected update to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageWorkflowDefinitionAuthoringError);
      const failure = error as ImageWorkflowDefinitionAuthoringError;
      expect(failure.code).toBe(ImageWorkflowDefinitionAuthoringErrorCodes.validationFailed);
    }
  });

  it("has a stable authoring result shape suitable for controller mapping", async () => {
    const repository = new InMemoryWorkflowRepository();
    const useCase = new CreateImageWorkflowDefinitionUseCase(buildPorts({ repository }));

    const result: ImageWorkflowDefinitionAuthoringResult = await useCase.execute(buildCreateRequest());

    expect(typeof result.mutation.operationKey).toBe("string");
    expect(typeof result.workflow.workflowId).toBe("string");
    expect(typeof result.readiness.state).toBe("string");
    expect(typeof result.structure.backendTranslation.templateId).toBe("string");
  });
});
