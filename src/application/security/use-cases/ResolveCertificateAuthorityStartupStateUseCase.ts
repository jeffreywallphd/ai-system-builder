import { CertificateAuthorityStatuses } from "@domain/security/CertificateAuthorityDomain";
import type { CertificateAuthorityBootstrapConfiguration } from "../ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type { ICertificateAuthorityBootstrapConfigurationProvider } from "../ports/ICertificateAuthorityBootstrapConfigurationProvider";
import type {
  CertificateAuthoritySecretMetadata,
  ICertificateAuthorityBootstrapSecretService,
} from "../ports/ICertificateAuthorityBootstrapSecretService";
import type { ICertificateAuthorityRootPersistenceRepository } from "../ports/ICertificateAuthorityRootPersistenceRepository";
import type { ITrustMaterialReferencePersistenceRepository } from "../ports/ITrustMaterialReferencePersistenceRepository";

export const CertificateAuthorityStartupStates = Object.freeze({
  uninitialized: "uninitialized",
  initialized: "initialized",
  invalid: "invalid",
  revoked: "revoked",
  migrationRequired: "migration-required",
});

export type CertificateAuthorityStartupState =
  typeof CertificateAuthorityStartupStates[keyof typeof CertificateAuthorityStartupStates];

export const CertificateAuthorityStartupDiagnosticCodes = Object.freeze({
  bootstrapConfigMissing: "bootstrap-config-missing",
  bootstrapConfigIncomplete: "bootstrap-config-incomplete",
  bootstrapConfigOrphaned: "bootstrap-config-orphaned",
  authorityMissing: "authority-missing",
  authorityMaterialRefMismatch: "authority-material-ref-mismatch",
  authoritySecretMissing: "authority-secret-missing",
  authorityTrustMaterialMissing: "authority-trust-material-missing",
  authorityTrustMaterialKindMismatch: "authority-trust-material-kind-mismatch",
  authoritySecretSourceUnavailable: "authority-secret-source-unavailable",
  authorityCompromised: "authority-compromised",
  authorityRetired: "authority-retired",
  authorityConfigurationMismatch: "authority-configuration-mismatch",
});

export type CertificateAuthorityStartupDiagnosticCode =
  typeof CertificateAuthorityStartupDiagnosticCodes[keyof typeof CertificateAuthorityStartupDiagnosticCodes];

export interface CertificateAuthorityStartupDiagnostic {
  readonly code: CertificateAuthorityStartupDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly source?: string;
}

export interface ResolveCertificateAuthorityStartupStateResult {
  readonly state: CertificateAuthorityStartupState;
  readonly diagnostics: ReadonlyArray<CertificateAuthorityStartupDiagnostic>;
  readonly certificateAuthorityId?: string;
  readonly configurationSource: string;
}

export interface ResolveCertificateAuthorityStartupStateUseCaseDependencies {
  readonly configurationProvider: ICertificateAuthorityBootstrapConfigurationProvider;
  readonly secretService: ICertificateAuthorityBootstrapSecretService;
  readonly certificateAuthorityRepository: ICertificateAuthorityRootPersistenceRepository;
  readonly trustMaterialRepository: ITrustMaterialReferencePersistenceRepository;
}

interface NormalizedBootstrapConfiguration {
  readonly certificateAuthorityId?: string;
  readonly rootCertificateMaterialRef?: string;
  readonly rootPrivateKeyMaterialRef?: string;
  readonly rootCertificateSecretRef?: string;
  readonly rootPrivateKeySecretRef?: string;
  readonly source: string;
}

export class ResolveCertificateAuthorityStartupStateUseCase {
  public constructor(private readonly dependencies: ResolveCertificateAuthorityStartupStateUseCaseDependencies) {}

