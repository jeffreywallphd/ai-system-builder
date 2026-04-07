import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  DecryptProtectedValueRequest,
  DecryptedProtectedValue,
  EncryptProtectedValueRequest,
  IEncryptionKeyMaterialPort,
  IProtectedValueEncryptionPort,
  ProtectedValueEncryptionPortResult,
  ProtectedValuePayload,
} from "@application/security/ports/ProtectedValueEncryptionPorts";
import {
  ProtectedValueEncryptionErrorCodes,
  ProtectedValuePayloadDescriptorVersions,
} from "@application/security/ports/ProtectedValueEncryptionPorts";

const SupportedAlgorithm = "aes-256-gcm";

interface SerializedCiphertextPackageV1 {
  readonly packageVersion: 1;
  readonly ivBase64: string;
  readonly authTagBase64: string;
  readonly ciphertextBase64: string;
  readonly aadDigestSha256: string;
}

export interface VersionedAesGcmProtectedValueEncryptionPortDependencies {
  readonly encryptionKeyMaterialPort: IEncryptionKeyMaterialPort;
}

export class VersionedAesGcmProtectedValueEncryptionPort implements IProtectedValueEncryptionPort {
  public constructor(private readonly dependencies: VersionedAesGcmProtectedValueEncryptionPortDependencies) {}

  public async encrypt(
    request: EncryptProtectedValueRequest,
  ): Promise<ProtectedValueEncryptionPortResult<ProtectedValuePayload>> {
    const normalized = normalizeEncryptRequest(request);
    if (!normalized.ok) {
      return normalized;
    }

    if (normalized.value.key.algorithm !== SupportedAlgorithm) {
      return failure(
        "unsupportedAlgorithm",
        `Encryption algorithm '${normalized.value.key.algorithm}' is not supported.`,
        Object.freeze({
          keyReferenceId: normalized.value.key.keyReferenceId,
        }),
      );
    }

    try {
      const keyMaterial = await this.dependencies.encryptionKeyMaterialPort.resolveKeyMaterialByReference({
        keyReferenceId: normalized.value.key.keyReferenceId,
      });

      if (!keyMaterial) {
        return failure(
          "keyUnavailable",
          `Encryption key material for '${normalized.value.key.keyReferenceId}' is unavailable.`,
        );
      }

      if (keyMaterial.algorithm !== SupportedAlgorithm || keyMaterial.algorithm !== normalized.value.key.algorithm) {
        return failure(
          "unsupportedAlgorithm",
          `Encryption algorithm '${normalized.value.key.algorithm}' is not supported.`,
          Object.freeze({
            keyReferenceId: normalized.value.key.keyReferenceId,
          }),
        );
      }

      const iv = randomBytes(12);
      const cipher = createCipheriv(SupportedAlgorithm, Buffer.from(keyMaterial.keyBytes), iv);
      cipher.setAAD(Buffer.from(normalized.value.aad, "utf8"));
      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(normalized.value.plaintext)),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      const payloadPackage = serializeCiphertextPackage({
        packageVersion: 1,
        ivBase64: iv.toString("base64"),
        authTagBase64: authTag.toString("base64"),
        ciphertextBase64: ciphertext.toString("base64"),
        aadDigestSha256: sha256Hex(normalized.value.aad),
      });

      return {
        ok: true,
        value: Object.freeze({
          descriptor: Object.freeze({
            descriptorVersion: ProtectedValuePayloadDescriptorVersions.v1,
            algorithm: SupportedAlgorithm,
            keyReferenceId: normalized.value.key.keyReferenceId,
            keyId: normalized.value.key.keyId,
            keyVersion: normalized.value.key.keyVersion,
            keyScope: normalized.value.key.scopeOwner.scope,
            workspaceId: normalized.value.key.scopeOwner.workspaceId,
            storageInstanceId: normalized.value.key.scopeOwner.storageInstanceId,
            dataClass: normalized.value.dataClass,
            encryptedAt: normalized.value.encryptedAt,
            metadata: normalized.value.metadata,
          }),
          payloadBase64: Buffer.from(payloadPackage, "utf8").toString("base64"),
        }),
      };
    } catch (error) {
      return failure("encryptionFailed", toErrorMessage(error, "Protected value encryption failed."));
    }
  }

  public async decrypt(
    request: DecryptProtectedValueRequest,
  ): Promise<ProtectedValueEncryptionPortResult<DecryptedProtectedValue>> {
    const normalized = normalizeDecryptRequest(request);
    if (!normalized.ok) {
      return normalized;
    }

    if (normalized.value.descriptor.algorithm !== SupportedAlgorithm) {
      return failure(
        "unsupportedAlgorithm",
        `Encryption algorithm '${normalized.value.descriptor.algorithm}' is not supported.`,
        Object.freeze({
          keyReferenceId: normalized.value.descriptor.keyReferenceId,
        }),
      );
    }

    if (normalized.value.expectedKeyReferenceId
      && normalized.value.descriptor.keyReferenceId !== normalized.value.expectedKeyReferenceId) {
      return failure(
        "invalidRequest",
        "Encrypted payload key reference did not match expected key reference.",
      );
    }
    if (normalized.value.expectedKeyScope
      && normalized.value.descriptor.keyScope !== normalized.value.expectedKeyScope) {
      return failure(
        "invalidRequest",
        "Encrypted payload key scope did not match expected key scope.",
      );
    }

    let serializedPayload: string;
    let payloadPackage: SerializedCiphertextPackageV1;
    try {
      serializedPayload = Buffer.from(normalized.value.payloadBase64, "base64").toString("utf8");
      payloadPackage = parseCiphertextPackage(serializedPayload);
    } catch {
      return failure("malformedPayload", "Encrypted payload format is invalid.");
    }

    const expectedAadDigest = sha256Hex(normalized.value.aad);
    if (!safeEqualHex(payloadPackage.aadDigestSha256, expectedAadDigest)) {
      return failure("authenticationFailed", "Protected value authentication failed.");
    }

    try {
      const keyMaterial = await this.dependencies.encryptionKeyMaterialPort.resolveKeyMaterialByReference({
        keyReferenceId: normalized.value.descriptor.keyReferenceId,
      });
      if (!keyMaterial) {
        return failure(
          "keyUnavailable",
          `Encryption key material for '${normalized.value.descriptor.keyReferenceId}' is unavailable.`,
        );
      }

      if (keyMaterial.algorithm !== SupportedAlgorithm) {
        return failure(
          "unsupportedAlgorithm",
          `Encryption algorithm '${keyMaterial.algorithm}' is not supported.`,
          Object.freeze({
            keyReferenceId: normalized.value.descriptor.keyReferenceId,
          }),
        );
      }

      const decipher = createDecipheriv(
        SupportedAlgorithm,
        Buffer.from(keyMaterial.keyBytes),
        Buffer.from(payloadPackage.ivBase64, "base64"),
      );
      decipher.setAAD(Buffer.from(normalized.value.aad, "utf8"));
      decipher.setAuthTag(Buffer.from(payloadPackage.authTagBase64, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(payloadPackage.ciphertextBase64, "base64")),
        decipher.final(),
      ]);

      return {
        ok: true,
        value: Object.freeze({
          plaintext,
          descriptor: normalized.value.descriptor,
        }),
      };
    } catch {
      return failure("authenticationFailed", "Protected value authentication failed.");
    }
  }
}

