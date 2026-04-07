import type {
  EncryptionKeyMaterialDescriptor,
  IEncryptionKeyMaterialPort,
  ResolveEncryptionKeyMaterialRequest,
} from "@application/security/ports/ProtectedValueEncryptionPorts";

interface StaticEncryptionKeyMaterialInput {
  readonly keyReferenceId: string;
  readonly algorithm: string;
  readonly encodedKey: string;
}

export class StaticEncryptionKeyMaterialPort implements IEncryptionKeyMaterialPort {
  private readonly keyMaterialByReferenceId = new Map<string, EncryptionKeyMaterialDescriptor>();

  public constructor(input: {
    readonly keyMaterials: ReadonlyArray<StaticEncryptionKeyMaterialInput>;
  }) {
    for (const rawEntry of input.keyMaterials) {
      const entry = normalizeEntry(rawEntry);
      if (this.keyMaterialByReferenceId.has(entry.keyReferenceId)) {
        throw new Error(`Duplicate encryption key material reference '${entry.keyReferenceId}' is not allowed.`);
      }
      this.keyMaterialByReferenceId.set(entry.keyReferenceId, entry);
    }
  }

  public async resolveKeyMaterialByReference(
    request: ResolveEncryptionKeyMaterialRequest,
  ): Promise<EncryptionKeyMaterialDescriptor | undefined> {
    const keyReferenceId = normalizeRequired(request.keyReferenceId, "Encryption key material referenceId");
    return this.keyMaterialByReferenceId.get(keyReferenceId);
  }
}

function normalizeEntry(input: StaticEncryptionKeyMaterialInput): EncryptionKeyMaterialDescriptor {
  return Object.freeze({
    keyReferenceId: normalizeRequired(input.keyReferenceId, "Encryption key material referenceId"),
    algorithm: normalizeRequired(input.algorithm, "Encryption key material algorithm"),
    keyBytes: decodeAes256Key(input.encodedKey),
  });
}

function decodeAes256Key(encodedKey: string): Uint8Array {
  const normalized = normalizeRequired(encodedKey, "Encryption key material encoded key");
  const asBase64 = Buffer.from(normalized, "base64");
  if (asBase64.length === 32) {
    return asBase64;
  }

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const asHex = Buffer.from(normalized, "hex");
    if (asHex.length === 32) {
      return asHex;
    }
  }

  throw new Error("Encryption key material must be 32 bytes (base64 or hex).");
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

