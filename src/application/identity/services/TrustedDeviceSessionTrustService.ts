import {
  DeviceTrustStatuses,
  type DeviceTrustMaterialRef,
  type TrustedDevice,
} from "../../../domain/identity/TrustedDeviceDomain";
import {
  SessionAssuranceLevels,
  SessionDeviceTrustInvalidationReasons,
  SessionDeviceTrustStates,
  type Session,
  type SessionClientContext,
  type SessionDeviceTrustContext,
  type SessionDeviceTrustInvalidationReason,
  type SessionDeviceTrustState,
} from "../../../domain/identity/IdentityDomain";
import type { ITrustedDeviceRepository } from "../../../../application/identity/ports/ITrustedDeviceRepository";
import {
  IdentitySessionTrustRequirements,
  type IIdentitySessionTrustService,
  type IdentitySessionTrustRequirement,
  type ResolveSessionIssuanceTrustInput,
  type ResolveSessionIssuanceTrustResult,
} from "../../../../application/identity/ports/IIdentitySessionTrustService";
import type {
  IdentitySessionTrustEvaluationInput,
  IdentitySessionTrustEvaluationResult,
} from "../../../../application/identity/ports/IIdentitySessionTrustEvaluator";

export interface TrustedDeviceSessionTrustPolicies {
  readonly desktop: IdentitySessionTrustRequirement;
  readonly thinClient: IdentitySessionTrustRequirement;
}

interface TrustedDeviceSessionTrustServiceDependencies {
  readonly trustedDeviceRepository: ITrustedDeviceRepository;
  readonly policies: TrustedDeviceSessionTrustPolicies;
}

export class TrustedDeviceSessionTrustService implements IIdentitySessionTrustService {
  public constructor(private readonly dependencies: TrustedDeviceSessionTrustServiceDependencies) {}

  public async resolveSessionIssuanceTrust(
    input: ResolveSessionIssuanceTrustInput,
  ): Promise<ResolveSessionIssuanceTrustResult> {
    const requirement = input.requestedTrustRequirement ?? this.defaultRequirement(input.accessChannel);
    const claim = resolveTrustedDeviceClaim(input.client);
    const nowIso = input.evaluatedAt;

    if (!claim) {
      if (requirement === IdentitySessionTrustRequirements.requireTrusted) {
        return Object.freeze({
          allowed: false,
          trustRequirement: requirement,
          reason: "A trusted device is required for this session.",
          trustEvaluation: Object.freeze({
            allowed: false as const,
            reason: "trusted-device-required",
            invalidationReasons: Object.freeze([SessionDeviceTrustInvalidationReasons.trustedDeviceMismatch] as const),
          }),
        });
      }

      return Object.freeze({
        allowed: true,
        trustRequirement: requirement,
        deviceTrustContext: buildUntrustedContext(nowIso, requirement, SessionDeviceTrustStates.untrusted),
        trustMarker: input.client?.trustMarker?.trim() || undefined,
      });
    }

    const trustedDevice = await this.dependencies.trustedDeviceRepository.getTrustedDeviceById(claim);
    const evaluated = evaluateTrustedDeviceBinding({
      trustedDevice,
      userIdentityId: input.userIdentityId,
      trustedDeviceId: claim,
      evaluatedAt: nowIso,
    });

    if (evaluated.allowed) {
      return Object.freeze({
        allowed: true,
        trustRequirement: requirement,
        deviceTrustContext: evaluated.deviceTrustContext,
        trustedDeviceBindingId: evaluated.trustedDeviceBindingId,
        trustMarker: evaluated.trustMarker,
      });
    }

    if (requirement === IdentitySessionTrustRequirements.requireTrusted) {
      return Object.freeze({
        allowed: false,
        trustRequirement: requirement,
        reason: "Trusted device validation failed for this session.",
        trustEvaluation: evaluated,
      });
    }

    return Object.freeze({
      allowed: true,
      trustRequirement: requirement,
      deviceTrustContext: buildUntrustedContext(
        nowIso,
        requirement,
        evaluated.deviceTrustContext?.snapshot?.state ?? SessionDeviceTrustStates.untrusted,
        evaluated.invalidationReasons,
        claim,
      ),
      trustedDeviceBindingId: claim,
      trustMarker: input.client?.trustMarker?.trim() || undefined,
    });
  }

