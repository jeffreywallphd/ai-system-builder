import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ScopedAesGcmEncryptionService,
  type ProtectedSecretEncryptionEnvelope,
} from "../encryption/ScopedAesGcmEncryptionService";

export const INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX = "secret-store:";

export interface ProtectedSecretMetadata {
  readonly secretRef: string;
  readonly secretRefRedacted: string;
  readonly keyScope?: string;
  readonly exists: boolean;
  readonly source: string;
}

export interface SaveProtectedSecretInput {
  readonly secretRef: string;
  readonly plaintextValue: string;
  readonly keyScope: string;
}

export interface LoadProtectedSecretInput {
  readonly secretRef: string;
  readonly expectedKeyScope?: string;
}

interface ProtectedSecretRecordEnvelope {
  readonly secretRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly encryption: ProtectedSecretEncryptionEnvelope;
}

export class FileSystemProtectedSecretStore {
  private readonly source: string;

  public constructor(
    private readonly baseDirectory: string,
    private readonly encryptionService: ScopedAesGcmEncryptionService,
    source: string = "file-protected-secret-store",
  ) {
    this.baseDirectory = normalizeRequired(baseDirectory, "Protected secret baseDirectory");
    this.source = normalizeRequired(source, "Protected secret source");
  }

  public async saveSecret(input: SaveProtectedSecretInput): Promise<ProtectedSecretMetadata> {
    const secretRef = normalizeSecretRef(input.secretRef);
    const keyScope = normalizeRequired(input.keyScope, "Protected secret keyScope");
    const now = new Date().toISOString();
    const existing = this.readRecord(secretRef);

    const record: ProtectedSecretRecordEnvelope = Object.freeze({
      secretRef,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      encryption: this.encryptionService.encrypt(input.plaintextValue, {
        keyScope,
        aad: secretRef,
      }),
    });

    this.writeRecord(record);

    return Object.freeze({
      secretRef,
      secretRefRedacted: redactSecretRef(secretRef),
      keyScope,
      exists: true,
      source: this.source,
    });
  }

  public async loadSecret(input: LoadProtectedSecretInput): Promise<string> {
    const secretRef = normalizeSecretRef(input.secretRef);
    const record = this.readRecord(secretRef);
    if (!record) {
      throw new Error(`Protected secret '${redactSecretRef(secretRef)}' was not found.`);
    }

    return this.encryptionService.decrypt(record.encryption, {
      aad: secretRef,
      expectedKeyScope: input.expectedKeyScope,
    });
  }

  public async getSecretMetadata(secretRefInput: string): Promise<ProtectedSecretMetadata> {
    const secretRef = normalizeSecretRef(secretRefInput);
    const record = this.readRecord(secretRef);
    return Object.freeze({
      secretRef,
      secretRefRedacted: redactSecretRef(secretRef),
      keyScope: record?.encryption.keyScope,
      exists: Boolean(record),
      source: this.source,
    });
  }

  private readRecord(secretRef: string): ProtectedSecretRecordEnvelope | undefined {
    const filePath = toSecretRecordPath(this.baseDirectory, secretRef);
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProtectedSecretRecordEnvelope;
    if (parsed.secretRef !== secretRef) {
      throw new Error(`Protected secret record mismatch for '${redactSecretRef(secretRef)}'.`);
    }

    return parsed;
  }

  private writeRecord(record: ProtectedSecretRecordEnvelope): void {
    fs.mkdirSync(this.baseDirectory, { recursive: true });

    const filePath = toSecretRecordPath(this.baseDirectory, record.secretRef);
    const tempFilePath = `${filePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(record), { encoding: "utf8" });
    fs.renameSync(tempFilePath, filePath);
  }
}

export function createFileSystemProtectedSecretStoreFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): FileSystemProtectedSecretStore | undefined {
  const baseDirectory = normalizeOptional(env.AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY);
  const defaultKey = normalizeOptional(env.AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY);
  const keysByScope = parseProtectedSecretKeysByScope(
    normalizeOptional(env.AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEYS_BY_SCOPE),
  );

  const hasAnySetting = Boolean(baseDirectory || defaultKey || Object.keys(keysByScope).length > 0);
  if (!hasAnySetting) {
    return undefined;
  }

  if (!baseDirectory) {
    throw new Error("Internal CA protected secret storage directory is required when protected storage is configured.");
  }

  if (!defaultKey && !keysByScope.default) {
    throw new Error("Internal CA protected secret storage key is required when protected storage is configured.");
  }

  const mergedKeysByScope = Object.freeze({
    ...(defaultKey ? { default: defaultKey } : {}),
    ...keysByScope,
  });

  return new FileSystemProtectedSecretStore(
    baseDirectory,
    new ScopedAesGcmEncryptionService(mergedKeysByScope),
  );
}

function parseProtectedSecretKeysByScope(value: string | undefined): Readonly<Record<string, string>> {
  if (!value) {
    return Object.freeze({});
  }

  const keysByScope: Record<string, string> = {};
  for (const [index, entry] of value.split(",").entries()) {
    const candidate = entry.trim();
    if (!candidate) {
      continue;
    }

    const separator = candidate.indexOf(":");
    if (separator < 0) {
      throw new Error(
        `Internal CA protected secrets key-scope entry at position ${index} is invalid. Use '<scope>:<key>'.`,
      );
    }

    const scope = candidate.slice(0, separator).trim();
    const encodedKey = candidate.slice(separator + 1).trim();
    if (!scope || !encodedKey) {
      throw new Error(
        `Internal CA protected secrets key-scope entry at position ${index} is invalid. Use '<scope>:<key>'.`,
      );
    }

    keysByScope[scope] = encodedKey;
  }

  return Object.freeze({ ...keysByScope });
}

function toSecretRecordPath(baseDirectory: string, secretRef: string): string {
  const digest = createHash("sha256").update(secretRef).digest("hex");
  return path.join(baseDirectory, `${digest}.json`);
}

function normalizeSecretRef(secretRef: string): string {
  const normalized = normalizeRequired(secretRef, "Protected secretRef");
  if (!normalized.startsWith(INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX)) {
    throw new Error(
      `Protected secret reference '${normalized}' is unsupported. Use '${INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX}<id>'.`,
    );
  }
  return normalized;
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

export function redactSecretRef(secretRef: string): string {
  const normalized = secretRef.trim();
  if (normalized.length <= 16) {
    return "[redacted]";
  }

  return `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
}
