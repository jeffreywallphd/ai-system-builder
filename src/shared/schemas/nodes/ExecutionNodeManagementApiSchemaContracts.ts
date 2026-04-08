import { z } from "zod";
import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
  ImageExecutionNodeCompatibilityFindingKinds,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "@domain/nodes/NodeTrustDomain";
import {
  ExecutionNodeEligibilityDecisionKinds,
  ExecutionNodeManagementTransportContractVersions,
  ExecutionNodeReadinessIssueSeverities,
  ExecutionNodeReadinessStates,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";

export interface ExecutionNodeManagementApiSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class ExecutionNodeManagementApiSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<ExecutionNodeManagementApiSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<ExecutionNodeManagementApiSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "ExecutionNodeManagementApiSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;

const IdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(IdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

const TimestampSchema = z
  .string()
  .trim()
  .min(1, "Timestamp is required.")
  .datetime({ offset: true });

const NodeTypeSchema = z.enum([
  NodeTypes.compute,
  NodeTypes.hybrid,
  NodeTypes.edge,
]);

const NodeApprovalStatusSchema = z.enum([
  NodeApprovalStatuses.pending,
  NodeApprovalStatuses.approved,
  NodeApprovalStatuses.rejected,
  NodeApprovalStatuses.suspended,
]);

const NodeTrustStateSchema = z.enum([
  NodeTrustStates.pendingEnrollment,
  NodeTrustStates.pendingApproval,
  NodeTrustStates.trusted,
  NodeTrustStates.quarantined,
  NodeTrustStates.revoked,
]);

const NodeRoleCapabilitySchema = z.enum([
  NodeRoleCapabilities.ui,
  NodeRoleCapabilities.api,
  NodeRoleCapabilities.scheduler,
  NodeRoleCapabilities.executor,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.previewWorker,
]);

const ActivationStatusSchema = z.enum([
  ExecutionNodeActivationStatuses.inactive,
  ExecutionNodeActivationStatuses.pending,
  ExecutionNodeActivationStatuses.approved,
  ExecutionNodeActivationStatuses.active,
  ExecutionNodeActivationStatuses.degraded,
  ExecutionNodeActivationStatuses.unavailable,
  ExecutionNodeActivationStatuses.revoked,
]);

const HealthStatusSchema = z.enum([
  ExecutionNodeHealthStatuses.unknown,
  ExecutionNodeHealthStatuses.ready,
  ExecutionNodeHealthStatuses.degraded,
  ExecutionNodeHealthStatuses.unavailable,
]);

const BackendReadinessStateSchema = z.enum([
  ExecutionNodeBackendReadinessStates.ready,
  ExecutionNodeBackendReadinessStates.degraded,
  ExecutionNodeBackendReadinessStates.unavailable,
  ExecutionNodeBackendReadinessStates.unknown,
]);

const ContractVersionSchema = z.literal(ExecutionNodeManagementTransportContractVersions.v1);

const ReadinessIssueSeveritySchema = z.enum([
  ExecutionNodeReadinessIssueSeverities.error,
  ExecutionNodeReadinessIssueSeverities.warning,
  ExecutionNodeReadinessIssueSeverities.info,
]);

const ReadinessStateSchema = z.enum([
  ExecutionNodeReadinessStates.ready,
  ExecutionNodeReadinessStates.degraded,
  ExecutionNodeReadinessStates.blocked,
]);

const EligibilityDecisionSchema = z.enum([
  ExecutionNodeEligibilityDecisionKinds.eligible,
  ExecutionNodeEligibilityDecisionKinds.incompatible,
  ExecutionNodeEligibilityDecisionKinds.unavailable,
]);

const CompatibilityFindingKindSchema = z.enum([
  ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
  ImageExecutionNodeCompatibilityFindingKinds.softAdvisory,
  ImageExecutionNodeCompatibilityFindingKinds.transientAvailability,
]);

const BackendReadinessSummarySchema = z.object({
  state: BackendReadinessStateSchema,
  checkedAt: TimestampSchema.optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
}).strict();

const BackendCapabilitySummarySchema = z.object({
  backendFamily: IdentifierSchema,
  supportedExecutionTargets: z.array(IdentifierSchema).max(128),
  supportedOperationKinds: z.array(IdentifierSchema).max(256),
  supportedOperationCapabilities: z.array(IdentifierSchema).max(256),
  supportedInputKinds: z.array(IdentifierSchema).max(256),
  supportedOutputKinds: z.array(IdentifierSchema).max(256),
  supportedTranslationContractVersions: z.array(IdentifierSchema).max(256),
  resourceClassHints: z.array(IdentifierSchema).max(128),
  capabilityProfileVersion: IdentifierSchema.optional(),
  metadataTags: z.array(IdentifierSchema).max(128),
  readiness: BackendReadinessSummarySchema,
}).strict();

const HealthSummarySchema = z.object({
  activationStatus: ActivationStatusSchema,
  healthStatus: HealthStatusSchema,
  lastSeenAt: TimestampSchema.optional(),
  stale: z.boolean(),
  staleReasonCode: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!value.stale && value.staleReasonCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["staleReasonCode"],
      message: "staleReasonCode can only be present when stale=true.",
    });
  }
});

