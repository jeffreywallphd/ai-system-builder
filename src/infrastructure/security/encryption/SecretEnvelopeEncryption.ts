import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { KeyEncryptionContext, SecretScopeOwner } from "../../../domain/security/SecretDomain";

const ENVELOPE_SCHEMA = "ai-loom-secret-envelope";
const ENVELOPE_VERSION = 1;
const AES_GCM_ALGORITHM = "aes-256-gcm";

export class SecretEnvelopeEncryptionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SecretEnvelopeEncryptionError";
  }
}

export interface SecretMasterKeyMaterial {
  readonly keyId: string;
  readonly keyVersion?: string;
  readonly algorithm: "aes-256-gcm";
  readonly keyBytes: Buffer;
}

export interface ISecretMasterKeyProvider {
  getActiveKey(): SecretMasterKeyMaterial;
  getKeyById(input: { readonly keyId: string; readonly keyVersion?: string }): SecretMasterKeyMaterial | undefined;
}

export interface SecretCiphertextEnvelope {
  readonly schema: typeof ENVELOPE_SCHEMA;
  readonly version: typeof ENVELOPE_VERSION;
  readonly payload: {
    readonly algorithm: "aes-256-gcm";
    readonly ivBase64: string;
    readonly ciphertextBase64: string;
    readonly authTagBase64: string;
  };
  readonly keyWrap: {
    readonly algorithm: "aes-256-gcm";
    readonly keyId: string;
    readonly keyVersion?: string;
    readonly ivBase64: string;
    readonly wrappedDekBase64: string;
    readonly authTagBase64: string;
  };
  readonly context: {
    readonly secretId: string;
    readonly scope: SecretScopeOwner["scope"];
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
  };
}

export interface EnvelopeEncryptionResult {
  readonly envelope: SecretCiphertextEnvelope;
  readonly serializedEnvelope: string;
  readonly payloadDigestSha256: string;
  readonly payloadByteLength: number;
  readonly keyEncryptionContext: KeyEncryptionContext;
}

export class StaticSecretMasterKeyProvider implements ISecretMasterKeyProvider {
  private readonly keysByIdentity = new Map<string, SecretMasterKeyMaterial>();
  private readonly activeKeyIdentity: string;

  public constructor(input: {
    readonly activeKeyId: string;
    readonly activeKeyVersion?: string;
    readonly keys: ReadonlyArray<SecretMasterKeyMaterial>;
  }) {
    if (input.keys.length === 0) {
      throw new SecretEnvelopeEncryptionError("Secret master key provider requires at least one key.");
    }

    for (const key of input.keys) {
      validateMasterKeyMaterial(key);
      const identity = toKeyIdentity(key.keyId, key.keyVersion);
      this.keysByIdentity.set(identity, key);
    }

    this.activeKeyIdentity = toKeyIdentity(input.activeKeyId, input.activeKeyVersion);
    if (!this.keysByIdentity.has(this.activeKeyIdentity)) {
      throw new SecretEnvelopeEncryptionError("Secret master key provider active key is not available in key set.");
    }
  }

  public getActiveKey(): SecretMasterKeyMaterial {
    const key = this.keysByIdentity.get(this.activeKeyIdentity);
    if (!key) {
      throw new SecretEnvelopeEncryptionError("Active secret master key is unavailable.");
    }
    return key;
  }

  public getKeyById(input: { readonly keyId: string; readonly keyVersion?: string }): SecretMasterKeyMaterial | undefined {
    return this.keysByIdentity.get(toKeyIdentity(input.keyId, input.keyVersion));
  }
}

export class SecretEnvelopeEncryptionService {
  public constructor(private readonly masterKeyProvider: ISecretMasterKeyProvider) {}

