import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  type NodeRoleCapability,
} from "@domain/nodes/NodeTrustDomain";
import type { AuthoritativeRunQueueEntryRecord } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunSubmissionSecurityPrerequisiteKinds,
  type RunSubmissionResourceReference,
  type RunSubmissionSecurityPrerequisite,
  type RunSubmissionStorageReference,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import {
  RunAssignmentIneligibilityCodes,
  type IRunAssignmentNodeCatalogPort,
  type IRunAssignmentPolicyPort,
  type IRunNodeAssignmentEligibilityService,
  type RunAssignmentEligibilityDecision,
  type RunAssignmentIneligibilityReason,
  type RunAssignmentRequirementSet,
} from "@application/runs/ports/RunAssignmentEligibilityPorts";
import type { RunAuthoritativeMetadata } from "./RunCreationPersistenceMapper";

interface RunNodeAssignmentEligibilityServiceDependencies {
  readonly nodeCatalog: IRunAssignmentNodeCatalogPort;
  readonly policyPort?: IRunAssignmentPolicyPort;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSubmissionSnapshotMetadata(metadata: unknown): metadata is RunAuthoritativeMetadata {
  if (!isObject(metadata)) {
    return false;
  }
  return "submissionSnapshot" in metadata && isObject((metadata as Record<string, unknown>).submissionSnapshot);
}

function toIneligibilityReason(
  code: RunAssignmentIneligibilityReason["code"],
  message: string,
  details?: Readonly<Record<string, unknown>>,
): RunAssignmentIneligibilityReason {
  return Object.freeze({
    code,
    message,
    details,
  });
}

function getSubmissionSnapshot(
  run: PlatformRunRecord,
): RunAuthoritativeMetadata["submissionSnapshot"] | undefined {
  if (!hasSubmissionSnapshotMetadata(run.metadata)) {
    return undefined;
  }
  return run.metadata.submissionSnapshot;
}

function toRunAssignmentRequirementSet(run: PlatformRunRecord): RunAssignmentRequirementSet | undefined {
  const snapshot = getSubmissionSnapshot(run);
  if (!snapshot) {
    return undefined;
  }

  const requiredCapabilities = new Set<NodeRoleCapability>([
    NodeRoleCapabilities.executor,
  ]);

  if (snapshot.storageReferences.length > 0) {
    requiredCapabilities.add(NodeRoleCapabilities.storageAccess);
  }
  if (snapshot.policyPrerequisites.some((prerequisite) => (
    prerequisite.kind === RunSubmissionSecurityPrerequisiteKinds.previewDecryptionAllowed
    && prerequisite.expected !== false
  ))) {
    requiredCapabilities.add(NodeRoleCapabilities.previewWorker);
  }

  return Object.freeze({
    workspaceId: normalizeOptional(run.workspaceId),
    execution: Object.freeze({
      systemId: snapshot.runtimeTarget.systemId,
      versionId: snapshot.runtimeTarget.versionId,
      async: snapshot.runtimeTarget.async !== false,
    }),
    requiredCapabilities: Object.freeze([...requiredCapabilities.values()]),
    requiresRemoteScheduling: snapshot.runtimeTarget.async !== false,
    storageReferences: Object.freeze(snapshot.storageReferences as ReadonlyArray<RunSubmissionStorageReference>),
    resourceReferences: Object.freeze(snapshot.resourceReferences as ReadonlyArray<RunSubmissionResourceReference>),
    policyPrerequisites: Object.freeze(snapshot.policyPrerequisites as ReadonlyArray<RunSubmissionSecurityPrerequisite>),
  });
}

export class RunNodeAssignmentEligibilityService implements IRunNodeAssignmentEligibilityService {
  public constructor(private readonly dependencies: RunNodeAssignmentEligibilityServiceDependencies) {}

