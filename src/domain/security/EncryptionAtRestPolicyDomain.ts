export class EncryptionAtRestPolicyDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionAtRestPolicyDomainError";
  }
}

export const EncryptionModes = Object.freeze({
  none: "none",
  metadataOnly: "metadata-only",
  scopedContent: "scoped-content",
});

export type EncryptionMode = typeof EncryptionModes[keyof typeof EncryptionModes];

export const EncryptionKeyScopes = Object.freeze({
  server: "server",
  workspace: "workspace",
  storageInstance: "storage-instance",
});

export type EncryptionKeyScope = typeof EncryptionKeyScopes[keyof typeof EncryptionKeyScopes];

export const ProtectedDataClasses = Object.freeze({
  secretMaterial: "secret-material",
  secretMetadata: "secret-metadata",
  sensitiveMetadata: "sensitive-metadata",
  assetContent: "asset-content",
});

export type ProtectedDataClass = typeof ProtectedDataClasses[keyof typeof ProtectedDataClasses];

export const EncryptionPolicyScopes = Object.freeze({
  platform: "platform",
  workspace: "workspace",
  storageInstance: "storage-instance",
});

export type EncryptionPolicyScope = typeof EncryptionPolicyScopes[keyof typeof EncryptionPolicyScopes];

export const EncryptionPolicyEvaluationSources = Object.freeze({
  platform: "platform",
  workspace: "workspace",
  storageInstance: "storage-instance",
});

export type EncryptionPolicyEvaluationSource =
  typeof EncryptionPolicyEvaluationSources[keyof typeof EncryptionPolicyEvaluationSources];

export interface DecryptionAllowance {
  readonly allowPreview: boolean;
  readonly allowWorker: boolean;
}

export interface ProtectedDataEncryptionRule {
  readonly dataClass: ProtectedDataClass;
  readonly encryptionMode: EncryptionMode;
  readonly keyScope?: EncryptionKeyScope;
  readonly decryption: DecryptionAllowance;
}

export interface EncryptionAtRestPolicyDefinition {
  readonly policyId: string;
  readonly scope: EncryptionPolicyScope;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly rules: ReadonlyArray<ProtectedDataEncryptionRule>;
}

export interface EncryptionPolicyEvaluationInput {
  readonly dataClass: ProtectedDataClass;
  readonly platformPolicy: EncryptionAtRestPolicyDefinition;
  readonly workspacePolicy?: EncryptionAtRestPolicyDefinition;
  readonly storageInstancePolicy?: EncryptionAtRestPolicyDefinition;
}

export interface EncryptionPolicyEvaluationResult {
  readonly dataClass: ProtectedDataClass;
  readonly effectiveRule: ProtectedDataEncryptionRule;
  readonly resolvedFrom: EncryptionPolicyEvaluationSource;
  readonly inheritedFrom: ReadonlyArray<EncryptionPolicyEvaluationSource>;
  readonly encryptedAtRestRequired: boolean;
  readonly requiresScopedContentKey: boolean;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface EncryptedMaterialReference {
  readonly materialId: string;
  readonly encryptedLocator: string;
  readonly algorithm: string;
  readonly keyReferenceId: string;
  readonly keyScope: EncryptionKeyScope;
  readonly encryptedAt: string;
  readonly payloadDigestSha256?: string;
}

const ModeStrength: Readonly<Record<EncryptionMode, number>> = Object.freeze({
  [EncryptionModes.none]: 0,
  [EncryptionModes.metadataOnly]: 1,
  [EncryptionModes.scopedContent]: 2,
});

const RequiredBaselineClasses: ReadonlyArray<ProtectedDataClass> = Object.freeze([
  ProtectedDataClasses.secretMaterial,
  ProtectedDataClasses.secretMetadata,
  ProtectedDataClasses.sensitiveMetadata,
]);

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new EncryptionAtRestPolicyDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string | Date, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new EncryptionAtRestPolicyDomainError(`${field} must be a valid timestamp.`);
  }
  return date.toISOString();
}

