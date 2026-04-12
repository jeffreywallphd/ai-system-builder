import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { IdentityPolicyService } from "@application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "@application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService, type IdentitySessionLifecyclePolicies } from "@application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "@application/identity/services/IdentityAuthenticatedSessionService";
import { TrustedDeviceManagementService } from "@application/identity/services/TrustedDeviceManagementService";
import { TrustedDevicePairingService } from "@application/identity/services/TrustedDevicePairingService";
import { TrustedDeviceSessionTrustService, type TrustedDeviceSessionTrustPolicies } from "@application/identity/services/TrustedDeviceSessionTrustService";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "@application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import { RegisterLocalAccountUseCase } from "@application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "@application/identity/use-cases/LoginLocalAccountUseCase";
import { ChangeLocalPasswordCredentialUseCase } from "@application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import { LogoutIdentitySessionUseCase } from "@application/identity/use-cases/LogoutIdentitySessionUseCase";
import { RevokeIdentitySessionUseCase } from "@application/identity/use-cases/RevokeIdentitySessionUseCase";
import { ListLocalIdentityAccountsUseCase } from "@application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import { GetLocalIdentityAccountStatusUseCase } from "@application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import { SetLocalIdentityAccountStatusUseCase } from "@application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import { ListTrustedDevicesUseCase } from "@application/identity/use-cases/ListTrustedDevicesUseCase";
import { GetTrustedDeviceUseCase } from "@application/identity/use-cases/GetTrustedDeviceUseCase";
import { RevokeTrustedDeviceUseCase } from "@application/identity/use-cases/RevokeTrustedDeviceUseCase";
import { UpdateTrustedDeviceDisplayNameUseCase } from "@application/identity/use-cases/UpdateTrustedDeviceDisplayNameUseCase";
import { InitiateTrustedDevicePairingUseCase } from "@application/identity/use-cases/InitiateTrustedDevicePairingUseCase";
import { ValidateTrustedDevicePairingUseCase } from "@application/identity/use-cases/ValidateTrustedDevicePairingUseCase";
import { CompleteTrustedDevicePairingUseCase } from "@application/identity/use-cases/CompleteTrustedDevicePairingUseCase";
import { AuthoritativeIdentityLifecycleEventPublisher } from "@infrastructure/audit/AuthoritativeIdentityLifecycleEventPublisher";
import { FanoutIdentityLifecycleEventPublisher } from "@infrastructure/audit/AuditFanoutPublishers";
import { IdentityAuthBackendApi } from "@infrastructure/api/identity/IdentityAuthBackendApi";
import { IdentityProviderAccountPolicyConfig } from "@infrastructure/config/IdentityProviderAccountPolicyConfig";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { SqliteIdentityLifecycleEventPublisher } from "@infrastructure/persistence/identity/SqliteIdentityLifecycleEventPublisher";
import { OpaqueIdentitySessionTokenService } from "@infrastructure/security/identity/OpaqueIdentitySessionTokenService";

export interface ServerIdentitySessionTrustedDeviceCompositionModuleInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly identityRepository: AuthoritativePersistentPlatformServices["identityRepository"];
  readonly trustedDeviceRepository: AuthoritativePersistentPlatformServices["trustedDeviceRepository"];
  readonly identityPolicyService: IdentityPolicyService;
  readonly credentialAuthenticator: LocalPasswordIdentityAuthenticator;
  readonly idGenerator: IIdentityIdGenerator;
  readonly clock: IIdentityClock;
  readonly sessionPolicies: IdentitySessionLifecyclePolicies;
  readonly sessionTrustPolicies: TrustedDeviceSessionTrustPolicies;
  readonly providerAccountPolicies: IdentityProviderAccountPolicyConfig;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly eventPublisherOverride?: IIdentityLifecycleEventPublisher;
}

export interface ServerIdentitySessionTrustedDeviceCompositionModuleOutput {
  readonly backendApi: IdentityAuthBackendApi;
  readonly trustedDeviceManagementService: TrustedDeviceManagementService;
  dispose(): void;
}