  public encrypt(input: {
    readonly plaintext: string;
    readonly secretId: string;
    readonly owner: SecretScopeOwner;
    readonly keyContext?: KeyEncryptionContext;
  }): EnvelopeEncryptionResult {
    const secretId = normalizeRequired(input.secretId, "Secret envelope secretId");
    const owner = normalizeOwner(input.owner);
    const plaintextBytes = Buffer.from(input.plaintext, "utf8");

    const masterKey = input.keyContext
      ? this.resolveMasterKeyFromContext(input.keyContext)
      : this.masterKeyProvider.getActiveKey();

    const dataEncryptionKey = randomBytes(32);
    const payloadAad = buildPayloadAad(secretId, owner);
    const payloadIv = randomBytes(12);
    const payloadEncrypted = encryptAesGcm(plaintextBytes, dataEncryptionKey, payloadIv, payloadAad);

    const wrappedDekIv = randomBytes(12);
    const wrappedDekAad = buildKeyWrapAad(secretId, owner, masterKey);
    const wrappedDek = encryptAesGcm(dataEncryptionKey, masterKey.keyBytes, wrappedDekIv, wrappedDekAad);

    const keyEncryptionContext = Object.freeze({
      keyId: masterKey.keyId,
      algorithm: masterKey.algorithm,
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      keyVersion: masterKey.keyVersion,
    });

    const envelope: SecretCiphertextEnvelope = Object.freeze({
      schema: ENVELOPE_SCHEMA,
      version: ENVELOPE_VERSION,
      payload: Object.freeze({
        algorithm: AES_GCM_ALGORITHM,
        ivBase64: payloadIv.toString("base64"),
        ciphertextBase64: payloadEncrypted.ciphertext.toString("base64"),
        authTagBase64: payloadEncrypted.authTag.toString("base64"),
      }),
      keyWrap: Object.freeze({
        algorithm: AES_GCM_ALGORITHM,
        keyId: masterKey.keyId,
        keyVersion: masterKey.keyVersion,
        ivBase64: wrappedDekIv.toString("base64"),
        wrappedDekBase64: wrappedDek.ciphertext.toString("base64"),
        authTagBase64: wrappedDek.authTag.toString("base64"),
      }),
      context: Object.freeze({
        secretId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
      }),
    });

    return Object.freeze({
      envelope,
      serializedEnvelope: serializeSecretCiphertextEnvelope(envelope),
      payloadDigestSha256: `sha256:${createHash("sha256").update(plaintextBytes).digest("hex")}`,
      payloadByteLength: plaintextBytes.byteLength,
      keyEncryptionContext,
    });
  }

  public decrypt(input: {
    readonly serializedEnvelope: string;
    readonly secretId: string;
    readonly owner: SecretScopeOwner;
    readonly expectedDigestSha256?: string;
  }): string {
    const secretId = normalizeRequired(input.secretId, "Secret envelope secretId");
    const owner = normalizeOwner(input.owner);
    const envelope = parseSecretCiphertextEnvelope(input.serializedEnvelope);

    validateEnvelopeContext(envelope, secretId, owner);

    const masterKey = this.masterKeyProvider.getKeyById({
      keyId: envelope.keyWrap.keyId,
      keyVersion: envelope.keyWrap.keyVersion,
    });
    if (!masterKey) {
      throw new SecretEnvelopeEncryptionError(
        `Secret envelope key '${toKeyIdentity(envelope.keyWrap.keyId, envelope.keyWrap.keyVersion)}' is unavailable.`,
      );
    }

    const wrappedDekAad = buildKeyWrapAad(secretId, owner, masterKey);
    const wrappedDekIv = decodeBase64(envelope.keyWrap.ivBase64, "Secret envelope keyWrap.ivBase64");
    const wrappedDekCiphertext = decodeBase64(envelope.keyWrap.wrappedDekBase64, "Secret envelope keyWrap.wrappedDekBase64");
    const wrappedDekAuthTag = decodeBase64(envelope.keyWrap.authTagBase64, "Secret envelope keyWrap.authTagBase64");

    let dataEncryptionKey: Buffer;
    try {
      dataEncryptionKey = decryptAesGcm(
        wrappedDekCiphertext,
        wrappedDekAuthTag,
        masterKey.keyBytes,
        wrappedDekIv,
        wrappedDekAad,
      );
    } catch {
      throw new SecretEnvelopeEncryptionError("Secret envelope key unwrap failed.");
    }

    const payloadAad = buildPayloadAad(secretId, owner);
    const payloadIv = decodeBase64(envelope.payload.ivBase64, "Secret envelope payload.ivBase64");
    const payloadCiphertext = decodeBase64(envelope.payload.ciphertextBase64, "Secret envelope payload.ciphertextBase64");
    const payloadAuthTag = decodeBase64(envelope.payload.authTagBase64, "Secret envelope payload.authTagBase64");

    let plaintextBytes: Buffer;
    try {
      plaintextBytes = decryptAesGcm(payloadCiphertext, payloadAuthTag, dataEncryptionKey, payloadIv, payloadAad);
    } catch {
      throw new SecretEnvelopeEncryptionError("Secret envelope payload decrypt failed.");
    }

    if (input.expectedDigestSha256) {
      const digest = `sha256:${createHash("sha256").update(plaintextBytes).digest("hex")}`;
      if (digest !== input.expectedDigestSha256) {
        throw new SecretEnvelopeEncryptionError("Secret envelope payload digest mismatch.");
      }
    }

    return plaintextBytes.toString("utf8");
  }