const OperationalSummarySchema = z.object({
  approvalStatus: NodeApprovalStatusSchema,
  trustState: NodeTrustStateSchema,
  enabledCapabilities: z.array(NodeRoleCapabilitySchema).min(1).max(32),
  supportsRemoteScheduling: z.boolean(),
  maxConcurrentWorkloads: z.number().int().positive().optional(),
  deploymentTags: z.array(IdentifierSchema).max(64),
  certificateAssigned: z.boolean(),
  enrollmentRequestId: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  const unique = new Set(value.enabledCapabilities);
  if (unique.size !== value.enabledCapabilities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["enabledCapabilities"],
      message: "enabledCapabilities must not include duplicates.",
    });
  }
});

const NodeSummarySchema = z.object({
  nodeId: IdentifierSchema,
  displayName: z.string().trim().min(1).max(120),
  nodeType: NodeTypeSchema,
  health: HealthSummarySchema,
  operational: OperationalSummarySchema,
  backendFamilies: z.array(IdentifierSchema).max(64),
}).strict();

const NodeDetailSchema = NodeSummarySchema.extend({
  backendCapabilities: z.array(BackendCapabilitySummarySchema).max(64),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt cannot be earlier than createdAt.",
    });
  }
});

const ReadinessIssueSchema = z.object({
  code: IdentifierSchema,
  severity: ReadinessIssueSeveritySchema,
  message: z.string().trim().min(1).max(2000),
}).strict();

const CompatibilityFindingSummarySchema = z.object({
  code: IdentifierSchema,
  kind: CompatibilityFindingKindSchema,
  message: z.string().trim().min(1).max(2000),
  blocking: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.kind === ImageExecutionNodeCompatibilityFindingKinds.softAdvisory && value.blocking) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blocking"],
      message: "soft-advisory findings must not be blocking.",
    });
  }
});

const EligibilityResultSchema = z.object({
  nodeId: IdentifierSchema,
  displayName: z.string().trim().min(1).max(120),
  decision: EligibilityDecisionSchema,
  compatible: z.boolean(),
  routable: z.boolean(),
  matchedBackendFamily: IdentifierSchema.optional(),
  matchedExecutionTarget: IdentifierSchema.optional(),
  findingCodes: z.array(IdentifierSchema).max(256),
  findings: z.array(CompatibilityFindingSummarySchema).max(256),
}).strict().superRefine((value, context) => {
  if (value.decision === ExecutionNodeEligibilityDecisionKinds.eligible) {
    if (!value.compatible || !value.routable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "eligible decision requires compatible=true and routable=true.",
      });
    }
  }

  if (value.decision === ExecutionNodeEligibilityDecisionKinds.incompatible && value.compatible) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compatible"],
      message: "incompatible decision requires compatible=false.",
    });
  }

  if (value.decision === ExecutionNodeEligibilityDecisionKinds.unavailable) {
    if (!value.compatible || value.routable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message: "unavailable decision requires compatible=true and routable=false.",
      });
    }
  }
});

const ReadinessNodeResultSchema = z.object({
  nodeId: IdentifierSchema,
  displayName: z.string().trim().min(1).max(120),
  readiness: ReadinessStateSchema,
  eligible: z.boolean(),
  compatible: z.boolean(),
  routable: z.boolean(),
  matchedBackendFamily: IdentifierSchema.optional(),
  matchedExecutionTarget: IdentifierSchema.optional(),
  findingCodes: z.array(IdentifierSchema).max(256),
}).strict();

const BackendAvailabilitySummarySchema = z.object({
  backendFamily: IdentifierSchema,
  readiness: BackendReadinessStateSchema,
  totalNodeCount: z.number().int().nonnegative(),
  readyNodeCount: z.number().int().nonnegative(),
  degradedNodeCount: z.number().int().nonnegative(),
  unavailableNodeCount: z.number().int().nonnegative(),
  unknownNodeCount: z.number().int().nonnegative(),
  checkedAt: TimestampSchema,
  summary: z.string().trim().min(1).max(2000).optional(),
}).strict().superRefine((value, context) => {
  const summed =
    value.readyNodeCount
    + value.degradedNodeCount
    + value.unavailableNodeCount
    + value.unknownNodeCount;
  if (summed !== value.totalNodeCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalNodeCount"],
      message: "totalNodeCount must equal readiness-bucket totals.",
    });
  }
});

