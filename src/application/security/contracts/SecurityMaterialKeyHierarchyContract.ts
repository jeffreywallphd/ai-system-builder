import {
  createSecurityMaterialRotationPolicyMetadata,
  type SecurityMaterialRotationPolicyMetadata,
} from "./SecurityMaterialRotationContract";

export const SecurityMaterialHierarchyClasses = Object.freeze({
  serverRootMaterial: "server-root-material",
  tokenSigningKey: "token-signing-key",
  certificateAuthorityKey: "certificate-authority-key",
  workspaceEncryptionMaterial: "workspace-encryption-material",
  storageContentKey: "storage-content-key",
  userDeviceTrustMaterial: "user-device-trust-material",
  providerCredentialMaterial: "provider-credential-material",
  serverRuntimeSecretMaterial: "server-runtime-secret-material",
});

export type SecurityMaterialHierarchyClass =
  typeof SecurityMaterialHierarchyClasses[keyof typeof SecurityMaterialHierarchyClasses];

export const SecurityMaterialOwningSubsystems = Object.freeze({
  serverControlPlane: "server-control-plane",
  identitySessionService: "identity-session-service",
  certificateAuthorityService: "certificate-authority-service",
  workspaceSecurityService: "workspace-security-service",
  assetProtectionService: "asset-protection-service",
  userDeviceTrustService: "user-device-trust-service",
  providerIntegrationService: "provider-integration-service",
});

export type SecurityMaterialOwningSubsystem =
  typeof SecurityMaterialOwningSubsystems[keyof typeof SecurityMaterialOwningSubsystems];

export const SecurityMaterialStorageSubsystems = Object.freeze({
  durableServerSecretStore: "durable-server-secret-store",
  certificateAuthorityStore: "certificate-authority-store",
  workspaceSecretStore: "workspace-secret-store",
  assetKeyStore: "asset-key-store",
  localUserSecureStore: "local-user-secure-store",
});

export type SecurityMaterialStorageSubsystem =
  typeof SecurityMaterialStorageSubsystems[keyof typeof SecurityMaterialStorageSubsystems];

export const SecurityMaterialConsumerSubsystems = Object.freeze({
  serverBootstrap: "server-bootstrap",
  transportSecurity: "transport-security",
  identityTokenIssuance: "identity-token-issuance",
  workspaceEncryption: "workspace-encryption",
  assetStorage: "asset-storage",
  userDeviceTrust: "user-device-trust",
  providerRuntime: "provider-runtime",
});

export type SecurityMaterialConsumerSubsystem =
  typeof SecurityMaterialConsumerSubsystems[keyof typeof SecurityMaterialConsumerSubsystems];

export const SecurityMaterialCreationModes = Object.freeze({
  generatedAtBootstrap: "generated-at-bootstrap",
  externallyProvisioned: "externally-provisioned",
  migratedFromLegacyInput: "migrated-from-legacy-input",
});

export type SecurityMaterialCreationMode =
  typeof SecurityMaterialCreationModes[keyof typeof SecurityMaterialCreationModes];

export const SecurityMaterialRotationModes = Object.freeze({
  manual: "manual",
  scheduled: "scheduled",
  onCompromise: "on-compromise",
  ephemeralPerStartup: "ephemeral-per-startup",
});

export type SecurityMaterialRotationMode =
  typeof SecurityMaterialRotationModes[keyof typeof SecurityMaterialRotationModes];

export const SecurityMaterialRevocationModes = Object.freeze({
  required: "required",
  optional: "optional",
  notApplicable: "not-applicable",
});

export type SecurityMaterialRevocationMode =
  typeof SecurityMaterialRevocationModes[keyof typeof SecurityMaterialRevocationModes];

export interface SecurityMaterialHierarchyLifecycleGovernance {
  readonly creationMode: SecurityMaterialCreationMode;
  readonly rotationMode: SecurityMaterialRotationMode;
  readonly revocationMode: SecurityMaterialRevocationMode;
  readonly requiresReEncryptionOnRotation: boolean;
  readonly rotationPolicy?: SecurityMaterialRotationPolicyMetadata;
}

export interface SecurityMaterialHierarchyOwnership {
  readonly ownerScope: "server" | "workspace" | "user" | "storage-instance";
  readonly ownerSubsystem: SecurityMaterialOwningSubsystem;
  readonly storageSubsystem: SecurityMaterialStorageSubsystem;
  readonly consumerSubsystems: ReadonlyArray<SecurityMaterialConsumerSubsystem>;
}

export interface SecurityMaterialKeyHierarchyContract {
  readonly hierarchyClass: SecurityMaterialHierarchyClass;
  readonly ownership: SecurityMaterialHierarchyOwnership;
  readonly lifecycle: SecurityMaterialHierarchyLifecycleGovernance;
}