  private resolveMasterKeyFromContext(context: KeyEncryptionContext): SecretMasterKeyMaterial {
    if (context.algorithm !== AES_GCM_ALGORITHM) {
      throw new SecretEnvelopeEncryptionError(
        `Secret key encryption context algorithm '${context.algorithm}' is unsupported.`,
      );
    }

    const key = this.masterKeyProvider.getKeyById({
      keyId: context.keyId,
      keyVersion: context.keyVersion,
    });
    if (!key) {
      throw new SecretEnvelopeEncryptionError(
        `Secret key encryption context key '${toKeyIdentity(context.keyId, context.keyVersion)}' is unavailable.`,
      );
    }
    return key;
  }
}

export function createSecretMasterKeyProviderFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): ISecretMasterKeyProvider {
  const activeKeyId = normalizeRequired(env.AI_LOOM_SECRET_MASTER_KEY_ID ?? "", "AI_LOOM_SECRET_MASTER_KEY_ID");
  const activeKeyVersion = normalizeOptional(env.AI_LOOM_SECRET_MASTER_KEY_VERSION);
  const activeEncodedKey = normalizeRequired(env.AI_LOOM_SECRET_MASTER_KEY ?? "", "AI_LOOM_SECRET_MASTER_KEY");

  const keys = new Map<string, SecretMasterKeyMaterial>();
  const activeKey: SecretMasterKeyMaterial = Object.freeze({
    keyId: activeKeyId,
    keyVersion: activeKeyVersion,
    algorithm: AES_GCM_ALGORITHM,
    keyBytes: decodeAes256Key(activeEncodedKey),
  });
  keys.set(toKeyIdentity(activeKey.keyId, activeKey.keyVersion), activeKey);

  const extraKeys = normalizeOptional(env.AI_LOOM_SECRET_MASTER_KEYS_BY_ID);
  if (extraKeys) {
    for (const [index, candidate] of extraKeys.split(",").entries()) {
      const trimmed = candidate.trim();
      if (!trimmed) {
        continue;
      }

      const separator = trimmed.lastIndexOf(":");
      if (separator < 0) {
        throw new SecretEnvelopeEncryptionError(
          `AI_LOOM_SECRET_MASTER_KEYS_BY_ID entry at position ${index} is invalid. Use '<keyId[@keyVersion]>:<key>'.`,
        );
      }

      const keyIdentity = trimmed.slice(0, separator).trim();
      const encodedKey = trimmed.slice(separator + 1).trim();
      const [keyId, keyVersion] = parseKeyIdentity(keyIdentity);

      const key: SecretMasterKeyMaterial = Object.freeze({
        keyId,
        keyVersion,
        algorithm: AES_GCM_ALGORITHM,
        keyBytes: decodeAes256Key(encodedKey),
      });
      keys.set(toKeyIdentity(key.keyId, key.keyVersion), key);
    }
  }

  return new StaticSecretMasterKeyProvider({
    activeKeyId,
    activeKeyVersion,
    keys: [...keys.values()],
  });
}

export function serializeSecretCiphertextEnvelope(envelope: SecretCiphertextEnvelope): string {
  return JSON.stringify(toSerializableEnvelope(envelope));
}

