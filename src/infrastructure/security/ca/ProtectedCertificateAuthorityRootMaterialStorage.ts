import type {
  CertificateAuthorityProtectedMaterialDescriptor,
  ICertificateAuthorityRootMaterialStorage,
  LoadCertificateAuthorityRootMaterialsInput,
  LoadedCertificateAuthorityProtectedMaterial,
  PersistCertificateAuthorityRootMaterialsInput,
} from "../../../application/security/ports/ICertificateAuthorityRootMaterialStorage";
import {
  FileSystemProtectedSecretStore,
  INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX,
  redactSecretRef,
} from "../secrets/FileSystemProtectedSecretStore";

export interface CertificateAuthorityProtectedStorageLogEntry {
  readonly event: "ca-root-material-persisted" | "ca-root-material-loaded";
  readonly certificateAuthorityId: string;
  readonly materialRef: string;
  readonly kind: string;
  readonly secretRefRedacted: string;
  readonly keyScope: string;
}

export class ProtectedCertificateAuthorityRootMaterialStorage implements ICertificateAuthorityRootMaterialStorage {
  public constructor(
    private readonly protectedSecretStore: FileSystemProtectedSecretStore,
    private readonly logSink?: (entry: CertificateAuthorityProtectedStorageLogEntry) => void,
  ) {}

  public async persistRootMaterials(
    input: PersistCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<CertificateAuthorityProtectedMaterialDescriptor>> {
    const certificateAuthorityId = normalizeRequired(
      input.certificateAuthorityId,
      "Certificate authority id",
    );

    if (input.materials.length === 0) {
      throw new Error("At least one certificate authority root material is required.");
    }

    const outputs: CertificateAuthorityProtectedMaterialDescriptor[] = [];
    for (const material of input.materials) {
      const materialRef = normalizeRequired(material.materialRef, "Certificate authority materialRef");
      const kind = normalizeRequired(material.kind, "Certificate authority material kind") as typeof material.kind;
      const keyScope = normalizeOptional(material.keyScope) ?? "default";
      const secretRef = normalizeOptional(material.secretRef)
        ?? toDefaultSecretRef(certificateAuthorityId, materialRef, kind);

      const metadata = await this.protectedSecretStore.saveSecret({
        secretRef,
        plaintextValue: material.plaintextValue,
        keyScope,
      });

      const descriptor = Object.freeze({
        materialRef,
        kind,
        secretRef: metadata.secretRef,
        secretRefRedacted: metadata.secretRefRedacted,
        keyScope,
        source: metadata.source,
      });
      outputs.push(descriptor);
      this.logSink?.(Object.freeze({
        event: "ca-root-material-persisted",
        certificateAuthorityId,
        materialRef,
        kind,
        secretRefRedacted: metadata.secretRefRedacted,
        keyScope,
      }));
    }

    return Object.freeze(outputs);
  }

  public async loadRootMaterials(
    input: LoadCertificateAuthorityRootMaterialsInput,
  ): Promise<ReadonlyArray<LoadedCertificateAuthorityProtectedMaterial>> {
    const certificateAuthorityId = normalizeRequired(
      input.certificateAuthorityId,
      "Certificate authority id",
    );

    const outputs: LoadedCertificateAuthorityProtectedMaterial[] = [];
    for (const material of input.materials) {
      const materialRef = normalizeRequired(material.materialRef, "Certificate authority materialRef");
      const kind = normalizeRequired(material.kind, "Certificate authority material kind") as typeof material.kind;
      const keyScope = normalizeOptional(material.keyScope) ?? "default";
      const secretRef = normalizeRequired(material.secretRef, "Certificate authority secretRef");
      const plaintextValue = await this.protectedSecretStore.loadSecret({
        secretRef,
        expectedKeyScope: keyScope,
      });

      outputs.push(Object.freeze({
        materialRef,
        kind,
        plaintextValue,
      }));

      this.logSink?.(Object.freeze({
        event: "ca-root-material-loaded",
        certificateAuthorityId,
        materialRef,
        kind,
        secretRefRedacted: redactSecretRef(secretRef),
        keyScope,
      }));
    }

    return Object.freeze(outputs);
  }
}

function toDefaultSecretRef(certificateAuthorityId: string, materialRef: string, kind: string): string {
  const encoded = encodeURIComponent(`${certificateAuthorityId}:${kind}:${materialRef}`);
  return `${INTERNAL_CA_PROTECTED_SECRET_REF_PREFIX}internal-ca:${encoded}`;
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
