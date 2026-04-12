import { resolveRunSubmissionSource } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { RunSubmissionSources } from "@domain/runs/RunDomain";
import type {
  CanonicalRunSubmissionCommand,
  RunSubmissionValidationIssue,
} from "./RunSubmissionValidationContracts";
import {
  RunSubmissionValidationIssueKinds,
  RunSubmissionValidationErrorCodes,
} from "./RunSubmissionValidationContracts";
import { isCatalogPermissionKey } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  RunSubmissionSecurityPrerequisiteKinds,
  type RunSubmissionResourceReference,
  type RunSubmissionSecurityPrerequisite,
  type RunSubmissionStorageReference,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import { ProtectedDataClasses } from "@domain/security/EncryptionAtRestPolicyDomain";
import type { ValidateRunSubmissionRequest } from "./RunSubmissionValidationContracts";

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function pushIssue(
  issues: RunSubmissionValidationIssue[],
  path: string,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): void {
  issues.push(Object.freeze({
    kind: RunSubmissionValidationIssueKinds.structural,
    path,
    code,
    message,
    details,
  }));
}

function normalizeIsoTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function normalizeTags(tags: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped].sort((left, right) => left.localeCompare(right)));
}

function normalizeParameters(
  value: Readonly<Record<string, unknown>> | undefined,
  issues: RunSubmissionValidationIssue[],
): Readonly<Record<string, unknown>> {
  if (!value) {
    return Object.freeze({});
  }

  const output: Record<string, unknown> = {};
  const keyPattern = /^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/;
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!key) {
      pushIssue(issues, "submission.parameters", "parameter-key-empty", "Parameter keys must not be empty.");
      continue;
    }
    if (!keyPattern.test(key)) {
      pushIssue(issues, `submission.parameters.${key}`, "parameter-key-invalid", "Parameter keys must be alphanumeric and may include '.', '-', '_' characters.");
      continue;
    }
    output[key] = rawValue;
  }

  return Object.freeze(output);
}

function normalizeStorageReferences(
  value: ReadonlyArray<RunSubmissionStorageReference> | undefined,
  issues: RunSubmissionValidationIssue[],
): ReadonlyArray<RunSubmissionStorageReference> {
  if (!value || value.length === 0) {
    return Object.freeze([]);
  }

  const deduped = new Map<string, RunSubmissionStorageReference>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const storageInstanceId = normalizeOptional(item.storageInstanceId);
    if (!storageInstanceId) {
      pushIssue(issues, `submission.storageReferences[${index}].storageInstanceId`, "storage-reference-missing-id", "storageInstanceId is required.");
      continue;
    }
    const requiredAction = normalizeOptional(item.requiredAction);
    deduped.set(storageInstanceId, Object.freeze({
      storageInstanceId,
      requiredAction,
    }));
  }

  return Object.freeze([...deduped.values()].sort((left, right) => left.storageInstanceId.localeCompare(right.storageInstanceId)));
}

function normalizeResourceReferences(
  value: ReadonlyArray<RunSubmissionResourceReference> | undefined,
  issues: RunSubmissionValidationIssue[],
): ReadonlyArray<RunSubmissionResourceReference> {
  if (!value || value.length === 0) {
    return Object.freeze([]);
  }

  const output: RunSubmissionResourceReference[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const resourceType = normalizeOptional(item.resourceType);
    const resourceId = normalizeOptional(item.resourceId);
    if (!resourceType || !resourceId) {
      pushIssue(
        issues,
        `submission.resourceReferences[${index}]`,
        "resource-reference-invalid",
        "resourceType and resourceId are required.",
      );
      continue;
    }

    const requiredPermissionKey = normalizeOptional(item.requiredPermissionKey);
    if (requiredPermissionKey && !isCatalogPermissionKey(requiredPermissionKey)) {
      pushIssue(
        issues,
        `submission.resourceReferences[${index}].requiredPermissionKey`,
        "resource-reference-invalid-permission",
        `Permission key '${requiredPermissionKey}' is not part of the authorization catalog.`,
      );
      continue;
    }

    const dedupeKey = `${item.resourceFamily}:${resourceType}:${resourceId}:${requiredPermissionKey ?? ""}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    output.push(Object.freeze({
      resourceFamily: item.resourceFamily,
      resourceType,
      resourceId,
      requiredPermissionKey,
    }));
  }

  return Object.freeze(output.sort((left, right) => {
    const leftKey = `${left.resourceFamily}:${left.resourceType}:${left.resourceId}`;
    const rightKey = `${right.resourceFamily}:${right.resourceType}:${right.resourceId}`;
    return leftKey.localeCompare(rightKey);
  }));
}

function normalizePolicyPrerequisites(
  value: ReadonlyArray<RunSubmissionSecurityPrerequisite> | undefined,
  issues: RunSubmissionValidationIssue[],
): ReadonlyArray<RunSubmissionSecurityPrerequisite> {
  if (!value || value.length === 0) {
    return Object.freeze([]);
  }

  const output: RunSubmissionSecurityPrerequisite[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const id = normalizeOptional(item.id);
    const storageInstanceId = normalizeOptional(item.storageInstanceId);
    const expected = item.expected ?? true;

    if (!Object.values(RunSubmissionSecurityPrerequisiteKinds).includes(item.kind)) {
      pushIssue(
        issues,
        `submission.policyPrerequisites[${index}].kind`,
        "policy-prerequisite-kind-invalid",
        `Unsupported policy prerequisite kind '${String(item.kind)}'.`,
      );
      continue;
    }

    let dataClass = item.dataClass;
    if (
      item.kind !== RunSubmissionSecurityPrerequisiteKinds.custom
      && dataClass === undefined
    ) {
      dataClass = ProtectedDataClasses.assetContent;
    }
    if (dataClass && !Object.values(ProtectedDataClasses).includes(dataClass)) {
      pushIssue(
        issues,
        `submission.policyPrerequisites[${index}].dataClass`,
        "policy-prerequisite-data-class-invalid",
        `Unsupported protected data class '${String(dataClass)}'.`,
      );
      continue;
    }

    const dedupeKey = `${id ?? ""}:${item.kind}:${storageInstanceId ?? ""}:${dataClass ?? ""}:${expected}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    output.push(Object.freeze({
      id,
      kind: item.kind,
      storageInstanceId,
      dataClass,
      expected,
    }));
  }

  return Object.freeze(output);
}