  public async evaluateNodeEligibility(input: {
    readonly asOf: string;
    readonly run: PlatformRunRecord;
    readonly queueEntry: AuthoritativeRunQueueEntryRecord;
    readonly nodeId: string;
  }): Promise<RunAssignmentEligibilityDecision> {
    const nodeId = normalizeOptional(input.nodeId);
    if (!nodeId) {
      return Object.freeze({
        eligible: false,
        nodeId: input.nodeId,
        reasons: Object.freeze([
          toIneligibilityReason(
            RunAssignmentIneligibilityCodes.nodeNotFound,
            "Node assignment requires a non-empty nodeId.",
          ),
        ]),
      });
    }

    const node = await this.dependencies.nodeCatalog.findNodeById(nodeId);
    if (!node) {
      return Object.freeze({
        eligible: false,
        nodeId,
        reasons: Object.freeze([
          toIneligibilityReason(
            RunAssignmentIneligibilityCodes.nodeNotFound,
            `Node '${nodeId}' was not found in trusted node inventory.`,
          ),
        ]),
      });
    }

    const requirements = toRunAssignmentRequirementSet(input.run);
    if (!requirements) {
      return Object.freeze({
        eligible: false,
        nodeId,
        reasons: Object.freeze([
          toIneligibilityReason(
            RunAssignmentIneligibilityCodes.requirementsUnavailable,
            `Run '${input.run.runId}' is missing authoritative submission requirements for assignment matching.`,
          ),
        ]),
      });
    }

    const reasons: RunAssignmentIneligibilityReason[] = [];
    if (node.approvalStatus !== NodeApprovalStatuses.approved) {
      reasons.push(toIneligibilityReason(
        RunAssignmentIneligibilityCodes.nodeNotApproved,
        `Node '${node.nodeId}' is not approved for assignment.`,
        Object.freeze({
          approvalStatus: node.approvalStatus,
        }),
      ));
    }

    if (node.trustState !== NodeTrustStates.trusted) {
      reasons.push(toIneligibilityReason(
        RunAssignmentIneligibilityCodes.nodeNotTrusted,
        `Node '${node.nodeId}' is not in a trusted state for assignment.`,
        Object.freeze({
          trustState: node.trustState,
        }),
      ));
    }

    if (
      node.revocation.state === NodeRevocationStates.revoked
      || Boolean(node.revokedAt)
      || Boolean(node.revocation.revokedAt)
    ) {
      reasons.push(toIneligibilityReason(
        RunAssignmentIneligibilityCodes.nodeRevoked,
        `Node '${node.nodeId}' is revoked and cannot receive run assignments.`,
      ));
    }

    if (!normalizeOptional(node.certificate?.certificateRef)) {
      reasons.push(toIneligibilityReason(
        RunAssignmentIneligibilityCodes.nodeMissingCertificate,
        `Node '${node.nodeId}' is missing certificate trust material.`,
      ));
    }

    const nodeCapabilities = new Set(node.capabilityProfile.enabledCapabilities);
    for (const capability of requirements.requiredCapabilities) {
      if (!nodeCapabilities.has(capability)) {
        reasons.push(toIneligibilityReason(
          RunAssignmentIneligibilityCodes.nodeMissingCapability,
          `Node '${node.nodeId}' is missing required capability '${capability}'.`,
          Object.freeze({
            requiredCapability: capability,
          }),
        ));
      }
    }

    if (requirements.requiresRemoteScheduling && !node.capabilityProfile.supportsRemoteScheduling) {
      reasons.push(toIneligibilityReason(
        RunAssignmentIneligibilityCodes.remoteSchedulingUnsupported,
        `Node '${node.nodeId}' does not support remote scheduling for this run.`,
      ));
    }

    if (this.dependencies.policyPort) {
      const policyDecision = await this.dependencies.policyPort.evaluateNodeAssignmentPreconditions({
        asOf: input.asOf,
        run: input.run,
        queueEntry: input.queueEntry,
        node,
        requirements,
      });
      if (!policyDecision.allowed) {
        if (policyDecision.reasons && policyDecision.reasons.length > 0) {
          reasons.push(...policyDecision.reasons);
        } else {
          reasons.push(toIneligibilityReason(
            RunAssignmentIneligibilityCodes.policyDenied,
            `Policy preconditions denied assignment of run '${input.run.runId}' to node '${node.nodeId}'.`,
          ));
        }
      }
    }

    return Object.freeze({
      eligible: reasons.length === 0,
      nodeId: node.nodeId,
      requirements,
      reasons: Object.freeze(reasons),
    });
  }
}

