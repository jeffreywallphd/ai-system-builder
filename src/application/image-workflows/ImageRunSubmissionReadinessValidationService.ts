import type { IAssetRepository } from "@application/assets/ports/IAssetRepository";
import {
  AuthorizationPolicyEvaluationTargetKinds,
  type AuthorizationActorReference,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { GetImageManipulationExecutionReadinessUseCase } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import {
  ImageManipulationExecutionReadinessStates,
} from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  evaluateImageSystemReadiness,
  isImageSystemRunnable,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  evaluateImageWorkflowDefinitionCompleteness,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  AuthorizationResourceFamilies,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  ImageSystemParameterValueSources,
  validateImageSystemParameterSetContract,
} from "@shared/contracts/image-workflows/ImageWorkflowParameterContracts";
import {
  ImageRunSubmissionBackendAdapterHealthStates,
  ImageRunSubmissionReadinessIssueCategories,
  buildImageRunSubmissionReadinessResult,
  type ImageRunSubmissionReadinessIssue,
  type ImageRunSubmissionReadinessPolicyDenial,
  type ImageRunSubmissionReadinessResult,
} from "./ImageRunSubmissionReadinessContracts";
import {
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialSupportedImageWorkflowTemplateRegistry,
} from "./InitialSupportedImageWorkflowTemplateRegistry";
import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
  type ImageManipulationFailureSummaryCategory,
  type ImageManipulationIssueClassification,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import {
  deriveImageManipulationRetryRecoveryContractFromClassification,
  type ImageManipulationRetryRecoveryContract,
} from "@shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts";
import { ImageWorkflowSystemReadinessValidationService } from "./ImageWorkflowSystemReadinessValidationService";
import type {
  IImageRunReadinessResolver,
} from "./ports";
import type {
  IImageSystemDefinitionRepository,
  IImageWorkflowDefinitionRepository,
} from "./ports/ImageWorkflowSystemDefinitionPorts";

export interface ImageRunSubmissionReadinessValidationServiceDependencies {
  readonly workflowRepository: Pick<IImageWorkflowDefinitionRepository, "findWorkflowDefinitionById">;
  readonly systemRepository: Pick<IImageSystemDefinitionRepository, "findSystemDefinitionById">;
  readonly assetRepository?: Pick<IAssetRepository, "findAssetById">;
  readonly authorizationDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly executionReadinessUseCase?: Pick<GetImageManipulationExecutionReadinessUseCase, "execute">;
  readonly workflowSystemReadinessValidationService?: Pick<ImageWorkflowSystemReadinessValidationService, "evaluateSystemBindingCompatibility">;
  readonly supportedTemplateRegistry?: Pick<
    InitialSupportedImageWorkflowTemplateRegistry,
    "getByOperationKind" | "isOperationSupported"
  >;
  readonly now?: () => Date;
}

const ResourceTypes = Object.freeze({
  assetRecord: "asset-record",
});

export class ImageRunSubmissionReadinessValidationService implements Pick<IImageRunReadinessResolver, "resolveRunSubmissionReadiness"> {
  private readonly now: () => Date;

  private readonly workflowSystemReadinessValidationService: Pick<ImageWorkflowSystemReadinessValidationService, "evaluateSystemBindingCompatibility">;
  private readonly supportedTemplateRegistry: Pick<InitialSupportedImageWorkflowTemplateRegistry, "getByOperationKind" | "isOperationSupported">;

  public constructor(private readonly dependencies: ImageRunSubmissionReadinessValidationServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.workflowSystemReadinessValidationService = dependencies.workflowSystemReadinessValidationService
      ?? new ImageWorkflowSystemReadinessValidationService();
    this.supportedTemplateRegistry = dependencies.supportedTemplateRegistry
      ?? createInitialSupportedImageWorkflowTemplateRegistry();
  }

