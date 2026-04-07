import {
  AuthProviderStatuses,
  AuthProviderCategories,
  AuthProviderKinds,
  type AuthProvider,
  type AuthProviderCategory,
  type AuthProviderKind,
  type AuthProviderStatus,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityAuthenticatorKinds,
  type IdentityAuthenticatorKind,
} from "../ports/IIdentityCredentialAuthenticator";

export const IdentityProviderCredentialMaterialModes = Object.freeze({
  localSharedSecret: "local-shared-secret",
  localPublicKey: "local-public-key",
  externalFederatedAssertion: "external-federated-assertion",
  none: "none",
});

export type IdentityProviderCredentialMaterialMode =
  typeof IdentityProviderCredentialMaterialModes[keyof typeof IdentityProviderCredentialMaterialModes];

export interface IdentityProviderCapabilities {
  readonly supportedAuthenticators: ReadonlyArray<IdentityAuthenticatorKind>;
  readonly supportsUsernamelessSignIn: boolean;
}

export interface IdentityProviderCredentialHandlingDescriptor {
  readonly materialMode: IdentityProviderCredentialMaterialMode;
  readonly supportsCredentialPolicy: boolean;
  readonly supportsCredentialMaterialRecords: boolean;
}

export interface IdentityProviderIdentityLinkageModel {
  readonly ownershipScope: "platform-user-identity";
  readonly subjectModel: "provider-subject";
  readonly authorizationSubjectModel: "user-identity";
}

export interface IdentityProviderDescriptor {
  readonly providerKind: AuthProviderKind;
  readonly providerCategory: AuthProviderCategory;
  readonly capabilities: IdentityProviderCapabilities;
  readonly credentialHandling: IdentityProviderCredentialHandlingDescriptor;
  readonly identityLinkage: IdentityProviderIdentityLinkageModel;
}

const ProviderDescriptorsByKind: Readonly<Record<AuthProviderKind, IdentityProviderDescriptor>> = Object.freeze({
  [AuthProviderKinds.localPassword]: Object.freeze({
    providerKind: AuthProviderKinds.localPassword,
    providerCategory: AuthProviderCategories.local,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([IdentityAuthenticatorKinds.password]),
      supportsUsernamelessSignIn: false,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.localSharedSecret,
      supportsCredentialPolicy: true,
      supportsCredentialMaterialRecords: true,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
  }),
  [AuthProviderKinds.passkey]: Object.freeze({
    providerKind: AuthProviderKinds.passkey,
    providerCategory: AuthProviderCategories.local,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([IdentityAuthenticatorKinds.passkey]),
      supportsUsernamelessSignIn: true,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.localPublicKey,
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
  }),
  [AuthProviderKinds.oidc]: Object.freeze({
    providerKind: AuthProviderKinds.oidc,
    providerCategory: AuthProviderCategories.external,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([]),
      supportsUsernamelessSignIn: false,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.externalFederatedAssertion,
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
  }),
  [AuthProviderKinds.oauth2]: Object.freeze({
    providerKind: AuthProviderKinds.oauth2,
    providerCategory: AuthProviderCategories.external,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([]),
      supportsUsernamelessSignIn: false,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.externalFederatedAssertion,
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
  }),
  [AuthProviderKinds.saml]: Object.freeze({
    providerKind: AuthProviderKinds.saml,
    providerCategory: AuthProviderCategories.external,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([]),
      supportsUsernamelessSignIn: false,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.externalFederatedAssertion,
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
  }),
  [AuthProviderKinds.custom]: Object.freeze({
    providerKind: AuthProviderKinds.custom,
    providerCategory: AuthProviderCategories.external,
    capabilities: Object.freeze({
      supportedAuthenticators: Object.freeze([]),
      supportsUsernamelessSignIn: false,
    }),
    credentialHandling: Object.freeze({
      materialMode: IdentityProviderCredentialMaterialModes.none,
      supportsCredentialPolicy: false,
      supportsCredentialMaterialRecords: false,
    }),
    identityLinkage: Object.freeze({
      ownershipScope: "platform-user-identity",
      subjectModel: "provider-subject",
      authorizationSubjectModel: "user-identity",
    }),
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
  return descriptor?.capabilities.supportedAuthenticators.includes(authenticatorKind) ?? false;
}

export interface IdentityProviderValidationRequirements {
  readonly expectedCategory?: AuthProviderCategory;
  readonly requiredStatus?: AuthProviderStatus;
  readonly authenticatorKind?: IdentityAuthenticatorKind;
  readonly requireCredentialPolicy?: boolean;
  readonly requireCredentialMaterialRecords?: boolean;
}

export interface IdentityProviderValidationFailure {
  readonly code:
    | "descriptor-missing"
    | "category-mismatch"
    | "unexpected-category"
    | "unsupported-authenticator"
    | "inactive-provider"
    | "missing-credential-policy-support"
    | "missing-credential-material-support";
  readonly message: string;
}

export type IdentityProviderValidationResult =
  | {
    readonly ok: true;
    readonly descriptor: IdentityProviderDescriptor;
  }
  | {
    readonly ok: false;
    readonly failure: IdentityProviderValidationFailure;
  };

export function validateIdentityProvider(
  provider: Pick<AuthProvider, "id" | "kind" | "category" | "status">,
  requirements: IdentityProviderValidationRequirements,
): IdentityProviderValidationResult {
  const descriptor = describeIdentityProvider(provider);
  if (!descriptor) {
    return {
      ok: false,
      failure: {
        code: "descriptor-missing",
        message: `Provider '${provider.id}' does not map to a supported provider descriptor.`,
      },
    };
  }

  if (descriptor.providerCategory !== provider.category) {
    return {
      ok: false,
      failure: {
        code: "category-mismatch",
        message: `Provider '${provider.id}' category '${provider.category}' does not match descriptor category '${descriptor.providerCategory}'.`,
      },
    };
  }

  if (requirements.expectedCategory && provider.category !== requirements.expectedCategory) {
    return {
      ok: false,
      failure: {
        code: "unexpected-category",
        message: `Provider '${provider.id}' is not a '${requirements.expectedCategory}' provider.`,
      },
    };
  }

  const requiredStatus = requirements.requiredStatus ?? AuthProviderStatuses.active;
  if (provider.status !== requiredStatus) {
    return {
      ok: false,
      failure: {
        code: "inactive-provider",
        message: `Provider '${provider.id}' must be '${requiredStatus}'.`,
      },
    };
  }

  if (
    requirements.authenticatorKind
    && !descriptor.capabilities.supportedAuthenticators.includes(requirements.authenticatorKind)
  ) {
    return {
      ok: false,
      failure: {
        code: "unsupported-authenticator",
        message: `Provider '${provider.id}' does not support authenticator '${requirements.authenticatorKind}'.`,
      },
    };
  }

  if (requirements.requireCredentialPolicy && !descriptor.credentialHandling.supportsCredentialPolicy) {
    return {
      ok: false,
      failure: {
        code: "missing-credential-policy-support",
        message: `Provider '${provider.id}' does not support credential policy enforcement.`,
      },
    };
  }

  if (requirements.requireCredentialMaterialRecords && !descriptor.credentialHandling.supportsCredentialMaterialRecords) {
    return {
      ok: false,
      failure: {
        code: "missing-credential-material-support",
        message: `Provider '${provider.id}' does not support credential material records.`,
      },
    };
  }

  return {
    ok: true,
    descriptor,
  };
}
