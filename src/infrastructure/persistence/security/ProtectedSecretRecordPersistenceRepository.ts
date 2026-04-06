import type {
  ISecretRecordPersistenceRepository,
  ISecretReEncryptionOperationRepository,
  SecretConditionalSaveResult,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
  SecretReEncryptionOperationRecord,
} from "../../../application/security/ports/SecretServicePorts";
import type {
  IEncryptionKeyResolutionService,
} from "../../../application/security/use-cases/EncryptionKeyResolutionServiceContracts";
import {
  EncryptionMaterialClasses,
} from "../../../application/security/use-cases/EncryptionKeyResolutionServiceContracts";
import type {
  IProtectedValueEncryptionPort,
  ProtectedValuePayload,
} from "../../../application/security/ports/ProtectedValueEncryptionPorts";
import { ProtectedDataClasses } from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type { SecretRecord, SecretReference } from "../../../domain/security/SecretDomain";

const ProtectedMetadataDescriptionPrefix = "protected-value:v1:";

export class ProtectedSecretRecordPersistenceRepository
  implements ISecretRecordPersistenceRepository, ISecretReEncryptionOperationRepository {
  public constructor(
    private readonly inner: ISecretRecordPersistenceRepository & Partial<ISecretReEncryptionOperationRepository>,
    private readonly encryptionKeyResolutionService: IEncryptionKeyResolutionService,
    private readonly protectedValueEncryptionPort: IProtectedValueEncryptionPort,
  ) {}

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    const record = await this.inner.findSecretById(secretId);
    if (!record) {
      return undefined;
    }
    return this.decryptRecord(record);
  }

  public async findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    const record = await this.inner.findSecretByNameAndScope(input);
    if (!record) {
      return undefined;
    }
    return this.decryptRecord(record);
  }

  public async listSecrets(query: SecretListQuery): Promise<ReadonlyArray<SecretReference>> {
    const references = await this.inner.listSecrets(query);
    const decrypted: SecretReference[] = [];
    for (const reference of references) {
      decrypted.push(await this.decryptReference(reference));
    }
    return Object.freeze(decrypted);
  }

  public async createSecret(
    input: SecretCreatePersistenceInput,
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    const encryptedInput = Object.freeze({
      ...input,
      record: await this.encryptRecord(input.record),
    });
    const persisted = await this.inner.createSecret(encryptedInput);
    return Object.freeze({
      ...persisted,
      record: await this.decryptRecord(persisted.record),
    });
  }

  public async saveSecret(
    record: SecretRecord,
    mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    const encryptedRecord = await this.encryptRecord(record);
    const persisted = await this.inner.saveSecret(encryptedRecord, mutation);
    return Object.freeze({
      ...persisted,
      record: await this.decryptRecord(persisted.record),
    });
  }

  public async saveSecretWhenCurrentVersionMatches(
    record: SecretRecord,
    mutation: SecretCreatePersistenceInput["mutation"],
    expectedCurrentVersionId: string | undefined,
  ): Promise<SecretConditionalSaveResult> {
    if (!this.inner.saveSecretWhenCurrentVersionMatches) {
      const saved = await this.saveSecret(record, mutation);
      return Object.freeze({
        ...saved,
        conditionMatched: true,
      });
    }

    const encryptedRecord = await this.encryptRecord(record);
    const persisted = await this.inner.saveSecretWhenCurrentVersionMatches(
      encryptedRecord,
      mutation,
      expectedCurrentVersionId,
    );

    return Object.freeze({
      ...persisted,
      record: await this.decryptRecord(persisted.record),
    });
  }

  public async deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    return this.inner.deleteSecret(secretId, mutation);
  }

  public async findReEncryptionOperationById(operationId: string): Promise<SecretReEncryptionOperationRecord | undefined> {
    if (!this.inner.findReEncryptionOperationById) {
      return undefined;
    }
    return this.inner.findReEncryptionOperationById(operationId);
  }

  public async findReEncryptionOperationByOperationKey(
    operationKey: string,
  ): Promise<SecretReEncryptionOperationRecord | undefined> {
    if (!this.inner.findReEncryptionOperationByOperationKey) {
      return undefined;
    }
    return this.inner.findReEncryptionOperationByOperationKey(operationKey);
  }

  public async findLatestRunningReEncryptionOperation(): Promise<SecretReEncryptionOperationRecord | undefined> {
    if (!this.inner.findLatestRunningReEncryptionOperation) {
      return undefined;
    }
    return this.inner.findLatestRunningReEncryptionOperation();
  }

  public async createReEncryptionOperation(
    operation: Omit<SecretReEncryptionOperationRecord, "revision">,
  ): Promise<SecretReEncryptionOperationRecord> {
    if (!this.inner.createReEncryptionOperation) {
      throw new Error("Secret re-encryption repository is not configured.");
    }
    return this.inner.createReEncryptionOperation(operation);
  }

  public async saveReEncryptionOperation(
    operation: SecretReEncryptionOperationRecord,
    expectedRevision: number,
  ): Promise<{ readonly updated: boolean; readonly record: SecretReEncryptionOperationRecord }> {
    if (!this.inner.saveReEncryptionOperation) {
      throw new Error("Secret re-encryption repository is not configured.");
    }
    return this.inner.saveReEncryptionOperation(operation, expectedRevision);
  }

  private async encryptRecord(record: SecretRecord): Promise<SecretRecord> {
    const encryptedDescription = await this.encryptSecretDescription({
      secretId: record.secretId,
      workspaceId: record.owner.workspaceId,
      description: record.reference.metadata.description,
    });
    return Object.freeze({
      ...record,
      reference: Object.freeze({
        ...record.reference,
        metadata: Object.freeze({
          ...record.reference.metadata,
          description: encryptedDescription,
        }),
      }),
    });
  }

  private async decryptRecord(record: SecretRecord): Promise<SecretRecord> {
    const decryptedDescription = await this.decryptSecretDescription({
      secretId: record.secretId,
      workspaceId: record.owner.workspaceId,
      persistedDescription: record.reference.metadata.description,
    });
    return Object.freeze({
      ...record,
      reference: Object.freeze({
        ...record.reference,
        metadata: Object.freeze({
          ...record.reference.metadata,
          description: decryptedDescription,
        }),
      }),
    });
  }

  private async decryptReference(reference: SecretReference): Promise<SecretReference> {
    const decryptedDescription = await this.decryptSecretDescription({
      secretId: reference.secretId,
      workspaceId: reference.workspaceId,
      persistedDescription: reference.metadata.description,
    });
    return Object.freeze({
      ...reference,
      metadata: Object.freeze({
        ...reference.metadata,
        description: decryptedDescription,
      }),
    });
  }

  private async encryptSecretDescription(input: {
    readonly secretId: string;
    readonly workspaceId?: string;
    readonly description?: string;
  }): Promise<string | undefined> {
    const description = normalizeOptional(input.description);
    if (!description) {
      return undefined;
    }
    if (description.startsWith(ProtectedMetadataDescriptionPrefix)) {
      return description;
    }

    const key = await this.encryptionKeyResolutionService.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.secretMetadata,
      workspaceId: normalizeOptional(input.workspaceId),
    });
    if (!key.ok) {
      throw new Error(`Secret metadata key resolution failed: ${key.error.message}`);
    }

    const encrypted = await this.protectedValueEncryptionPort.encrypt({
      plaintext: Buffer.from(description, "utf8"),
      aad: toSecretMetadataAad(input.secretId),
      key: key.value.key,
      dataClass: ProtectedDataClasses.secretMetadata,
      metadata: Object.freeze({
        purpose: "secret-metadata",
        field: "description",
      }),
    });
    if (!encrypted.ok) {
      throw new Error(`Secret metadata encryption failed: ${encrypted.error.message}`);
    }

    return serializeProtectedValueForTextField(encrypted.value);
  }

  private async decryptSecretDescription(input: {
    readonly secretId: string;
    readonly workspaceId?: string;
    readonly persistedDescription?: string;
  }): Promise<string | undefined> {
    const description = normalizeOptional(input.persistedDescription);
    if (!description) {
      return undefined;
    }
    if (!description.startsWith(ProtectedMetadataDescriptionPrefix)) {
      return description;
    }

    const encryptedPayload = deserializeProtectedValueTextField(description);
    const decrypted = await this.protectedValueEncryptionPort.decrypt({
      encryptedPayload,
      aad: toSecretMetadataAad(input.secretId),
    });
    if (!decrypted.ok) {
      throw new Error(`Secret metadata decryption failed: ${decrypted.error.message}`);
    }
    return Buffer.from(decrypted.value.plaintext).toString("utf8");
  }
}

function serializeProtectedValueForTextField(payload: ProtectedValuePayload): string {
  return `${ProtectedMetadataDescriptionPrefix}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

function deserializeProtectedValueTextField(value: string): ProtectedValuePayload {
  const encodedPayload = value.slice(ProtectedMetadataDescriptionPrefix.length);
  let decoded: string;
  try {
    decoded = Buffer.from(encodedPayload, "base64").toString("utf8");
  } catch {
    throw new Error("Protected metadata field is not valid base64.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    throw new Error("Protected metadata field payload is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Protected metadata field payload is malformed.");
  }

  return parsed as ProtectedValuePayload;
}

function toSecretMetadataAad(secretId: string): string {
  return JSON.stringify(Object.freeze({
    type: "secret-metadata",
    secretId: secretId.trim(),
    field: "description",
  }));
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
