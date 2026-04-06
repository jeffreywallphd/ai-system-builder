import { describe, expect, it } from "bun:test";
import { CertificateOperationsBackendApi } from "../CertificateOperationsBackendApi";
import { CertificateOperationsApiErrorCodes } from "../sdk/PublicCertificateOperationsApiContract";
import { ListIssuedCertificateMetadataErrorCodes } from "../../../../application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import { GetIssuedCertificateMetadataErrorCodes } from "../../../../application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import {
  IssuedCertificateAlreadyRevokedError,
  RevokeIssuedCertificateInvalidRequestError,
} from "../../../../application/security/use-cases/RevokeIssuedCertificateUseCase";
import {
  IssuedCertificateRenewalNotAllowedError,
  RenewIssuedCertificateInvalidRequestError,
} from "../../../../application/security/use-cases/RenewIssuedCertificateUseCase";

describe("CertificateOperationsBackendApi", () => {
  it("returns certificate authority status introspection", async () => {
    const backend = createBackend({
      getCertificateAuthorityStatusIntrospectionUseCase: {
        execute: async () => Object.freeze({
          asOf: "2026-04-05T00:00:00.000Z",
          initialized: true,
          active: true,
          blocked: false,
          state: "healthy",
          certificateAuthorityId: "ca:internal:root:v1",
          diagnostics: Object.freeze([]),
          healthFlags: Object.freeze({
            startupHealthy: true,
            configurationBlocked: false,
            authorityActive: true,
            rotationDueSoon: false,
            rotationOverdue: false,
            hasRevokedCertificates: false,
            hasExpiringCertificates: false,
            hasDistributionFailures: false,
          }),
        }),
      },
    });

    const response = await backend.getCertificateAuthorityStatus({
      actorUserIdentityId: "user-identity:admin",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }

    expect(response.data.status.certificateAuthorityId).toBe("ca:internal:root:v1");
  });

  it("maps list use-case authorization failures to forbidden", async () => {
    const backend = createBackend({
      listIssuedCertificateMetadataUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: ListIssuedCertificateMetadataErrorCodes.forbidden,
            message: "forbidden",
          }),
        }),
      },
    });

    const response = await backend.listIssuedCertificates({
      actorUserIdentityId: "user-identity:admin",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(CertificateOperationsApiErrorCodes.forbidden);
  });

  it("maps get use-case not-found outcomes", async () => {
    const backend = createBackend({
      getIssuedCertificateMetadataUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: GetIssuedCertificateMetadataErrorCodes.notFound,
            message: "missing",
          }),
        }),
      },
    });

    const response = await backend.getIssuedCertificate({
      actorUserIdentityId: "user-identity:admin",
      serialNumber: "AA11",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(CertificateOperationsApiErrorCodes.notFound);
  });

  it("maps revoke conflicts and invalid requests", async () => {
    const revokedBackend = createBackend({
      revokeIssuedCertificateUseCase: {
        execute: async () => {
          throw new IssuedCertificateAlreadyRevokedError("AA11");
        },
      },
    });

    const revokedResponse = await revokedBackend.revokeIssuedCertificate({
      actorUserIdentityId: "user-identity:admin",
      serialNumber: "AA11",
      revocationReason: "key-compromise",
    });
    expect(revokedResponse.ok).toBeFalse();
    if (!revokedResponse.ok && revokedResponse.error) {
      expect(revokedResponse.error.code).toBe(CertificateOperationsApiErrorCodes.conflict);
    }

    const missingBackend = createBackend({
      revokeIssuedCertificateUseCase: {
        execute: async () => {
          throw new RevokeIssuedCertificateInvalidRequestError("Issued certificate 'AA11' was not found.");
        },
      },
    });

    const missingResponse = await missingBackend.revokeIssuedCertificate({
      actorUserIdentityId: "user-identity:admin",
      serialNumber: "AA11",
      revocationReason: "key-compromise",
    });
    expect(missingResponse.ok).toBeFalse();
    if (!missingResponse.ok && missingResponse.error) {
      expect(missingResponse.error.code).toBe(CertificateOperationsApiErrorCodes.notFound);
    }
  });

  it("maps renew conflict and invalid request outcomes", async () => {
    const conflictBackend = createBackend({
      renewIssuedCertificateUseCase: {
        execute: async () => {
          throw new IssuedCertificateRenewalNotAllowedError("AA11", "revoked");
        },
      },
    });

    const conflictResponse = await conflictBackend.renewIssuedCertificate({
      actorUserIdentityId: "user-identity:admin",
      serialNumber: "AA11",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----x-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "ed25519",
      certificateMaterialRef: "trust:material:new",
    });
    expect(conflictResponse.ok).toBeFalse();
    if (!conflictResponse.ok && conflictResponse.error) {
      expect(conflictResponse.error.code).toBe(CertificateOperationsApiErrorCodes.conflict);
    }

    const invalidBackend = createBackend({
      renewIssuedCertificateUseCase: {
        execute: async () => {
          throw new RenewIssuedCertificateInvalidRequestError("Issued certificate 'AA11' was not found.");
        },
      },
    });

    const invalidResponse = await invalidBackend.renewIssuedCertificate({
      actorUserIdentityId: "user-identity:admin",
      serialNumber: "AA11",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----x-----END PUBLIC KEY-----",
      publicKeyAlgorithm: "ed25519",
      certificateMaterialRef: "trust:material:new",
    });
    expect(invalidResponse.ok).toBeFalse();
    if (!invalidResponse.ok && invalidResponse.error) {
      expect(invalidResponse.error.code).toBe(CertificateOperationsApiErrorCodes.notFound);
    }
  });

  it("redacts sensitive internal error text for CA status failures", async () => {
    const backend = createBackend({
      getCertificateAuthorityStatusIntrospectionUseCase: {
        execute: async () => {
          throw new Error("failed to load private key -----BEGIN PRIVATE KEY-----");
        },
      },
    });

    const response = await backend.getCertificateAuthorityStatus({
      actorUserIdentityId: "user-identity:admin",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(CertificateOperationsApiErrorCodes.internal);
    expect(response.error.message).toBe("Failed to resolve certificate authority status.");
    expect(response.error.message.includes("PRIVATE KEY")).toBeFalse();
  });

  it("redacts sensitive use-case error text from list responses", async () => {
    const events: Array<Record<string, unknown>> = [];
    const backend = createBackend({
      listIssuedCertificateMetadataUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: ListIssuedCertificateMetadataErrorCodes.forbidden,
            message: "denied secret-store:internal-ca:root-key",
          }),
        }),
      },
      observabilityHook: async (event: unknown) => {
        events.push(event as Record<string, unknown>);
      },
    });

    const response = await backend.listIssuedCertificates({
      actorUserIdentityId: "user-identity:admin",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(CertificateOperationsApiErrorCodes.forbidden);
    expect(response.error.message).toBe("Actor is not authorized to list issued certificates.");
    expect(response.error.message.includes("secret-store")).toBeFalse();
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("certificate-operations.request.failed");
    expect(events[0]?.message).toBe("Actor is not authorized to list issued certificates.");
  });
});

function createBackend(overrides: Record<string, unknown>): CertificateOperationsBackendApi {
  const base = {
    getCertificateAuthorityStatusIntrospectionUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    listIssuedCertificateMetadataUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    getIssuedCertificateMetadataUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    revokeIssuedCertificateUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    renewIssuedCertificateUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
  };

  return new CertificateOperationsBackendApi({
    ...base,
    ...overrides,
  } as never);
}