export const ExecutionNodeListRequestDtoSchema = z.object({
  nodeIds: z.array(IdentifierSchema).max(256).optional(),
  nodeTypes: z.array(NodeTypeSchema).max(16).optional(),
  approvalStatuses: z.array(NodeApprovalStatusSchema).max(16).optional(),
  trustStates: z.array(NodeTrustStateSchema).max(16).optional(),
  activationStatuses: z.array(ActivationStatusSchema).max(16).optional(),
  healthStatuses: z.array(HealthStatusSchema).max(16).optional(),
  backendFamilies: z.array(IdentifierSchema).max(64).optional(),
  executionTargets: z.array(IdentifierSchema).max(64).optional(),
  requiredCapabilitiesAnyOf: z.array(NodeRoleCapabilitySchema).max(16).optional(),
  supportsRemoteScheduling: z.boolean().optional(),
  deploymentTagAnyOf: z.array(IdentifierSchema).max(64).optional(),
  includeRevoked: z.boolean().optional(),
  lastSeenAfter: TimestampSchema.optional(),
  lastSeenBefore: TimestampSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).strict().superRefine((value, context) => {
  if (value.lastSeenAfter && value.lastSeenBefore && Date.parse(value.lastSeenAfter) > Date.parse(value.lastSeenBefore)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastSeenAfter"],
      message: "lastSeenAfter must be earlier than or equal to lastSeenBefore.",
    });
  }
});

export const ExecutionNodeGetRequestDtoSchema = z.object({
  nodeId: IdentifierSchema,
}).strict();

const ExecutionNodeRequirementFieldsSchema = z.object({
  workspaceId: IdentifierSchema.optional(),
  workflowId: IdentifierSchema.optional(),
  runId: IdentifierSchema.optional(),
  candidateNodeIds: z.array(IdentifierSchema).max(256).optional(),
  requiredBackendFamilies: z.array(IdentifierSchema).max(64).optional(),
  requiredExecutionTarget: IdentifierSchema.optional(),
  requiredNodeCapabilities: z.array(NodeRoleCapabilitySchema).max(16).optional(),
  requiresRemoteScheduling: z.boolean().optional(),
  requiredOperationKind: IdentifierSchema.optional(),
  requiredOperationCapability: IdentifierSchema.optional(),
  requiredInputKinds: z.array(IdentifierSchema).max(64).optional(),
  requiredOutputKinds: z.array(IdentifierSchema).max(64).optional(),
  requiredTranslationContractVersion: IdentifierSchema.optional(),
  preferredResourceClassHints: z.array(IdentifierSchema).max(64).optional(),
  allowDegraded: z.boolean().optional(),
  maxLastSeenAgeMs: z.number().int().positive().optional(),
  now: TimestampSchema.optional(),
}).strict();

export const ExecutionNodeReadinessCheckRequestDtoSchema = ExecutionNodeRequirementFieldsSchema;
export const ExecutionNodeEligibilityCheckRequestDtoSchema = ExecutionNodeRequirementFieldsSchema;

export const ExecutionNodeBackendAvailabilityReadRequestDtoSchema = z.object({
  backendFamilies: z.array(IdentifierSchema).max(64).optional(),
  executionTarget: IdentifierSchema.optional(),
  includeUnavailable: z.boolean().optional(),
}).strict();

export const ExecutionNodeListResponseDtoSchema = z.object({
  contractVersion: ContractVersionSchema,
  items: z.array(NodeSummarySchema).max(500),
  totalCount: z.number().int().nonnegative(),
  asOf: TimestampSchema,
}).strict();

export const ExecutionNodeGetResponseDtoSchema = z.object({
  contractVersion: ContractVersionSchema,
  node: NodeDetailSchema,
  asOf: TimestampSchema,
}).strict();

export const ExecutionNodeReadinessCheckResponseDtoSchema = z.object({
  contractVersion: ContractVersionSchema,
  checkedAt: TimestampSchema,
  readyForExecution: z.boolean(),
  readiness: ReadinessStateSchema,
  nodeResults: z.array(ReadinessNodeResultSchema).max(500),
  issues: z.array(ReadinessIssueSchema).max(256),
}).strict().superRefine((value, context) => {
  if (value.readiness === ExecutionNodeReadinessStates.ready && !value.readyForExecution) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["readyForExecution"],
      message: "readiness='ready' requires readyForExecution=true.",
    });
  }
  if (value.readyForExecution && value.nodeResults.every((entry) => !entry.routable)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodeResults"],
      message: "readyForExecution=true requires at least one routable node result.",
    });
  }
});

export const ExecutionNodeEligibilityCheckResponseDtoSchema = z.object({
  contractVersion: ContractVersionSchema,
  checkedAt: TimestampSchema,
  evaluations: z.array(EligibilityResultSchema).max(500),
}).strict();

