export const UnifiedApiContractHomeStatuses = Object.freeze({
  existing: "existing",
  proposed: "proposed",
} as const);

export type UnifiedApiContractHomeStatus =
  typeof UnifiedApiContractHomeStatuses[keyof typeof UnifiedApiContractHomeStatuses];

export interface UnifiedApiContractHome {
  readonly path: string;
  readonly status: UnifiedApiContractHomeStatus;
}

export interface UnifiedApiDomainConvergenceContract {
  readonly domainId: string;
  readonly targetApplicationLayer: string;
  readonly authoritativeTransport: ReadonlyArray<"https" | "wss">;
  readonly contractHomes: ReadonlyArray<UnifiedApiContractHome>;
}

export const UnifiedApiDomainConvergenceContracts: ReadonlyArray<UnifiedApiDomainConvergenceContract> = Object.freeze([
  Object.freeze({
    domainId: "identity-session",
    targetApplicationLayer: "src/infrastructure/api/identity/IdentityAuthBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/identity/IdentityTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/identity/IdentityTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "workspace-administration",
    targetApplicationLayer: "src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/workspaces/WorkspaceTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "authorization",
    targetApplicationLayer: "src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/authorization/AuthorizationSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "nodes",
    targetApplicationLayer: "src/infrastructure/api/nodes/NodeTrustBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/nodes/NodeTrustApiContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "storage",
    targetApplicationLayer: "src/infrastructure/api/storage/StorageManagementBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/storage/StorageTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/storage/StorageTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "assets",
    targetApplicationLayer: "src/infrastructure/api/assets/AssetManagementBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/assets/AssetTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/contracts/assets/AssetWorkflowClientContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "security-metadata-and-certificates",
    targetApplicationLayer: "src/infrastructure/api/security/SecretMetadataBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/security/SecretTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/security/SecretApiSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "system-runtime-and-queue-control",
    targetApplicationLayer: "src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
  Object.freeze({
    domainId: "deployment-orchestration",
    targetApplicationLayer: "src/infrastructure/api/deployment/DeploymentBackendApi.ts",
    authoritativeTransport: Object.freeze(["https", "wss"]),
    contractHomes: Object.freeze([
      Object.freeze({
        path: "src/shared/contracts/deployment/DeploymentTransportContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
      Object.freeze({
        path: "src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts",
        status: UnifiedApiContractHomeStatuses.existing,
      }),
    ]),
  }),
]);
