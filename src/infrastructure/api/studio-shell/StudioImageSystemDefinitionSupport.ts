import {
  CreateImageSystemDefinitionUseCase,
  GetImageSystemDefinitionUseCase,
  ListImageSystemDefinitionsUseCase,
  UpdateImageSystemDefinitionUseCase,
  type CreateImageSystemDefinitionRequest,
  type GetImageSystemDefinitionRequest,
  type IImageSystemDefinitionRepository,
  type IImageSystemDefinitionValidationService,
  type IImageWorkflowDefinitionRepository,
  type IImageWorkflowDefinitionValidationService,
  type IImageWorkflowSystemAuthorizationPort,
  type IImageWorkflowSystemCompatibilityService,
  type IImageWorkflowVersionResolutionService,
  type ImageDefinitionValidationResult,
  type ImageSystemDefinitionAuthoringResult,
  type ImageSystemDefinitionDetailResult,
  type ImageSystemDefinitionListQuery,
  type ImageWorkflowDefinitionListQuery,
  type ImageWorkflowSystemAuthorizationDecision,
  type ImageWorkflowSystemAuthorizationRequest,
  type ImageWorkflowSystemDefinitionPorts,
  type ImageWorkflowSystemMutationContext,
  type ImageWorkflowSystemMutationResult,
  type ImageWorkflowVersionResolutionResult,
  type ListImageSystemDefinitionsRequest,
  type ListImageSystemDefinitionsResult,
  type UpdateImageSystemDefinitionRequest,
} from "@application/image-workflows";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  createImageWorkflowDefinition,
  type ImageWorkflowBackendTranslationReference,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageWorkflowParameterUiControlKinds,
  ImageWorkflowParameterSensitivityLevels,
  normalizeImageWorkflowParameterSpecification,
  type ImageWorkflowParameterSpecification,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";
import {
  rehydrateImageSystemDefinition,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import {
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialImageWorkflowTemplateDefinition,
} from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";

class TemplateBackedImageWorkflowDefinitionRepository implements IImageWorkflowDefinitionRepository {
  private readonly byWorkflowId = new Map<string, ImageWorkflowDefinition>();

  public constructor(templates: ReadonlyArray<InitialImageWorkflowTemplateDefinition>) {
    for (const template of templates) {
      const workflow = toWorkflowDefinition(template);
      this.byWorkflowId.set(workflow.workflowId, workflow);
    }
  }

  public async findWorkflowDefinitionById(
    workflowId: string,
    query: { readonly workspaceId: string; readonly includeRetired?: boolean },
  ): Promise<ImageWorkflowDefinition | undefined> {
    const workflow = this.byWorkflowId.get(workflowId.trim());
    if (!workflow || workflow.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    if (!query.includeRetired && workflow.lifecycleState === ImageWorkflowLifecycleStates.retired) {
      return undefined;
    }
    return workflow;
  }

  public async resolveWorkflowDefinitionVersion(
    query: { readonly workspaceId: string; readonly selector: Parameters<IImageWorkflowDefinitionRepository["resolveWorkflowDefinitionVersion"]>[0]["selector"] },
  ): Promise<ImageWorkflowDefinition | undefined> {
    if (query.selector.strategy === "workflow-id") {
      return this.findWorkflowDefinitionById(query.selector.workflowId ?? "", {
        workspaceId: query.workspaceId,
      });
    }
    return undefined;
  }

  public async listWorkflowDefinitions(
    query: ImageWorkflowDefinitionListQuery,
  ): Promise<ReadonlyArray<ImageWorkflowDefinition>> {
    const values = [...this.byWorkflowId.values()].filter((entry) => entry.ownership.workspaceId === query.workspaceId);
    return Object.freeze(values);
  }

  public async createWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    this.byWorkflowId.set(definition.workflowId, definition);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: definition,
    });
  }

  public async saveWorkflowDefinition(
    definition: ImageWorkflowDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition>> {
    this.byWorkflowId.set(definition.workflowId, definition);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: definition,
    });
  }

  public async archiveWorkflowDefinition(
    _workflowId: string,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageWorkflowDefinition> | undefined> {
    return undefined;
  }

  public async getWorkflowBackendTranslationReference(
    query: { readonly workspaceId: string; readonly selector: Parameters<IImageWorkflowDefinitionRepository["resolveWorkflowDefinitionVersion"]>[0]["selector"] },
  ): Promise<ImageWorkflowBackendTranslationReference | undefined> {
    const workflow = await this.resolveWorkflowDefinitionVersion(query);
    return workflow?.backendTranslation;
  }
}

