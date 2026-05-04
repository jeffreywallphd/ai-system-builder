import path from "node:path";
import { DEFAULT_DEVICE_TOKEN_TTL_DAYS, DEFAULT_SECURITY_MODE } from "./serverSecurityDefaults";

export function resolveServerSecurityConfig(env: NodeJS.ProcessEnv, storageRootDirectory: string) {
  const mode = (env.AI_SYSTEM_BUILDER_SECURITY_MODE?.trim() || DEFAULT_SECURITY_MODE) as "disabled-dev" | "lan-https-token";
  const httpsEnabled = env.AI_SYSTEM_BUILDER_HTTPS_ENABLED === "true" || mode === "lan-https-token";
  const httpsRequired = mode === "lan-https-token";
  const tlsCertPath = env.AI_SYSTEM_BUILDER_TLS_CERT_PATH?.trim();
  const tlsKeyPath = env.AI_SYSTEM_BUILDER_TLS_KEY_PATH?.trim();
  if (httpsRequired && !tlsCertPath) throw new Error("AI_SYSTEM_BUILDER_TLS_CERT_PATH is required in lan-https-token mode. Provide a readable TLS certificate PEM path.");
  if (httpsRequired && !tlsKeyPath) throw new Error("AI_SYSTEM_BUILDER_TLS_KEY_PATH is required in lan-https-token mode. Provide a readable TLS private key PEM path.");
  return {
    mode, httpsEnabled, httpsRequired, tlsCertPath, tlsKeyPath,
    pairingEnabled: env.AI_SYSTEM_BUILDER_PAIRING_ENABLED !== "false",
    deviceTokenTtlDays: Number(env.AI_SYSTEM_BUILDER_DEVICE_TOKEN_TTL_DAYS || DEFAULT_DEVICE_TOKEN_TTL_DAYS),
    allowLocalhostWithoutAuth: env.AI_SYSTEM_BUILDER_ALLOW_LOCALHOST_WITHOUT_AUTH === "true",
    securityStorePath: env.AI_SYSTEM_BUILDER_SECURITY_STORE_PATH?.trim() || path.join(storageRootDirectory, "config", "security"),
    authRequired: mode !== "disabled-dev",
  };
}
