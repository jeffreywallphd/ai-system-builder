import type { AuthPrincipal } from "./auth-principal";
import type { SecurityMode } from "./security-mode";

export interface SecurityStatus {
  mode: SecurityMode;
  httpsEnabled: boolean;
  httpsRequired: boolean;
  authRequired: boolean;
  pairingEnabled: boolean;
  pairedDeviceCount?: number;
  currentPrincipal?: AuthPrincipal;
}
