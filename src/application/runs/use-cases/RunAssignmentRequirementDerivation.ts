import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  RunSubmissionSecurityPrerequisiteKinds,
  type RunSubmissionResourceReference,
  type RunSubmissionSecurityPrerequisite,
  type RunSubmissionStorageReference,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import type {
  RunAssignmentRequirementSet,
} from "@application/runs/ports/RunAssignmentEligibilityPorts";
import { NodeRoleCapabilities, type NodeRoleCapability } from "@domain/nodes/NodeTrustDomain";
import type { RunAuthoritativeMetadata } from "./RunCreationPersistenceMapper";

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

function getSubmissionSnapshot(
  run: PlatformRunRecord,
): RunAuthoritativeMetadata["submissionSnapshot"] | undefined {
  if (!hasSubmissionSnapshotMetadata(run.metadata)) {
    return undefined;
  }
  return run.metadata.submissionSnapshot;
}

export function deriveRunAssignmentRequirementSet(run: PlatformRunRecord): RunAssignmentRequirementSet | undefined {
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

