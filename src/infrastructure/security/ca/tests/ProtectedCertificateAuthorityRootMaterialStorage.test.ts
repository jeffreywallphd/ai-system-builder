import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "../ProtectedCertificateAuthorityRootMaterialStorage";
import { FileSystemProtectedSecretStore } from "../../secrets/FileSystemProtectedSecretStore";
import { ScopedAesGcmEncryptionService } from "../../encryption/ScopedAesGcmEncryptionService";

describe("ProtectedCertificateAuthorityRootMaterialStorage", () => {
  it("persists and loads root materials and signing assets through protected interfaces", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-ca-root-materials-"));
    const store = new ProtectedCertificateAuthorityRootMaterialStorage(
      new FileSystemProtectedSecretStore(
        tempDirectory,
        new ScopedAesGcmEncryptionService({
          default: Buffer.alloc(32, 3).toString("base64"),
          "ca-signing": Buffer.alloc(32, 5).toString("base64"),
        }),
      ),
    );

    const persisted = await store.persistRootMaterials({
      certificateAuthorityId: "ca:internal:root:v1",
      actorUserIdentityId: "user:security-admin",
      materials: [
        {
          materialRef: "trust:ca:cert:v1",
          kind: "certificate-pem",
          plaintextValue: "-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----",
          keyScope: "default",
        },
        {
          materialRef: "trust:ca:key:v1",
          kind: "private-key-encrypted-pem",
          plaintextValue: "-----BEGIN ENCRYPTED PRIVATE KEY-----test-----END ENCRYPTED PRIVATE KEY-----",
          keyScope: "ca-signing",
        },
      ],
    });

    const loaded = await store.loadRootMaterials({
      certificateAuthorityId: "ca:internal:root:v1",
      materials: persisted.map((material) => ({
        materialRef: material.materialRef,
        kind: material.kind,
        secretRef: material.secretRef,
        keyScope: material.keyScope,
      })),
    });

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.plaintextValue).toContain("BEGIN CERTIFICATE");
    expect(loaded[1]?.plaintextValue).toContain("ENCRYPTED PRIVATE KEY");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("emits redacted logs without exposing plaintext or full secret refs", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-ca-root-materials-log-"));
    const logs: string[] = [];
    const store = new ProtectedCertificateAuthorityRootMaterialStorage(
      new FileSystemProtectedSecretStore(
        tempDirectory,
        new ScopedAesGcmEncryptionService({
          default: Buffer.alloc(32, 9).toString("base64"),
        }),
      ),
      (entry) => {
        logs.push(JSON.stringify(entry));
      },
    );

    const persisted = await store.persistRootMaterials({
      certificateAuthorityId: "ca:internal:root:v1",
      actorUserIdentityId: "user:security-admin",
      materials: [
        {
          materialRef: "trust:ca:key:v1",
          kind: "private-key-encrypted-pem",
          plaintextValue: "super-secret-private-key-material",
        },
      ],
    });

    await store.loadRootMaterials({
      certificateAuthorityId: "ca:internal:root:v1",
      materials: [
        {
          materialRef: persisted[0]!.materialRef,
          kind: persisted[0]!.kind,
          secretRef: persisted[0]!.secretRef,
          keyScope: persisted[0]!.keyScope,
        },
      ],
    });

    const combinedLogs = logs.join("\n");
    expect(combinedLogs).not.toContain("super-secret-private-key-material");
    expect(combinedLogs).not.toContain(persisted[0]!.secretRef);
    expect(combinedLogs).toContain("...");

    rmSync(tempDirectory, { recursive: true, force: true });
  });
});
