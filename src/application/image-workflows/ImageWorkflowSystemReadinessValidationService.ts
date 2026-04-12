import {
  evaluateImageWorkflowDefinitionCompleteness,
  type ImageWorkflowCompletenessIssue,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  evaluateImageSystemReadiness,
  isImageSystemRunnable,
  type ImageSystemDefinition,
  type ImageSystemReadinessIssue,
} from "@domain/systems/ImageSystemDomain";
import type {
  ImageDefinitionValidationIssue,
  ImageDefinitionValidationResult,
  IImageSystemDefinitionValidationService,
  IImageWorkflowDefinitionValidationService,
  IImageWorkflowSystemCompatibilityService,
  ImageWorkflowSystemCompatibilityResult,
} from "./ports";
import { ImageDefinitionValidationSeverities } from "./ports";
import {
  ImageSystemDefinitionReadinessStates,
  type ImageSystemDefinitionReadinessSummary,
  type ImageSystemDefinitionStructureSummary,
} from "./ImageSystemDefinitionAuthoringContracts";
import {
  ImageWorkflowDefinitionReadinessStates,
  type ImageWorkflowDefinitionReadinessSummary,
  type ImageWorkflowDefinitionStructureSummary,
} from "./ImageWorkflowDefinitionAuthoringContracts";

export const ImageDefinitionReadinessClassifications = Object.freeze({
  draft: "draft",
  incomplete: "incomplete",
  valid: "valid",
  runnable: "runnable",
});

export type ImageDefinitionReadinessClassification =
  typeof ImageDefinitionReadinessClassifications[keyof typeof ImageDefinitionReadinessClassifications];

export interface ImageDefinitionValidationAssessmentIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
  readonly source: "readiness" | "validation" | "compatibility" | "binding";
  readonly blocking: boolean;
}

export interface ImageWorkflowDefinitionAuthoringAssessment {
  readonly ready: boolean;
  readonly classification: ImageDefinitionReadinessClassification;
  readonly summary: string;
  readonly blocking: boolean;
  readonly issues: ReadonlyArray<ImageDefinitionValidationAssessmentIssue>;
  readonly readiness: ImageWorkflowDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly structure: ImageWorkflowDefinitionStructureSummary;
}

export interface ImageSystemDefinitionAuthoringAssessment {
  readonly ready: boolean;
  readonly runnable: boolean;
  readonly classification: ImageDefinitionReadinessClassification;
  readonly summary: string;
  readonly blocking: boolean;
  readonly issues: ReadonlyArray<ImageDefinitionValidationAssessmentIssue>;
  readonly readiness: ImageSystemDefinitionReadinessSummary;
  readonly validation: ImageDefinitionValidationResult;
  readonly compatibility: ImageWorkflowSystemCompatibilityResult;
  readonly structure: ImageSystemDefinitionStructureSummary;
}

export interface ImageSystemBindingCompatibilityIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: "error";
}

export class ImageWorkflowSystemReadinessValidationService {
  public evaluateWorkflowReadiness(
    workflow: ImageWorkflowDefinition,
    evaluatedAt: string,
  ): {
    readonly readiness: ImageWorkflowDefinitionReadinessSummary;
    readonly structure: ImageWorkflowDefinitionStructureSummary;
  } {
    const completenessIssues = evaluateImageWorkflowDefinitionCompleteness(workflow);
    const classification = completenessIssues.length > 0
      ? ImageDefinitionReadinessClassifications.incomplete
      : workflow.lifecycleState === "draft"
      ? ImageDefinitionReadinessClassifications.draft
      : ImageDefinitionReadinessClassifications.valid;
    const summary = summarizeWorkflowReadiness(classification, completenessIssues);
    const readiness = completenessIssues.length === 0
      ? Object.freeze({
        state: ImageWorkflowDefinitionReadinessStates.definitionReady,
        ready: true,
        classification,
        summary,
        evaluatedAt,
        completenessIssues,
      })
      : Object.freeze({
        state: ImageWorkflowDefinitionReadinessStates.definitionIncomplete,
        ready: false,
        classification,
        summary,
        evaluatedAt,
        completenessIssues,
      });

    return Object.freeze({
      readiness,
      structure: this.buildWorkflowStructureSummary(workflow),
    });
  }

