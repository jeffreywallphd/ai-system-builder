import {
  AuthProviderCategories,
  AuthProviderKinds,
  type AuthProvider,
  type AuthProviderCategory,
  type AuthProviderKind,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityAuthenticatorKinds,
  type IdentityAuthenticatorKind,
} from "../ports/IIdentityCredentialAuthenticator";

export interface LocalAuthProviderCapabilities {
  readonly supportedAuthenticators: ReadonlyArray<IdentityAuthenticatorKind>;
  readonly supportsCredentialPolicy: boolean;
  readonly supportsCredentialMaterialRecords: boolean;
  readonly supportsUsernamelessSignIn: boolean;
}

export interface IdentityProviderDescriptor {
  readonly providerKind: AuthProviderKind;
  readonly providerCategory: AuthProviderCategory;
  readonly localCapabilities?: LocalAuthProviderCapabilities;
}

const ProviderDescriptorsByKind: Readonly<Record<AuthProviderKind, IdentityProviderDescriptor>> = Object.freeze({
  [AuthProviderKinds.localPassword]: Object.freeze({
    providerKind: AuthProviderKinds.localPassword,
    providerCategory: AuthProviderCategories.local,
    localCapabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([IdentityAuthenticatorKinds.password]),
      supportsCredentialPolicy: true,
      supportsCredentialMaterialRecords: true,
      supportsUsernamelessSignIn: false,
    }),
  }),
  [AuthProviderKinds.passkey]: Object.freeze({
    providerKind: AuthProviderKinds.passkey,
    providerCategory: AuthProviderCategories.local,
    localCapabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([IdentityAuthenticatorKinds.passkey]),
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
      supportsUsernamelessSignIn: true,
    }),
  }),
  [AuthProviderKinds.oidc]: Object.freeze({
    providerKind: AuthProviderKinds.oidc,
    providerCategory: AuthProviderCategories.external,
  }),
  [AuthProviderKinds.oauth2]: Object.freeze({
    providerKind: AuthProviderKinds.oauth2,
    providerCategory: AuthProviderCategories.external,
  }),
  [AuthProviderKinds.saml]: Object.freeze({
    providerKind: AuthProviderKinds.saml,
    providerCategory: AuthProviderCategories.external,
  }),
  [AuthProviderKinds.custom]: Object.freeze({
    providerKind: AuthProviderKinds.custom,
    providerCategory: AuthProviderCategories.external,
  }),
});

export function describeIdentityProvider(provider: Pick<AuthProvider, "kind" | "category">): IdentityProviderDescriptor | undefined {
  const descriptor = ProviderDescriptorsByKind[provider.kind];
  if (!descriptor) {
    return undefined;
  }

  if (descriptor.providerCategory !== provider.category) {
    return undefined;
  }

  return descriptor;
}

export function providerSupportsAuthenticator(
  provider: Pick<AuthProvider, "kind" | "category">,
  authenticatorKind: IdentityAuthenticatorKind,
): boolean {
  const descriptor = describeIdentityProvider(provider);
  if (!descriptor?.localCapabilities) {
    return false;
  }

  return descriptor.localCapabilities.supportedAuthenticators.includes(authenticatorKind);
}
