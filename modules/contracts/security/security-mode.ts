export const SECURITY_MODES = ["disabled-dev", "lan-https-token", "external-tls", "mtls", "api-key"] as const;
export type SecurityMode = (typeof SECURITY_MODES)[number];

export interface SecurityModeConfig {
  mode: SecurityMode;
  httpsRequired: boolean;
  authRequired: boolean;
  allowLocalhostWithoutAuth: boolean;
}