export function parseSecretCiphertextEnvelope(serialized: string): SecretCiphertextEnvelope {
  const normalized = normalizeRequired(serialized, "Secret envelope serialized payload");
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new SecretEnvelopeEncryptionError("Secret envelope payload is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SecretEnvelopeEncryptionError("Secret envelope payload must be a JSON object.");
  }

  const raw = parsed as Record<string, unknown>;
  if (raw.schema !== ENVELOPE_SCHEMA) {
    throw new SecretEnvelopeEncryptionError(`Secret envelope schema '${String(raw.schema)}' is unsupported.`);
  }
  if (raw.version !== ENVELOPE_VERSION) {
    throw new SecretEnvelopeEncryptionError(`Secret envelope version '${String(raw.version)}' is unsupported.`);
  }

  const payload = asObject(raw.payload, "Secret envelope payload");
  const keyWrap = asObject(raw.keyWrap, "Secret envelope keyWrap");
  const context = asObject(raw.context, "Secret envelope context");

  const envelope: SecretCiphertextEnvelope = {
    schema: ENVELOPE_SCHEMA,
    version: ENVELOPE_VERSION,
    payload: {
      algorithm: asAlgorithm(payload.algorithm, "Secret envelope payload algorithm"),
      ivBase64: asString(payload.ivBase64, "Secret envelope payload ivBase64"),
      ciphertextBase64: asString(payload.ciphertextBase64, "Secret envelope payload ciphertextBase64"),
      authTagBase64: asString(payload.authTagBase64, "Secret envelope payload authTagBase64"),
    },
    keyWrap: {
      algorithm: asAlgorithm(keyWrap.algorithm, "Secret envelope keyWrap algorithm"),
      keyId: asString(keyWrap.keyId, "Secret envelope keyWrap keyId"),
      keyVersion: asOptionalString(keyWrap.keyVersion),
      ivBase64: asString(keyWrap.ivBase64, "Secret envelope keyWrap ivBase64"),
      wrappedDekBase64: asString(keyWrap.wrappedDekBase64, "Secret envelope keyWrap wrappedDekBase64"),
      authTagBase64: asString(keyWrap.authTagBase64, "Secret envelope keyWrap authTagBase64"),
    },
    context: {
      secretId: asString(context.secretId, "Secret envelope context secretId"),
      scope: asScope(context.scope),
      workspaceId: asOptionalString(context.workspaceId),
      userIdentityId: asOptionalString(context.userIdentityId),
    },
  };

  return Object.freeze({
    ...envelope,
    payload: Object.freeze(envelope.payload),
    keyWrap: Object.freeze(envelope.keyWrap),
    context: Object.freeze(envelope.context),
  });
}

function toSerializableEnvelope(envelope: SecretCiphertextEnvelope): SecretCiphertextEnvelope {
  return Object.freeze({
    schema: envelope.schema,
    version: envelope.version,
    payload: Object.freeze({
      algorithm: envelope.payload.algorithm,
      ivBase64: envelope.payload.ivBase64,
      ciphertextBase64: envelope.payload.ciphertextBase64,
      authTagBase64: envelope.payload.authTagBase64,
    }),
    keyWrap: Object.freeze({
      algorithm: envelope.keyWrap.algorithm,
      keyId: envelope.keyWrap.keyId,
      keyVersion: envelope.keyWrap.keyVersion,
      ivBase64: envelope.keyWrap.ivBase64,
      wrappedDekBase64: envelope.keyWrap.wrappedDekBase64,
      authTagBase64: envelope.keyWrap.authTagBase64,
    }),
    context: Object.freeze({
      secretId: envelope.context.secretId,
      scope: envelope.context.scope,
      workspaceId: envelope.context.workspaceId,
      userIdentityId: envelope.context.userIdentityId,
    }),
  });
}

function validateEnvelopeContext(envelope: SecretCiphertextEnvelope, secretId: string, owner: SecretScopeOwner): void {
  if (envelope.context.secretId !== secretId) {
    throw new SecretEnvelopeEncryptionError("Secret envelope context secretId does not match request.");
  }
  if (envelope.context.scope !== owner.scope) {
    throw new SecretEnvelopeEncryptionError("Secret envelope context scope does not match request.");
  }
  if ((envelope.context.workspaceId ?? undefined) !== (owner.workspaceId ?? undefined)) {
    throw new SecretEnvelopeEncryptionError("Secret envelope context workspaceId does not match request.");
  }
  if ((envelope.context.userIdentityId ?? undefined) !== (owner.userIdentityId ?? undefined)) {
    throw new SecretEnvelopeEncryptionError("Secret envelope context userIdentityId does not match request.");
  }
}

function buildPayloadAad(secretId: string, owner: SecretScopeOwner): Buffer {
  return Buffer.from(
    JSON.stringify({
      type: "payload",
      secretId,
      scope: owner.scope,
      workspaceId: owner.workspaceId ?? null,
      userIdentityId: owner.userIdentityId ?? null,
    }),
    "utf8",
  );
}

