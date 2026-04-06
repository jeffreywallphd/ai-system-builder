import {
  SecretKinds,
  SecretScopes,
  type SecretKind,
  type SecretReferenceMetadata,
  type SecretScope,
  type SecretScopeOwner,
} from "../../../domain/security/SecretDomain";

export class SecretClassificationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretClassificationContractError";
  }
}

export const SecretClassificationIds = Object.freeze({
  providerCredential: "provider-credential",
  personalApiKey: "personal-api-key",
  storageCredential: "storage-credential",
  signingMaterial: "signing-material",
  integrationToken: "integration-token",
});

export type SecretClassificationId = typeof SecretClassificationIds[keyof typeof SecretClassificationIds];

export const SecretEntryModes = Object.freeze({
  userEntered: "user-entered",
  systemGenerated: "system-generated",
  either: "either",
});

export type SecretEntryMode = typeof SecretEntryModes[keyof typeof SecretEntryModes];

export interface SecretClassificationMetadataFieldRule {
  readonly field: string;
  readonly required: boolean;
  readonly description: string;
}

export interface SecretClassificationDefinition {
  readonly classificationId: SecretClassificationId;
  readonly description: string;
  readonly namePrefix: string;
  readonly allowedKinds: ReadonlyArray<SecretKind>;
  readonly allowedScopes: ReadonlyArray<SecretScope>;
  readonly entryMode: SecretEntryMode;
  readonly metadataLabelRules: ReadonlyArray<SecretClassificationMetadataFieldRule>;
}

export interface SecretClassificationValidationInput {
  readonly name: string;
  readonly kind: SecretKind;
  readonly owner: SecretScopeOwner;
  readonly metadata?: SecretReferenceMetadata;
}