export function normalizeRunSubmissionStructuralInput(input: ValidateRunSubmissionRequest): {
  readonly issues: ReadonlyArray<RunSubmissionValidationIssue>;
  readonly command?: CanonicalRunSubmissionCommand;
} {
  const issues: RunSubmissionValidationIssue[] = [];

  const actorUserIdentityId = normalizeOptional(input.actor.actorUserIdentityId);
  const actorServiceId = normalizeOptional(input.actor.actorServiceId);
  const activeWorkspaceId = normalizeOptional(input.actor.activeWorkspaceId);
  if (!actorUserIdentityId && !actorServiceId) {
    pushIssue(
      issues,
      "actor",
      "actor-missing",
      "Either actor.actorUserIdentityId or actor.actorServiceId is required.",
    );
  }

  const workspaceId = normalizeOptional(input.submission.workspaceId) ?? activeWorkspaceId;
  if (!workspaceId) {
    pushIssue(issues, "submission.workspaceId", "workspace-missing", "workspaceId is required.");
  }
  if (workspaceId && activeWorkspaceId && workspaceId !== activeWorkspaceId) {
    pushIssue(
      issues,
      "submission.workspaceId",
      "workspace-mismatch",
      "submission.workspaceId must match actor.activeWorkspaceId when both are provided.",
      Object.freeze({ workspaceId, activeWorkspaceId }),
    );
  }

  const systemId = normalizeOptional(input.submission.runtimeTarget.systemId);
  if (!systemId) {
    pushIssue(issues, "submission.runtimeTarget.systemId", "system-missing", "runtimeTarget.systemId is required.");
  }

  const versionId = normalizeOptional(input.submission.runtimeTarget.versionId);
  if (!versionId) {
    pushIssue(issues, "submission.runtimeTarget.versionId", "version-missing", "runtimeTarget.versionId is required.");
  }

  const source = resolveRunSubmissionSource(input.submission.source);
  if (source === RunSubmissionSources.uiManual && input.submission.source && input.submission.source !== source) {
    pushIssue(
      issues,
      "submission.source",
      "source-invalid",
      `Unsupported run submission source '${input.submission.source}'.`,
    );
  }

  const occurredAt = normalizeIsoTimestamp(input.occurredAt) ?? new Date().toISOString();
  if (input.occurredAt && !normalizeIsoTimestamp(input.occurredAt)) {
    pushIssue(issues, "occurredAt", "occurred-at-invalid", "occurredAt must be an ISO timestamp when provided.");
  }

  const workflowId = normalizeOptional(input.submission.workflowId);
  const templateId = normalizeOptional(input.submission.templateId);
  const executionId = normalizeOptional(input.submission.runtimeTarget.executionId);
  const tenantId = normalizeOptional(input.submission.runtimeTarget.tenantId);
  const tags = normalizeTags(input.submission.tags);
  const parameters = normalizeParameters(input.submission.parameters, issues);
  const storageReferences = normalizeStorageReferences(input.submission.storageReferences, issues);
  const resourceReferences = normalizeResourceReferences(input.submission.resourceReferences, issues);
  const policyPrerequisites = normalizePolicyPrerequisites(input.submission.policyPrerequisites, issues);

  if (issues.length > 0 || !workspaceId || !systemId || !versionId) {
    return Object.freeze({
      issues: Object.freeze(issues),
    });
  }

  return Object.freeze({
    issues: Object.freeze([]),
    command: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId,
        actorServiceId,
        activeWorkspaceId,
      }),
      workspaceId,
      workflowId,
      templateId,
      source,
      runtimeTarget: Object.freeze({
        systemId,
        versionId,
        executionId,
        tenantId,
        async: input.submission.runtimeTarget.async !== false,
      }),
      tags,
      metadata: input.submission.metadata,
      parameters,
      storageReferences,
      resourceReferences,
      policyPrerequisites,
      submissionContext: Object.freeze({
        submittedByActorId: normalizeOptional(input.submission.submittedByActorId),
        clientRequestId: normalizeOptional(input.submission.clientRequestId),
        correlationId: normalizeOptional(input.submission.correlationId),
        idempotencyKey: normalizeOptional(input.submission.idempotencyKey),
      }),
      occurredAt,
    }),
  });
}

export function classifyFailureCode(
  issues: ReadonlyArray<RunSubmissionValidationIssue>,
): typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes] {
  if (issues.some((issue) => issue.kind === RunSubmissionValidationIssueKinds.authorization)) {
    return RunSubmissionValidationErrorCodes.forbidden;
  }
  if (issues.some((issue) => issue.kind === RunSubmissionValidationIssueKinds.availability)) {
    return RunSubmissionValidationErrorCodes.notFound;
  }
  if (issues.some((issue) => issue.kind === RunSubmissionValidationIssueKinds.policy)) {
    return RunSubmissionValidationErrorCodes.policyIneligible;
  }
  return RunSubmissionValidationErrorCodes.invalidRequest;
}