function buildKeyWrapAad(secretId: string, owner: SecretScopeOwner, masterKey: SecretMasterKeyMaterial): Buffer {
  return Buffer.from(
    JSON.stringify({
      type: "key-wrap",
      secretId,
      scope: owner.scope,
      workspaceId: owner.workspaceId ?? null,
      userIdentityId: owner.userIdentityId ?? null,
      keyId: masterKey.keyId,
      keyVersion: masterKey.keyVersion ?? null,
    }),
    "utf8",
  );
}

function encryptAesGcm(
  plaintext: Buffer,
  key: Buffer,
  iv: Buffer,
  aad: Buffer,
): { readonly ciphertext: Buffer; readonly authTag: Buffer } {
  const cipher = createCipheriv(AES_GCM_ALGORITHM, key, iv);
  cipher.setAAD(aad);
  return Object.freeze({
    ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]),
    authTag: cipher.getAuthTag(),
  });
}

function decryptAesGcm(
  ciphertext: Buffer,
  authTag: Buffer,
  key: Buffer,
  iv: Buffer,
  aad: Buffer,
): Buffer {
  const decipher = createDecipheriv(AES_GCM_ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function validateMasterKeyMaterial(key: SecretMasterKeyMaterial): void {
  normalizeRequired(key.keyId, "Secret master key keyId");
  if (key.algorithm !== AES_GCM_ALGORITHM) {
    throw new SecretEnvelopeEncryptionError(`Secret master key algorithm '${key.algorithm}' is unsupported.`);
  }
  if (key.keyBytes.byteLength !== 32) {
    throw new SecretEnvelopeEncryptionError("Secret master key material must be 32 bytes.");
  }
}

function parseKeyIdentity(value: string): [string, string | undefined] {
  const normalized = normalizeRequired(value, "Secret key identity");
  const atIndex = normalized.indexOf("@");
  if (atIndex < 0) {
    return [normalized, undefined];
  }

  const keyId = normalized.slice(0, atIndex).trim();
  const keyVersion = normalized.slice(atIndex + 1).trim();
  if (!keyId || !keyVersion) {
    throw new SecretEnvelopeEncryptionError(
      `Secret key identity '${normalized}' is invalid. Use '<keyId>' or '<keyId>@<keyVersion>'.`,
    );
  }
  return [keyId, keyVersion];
}

function toKeyIdentity(keyId: string, keyVersion?: string): string {
  const id = normalizeRequired(keyId, "Secret keyId");
  const version = normalizeOptional(keyVersion);
  return version ? `${id}@${version}` : id;
}

function decodeAes256Key(value: string): Buffer {
  const normalized = normalizeRequired(value, "Secret encoded key");
  const asBase64 = Buffer.from(normalized, "base64");
  if (asBase64.byteLength === 32) {
    return asBase64;
  }

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const asHex = Buffer.from(normalized, "hex");
    if (asHex.byteLength === 32) {
      return asHex;
    }
  }

  throw new SecretEnvelopeEncryptionError("Secret encoded key must be 32 bytes in base64 or hex format.");
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new SecretEnvelopeEncryptionError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOwner(owner: SecretScopeOwner): SecretScopeOwner {
  return Object.freeze({
    scope: owner.scope,
    workspaceId: normalizeOptional(owner.workspaceId),
    userIdentityId: normalizeOptional(owner.userIdentityId),
  });
}

function decodeBase64(value: string, field: string): Buffer {
  const normalized = normalizeRequired(value, field);
  try {
    return Buffer.from(normalized, "base64");
  } catch {
    throw new SecretEnvelopeEncryptionError(`${field} is not valid base64.`);
  }
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new SecretEnvelopeEncryptionError(`${field} is required.`);
  }
  return normalizeRequired(value, field);
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new SecretEnvelopeEncryptionError("Secret envelope optional value must be a string when provided.");
  }
  return normalizeOptional(value);
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SecretEnvelopeEncryptionError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asAlgorithm(value: unknown, field: string): "aes-256-gcm" {
  if (value !== AES_GCM_ALGORITHM) {
    throw new SecretEnvelopeEncryptionError(`${field} '${String(value)}' is unsupported.`);
  }
  return AES_GCM_ALGORITHM;
}

function asScope(value: unknown): SecretScopeOwner["scope"] {
  if (value === "server" || value === "workspace" || value === "user") {
    return value;
  }
  throw new SecretEnvelopeEncryptionError(`Secret envelope context scope '${String(value)}' is invalid.`);
}