export const ExecutionNodeBackendAvailabilityReadResponseDtoSchema = z.object({
  contractVersion: ContractVersionSchema,
  asOf: TimestampSchema,
  backends: z.array(BackendAvailabilitySummarySchema).max(256),
}).strict();

export type ExecutionNodeListRequestDtoPayload = z.infer<typeof ExecutionNodeListRequestDtoSchema>;
export type ExecutionNodeGetRequestDtoPayload = z.infer<typeof ExecutionNodeGetRequestDtoSchema>;
export type ExecutionNodeReadinessCheckRequestDtoPayload = z.infer<typeof ExecutionNodeReadinessCheckRequestDtoSchema>;
export type ExecutionNodeEligibilityCheckRequestDtoPayload = z.infer<typeof ExecutionNodeEligibilityCheckRequestDtoSchema>;
export type ExecutionNodeBackendAvailabilityReadRequestDtoPayload =
  z.infer<typeof ExecutionNodeBackendAvailabilityReadRequestDtoSchema>;
export type ExecutionNodeListResponseDtoPayload = z.infer<typeof ExecutionNodeListResponseDtoSchema>;
export type ExecutionNodeGetResponseDtoPayload = z.infer<typeof ExecutionNodeGetResponseDtoSchema>;
export type ExecutionNodeReadinessCheckResponseDtoPayload = z.infer<typeof ExecutionNodeReadinessCheckResponseDtoSchema>;
export type ExecutionNodeEligibilityCheckResponseDtoPayload =
  z.infer<typeof ExecutionNodeEligibilityCheckResponseDtoSchema>;
export type ExecutionNodeBackendAvailabilityReadResponseDtoPayload =
  z.infer<typeof ExecutionNodeBackendAvailabilityReadResponseDtoSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(
  schemaName: string,
  error: z.ZodError,
): ExecutionNodeManagementApiSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new ExecutionNodeManagementApiSchemaValidationError(schemaName, issues);
}

function parseExecutionNodeManagementApiSchema<T>(
  schemaName: string,
  schema: z.ZodSchema<T>,
  payload: unknown,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseExecutionNodeListRequestDto(payload: unknown): ExecutionNodeListRequestDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeListRequestDto",
    ExecutionNodeListRequestDtoSchema,
    payload,
  );
}

export function parseExecutionNodeGetRequestDto(payload: unknown): ExecutionNodeGetRequestDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeGetRequestDto",
    ExecutionNodeGetRequestDtoSchema,
    payload,
  );
}

export function parseExecutionNodeReadinessCheckRequestDto(
  payload: unknown,
): ExecutionNodeReadinessCheckRequestDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeReadinessCheckRequestDto",
    ExecutionNodeReadinessCheckRequestDtoSchema,
    payload,
  );
}

export function parseExecutionNodeEligibilityCheckRequestDto(
  payload: unknown,
): ExecutionNodeEligibilityCheckRequestDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeEligibilityCheckRequestDto",
    ExecutionNodeEligibilityCheckRequestDtoSchema,
    payload,
  );
}

export function parseExecutionNodeBackendAvailabilityReadRequestDto(
  payload: unknown,
): ExecutionNodeBackendAvailabilityReadRequestDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeBackendAvailabilityReadRequestDto",
    ExecutionNodeBackendAvailabilityReadRequestDtoSchema,
    payload,
  );
}

export function parseExecutionNodeListResponseDto(payload: unknown): ExecutionNodeListResponseDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeListResponseDto",
    ExecutionNodeListResponseDtoSchema,
    payload,
  );
}

export function parseExecutionNodeGetResponseDto(payload: unknown): ExecutionNodeGetResponseDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeGetResponseDto",
    ExecutionNodeGetResponseDtoSchema,
    payload,
  );
}

export function parseExecutionNodeReadinessCheckResponseDto(
  payload: unknown,
): ExecutionNodeReadinessCheckResponseDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeReadinessCheckResponseDto",
    ExecutionNodeReadinessCheckResponseDtoSchema,
    payload,
  );
}

export function parseExecutionNodeEligibilityCheckResponseDto(
  payload: unknown,
): ExecutionNodeEligibilityCheckResponseDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeEligibilityCheckResponseDto",
    ExecutionNodeEligibilityCheckResponseDtoSchema,
    payload,
  );
}

export function parseExecutionNodeBackendAvailabilityReadResponseDto(
  payload: unknown,
): ExecutionNodeBackendAvailabilityReadResponseDtoPayload {
  return parseExecutionNodeManagementApiSchema(
    "ExecutionNodeBackendAvailabilityReadResponseDto",
    ExecutionNodeBackendAvailabilityReadResponseDtoSchema,
    payload,
  );
}
