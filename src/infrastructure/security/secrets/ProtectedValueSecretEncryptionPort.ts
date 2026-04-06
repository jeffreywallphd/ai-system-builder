import { createHash, randomUUID } from "node:crypto";
import type { ISecretEncryptionPort } from "../../../application/security/ports/SecretServicePorts";
import type { IProtectedValueEncryptionPort } from "../../../application/security/ports/ProtectedValueEncryptionPorts";
import { ProtectedDataClasses } from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type { SecretScopeOwner, SecretVersion } from "../../../domain/security/SecretDomain";
import {
  EncryptionMaterialClasses,
  type IEncryptionKeyResolutionService,
} from "../../../application/security/use-cases/EncryptionKeyResolutionServiceContracts";
import {
  SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX,
  FileSystemSecretEncryptedPayloadStore,
} from "./FileSystemSecretEncryptedPayloadStore";
import type { ISecretEncryptedPayloadStore } from "./SecretEncryptedPayloadStore";

interface PersistedProtectedSecretPayloadRecordV1 {
  readonly recordType: "ai-loom-protected-secret-payload/v1";
  readonly encryptedPayload: {
    readonly descriptor: {
      readonly descriptorVersion: string;
      readonly algorithm: string;
      readonly keyReferenceId: string;
      readonly keyId: string;
      readonly keyVersion?: string;
      readonly keyScope: string;
      readonly workspaceId?: string;
      readonly storageInstanceId?: string;
      readonly dataClass?: string;
      readonly encryptedAt: string;
      readonly metadata?: Readonly<Record<string, string>>;
    };
    readonly payloadBase64: string;
  };
}

export class ProtectedValueSecretEncryptionPort implements ISecretEncryptionPort {
  public constructor(
    private readonly encryptionKeyResolutionService: IEncryptionKeyResolutionService,
    private readonly protectedValueEncryptionPort: IProtectedValueEncryptionPort,
    private readonly payloadStore: ISecretEncryptedPayloadStore,
    private readonly payloadRefFactory: () => string = defaultPayloadRefFactory,
  ) {}

  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretScopeOwner;
    readonly plaintext: string;
    readonly existingContext?: SecretVersion["keyEncryptionContext"];
  }) {
    const keyResolution = await this.encryptionKeyResolutionService.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.secretMaterial,
      workspaceId: input.owner.workspaceId,
    });
    if (!keyResolution.ok) {
      throw new Error(`Secret key resolution failed: ${keyResolution.error.message}`);
    }

    const plaintextBytes = Buffer.from(input.plaintext, "utf8");
    const encrypted = await this.protectedValueEncryptionPort.encrypt({
      plaintext: plaintextBytes,
      aad: toSecretMaterialAad(input.secretId, input.owner),
      key: keyResolution.value.key,
      dataClass: ProtectedDataClasses.secretMaterial,
      metadata: Object.freeze({
        purpose: "secret-material",
        secretScope: input.owner.scope,
      }),
    });

    if (!encrypted.ok) {
      throw new Error(`Secret material encryption failed: ${encrypted.error.message}`);
    }

    const encryptedPayloadRef = this.payloadRefFactory();
    await this.payloadStore.writePayload({
      encryptedPayloadRef,
      serializedEnvelope: JSON.stringify(Object.freeze({
        recordType: "ai-loom-protected-secret-payload/v1",
        encryptedPayload: encrypted.value,
      } satisfies PersistedProtectedSecretPayloadRecordV1)),
    });

    return Object.freeze({
      encryptedPayloadRef,
      payloadDigestSha256: `sha256:${createHash("sha256").update(plaintextBytes).digest("hex")}`,
      payloadByteLength: plaintextBytes.byteLength,
      keyEncryptionContext: Object.freeze({
        keyId: encrypted.value.descriptor.keyId,
        algorithm: encrypted.value.descriptor.algorithm,
        scope: input.owner.scope,
        workspaceId: input.owner.workspaceId,
        userIdentityId: input.owner.userIdentityId,
        keyVersion: encrypted.value.descriptor.keyVersion,
      }),
    });
  }

  public async decryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly version: SecretVersion;
  }): Promise<{ readonly plaintext: string }> {
    const serializedPayloadRecord = await this.payloadStore.readPayload(input.version.encryptedPayloadRef);
    if (!serializedPayloadRecord) {
      throw new Error(
        `Encrypted payload '${input.version.encryptedPayloadRef}' was not found for secret '${input.secretId}'.`,
      );
    }

    const record = parseProtectedSecretPayloadRecord(serializedPayloadRecord);
    const decrypted = await this.protectedValueEncryptionPort.decrypt({
      encryptedPayload: record.encryptedPayload,
      aad: toSecretMaterialAad(input.secretId, {
        scope: input.version.keyEncryptionContext.scope,
        workspaceId: input.version.keyEncryptionContext.workspaceId,
        userIdentityId: input.version.keyEncryptionContext.userIdentityId,
      }),
    });
    if (!decrypted.ok) {
      throw new Error(`Secret material decrypt failed: ${decrypted.error.message}`);
    }

    const plaintext = Buffer.from(decrypted.value.plaintext).toString("utf8");
    const digest = `sha256:${createHash("sha256").update(Buffer.from(plaintext, "utf8")).digest("hex")}`;
    if (digest !== input.version.payloadDigestSha256) {
      throw new Error(`Secret payload digest mismatch for '${input.version.versionId}'.`);
    }

    return Object.freeze({
      plaintext,
    });
  }
}

export function createProtectedValueSecretEncryptionPort(input: {
  readonly encryptionKeyResolutionService: IEncryptionKeyResolutionService;
  readonly protectedValueEncryptionPort: IProtectedValueEncryptionPort;
  readonly payloadStoreDirectory: string;
}): ProtectedValueSecretEncryptionPort {
  return new ProtectedValueSecretEncryptionPort(
    input.encryptionKeyResolutionService,
    input.protectedValueEncryptionPort,
    new FileSystemSecretEncryptedPayloadStore(input.payloadStoreDirectory),
  );
}

function parseProtectedSecretPayloadRecord(value: string): PersistedProtectedSecretPayloadRecordV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("Protected secret payload record is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Protected secret payload record is malformed.");
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.recordType !== "ai-loom-protected-secret-payload/v1") {
    throw new Error(
      `Unsupported secret payload record type '${String(candidate.recordType)}'.`,
    );
  }

  const encryptedPayload = candidate.encryptedPayload;
  if (!encryptedPayload || typeof encryptedPayload !== "object" || Array.isArray(encryptedPayload)) {
    throw new Error("Protected secret payload record encryptedPayload is malformed.");
  }

  return Object.freeze({
    recordType: "ai-loom-protected-secret-payload/v1",
    encryptedPayload: encryptedPayload as PersistedProtectedSecretPayloadRecordV1["encryptedPayload"],
  });
}

function toSecretMaterialAad(secretId: string, owner: SecretScopeOwner): string {
  return JSON.stringify(Object.freeze({
    type: "secret-material",
    secretId: secretId.trim(),
    ownerScope: owner.scope,
    workspaceId: owner.workspaceId ?? null,
    userIdentityId: owner.userIdentityId ?? null,
  }));
}

function defaultPayloadRefFactory(): string {
  return `${SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX}${randomUUID()}`;
}