export function composeServerIdentitySessionTrustedDeviceCompositionModule(
  input: ServerIdentitySessionTrustedDeviceCompositionModuleInput,
): ServerIdentitySessionTrustedDeviceCompositionModuleOutput {
  const baseIdentityLifecyclePublisher = input.eventPublisherOverride
    ?? new SqliteIdentityLifecycleEventPublisher(input.databasePath);
  const eventPublisher = new FanoutIdentityLifecycleEventPublisher([
    baseIdentityLifecyclePublisher,
    new AuthoritativeIdentityLifecycleEventPublisher(input.authoritativeAuditRecorder),
  ]);

  const sessionTrustService = new TrustedDeviceSessionTrustService({
    trustedDeviceRepository: input.trustedDeviceRepository,
    policies: input.sessionTrustPolicies,
  });
  const trustedDeviceAdminUserIdentityIds = parseOptionalCsvList(input.env.IDENTITY_TRUSTED_DEVICE_ADMIN_USER_IDS);
  const trustedDeviceManagementService = new TrustedDeviceManagementService(
    input.trustedDeviceRepository,
    input.idGenerator,
    input.clock,
    eventPublisher,
  );
  const trustedDevicePairingService = new TrustedDevicePairingService({
    trustedDeviceRepository: input.trustedDeviceRepository,
    pairingRepository: input.trustedDeviceRepository,
    idGenerator: input.idGenerator,
    clock: input.clock,
    eventPublisher,
  });
  const sessionLifecycleService = new IdentitySessionLifecycleService({
    sessionRepository: input.identityRepository,
    clock: input.clock,
    idGenerator: input.idGenerator,
    policies: input.sessionPolicies,
  });
  const authenticatedSessionService = new IdentityAuthenticatedSessionService({
    lifecycleService: sessionLifecycleService,
    sessionRepository: input.identityRepository,
    tokenMaterialRepository: input.identityRepository,
    tokenService: new OpaqueIdentitySessionTokenService(),
    clock: input.clock,
    sessionTrustEvaluator: sessionTrustService,
    eventPublisher,
  });

  const backendApi = new IdentityAuthBackendApi({
    registerLocalAccountUseCase: new RegisterLocalAccountUseCase({
      lookupRepository: input.identityRepository,
      persistenceRepository: input.identityRepository,
      credentialMaterialRepository: input.identityRepository,
      identityPolicyService: input.identityPolicyService,
      credentialAuthenticator: input.credentialAuthenticator,
      idGenerator: input.idGenerator,
      clock: input.clock,
      eventPublisher,
    }),
    loginLocalAccountUseCase: new LoginLocalAccountUseCase({
      lookupRepository: input.identityRepository,
      credentialMaterialRepository: input.identityRepository,
      identityPolicyService: input.identityPolicyService,
      credentialAuthenticator: input.credentialAuthenticator,
      clock: input.clock,
      eventPublisher,
    }),
    changeLocalPasswordCredentialUseCase: new ChangeLocalPasswordCredentialUseCase({
      lookupRepository: input.identityRepository,
      persistenceRepository: input.identityRepository,
      credentialMaterialRepository: input.identityRepository,
      transactionManager: input.identityRepository,
      identityPolicyService: input.identityPolicyService,
      credentialAuthenticator: input.credentialAuthenticator,
      idGenerator: input.idGenerator,
      clock: input.clock,
      eventPublisher,
    }),
    logoutIdentitySessionUseCase: new LogoutIdentitySessionUseCase({
      authenticatedSessionService,
      eventPublisher,
    }),
    revokeIdentitySessionUseCase: new RevokeIdentitySessionUseCase({
      sessionRepository: input.identityRepository,
      authenticatedSessionService,
    }),
    listLocalIdentityAccountsUseCase: new ListLocalIdentityAccountsUseCase({
      lookupRepository: input.identityRepository,
      sessionRepository: input.identityRepository,
    }),
    getLocalIdentityAccountStatusUseCase: new GetLocalIdentityAccountStatusUseCase({
      lookupRepository: input.identityRepository,
      sessionRepository: input.identityRepository,
    }),
    setLocalIdentityAccountStatusUseCase: new SetLocalIdentityAccountStatusUseCase({
      lookupRepository: input.identityRepository,
      persistenceRepository: input.identityRepository,
      sessionRepository: input.identityRepository,
      authenticatedSessionService,
      clock: input.clock,
      eventPublisher,
    }),
    listTrustedDevicesUseCase: new ListTrustedDevicesUseCase({
      trustedDeviceManagementService,
    }),
    getTrustedDeviceUseCase: new GetTrustedDeviceUseCase({
      trustedDeviceManagementService,
    }),
    revokeTrustedDeviceUseCase: new RevokeTrustedDeviceUseCase({
      trustedDeviceManagementService,
    }),
    updateTrustedDeviceDisplayNameUseCase: new UpdateTrustedDeviceDisplayNameUseCase({
      trustedDeviceManagementService,
    }),
    initiateTrustedDevicePairingUseCase: new InitiateTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    validateTrustedDevicePairingUseCase: new ValidateTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    completeTrustedDevicePairingUseCase: new CompleteTrustedDevicePairingUseCase({
      pairingService: trustedDevicePairingService,
    }),
    identityLookupRepository: input.identityRepository,
    sessionRepository: input.identityRepository,
    authenticatedSessionService,
    sessionTrustService,
    featurePolicies: {
      allowLocalRegistration: input.providerAccountPolicies.allowLocalRegistration,
      allowLocalAdministration: input.providerAccountPolicies.allowLocalAdministration,
    },
    trustedDeviceAdministration: {
      bootstrapAdminUserIdentityIds: trustedDeviceAdminUserIdentityIds,
    },
  });

  return Object.freeze({
    backendApi,
    trustedDeviceManagementService,
    dispose: () => {
      const disposablePublisher = eventPublisher as Partial<{ dispose: () => void }>;
      if (typeof disposablePublisher.dispose === "function") {
        disposablePublisher.dispose();
      }
    },
  });
}

function parseOptionalCsvList(raw: string | undefined): ReadonlyArray<string> | undefined {
  if (!raw) {
    return undefined;
  }
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (values.length < 1) {
    return undefined;
  }
  return Object.freeze([...new Set(values)]);
}
