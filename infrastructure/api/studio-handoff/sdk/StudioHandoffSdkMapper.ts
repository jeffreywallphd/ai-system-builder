import type { StudioHandoffRouteDecision } from "../../../../application/studio-handoff/StudioHandoffRoutingService";
import type { PersistedStudioHandoffRecord } from "../../../../application/studio-handoff/StudioHandoffPersistenceService";
import type { StudioHandoffCompatibilityDecision } from "../../../../application/studio-handoff/StudioHandoffCompatibilityValidator";
import type {
  StudioHandoffSdkInitiateResponse,
  StudioHandoffSdkRecordSummary,
  StudioHandoffSdkRetryResponse,
  StudioHandoffSdkStatusResponse,
} from "./PublicStudioHandoffSdkContract";

export function toStudioHandoffSdkRecordSummary(input: {
  readonly record: PersistedStudioHandoffRecord;
  readonly routeDecision?: StudioHandoffRouteDecision;
}): StudioHandoffSdkRecordSummary {
  return Object.freeze({
    handoffId: input.record.handoffId,
    status: input.record.orchestration.status,
    sourceStudio: {
      studioId: input.record.sourceStudioId,
      studioType: input.record.sourceStudioType,
    },
    targetStudio: {
      studioId: input.record.targetStudioId,
      studioType: input.record.targetStudioType,
    },
    authoritativeAsset: {
      assetId: input.record.authoritativeAsset.assetId,
      versionId: input.record.authoritativeAsset.versionId,
    },
    bundledAssets: input.record.bundledAssets,
    revision: input.record.revision
      ? {
        revisionId: input.record.revision.revisionId,
        previousHandoffId: input.record.revision.previousHandoffId,
        updatedHandoffId: input.record.revision.updatedHandoffId,
      }
      : undefined,
    retryLink: input.record.retryLink,
    routeDecision: input.routeDecision
      ? {
        preferredTarget: input.routeDecision.preferred
          ? {
            studioType: input.routeDecision.preferred.studioType,
            studioId: input.routeDecision.preferred.studioId,
            matchedContractId: input.routeDecision.preferred.matchedContractId,
          }
          : undefined,
        candidates: input.routeDecision.candidates.map((candidate) => ({
          studioType: candidate.studioType,
          studioId: candidate.studioId,
          registrationKind: candidate.registrationKind,
          compatible: candidate.compatible,
          score: candidate.score,
          matchedContractId: candidate.matchedContractId,
          reasonCodes: candidate.reasons.map((reason) => reason.code),
        })),
        deterministicSignature: input.routeDecision.deterministicSignature,
      }
      : undefined,
    issueCodes: input.record.orchestration.issueCodes,
    createdAt: input.record.createdAt,
    updatedAt: input.record.updatedAt,
  });
}

export function toStudioHandoffSdkInitiateResponse(input: {
  readonly record: PersistedStudioHandoffRecord;
  readonly routeDecision?: StudioHandoffRouteDecision;
  readonly compatibility: StudioHandoffCompatibilityDecision;
}): StudioHandoffSdkInitiateResponse {
  return Object.freeze({
    handoff: toStudioHandoffSdkRecordSummary({ record: input.record, routeDecision: input.routeDecision }),
    result: {
      accepted: input.record.orchestration.status === "prepared",
      compatibility: {
        compatible: input.compatibility.compatible,
        matchedContractId: input.compatibility.matchedContractId,
        issues: input.compatibility.issues,
      },
    },
  });
}

export function toStudioHandoffSdkStatusResponse(input: {
  readonly record?: PersistedStudioHandoffRecord;
  readonly routeDecision?: StudioHandoffRouteDecision;
}): StudioHandoffSdkStatusResponse {
  return Object.freeze({
    handoff: input.record
      ? toStudioHandoffSdkRecordSummary({ record: input.record, routeDecision: input.routeDecision })
      : undefined,
  });
}

export function toStudioHandoffSdkRetryResponse(input: {
  readonly record: PersistedStudioHandoffRecord;
  readonly decision: {
    readonly decision: "retryable" | "reconcilable" | "terminal";
    readonly reasonCode: string;
    readonly reason: string;
  };
  readonly routeDecision?: StudioHandoffRouteDecision;
}): StudioHandoffSdkRetryResponse {
  return Object.freeze({
    handoff: toStudioHandoffSdkRecordSummary({ record: input.record, routeDecision: input.routeDecision }),
    retryDecision: input.decision,
  });
}