  public async execute(): Promise<ResolveCertificateAuthorityStartupStateResult> {
    const configuration = normalizeBootstrapConfiguration(await this.dependencies.configurationProvider.loadConfiguration());
    const diagnostics: CertificateAuthorityStartupDiagnostic[] = [];
    const missingFields = listMissingConfigurationFields(configuration);
    const hasAnyConfiguration = hasAnyConfiguredValue(configuration);
    const hasCompleteConfiguration = missingFields.length === 0;

    const authorities = await this.dependencies.certificateAuthorityRepository.listCertificateAuthorities({
      includeRetired: true,
      includeCompromised: true,
      limit: 20,
    });
    const hasPersistedAuthorities = authorities.length > 0;

    if (!configuration.certificateAuthorityId) {
      if (!hasAnyConfiguration) {
        if (hasPersistedAuthorities) {
          diagnostics.push(createDiagnostic({
            code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigMissing,
            source: configuration.source,
            message: "Internal CA exists in persistence but bootstrap configuration is missing.",
          }));
          return toResult(CertificateAuthorityStartupStates.migrationRequired, configuration.source, diagnostics);
        }

        diagnostics.push(createDiagnostic({
          code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigMissing,
          source: configuration.source,
          message: "Internal CA bootstrap configuration is absent; host is in uninitialized state.",
        }));
        return toResult(CertificateAuthorityStartupStates.uninitialized, configuration.source, diagnostics);
      }

      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigIncomplete,
        source: configuration.source,
        message: "Internal CA bootstrap configuration is partially provided and cannot be trusted.",
      }));
      for (const field of missingFields) {
        diagnostics.push(createDiagnostic({
          code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigIncomplete,
          field,
          source: configuration.source,
          message: `Bootstrap configuration field '${field}' is required.`,
        }));
      }
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics);
    }

    if (!hasCompleteConfiguration) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigIncomplete,
        source: configuration.source,
        message: "Internal CA bootstrap configuration is incomplete.",
      }));
      for (const field of missingFields) {
        diagnostics.push(createDiagnostic({
          code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigIncomplete,
          field,
          source: configuration.source,
          message: `Bootstrap configuration field '${field}' is required.`,
        }));
      }
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, configuration.certificateAuthorityId);
    }

    let rootCertificateSecret: CertificateAuthoritySecretMetadata;
    let rootPrivateKeySecret: CertificateAuthoritySecretMetadata;
    try {
      rootCertificateSecret = await this.dependencies.secretService.getSecretMetadata(
        configuration.rootCertificateSecretRef as string,
      );
      rootPrivateKeySecret = await this.dependencies.secretService.getSecretMetadata(
        configuration.rootPrivateKeySecretRef as string,
      );
    } catch (error) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authoritySecretSourceUnavailable,
        source: "secret",
        message: `Root CA secret source is unavailable: ${toErrorMessage(error)}`,
      }));
      return toResult(
        CertificateAuthorityStartupStates.invalid,
        configuration.source,
        diagnostics,
        configuration.certificateAuthorityId,
      );
    }

    const authority = await this.dependencies.certificateAuthorityRepository.findCertificateAuthorityById(
      configuration.certificateAuthorityId,
    );

    if (!authority) {
      const anySecretExists = rootCertificateSecret.exists || rootPrivateKeySecret.exists;
      if (anySecretExists || hasPersistedAuthorities) {
        diagnostics.push(createDiagnostic({
          code: CertificateAuthorityStartupDiagnosticCodes.bootstrapConfigOrphaned,
          source: configuration.source,
          message: "Bootstrap configuration references CA material that does not match persisted authority metadata.",
        }));
        diagnostics.push(createDiagnostic({
          code: CertificateAuthorityStartupDiagnosticCodes.authorityMissing,
          source: "persistence",
          message: `Persisted certificate authority '${configuration.certificateAuthorityId}' was not found.`,
        }));
        return toResult(CertificateAuthorityStartupStates.migrationRequired, configuration.source, diagnostics, configuration.certificateAuthorityId);
      }

      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityMissing,
        source: "persistence",
        message: `Certificate authority '${configuration.certificateAuthorityId}' is not initialized yet.`,
      }));
      return toResult(CertificateAuthorityStartupStates.uninitialized, configuration.source, diagnostics, configuration.certificateAuthorityId);
    }

    if (authority.status === CertificateAuthorityStatuses.compromised) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityCompromised,
        source: "persistence",
        message: `Certificate authority '${authority.certificateAuthorityId}' is compromised and cannot be used.`,
      }));
      return toResult(CertificateAuthorityStartupStates.revoked, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    if (authority.status === CertificateAuthorityStatuses.retired) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityRetired,
        source: "persistence",
        message: `Certificate authority '${authority.certificateAuthorityId}' is retired and requires migration.`,
      }));
      return toResult(
        CertificateAuthorityStartupStates.migrationRequired,
        configuration.source,
        diagnostics,
        authority.certificateAuthorityId,
      );
    }

    if (
      authority.rootCertificateMaterialRef !== configuration.rootCertificateMaterialRef
      || authority.rootPrivateKeyMaterialRef !== configuration.rootPrivateKeyMaterialRef
    ) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityMaterialRefMismatch,
        source: "persistence",
        message: "Persisted CA root material references do not match bootstrap configuration references.",
      }));
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    const rootCertificateTrustMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      configuration.rootCertificateMaterialRef as string,
    );
    const rootPrivateKeyTrustMaterial = await this.dependencies.trustMaterialRepository.findTrustMaterialByRef(
      configuration.rootPrivateKeyMaterialRef as string,
    );

    if (!rootCertificateTrustMaterial || !rootPrivateKeyTrustMaterial) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityTrustMaterialMissing,
        source: "persistence",
        message: "Persisted trust material metadata for root certificate/key is incomplete.",
      }));
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    if (rootCertificateTrustMaterial.kind !== "certificate-pem" || rootPrivateKeyTrustMaterial.kind !== "private-key-encrypted-pem") {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityTrustMaterialKindMismatch,
        source: "persistence",
        message: "Persisted trust material kind for CA root assets is invalid.",
      }));
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    if (!rootCertificateSecret.exists || !rootPrivateKeySecret.exists) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authoritySecretMissing,
        source: "secret",
        message: "Root CA secret material is missing from the configured secret source.",
      }));
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    if (
      rootCertificateTrustMaterial.storageLocator !== configuration.rootCertificateSecretRef
      || rootPrivateKeyTrustMaterial.storageLocator !== configuration.rootPrivateKeySecretRef
    ) {
      diagnostics.push(createDiagnostic({
        code: CertificateAuthorityStartupDiagnosticCodes.authorityConfigurationMismatch,
        source: "persistence",
        message: "Persisted trust material locators are not aligned with configured CA secret references.",
      }));
      return toResult(CertificateAuthorityStartupStates.invalid, configuration.source, diagnostics, authority.certificateAuthorityId);
    }

    return toResult(
      CertificateAuthorityStartupStates.initialized,
      configuration.source,
      diagnostics,
      authority.certificateAuthorityId,
    );
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "unknown secret source failure";
}

