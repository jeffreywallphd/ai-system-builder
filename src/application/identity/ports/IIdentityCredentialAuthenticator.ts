import type { LocalPasswordCredentialMaterial } from "./ILocalPasswordCredentialService";

export const IdentityAuthenticatorKinds = Object.freeze({
  password: "password",
  passkey: "passkey",
});

export type IdentityAuthenticatorKind =
  typeof IdentityAuthenticatorKinds[keyof typeof IdentityAuthenticatorKinds];

export interface IdentityAuthenticatorCapabilities {
  readonly canIssueCredentialMaterial: boolean;
  readonly canVerifyCredentialMaterial: boolean;
  readonly requiresSharedSecretCandidate: boolean;
}

export interface IIdentityCredentialAuthenticator {
  readonly kind: IdentityAuthenticatorKind;
  readonly capabilities: IdentityAuthenticatorCapabilities;
  normalizeCandidate(candidate: string): string;
  issueCredentialMaterial?(candidate: string): Promise<LocalPasswordCredentialMaterial>;
  verifyCandidate?(
    candidate: string,
    material: LocalPasswordCredentialMaterial,
  ): Promise<boolean>;
}