  public async resolveRunSubmissionReadiness(
    input: Parameters<NonNullable<IImageRunReadinessResolver["resolveRunSubmissionReadiness"]>>[0],
  ): Promise<ImageRunSubmissionReadinessResult> {
    const checkedAt = normalizeOptionalString(input.occurredAt) ?? this.now().toISOString();
    const workspaceId = input.workspaceId.trim();
    const systemId = input.systemId.trim();
    const explicitWorkflowId = normalizeOptionalString(input.workflowId);
    const operationKind = normalizeOptionalString(input.operationKind);
    const translationContractVersion = normalizeOptionalString(input.translationContractVersion);
    const actor = Object.freeze({
      actorUserIdentityId: normalizeOptionalString(input.actorUserIdentityId),
      actorServiceId: normalizeOptionalString(input.actorServiceId),
      activeWorkspaceId: workspaceId,
    });

    const issues: ImageRunSubmissionReadinessIssue[] = [];
    const policyDenials: ImageRunSubmissionReadinessPolicyDenial[] = [];
    const workflowIssues: ImageRunSubmissionReadinessIssue[] = [];
    const systemIssues: ImageRunSubmissionReadinessIssue[] = [];
    const compatibilityIssues: ImageRunSubmissionReadinessIssue[] = [];

    const system = await this.dependencies.systemRepository.findSystemDefinitionById(systemId, {
      workspaceId,
      includeArchived: false,
    });

    if (!system) {
      const issue = this.blockingIssue({
        code: "submission-system-not-found",
        summary: `Image system '${systemId}' was not found in workspace '${workspaceId}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "submission.runtimeTarget.systemId",
      });
      systemIssues.push(issue);
      issues.push(issue);
    }

    let workflow: ImageWorkflowDefinition | undefined;
    const workflowId = explicitWorkflowId
      ?? normalizeOptionalString(system?.workflowBinding.workflowId);
    if (!workflowId) {
      const issue = this.blockingIssue({
        code: "submission-workflow-not-resolved",
        summary: "Workflow context is required to evaluate submission readiness.",
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "submission.workflowId",
      });
      workflowIssues.push(issue);
      issues.push(issue);
    } else {
      workflow = await this.dependencies.workflowRepository.findWorkflowDefinitionById(workflowId, {
        workspaceId,
        includeRetired: false,
      });
      if (!workflow) {
        const issue = this.blockingIssue({
          code: "submission-workflow-not-found",
          summary: `Image workflow '${workflowId}' was not found in workspace '${workspaceId}'.`,
          category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
          path: "submission.workflowId",
        });
        workflowIssues.push(issue);
        issues.push(issue);
      }
    }

    const assetBindingIssues = await this.evaluateAssetBindingReadiness({
      input,
      actor,
      system,
      workflow,
    });
    issues.push(...assetBindingIssues.issues);
    policyDenials.push(...assetBindingIssues.policyDenials);

    if (system) {
      for (const issue of this.evaluateSystemValidity(system)) {
        systemIssues.push(issue);
        issues.push(issue);
      }
    }

    if (workflow) {
      for (const issue of this.evaluateWorkflowValidity({
        workflow,
        operationKind,
        translationContractVersion,
      })) {
        workflowIssues.push(issue);
        issues.push(issue);
      }
    }

    if (system && workflow) {
      for (const issue of this.evaluateWorkflowSystemCompatibility({ system, workflow })) {
        compatibilityIssues.push(issue);
        issues.push(issue);
      }
    }

    if (workflow) {
      for (const issue of this.evaluateSubmissionParameterValidity({
        workflow,
        system,
        submissionParameters: input.parameters ?? {},
      })) {
        workflowIssues.push(issue);
        issues.push(issue);
      }
    }

    const backendReadinessDependency = await this.evaluateBackendReadiness({
      workspaceId,
      systemId,
      workflow,
      operationKind,
      translationContractVersion,
    });
    issues.push(...backendReadinessDependency.issues);

    return buildImageRunSubmissionReadinessResult({
      checkedAt,
      issues: Object.freeze(issues),
      policyDenials: Object.freeze(policyDenials),
      assetBinding: Object.freeze({
        complete: assetBindingIssues.missingInputBindingIds.length === 0
          && assetBindingIssues.missingOutputBindingIds.length === 0
          && assetBindingIssues.unresolvedAssetReferences.length === 0,
        missingInputBindingIds: Object.freeze(assetBindingIssues.missingInputBindingIds),
        missingOutputBindingIds: Object.freeze(assetBindingIssues.missingOutputBindingIds),
        unresolvedAssetReferences: Object.freeze(assetBindingIssues.unresolvedAssetReferences),
      }),
      workflowValidity: Object.freeze({
        valid: workflowIssues.length === 0,
        issues: Object.freeze(workflowIssues),
      }),
      systemValidity: Object.freeze({
        valid: systemIssues.length === 0,
        issues: Object.freeze(systemIssues),
      }),
      backendReadinessDependency: Object.freeze(backendReadinessDependency),
      compatibility: Object.freeze({
        compatible: compatibilityIssues.length === 0,
        issues: Object.freeze(compatibilityIssues),
      }),
    });
  }

  private evaluateSystemValidity(system: ImageSystemDefinition): ReadonlyArray<ImageRunSubmissionReadinessIssue> {
    const issues: ImageRunSubmissionReadinessIssue[] = [];

    if (system.lifecycleState !== ImageSystemLifecycleStates.ready) {
      issues.push(this.blockingIssue({
        code: "submission-system-not-ready",
        summary: `Image system '${system.systemId}' must be in ready lifecycle state.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "submission.runtimeTarget.systemId",
      }));
    }
    if (system.runtimeStatus !== ImageSystemRuntimeStatuses.enabled) {
      issues.push(this.blockingIssue({
        code: "submission-system-runtime-disabled",
        summary: `Image system '${system.systemId}' is runtime-disabled.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "submission.runtimeTarget.systemId",
      }));
    }

    if (system.workflowBinding.workflowWorkspaceId !== system.ownership.workspaceId) {
      issues.push(this.blockingIssue({
        code: "submission-system-workflow-workspace-mismatch",
        summary:
          `Image system '${system.systemId}' has workflow binding workspace '${system.workflowBinding.workflowWorkspaceId}' outside system workspace '${system.ownership.workspaceId}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "system.workflowBinding.workflowWorkspaceId",
      }));
    }