const SecretClassificationRegistry: ReadonlyArray<SecretClassificationDefinition> = Object.freeze([
  Object.freeze({
    classificationId: SecretClassificationIds.providerCredential,
    description: "Server/workspace provider credentials for external AI or SaaS providers.",
    namePrefix: "provider.",
    allowedKinds: Object.freeze([SecretKinds.apiKey, SecretKinds.accessToken, SecretKinds.password]),
    allowedScopes: Object.freeze([SecretScopes.server, SecretScopes.workspace]),
    entryMode: SecretEntryModes.userEntered,
    metadataLabelRules: Object.freeze([
      Object.freeze({
        field: "provider",
        required: true,
        description: "External provider identifier (for example openai, anthropic, s3).",
      }),
      Object.freeze({
        field: "usage",
        required: true,
        description: "Credential usage purpose (for example model-inference, embeddings, admin-api).",
      }),
      Object.freeze({
        field: "environment",
        required: false,
        description: "Deployment environment classification (for example prod, staging, dev).",
      }),
    ]),
  }),
  Object.freeze({
    classificationId: SecretClassificationIds.personalApiKey,
    description: "User-owned personal API keys and user-bound tokens.",
    namePrefix: "personal.",
    allowedKinds: Object.freeze([SecretKinds.apiKey, SecretKinds.accessToken, SecretKinds.refreshToken]),
    allowedScopes: Object.freeze([SecretScopes.user]),
    entryMode: SecretEntryModes.userEntered,
    metadataLabelRules: Object.freeze([
      Object.freeze({
        field: "provider",
        required: true,
        description: "Provider or integration this personal key belongs to.",
      }),
      Object.freeze({
        field: "owner",
        required: true,
        description: "Owning user identity label (non-secret identifier only).",
      }),
      Object.freeze({
        field: "usage",
        required: false,
        description: "Optional user-intent marker (for example import, publishing, inference).",
      }),
    ]),
  }),
  Object.freeze({
    classificationId: SecretClassificationIds.storageCredential,
    description: "Credentials for object stores, blob stores, or database-backed secret retrieval services.",
    namePrefix: "storage.",
    allowedKinds: Object.freeze([SecretKinds.connectionString, SecretKinds.password, SecretKinds.accessToken]),
    allowedScopes: Object.freeze([SecretScopes.server, SecretScopes.workspace, SecretScopes.user]),
    entryMode: SecretEntryModes.either,
    metadataLabelRules: Object.freeze([
      Object.freeze({
        field: "provider",
        required: true,
        description: "Storage provider identifier.",
      }),
      Object.freeze({
        field: "resource",
        required: true,
        description: "Logical storage resource identifier (bucket, account, endpoint alias).",
      }),
      Object.freeze({
        field: "environment",
        required: false,
        description: "Deployment environment scope.",
      }),
    ]),
  }),
  Object.freeze({
    classificationId: SecretClassificationIds.signingMaterial,
    description: "Asymmetric signing material and certificate-chain references used by platform services.",
    namePrefix: "signing.",
    allowedKinds: Object.freeze([SecretKinds.privateKey, SecretKinds.certificate]),
    allowedScopes: Object.freeze([SecretScopes.server, SecretScopes.workspace]),
    entryMode: SecretEntryModes.either,
    metadataLabelRules: Object.freeze([
      Object.freeze({
        field: "algorithm",
        required: true,
        description: "Signing algorithm (for example ed25519, rsa-4096).",
      }),
      Object.freeze({
        field: "usage",
        required: true,
        description: "Signing usage class (for example transport-tls, token-signing, csr-signing).",
      }),
      Object.freeze({
        field: "rotation",
        required: false,
        description: "Rotation profile marker (for example quarterly, annual).",
      }),
    ]),
  }),
  Object.freeze({
    classificationId: SecretClassificationIds.integrationToken,
    description: "Pairing and integration tokens exchanged with external systems.",
    namePrefix: "integration.",
    allowedKinds: Object.freeze([SecretKinds.accessToken, SecretKinds.refreshToken, SecretKinds.apiKey]),
    allowedScopes: Object.freeze([SecretScopes.workspace, SecretScopes.user]),
    entryMode: SecretEntryModes.systemGenerated,
    metadataLabelRules: Object.freeze([
      Object.freeze({
        field: "integration",
        required: true,
        description: "Integration target identifier.",
      }),
      Object.freeze({
        field: "pairing",
        required: true,
        description: "Pairing transaction or channel identifier.",
      }),
      Object.freeze({
        field: "usage",
        required: false,
        description: "Integration token usage category.",
      }),
    ]),
  }),
]);

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new SecretClassificationContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeMetadataLabels(metadata?: SecretReferenceMetadata): Readonly<Record<string, string>> {
  const labels = metadata?.labels ?? {};
  const normalizedEntries = Object.entries(labels)
    .map(([field, value]) => [field.trim().toLowerCase(), value.trim()] as const)
    .filter(([field, value]) => field.length > 0 && value.length > 0);
  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function normalizeName(value: string): string {
  return normalizeRequired(value, "Secret name").toLowerCase();
}

export function listSecretClassifications(): ReadonlyArray<SecretClassificationDefinition> {
  return SecretClassificationRegistry;
}

export function findSecretClassificationById(
  classificationId: SecretClassificationId,
): SecretClassificationDefinition | undefined {
  return SecretClassificationRegistry.find((entry) => entry.classificationId === classificationId);
}

export function findSecretClassificationByName(name: string): SecretClassificationDefinition | undefined {
  const normalized = normalizeName(name);
  return SecretClassificationRegistry.find((entry) => normalized.startsWith(entry.namePrefix));
}

export function assertSecretClassificationSupport(input: SecretClassificationValidationInput): SecretClassificationDefinition {
  const classification = findSecretClassificationByName(input.name);
  if (!classification) {
    throw new SecretClassificationContractError(
      `Secret name '${input.name}' must use a supported classification prefix (${SecretClassificationRegistry.map((entry) => entry.namePrefix).join(", ")}).`,
    );
  }

  if (!classification.allowedKinds.includes(input.kind)) {
    throw new SecretClassificationContractError(
      `Secret kind '${input.kind}' is not allowed for classification '${classification.classificationId}'.`,
    );
  }

  if (!classification.allowedScopes.includes(input.owner.scope)) {
    throw new SecretClassificationContractError(
      `Secret scope '${input.owner.scope}' is not allowed for classification '${classification.classificationId}'.`,
    );
  }

  const labels = normalizeMetadataLabels(input.metadata);
  const missingFields = classification.metadataLabelRules
    .filter((rule) => rule.required && !labels[rule.field]);
  if (missingFields.length > 0) {
    throw new SecretClassificationContractError(
      `Secret metadata.labels is missing required fields for '${classification.classificationId}': ${missingFields.map((rule) => rule.field).join(", ")}.`,
    );
  }

  return classification;
}

export interface SecretClassificationRegistrySnapshot {
  readonly version: number;
  readonly classifications: ReadonlyArray<{
    readonly classificationId: SecretClassificationId;
    readonly description: string;
    readonly namePrefix: string;
    readonly allowedKinds: ReadonlyArray<SecretKind>;
    readonly allowedScopes: ReadonlyArray<SecretScope>;
    readonly entryMode: SecretEntryMode;
    readonly metadataLabelRules: ReadonlyArray<SecretClassificationMetadataFieldRule>;
  }>;
}

export function toSecretClassificationRegistrySnapshot(): SecretClassificationRegistrySnapshot {
  return Object.freeze({
    version: 1,
    classifications: SecretClassificationRegistry.map((entry) => Object.freeze({
      classificationId: entry.classificationId,
      description: entry.description,
      namePrefix: entry.namePrefix,
      allowedKinds: Object.freeze([...entry.allowedKinds]),
      allowedScopes: Object.freeze([...entry.allowedScopes]),
      entryMode: entry.entryMode,
      metadataLabelRules: Object.freeze(entry.metadataLabelRules.map((rule) => Object.freeze({
        field: rule.field,
        required: rule.required,
        description: rule.description,
      }))),
    })),
  });
}

export function serializeSecretClassificationRegistry(): string {
  return JSON.stringify(toSecretClassificationRegistrySnapshot());
}