export class CertificateAuthorityStartupValidationError extends Error {
  public constructor(
    message: string,
    public readonly state: CertificateAuthorityStartupState,
    public readonly diagnostics: ReadonlyArray<CertificateAuthorityStartupDiagnostic>,
  ) {
    super(message);
    this.name = "CertificateAuthorityStartupValidationError";
  }
}

export function assertCertificateAuthorityStartupSafe(
  result: ResolveCertificateAuthorityStartupStateResult,
): void {
  if (
    result.state === CertificateAuthorityStartupStates.invalid
    || result.state === CertificateAuthorityStartupStates.revoked
    || result.state === CertificateAuthorityStartupStates.migrationRequired
  ) {
    throw new CertificateAuthorityStartupValidationError(
      `Internal CA startup validation failed with state '${result.state}'.`,
      result.state,
      result.diagnostics,
    );
  }
}

function normalizeBootstrapConfiguration(
  configuration: CertificateAuthorityBootstrapConfiguration,
): NormalizedBootstrapConfiguration {
  return Object.freeze({
    certificateAuthorityId: normalizeOptional(configuration.certificateAuthorityId),
    rootCertificateMaterialRef: normalizeOptional(configuration.rootCertificateMaterialRef),
    rootPrivateKeyMaterialRef: normalizeOptional(configuration.rootPrivateKeyMaterialRef),
    rootCertificateSecretRef: normalizeOptional(configuration.rootCertificateSecretRef),
    rootPrivateKeySecretRef: normalizeOptional(configuration.rootPrivateKeySecretRef),
    source: normalizeOptional(configuration.source) ?? "unknown",
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hasAnyConfiguredValue(configuration: NormalizedBootstrapConfiguration): boolean {
  return Boolean(
    configuration.certificateAuthorityId
      || configuration.rootCertificateMaterialRef
      || configuration.rootPrivateKeyMaterialRef
      || configuration.rootCertificateSecretRef
      || configuration.rootPrivateKeySecretRef,
  );
}

function listMissingConfigurationFields(configuration: NormalizedBootstrapConfiguration): ReadonlyArray<string> {
  const missing: string[] = [];
  if (!configuration.certificateAuthorityId) {
    missing.push("certificateAuthorityId");
  }
  if (!configuration.rootCertificateMaterialRef) {
    missing.push("rootCertificateMaterialRef");
  }
  if (!configuration.rootPrivateKeyMaterialRef) {
    missing.push("rootPrivateKeyMaterialRef");
  }
  if (!configuration.rootCertificateSecretRef) {
    missing.push("rootCertificateSecretRef");
  }
  if (!configuration.rootPrivateKeySecretRef) {
    missing.push("rootPrivateKeySecretRef");
  }
  return Object.freeze(missing);
}

function createDiagnostic(input: {
  readonly code: CertificateAuthorityStartupDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly source?: string;
}): CertificateAuthorityStartupDiagnostic {
  return Object.freeze({
    code: input.code,
    message: input.message,
    field: input.field,
    source: input.source,
  });
}

function toResult(
  state: CertificateAuthorityStartupState,
  configurationSource: string,
  diagnostics: ReadonlyArray<CertificateAuthorityStartupDiagnostic>,
  certificateAuthorityId?: string,
): ResolveCertificateAuthorityStartupStateResult {
  return Object.freeze({
    state,
    diagnostics: Object.freeze([...diagnostics]),
    certificateAuthorityId,
    configurationSource,
  });
}