class InMemoryImageSystemDefinitionRepository implements IImageSystemDefinitionRepository {
  private readonly bySystemId = new Map<string, ImageSystemDefinition>();

  public async findSystemDefinitionById(
    systemId: string,
    query: { readonly workspaceId: string; readonly includeArchived?: boolean },
  ): Promise<ImageSystemDefinition | undefined> {
    const system = this.bySystemId.get(systemId.trim());
    if (!system || system.ownership.workspaceId !== query.workspaceId) {
      return undefined;
    }
    if (!query.includeArchived && system.lifecycleState === "archived") {
      return undefined;
    }
    return system;
  }

  public async listSystemDefinitions(query: ImageSystemDefinitionListQuery): Promise<ReadonlyArray<ImageSystemDefinition>> {
    const rows = [...this.bySystemId.values()].filter((entry) => entry.ownership.workspaceId === query.workspaceId);
    return Object.freeze(rows);
  }

  public async createSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    this.bySystemId.set(definition.systemId, definition);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: definition,
    });
  }

  public async saveSystemDefinition(
    definition: ImageSystemDefinition,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition>> {
    const previous = this.bySystemId.get(definition.systemId);
    this.bySystemId.set(definition.systemId, definition);
    return Object.freeze({
      changed: JSON.stringify(previous) !== JSON.stringify(definition),
      wasReplay: false,
      record: definition,
    });
  }

  public async archiveSystemDefinition(
    _systemId: string,
    _mutation: ImageWorkflowSystemMutationContext,
  ): Promise<ImageWorkflowSystemMutationResult<ImageSystemDefinition> | undefined> {
    return undefined;
  }
}

class AllowAllAuthorizationPort implements IImageWorkflowSystemAuthorizationPort {
  public async authorizeImageWorkflowSystemAction(
    _request: ImageWorkflowSystemAuthorizationRequest,
  ): Promise<ImageWorkflowSystemAuthorizationDecision> {
    return Object.freeze({
      allowed: true,
      reasonCode: "allowed",
      evaluatedAt: new Date().toISOString(),
    });
  }
}

class NoopWorkflowValidationService implements IImageWorkflowDefinitionValidationService {
  public async validateWorkflowDefinition(
    _input: Parameters<IImageWorkflowDefinitionValidationService["validateWorkflowDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return Object.freeze({
      valid: true,
      evaluatedAt: new Date().toISOString(),
      issues: Object.freeze([]),
    });
  }
}

class NoopSystemValidationService implements IImageSystemDefinitionValidationService {
  public async validateSystemDefinition(
    _input: Parameters<IImageSystemDefinitionValidationService["validateSystemDefinition"]>[0],
  ): Promise<ImageDefinitionValidationResult> {
    return Object.freeze({
      valid: true,
      evaluatedAt: new Date().toISOString(),
      issues: Object.freeze([]),
    });
  }
}

class NoopCompatibilityService implements IImageWorkflowSystemCompatibilityService {
  public async evaluateSystemWorkflowCompatibility(
    _input: Parameters<IImageWorkflowSystemCompatibilityService["evaluateSystemWorkflowCompatibility"]>[0],
  ) {
    return Object.freeze({
      outcome: "compatible" as const,
      issues: Object.freeze([]),
    });
  }
}

class NoopVersionResolutionService implements IImageWorkflowVersionResolutionService {
  public async resolveWorkflowDefinitionVersion(
    _request: Parameters<IImageWorkflowVersionResolutionService["resolveWorkflowDefinitionVersion"]>[0],
  ): Promise<ImageWorkflowVersionResolutionResult> {
    return Object.freeze({
      resolved: false,
      reasonCode: "not-required",
    });
  }
}

