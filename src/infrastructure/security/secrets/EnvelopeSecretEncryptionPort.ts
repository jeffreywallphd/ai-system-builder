import { randomUUID } from "node:crypto";
import type { ISecretEncryptionPort } from "../../../application/security/ports/SecretServicePorts";
import type { SecretScopeOwner, SecretVersion } from "../../../domain/security/SecretDomain";
import {
  SecretEnvelopeEncryptionError,
  SecretEnvelopeEncryptionService,
  createSecretMasterKeyProviderFromEnvironment,
} from "../encryption/SecretEnvelopeEncryption";
import {
  SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX,
  FileSystemSecretEncryptedPayloadStore,
} from "./FileSystemSecretEncryptedPayloadStore";
import type { ISecretEncryptedPayloadStore } from "./SecretEncryptedPayloadStore";

export class EnvelopeSecretEncryptionPort implements ISecretEncryptionPort {
  public constructor(
    private readonly envelopeEncryption: SecretEnvelopeEncryptionService,
    private readonly payloadStore: ISecretEncryptedPayloadStore,
    private readonly payloadRefFactory: () => string = defaultPayloadRefFactory,
  ) {}

  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretScopeOwner;
    readonly plaintext: string;
    readonly existingContext?: SecretVersion["keyEncryptionContext"];
  }) {
    const encryptedPayloadRef = this.payloadRefFactory();
    const encrypted = this.envelopeEncryption.encrypt({
      plaintext: input.plaintext,
      secretId: input.secretId,
      owner: input.owner,
      keyContext: input.existingContext,
    });

    await this.payloadStore.writePayload({
      encryptedPayloadRef,
      serializedEnvelope: encrypted.serializedEnvelope,
    });

    return Object.freeze({
      encryptedPayloadRef,
      payloadDigestSha256: encrypted.payloadDigestSha256,
      payloadByteLength: encrypted.payloadByteLength,
      keyEncryptionContext: encrypted.keyEncryptionContext,
    });
  }

  public async decryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly version: SecretVersion;
  }): Promise<{ readonly plaintext: string }> {
    const serializedEnvelope = await this.payloadStore.readPayload(input.version.encryptedPayloadRef);
    if (!serializedEnvelope) {
      throw new SecretEnvelopeEncryptionError(
        `Encrypted payload '${input.version.encryptedPayloadRef}' was not found for secret '${input.secretId}'.`,
      );
    }

    const plaintext = this.envelopeEncryption.decrypt({
      serializedEnvelope,
      secretId: input.secretId,
      owner: {
        scope: input.version.keyEncryptionContext.scope,
        workspaceId: input.version.keyEncryptionContext.workspaceId,
        userIdentityId: input.version.keyEncryptionContext.userIdentityId,
      },
      expectedDigestSha256: input.version.payloadDigestSha256,
    });

    return Object.freeze({ plaintext });
  }
}

export function createEnvelopeSecretEncryptionPortFromEnvironment(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly payloadStoreDirectory: string;
}): EnvelopeSecretEncryptionPort {
  const keyProvider = createSecretMasterKeyProviderFromEnvironment(input.env);
  const payloadStore = new FileSystemSecretEncryptedPayloadStore(input.payloadStoreDirectory);
  return new EnvelopeSecretEncryptionPort(new SecretEnvelopeEncryptionService(keyProvider), payloadStore);
}

function defaultPayloadRefFactory(): string {
  return `${SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX}${randomUUID()}`;
}
