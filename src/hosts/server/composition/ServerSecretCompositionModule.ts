import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { SecretMetadataBackendApi } from "@infrastructure/api/security/SecretMetadataBackendApi";
import {
  composeBestEffortSecretAuditHooks,
  createAuthoritativeSecretAccessAuditHook,
} from "@infrastructure/audit/AuthoritativeSecretAccessAuditHook";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import {
  createFileSystemProtectedSecretStoreFromEnvironment,
  type FileSystemProtectedSecretStore,
} from "@infrastructure/security/secrets/FileSystemProtectedSecretStore";
import {
  composeServerSecretService,
  type ServerComposedSecretService,
} from "@infrastructure/security/secrets/SecretServiceComposition";
import { SecretServiceOperationalDiagnosticsProvider } from "@infrastructure/security/secrets/SecretServiceOperationalDiagnostics";
import { assertSystemSecretBootstrapSafe } from "@infrastructure/security/secrets/SystemSecretBootstrapService";

export interface ServerSecretCompositionModuleInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly workspaceRepository: AuthoritativePersistentPlatformServices["workspaceRepository"];
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly observabilityLogger?: {
    info(event: Readonly<Record<string, unknown>>): void;
    warn(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  };
  readonly legacySecretAccessAuditHook?: (event: Readonly<Record<string, unknown>>) => Promise<void> | void;
}

export interface ServerSecretCompositionModuleOutput {
  readonly protectedSecretStore: FileSystemProtectedSecretStore | undefined;
  readonly secretService: ServerComposedSecretService;
  readonly secretMetadataBackendApi: SecretMetadataBackendApi;
}

export async function composeServerSecretCompositionModule(
  input: ServerSecretCompositionModuleInput,
): Promise<ServerSecretCompositionModuleOutput> {
  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(input.env);
  const secretAuditHook = composeBestEffortSecretAuditHooks(
    input.legacySecretAccessAuditHook,
    createAuthoritativeSecretAccessAuditHook(input.authoritativeAuditRecorder),
  );
  const secretService = composeServerSecretService({
    databasePath: input.databasePath,
    env: input.env,
    observabilityLogger: input.observabilityLogger,
    auditHook: secretAuditHook,
  });

  await assertSystemSecretBootstrapSafe({
    env: input.env,
    secretService,
    auditHook: secretAuditHook,
  });

  const secretMetadataBackendApi = new SecretMetadataBackendApi({
    createSecretUseCase: secretService.createSecretUseCase,
    getSecretMetadataUseCase: secretService.getSecretMetadataUseCase,
    listSecretsUseCase: secretService.listSecretsUseCase,
    disableSecretUseCase: secretService.disableSecretUseCase,
    rotateSecretUseCase: secretService.rotateSecretUseCase,
    reEncryptSecretsUseCase: secretService.reEncryptSecretsUseCase,
    workspaceAuthorizationReadRepository: input.workspaceRepository,
    secretOperationalDiagnosticsProvider: new SecretServiceOperationalDiagnosticsProvider({
      env: input.env,
      secretService,
    }),
  });

  return Object.freeze({
    protectedSecretStore,
    secretService,
    secretMetadataBackendApi,
  });
}
