import type {
  SystemDeploymentRevocationPort,
  SystemDeploymentRuntimePort,
} from "../../../application/ports/system-deployment";
import type { SystemDeploymentCapabilityPolicy } from "../../../contracts/system-deployment";
import type {
  SystemBuildArtifactPort,
  SystemBuildRepositoryPort,
} from "../../../application/ports/system-build";
import {
  SystemDeploymentCompatibilityService,
  SystemDeploymentPolicyService,
} from "../../../application/services/system-deployment";
import {
  ActivateSystemDeploymentUseCase,
  CancelSystemDeploymentRunUseCase,
  InstallSystemDeploymentUseCase,
  ListSystemDeploymentAuditUseCase,
  ListSystemDeploymentRunsUseCase,
  ListSystemDeploymentsUseCase,
  ReadSystemDeploymentUseCase,
  ReconcileSystemDeploymentHealthUseCase,
  RevokeSystemDeploymentUseCase,
  RollbackSystemDeploymentUseCase,
  StartSystemDeploymentRunUseCase,
} from "../../../application/use-cases/system-deployment";
import { createStructuredSystemDeploymentRepository } from "../../../adapters/persistence/system-deployment";
import type { StructuredDocumentStore } from "../../../adapters/persistence/shared";

export interface ComposeSystemDeploymentOptions {
  readonly documents: StructuredDocumentStore;
  readonly builds: SystemBuildRepositoryPort;
  readonly artifacts: SystemBuildArtifactPort;
  readonly runtime: SystemDeploymentRuntimePort;
  readonly revocations?: SystemDeploymentRevocationPort;
  readonly platformPolicy: SystemDeploymentCapabilityPolicy;
  readonly generateAuditId: () => string;
  readonly now?: () => string;
}

export function createDefaultSystemDeploymentPolicy(): SystemDeploymentCapabilityPolicy {
  return {
    allowedCapabilities: [],
    allowedSecretReferences: [],
    egress: { mode: "deny-all", allowedOrigins: [] },
    quotas: {
      maximumRunSeconds: 300,
      maximumMemoryMiB: 512,
      maximumOutputBytes: 1024 * 1024,
      maximumConcurrentRuns: 4,
    },
  };
}

export function composeSystemDeployment(
  options: ComposeSystemDeploymentOptions,
) {
  const repository = createStructuredSystemDeploymentRepository(
    options.documents,
  );
  const policy = new SystemDeploymentPolicyService();
  const compatibility = new SystemDeploymentCompatibilityService(
    options.runtime,
  );
  const revocations: SystemDeploymentRevocationPort = options.revocations ?? {
    async listRevokedImplementationReleaseIds() {
      return [];
    },
  };
  const dependencies = {
    repository,
    builds: options.builds,
    artifacts: options.artifacts,
    runtime: options.runtime,
    revocations,
    compatibility,
    policy,
    platformPolicy: options.platformPolicy,
    generateAuditId: options.generateAuditId,
    now: options.now,
  };
  return {
    repository,
    runtime: options.runtime,
    policy,
    compatibility,
    useCases: {
      install: new InstallSystemDeploymentUseCase(dependencies),
      activate: new ActivateSystemDeploymentUseCase(dependencies),
      health: new ReconcileSystemDeploymentHealthUseCase(dependencies),
      rollback: new RollbackSystemDeploymentUseCase(dependencies),
      revoke: new RevokeSystemDeploymentUseCase(dependencies),
      read: new ReadSystemDeploymentUseCase(repository),
      list: new ListSystemDeploymentsUseCase(repository),
      startRun: new StartSystemDeploymentRunUseCase(dependencies),
      cancelRun: new CancelSystemDeploymentRunUseCase(dependencies),
      listRuns: new ListSystemDeploymentRunsUseCase(repository),
      listAudit: new ListSystemDeploymentAuditUseCase(repository),
    },
  };
}

export type SystemDeploymentCompositionRoot = ReturnType<
  typeof composeSystemDeployment
>;