  public async evaluateSessionTrust(
    input: IdentitySessionTrustEvaluationInput,
  ): Promise<IdentitySessionTrustEvaluationResult> {
    const trustedDeviceId = resolveTrustedDeviceClaim(input.session.client);
    if (!trustedDeviceId) {
      return Object.freeze({ allowed: true });
    }

    const trustedDevice = await this.dependencies.trustedDeviceRepository.getTrustedDeviceById(trustedDeviceId);
    return evaluateTrustedDeviceBinding({
      trustedDevice,
      userIdentityId: input.session.userIdentityId,
      trustedDeviceId,
      evaluatedAt: input.evaluatedAt,
      existingSession: input.session,
    });
  }

  private defaultRequirement(channel: ResolveSessionIssuanceTrustInput["accessChannel"]): IdentitySessionTrustRequirement {
    return channel === "desktop"
      ? this.dependencies.policies.desktop
      : this.dependencies.policies.thinClient;
  }
}

function resolveTrustedDeviceClaim(client?: SessionClientContext): string | undefined {
  const trustedDeviceId = client?.deviceTrust?.trustedDeviceId?.trim();
  if (trustedDeviceId) {
    return trustedDeviceId;
  }
  const deviceTrustBinding = client?.deviceTrust?.trustedDeviceBindingId?.trim();
  if (deviceTrustBinding) {
    return deviceTrustBinding;
  }
  const binding = client?.trustedDeviceBindingId?.trim();
  return binding || undefined;
}

function evaluateTrustedDeviceBinding(input: {
  readonly trustedDevice: TrustedDevice | undefined;
  readonly userIdentityId: string;
  readonly trustedDeviceId: string;
  readonly evaluatedAt: string;
  readonly existingSession?: Session;
}): IdentitySessionTrustEvaluationResult {
  if (!input.trustedDevice) {
    return deniedTrust(
      "Trusted device binding no longer exists.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceMismatch,
      SessionDeviceTrustStates.unknown,
      input.evaluatedAt,
      input.trustedDeviceId,
    );
  }

  if (input.trustedDevice.userIdentityId !== input.userIdentityId) {
    return deniedTrust(
      "Trusted device binding does not belong to this user.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceMismatch,
      SessionDeviceTrustStates.untrusted,
      input.evaluatedAt,
      input.trustedDevice.id,
    );
  }

  const materialExpired = isTrustMaterialExpired(input.trustedDevice, input.evaluatedAt);
  if (input.trustedDevice.trustStatus === DeviceTrustStatuses.revoked) {
    return deniedTrust(
      "Trusted device has been revoked.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceRevoked,
      SessionDeviceTrustStates.revoked,
      input.evaluatedAt,
      input.trustedDevice.id,
      input.existingSession?.client?.trustMarker,
    );
  }

  if (input.trustedDevice.trustStatus === DeviceTrustStatuses.expired || materialExpired) {
    return deniedTrust(
      "Trusted device has expired.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceExpired,
      SessionDeviceTrustStates.expired,
      input.evaluatedAt,
      input.trustedDevice.id,
      input.existingSession?.client?.trustMarker,
    );
  }

  if (input.trustedDevice.trustStatus !== DeviceTrustStatuses.trusted) {
    return deniedTrust(
      "Trusted device is not currently trusted.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceTrustLost,
      SessionDeviceTrustStates.pendingPairing,
      input.evaluatedAt,
      input.trustedDevice.id,
      input.existingSession?.client?.trustMarker,
    );
  }

  const expectedTrustMarker = buildTrustMarker(input.trustedDevice.id, input.trustedDevice.trustMaterialRef);
  const sessionTrustMarker = input.existingSession?.client?.trustMarker?.trim();
  if (sessionTrustMarker && !isCompatibleTrustMarker(sessionTrustMarker, expectedTrustMarker, input.trustedDevice.id)) {
    return deniedTrust(
      "Session trust marker is stale or mismatched for the trusted device.",
      SessionDeviceTrustInvalidationReasons.trustedDeviceMismatch,
      SessionDeviceTrustStates.untrusted,
      input.evaluatedAt,
      input.trustedDevice.id,
      sessionTrustMarker,
    );
  }

  return Object.freeze({
    allowed: true,
    deviceTrustContext: Object.freeze({
      trustedDeviceId: input.trustedDevice.id,
      issuedOnTrustedDevice: true,
      sessionAssuranceLevel: SessionAssuranceLevels.authenticatedTrusted,
      snapshot: Object.freeze({
        state: SessionDeviceTrustStates.trusted,
        evaluatedAt: input.evaluatedAt,
      }),
      invalidationReasons: Object.freeze([] as SessionDeviceTrustInvalidationReason[]),
      trustedDeviceBindingId: input.trustedDevice.id,
      trustMarker: expectedTrustMarker,
    }),
    trustedDeviceBindingId: input.trustedDevice.id,
    trustMarker: expectedTrustMarker,
  });
}