  public async evaluateWorkflowAuthoring(input: {
    readonly workspaceId: string;
    readonly workflow: ImageWorkflowDefinition;
    readonly validationService: IImageWorkflowDefinitionValidationService;
  }): Promise<ImageWorkflowDefinitionAuthoringAssessment> {
    const evaluatedAt = new Date().toISOString();
    const readinessProjection = this.evaluateWorkflowReadiness(input.workflow, evaluatedAt);
    const validation = await input.validationService.validateWorkflowDefinition({
      workspaceId: input.workspaceId,
      workflow: input.workflow,
      mode: input.workflow.lifecycleState === "published" ? "publish" : "authoring",
    });

    const issues = Object.freeze([
      ...mapWorkflowCompletenessIssues(readinessProjection.readiness.completenessIssues),
      ...mapValidationIssues(validation.issues),
    ]);
    const validationBlocks = hasErrorSeverity(validation.issues);
    const blocking = !readinessProjection.readiness.ready || validationBlocks;
    const summary = summarizeAssessment(blocking, issues.length, "workflow definition");

    return Object.freeze({
      ready: readinessProjection.readiness.ready,
      classification: readinessProjection.readiness.classification,
      summary,
      blocking,
      issues,
      readiness: readinessProjection.readiness,
      validation,
      structure: readinessProjection.structure,
    });
  }

  public evaluateSystemReadiness(
    system: ImageSystemDefinition,
    evaluatedAt: string,
  ): {
    readonly readiness: ImageSystemDefinitionReadinessSummary;
    readonly structure: ImageSystemDefinitionStructureSummary;
  } {
    const readinessIssues = evaluateImageSystemReadiness(system);
    const runnable = isImageSystemRunnable(system);
    const classification = runnable
      ? ImageDefinitionReadinessClassifications.runnable
      : readinessIssues.length > 0
      ? ImageDefinitionReadinessClassifications.incomplete
      : system.lifecycleState === "draft"
      ? ImageDefinitionReadinessClassifications.draft
      : ImageDefinitionReadinessClassifications.valid;
    const summary = summarizeSystemReadiness(classification, readinessIssues);

    const readiness = runnable
      ? Object.freeze({
        state: ImageSystemDefinitionReadinessStates.configurationRunnable,
        ready: true,
        runnable: true,
        classification,
        summary,
        evaluatedAt,
        issues: readinessIssues,
      })
      : readinessIssues.length === 0
      ? Object.freeze({
        state: ImageSystemDefinitionReadinessStates.configurationReady,
        ready: true,
        runnable: false,
        classification,
        summary,
        evaluatedAt,
        issues: readinessIssues,
      })
      : Object.freeze({
        state: ImageSystemDefinitionReadinessStates.configurationIncomplete,
        ready: false,
        runnable: false,
        classification,
        summary,
        evaluatedAt,
        issues: readinessIssues,
      });

    return Object.freeze({
      readiness,
      structure: this.buildSystemStructureSummary(system),
    });
  }

