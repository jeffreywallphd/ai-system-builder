import type { TokenVerifierPort } from "../../../application/ports/security";
import { createAnonymousAuthContext } from "../../../contracts/security";
import { hashToken } from "../shared/hashToken";

export function createLanBearerTokenVerifierAdapter(deps: { findActiveDeviceCredentialByTokenHash: (request: { tokenHash: string; now: Date }) => Promise<any> }): TokenVerifierPort {
  return {
    async verifyToken({ token, now }) {
      const found = await deps.findActiveDeviceCredentialByTokenHash({ tokenHash: hashToken(token), now });
      if (!found) return createAnonymousAuthContext();
      return {
        authenticated: true,
        authMethod: "lan-pairing-token",
        principal: { principalId: found.deviceId, kind: "device", displayName: found.deviceName, roles: ["paired-device"], scopes: found.scopes },
        issuedAt: found.createdAt,
        expiresAt: found.expiresAt,
      };
    },
  };
}
