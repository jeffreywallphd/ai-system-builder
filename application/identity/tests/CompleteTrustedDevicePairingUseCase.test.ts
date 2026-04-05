import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
} from "../../../src/domain/identity/TrustedDeviceDomain";
import { PairingSessionStatuses, PairingTokenStatuses } from "../../../src/domain/identity/TrustedDevicePairingDomain";
import type {
  TrustedDevicePairingCompletionRequest,
  TrustedDevicePairingCompletionResponse,
} from "../../contracts/IdentityApplicationContracts";
import { CompleteTrustedDevicePairingUseCase } from "../../../src/application/identity/use-cases/CompleteTrustedDevicePairingUseCase";

class StubPairingService {
  public requests: TrustedDevicePairingCompletionRequest[] = [];

  public async completePairing(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevicePairingCompletionResponse> {
    this.requests.push(request);
    return Object.freeze({
      pairingSession: {
        id: request.pairingSessionId,
        trustedDeviceId: request.trustedDeviceId,
        userIdentityId: request.userIdentityId,
        pairingTokenId: request.pairingTokenId,
        status: PairingSessionStatuses.completed,
        initiatedAt: "2026-04-04T11:59:00.000Z",
        completedAt: "2026-04-04T12:00:00.000Z",
        updatedAt: "2026-04-04T12:00:00.000Z",
      },
      pairingToken: {
        id: request.pairingTokenId,
        pairingSessionId: request.pairingSessionId,
        trustedDeviceId: request.trustedDeviceId,
        userIdentityId: request.userIdentityId,
        artifactType: "one-time-code",
        tokenHash: "hash",
        hashAlgorithm: "sha256",
        actorBinding: {
          scope: "same-user",
          userIdentityId: request.userIdentityId,
        },
        issuance: {},
        status: PairingTokenStatuses.consumed,
        issuedAt: "2026-04-04T11:59:00.000Z",
        expiresAt: "2026-04-04T12:30:00.000Z",
        failedValidationAttempts: 0,
        maxValidationAttempts: 5,
        consumedAt: "2026-04-04T12:00:00.000Z",
        updatedAt: "2026-04-04T12:00:00.000Z",
      },
      trustedDevice: {
        id: request.trustedDeviceId,
        userIdentityId: request.userIdentityId,
        displayName: {
          value: "Device",
        },
        fingerprint: createDeviceFingerprint({
          algorithm: DeviceFingerprintAlgorithms.sha256,
          value: "fingerprint",
        }),
        pairingMethod: DevicePairingMethods.oneTimeCode,
        trustStatus: DeviceTrustStatuses.trusted,
        trustMaterialRef: createDeviceTrustMaterialRef({
          materialId: "material:1",
          kind: DeviceTrustMaterialKinds.sessionSigningKey,
        }),
        registeredAt: "2026-04-04T11:58:00.000Z",
        pairedAt: "2026-04-04T12:00:00.000Z",
        metadata: {},
        updatedAt: "2026-04-04T12:00:00.000Z",
      },
    });
  }
}

describe("CompleteTrustedDevicePairingUseCase", () => {
  it("delegates completion through the trusted-device pairing service", async () => {
    const service = new StubPairingService();
    const useCase = new CompleteTrustedDevicePairingUseCase({
      pairingService: service,
    });

    const request: TrustedDevicePairingCompletionRequest = {
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      trustedDeviceId: "trusted-device:1",
      userIdentityId: "user:1",
      presentedToken: "PAIR-SECRET",
    };

    const result = await useCase.execute(request);

    expect(service.requests).toEqual([request]);
    expect(result.pairingSession.status).toBe(PairingSessionStatuses.completed);
    expect(result.pairingToken.status).toBe(PairingTokenStatuses.consumed);
    expect(result.trustedDevice.trustStatus).toBe(DeviceTrustStatuses.trusted);
  });
});
