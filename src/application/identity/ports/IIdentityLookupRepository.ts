import type {
  AuthProvider,
  CredentialPolicy,
  UserIdentity,
} from "@domain/identity/IdentityDomain";
import type {
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
  IdentityUserIdentityListQuery,
} from "@shared/dto/identity/IdentityPersistenceDtos";

export interface IIdentityLookupRepository {
  countUserIdentities(): Promise<number>;
  findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined>;
  listUserIdentities(query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>>;
  findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined>;
  findUserIdentityByProviderSubject(
    reference: IdentityProviderSubjectReference,
  ): Promise<UserIdentity | undefined>;
  findAuthProviderById(providerId: string): Promise<AuthProvider | undefined>;
  findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined>;
}

