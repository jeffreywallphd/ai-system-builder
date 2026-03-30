import {
  normalizeWorkflowDraft,
  validateWorkflowDraft,
  type WorkflowDraft,
} from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  translateWorkflowDefinitionToExecutionPlan,
  type WorkflowDraftExecutionPlan,
} from "./WorkflowDefinitionExecutionPlanTranslator";
import {
  WorkflowExecutionValidationStages,
  type WorkflowExecutionPlanTranslationRequest,
  type WorkflowExecutionTranslationIssue,
} from "./WorkflowExecutionAlignmentContracts";

export const WorkflowExecutionValidationIssueCategories = Object.freeze({
  authoredWorkflow: "authored-workflow",
  assetReference: "asset-reference",
  triggerConfiguration: "trigger-configuration",
  inputBinding: "input-binding",
  outputDefinition: "output-definition",
  stepSequencing: "step-sequencing",
  controlFlow: "control-flow",
  translation: "translation",
  runtimeReadiness: "runtime-readiness",
});

export type WorkflowExecutionValidationIssueCategory =
  typeof WorkflowExecutionValidationIssueCategories[keyof typeof WorkflowExecutionValidationIssueCategories];

export interface WorkflowExecutionValidationIssue extends WorkflowExecutionTranslationIssue {
  readonly category: WorkflowExecutionValidationIssueCategory;
  readonly blocking: boolean;
}

export interface WorkflowExecutionValidationSummary {
  readonly stage: "authored-validation" | "pre-execution-validation" | "translation";
  readonly ready: boolean;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
}

export interface WorkflowPreExecutionValidationResult {
  readonly ready: boolean;
  readonly issues: ReadonlyArray<WorkflowExecutionValidationIssue>;
  readonly blockingIssues: ReadonlyArray<WorkflowExecutionValidationIssue>;
  readonly warningIssues: ReadonlyArray<WorkflowExecutionValidationIssue>;
  readonly authoredValidation: WorkflowExecutionValidationSummary;
  readonly preExecutionValidation: WorkflowExecutionValidationSummary;
  readonly translationValidation: WorkflowExecutionValidationSummary;
  readonly plan?: WorkflowDraftExecutionPlan;
}

export interface WorkflowExecutionAssetReferenceResolver {
  readonly hasAssetVersionReference?: (versionId: string) => Promise<boolean> | boolean;
}

export interface WorkflowPreExecutionValidationRequest extends WorkflowExecutionPlanTranslationRequest {
  readonly assetReferenceResolver?: WorkflowExecutionAssetReferenceResolver;
}

function inferIssueCategory(code: string): WorkflowExecutionValidationIssueCategory {
  if (code.startsWith("trigger-")) {
    return WorkflowExecutionValidationIssueCategories.triggerConfiguration;
  }
  if (code.startsWith("input-")) {
    return WorkflowExecutionValidationIssueCategories.inputBinding;
  }
  if (code.startsWith("output-")) {
    return WorkflowExecutionValidationIssueCategories.outputDefinition;
  }
  if (code.startsWith("step-") || code.includes("dependency")) {
    return WorkflowExecutionValidationIssueCategories.stepSequencing;
  }
  if (code.startsWith("built-in-") || code.startsWith("loop-")) {
    return WorkflowExecutionValidationIssueCategories.controlFlow;
  }
  if (code.includes("asset")) {
    return WorkflowExecutionValidationIssueCategories.assetReference;
  }
  if (code.startsWith("draft-") || code.startsWith("entity-") || code.startsWith("lifecycle-")) {
    return WorkflowExecutionValidationIssueCategories.authoredWorkflow;
  }
  return WorkflowExecutionValidationIssueCategories.translation;
}

function toValidationIssue(
  issue: WorkflowExecutionTranslationIssue,
  category = inferIssueCategory(issue.code),
): WorkflowExecutionValidationIssue {
  return Object.freeze({
    ...issue,
    category,
    blocking: issue.severity === "error",
  });
}

function dedupeIssues(
  issues: ReadonlyArray<WorkflowExecutionValidationIssue>,
): ReadonlyArray<WorkflowExecutionValidationIssue> {
  const seen = new Set<string>();
  const deduped: WorkflowExecutionValidationIssue[] = [];
  for (const issue of issues) {
    const key = [issue.stage, issue.severity, issue.code, issue.path ?? "", issue.message].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(issue);
  }
  return Object.freeze(deduped);
}