  public evaluateSystemBindingCompatibility(input: {
    readonly workflow: ImageWorkflowDefinition;
    readonly system: ImageSystemDefinition;
  }): ReadonlyArray<ImageSystemBindingCompatibilityIssue> {
    const workflowInputIds = new Set(input.workflow.inputSlots.map((entry) => entry.inputId));
    const requiredWorkflowInputIds = new Set(
      input.workflow.inputSlots
        .filter((entry) => entry.required)
        .map((entry) => entry.inputId),
    );
    const workflowParameterIds = new Set(input.workflow.parameterSpecifications.map((entry) => entry.parameterId));
    const requiredWorkflowParameterIds = new Set(
      input.workflow.parameterSpecifications
        .filter((entry) => entry.required)
        .map((entry) => entry.parameterId),
    );
    const workflowOutputIds = new Set(input.workflow.outputExpectations.map((entry) => entry.outputId));
    const requiredWorkflowOutputIds = new Set(
      input.workflow.outputExpectations
        .filter((entry) => entry.required)
        .map((entry) => entry.outputId),
    );
    const systemRequiredInputIds = new Set(input.system.workflowBinding.requiredInputIds);
    const systemRequiredParameterIds = new Set(input.system.workflowBinding.requiredParameterIds);
    const systemRequiredOutputIds = new Set(input.system.workflowBinding.requiredOutputIds);
    const issues: ImageSystemBindingCompatibilityIssue[] = [];

    for (const requiredInputId of input.system.workflowBinding.requiredInputIds) {
      if (!workflowInputIds.has(requiredInputId)) {
        issues.push(Object.freeze({
          code: "required-input-not-declared-by-workflow",
          path: `workflowBinding.requiredInputIds.${requiredInputId}`,
          message: `Required input '${requiredInputId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    for (const requiredWorkflowInputId of requiredWorkflowInputIds) {
      if (!systemRequiredInputIds.has(requiredWorkflowInputId)) {
        issues.push(Object.freeze({
          code: "workflow-required-input-not-required-by-system",
          path: `workflowBinding.requiredInputIds.${requiredWorkflowInputId}`,
          message:
            `Workflow '${input.workflow.workflowId}' requires input '${requiredWorkflowInputId}', but system binding does not declare it as required.`,
          severity: "error",
        }));
      }
    }

    for (const requiredParameterId of input.system.workflowBinding.requiredParameterIds) {
      if (!workflowParameterIds.has(requiredParameterId)) {
        issues.push(Object.freeze({
          code: "required-parameter-not-declared-by-workflow",
          path: `workflowBinding.requiredParameterIds.${requiredParameterId}`,
          message: `Required parameter '${requiredParameterId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    for (const requiredWorkflowParameterId of requiredWorkflowParameterIds) {
      if (!systemRequiredParameterIds.has(requiredWorkflowParameterId)) {
        issues.push(Object.freeze({
          code: "workflow-required-parameter-not-required-by-system",
          path: `workflowBinding.requiredParameterIds.${requiredWorkflowParameterId}`,
          message:
            `Workflow '${input.workflow.workflowId}' requires parameter '${requiredWorkflowParameterId}', but system binding does not declare it as required.`,
          severity: "error",
        }));
      }
    }

    for (const requiredOutputId of input.system.workflowBinding.requiredOutputIds) {
      if (!workflowOutputIds.has(requiredOutputId)) {
        issues.push(Object.freeze({
          code: "required-output-not-declared-by-workflow",
          path: `workflowBinding.requiredOutputIds.${requiredOutputId}`,
          message: `Required output '${requiredOutputId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    for (const requiredWorkflowOutputId of requiredWorkflowOutputIds) {
      if (!systemRequiredOutputIds.has(requiredWorkflowOutputId)) {
        issues.push(Object.freeze({
          code: "workflow-required-output-not-required-by-system",
          path: `workflowBinding.requiredOutputIds.${requiredWorkflowOutputId}`,
          message:
            `Workflow '${input.workflow.workflowId}' requires output '${requiredWorkflowOutputId}', but system binding does not declare it as required.`,
          severity: "error",
        }));
      }
    }

    for (const selection of input.system.inputAssetSelections) {
      if (!workflowInputIds.has(selection.inputId)) {
        issues.push(Object.freeze({
          code: "selected-input-not-declared-by-workflow",
          path: `inputAssetSelections.${selection.inputId}`,
          message:
            `Configured input selection '${selection.inputId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    for (const binding of input.system.outputTargetBindings) {
      if (!workflowOutputIds.has(binding.outputId)) {
        issues.push(Object.freeze({
          code: "configured-output-not-declared-by-workflow",
          path: `outputTargetBindings.${binding.outputId}`,
          message:
            `Configured output target '${binding.outputId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    for (const parameterId of Object.keys(input.system.parameterBaseline.values)) {
      if (!workflowParameterIds.has(parameterId)) {
        issues.push(Object.freeze({
          code: "baseline-parameter-not-declared-by-workflow",
          path: `parameterBaseline.values.${parameterId}`,
          message:
            `Configured baseline parameter '${parameterId}' is not declared by workflow '${input.workflow.workflowId}'.`,
          severity: "error",
        }));
      }
    }

    return Object.freeze(issues);
  }

  public async evaluateSystemAuthoring(input: {
    readonly workspaceId: string;
    readonly workflow: ImageWorkflowDefinition;
    readonly system: ImageSystemDefinition;
    readonly validationService: IImageSystemDefinitionValidationService;
    readonly compatibilityService: IImageWorkflowSystemCompatibilityService;
  }): Promise<ImageSystemDefinitionAuthoringAssessment> {
    const evaluatedAt = new Date().toISOString();
    const readinessProjection = this.evaluateSystemReadiness(input.system, evaluatedAt);
    const bindingIssues = this.evaluateSystemBindingCompatibility({
      workflow: input.workflow,
      system: input.system,
    });
    const compatibility = await input.compatibilityService.evaluateSystemWorkflowCompatibility({
      workspaceId: input.workspaceId,
      workflow: input.workflow,
      system: input.system,
      mode: "strict",
    });

    const validationMode = input.system.runtimeStatus === "enabled"
      ? "runtime"
      : input.system.lifecycleState === "ready"
      ? "ready"
      : "authoring";
    const validation = await input.validationService.validateSystemDefinition({
      workspaceId: input.workspaceId,
      system: input.system,
      mode: validationMode,
    });

    const issues = Object.freeze([
      ...mapSystemReadinessIssues(readinessProjection.readiness.issues),
      ...mapBindingIssues(bindingIssues),
      ...mapCompatibilityIssues(compatibility.issues),
      ...mapValidationIssues(validation.issues),
    ]);
    const compatibilityBlocks = compatibility.outcome === "incompatible";
    const bindingBlocks = bindingIssues.length > 0;
    const validationBlocks = hasErrorSeverity(validation.issues);
    const blocking = compatibilityBlocks || bindingBlocks || validationBlocks;
    const summary = summarizeAssessment(blocking, issues.length, "system definition");

    return Object.freeze({
      ready: readinessProjection.readiness.ready,
      runnable: readinessProjection.readiness.runnable,
      classification: readinessProjection.readiness.classification,
      summary,
      blocking,
      issues,
      readiness: readinessProjection.readiness,
      validation,
      compatibility,
      structure: readinessProjection.structure,
    });
  }

  private buildWorkflowStructureSummary(
    workflow: ImageWorkflowDefinition,
  ): ImageWorkflowDefinitionStructureSummary {
    return Object.freeze({
      inputSlots: Object.freeze({
        total: workflow.inputSlots.length,
        required: workflow.inputSlots.filter((slot) => slot.required).length,
      }),
      parameters: Object.freeze({
        total: workflow.parameterSpecifications.length,
        required: workflow.parameterSpecifications.filter((parameter) => parameter.required).length,
      }),
      outputExpectations: Object.freeze({
        total: workflow.outputExpectations.length,
        required: workflow.outputExpectations.filter((output) => output.required).length,
      }),
      bindings: Object.freeze({
        input: workflow.inputBindings.length,
        output: workflow.outputBindings.length,
      }),
      backendTranslation: Object.freeze({
        translatorId: workflow.backendTranslation.translatorId,
        templateId: workflow.backendTranslation.templateId,
        contractVersion: workflow.backendTranslation.contractVersion,
        inputBindings: workflow.backendTranslation.inputBindings.length,
        parameterBindings: workflow.backendTranslation.parameterBindings.length,
        outputBindings: workflow.backendTranslation.outputBindings.length,
      }),
    });
  }

  private buildSystemStructureSummary(
    system: ImageSystemDefinition,
  ): ImageSystemDefinitionStructureSummary {
    return Object.freeze({
      workflowBinding: Object.freeze({
        workflowId: system.workflowBinding.workflowId,
        workflowLineageId: system.workflowBinding.workflowLineageId,
        workflowVersionTag: system.workflowBinding.workflowVersionTag,
        workflowRevision: system.workflowBinding.workflowRevision,
      }),
      requirements: Object.freeze({
        requiredInputs: system.workflowBinding.requiredInputIds.length,
        requiredParameters: system.workflowBinding.requiredParameterIds.length,
        requiredOutputs: system.workflowBinding.requiredOutputIds.length,
      }),
      configured: Object.freeze({
        selectedInputs: system.inputAssetSelections.length,
        outputTargets: system.outputTargetBindings.length,
        parameterValues: Object.keys(system.parameterBaseline.values).length,
        parameterProfiles: system.parameterBaseline.profileReferences.length,
      }),
    });
  }
}

function mapWorkflowCompletenessIssues(
  issues: ReadonlyArray<ImageWorkflowCompletenessIssue>,
): ReadonlyArray<ImageDefinitionValidationAssessmentIssue> {
  return issues.map((issue) => Object.freeze({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: "error",
    source: "readiness",
    blocking: true,
  }));
}

function mapSystemReadinessIssues(
  issues: ReadonlyArray<ImageSystemReadinessIssue>,
): ReadonlyArray<ImageDefinitionValidationAssessmentIssue> {
  return issues.map((issue) => Object.freeze({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: "warning",
    source: "readiness",
    blocking: false,
  }));
}

function mapBindingIssues(
  issues: ReadonlyArray<ImageSystemBindingCompatibilityIssue>,
): ReadonlyArray<ImageDefinitionValidationAssessmentIssue> {
  return issues.map((issue) => Object.freeze({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
    source: "binding",
    blocking: true,
  }));
}

function mapCompatibilityIssues(
  issues: ReadonlyArray<ImageDefinitionValidationIssue>,
): ReadonlyArray<ImageDefinitionValidationAssessmentIssue> {
  return issues.map((issue) => Object.freeze({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
    source: "compatibility",
    blocking: issue.severity === ImageDefinitionValidationSeverities.error,
  }));
}

function mapValidationIssues(
  issues: ReadonlyArray<ImageDefinitionValidationIssue>,
): ReadonlyArray<ImageDefinitionValidationAssessmentIssue> {
  return issues.map((issue) => Object.freeze({
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
    source: "validation",
    blocking: issue.severity === ImageDefinitionValidationSeverities.error,
  }));
}

function hasErrorSeverity(issues: ReadonlyArray<ImageDefinitionValidationIssue>): boolean {
  return issues.some((issue) => issue.severity === ImageDefinitionValidationSeverities.error);
}

function summarizeWorkflowReadiness(
  classification: ImageDefinitionReadinessClassification,
  issues: ReadonlyArray<ImageWorkflowCompletenessIssue>,
): string {
  if (classification === ImageDefinitionReadinessClassifications.incomplete) {
    return `Workflow definition is incomplete: ${issues.length} required readiness checks failed.`;
  }
  if (classification === ImageDefinitionReadinessClassifications.draft) {
    return "Workflow definition is complete for draft authoring.";
  }
  return "Workflow definition is complete and ready for downstream usage.";
}

function summarizeSystemReadiness(
  classification: ImageDefinitionReadinessClassification,
  issues: ReadonlyArray<ImageSystemReadinessIssue>,
): string {
  if (classification === ImageDefinitionReadinessClassifications.runnable) {
    return "System definition is runnable.";
  }
  if (classification === ImageDefinitionReadinessClassifications.incomplete) {
    return `System definition is incomplete: ${issues.length} readiness gap(s) must be configured.`;
  }
  if (classification === ImageDefinitionReadinessClassifications.draft) {
    return "System definition is complete for draft authoring and can advance toward ready state.";
  }
  return "System definition is valid and ready for enablement.";
}

function summarizeAssessment(
  blocking: boolean,
  issueCount: number,
  subject: string,
): string {
  if (blocking) {
    return `${subject} has blocking validation issues (${issueCount}).`;
  }
  if (issueCount > 0) {
    return `${subject} has non-blocking advisory issues (${issueCount}).`;
  }
  return `${subject} has no validation issues.`;
}
