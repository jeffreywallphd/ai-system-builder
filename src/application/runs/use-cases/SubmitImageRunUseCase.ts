import type {
  RunSubmissionAcceptedResponse,
  RunSubmissionRequest,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type {
  RunSubmissionValidationIssue,
  ValidateRunSubmissionResult,
} from "./RunSubmissionValidationContracts";
import {
  RunSubmissionValidationErrorCodes,
  RunSubmissionValidationIssueKinds,
  type RunSubmissionValidationErrorCode,
} from "./RunSubmissionValidationContracts";
import type { ValidateRunSubmissionUseCase } from "./ValidateRunSubmissionUseCase";
import type { CreateAuthoritativeRunUseCase } from "./CreateAuthoritativeRunUseCase";
import {
  ImageRunSubmissionReadinessIssueCategories,
  buildImageRunSubmissionReadinessResult,
  type ImageRunSubmissionReadinessIssue,
  type ImageRunSubmissionReadinessResult,
} from "@application/image-workflows/ImageRunSubmissionReadinessContracts";
import type { IImageRunReadinessResolver } from "@application/image-workflows/ports/ImageRunOrchestrationPorts";

export interface SubmitImageRunRequest {
  readonly actor: {
    readonly actorUserIdentityId?: string;
    readonly actorServiceId?: string;
    readonly activeWorkspaceId?: string;
  };
  readonly workspaceId: string;
  readonly submission: RunSubmissionRequest & {
    readonly templateId?: string;
    readonly parameters?: Readonly<Record<string, unknown>>;
  };
  readonly occurredAt?: string;
  readonly readiness?: {
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
    readonly inputAssetBindingIds?: ReadonlyArray<string>;
    readonly outputBindingIds?: ReadonlyArray<string>;
    readonly referencedAssetIds?: ReadonlyArray<string>;
  };
}

export interface SubmitImageRunSuccess {
  readonly ok: true;
  readonly response: RunSubmissionAcceptedResponse;
  readonly readiness: ImageRunSubmissionReadinessResult;
  readonly warnings: ReadonlyArray<RunSubmissionValidationIssue>;
}

export interface SubmitImageRunFailure {
  readonly ok: false;
  readonly error: {
    readonly code: RunSubmissionValidationErrorCode;
    readonly message: string;
    readonly validationIssues: ReadonlyArray<RunSubmissionValidationIssue>;
  };
}

export type SubmitImageRunResult =
  | SubmitImageRunSuccess
  | SubmitImageRunFailure;

export interface SubmitImageRunUseCaseDependencies {
  readonly validateRunSubmissionUseCase: ValidateRunSubmissionUseCase;
  readonly createAuthoritativeRunUseCase: CreateAuthoritativeRunUseCase;
  readonly imageRunReadinessResolver?: Pick<IImageRunReadinessResolver, "resolveRunSubmissionReadiness">;
  readonly now?: () => Date;
}

export class SubmitImageRunUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: SubmitImageRunUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(input: SubmitImageRunRequest): Promise<SubmitImageRunResult> {
    const submittedByActorId = normalizeOptional(input.submission.submittedByActorId)
      ?? normalizeOptional(input.actor.actorUserIdentityId)
      ?? normalizeOptional(input.actor.actorServiceId);

    const validation = await this.dependencies.validateRunSubmissionUseCase.execute({
      actor: input.actor,
      submission: Object.freeze({
        ...input.submission,
        workspaceId: input.workspaceId,
        submittedByActorId,
      }),
      occurredAt: input.occurredAt,
    });
    if (!validation.ok) {
      return validation;
    }

    const readiness = await this.resolveSubmissionReadiness(input, validation);
    const blockingReadinessIssues = toValidationIssues(readiness.blockingIssues);
    if (blockingReadinessIssues.length > 0) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: RunSubmissionValidationErrorCodes.policyIneligible,
          message: "Run submission is blocked by readiness findings.",
          validationIssues: blockingReadinessIssues,
        }),
      });
    }

    const created = await this.dependencies.createAuthoritativeRunUseCase.execute({
      command: validation.command,
    });
    const warnings = toValidationIssues(readiness.advisoryIssues);

    return Object.freeze({
      ok: true,
      response: Object.freeze({
        run: created.run,
        mutation: Object.freeze({
          changed: true,
          mutationId: created.orchestrationIntentEventId,
          occurredAt: validation.command.occurredAt,
        }),
        validationIssues: warnings.length > 0
          ? warnings.map((issue) => Object.freeze({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          }))
          : undefined,
      }),
      readiness,
      warnings,
    });
  }

  private async resolveSubmissionReadiness(
    input: SubmitImageRunRequest,
    validation: Extract<ValidateRunSubmissionResult, { readonly ok: true }>,
  ): Promise<ImageRunSubmissionReadinessResult> {
    const resolver = this.dependencies.imageRunReadinessResolver;
    if (!resolver?.resolveRunSubmissionReadiness) {
      return buildImageRunSubmissionReadinessResult({
        checkedAt: validation.command.occurredAt,
        issues: Object.freeze([]),
        policyDenials: Object.freeze([]),
        assetBinding: Object.freeze({
          complete: true,
          missingInputBindingIds: Object.freeze([]),
          missingOutputBindingIds: Object.freeze([]),
          unresolvedAssetReferences: Object.freeze([]),
        }),
        workflowValidity: Object.freeze({
          valid: true,
          issues: Object.freeze([]),
        }),
        systemValidity: Object.freeze({
          valid: true,
          issues: Object.freeze([]),
        }),
        backendReadinessDependency: Object.freeze({
          adapterHealth: "unknown",
          ready: true,
          issues: Object.freeze([]),
        }),
        compatibility: Object.freeze({
          compatible: true,
          issues: Object.freeze([]),
        }),
      });
    }

    try {
      return await resolver.resolveRunSubmissionReadiness({
        workspaceId: validation.command.workspaceId,
        systemId: validation.command.runtimeTarget.systemId,
        workflowId: validation.command.workflowId,
        operationKind: normalizeOptional(input.readiness?.operationKind),
        translationContractVersion: normalizeOptional(input.readiness?.translationContractVersion),
        inputAssetBindingIds: input.readiness?.inputAssetBindingIds,
        outputBindingIds: input.readiness?.outputBindingIds,
        referencedAssetIds: input.readiness?.referencedAssetIds,
      });
    } catch {
      const checkedAt = this.now().toISOString();
      const readinessIssue = Object.freeze({
        code: "submission-readiness-evaluation-failed",
        summary: "Run submission readiness could not be evaluated.",
        category: ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
        severity: "error" as const,
        blocking: true,
      });
      return buildImageRunSubmissionReadinessResult({
        checkedAt,
        issues: Object.freeze([readinessIssue]),
        policyDenials: Object.freeze([]),
        assetBinding: Object.freeze({
          complete: true,
          missingInputBindingIds: Object.freeze([]),
          missingOutputBindingIds: Object.freeze([]),
          unresolvedAssetReferences: Object.freeze([]),
        }),
        workflowValidity: Object.freeze({
          valid: true,
          issues: Object.freeze([]),
        }),
        systemValidity: Object.freeze({
          valid: true,
          issues: Object.freeze([]),
        }),
        backendReadinessDependency: Object.freeze({
          adapterHealth: "unknown",
          ready: false,
          issues: Object.freeze([readinessIssue]),
        }),
        compatibility: Object.freeze({
          compatible: true,
          issues: Object.freeze([]),
        }),
      });
    }
  }
}

function toValidationIssues(issues: ReadonlyArray<ImageRunSubmissionReadinessIssue>): ReadonlyArray<RunSubmissionValidationIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({
    kind: mapReadinessCategoryToValidationKind(issue),
    path: issue.path ?? "submission.readiness",
    code: issue.code,
    message: issue.summary,
    details: Object.freeze({
      category: issue.category,
      severity: issue.severity,
      blocking: issue.blocking,
    }),
  })));
}

function mapReadinessCategoryToValidationKind(issue: ImageRunSubmissionReadinessIssue): RunSubmissionValidationIssue["kind"] {
  if (issue.category === ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency) {
    return RunSubmissionValidationIssueKinds.availability;
  }
  if (issue.category === ImageRunSubmissionReadinessIssueCategories.policyDenial) {
    return RunSubmissionValidationIssueKinds.policy;
  }
  if (issue.category === ImageRunSubmissionReadinessIssueCategories.advisory) {
    return RunSubmissionValidationIssueKinds.policy;
  }
  return issue.blocking
    ? RunSubmissionValidationIssueKinds.policy
    : RunSubmissionValidationIssueKinds.availability;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
