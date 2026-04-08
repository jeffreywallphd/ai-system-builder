import {
  AuthorizationPolicyEvaluationTargetKinds,
  type AuthorizationPolicyDecisionEvaluationResult,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import {
  AuthorizationResourceFamilies,
  type AuthorizationResourceFamily,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import { WorkspaceStatuses } from "@domain/workspaces/WorkspaceDomain";
import type { IWorkspaceRepository } from "@application/workspaces/ports/IWorkspaceRepository";
import { StoragePolicyActions, type IStoragePolicyEvaluationPort } from "@application/storage/ports/StoragePolicyEvaluationPort";
import type { IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import type { IEncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationServiceContracts";
import {
  RunSubmissionSecurityPrerequisiteKinds,
  type IRunSubmissionTargetResolverPort,
  type RunSubmissionResourceReference,
  type RunSubmissionSecurityPrerequisite,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import {
  classifyFailureCode,
  normalizeRunSubmissionStructuralInput,
} from "./RunSubmissionValidationRules";
import {
  RunSubmissionValidationErrorCodes,
  RunSubmissionValidationIssueKinds,
  type CanonicalRunSubmissionCommand,
  type RunSubmissionValidationIssue,
  type ValidateRunSubmissionRequest,
  type ValidateRunSubmissionResult,
} from "./RunSubmissionValidationContracts";
import {
  RunSubmissionAuditEventTypes,
  publishRunSubmissionAuditEventBestEffort,
  type RunSubmissionAuditSink,
  type RunSubmissionAuditEvent,
} from "./RunSubmissionAudit";
import type { DeploymentPolicyEvaluationContext } from "@application/policy-administration/DeploymentPolicyEvaluationContracts";
import type { IDeploymentSchedulingPolicyEvaluationPort } from "@application/policy-administration/DeploymentPolicyEvaluationPorts";

const DeploymentApprovalPolicyPrerequisiteIds = Object.freeze({
  ownerOrInstructor: "deployment-approval:owner-or-instructor",
  ownerOrAdmin: "deployment-approval:owner-or-admin",
  ownerWithManualReview: "deployment-approval:owner-with-manual-review",
  highRiskDualApproval: "deployment-approval:high-risk-dual-approval",
});

const HighRiskRunTags = Object.freeze([
  "risk:high",
  "risk:critical",
]);

export interface ValidateRunSubmissionUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly authorizationDecisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly targetResolver: IRunSubmissionTargetResolverPort;
  readonly storageInstanceRepository?: IStorageInstanceRepository;
  readonly storagePolicyEvaluationPort?: IStoragePolicyEvaluationPort;
  readonly encryptionPolicyEvaluationService?: IEncryptionPolicyEvaluationService;
  readonly deploymentSchedulingPolicyEvaluationPort?: IDeploymentSchedulingPolicyEvaluationPort;
  readonly deploymentPolicyContextResolver?: {
    resolveContext(input: {
      readonly workspaceId: string;
      readonly actorUserIdentityId?: string;
      readonly actorServiceId?: string;
      readonly occurredAt: string;
    }): Promise<DeploymentPolicyEvaluationContext | undefined>;
  };
  readonly auditSink?: RunSubmissionAuditSink;
  readonly clock?: {
    now(): Date;
  };
}

const ResourceTypes = Object.freeze({
  runtimeSystem: "runtime-system",
  workflowDefinition: "workflow-definition",
  workflowTemplate: "workflow-template",
});

export class ValidateRunSubmissionUseCase {
  public constructor(private readonly dependencies: ValidateRunSubmissionUseCaseDependencies) {}

  public async execute(input: ValidateRunSubmissionRequest): Promise<ValidateRunSubmissionResult> {
    const structural = normalizeRunSubmissionStructuralInput(input);
    if (!structural.command) {
      const failure = this.failure(
        RunSubmissionValidationErrorCodes.invalidRequest,
        "Run submission payload is invalid.",
        structural.issues,
      );
      await this.publishDeniedAuditEvent(input, failure.error.code, failure.error.validationIssues);
      return failure;
    }

    const policyIssues = await this.evaluatePolicyEligibility(structural.command);
    if (policyIssues.length > 0) {
      const code = classifyFailureCode(policyIssues);
      const failure = this.failure(
        code,
        this.resolveFailureMessage(code),
        policyIssues,
      );
      await this.publishDeniedAuditEvent(input, failure.error.code, failure.error.validationIssues);
      return failure;
    }

    return Object.freeze({
      ok: true,
      command: structural.command,
    });
  }

  private async evaluatePolicyEligibility(command: CanonicalRunSubmissionCommand): Promise<ReadonlyArray<RunSubmissionValidationIssue>> {
    const issues: RunSubmissionValidationIssue[] = [];
    const occurredAt = command.occurredAt;

    const workspace = await this.dependencies.workspaceRepository.findWorkspaceById(command.workspaceId);
    if (!workspace) {
      issues.push(this.availabilityIssue("submission.workspaceId", "workspace-not-found", `Workspace '${command.workspaceId}' was not found.`));
      return Object.freeze(issues);
    }
    if (workspace.status !== WorkspaceStatuses.active) {
      issues.push(this.policyIssue("submission.workspaceId", "workspace-not-active", `Workspace '${command.workspaceId}' is not active.`));
    }

    const targetResolution = await this.dependencies.targetResolver.resolveRunSubmissionTarget({
      workspaceId: command.workspaceId,
      systemId: command.runtimeTarget.systemId,
      versionId: command.runtimeTarget.versionId,
      workflowId: command.workflowId,
      templateId: command.templateId,
      occurredAt: command.occurredAt,
    });

    if (!targetResolution.systemExists) {
      issues.push(this.availabilityIssue(
        "submission.runtimeTarget.systemId",
        "target-system-not-found",
        `System '${command.runtimeTarget.systemId}' was not found.`,
      ));
    }
    if (!targetResolution.versionExists) {
      issues.push(this.availabilityIssue(
        "submission.runtimeTarget.versionId",
        "target-version-not-found",
        `Version '${command.runtimeTarget.versionId}' was not found for system '${command.runtimeTarget.systemId}'.`,
      ));
    }
    if (command.workflowId && targetResolution.workflowExists === false) {
      issues.push(this.availabilityIssue(
        "submission.workflowId",
        "target-workflow-not-found",
        `Workflow '${command.workflowId}' was not found.`,
      ));
    }
    if (command.workflowId && targetResolution.workflowWorkspaceId && targetResolution.workflowWorkspaceId !== command.workspaceId) {
      issues.push(this.policyIssue(
        "submission.workflowId",
        "workflow-workspace-mismatch",
        `Workflow '${command.workflowId}' does not belong to workspace '${command.workspaceId}'.`,
      ));
    }
    if (command.templateId && targetResolution.templateExists === false) {
      issues.push(this.availabilityIssue(
        "submission.templateId",
        "target-template-not-found",
        `Template '${command.templateId}' was not found.`,
      ));
    }

    if (targetResolution.allowedParameterKeys && targetResolution.allowedParameterKeys.length > 0) {
      const allowed = new Set(targetResolution.allowedParameterKeys);
      for (const parameterKey of Object.keys(command.parameters)) {
        if (!allowed.has(parameterKey)) {
          issues.push(this.policyIssue(
            `submission.parameters.${parameterKey}`,
            "parameter-not-allowed",
            `Parameter '${parameterKey}' is not allowed by the submission target policy.`,
          ));
        }
      }
    }

    const requiredPrerequisites = new Set(targetResolution.requiredPolicyPrerequisiteIds ?? []);

    const deploymentApprovalPrerequisites = await this.resolveDeploymentApprovalPrerequisites(command, occurredAt);
    for (const prerequisiteId of deploymentApprovalPrerequisites) {
      requiredPrerequisites.add(prerequisiteId);
    }

    if (requiredPrerequisites.size > 0) {
      const provided = new Set(command.policyPrerequisites.map((entry) => entry.id).filter((entry): entry is string => Boolean(entry)));
      for (const prerequisiteId of requiredPrerequisites) {
        if (!provided.has(prerequisiteId)) {
          issues.push(this.policyIssue(
            "submission.policyPrerequisites",
            "missing-policy-prerequisite",
            `Missing required policy prerequisite '${prerequisiteId}'.`,
          ));
        }
      }
    }

    const submissionPermission = await this.checkAuthorization({
      command,
      path: "submission.runtimeTarget.systemId",
      code: "system-execute-not-authorized",
      message: `Actor is not authorized to execute system '${command.runtimeTarget.systemId}'.`,
      requiredPermissionKey: "system.execute",
      resourceFamily: AuthorizationResourceFamilies.system,
      resourceType: ResourceTypes.runtimeSystem,
      resourceId: command.runtimeTarget.systemId,
    });
    if (submissionPermission) {
      issues.push(submissionPermission);
    }

    if (command.workflowId) {
      const workflowPermission = await this.checkAuthorization({
        command,
        path: "submission.workflowId",
        code: "workflow-run-not-authorized",
        message: `Actor is not authorized to run workflow '${command.workflowId}'.`,
        requiredPermissionKey: "workflow.run",
        resourceFamily: AuthorizationResourceFamilies.workflow,
        resourceType: ResourceTypes.workflowDefinition,
        resourceId: command.workflowId,
      });
      if (workflowPermission) {
        issues.push(workflowPermission);
      }
    }

    if (command.templateId) {
      const templatePermission = await this.checkAuthorization({
        command,
        path: "submission.templateId",
        code: "template-instantiate-not-authorized",
        message: `Actor is not authorized to instantiate template '${command.templateId}'.`,
        requiredPermissionKey: "template.instantiate",
        resourceFamily: AuthorizationResourceFamilies.template,
        resourceType: ResourceTypes.workflowTemplate,
        resourceId: command.templateId,
      });
      if (templatePermission) {
        issues.push(templatePermission);
      }
    }

    for (const reference of command.resourceReferences) {
      const issue = await this.validateResourceReference(command, reference);
      if (issue) {
        issues.push(issue);
      }
    }

    const storageIssues = await this.validateStorageReferences(command);
    issues.push(...storageIssues);

    const securityIssues = await this.validateSecurityPrerequisites(command);
    issues.push(...securityIssues);

    return Object.freeze(issues);
  }

  private async resolveDeploymentApprovalPrerequisites(
    command: CanonicalRunSubmissionCommand,
    occurredAt: string,
  ): Promise<ReadonlyArray<string>> {
    if (
      !this.dependencies.deploymentSchedulingPolicyEvaluationPort
      || !this.dependencies.deploymentPolicyContextResolver
    ) {
      return Object.freeze([]);
    }

    const context = await this.dependencies.deploymentPolicyContextResolver.resolveContext({
      workspaceId: command.workspaceId,
      actorUserIdentityId: command.actor.actorUserIdentityId,
      actorServiceId: command.actor.actorServiceId,
      occurredAt,
    });
    if (!context) {
      return Object.freeze([]);
    }

    const schedulingPolicy = await this.dependencies.deploymentSchedulingPolicyEvaluationPort.evaluateSchedulingPolicy(context);
    const prerequisites = new Set<string>();
    const approvalMode = schedulingPolicy.runSubmissionApprovalMode.value;

    if (approvalMode === "owner-or-instructor") {
      prerequisites.add(DeploymentApprovalPolicyPrerequisiteIds.ownerOrInstructor);
    } else if (approvalMode === "owner-or-admin") {
      prerequisites.add(DeploymentApprovalPolicyPrerequisiteIds.ownerOrAdmin);
    } else if (approvalMode === "owner-with-manual-review") {
      prerequisites.add(DeploymentApprovalPolicyPrerequisiteIds.ownerWithManualReview);
    }

    if (
      schedulingPolicy.highRiskRunRequiresDualApproval.value
      && command.tags.some((tag) => HighRiskRunTags.includes(tag.toLowerCase()))
    ) {
      prerequisites.add(DeploymentApprovalPolicyPrerequisiteIds.highRiskDualApproval);
    }

    return Object.freeze([...prerequisites]);
  }

  private async validateResourceReference(
    command: CanonicalRunSubmissionCommand,
    reference: RunSubmissionResourceReference,
  ): Promise<RunSubmissionValidationIssue | undefined> {
    const requiredPermissionKey = reference.requiredPermissionKey ?? `${reference.resourceFamily}.read`;
    return this.checkAuthorization({
      command,
      path: `submission.resourceReferences.${reference.resourceFamily}:${reference.resourceType}:${reference.resourceId}`,
      code: "resource-reference-not-authorized",
      message: `Actor is not authorized for resource '${reference.resourceFamily}:${reference.resourceType}:${reference.resourceId}' with permission '${requiredPermissionKey}'.`,
      requiredPermissionKey,
      resourceFamily: reference.resourceFamily,
      resourceType: reference.resourceType,
      resourceId: reference.resourceId,
    });
  }

  private async checkAuthorization(input: {
    readonly command: CanonicalRunSubmissionCommand;
    readonly path: string;
    readonly code: string;
    readonly message: string;
    readonly requiredPermissionKey: string;
    readonly resourceFamily: AuthorizationResourceFamily;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<RunSubmissionValidationIssue | undefined> {
    const decision = await this.dependencies.authorizationDecisionEvaluator.evaluateDecision({
      actor: input.command.actor,
      requiredPermissionKey: input.requiredPermissionKey,
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: Object.freeze({
          resourceFamily: input.resourceFamily,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        }),
      }),
      asOf: input.command.occurredAt,
    });

    if (decision.decision.isAllowed) {
      return undefined;
    }

    return this.authorizationIssue(
      input.path,
      input.code,
      input.message,
      decision,
    );
  }

  private async validateStorageReferences(
    command: CanonicalRunSubmissionCommand,
  ): Promise<ReadonlyArray<RunSubmissionValidationIssue>> {
    if (!this.dependencies.storageInstanceRepository || !this.dependencies.storagePolicyEvaluationPort) {
      return Object.freeze([]);
    }

    const issues: RunSubmissionValidationIssue[] = [];
    for (const reference of command.storageReferences) {
      const storageInstance = await this.dependencies.storageInstanceRepository.findStorageInstanceById(reference.storageInstanceId);
      if (!storageInstance) {
        issues.push(this.availabilityIssue(
          `submission.storageReferences.${reference.storageInstanceId}`,
          "storage-instance-not-found",
          `Storage instance '${reference.storageInstanceId}' was not found.`,
        ));
        continue;
      }

      if (storageInstance.ownership.workspaceId !== command.workspaceId) {
        issues.push(this.authorizationIssue(
          `submission.storageReferences.${reference.storageInstanceId}`,
          "storage-instance-workspace-mismatch",
          `Storage instance '${reference.storageInstanceId}' is outside workspace '${command.workspaceId}'.`,
        ));
        continue;
      }

      const requiredAction = reference.requiredAction === StoragePolicyActions.view
        ? StoragePolicyActions.view
        : StoragePolicyActions.useForAssets;

      if (!command.actor.actorUserIdentityId) {
        issues.push(this.authorizationIssue(
          `submission.storageReferences.${reference.storageInstanceId}`,
          "storage-policy-actor-required",
          `Actor user identity is required to evaluate storage policy for '${reference.storageInstanceId}'.`,
        ));
        continue;
      }

      const decision = await this.dependencies.storagePolicyEvaluationPort.evaluateStorageAction({
        action: requiredAction,
        actorUserIdentityId: command.actor.actorUserIdentityId,
        workspaceId: command.workspaceId,
        storageInstance,
        occurredAt: command.occurredAt,
      });
      if (!decision.allowed) {
        issues.push(this.policyIssue(
          `submission.storageReferences.${reference.storageInstanceId}`,
          "storage-policy-denied",
          decision.message ?? `Storage policy denied '${requiredAction}' for '${reference.storageInstanceId}'.`,
          Object.freeze({ reasonCode: decision.reasonCode }),
        ));
      }
    }

    return Object.freeze(issues);
  }

  private async validateSecurityPrerequisites(
    command: CanonicalRunSubmissionCommand,
  ): Promise<ReadonlyArray<RunSubmissionValidationIssue>> {
    if (!this.dependencies.encryptionPolicyEvaluationService || command.policyPrerequisites.length === 0) {
      return Object.freeze([]);
    }

    const issues: RunSubmissionValidationIssue[] = [];
    for (const prerequisite of command.policyPrerequisites) {
      const issue = await this.validateSecurityPrerequisite(command, prerequisite);
      if (issue) {
        issues.push(issue);
      }
    }

    return Object.freeze(issues);
  }

  private async validateSecurityPrerequisite(
    command: CanonicalRunSubmissionCommand,
    prerequisite: RunSubmissionSecurityPrerequisite,
  ): Promise<RunSubmissionValidationIssue | undefined> {
    if (prerequisite.kind === RunSubmissionSecurityPrerequisiteKinds.custom) {
      return undefined;
    }

    const expected = prerequisite.expected ?? true;
    const request = Object.freeze({
      dataClass: prerequisite.dataClass!,
      workspaceId: command.workspaceId,
      storageInstanceId: prerequisite.storageInstanceId,
      occurredAt: command.occurredAt,
    });

    if (prerequisite.kind === RunSubmissionSecurityPrerequisiteKinds.contentEncryptionRequired) {
      const decision = await this.dependencies.encryptionPolicyEvaluationService!.evaluateContentEncryptionRequirement(request);
      if (!decision.ok) {
        return this.policyIssue(
          "submission.policyPrerequisites",
          "security-policy-evaluation-failed",
          decision.error.message,
          Object.freeze({ code: decision.error.code }),
        );
      }
      if (decision.value.required !== expected) {
        return this.policyIssue(
          "submission.policyPrerequisites",
          "security-policy-prerequisite-not-satisfied",
          "Content encryption requirement prerequisite was not satisfied.",
          Object.freeze({ expected, actual: decision.value.required }),
        );
      }
      return undefined;
    }

    if (prerequisite.kind === RunSubmissionSecurityPrerequisiteKinds.previewDecryptionAllowed) {
      const decision = await this.dependencies.encryptionPolicyEvaluationService!.evaluatePreviewDecryptionAllowance(request);
      if (!decision.ok) {
        return this.policyIssue(
          "submission.policyPrerequisites",
          "security-policy-evaluation-failed",
          decision.error.message,
          Object.freeze({ code: decision.error.code }),
        );
      }
      if (decision.value.allowed !== expected) {
        return this.policyIssue(
          "submission.policyPrerequisites",
          "security-policy-prerequisite-not-satisfied",
          "Preview decryption allowance prerequisite was not satisfied.",
          Object.freeze({ expected, actual: decision.value.allowed }),
        );
      }
      return undefined;
    }

    const decision = await this.dependencies.encryptionPolicyEvaluationService!.evaluateWorkerDecryptionAllowance(request);
    if (!decision.ok) {
      return this.policyIssue(
        "submission.policyPrerequisites",
        "security-policy-evaluation-failed",
        decision.error.message,
        Object.freeze({ code: decision.error.code }),
      );
    }
    if (decision.value.allowed !== expected) {
      return this.policyIssue(
        "submission.policyPrerequisites",
        "security-policy-prerequisite-not-satisfied",
        "Worker decryption allowance prerequisite was not satisfied.",
        Object.freeze({ expected, actual: decision.value.allowed }),
      );
    }

    return undefined;
  }

  private resolveFailureMessage(code: string): string {
    if (code === RunSubmissionValidationErrorCodes.forbidden) {
      return "Run submission is not authorized for the actor and requested targets.";
    }
    if (code === RunSubmissionValidationErrorCodes.notFound) {
      return "Run submission references targets that do not exist.";
    }
    if (code === RunSubmissionValidationErrorCodes.policyIneligible) {
      return "Run submission is policy-ineligible.";
    }
    return "Run submission payload is invalid.";
  }

  private failure(
    code: typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes],
    message: string,
    issues: ReadonlyArray<RunSubmissionValidationIssue>,
  ): ValidateRunSubmissionResult {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        validationIssues: issues,
      }),
    });
  }

  private async publishDeniedAuditEvent(
    input: ValidateRunSubmissionRequest,
    code: typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes],
    issues: ReadonlyArray<RunSubmissionValidationIssue>,
  ): Promise<void> {
    const event = this.createDeniedAuditEvent(input, code, issues);
    await publishRunSubmissionAuditEventBestEffort(this.dependencies.auditSink, event);
  }

  private createDeniedAuditEvent(
    input: ValidateRunSubmissionRequest,
    code: typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes],
    issues: ReadonlyArray<RunSubmissionValidationIssue>,
  ): RunSubmissionAuditEvent {
    const issueKindCounts = issues.reduce<Record<string, number>>((accumulator, issue) => {
      accumulator[issue.kind] = (accumulator[issue.kind] ?? 0) + 1;
      return accumulator;
    }, {});
    const uniqueIssueCodes = [...new Set(issues.map((issue) => issue.code))].slice(0, 25);

    return Object.freeze({
      type: RunSubmissionAuditEventTypes.submissionDenied,
      occurredAt: this.resolveOccurredAt(input.occurredAt),
      workspaceId: this.normalizeOptional(input.submission.workspaceId),
      actorUserIdentityId: this.normalizeOptional(input.actor.actorUserIdentityId),
      actorServiceId: this.normalizeOptional(input.actor.actorServiceId),
      details: Object.freeze({
        validationCode: code,
        issueCount: issues.length,
        issueKindCounts: Object.freeze(issueKindCounts),
        issueCodes: Object.freeze(uniqueIssueCodes),
        submission: this.createSubmissionSummary(input),
      }),
    });
  }

  private createSubmissionSummary(input: ValidateRunSubmissionRequest): Readonly<Record<string, unknown>> {
    const parameters = input.submission.parameters ?? {};
    const tags = input.submission.tags ?? [];
    const storageReferences = input.submission.storageReferences ?? [];
    const resourceReferences = input.submission.resourceReferences ?? [];
    const policyPrerequisites = input.submission.policyPrerequisites ?? [];
    const metadata = input.submission.metadata ?? {};

    return Object.freeze({
      source: input.submission.source,
      workflowId: this.normalizeOptional(input.submission.workflowId),
      templateId: this.normalizeOptional(input.submission.templateId),
      runtimeTarget: Object.freeze({
        systemId: this.normalizeOptional(input.submission.runtimeTarget.systemId),
        versionId: this.normalizeOptional(input.submission.runtimeTarget.versionId),
        async: input.submission.runtimeTarget.async ?? false,
      }),
      parameterCount: Object.keys(parameters).length,
      tagCount: tags.length,
      storageReferenceCount: storageReferences.length,
      resourceReferenceCount: resourceReferences.length,
      policyPrerequisiteCount: policyPrerequisites.length,
      hasMetadata: Object.keys(metadata).length > 0,
      hasClientRequestId: typeof input.submission.clientRequestId === "string" && input.submission.clientRequestId.trim().length > 0,
      hasCorrelationId: typeof input.submission.correlationId === "string" && input.submission.correlationId.trim().length > 0,
      hasIdempotencyKey: typeof input.submission.idempotencyKey === "string" && input.submission.idempotencyKey.trim().length > 0,
    });
  }

  private resolveOccurredAt(occurredAt: string | undefined): string {
    if (occurredAt && occurredAt.trim().length > 0) {
      return occurredAt;
    }
    const now = this.dependencies.clock?.now() ?? new Date();
    return now.toISOString();
  }

  private normalizeOptional(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  }

  private availabilityIssue(
    path: string,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): RunSubmissionValidationIssue {
    return Object.freeze({
      kind: RunSubmissionValidationIssueKinds.availability,
      path,
      code,
      message,
      details,
    });
  }

  private policyIssue(
    path: string,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): RunSubmissionValidationIssue {
    return Object.freeze({
      kind: RunSubmissionValidationIssueKinds.policy,
      path,
      code,
      message,
      details,
    });
  }

  private authorizationIssue(
    path: string,
    code: string,
    message: string,
    decision?: AuthorizationPolicyDecisionEvaluationResult,
  ): RunSubmissionValidationIssue {
    return Object.freeze({
      kind: RunSubmissionValidationIssueKinds.authorization,
      path,
      code,
      message,
      details: decision ? Object.freeze({
        reasonCode: decision.decision.reasonCode,
        denialReason: decision.decision.denialReason,
      }) : undefined,
    });
  }
}
