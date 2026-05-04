import path from "node:path";
import { CompleteLanPairingService, GetSecurityStatusService } from "../../../application/services/security";
import { createLanPairingTokenIssuerAdapter } from "../../../adapters/security/lan/createLanPairingTokenIssuerAdapter";
import { createLanDeviceCredentialStoreAdapter } from "../../../adapters/security/lan/createLanDeviceCredentialStoreAdapter";
import { createLanBearerTokenVerifierAdapter } from "../../../adapters/security/lan/createLanBearerTokenVerifierAdapter";
import { createLanPairingCodeStoreAdapter } from "../../../adapters/security/lan/createLanPairingCodeStoreAdapter";
import { createExpressSecurityMiddleware } from "../../../adapters/transport/api-express/security";
import { resolveServerSecurityConfig } from "./resolveServerSecurityConfig";

export function composeServerSecurity(env: NodeJS.ProcessEnv, storageRootDirectory: string) {
  const config = resolveServerSecurityConfig(env, storageRootDirectory);
  const credentials = createLanDeviceCredentialStoreAdapter(path.join(config.securityStorePath, "device-credentials.json"));
  const verifier = createLanBearerTokenVerifierAdapter(credentials);
  const completePairing = new CompleteLanPairingService({
    pairingCodes: createLanPairingCodeStoreAdapter(),
    tokens: createLanPairingTokenIssuerAdapter(),
    credentials,
  });
  const getStatusService = new GetSecurityStatusService(credentials);
  const middleware = createExpressSecurityMiddleware({ verifyToken: verifier.verifyToken.bind(verifier), httpsRequired: config.httpsRequired });
  return { config, middleware, services: { completePairing, getStatusService }, credentials };
}
