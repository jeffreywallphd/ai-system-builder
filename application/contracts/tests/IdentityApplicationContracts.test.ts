import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
} from "../../../src/domain/identity/TrustedDeviceDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  IdentityCredentialMaterialStatuses,
  IdentityIdNamespaces,
  IdentityPrincipalLookupKinds,
  identityFailure,
  identitySuccess,
  type IdentityCredentialMaterialRecord,
  type IdentityOperationResult,
  type IdentityPrincipalLookup,
  type IdentitySessionListQuery,
  type TrustedDeviceRecord,
} from "../IdentityApplicationContracts";

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
});