function summarizeStage(
  stage: WorkflowExecutionValidationSummary["stage"],
  issues: ReadonlyArray<WorkflowExecutionValidationIssue>,
): WorkflowExecutionValidationSummary {
  const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
  const warningIssueCount = issues.length - blockingIssueCount;
  return Object.freeze({
    stage,
    ready: blockingIssueCount === 0,
    blockingIssueCount,
    warningIssueCount,
  });
}

async function collectAssetReferenceIssues(
  draft: WorkflowDraft,
  resolver?: WorkflowExecutionAssetReferenceResolver,
): Promise<ReadonlyArray<WorkflowExecutionValidationIssue>> {
  if (!resolver?.hasAssetVersionReference) {
    return Object.freeze([]);
  }

  const refs: Array<{ versionId?: string; path: string }> = [];
  for (let index = 0; index < draft.inputs.length; index += 1) {
    const input = draft.inputs[index];
    if (input.sourceType !== "dataset-asset") {
      continue;
    }
    refs.push({
      versionId: input.asset.versionId,
      path: `draft.inputs[${index}].asset.versionId`,
    });
  }

  for (let index = 0; index < draft.steps.length; index += 1) {
    const step = draft.steps[index];
    if (!step.assetRef?.asset?.versionId) {
      continue;
    }
    refs.push({
      versionId: step.assetRef.asset.versionId,
      path: `draft.steps[${index}].assetRef.asset.versionId`,
    });
  }

  for (let index = 0; index < draft.triggers.length; index += 1) {
    const trigger = draft.triggers[index];
    const versionId = trigger.kind === "state" ? trigger.config.asset?.versionId : undefined;
    if (!versionId) {
      continue;
    }
    refs.push({
      versionId,
      path: `draft.triggers[${index}].config.asset.versionId`,
    });
  }

  const issues: WorkflowExecutionValidationIssue[] = [];
  for (const ref of refs) {
    if (!ref.versionId) {
      continue;
    }

    const exists = await resolver.hasAssetVersionReference(ref.versionId);
    if (exists) {
      continue;
    }

    issues.push(Object.freeze({
      code: "asset-version-reference-missing",
      stage: WorkflowExecutionValidationStages.preExecution,
      severity: "error",
      message: `Referenced asset version '${ref.versionId}' is unavailable.`,
      path: ref.path,
      category: WorkflowExecutionValidationIssueCategories.assetReference,
      blocking: true,
    }));
  }

  return Object.freeze(issues);
}

export async function validateWorkflowForExecutionReadiness(
  request: WorkflowPreExecutionValidationRequest,
): Promise<WorkflowPreExecutionValidationResult> {
  const normalizedDraft = normalizeWorkflowDraft(request.draft);
  const authoredValidationResult = validateWorkflowDraft(normalizedDraft);
  const authoredIssues = authoredValidationResult.issues.map((issue) => toValidationIssue({
    code: issue.code,
    stage: WorkflowExecutionValidationStages.preTranslation,
    severity: issue.severity,
    message: issue.message,
    path: issue.path,
  }));

  const preExecutionIssues = await collectAssetReferenceIssues(
    normalizedDraft,
    request.assetReferenceResolver,
  );

  const translationResult = translateWorkflowDefinitionToExecutionPlan({
    draft: normalizedDraft,
    request: request.request,
    context: request.context,
  });
  const translationIssues = translationResult.issues.map((issue) => toValidationIssue(issue));

  const issues = dedupeIssues([
    ...authoredIssues,
    ...preExecutionIssues,
    ...translationIssues,
  ]);
  const blockingIssues = Object.freeze(issues.filter((issue) => issue.blocking));
  const warningIssues = Object.freeze(issues.filter((issue) => !issue.blocking));
  const authoredValidation = summarizeStage("authored-validation", authoredIssues);
  const preExecutionValidation = summarizeStage("pre-execution-validation", preExecutionIssues);
  const translationValidation = summarizeStage("translation", translationIssues);
  const ready = blockingIssues.length === 0 && Boolean(translationResult.success && translationResult.plan);

  return Object.freeze({
    ready,
    issues,
    blockingIssues,
    warningIssues,
    authoredValidation,
    preExecutionValidation,
    translationValidation,
    plan: ready ? translationResult.plan : undefined,
  });
}