function normalizeEncryptRequest(
  request: EncryptProtectedValueRequest,
): ProtectedValueEncryptionPortResult<{
  readonly plaintext: Uint8Array;
  readonly aad: string;
  readonly key: EncryptProtectedValueRequest["key"];
  readonly dataClass: EncryptProtectedValueRequest["dataClass"];
  readonly encryptedAt: string;
  readonly metadata?: Readonly<Record<string, string>>;
}> {
  if (!request) {
    return failure("invalidRequest", "Encryption request is required.");
  }
  if (!(request.plaintext instanceof Uint8Array) || request.plaintext.length === 0) {
    return failure("invalidRequest", "Encryption request plaintext is required.");
  }

  try {
    const aad = normalizeRequired(request.aad, "Encryption request aad");
    const keyReferenceId = normalizeRequired(request.key?.keyReferenceId ?? "", "Encryption key referenceId");
    const keyId = normalizeRequired(request.key?.keyId ?? "", "Encryption key id");
    const algorithm = normalizeRequired(request.key?.algorithm ?? "", "Encryption key algorithm");
    const keyScope = request.key?.scopeOwner?.scope;
    if (!keyScope) {
      return failure("invalidRequest", "Encryption key scope is required.");
    }

    const encryptedAt = normalizeTimestamp(request.encryptedAt ?? new Date().toISOString());
    if (!encryptedAt) {
      return failure("invalidRequest", "Encryption request encryptedAt must be a valid timestamp when provided.");
    }

    return {
      ok: true,
      value: Object.freeze({
        plaintext: request.plaintext,
        aad,
        key: Object.freeze({
          ...request.key,
          keyReferenceId,
          keyId,
          algorithm,
        }),
        dataClass: request.dataClass,
        encryptedAt,
        metadata: normalizeMetadata(request.metadata),
      }),
    };
  } catch (error) {
    return failure("invalidRequest", toErrorMessage(error, "Encryption request is invalid."));
  }
}