export interface StudioImageSystemDefinitionUseCases {
  readonly createSystemDefinition: CreateImageSystemDefinitionUseCase;
  readonly updateSystemDefinition: UpdateImageSystemDefinitionUseCase;
  readonly getSystemDefinition: GetImageSystemDefinitionUseCase;
  readonly listSystemDefinitions: ListImageSystemDefinitionsUseCase;
}

export interface CreateStudioImageSystemDefinitionUseCasesOptions {
  readonly workflowRepository?: IImageWorkflowDefinitionRepository;
  readonly systemRepository?: IImageSystemDefinitionRepository;
}

export function createStudioImageSystemDefinitionUseCases(
  options: CreateStudioImageSystemDefinitionUseCasesOptions = {},
): StudioImageSystemDefinitionUseCases {
  const templateRegistry = createInitialSupportedImageWorkflowTemplateRegistry();
  const ports: ImageWorkflowSystemDefinitionPorts = Object.freeze({
    workflowRepository: options.workflowRepository ?? new TemplateBackedImageWorkflowDefinitionRepository(templateRegistry.list()),
    systemRepository: options.systemRepository ?? new InMemoryImageSystemDefinitionRepository(),
    authorization: new AllowAllAuthorizationPort(),
    workflowValidation: new NoopWorkflowValidationService(),
    systemValidation: new NoopSystemValidationService(),
    compatibility: new NoopCompatibilityService(),
    versionResolution: new NoopVersionResolutionService(),
  });

  return Object.freeze({
    createSystemDefinition: new CreateImageSystemDefinitionUseCase(ports),
    updateSystemDefinition: new UpdateImageSystemDefinitionUseCase(ports),
    getSystemDefinition: new GetImageSystemDefinitionUseCase(ports),
    listSystemDefinitions: new ListImageSystemDefinitionsUseCase(ports),
  });
}

export function resolveStudioTemplateWorkflowDefinitionById(
  workflowId: string,
  workspaceId: string = "workspace:studio-shell",
): ImageWorkflowDefinition | undefined {
  const templateRegistry = createInitialSupportedImageWorkflowTemplateRegistry();
  const template = templateRegistry.getByTemplateFamilyId(workflowId as never);
  if (!template) {
    return undefined;
  }
  const workflow = toWorkflowDefinition(template);
  if (workflow.ownership.workspaceId !== workspaceId) {
    return undefined;
  }
  return workflow;
}

