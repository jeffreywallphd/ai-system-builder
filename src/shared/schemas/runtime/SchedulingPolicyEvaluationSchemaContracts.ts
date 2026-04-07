import { z } from "zod";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeRoleCapabilities, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import {
  SchedulingCandidateDenialCodes,
  SchedulingDecisionOutcomes,
  SchedulingPolicySourceKinds,
  SchedulingRunPriorityBands,
  SchedulingNodeUsageModes,
} from "@domain/scheduling/SchedulingDomain";
import {
  SchedulingPolicyEvaluationContractVersions,
  SchedulingPolicyEvaluationReasonCodes,
  type SchedulingAssignmentIntent,
  type SchedulingCandidateReasoningSummary,
  type SchedulingDecisionBundle,
  type SchedulingEvaluationSnapshot,
  type SchedulingPolicyEvaluationResult,
  type SchedulingQueueEvaluationSummary,
} from "@shared/contracts/runtime/SchedulingPolicyEvaluationContracts";

export interface SchedulingPolicyEvaluationSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class SchedulingPolicyEvaluationSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<SchedulingPolicyEvaluationSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<SchedulingPolicyEvaluationSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "SchedulingPolicyEvaluationSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });

const SchedulingRunPriorityBandSchema = z.enum([
  SchedulingRunPriorityBands.critical,
  SchedulingRunPriorityBands.high,
  SchedulingRunPriorityBands.normal,
  SchedulingRunPriorityBands.low,
]);

const SchedulingDecisionOutcomeSchema = z.enum([
  SchedulingDecisionOutcomes.assignmentRecommended,
  SchedulingDecisionOutcomes.deferred,
  SchedulingDecisionOutcomes.denied,
]);

const SchedulingPolicySourceKindSchema = z.enum([
  SchedulingPolicySourceKinds.runSubmission,
  SchedulingPolicySourceKinds.nodeTrustInventory,
  SchedulingPolicySourceKinds.workspaceMembershipRoles,
  SchedulingPolicySourceKinds.deploymentProfile,
  SchedulingPolicySourceKinds.activeReservations,
  SchedulingPolicySourceKinds.futureQuotaPolicy,
  SchedulingPolicySourceKinds.futureAffinityPolicy,
]);

const SchedulingNodeUsageModeSchema = z.enum([
  SchedulingNodeUsageModes.idle,
  SchedulingNodeUsageModes.remoteQueuedWork,
  SchedulingNodeUsageModes.interactiveLocalSession,
  SchedulingNodeUsageModes.maintenance,
]);

const WorkspaceRoleKeySchema = z.enum([
  WorkspaceAuthorizationRoleKeys.owner,
  WorkspaceAuthorizationRoleKeys.admin,
  WorkspaceAuthorizationRoleKeys.member,
  WorkspaceAuthorizationRoleKeys.viewer,
]);

const NodeTypeSchema = z.enum([
  NodeTypes.compute,
  NodeTypes.hybrid,
  NodeTypes.edge,
]);

const NodeCapabilitySchema = z.enum([
  NodeRoleCapabilities.ui,
  NodeRoleCapabilities.api,
  NodeRoleCapabilities.scheduler,
  NodeRoleCapabilities.executor,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.previewWorker,
]);

const SchedulingPolicyReasonSchema = z.object({
  code: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2048),
  details: z.record(z.string(), z.unknown()).optional(),
}).strict();

const SchedulingRunRequirementsSchema = z.object({
  requiredCapabilities: z.array(NodeCapabilitySchema).max(64),
  requiresRemoteScheduling: z.boolean(),
}).strict();

const SchedulingRunQueueStateSchema = z.object({
  queueId: IdentifierSchema,
  enteredAt: TimestampSchema,
  eligibleAt: TimestampSchema,
  claimToken: IdentifierSchema,
  claimOwner: IdentifierSchema,
}).strict();

const SchedulingRunPolicyInputSchema = z.object({
  runId: IdentifierSchema,
  workspaceId: IdentifierSchema.optional(),
  submittedByUserIdentityId: IdentifierSchema.optional(),
  workspaceRoleKeys: z.array(z.union([WorkspaceRoleKeySchema, IdentifierSchema])).max(16),
  requirements: SchedulingRunRequirementsSchema,
  queue: SchedulingRunQueueStateSchema,
}).strict();

const SchedulingNodePolicyInputSchema = z.object({
  nodeId: IdentifierSchema,
  nodeType: NodeTypeSchema,
  schedulable: z.boolean(),
  supportsRemoteScheduling: z.boolean(),
  enabledCapabilities: z.array(NodeCapabilitySchema).max(64),
  usageMode: SchedulingNodeUsageModeSchema,
  localInteractiveOwnerUserIdentityId: IdentifierSchema.optional(),
  reservationOwner: IdentifierSchema.optional(),
  deploymentProfileId: IdentifierSchema.optional(),
}).strict();