    if (
      system.lifecycleState === ImageSystemLifecycleStates.archived
      || (system.runtimeStatus === ImageSystemRuntimeStatuses.enabled && system.lifecycleState !== ImageSystemLifecycleStates.ready)
    ) {
      issues.push(this.blockingIssue({
        code: "submission-system-unsupported-state",
        summary:
          `Image system '${system.systemId}' is in unsupported lifecycle/runtime state combination '${system.lifecycleState}/${system.runtimeStatus}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "submission.runtimeTarget.systemId",
      }));
    }

    for (const readinessIssue of evaluateImageSystemReadiness(system)) {
      issues.push(this.blockingIssue({
        code: readinessIssue.code,
        summary: readinessIssue.message,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: `system.${readinessIssue.path}`,
      }));
    }

    if (!isImageSystemRunnable(system)) {
      issues.push(this.blockingIssue({
        code: "submission-system-not-runnable",
        summary: `Image system '${system.systemId}' is not runnable for queue admission.`,
        category: ImageRunSubmissionReadinessIssueCategories.systemValidity,
        path: "submission.runtimeTarget.systemId",
      }));
    }

    return Object.freeze(issues);
  }

  private evaluateWorkflowValidity(input: {
    readonly workflow: ImageWorkflowDefinition;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): ReadonlyArray<ImageRunSubmissionReadinessIssue> {
    const issues: ImageRunSubmissionReadinessIssue[] = [];
    const workflow = input.workflow;

    if (workflow.lifecycleState !== ImageWorkflowLifecycleStates.published) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-not-published",
        summary: `Image workflow '${workflow.workflowId}' must be published before submission.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "submission.workflowId",
      }));
    }
    if (workflow.activationStatus !== ImageWorkflowActivationStatuses.active) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-inactive",
        summary: `Image workflow '${workflow.workflowId}' is not active.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "submission.workflowId",
      }));
    }

    for (const completenessIssue of evaluateImageWorkflowDefinitionCompleteness(workflow)) {
      issues.push(this.blockingIssue({
        code: completenessIssue.code,
        summary: completenessIssue.message,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: `workflow.${completenessIssue.path}`,
      }));
    }

    if (input.operationKind && workflow.operationKind !== input.operationKind) {
      issues.push(this.blockingIssue({
        code: "submission-operation-kind-mismatch",
        summary: `Requested operation '${input.operationKind}' does not match workflow operation '${workflow.operationKind}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "submission.readiness.operationKind",
      }));
    }

    if (
      input.translationContractVersion
      && workflow.backendTranslation.contractVersion !== input.translationContractVersion
    ) {
      issues.push(this.blockingIssue({
        code: "submission-translation-contract-mismatch",
        summary: `Requested translation contract '${input.translationContractVersion}' does not match workflow contract '${workflow.backendTranslation.contractVersion}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "submission.readiness.translationContractVersion",
      }));
    }

    if (!this.supportedTemplateRegistry.isOperationSupported(workflow.operationKind)) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-operation-unsupported",
        summary: `Workflow operation '${workflow.operationKind}' is outside the supported image-template set for run submission.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "workflow.operationKind",
      }));
      return Object.freeze(issues);
    }

    const registeredTemplate = this.supportedTemplateRegistry.getByOperationKind(workflow.operationKind);
    if (!registeredTemplate) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-template-unresolved",
        summary: `No supported template registration could be resolved for operation '${workflow.operationKind}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "workflow.backendTranslation.templateId",
      }));
      return Object.freeze(issues);
    }

    if (workflow.backendTranslation.templateId !== registeredTemplate.templateFamilyId) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-template-id-mismatch",
        summary:
          `Workflow template '${workflow.backendTranslation.templateId}' is stale or incompatible with operation '${workflow.operationKind}' (expected '${registeredTemplate.templateFamilyId}').`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "workflow.backendTranslation.templateId",
      }));
    }

    if (
      workflow.backendTranslation.templateVersion
      && workflow.backendTranslation.templateVersion !== workflow.version.versionTag
    ) {
      issues.push(this.blockingIssue({
        code: "submission-workflow-template-version-mismatch",
        summary:
          `Workflow template version '${workflow.backendTranslation.templateVersion}' does not match workflow version '${workflow.version.versionTag}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
        path: "workflow.backendTranslation.templateVersion",
      }));
    }

    return Object.freeze(issues);
  }

  private evaluateWorkflowSystemCompatibility(input: {
    readonly workflow: ImageWorkflowDefinition;
    readonly system: ImageSystemDefinition;
  }): ReadonlyArray<ImageRunSubmissionReadinessIssue> {
    const issues: ImageRunSubmissionReadinessIssue[] = [];

    if (input.system.workflowBinding.workflowId !== input.workflow.workflowId) {
      issues.push(this.blockingIssue({
        code: "submission-system-workflow-id-mismatch",
        summary:
          `System '${input.system.systemId}' is bound to workflow '${input.system.workflowBinding.workflowId}', not '${input.workflow.workflowId}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.compatibility,
        path: "submission.workflowId",
      }));
    }
    if (input.system.workflowBinding.workflowLineageId !== input.workflow.version.lineageId) {
      issues.push(this.blockingIssue({
        code: "submission-system-workflow-lineage-mismatch",
        summary: `System '${input.system.systemId}' is not bound to workflow lineage '${input.workflow.version.lineageId}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.compatibility,
        path: "system.workflowBinding.workflowLineageId",
      }));
    }
    if (input.system.workflowBinding.workflowVersionTag !== input.workflow.version.versionTag) {
      issues.push(this.blockingIssue({
        code: "submission-system-workflow-version-tag-mismatch",
        summary: `System '${input.system.systemId}' is bound to workflow version '${input.system.workflowBinding.workflowVersionTag}', not '${input.workflow.version.versionTag}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.compatibility,
        path: "system.workflowBinding.workflowVersionTag",
      }));
    }
    if (input.system.workflowBinding.workflowRevision !== input.workflow.version.revision) {
      issues.push(this.blockingIssue({
        code: "submission-system-workflow-revision-mismatch",
        summary: `System '${input.system.systemId}' is bound to workflow revision '${input.system.workflowBinding.workflowRevision}', not '${input.workflow.version.revision}'.`,
        category: ImageRunSubmissionReadinessIssueCategories.compatibility,
        path: "system.workflowBinding.workflowRevision",
      }));
    }

    for (const issue of this.workflowSystemReadinessValidationService.evaluateSystemBindingCompatibility({
      workflow: input.workflow,
      system: input.system,
    })) {
      issues.push(this.blockingIssue({
        code: issue.code,
        summary: issue.message,
        category: ImageRunSubmissionReadinessIssueCategories.compatibility,
        path: `system.${issue.path}`,
      }));
    }

    return Object.freeze(issues);
  }

  private evaluateSubmissionParameterValidity(input: {
    readonly workflow: ImageWorkflowDefinition;
    readonly system?: ImageSystemDefinition;
    readonly submissionParameters: Readonly<Record<string, unknown>>;
  }): ReadonlyArray<ImageRunSubmissionReadinessIssue> {
    const baselineParameters = input.system?.parameterBaseline.values ?? {};
    const merged = new Map<string, {
      readonly value: unknown;
      readonly source: typeof ImageSystemParameterValueSources[keyof typeof ImageSystemParameterValueSources];
    }>();

    for (const [parameterId, value] of Object.entries(baselineParameters)) {
      merged.set(parameterId, Object.freeze({
        value,
        source: ImageSystemParameterValueSources.baseline,
      }));
    }
    for (const [parameterId, value] of Object.entries(input.submissionParameters)) {
      merged.set(parameterId, Object.freeze({
        value,
        source: ImageSystemParameterValueSources.runtimeOverride,
      }));
    }

    const validation = validateImageSystemParameterSetContract({
      parameterSpecifications: input.workflow.parameterSpecifications,
      values: Object.freeze([...merged.entries()].map(([parameterId, value]) => Object.freeze({
        parameterId,
        value: value.value,
        source: value.source,
      }))),
    });

    return Object.freeze(validation.issues.map((issue) => this.blockingIssue({
      code: issue.code,
      summary: issue.message,
      category: ImageRunSubmissionReadinessIssueCategories.workflowValidity,
      path: `submission.parameters.${issue.parameterId}`,
    })));
  }

  private async evaluateAssetBindingReadiness(input: {
    readonly input: Parameters<NonNullable<IImageRunReadinessResolver["resolveRunSubmissionReadiness"]>>[0];
    readonly actor: AuthorizationActorReference;
    readonly system?: ImageSystemDefinition;
    readonly workflow?: ImageWorkflowDefinition;
  }): Promise<{
    readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
    readonly policyDenials: ReadonlyArray<ImageRunSubmissionReadinessPolicyDenial>;
    readonly missingInputBindingIds: ReadonlyArray<string>;
    readonly missingOutputBindingIds: ReadonlyArray<string>;
    readonly unresolvedAssetReferences: ReadonlyArray<string>;
  }> {
    const issues: ImageRunSubmissionReadinessIssue[] = [];
    const policyDenials: ImageRunSubmissionReadinessPolicyDenial[] = [];

    const requiredInputBindingIds = new Set<string>();
    const requiredOutputBindingIds = new Set<string>();

    if (input.workflow) {
      for (const slot of input.workflow.inputSlots) {
        if (slot.required) {
          requiredInputBindingIds.add(slot.inputId);
        }
      }
      for (const output of input.workflow.outputExpectations) {
        if (output.required) {
          requiredOutputBindingIds.add(output.outputId);
        }
      }
    }

    if (input.system) {
      for (const bindingId of input.system.workflowBinding.requiredInputIds) {
        requiredInputBindingIds.add(bindingId);
      }
      for (const bindingId of input.system.workflowBinding.requiredOutputIds) {
        requiredOutputBindingIds.add(bindingId);
      }
    }

    const providedInputBindingIds = new Set<string>();
    const providedOutputBindingIds = new Set<string>();

    for (const bindingId of input.input.inputAssetBindingIds ?? []) {
      const normalized = normalizeOptionalString(bindingId);
      if (normalized) {
        providedInputBindingIds.add(normalized);
      }
    }
    for (const bindingId of input.input.outputBindingIds ?? []) {
      const normalized = normalizeOptionalString(bindingId);
      if (normalized) {
        providedOutputBindingIds.add(normalized);
      }
    }
    for (const selection of input.system?.inputAssetSelections ?? []) {
      providedInputBindingIds.add(selection.inputId);
    }
    for (const binding of input.system?.outputTargetBindings ?? []) {
      providedOutputBindingIds.add(binding.outputId);
    }

    const missingInputBindingIds = [...requiredInputBindingIds].filter((bindingId) => !providedInputBindingIds.has(bindingId));
    const missingOutputBindingIds = [...requiredOutputBindingIds].filter((bindingId) => !providedOutputBindingIds.has(bindingId));

    for (const bindingId of missingInputBindingIds) {
      issues.push(this.blockingIssue({
        code: "submission-required-input-binding-missing",
        summary: `Required input binding '${bindingId}' is not satisfied.`,
        category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
        path: `submission.readiness.inputAssetBindingIds.${bindingId}`,
      }));
    }

    for (const bindingId of missingOutputBindingIds) {
      issues.push(this.blockingIssue({
        code: "submission-required-output-binding-missing",
        summary: `Required output binding '${bindingId}' is not satisfied.`,
        category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
        path: `submission.readiness.outputBindingIds.${bindingId}`,
      }));
    }

    const unresolvedAssetReferences: string[] = [];
    const referencedAssetIds = new Set<string>();
    for (const assetId of input.input.referencedAssetIds ?? []) {
      const normalized = normalizeOptionalString(assetId);
      if (normalized) {
        referencedAssetIds.add(normalized);
      }
    }
    for (const selection of input.system?.inputAssetSelections ?? []) {
      const normalizedAssetId = normalizeAssetIdReference(selection.assetReference);
      if (normalizedAssetId) {
        referencedAssetIds.add(normalizedAssetId);
      } else {
        issues.push(this.blockingIssue({
          code: "submission-input-asset-reference-malformed",
          summary: `Input selection '${selection.inputId}' has malformed asset reference '${selection.assetReference}'.`,
          category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
          path: `system.inputAssetSelections.${selection.inputId}`,
        }));
      }
    }

    if (this.dependencies.assetRepository) {
      for (const assetId of referencedAssetIds) {
        const asset = await this.dependencies.assetRepository.findAssetById(assetId);
        if (!asset) {
          unresolvedAssetReferences.push(assetId);
          issues.push(this.blockingIssue({
            code: "submission-referenced-asset-not-found",
            summary: `Referenced asset '${assetId}' was not found.`,
            category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
            path: `submission.readiness.referencedAssetIds.${assetId}`,
          }));
          continue;
        }

        if (asset.ownership.workspaceId !== input.input.workspaceId) {
          issues.push(this.blockingIssue({
            code: "submission-referenced-asset-workspace-mismatch",
            summary: `Referenced asset '${assetId}' is outside workspace '${input.input.workspaceId}'.`,
            category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
            path: `submission.readiness.referencedAssetIds.${assetId}`,
          }));
          continue;
        }

        if (asset.lifecycle.state !== "active") {
          issues.push(this.blockingIssue({
            code: "submission-referenced-asset-inactive",
            summary: `Referenced asset '${assetId}' is not active.`,
            category: ImageRunSubmissionReadinessIssueCategories.assetBinding,
            path: `submission.readiness.referencedAssetIds.${assetId}`,
          }));
          continue;
        }

        if (this.dependencies.authorizationDecisionEvaluator) {
          const authorizationIssue = await this.evaluateAssetAuthorization({
            actor: input.actor,
            asOf: normalizeOptionalString(input.input.occurredAt) ?? this.now().toISOString(),
            assetId,
          });
          if (authorizationIssue) {
            issues.push(authorizationIssue.issue);
            policyDenials.push(authorizationIssue.policyDenial);
          }
        }
      }
    } else if (referencedAssetIds.size > 0) {
      issues.push(this.advisoryIssue({
        code: "submission-asset-reference-validation-skipped",
        summary: "Asset reference validation is unavailable in this environment.",
        category: ImageRunSubmissionReadinessIssueCategories.advisory,
        path: "submission.readiness.referencedAssetIds",
      }));
    }

    return Object.freeze({
      issues: Object.freeze(issues),
      policyDenials: Object.freeze(policyDenials),
      missingInputBindingIds: Object.freeze(missingInputBindingIds),
      missingOutputBindingIds: Object.freeze(missingOutputBindingIds),
      unresolvedAssetReferences: Object.freeze(unresolvedAssetReferences),
    });
  }

  private async evaluateAssetAuthorization(input: {
    readonly actor: AuthorizationActorReference;
    readonly asOf: string;
    readonly assetId: string;
  }): Promise<{
    readonly issue: ImageRunSubmissionReadinessIssue;
    readonly policyDenial: ImageRunSubmissionReadinessPolicyDenial;
  } | undefined> {
    const hasActorIdentity = Boolean(input.actor.actorUserIdentityId || input.actor.actorServiceId);
    if (!hasActorIdentity) {
      return Object.freeze({
        issue: this.blockingIssue({
          code: "submission-asset-authorization-actor-required",
          summary: `Actor identity is required to authorize referenced asset '${input.assetId}'.`,
          category: ImageRunSubmissionReadinessIssueCategories.policyDenial,
          path: `submission.readiness.referencedAssetIds.${input.assetId}`,
        }),
        policyDenial: Object.freeze({
          policyId: "asset.read",
          code: "submission-asset-authorization-actor-required",
          summary: `Actor identity is required to authorize referenced asset '${input.assetId}'.`,
        }),
      });
    }

    const decision = await this.dependencies.authorizationDecisionEvaluator!.evaluateDecision({
      actor: input.actor,
      requiredPermissionKey: "asset.read",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: ResourceTypes.assetRecord,
          resourceId: input.assetId,
        }),
      }),
      asOf: input.asOf,
    });

    if (decision.decision.isAllowed) {
      return undefined;
    }

    const summary = `Actor is not authorized to read referenced asset '${input.assetId}'.`;
    return Object.freeze({
      issue: this.blockingIssue({
        code: "submission-referenced-asset-not-authorized",
        summary,
        category: ImageRunSubmissionReadinessIssueCategories.policyDenial,
        path: `submission.readiness.referencedAssetIds.${input.assetId}`,
        details: Object.freeze({
          reasonCode: decision.decision.reasonCode,
          denialReason: decision.decision.denialReason,
        }),
      }),
      policyDenial: Object.freeze({
        policyId: "asset.read",
        code: "submission-referenced-asset-not-authorized",
        summary,
        details: Object.freeze({
          assetId: input.assetId,
          reasonCode: decision.decision.reasonCode,
          denialReason: decision.decision.denialReason,
        }),
      }),
    });
  }

  private async evaluateBackendReadiness(input: {
    readonly workspaceId: string;
    readonly systemId: string;
    readonly workflow?: ImageWorkflowDefinition;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): Promise<{
    readonly adapterHealth: "healthy" | "degraded" | "unavailable" | "unknown";
    readonly ready: boolean;
    readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>;
  }> {
    if (!this.dependencies.executionReadinessUseCase) {
      const issue = this.blockingIssue({
        code: "submission-execution-readiness-not-configured",
        summary: "Execution readiness capability is not configured.",
        category: ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
        path: "submission.readiness",
      });
      return Object.freeze({
        adapterHealth: ImageRunSubmissionBackendAdapterHealthStates.unknown,
        ready: false,
        issues: Object.freeze([issue]),
      });
    }

    const readiness = await this.dependencies.executionReadinessUseCase.execute({
      workspaceId: input.workspaceId,
      systemId: input.systemId,
      operationKind: input.operationKind ?? input.workflow?.operationKind,
      translationContractVersion: input.translationContractVersion
        ?? input.workflow?.backendTranslation.contractVersion,
    });

    const issues = readiness.issues.map((issue) => issue.severity === "error"
      ? this.blockingIssue({
        code: issue.code,
        summary: issue.message,
        category: ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
        path: "submission.readiness.backend",
      })
      : this.advisoryIssue({
        code: issue.code,
        summary: issue.message,
        category: ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
        path: "submission.readiness.backend",
      }));

    const adapterHealth = readiness.readiness === ImageManipulationExecutionReadinessStates.ready
      ? ImageRunSubmissionBackendAdapterHealthStates.healthy
      : readiness.readiness === ImageManipulationExecutionReadinessStates.degraded
      ? ImageRunSubmissionBackendAdapterHealthStates.degraded
      : ImageRunSubmissionBackendAdapterHealthStates.unavailable;

    return Object.freeze({
      adapterHealth,
      ready: readiness.readyForExecution,
      issues: Object.freeze(issues),
    });
  }

  private blockingIssue(input: {
    readonly code: string;
    readonly summary: string;
    readonly category: ImageRunSubmissionReadinessIssue["category"];
    readonly path: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ImageRunSubmissionReadinessIssue {
    return this.createReadinessIssue({
      code: input.code,
      summary: input.summary,
      category: input.category,
      severity: "error",
      blocking: true,
      path: input.path,
      details: input.details,
    });
  }

  private advisoryIssue(input: {
    readonly code: string;
    readonly summary: string;
    readonly category: ImageRunSubmissionReadinessIssue["category"];
    readonly path: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ImageRunSubmissionReadinessIssue {
    return this.createReadinessIssue({
      code: input.code,
      summary: input.summary,
      category: input.category,
      severity: "warning",
      blocking: false,
      path: input.path,
      details: input.details,
    });
  }

  private createReadinessIssue(input: {
    readonly code: string;
    readonly summary: string;
    readonly category: ImageRunSubmissionReadinessIssue["category"];
    readonly severity: "error" | "warning";
    readonly blocking: boolean;
    readonly path?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ImageRunSubmissionReadinessIssue {
    const classification = classifySubmissionReadinessIssue(input);
    const recovery = deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: classification.disposition === ImageManipulationFailureDispositions.retryable,
    });
    return Object.freeze({
      code: input.code,
      summary: input.summary,
      category: input.category,
      severity: input.severity,
      blocking: input.blocking,
      path: input.path,
      details: input.details,
      classification,
      recovery,
    });
  }
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAssetIdReference(value: string): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (!normalized.includes("://")) {
    return normalized;
  }
  if (!normalized.startsWith("asset://")) {
    return undefined;
  }
  const assetId = normalized.slice("asset://".length).trim();
  return assetId ? assetId : undefined;
}

function classifySubmissionReadinessIssue(input: {
  readonly code: string;
  readonly category: ImageRunSubmissionReadinessIssue["category"];
  readonly severity: "error" | "warning";
}): ImageManipulationIssueClassification {
  const layer = resolveReadinessIssueLayer(input.category);
  const kind = input.category === ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency
    ? ImageManipulationIssueKinds.operational
    : ImageManipulationIssueKinds.validation;
  const summaryCategory = resolveReadinessSummaryCategory(input);
  const retryable = kind === ImageManipulationIssueKinds.operational
    && input.severity === "warning";
  return createImageManipulationIssueClassification({
    layer,
    kind,
    summaryCategory,
    disposition: retryable
      ? ImageManipulationFailureDispositions.retryable
      : ImageManipulationFailureDispositions.terminal,
    reason: toReadinessReasonCode(input.code),
    userFixable: kind === ImageManipulationIssueKinds.validation,
    degraded: retryable || input.category === ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
  });
}

function resolveReadinessIssueLayer(
  category: ImageRunSubmissionReadinessIssue["category"],
) {
  if (category === ImageRunSubmissionReadinessIssueCategories.workflowValidity
    || category === ImageRunSubmissionReadinessIssueCategories.systemValidity
    || category === ImageRunSubmissionReadinessIssueCategories.compatibility) {
    return ImageManipulationIssueLayers.workflowConfiguration;
  }
  if (category === ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency) {
    return ImageManipulationIssueLayers.nodeAvailability;
  }
  return ImageManipulationIssueLayers.runReadiness;
}

function resolveReadinessSummaryCategory(input: {
  readonly code: string;
  readonly category: ImageRunSubmissionReadinessIssue["category"];
}): ImageManipulationFailureSummaryCategory {
  if (input.category === ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency) {
    if (input.code.includes("timeout")) {
      return ImageManipulationFailureSummaryCategories.timeout;
    }
    if (input.code.includes("connect") || input.code.includes("unavailable")) {
      return ImageManipulationFailureSummaryCategories.connectivity;
    }
    if (input.code.includes("node") || input.code.includes("backend")) {
      return ImageManipulationFailureSummaryCategories.capacity;
    }
    return ImageManipulationFailureSummaryCategories.execution;
  }
  if (input.code.includes("translation")) {
    return ImageManipulationFailureSummaryCategories.translation;
  }
  if (input.code.includes("template")) {
    return ImageManipulationFailureSummaryCategories.translation;
  }
  return ImageManipulationFailureSummaryCategories.validation;
}

function toReadinessReasonCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    || "unknown";
}
