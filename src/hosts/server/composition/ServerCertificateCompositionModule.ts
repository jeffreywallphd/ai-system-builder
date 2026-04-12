import {
  assertCertificateAuthorityStartupSafe,
  ResolveCertificateAuthorityStartupStateUseCase,
} from "@application/security/use-cases/ResolveCertificateAuthorityStartupStateUseCase";
import { GetCertificateAuthorityStatusIntrospectionUseCase } from "@application/security/use-cases/GetCertificateAuthorityStatusIntrospectionUseCase";
import { ListIssuedCertificateMetadataUseCase } from "@application/security/use-cases/ListIssuedCertificateMetadataUseCase";
import { GetIssuedCertificateMetadataUseCase } from "@application/security/use-cases/GetIssuedCertificateMetadataUseCase";
import { RevokeIssuedCertificateUseCase } from "@application/security/use-cases/RevokeIssuedCertificateUseCase";
import { RenewIssuedCertificateUseCase } from "@application/security/use-cases/RenewIssuedCertificateUseCase";
import { ResolveRuntimeTrustMaterialPackageUseCase } from "@application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";
import { ResolveApprovedNodeCertificateEligibilityUseCase } from "@application/nodes/use-cases/ResolveApprovedNodeCertificateEligibilityUseCase";
import { CertificateOperationsBackendApi } from "@infrastructure/api/security/CertificateOperationsBackendApi";
import {
  EnvironmentCertificateAuthorityBootstrapConfigurationProvider,
  EnvironmentCertificateAuthoritySecretService,
} from "@infrastructure/security/InternalCertificateAuthorityBootstrapEnvironmentAdapter";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "@infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import { InternalCertificateAuthorityIssuer } from "@infrastructure/security/ca/InternalCertificateAuthorityIssuer";
import { RuntimeTrustMaterialDistributionService } from "@infrastructure/security/certificates/RuntimeTrustMaterialDistributionService";
import type { SqliteCertificateAuthorityPersistenceAdapter } from "@infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import type { SqliteNodeTrustPersistenceAdapter } from "@infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import type { FileSystemProtectedSecretStore } from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";

export interface ServerCertificateCompositionModuleInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly nodeTrustRepository: SqliteNodeTrustPersistenceAdapter;
  readonly protectedSecretStore: FileSystemProtectedSecretStore | undefined;
}

export interface ServerCertificateCompositionModuleOutput {
  readonly startupStateResolver: ResolveCertificateAuthorityStartupStateUseCase;
  readonly runtimeTrustMaterialResolver: ResolveRuntimeTrustMaterialPackageUseCase | undefined;
  readonly certificateOperationsBackendApi: CertificateOperationsBackendApi;
}

export async function composeServerCertificateCompositionModule(
  input: ServerCertificateCompositionModuleInput,
): Promise<ServerCertificateCompositionModuleOutput> {
  const startupStateResolver = new ResolveCertificateAuthorityStartupStateUseCase({
    configurationProvider: new EnvironmentCertificateAuthorityBootstrapConfigurationProvider(input.env),
    secretService: new EnvironmentCertificateAuthoritySecretService(input.env, {
      protectedSecretStore: input.protectedSecretStore,
    }),
    certificateAuthorityRepository: input.certificateAuthorityRepository,
    trustMaterialRepository: input.certificateAuthorityRepository,
  });

  const startupState = await startupStateResolver.execute();
  assertCertificateAuthorityStartupSafe(startupState);

  const certificateMaterialStorage = input.protectedSecretStore
    ? new ProtectedCertificateAuthorityRootMaterialStorage(input.protectedSecretStore)
    : undefined;
  const runtimeTrustMaterialDistributionService = certificateMaterialStorage
    ? new RuntimeTrustMaterialDistributionService({
      certificateAuthorityRepository: input.certificateAuthorityRepository,
      issuedCertificateRepository: input.certificateAuthorityRepository,
      trustMaterialReferenceRepository: input.certificateAuthorityRepository,
      certificateMaterialStorage,
      certificateLifecycleEventRepository: input.certificateAuthorityRepository,
    })
    : undefined;
  const runtimeTrustMaterialResolver = runtimeTrustMaterialDistributionService
    ? new ResolveRuntimeTrustMaterialPackageUseCase({
      trustMaterialDistributionPort: runtimeTrustMaterialDistributionService,
    })
    : undefined;

  const certificateAuthorityIssuer = certificateMaterialStorage
    ? new InternalCertificateAuthorityIssuer({
      certificateAuthorityRepository: input.certificateAuthorityRepository,
      trustMaterialRepository: input.certificateAuthorityRepository,
      rootMaterialStorage: certificateMaterialStorage,
    })
    : undefined;

  const nodeCertificateEligibilityPort = new ResolveApprovedNodeCertificateEligibilityUseCase({
    nodeRepository: input.nodeTrustRepository,
    enrollmentRequestRepository: input.nodeTrustRepository,
  });

  const renewIssuedCertificateUseCase = certificateMaterialStorage && certificateAuthorityIssuer
    ? new RenewIssuedCertificateUseCase({
      certificateAuthorityRepository: input.certificateAuthorityRepository,
      issuedCertificateRepository: input.certificateAuthorityRepository,
      trustMaterialRepository: input.certificateAuthorityRepository,
      certificateMaterialStorage,
      issuer: certificateAuthorityIssuer,
      nodeCertificateEligibilityPort,
    })
    : {
      execute: async () => {
        throw new Error("Certificate renewal is unavailable because protected secret storage is not configured.");
      },
    } as RenewIssuedCertificateUseCase;

  const certificateOperationsBackendApi = new CertificateOperationsBackendApi({
    getCertificateAuthorityStatusIntrospectionUseCase: new GetCertificateAuthorityStatusIntrospectionUseCase({
      startupStateResolver,
      certificateAuthorityRepository: input.certificateAuthorityRepository,
      issuedCertificateRepository: input.certificateAuthorityRepository,
      certificateLifecycleEventRepository: input.certificateAuthorityRepository,
    }),
    listIssuedCertificateMetadataUseCase: new ListIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: input.certificateAuthorityRepository,
    }),
    getIssuedCertificateMetadataUseCase: new GetIssuedCertificateMetadataUseCase({
      issuedCertificateRepository: input.certificateAuthorityRepository,
    }),
    revokeIssuedCertificateUseCase: new RevokeIssuedCertificateUseCase({
      issuedCertificateRepository: input.certificateAuthorityRepository,
      certificateLifecycleEventRepository: input.certificateAuthorityRepository,
    }),
    renewIssuedCertificateUseCase,
  });

  return Object.freeze({
    startupStateResolver,
    runtimeTrustMaterialResolver,
    certificateOperationsBackendApi,
  });
}