function normalizeEncryptionMode(value: EncryptionMode): EncryptionMode {
  if (!Object.values(EncryptionModes).includes(value)) {
    throw new EncryptionAtRestPolicyDomainError(`Encryption mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeKeyScope(value: EncryptionKeyScope): EncryptionKeyScope {
  if (!Object.values(EncryptionKeyScopes).includes(value)) {
    throw new EncryptionAtRestPolicyDomainError(`Encryption key scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeDataClass(value: ProtectedDataClass): ProtectedDataClass {
  if (!Object.values(ProtectedDataClasses).includes(value)) {
    throw new EncryptionAtRestPolicyDomainError(`Protected data class '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizePolicyScope(value: EncryptionPolicyScope): EncryptionPolicyScope {
  if (!Object.values(EncryptionPolicyScopes).includes(value)) {
    throw new EncryptionAtRestPolicyDomainError(`Encryption policy scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeDecryptionAllowance(input?: Partial<DecryptionAllowance>): DecryptionAllowance {
  return Object.freeze({
    allowPreview: input?.allowPreview ?? false,
    allowWorker: input?.allowWorker ?? false,
  });
}

function assertRuleInvariant(rule: ProtectedDataEncryptionRule): void {
  if (rule.encryptionMode === EncryptionModes.none) {
    if (rule.keyScope) {
      throw new EncryptionAtRestPolicyDomainError(
        `Data class '${rule.dataClass}' cannot declare keyScope when encryptionMode='none'.`,
      );
    }
    if (rule.decryption.allowPreview || rule.decryption.allowWorker) {
      throw new EncryptionAtRestPolicyDomainError(
        `Data class '${rule.dataClass}' cannot allow decryption when encryptionMode='none'.`,
      );
    }
  }

  if (rule.encryptionMode === EncryptionModes.scopedContent && !rule.keyScope) {
    throw new EncryptionAtRestPolicyDomainError(
      `Data class '${rule.dataClass}' must declare keyScope when encryptionMode='scoped-content'.`,
    );
  }

  if (rule.encryptionMode !== EncryptionModes.scopedContent && rule.decryption.allowWorker) {
    throw new EncryptionAtRestPolicyDomainError(
      `Data class '${rule.dataClass}' cannot allow worker decryption unless encryptionMode='scoped-content'.`,
    );
  }

  if (rule.encryptionMode === EncryptionModes.metadataOnly && rule.decryption.allowPreview) {
    throw new EncryptionAtRestPolicyDomainError(
      `Data class '${rule.dataClass}' cannot allow preview decryption with encryptionMode='metadata-only'.`,
    );
  }

  if (rule.dataClass === ProtectedDataClasses.secretMaterial) {
    if (rule.encryptionMode !== EncryptionModes.scopedContent) {
      throw new EncryptionAtRestPolicyDomainError(
        "Secret material must always use encryptionMode='scoped-content'.",
      );
    }

    if (rule.decryption.allowPreview || rule.decryption.allowWorker) {
      throw new EncryptionAtRestPolicyDomainError(
        "Secret material cannot allow preview or worker decryption in the policy domain.",
      );
    }
  }

  if (
    rule.dataClass === ProtectedDataClasses.secretMetadata
    || rule.dataClass === ProtectedDataClasses.sensitiveMetadata
  ) {
    if (rule.encryptionMode === EncryptionModes.none) {
      throw new EncryptionAtRestPolicyDomainError(
        `Data class '${rule.dataClass}' must remain encrypted at rest (mode cannot be 'none').`,
      );
    }

    if (rule.decryption.allowPreview || rule.decryption.allowWorker) {
      throw new EncryptionAtRestPolicyDomainError(
        `Data class '${rule.dataClass}' cannot allow preview or worker decryption.`,
      );
    }
  }
}

function normalizeRule(input: {
  readonly dataClass: ProtectedDataClass;
  readonly encryptionMode: EncryptionMode;
  readonly keyScope?: EncryptionKeyScope;
  readonly decryption?: Partial<DecryptionAllowance>;
}): ProtectedDataEncryptionRule {
  const rule: ProtectedDataEncryptionRule = Object.freeze({
    dataClass: normalizeDataClass(input.dataClass),
    encryptionMode: normalizeEncryptionMode(input.encryptionMode),
    keyScope: input.keyScope ? normalizeKeyScope(input.keyScope) : undefined,
    decryption: normalizeDecryptionAllowance(input.decryption),
  });

  assertRuleInvariant(rule);
  return rule;
}

function assertPolicyScopeInvariant(policy: EncryptionAtRestPolicyDefinition): void {
  if (policy.scope === EncryptionPolicyScopes.platform) {
    if (policy.workspaceId || policy.storageInstanceId) {
      throw new EncryptionAtRestPolicyDomainError(
        "Platform encryption policy cannot include workspaceId or storageInstanceId.",
      );
    }
    return;
  }

  if (policy.scope === EncryptionPolicyScopes.workspace) {
    if (!policy.workspaceId) {
      throw new EncryptionAtRestPolicyDomainError("Workspace encryption policy requires workspaceId.");
    }
    if (policy.storageInstanceId) {
      throw new EncryptionAtRestPolicyDomainError(
        "Workspace encryption policy cannot include storageInstanceId.",
      );
    }
    return;
  }

  if (!policy.workspaceId) {
    throw new EncryptionAtRestPolicyDomainError(
      "Storage-instance encryption policy requires workspaceId.",
    );
  }

  if (!policy.storageInstanceId) {
    throw new EncryptionAtRestPolicyDomainError(
      "Storage-instance encryption policy requires storageInstanceId.",
    );
  }
}

function assertNoDuplicateRules(rules: ReadonlyArray<ProtectedDataEncryptionRule>): void {
  const seen = new Set<ProtectedDataClass>();
  for (const rule of rules) {
    if (seen.has(rule.dataClass)) {
      throw new EncryptionAtRestPolicyDomainError(
        `Encryption policy cannot define duplicate rules for data class '${rule.dataClass}'.`,
      );
    }
    seen.add(rule.dataClass);
  }
}

function assertPlatformBaselineCoverage(policy: EncryptionAtRestPolicyDefinition): void {
  if (policy.scope !== EncryptionPolicyScopes.platform) {
    return;
  }

  const defined = new Set(policy.rules.map((rule) => rule.dataClass));
  for (const requiredClass of RequiredBaselineClasses) {
    if (!defined.has(requiredClass)) {
      throw new EncryptionAtRestPolicyDomainError(
        `Platform encryption policy must define a rule for '${requiredClass}'.`,
      );
    }
  }
}

function resolveRule(
  policy: EncryptionAtRestPolicyDefinition,
  dataClass: ProtectedDataClass,
): ProtectedDataEncryptionRule | undefined {
  return policy.rules.find((rule) => rule.dataClass === dataClass);
}

function assertOverrideStrength(
  parent: ProtectedDataEncryptionRule,
  child: ProtectedDataEncryptionRule,
  source: EncryptionPolicyEvaluationSource,
): void {
  if (ModeStrength[child.encryptionMode] < ModeStrength[parent.encryptionMode]) {
    throw new EncryptionAtRestPolicyDomainError(
      `Encryption policy override '${source}' cannot weaken '${child.dataClass}' from '${parent.encryptionMode}' to '${child.encryptionMode}'.`,
    );
  }

  if (!parent.decryption.allowPreview && child.decryption.allowPreview) {
    throw new EncryptionAtRestPolicyDomainError(
      `Encryption policy override '${source}' cannot broaden preview decryption for '${child.dataClass}'.`,
    );
  }

  if (!parent.decryption.allowWorker && child.decryption.allowWorker) {
    throw new EncryptionAtRestPolicyDomainError(
      `Encryption policy override '${source}' cannot broaden worker decryption for '${child.dataClass}'.`,
    );
  }
}

export function createProtectedDataEncryptionRule(input: {
  readonly dataClass: ProtectedDataClass;
  readonly encryptionMode: EncryptionMode;
  readonly keyScope?: EncryptionKeyScope;
  readonly decryption?: Partial<DecryptionAllowance>;
}): ProtectedDataEncryptionRule {
  return normalizeRule(input);
}

export function createEncryptionAtRestPolicyDefinition(input: {
  readonly policyId: string;
  readonly scope: EncryptionPolicyScope;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly rules: ReadonlyArray<{
    readonly dataClass: ProtectedDataClass;
    readonly encryptionMode: EncryptionMode;
    readonly keyScope?: EncryptionKeyScope;
    readonly decryption?: Partial<DecryptionAllowance>;
  }>;
}): EncryptionAtRestPolicyDefinition {
  const rules = Object.freeze(input.rules.map((entry) => normalizeRule(entry)));
  assertNoDuplicateRules(rules);

  const policy: EncryptionAtRestPolicyDefinition = Object.freeze({
    policyId: normalizeRequired(input.policyId, "Encryption policy policyId"),
    scope: normalizePolicyScope(input.scope),
    workspaceId: normalizeOptional(input.workspaceId),
    storageInstanceId: normalizeOptional(input.storageInstanceId),
    rules,
  });

  assertPolicyScopeInvariant(policy);
  assertPlatformBaselineCoverage(policy);

  return policy;
}

export function createEncryptedMaterialReference(input: {
  readonly materialId: string;
  readonly encryptedLocator: string;
  readonly algorithm: string;
  readonly keyReferenceId: string;
  readonly keyScope: EncryptionKeyScope;
  readonly encryptedAt?: string | Date;
  readonly payloadDigestSha256?: string;
}): EncryptedMaterialReference {
  return Object.freeze({
    materialId: normalizeRequired(input.materialId, "Encrypted material reference materialId"),
    encryptedLocator: normalizeRequired(input.encryptedLocator, "Encrypted material reference encryptedLocator"),
    algorithm: normalizeRequired(input.algorithm, "Encrypted material reference algorithm"),
    keyReferenceId: normalizeRequired(input.keyReferenceId, "Encrypted material reference keyReferenceId"),
    keyScope: normalizeKeyScope(input.keyScope),
    encryptedAt: normalizeTimestamp(input.encryptedAt ?? new Date(), "Encrypted material reference encryptedAt"),
    payloadDigestSha256: normalizeOptional(input.payloadDigestSha256),
  });
}

export function evaluateEncryptionAtRestPolicy(
  input: EncryptionPolicyEvaluationInput,
): EncryptionPolicyEvaluationResult {
  const dataClass = normalizeDataClass(input.dataClass);

  if (input.platformPolicy.scope !== EncryptionPolicyScopes.platform) {
    throw new EncryptionAtRestPolicyDomainError(
      "Encryption policy evaluation requires a platform-scoped baseline policy.",
    );
  }

  if (input.workspacePolicy && input.workspacePolicy.scope !== EncryptionPolicyScopes.workspace) {
    throw new EncryptionAtRestPolicyDomainError(
      "Encryption policy evaluation workspacePolicy must be workspace-scoped.",
    );
  }

  if (input.storageInstancePolicy && input.storageInstancePolicy.scope !== EncryptionPolicyScopes.storageInstance) {
    throw new EncryptionAtRestPolicyDomainError(
      "Encryption policy evaluation storageInstancePolicy must be storage-instance scoped.",
    );
  }

  let effective = resolveRule(input.platformPolicy, dataClass);
  const inheritedFrom: EncryptionPolicyEvaluationSource[] = [];
  let resolvedFrom: EncryptionPolicyEvaluationSource = EncryptionPolicyEvaluationSources.platform;

  if (!effective && dataClass === ProtectedDataClasses.assetContent) {
    effective = createProtectedDataEncryptionRule({
      dataClass,
      encryptionMode: EncryptionModes.none,
      decryption: {
        allowPreview: false,
        allowWorker: false,
      },
    });
  }

  if (!effective) {
    throw new EncryptionAtRestPolicyDomainError(
      `Platform encryption policy is missing required rule for '${dataClass}'.`,
    );
  }

  if (input.workspacePolicy) {
    const workspaceRule = resolveRule(input.workspacePolicy, dataClass);
    if (workspaceRule) {
      assertOverrideStrength(effective, workspaceRule, EncryptionPolicyEvaluationSources.workspace);
      inheritedFrom.push(EncryptionPolicyEvaluationSources.platform);
      effective = workspaceRule;
      resolvedFrom = EncryptionPolicyEvaluationSources.workspace;
    }
  }

  if (input.storageInstancePolicy) {
    const storageRule = resolveRule(input.storageInstancePolicy, dataClass);
    if (storageRule) {
      assertOverrideStrength(effective, storageRule, EncryptionPolicyEvaluationSources.storageInstance);
      if (!inheritedFrom.includes(EncryptionPolicyEvaluationSources.platform)) {
        inheritedFrom.push(EncryptionPolicyEvaluationSources.platform);
      }
      if (resolvedFrom === EncryptionPolicyEvaluationSources.workspace) {
        inheritedFrom.push(EncryptionPolicyEvaluationSources.workspace);
      }
      effective = storageRule;
      resolvedFrom = EncryptionPolicyEvaluationSources.storageInstance;
    }
  }

  return Object.freeze({
    dataClass,
    effectiveRule: effective,
    resolvedFrom,
    inheritedFrom: Object.freeze(inheritedFrom),
    encryptedAtRestRequired: effective.encryptionMode !== EncryptionModes.none,
    requiresScopedContentKey: effective.encryptionMode === EncryptionModes.scopedContent,
    allowPreviewDecryption: effective.decryption.allowPreview,
    allowWorkerDecryption: effective.decryption.allowWorker,
  });
}

export function assertEncryptedMaterialReferenceMatchesPolicy(input: {
  readonly evaluation: EncryptionPolicyEvaluationResult;
  readonly reference?: EncryptedMaterialReference;
}): void {
  const mode = input.evaluation.effectiveRule.encryptionMode;

  if (mode === EncryptionModes.none) {
    if (input.reference) {
      throw new EncryptionAtRestPolicyDomainError(
        `Data class '${input.evaluation.dataClass}' cannot include encrypted material reference when encryptionMode='none'.`,
      );
    }
    return;
  }

  if (mode === EncryptionModes.scopedContent && !input.reference) {
    throw new EncryptionAtRestPolicyDomainError(
      `Data class '${input.evaluation.dataClass}' requires encrypted material reference when encryptionMode='scoped-content'.`,
    );
  }

  if (!input.reference) {
    return;
  }

  const ruleKeyScope = input.evaluation.effectiveRule.keyScope;
  if (ruleKeyScope && input.reference.keyScope !== ruleKeyScope) {
    throw new EncryptionAtRestPolicyDomainError(
      `Encrypted material keyScope '${input.reference.keyScope}' does not match policy keyScope '${ruleKeyScope}'.`,
    );
  }
}
