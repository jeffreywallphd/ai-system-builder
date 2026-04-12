import {
  assertSecurityMaterialKeyHierarchyCompatibility,
  createSecurityMaterialKeyHierarchyContract,
  type SecurityMaterialKeyHierarchyContract,
} from "./SecurityMaterialKeyHierarchyContract";

export const SecurityMaterialCategories = Object.freeze({
  secretCredential: "secret-credential",
  signingMaterial: "signing-material",
  encryptionKey: "encryption-key",
  certificateMaterial: "certificate-material",
  transportTrust: "transport-trust",
});

export type SecurityMaterialCategory =
  typeof SecurityMaterialCategories[keyof typeof SecurityMaterialCategories];

export const SecurityMaterialScopes = Object.freeze({
  server: "server",
  workspace: "workspace",
  user: "user",
  storageInstance: "storage-instance",
});

export type SecurityMaterialScope = typeof SecurityMaterialScopes[keyof typeof SecurityMaterialScopes];

export const SecurityMaterialDurabilityClasses = Object.freeze({
  durable: "durable",
  ephemeral: "ephemeral",
});

export type SecurityMaterialDurabilityClass =
  typeof SecurityMaterialDurabilityClasses[keyof typeof SecurityMaterialDurabilityClasses];

export const SecurityMaterialStartupRequirements = Object.freeze({
  failFastRequired: "fail-fast-required",
  optional: "optional",
});

export type SecurityMaterialStartupRequirement =
  typeof SecurityMaterialStartupRequirements[keyof typeof SecurityMaterialStartupRequirements];

export const SecurityMaterialFallbackPolicies = Object.freeze({
  none: "none",
  migrateLegacyInput: "migrate-legacy-input",
  generateEphemeralForDevelopment: "generate-ephemeral-for-development",
});

export type SecurityMaterialFallbackPolicy =
  typeof SecurityMaterialFallbackPolicies[keyof typeof SecurityMaterialFallbackPolicies];

export const SecurityMaterialRotationPostures = Object.freeze({
  manual: "manual",
  scheduled: "scheduled",
  onDemand: "on-demand",
  notApplicable: "not-applicable",
});

export type SecurityMaterialRotationPosture =
  typeof SecurityMaterialRotationPostures[keyof typeof SecurityMaterialRotationPostures];

export const SecurityMaterialUsageContexts = Object.freeze({
  startupBootstrap: "startup-bootstrap",
  runtimeRequest: "runtime-request",
  providerCredential: "provider-credential",
  serverSigning: "server-signing",
  transportSecurity: "transport-security",
});

export type SecurityMaterialUsageContext =
  typeof SecurityMaterialUsageContexts[keyof typeof SecurityMaterialUsageContexts];

export const SecurityMaterialLifecycleStages = Object.freeze({
  production: "production",
  development: "development",
  test: "test",
});

export type SecurityMaterialLifecycleStage =
  typeof SecurityMaterialLifecycleStages[keyof typeof SecurityMaterialLifecycleStages];

export interface SecurityMaterialEnvironmentPolicy {
  readonly durabilityClass: SecurityMaterialDurabilityClass;
  readonly startupRequirement: SecurityMaterialStartupRequirement;
  readonly fallbackPolicy: SecurityMaterialFallbackPolicy;
}

export interface SecurityMaterialClassificationIdentity {
  readonly materialId: string;
  readonly category: SecurityMaterialCategory;
  readonly scope: SecurityMaterialScope;
  readonly rotationPosture: SecurityMaterialRotationPosture;
  readonly usageContexts: ReadonlyArray<SecurityMaterialUsageContext>;
}

export interface SecurityMaterialClassificationContract extends SecurityMaterialClassificationIdentity {
  readonly hierarchy: SecurityMaterialKeyHierarchyContract;
  readonly defaultPolicy: SecurityMaterialEnvironmentPolicy;
  readonly developmentPolicy?: SecurityMaterialEnvironmentPolicy;
  readonly testPolicy?: SecurityMaterialEnvironmentPolicy;
}

export function createSecurityMaterialEnvironmentPolicy(
  input: SecurityMaterialEnvironmentPolicy,
): SecurityMaterialEnvironmentPolicy {
  return Object.freeze({
    durabilityClass: input.durabilityClass,
    startupRequirement: input.startupRequirement,
    fallbackPolicy: input.fallbackPolicy,
  });
}

export function createSecurityMaterialClassificationContract(
  input: SecurityMaterialClassificationContract,
): SecurityMaterialClassificationContract {
  const materialId = input.materialId.trim();
  if (!materialId) {
    throw new Error("Security material classification contract materialId is required.");
  }
  if (!Object.values(SecurityMaterialCategories).includes(input.category)) {
    throw new Error(`Security material category '${String(input.category)}' is invalid.`);
  }
  if (!Object.values(SecurityMaterialScopes).includes(input.scope)) {
    throw new Error(`Security material scope '${String(input.scope)}' is invalid.`);
  }
  if (!Object.values(SecurityMaterialRotationPostures).includes(input.rotationPosture)) {
    throw new Error(`Security material rotation posture '${String(input.rotationPosture)}' is invalid.`);
  }

  const normalizedUsageContexts = input.usageContexts
    .filter((entry, index, values) => values.indexOf(entry) === index);
  if (normalizedUsageContexts.length === 0) {
    throw new Error("Security material classification contract usageContexts must contain at least one entry.");
  }
  for (const usageContext of normalizedUsageContexts) {
    if (!Object.values(SecurityMaterialUsageContexts).includes(usageContext)) {
      throw new Error(`Security material usage context '${String(usageContext)}' is invalid.`);
    }
  }

  const hierarchy = createSecurityMaterialKeyHierarchyContract(input.hierarchy);
  assertSecurityMaterialKeyHierarchyCompatibility({
    materialId,
    hierarchy,
    scope: input.scope,
    category: input.category,
  });

  return Object.freeze({
    materialId,
    category: input.category,
    scope: input.scope,
    rotationPosture: input.rotationPosture,
    usageContexts: Object.freeze([...normalizedUsageContexts]),
    hierarchy,
    defaultPolicy: createSecurityMaterialEnvironmentPolicy(input.defaultPolicy),
    developmentPolicy: input.developmentPolicy
      ? createSecurityMaterialEnvironmentPolicy(input.developmentPolicy)
      : undefined,
    testPolicy: input.testPolicy ? createSecurityMaterialEnvironmentPolicy(input.testPolicy) : undefined,
  });
}

export function resolveSecurityMaterialEnvironmentPolicy(input: {
  readonly classification: SecurityMaterialClassificationContract;
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
}): SecurityMaterialEnvironmentPolicy {
  if (
    input.lifecycleStage === SecurityMaterialLifecycleStages.development
    && input.classification.developmentPolicy
  ) {
    return input.classification.developmentPolicy;
  }

  if (input.lifecycleStage === SecurityMaterialLifecycleStages.test && input.classification.testPolicy) {
    return input.classification.testPolicy;
  }

  return input.classification.defaultPolicy;
}

export function isFailFastRequiredSecurityMaterial(input: {
  readonly classification: SecurityMaterialClassificationContract;
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
}): boolean {
  return resolveSecurityMaterialEnvironmentPolicy(input).startupRequirement
    === SecurityMaterialStartupRequirements.failFastRequired;
}

