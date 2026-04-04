import type {
  AuthProvider,
  CredentialPolicy,
  UserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import type {
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
} from "../../contracts/IdentityApplicationContracts";

export interface IIdentityLookupRepository {
  findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined>;
  findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined>;
  findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference): Promise<UserIdentity | undefined>;
  findAuthProviderById(providerId: string): Promise<AuthProvider | undefined>;
  findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined>;
}
