import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SecretEnvelopeEncryptionError } from "../encryption/SecretEnvelopeEncryption";
import type { ISecretEncryptedPayloadStore } from "./SecretEncryptedPayloadStore";

export const SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX = "secret-envelope:";

export class FileSystemSecretEncryptedPayloadStore implements ISecretEncryptedPayloadStore {
  public constructor(private readonly baseDirectory: string) {
    this.baseDirectory = normalizeRequired(baseDirectory, "Secret encrypted payload baseDirectory");
  }

  public async writePayload(input: {
    readonly encryptedPayloadRef: string;
    readonly serializedEnvelope: string;
  }): Promise<void> {
    const encryptedPayloadRef = normalizePayloadRef(input.encryptedPayloadRef);
    const serializedEnvelope = normalizeRequired(input.serializedEnvelope, "Secret encrypted payload serializedEnvelope");
    fs.mkdirSync(this.baseDirectory, { recursive: true });

    const payloadPath = toPayloadPath(this.baseDirectory, encryptedPayloadRef);
    const tempPath = `${payloadPath}.tmp`;
    fs.writeFileSync(tempPath, serializedEnvelope, { encoding: "utf8" });
    fs.renameSync(tempPath, payloadPath);
  }

  public async readPayload(encryptedPayloadRef: string): Promise<string | undefined> {
    const normalizedRef = normalizePayloadRef(encryptedPayloadRef);
    const payloadPath = toPayloadPath(this.baseDirectory, normalizedRef);
    if (!fs.existsSync(payloadPath)) {
      return undefined;
    }
    return fs.readFileSync(payloadPath, "utf8");
  }
}

function toPayloadPath(baseDirectory: string, encryptedPayloadRef: string): string {
  const digest = createHash("sha256").update(encryptedPayloadRef).digest("hex");
  return path.join(baseDirectory, `${digest}.json`);
}

function normalizePayloadRef(value: string): string {
  const normalized = normalizeRequired(value, "Secret encrypted payload ref");
  if (!normalized.startsWith(SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX)) {
    throw new SecretEnvelopeEncryptionError(
      `Secret encrypted payload ref '${normalized}' is invalid. Use '${SECRET_ENCRYPTED_PAYLOAD_REF_PREFIX}<id>'.`,
    );
  }
  return normalized;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new SecretEnvelopeEncryptionError(`${field} is required.`);
  }
  return normalized;
}