function toWorkflowDefinition(template: InitialImageWorkflowTemplateDefinition): ImageWorkflowDefinition {
  const versionTag = template.templateFamilyId.split(":").at(-1) ?? "1.0.0";
  const normalizedVersionTag = /\d+\.\d+\.\d+/.test(versionTag) ? versionTag : "1.0.0";
  const workflowId = template.templateFamilyId;

  const parameterGuidanceById = new Map(template.configuration.parameterGuidance.map((entry) => [entry.parameterId, entry] as const));
  const parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification> = Object.freeze(
    template.minimumRequirements.parameterSpecifications.map((parameter, index) => {
      const guidance = parameterGuidanceById.get(parameter.parameterId);
      const isNumeric = parameter.valueKind === "integer" || parameter.valueKind === "float";
      const control = parameter.valueKind === "boolean"
        ? ImageWorkflowParameterUiControlKinds.switch
        : parameter.valueKind === "text"
          ? parameter.semanticMeaning === "prompt"
            ? ImageWorkflowParameterUiControlKinds.textArea
            : ImageWorkflowParameterUiControlKinds.textInput
          : parameter.valueKind === "integer" || parameter.valueKind === "float"
            ? guidance?.recommendedRange?.minimum !== undefined || guidance?.recommendedRange?.maximum !== undefined
              ? ImageWorkflowParameterUiControlKinds.slider
              : ImageWorkflowParameterUiControlKinds.numberInput
            : parameter.valueKind === "select"
              ? ImageWorkflowParameterUiControlKinds.select
              : parameter.valueKind === "mask-asset-reference"
                ? ImageWorkflowParameterUiControlKinds.maskSlot
                : parameter.valueKind === "reference-asset-reference"
                  ? ImageWorkflowParameterUiControlKinds.referenceSlot
                  : ImageWorkflowParameterUiControlKinds.assetPicker;
      return normalizeImageWorkflowParameterSpecification({
        parameterId: parameter.parameterId,
        label: guidance?.label ?? parameter.parameterId,
        description: guidance?.helperText,
        valueKind: parameter.valueKind,
        semanticMeaning: parameter.semanticMeaning,
        required: parameter.required,
        defaultValue: template.configuration.defaults.parameterValues[parameter.parameterId],
        sensitivity: ImageWorkflowParameterSensitivityLevels.normal,
        validation: {
          minimum: isNumeric ? guidance?.guardrails?.minimum ?? guidance?.recommendedRange?.minimum : undefined,
          maximum: isNumeric ? guidance?.guardrails?.maximum ?? guidance?.recommendedRange?.maximum : undefined,
          step: isNumeric ? guidance?.recommendedRange?.step : undefined,
          minLength: parameter.valueKind === "text"
            ? guidance?.guardrails?.minLength ?? guidance?.recommendedRange?.minLength
            : undefined,
          maxLength: parameter.valueKind === "text"
            ? guidance?.guardrails?.maxLength ?? guidance?.recommendedRange?.maxLength
            : undefined,
        },
        ui: {
          control,
          order: index,
          helpText: guidance?.helperText,
        },
      });
    }),
  );

  return createImageWorkflowDefinition({
    workflowId,
    operationKind: template.operationKind,
    ownership: {
      workspaceId: "workspace:studio-shell",
      ownerUserId: "user:studio-shell",
      visibility: "team",
    },
    display: {
      title: template.display.title,
      summary: template.display.summary,
      tags: Object.freeze(["image", "template", template.operationKind]),
    },
    version: {
      lineageId: template.templateFamilyId.replace(/:v\d+$/i, ""),
      versionTag: normalizedVersionTag,
      revision: 1,
    },
    lifecycleState: ImageWorkflowLifecycleStates.published,
    activationStatus: ImageWorkflowActivationStatuses.active,
    inputSlots: template.minimumRequirements.inputSlots.map((entry) => Object.freeze({
      inputId: entry.inputId,
      label: entry.inputId,
      kind: entry.kind,
      valueType: entry.valueType,
      required: entry.required,
      allowsMultiple: entry.allowsMultiple,
      acceptedAssetKinds: entry.valueType.includes("image") ? Object.freeze(["image-asset"]) : Object.freeze([]),
    })),
    inputBindings: template.translation.inputMappings.map((entry) => Object.freeze({
      bindingId: `input:${entry.inputId}`,
      inputId: entry.inputId,
      sourceKind: "selected-image",
      sourceKey: entry.translationKey,
      required: entry.required,
    })),
    parameterSpecifications,
    outputExpectations: template.minimumRequirements.outputExpectations.map((entry) => Object.freeze({
      outputId: entry.outputId,
      label: entry.outputId,
      kind: entry.kind,
      valueType: entry.valueType,
      required: entry.required,
      allowsMultiple: entry.allowsMultiple,
    })),
    outputBindings: template.translation.outputMappings.map((entry) => Object.freeze({
      bindingId: `output:${entry.outputId}`,
      outputId: entry.outputId,
      targetType: "output-dataset",
      requiredTargetId: false,
    })),
    backendTranslation: Object.freeze({
      translatorId: template.translation.adapterFamily,
      contractVersion: "1.0.0",
      templateId: template.templateFamilyId,
      inputBindings: template.translation.inputMappings.map((entry) => Object.freeze({
        inputId: entry.inputId,
        backendField: entry.translationKey,
      })),
      parameterBindings: template.translation.parameterMappings.map((entry) => Object.freeze({
        parameterId: entry.parameterId,
        backendField: entry.translationKey,
      })),
      outputBindings: template.translation.outputMappings.map((entry) => Object.freeze({
        outputId: entry.outputId,
        backendField: entry.translationKey,
      })),
    }),
    createdBy: "user:studio-shell",
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
}

export function toSystemIdFromDraft(studioId: string, draftId: string, now: Date): string {
  return `image-system:${studioId.trim()}:${draftId.trim()}:${now.getTime()}`;
}

export function toSystemUpsertRequest(input: {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly systemId: string;
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly workflow: ImageWorkflowDefinition;
  readonly workflowParameterValues: Readonly<Record<string, unknown>>;
  readonly datasetInstanceId?: string;
  readonly operationKey: string;
  readonly occurredAt: string;
}): CreateImageSystemDefinitionRequest {
  const requiredOutputIds = input.workflow.outputExpectations
    .filter((entry) => entry.required)
    .map((entry) => entry.outputId);
  const outputTargetBindings = input.datasetInstanceId
    ? requiredOutputIds.map((outputId) => Object.freeze({
      outputId,
      targetReference: `dataset-instance://${input.datasetInstanceId}`,
    }))
    : [];

  return Object.freeze({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    operationKey: input.operationKey,
    occurredAt: input.occurredAt,
    system: Object.freeze({
      systemId: input.systemId,
      ownership: Object.freeze({
        workspaceId: input.workspaceId,
        ownerUserId: input.actorUserId,
        visibility: "team",
      }),
      display: Object.freeze({
        title: input.title,
        summary: input.summary,
        tags: Object.freeze(input.tags && input.tags.length > 0 ? [...new Set(input.tags)] : ["image", "system"]),
      }),
      workflowBinding: Object.freeze({
        workflowId: input.workflow.workflowId,
        workflowWorkspaceId: input.workflow.ownership.workspaceId,
        workflowLineageId: input.workflow.version.lineageId,
        workflowVersionTag: input.workflow.version.versionTag,
        workflowRevision: input.workflow.version.revision,
        requiredInputIds: Object.freeze(input.workflow.inputSlots.filter((entry) => entry.required).map((entry) => entry.inputId)),
        requiredParameterIds: Object.freeze(input.workflow.parameterSpecifications.filter((entry) => entry.required).map((entry) => entry.parameterId)),
        requiredOutputIds: Object.freeze(requiredOutputIds),
      }),
      inputAssetSelections: Object.freeze([]),
      outputTargetBindings: Object.freeze(outputTargetBindings),
      parameterBaseline: Object.freeze({
        values: Object.freeze({ ...input.workflowParameterValues }),
        profileReferences: Object.freeze([]),
      }),
      lifecycleState: "draft",
      runtimeStatus: "disabled",
    }),
  });
}

export function toSystemUpdateRequest(input: {
  readonly existing: ImageSystemDefinition;
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly operationKey: string;
  readonly createRequest: CreateImageSystemDefinitionRequest;
}): UpdateImageSystemDefinitionRequest {
  return Object.freeze({
    workspaceId: input.createRequest.workspaceId,
    actorUserId: input.actorUserId,
    systemId: input.existing.systemId,
    operationKey: input.operationKey,
    occurredAt: input.occurredAt,
    changes: Object.freeze({
      display: input.createRequest.system.display,
      workflowBinding: input.createRequest.system.workflowBinding,
      inputAssetSelections: input.createRequest.system.inputAssetSelections,
      outputTargetBindings: input.createRequest.system.outputTargetBindings,
      parameterBaseline: input.createRequest.system.parameterBaseline,
      lifecycleState: "draft",
      runtimeStatus: "disabled",
    }),
  });
}

export function toSystemDetailOrUndefined(result: ImageSystemDefinitionAuthoringResult | ImageSystemDefinitionDetailResult): ImageSystemDefinition {
  if ("system" in result) {
    return result.system;
  }
  return rehydrateImageSystemDefinition(result.system);
}

export type {
  ListImageSystemDefinitionsRequest,
  ListImageSystemDefinitionsResult,
  GetImageSystemDefinitionRequest,
  ImageSystemDefinitionDetailResult,
};
