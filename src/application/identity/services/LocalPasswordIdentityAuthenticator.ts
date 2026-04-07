import type { LocalPasswordCredentialMaterial } from "../ports/ILocalPasswordCredentialService";
import type { ILocalPasswordCredentialService } from "../ports/ILocalPasswordCredentialService";
import {
  IdentityAuthenticatorKinds,
  type IIdentityCredentialAuthenticator,
} from "../ports/IIdentityCredentialAuthenticator";

export class LocalPasswordIdentityAuthenticator implements IIdentityCredentialAuthenticator {
  public readonly kind = IdentityAuthenticatorKinds.password;
  public readonly capabilities = Object.freeze({
    canIssueCredentialMaterial: true,
    canVerifyCredentialMaterial: true,
    requiresSharedSecretCandidate: true,
  });

  public constructor(private readonly passwordService: ILocalPasswordCredentialService) {}

  public normalizeCandidate(candidate: string): string {
    return this.passwordService.normalizePassword(candidate);
  }

  public async issueCredentialMaterial(candidate: string): Promise<LocalPasswordCredentialMaterial> {
    return this.passwordService.hashPassword(candidate);
  }

  public async verifyCandidate(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    return this.passwordService.verifyPassword(candidate, material);
  }
}