const SchedulingQueueLeaseSchema = z.object({
  runId: IdentifierSchema,
  queueId: IdentifierSchema,
  enteredAt: TimestampSchema,
  eligibleAt: TimestampSchema,
  claimToken: IdentifierSchema,
  claimOwner: IdentifierSchema,
  claimExpiresAt: TimestampSchema,
}).strict();

const SchedulingPriorityMetadataSchema = z.object({
  priorityBand: SchedulingRunPriorityBandSchema,
  rolePriorityScore: z.number(),
  queueAgeSeconds: z.number().int().min(0),
}).strict();

const SchedulingReservationStatusSchema = z.object({
  claimOwner: IdentifierSchema,
  nodeReservationOwner: IdentifierSchema.optional(),
  reservationConflict: z.boolean(),
}).strict();

const SchedulingCandidateReasoningSummarySchema: z.ZodType<SchedulingCandidateReasoningSummary> = z.object({
  runId: IdentifierSchema,
  nodeId: IdentifierSchema,
  eligible: z.boolean(),
  priority: SchedulingPriorityMetadataSchema,
  reservation: SchedulingReservationStatusSchema,
  exclusionReasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
  exclusionReasons: z.array(SchedulingPolicyReasonSchema).max(64),
}).strict().superRefine((value, context) => {
  if (value.eligible && value.exclusionReasonCodes.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exclusionReasonCodes"],
      message: "eligible candidates cannot carry exclusionReasonCodes.",
    });
  }

  if (value.eligible && value.exclusionReasons.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exclusionReasons"],
      message: "eligible candidates cannot carry exclusionReasons.",
    });
  }
});

const SchedulingCandidateScorecardSchema = z.object({
  priorityBand: SchedulingRunPriorityBandSchema,
  rolePriorityScore: z.number(),
  queueAgeSeconds: z.number().int().min(0),
}).strict();

const SchedulingCandidateDecisionSchema = z.object({
  runId: IdentifierSchema,
  nodeId: IdentifierSchema,
  eligible: z.boolean(),
  denialReasons: z.array(SchedulingPolicyReasonSchema).max(64),
  scorecard: SchedulingCandidateScorecardSchema,
}).strict().superRefine((value, context) => {
  if (value.eligible && value.denialReasons.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["denialReasons"],
      message: "eligible candidates cannot include denialReasons.",
    });
  }
});

const SchedulingPolicyDecisionSchema = z.object({
  decisionId: IdentifierSchema,
  occurredAt: TimestampSchema,
  outcome: SchedulingDecisionOutcomeSchema,
  selected: z.object({
    runId: IdentifierSchema,
    nodeId: IdentifierSchema,
    claimToken: IdentifierSchema,
    reservationOwner: IdentifierSchema,
  }).strict().optional(),
  evaluatedCandidates: z.array(SchedulingCandidateDecisionSchema),
  reasons: z.array(SchedulingPolicyReasonSchema),
  policySources: z.array(SchedulingPolicySourceKindSchema).min(1),
}).strict().superRefine((value, context) => {
  if (value.outcome !== SchedulingDecisionOutcomes.assignmentRecommended && value.selected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selected"],
      message: "selected is only valid when outcome='assignment-recommended'.",
    });
  }
});

const SchedulingQueueEvaluationSummarySchema: z.ZodType<SchedulingQueueEvaluationSummary> = z.object({
  queueLeaseCount: z.number().int().min(0),
  runCount: z.number().int().min(0),
  nodeCount: z.number().int().min(0),
  candidateCount: z.number().int().min(0),
  eligibleCandidateCount: z.number().int().min(0),
  excludedCandidateCount: z.number().int().min(0),
}).strict().superRefine((value, context) => {
  if (value.candidateCount !== value.eligibleCandidateCount + value.excludedCandidateCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candidateCount"],
      message: "candidateCount must equal eligibleCandidateCount + excludedCandidateCount.",
    });
  }
});

const SchedulingPolicySnapshotMetadataSchema = z.object({
  contractVersion: z.literal(SchedulingPolicyEvaluationContractVersions.v1),
  decisionId: IdentifierSchema,
  occurredAt: TimestampSchema,
  policySources: z.array(SchedulingPolicySourceKindSchema).min(1),
  deploymentProfileId: IdentifierSchema.optional(),
}).strict();

