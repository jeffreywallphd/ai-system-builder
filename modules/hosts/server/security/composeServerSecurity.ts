import crypto from "node:crypto";
import path from "node:path";
import { CompleteLanPairingService, GetSecurityStatusService } from "../../../application/services/security";
import { createLanPairingTokenIssuerAdapter } from "../../../adapters/security/lan/createLanPairingTokenIssuerAdapter";
import { createLanDeviceCredentialStoreAdapter } from "../../../adapters/security/lan/createLanDeviceCredentialStoreAdapter";
import { createLanBearerTokenVerifierAdapter } from "../../../adapters/security/lan/createLanBearerTokenVerifierAdapter";
import { createLanPairingCodeStoreAdapter } from "../../../adapters/security/lan/createLanPairingCodeStoreAdapter";
import { createExpressSecurityMiddleware, createInMemoryDevSecurityEnforcementStore } from "../../../adapters/transport/api-express/security";
import { resolveServerSecurityConfig } from "./resolveServerSecurityConfig";

const DEV_ONLY_INSECURE_TOKEN_HASH_SECRET = "dev-only-insecure-token-hash-secret";

function resolveTokenHashSecret(env: NodeJS.ProcessEnv, mode: "disabled-dev" | "lan-https-token"): string {
  const configuredSecret = env.SERVER_TOKEN_HASH_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (mode === "disabled-dev") {
    console.warn("[security] SERVER_TOKEN_HASH_SECRET is not set; using dev-only insecure token hash secret for disabled-dev mode.");
    return DEV_ONLY_INSECURE_TOKEN_HASH_SECRET;
  }
  throw new Error("SERVER_TOKEN_HASH_SECRET is required in lan-https-token mode. Set a strong random secret in your environment before starting the server.");
}

export function composeServerSecurity(env: NodeJS.ProcessEnv, storageRootDirectory: string) {
  const config = resolveServerSecurityConfig(env, storageRootDirectory);
  const credentials = createLanDeviceCredentialStoreAdapter(path.join(config.securityStorePath, "device-credentials.json"));
  const tokenHashSecret = resolveTokenHashSecret(env, config.mode);
  const verifier = createLanBearerTokenVerifierAdapter({ findCredentialByTokenHash: credentials.findDeviceCredentialByTokenHash, tokenHashSecret });
  const completePairing = new CompleteLanPairingService({
    pairingCodes: createLanPairingCodeStoreAdapter(path.join(config.securityStorePath, "pairing-codes.json")),
    tokens: createLanPairingTokenIssuerAdapter(tokenHashSecret),
    credentials,
    idGenerator: {
      createDeviceId: () => `device-${crypto.randomUUID()}`,
      createSecurityEventId: () => `evt-${crypto.randomUUID()}`,
    },
  });
  const getStatusService = new GetSecurityStatusService(credentials);
  const devSecurityEnforcement = createInMemoryDevSecurityEnforcementStore(config.devSecurityToggleEnabled ? "disabled-dev" : undefined);
  const middleware = createExpressSecurityMiddleware({ verifyToken: verifier.verifyToken.bind(verifier), httpsRequired: config.httpsRequired, authRequired: config.authRequired, mode: config.mode, devSecurityEnforcement });
  return { config, middleware, services: { completePairing, getStatusService }, credentials, devSecurityEnforcement };
}
