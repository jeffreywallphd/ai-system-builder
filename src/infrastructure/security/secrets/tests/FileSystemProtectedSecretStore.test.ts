import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FileSystemProtectedSecretStore,
  createFileSystemProtectedSecretStoreFromEnvironment,
  redactSecretRef,
} from "../FileSystemProtectedSecretStore";
import { ScopedAesGcmEncryptionService } from "../../encryption/ScopedAesGcmEncryptionService";

describe("FileSystemProtectedSecretStore", () => {
  it("persists and loads protected secrets with encryption at rest", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-ca-protected-secrets-"));
    const store = new FileSystemProtectedSecretStore(
      tempDirectory,
      new ScopedAesGcmEncryptionService({
        default: Buffer.alloc(32, 7).toString("base64"),
      }),
    );

    const metadata = await store.saveSecret({
      secretRef: "secret-store:internal-ca:root-key",
      plaintextValue: "-----BEGIN ENCRYPTED PRIVATE KEY-----test-----END ENCRYPTED PRIVATE KEY-----",
      keyScope: "default",
    });

    const loaded = await store.loadSecret({
      secretRef: metadata.secretRef,
      expectedKeyScope: "default",
    });

    expect(loaded).toContain("BEGIN ENCRYPTED PRIVATE KEY");
    expect(metadata.secretRefRedacted).not.toContain("PRIVATE KEY");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when protected storage environment configuration is partial", async () => {
    expect(() => createFileSystemProtectedSecretStoreFromEnvironment({
      AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY: "C:/tmp/ca-secrets",
    })).toThrow("key is required");

    expect(() => createFileSystemProtectedSecretStoreFromEnvironment({
      AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY: Buffer.alloc(32, 1).toString("base64"),
    })).toThrow("directory is required");
  });

  it("redacts secret references for logs and diagnostics", () => {
    const redacted = redactSecretRef("secret-store:internal-ca:ca:internal:root:v1:private-key");
    expect(redacted).toContain("...");
    expect(redacted).not.toContain("private-key");
  });
});
