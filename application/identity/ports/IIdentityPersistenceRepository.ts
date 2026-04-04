import type {
  AuthProvider,
  CredentialPolicy,
  UserIdentity,
} from "../../../src/domain/identity/IdentityDomain";

export interface IIdentityPersistenceRepository {
  saveUserIdentity(identity: UserIdentity): Promise<UserIdentity>;
  saveAuthProvider(provider: AuthProvider): Promise<AuthProvider>;
  saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy>;
}