function deniedTrust(
  reason: string,
  invalidationReason: SessionDeviceTrustInvalidationReason,
  state: SessionDeviceTrustState,
  evaluatedAt: string,
  trustedDeviceId?: string,
  trustMarker?: string,
): IdentitySessionTrustEvaluationResult {
  return Object.freeze({
    allowed: false,
    reason,
    invalidationReasons: Object.freeze([invalidationReason]),
    trustedDeviceBindingId: trustedDeviceId,
    trustMarker,
    details: Object.freeze({
      trustedDeviceId,
      trustState: state,
    }),
    deviceTrustContext: Object.freeze({
      trustedDeviceId,
      issuedOnTrustedDevice: false,
      sessionAssuranceLevel: SessionAssuranceLevels.authenticatedRestricted,
      snapshot: Object.freeze({
        state,
        evaluatedAt,
      }),
      invalidationReasons: Object.freeze([invalidationReason]),
      trustedDeviceBindingId: trustedDeviceId,
      trustMarker,
    }),
  });
}

function buildUntrustedContext(
  evaluatedAt: string,
  requirement: IdentitySessionTrustRequirement,
  state: SessionDeviceTrustState,
  invalidationReasons: ReadonlyArray<SessionDeviceTrustInvalidationReason> = Object.freeze([]),
  trustedDeviceId?: string,
): SessionDeviceTrustContext {
  const assuranceLevel = requirement === IdentitySessionTrustRequirements.allowPairing
    ? SessionAssuranceLevels.authenticatedRestricted
    : SessionAssuranceLevels.authenticatedUntrusted;

  return Object.freeze({
    trustedDeviceId,
    issuedOnTrustedDevice: false,
    sessionAssuranceLevel: assuranceLevel,
    snapshot: Object.freeze({
      state,
      evaluatedAt,
    }),
    invalidationReasons: Object.freeze([...invalidationReasons]),
    trustedDeviceBindingId: trustedDeviceId,
  });
}

function isTrustMaterialExpired(device: TrustedDevice, evaluatedAt: string): boolean {
  const expiresAt = device.trustMaterialRef?.expiresAt;
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= new Date(evaluatedAt).getTime();
}

function buildTrustMarker(trustedDeviceId: string, trustMaterialRef?: DeviceTrustMaterialRef): string {
  const legacyBase = buildLegacyTrustMarker(trustedDeviceId);
  if (!trustMaterialRef) {
    return legacyBase;
  }

  const materialVersion = trustMaterialRef.version?.trim() || "na";
  return `${legacyBase}|material:${trustMaterialRef.materialId}|kind:${trustMaterialRef.kind}|version:${materialVersion}|issued:${trustMaterialRef.issuedAt}`;
}

function buildLegacyTrustMarker(trustedDeviceId: string): string {
  return `trusted-device:${trustedDeviceId}`;
}

function isCompatibleTrustMarker(existing: string, expected: string, trustedDeviceId: string): boolean {
  return existing === expected || existing === buildLegacyTrustMarker(trustedDeviceId);
}