const SchedulingPolicyEvaluationResultSchema: z.ZodType<SchedulingPolicyEvaluationResult> = z.object({
  snapshot: SchedulingPolicySnapshotMetadataSchema,
  outcome: SchedulingDecisionOutcomeSchema,
  selected: z.object({
    runId: IdentifierSchema,
    nodeId: IdentifierSchema,
    claimToken: IdentifierSchema,
    reservationOwner: IdentifierSchema,
  }).strict().optional(),
  summary: SchedulingQueueEvaluationSummarySchema,
  queueEvaluation: z.array(SchedulingCandidateReasoningSummarySchema),
  reasons: z.array(SchedulingPolicyReasonSchema),
}).strict().superRefine((value, context) => {
  if (value.outcome !== SchedulingDecisionOutcomes.assignmentRecommended && value.selected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selected"],
      message: "selected is only valid when outcome='assignment-recommended'.",
    });
  }

  if (value.summary.candidateCount !== value.queueEvaluation.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["summary", "candidateCount"],
      message: "summary.candidateCount must match queueEvaluation.length.",
    });
  }
});

const SchedulingEvaluationSnapshotSchema: z.ZodType<SchedulingEvaluationSnapshot> = z.object({
  asOf: TimestampSchema,
  queueLeases: z.array(SchedulingQueueLeaseSchema),
  runs: z.array(SchedulingRunPolicyInputSchema),
  nodes: z.array(SchedulingNodePolicyInputSchema),
  deploymentProfileId: IdentifierSchema.optional(),
}).strict();

const SchedulingAssignmentIntentSchema: z.ZodType<SchedulingAssignmentIntent> = z.object({
  runId: IdentifierSchema,
  nodeId: IdentifierSchema,
  queueId: IdentifierSchema,
  claimToken: IdentifierSchema,
  reservationOwner: IdentifierSchema,
  decisionId: IdentifierSchema,
  decidedAt: TimestampSchema,
}).strict();

const SchedulingDecisionBundleSchema: z.ZodType<SchedulingDecisionBundle> = z.object({
  snapshot: SchedulingEvaluationSnapshotSchema,
  decision: SchedulingPolicyDecisionSchema,
  assignmentIntents: z.array(SchedulingAssignmentIntentSchema),
  evaluation: SchedulingPolicyEvaluationResultSchema,
}).strict();

export const SchedulingPolicyEvaluationReasonCodeSchema = z.enum([
  SchedulingPolicyEvaluationReasonCodes.queueEmpty,
  SchedulingPolicyEvaluationReasonCodes.noEligibleCandidates,
  SchedulingPolicyEvaluationReasonCodes.deferredByPolicy,
  SchedulingPolicyEvaluationReasonCodes.deniedByPolicy,
  SchedulingPolicyEvaluationReasonCodes.capacityUnavailable,
  SchedulingPolicyEvaluationReasonCodes.arbitrationSuppressed,
]);

export const SchedulingCandidateDenialCodeSchema = z.enum([
  SchedulingCandidateDenialCodes.nodeNotSchedulable,
  SchedulingCandidateDenialCodes.nodeMissingCapability,
  SchedulingCandidateDenialCodes.remoteSchedulingUnsupported,
  SchedulingCandidateDenialCodes.reservationConflict,
  SchedulingCandidateDenialCodes.hybridLocalInteractiveProtection,
  SchedulingCandidateDenialCodes.policyDenied,
]);

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function parseSchedulingSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new SchedulingPolicyEvaluationSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export type SchedulingEvaluationSnapshotPayload = z.infer<typeof SchedulingEvaluationSnapshotSchema>;
export type SchedulingAssignmentIntentPayload = z.infer<typeof SchedulingAssignmentIntentSchema>;
export type SchedulingPolicyEvaluationResultPayload = z.infer<typeof SchedulingPolicyEvaluationResultSchema>;
export type SchedulingDecisionBundlePayload = z.infer<typeof SchedulingDecisionBundleSchema>;
export type SchedulingQueueEvaluationSummaryPayload = z.infer<typeof SchedulingQueueEvaluationSummarySchema>;

export function parseSchedulingEvaluationSnapshot(payload: unknown): SchedulingEvaluationSnapshotPayload {
  return parseSchedulingSchema("SchedulingEvaluationSnapshot", SchedulingEvaluationSnapshotSchema, payload);
}

export function parseSchedulingAssignmentIntent(payload: unknown): SchedulingAssignmentIntentPayload {
  return parseSchedulingSchema("SchedulingAssignmentIntent", SchedulingAssignmentIntentSchema, payload);
}

export function parseSchedulingQueueEvaluationSummary(payload: unknown): SchedulingQueueEvaluationSummaryPayload {
  return parseSchedulingSchema("SchedulingQueueEvaluationSummary", SchedulingQueueEvaluationSummarySchema, payload);
}

export function parseSchedulingPolicyEvaluationResult(payload: unknown): SchedulingPolicyEvaluationResultPayload {
  return parseSchedulingSchema("SchedulingPolicyEvaluationResult", SchedulingPolicyEvaluationResultSchema, payload);
}

export function parseSchedulingDecisionBundle(payload: unknown): SchedulingDecisionBundlePayload {
  return parseSchedulingSchema("SchedulingDecisionBundle", SchedulingDecisionBundleSchema, payload);
}