const hierarchyClassRules: Readonly<Record<SecurityMaterialHierarchyClass, {
  readonly allowedScopes: ReadonlyArray<SecurityMaterialHierarchyOwnership["ownerScope"]>;
  readonly allowedCategories: ReadonlyArray<string>;
}>> = Object.freeze({
  [SecurityMaterialHierarchyClasses.serverRootMaterial]: Object.freeze({
    allowedScopes: Object.freeze(["server"]),
    allowedCategories: Object.freeze(["encryption-key", "certificate-material"]),
  }),
  [SecurityMaterialHierarchyClasses.tokenSigningKey]: Object.freeze({
    allowedScopes: Object.freeze(["server"]),
    allowedCategories: Object.freeze(["signing-material"]),
  }),
  [SecurityMaterialHierarchyClasses.certificateAuthorityKey]: Object.freeze({
    allowedScopes: Object.freeze(["server"]),
    allowedCategories: Object.freeze(["certificate-material"]),
  }),
  [SecurityMaterialHierarchyClasses.workspaceEncryptionMaterial]: Object.freeze({
    allowedScopes: Object.freeze(["workspace"]),
    allowedCategories: Object.freeze(["encryption-key"]),
  }),
  [SecurityMaterialHierarchyClasses.storageContentKey]: Object.freeze({
    allowedScopes: Object.freeze(["storage-instance", "workspace", "server"]),
    allowedCategories: Object.freeze(["encryption-key", "secret-credential"]),
  }),
  [SecurityMaterialHierarchyClasses.userDeviceTrustMaterial]: Object.freeze({
    allowedScopes: Object.freeze(["user"]),
    allowedCategories: Object.freeze(["transport-trust", "certificate-material", "signing-material"]),
  }),
  [SecurityMaterialHierarchyClasses.providerCredentialMaterial]: Object.freeze({
    allowedScopes: Object.freeze(["server", "workspace", "user"]),
    allowedCategories: Object.freeze(["secret-credential"]),
  }),
  [SecurityMaterialHierarchyClasses.serverRuntimeSecretMaterial]: Object.freeze({
    allowedScopes: Object.freeze(["server"]),
    allowedCategories: Object.freeze(["secret-credential"]),
  }),
});

function assertOneOf<T extends string>(
  value: string,
  allowed: ReadonlyArray<T>,
  errorPrefix: string,
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`${errorPrefix} '${value}' is invalid.`);
  }
}

export function createSecurityMaterialKeyHierarchyContract(
  input: SecurityMaterialKeyHierarchyContract,
): SecurityMaterialKeyHierarchyContract {
  assertOneOf(
    input.hierarchyClass,
    Object.values(SecurityMaterialHierarchyClasses),
    "Security material hierarchy class",
  );
  assertOneOf(
    input.ownership.ownerScope,
    ["server", "workspace", "user", "storage-instance"],
    "Security material hierarchy owner scope",
  );
  assertOneOf(
    input.ownership.ownerSubsystem,
    Object.values(SecurityMaterialOwningSubsystems),
    "Security material hierarchy owner subsystem",
  );
  assertOneOf(
    input.ownership.storageSubsystem,
    Object.values(SecurityMaterialStorageSubsystems),
    "Security material hierarchy storage subsystem",
  );
  if (input.ownership.consumerSubsystems.length === 0) {
    throw new Error("Security material hierarchy must define at least one consumer subsystem.");
  }
  for (const consumerSubsystem of input.ownership.consumerSubsystems) {
    assertOneOf(
      consumerSubsystem,
      Object.values(SecurityMaterialConsumerSubsystems),
      "Security material hierarchy consumer subsystem",
    );
  }

  assertOneOf(
    input.lifecycle.creationMode,
    Object.values(SecurityMaterialCreationModes),
    "Security material hierarchy creation mode",
  );
  assertOneOf(
    input.lifecycle.rotationMode,
    Object.values(SecurityMaterialRotationModes),
    "Security material hierarchy rotation mode",
  );
  assertOneOf(
    input.lifecycle.revocationMode,
    Object.values(SecurityMaterialRevocationModes),
    "Security material hierarchy revocation mode",
  );

  return Object.freeze({
    hierarchyClass: input.hierarchyClass,
    ownership: Object.freeze({
      ownerScope: input.ownership.ownerScope,
      ownerSubsystem: input.ownership.ownerSubsystem,
      storageSubsystem: input.ownership.storageSubsystem,
      consumerSubsystems: Object.freeze([...new Set(input.ownership.consumerSubsystems)]),
    }),
    lifecycle: Object.freeze({
      creationMode: input.lifecycle.creationMode,
      rotationMode: input.lifecycle.rotationMode,
      revocationMode: input.lifecycle.revocationMode,
      requiresReEncryptionOnRotation: input.lifecycle.requiresReEncryptionOnRotation,
      rotationPolicy: input.lifecycle.rotationPolicy
        ? createSecurityMaterialRotationPolicyMetadata(input.lifecycle.rotationPolicy)
        : undefined,
    }),
  });
}

export function assertSecurityMaterialKeyHierarchyCompatibility(input: {
  readonly materialId: string;
  readonly hierarchy: SecurityMaterialKeyHierarchyContract;
  readonly scope: "server" | "workspace" | "user" | "storage-instance";
  readonly category: string;
}): void {
  if (input.hierarchy.ownership.ownerScope !== input.scope) {
    throw new Error(
      `Security material '${input.materialId}' hierarchy owner scope '${input.hierarchy.ownership.ownerScope}' does not match classification scope '${input.scope}'.`,
    );
  }

  const classRule = hierarchyClassRules[input.hierarchy.hierarchyClass];
  if (!classRule.allowedScopes.includes(input.scope)) {
    throw new Error(
      `Security material '${input.materialId}' hierarchy class '${input.hierarchy.hierarchyClass}' does not allow scope '${input.scope}'.`,
    );
  }
  if (!classRule.allowedCategories.includes(input.category)) {
    throw new Error(
      `Security material '${input.materialId}' hierarchy class '${input.hierarchy.hierarchyClass}' does not allow category '${input.category}'.`,
    );
  }
}
