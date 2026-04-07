import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  createAuthProvider,
} from "@domain/identity/IdentityDomain";
import { IdentityAuthenticatorKinds } from "../ports/IIdentityCredentialAuthenticator";
import type { ILocalPasswordCredentialService, LocalPasswordCredentialMaterial } from "../ports/ILocalPasswordCredentialService";
import {
  describeIdentityProvider,
  providerSupportsAuthenticator,
  validateIdentityProvider,
} from "../services/IdentityProviderCatalog";
import { LocalPasswordIdentityAuthenticator } from "../services/LocalPasswordIdentityAuthenticator";

class StubLocalPasswordCredentialService implements ILocalPasswordCredentialService {
  public normalizePassword(candidate: string): string {
    return candidate.normalize("NFKC");
  }

  public async hashPassword(candidate: string): Promise<LocalPasswordCredentialMaterial> {
    return Object.freeze({
      hashAlgorithm: "scrypt",
      hashValue: `hashed:${candidate}`,
      salt: "salt:stub",
    });
  }

  public async verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    return material.hashValue === `hashed:${candidate}`;
  }
}

describe("IdentityProviderCatalog", () => {
  it("describes local-password and passkey providers with local capability metadata", () => {
    const localPasswordProvider = createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
      status: AuthProviderStatuses.active,
    });
    const passkeyProvider = createAuthProvider({
      id: "provider:passkey",
      kind: AuthProviderKinds.passkey,
      category: AuthProviderCategories.local,
      displayName: "Local Passkey",
      status: AuthProviderStatuses.active,
    });

    const passwordDescriptor = describeIdentityProvider(localPasswordProvider);
    const passkeyDescriptor = describeIdentityProvider(passkeyProvider);

    expect(passwordDescriptor?.capabilities.supportedAuthenticators).toEqual(["password"]);
    expect(passwordDescriptor?.credentialHandling.supportsCredentialMaterialRecords).toBe(true);
    expect(passwordDescriptor?.identityLinkage.subjectModel).toBe("provider-subject");
    expect(passkeyDescriptor?.capabilities.supportedAuthenticators).toEqual(["passkey"]);
    expect(passkeyDescriptor?.capabilities.supportsUsernamelessSignIn).toBe(true);
  });

  it("checks provider-to-authenticator compatibility without hard-coding local-password", () => {
    const localPasswordProvider = createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
      status: AuthProviderStatuses.active,
    });
    const passkeyProvider = createAuthProvider({
      id: "provider:passkey",
      kind: AuthProviderKinds.passkey,
      category: AuthProviderCategories.local,
      displayName: "Local Passkey",
      status: AuthProviderStatuses.active,
    });

    expect(providerSupportsAuthenticator(localPasswordProvider, IdentityAuthenticatorKinds.password)).toBe(true);
    expect(providerSupportsAuthenticator(localPasswordProvider, IdentityAuthenticatorKinds.passkey)).toBe(false);
    expect(providerSupportsAuthenticator(passkeyProvider, IdentityAuthenticatorKinds.password)).toBe(false);
    expect(providerSupportsAuthenticator(passkeyProvider, IdentityAuthenticatorKinds.passkey)).toBe(true);
  });

  it("validates provider requirements for local credential-backed flows", () => {
    const localPasswordProvider = createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
      status: AuthProviderStatuses.active,
    });
    const externalProvider = createAuthProvider({
      id: "provider:oidc",
      kind: AuthProviderKinds.oidc,
      category: AuthProviderCategories.external,
      displayName: "OIDC",
      status: AuthProviderStatuses.active,
    });

    const validLocal = validateIdentityProvider(localPasswordProvider, {
      expectedCategory: AuthProviderCategories.local,
      authenticatorKind: IdentityAuthenticatorKinds.password,
      requireCredentialPolicy: true,
      requireCredentialMaterialRecords: true,
    });
    const invalidExternal = validateIdentityProvider(externalProvider, {
      expectedCategory: AuthProviderCategories.local,
      authenticatorKind: IdentityAuthenticatorKinds.password,
      requireCredentialPolicy: true,
      requireCredentialMaterialRecords: true,
    });

    expect(validLocal.ok).toBe(true);
    expect(invalidExternal).toEqual({
      ok: false,
      failure: expect.objectContaining({
        code: "unexpected-category",
      }),
    });
  });
});

describe("LocalPasswordIdentityAuthenticator", () => {
  it("adapts local password credential service into the shared authenticator contract", async () => {
    const authenticator = new LocalPasswordIdentityAuthenticator(new StubLocalPasswordCredentialService());

    const normalized = authenticator.normalizeCandidate("Passphrase");
    const material = await authenticator.issueCredentialMaterial?.(normalized);
    const isValid = material
      ? await authenticator.verifyCandidate?.(normalized, material)
      : false;

    expect(authenticator.kind).toBe(IdentityAuthenticatorKinds.password);
    expect(authenticator.capabilities).toEqual({
      canIssueCredentialMaterial: true,
      canVerifyCredentialMaterial: true,
      requiresSharedSecretCandidate: true,
    });
    expect(material?.hashAlgorithm).toBe("scrypt");
    expect(isValid).toBe(true);
  });
});

