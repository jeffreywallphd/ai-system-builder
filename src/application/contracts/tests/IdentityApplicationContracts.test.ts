import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
} from "../../../domain/identity/TrustedDeviceDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  IdentityCredentialMaterialStatuses,
  IdentityIdNamespaces,
  IdentityPrincipalLookupKinds,
  PairingTokenValidationOutcomes,
  identityFailure,
  identitySuccess,
  type IdentityCredentialMaterialRecord,
  type IdentityOperationResult,
  type IdentityPrincipalLookup,
  type IdentitySessionListQuery,
  type TrustedDevicePairingCompletionRequest,
  type TrustedDevicePairingInitiationRequest,
  type TrustedDevicePairingValidationResponse,
  type TrustedDeviceRecord,
} from "../IdentityApplicationContracts";
import {
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
} from "../../../domain/identity/TrustedDevicePairingDomain";

describe("identity application shared contracts", () => {
  it("exposes stable lookup, id namespace, and credential material contract types", () => {
    const principalLookup: IdentityPrincipalLookup = {
      kind: IdentityPrincipalLookupKinds.username,
      value: "alice",
    };

    const credentialRecord: IdentityCredentialMaterialRecord = {
      id: "credential-material:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    };

    const sessionQuery: IdentitySessionListQuery = {
      userIdentityId: "user:1",
      includeStatuses: ["active"],
      limit: 5,
    };

    const trustedDeviceRecord: TrustedDeviceRecord = {
      id: "trusted-device:1",
      userIdentityId: "user:1",
      workspaceId: "workspace:alpha",
      displayName: { value: "Studio Laptop" },
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:abc",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "trust-material:1",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
      }),
      registeredAt: "2026-04-04T12:00:00.000Z",
      pairedAt: "2026-04-04T12:01:00.000Z",
      metadata: {},
      updatedAt: "2026-04-04T12:01:00.000Z",
    };

    expect(principalLookup.kind).toBe("username");
    expect(credentialRecord.status).toBe("active");
    expect(sessionQuery.includeStatuses?.[0]).toBe("active");
    expect(trustedDeviceRecord.trustStatus).toBe("trusted");
    expect(IdentityIdNamespaces.identitySession).toBe("identity-session");
    expect(IdentityIdNamespaces.trustedDevice).toBe("trusted-device");
  });

  it("exposes structured identity operation result and error taxonomy contracts", () => {
    const success: IdentityOperationResult<{ readonly userIdentityId: string }> = identitySuccess({
      userIdentityId: "user:1",
    });
    const failure: IdentityOperationResult<never> = identityFailure({
      code: IdentityErrorCodes.invalidSessionState,
      message: "Session token is not active.",
      boundary: IdentityErrorBoundaries.application,
      retryable: false,
      details: Object.freeze({
        sessionId: "session:1",
      }),
    });

    expect(success).toEqual({
      ok: true,
      value: {
        userIdentityId: "user:1",
      },
    });
    expect(failure).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-session-state",
      }),
    });
  });

  it("exposes trusted-device pairing initiation, validation, and completion contract shapes", () => {
    const initiationRequest: TrustedDevicePairingInitiationRequest = {
      trustedDeviceId: "trusted-device:pairing:1",
      userIdentityId: "user:1",
      workspaceId: "workspace:alpha",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:1",
      },
      issuance: {
        issuedByUserIdentityId: "user:1",
        channelHint: "cli",
      },
      maxValidationAttempts: 5,
      expiresAt: "2026-04-04T12:15:00.000Z",
    };

    const validationResponse: TrustedDevicePairingValidationResponse = {
      outcome: PairingTokenValidationOutcomes.valid,
      attemptsRemaining: 4,
      pairingSession: {
        id: "pairing-session:1",
        trustedDeviceId: "trusted-device:pairing:1",
        userIdentityId: "user:1",
        workspaceId: "workspace:alpha",
        pairingTokenId: "pairing-token:1",
        status: "validated",
        initiatedAt: "2026-04-04T12:00:00.000Z",
        validatedAt: "2026-04-04T12:01:00.000Z",
        updatedAt: "2026-04-04T12:01:00.000Z",
      },
      pairingToken: {
        id: "pairing-token:1",
        pairingSessionId: "pairing-session:1",
        trustedDeviceId: "trusted-device:pairing:1",
        userIdentityId: "user:1",
        workspaceId: "workspace:alpha",
        artifactType: PairingTokenArtifactTypes.oneTimeCode,
        tokenHash: "hash:pairing:1",
        hashAlgorithm: "sha256",
        actorBinding: {
          scope: PairingTokenActorScopes.sameUser,
          userIdentityId: "user:1",
        },
        issuance: {},
        status: PairingTokenStatuses.issued,
        issuedAt: "2026-04-04T12:00:00.000Z",
        expiresAt: "2026-04-04T12:15:00.000Z",
        failedValidationAttempts: 1,
        maxValidationAttempts: 5,
        lastValidationAttemptAt: "2026-04-04T12:01:00.000Z",
        updatedAt: "2026-04-04T12:01:00.000Z",
      },
    };

    const completionRequest: TrustedDevicePairingCompletionRequest = {
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      trustedDeviceId: "trusted-device:pairing:1",
      userIdentityId: "user:1",
      workspaceId: "workspace:alpha",
      presentedToken: "123456",
      completedAt: "2026-04-04T12:02:00.000Z",
      completedByUserIdentityId: "user:1",
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "trust-material:pairing:1",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
      }),
      trustMaterialRegistration: {
        materialKind: DeviceTrustMaterialKinds.sessionSigningKey,
        pinReference: "pin:reference:1",
      },
    };

    expect(initiationRequest.actorBinding.scope).toBe("same-user");
    expect(validationResponse.outcome).toBe("valid");
    expect(validationResponse.pairingToken.status).toBe("issued");
    expect(completionRequest.trustMaterialRegistration?.pinReference).toBe("pin:reference:1");
    expect(IdentityIdNamespaces.trustedDevicePairingSession).toBe("trusted-device-pairing-session");
    expect(IdentityIdNamespaces.trustedDevicePairingToken).toBe("trusted-device-pairing-token");
  });
});