function normalizeDecryptRequest(
  request: DecryptProtectedValueRequest,
): ProtectedValueEncryptionPortResult<{
  readonly descriptor: DecryptProtectedValueRequest["encryptedPayload"]["descriptor"];
  readonly payloadBase64: string;
  readonly aad: string;
  readonly expectedKeyReferenceId?: string;
  readonly expectedKeyScope?: DecryptProtectedValueRequest["expectedKeyScope"];
}> {
  if (!request) {
    return failure("invalidRequest", "Decryption request is required.");
  }
  try {
    const aad = normalizeRequired(request.aad, "Decryption request aad");
    const descriptor = request.encryptedPayload?.descriptor;
    if (!descriptor) {
      return failure("invalidRequest", "Encrypted payload descriptor is required.");
    }
    if (descriptor.descriptorVersion !== ProtectedValuePayloadDescriptorVersions.v1) {
      return failure(
        "malformedPayload",
        `Encrypted payload descriptor version '${String(descriptor.descriptorVersion)}' is unsupported.`,
      );
    }

    const keyReferenceId = normalizeRequired(descriptor.keyReferenceId, "Encrypted payload keyReferenceId");
    const keyId = normalizeRequired(descriptor.keyId, "Encrypted payload keyId");
    const algorithm = normalizeRequired(descriptor.algorithm, "Encrypted payload algorithm");
    const encryptedAt = normalizeTimestamp(descriptor.encryptedAt);
    if (!encryptedAt) {
      return failure("malformedPayload", "Encrypted payload encryptedAt is invalid.");
    }

    const payloadBase64 = normalizeRequired(request.encryptedPayload.payloadBase64, "Encrypted payload payloadBase64");
    return {
      ok: true,
      value: Object.freeze({
        descriptor: Object.freeze({
          ...descriptor,
          keyReferenceId,
          keyId,
          algorithm,
          encryptedAt,
        }),
        payloadBase64,
        aad,
        expectedKeyReferenceId: normalizeOptional(request.expectedKeyReferenceId),
        expectedKeyScope: request.expectedKeyScope,
      }),
    };
  } catch (error) {
    return failure("malformedPayload", toErrorMessage(error, "Encrypted payload format is invalid."));
  }
}

function parseCiphertextPackage(serializedPayload: string): SerializedCiphertextPackageV1 {
  const parsed = JSON.parse(serializedPayload) as Partial<SerializedCiphertextPackageV1>;
  if (parsed.packageVersion !== 1) {
    throw new Error("Unsupported encrypted payload package version.");
  }

  return Object.freeze({
    packageVersion: 1,
    ivBase64: normalizeRequired(parsed.ivBase64 ?? "", "Encrypted payload ivBase64"),
    authTagBase64: normalizeRequired(parsed.authTagBase64 ?? "", "Encrypted payload authTagBase64"),
    ciphertextBase64: normalizeRequired(parsed.ciphertextBase64 ?? "", "Encrypted payload ciphertextBase64"),
    aadDigestSha256: normalizeRequired(parsed.aadDigestSha256 ?? "", "Encrypted payload aadDigestSha256"),
  });
}

function serializeCiphertextPackage(payload: SerializedCiphertextPackageV1): string {
  return JSON.stringify({
    packageVersion: payload.packageVersion,
    ivBase64: payload.ivBase64,
    authTagBase64: payload.authTagBase64,
    ciphertextBase64: payload.ciphertextBase64,
    aadDigestSha256: payload.aadDigestSha256,
  });
}

function normalizeMetadata(
  input: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!input) {
    return undefined;
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    output[normalizedKey] = normalizedValue;
  }
  return Object.freeze(output);
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function failure(
  code: keyof typeof ProtectedValueEncryptionErrorCodes,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ProtectedValueEncryptionPortResult<never> {
  return {
    ok: false,
    error: Object.freeze({
      code: ProtectedValueEncryptionErrorCodes[code],
      message,
      details,
    }),
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

