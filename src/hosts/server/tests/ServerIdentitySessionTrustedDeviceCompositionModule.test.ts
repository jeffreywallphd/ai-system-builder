import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import type { IdentityIdNamespace } from "@application/contracts/IdentityApplicationContracts";
import { IdentityPolicyService } from "@application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "@application/identity/services/LocalPasswordIdentityAuthenticator";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "@application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import type { IdentityLifecycleEvent } from "@application/contracts/IdentityLifecycleEventContracts";
import { IdentitySessionPolicyConfig } from "@infrastructure/config/IdentitySessionPolicyConfig";
import { IdentitySessionTrustPolicyConfig } from "@infrastructure/config/IdentitySessionTrustPolicyConfig";
import { IdentityProviderAccountPolicyConfig } from "@infrastructure/config/IdentityProviderAccountPolicyConfig";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { ScryptLocalPasswordCredentialService } from "@infrastructure/security/identity/ScryptLocalPasswordCredentialService";
import { composeServerIdentitySessionTrustedDeviceCompositionModule } from "../composition/ServerIdentitySessionTrustedDeviceCompositionModule";

class FixedIdentityClock implements IIdentityClock {
  public now(): Date {
    return new Date("2026-04-12T00:00:00.000Z");
  }
}

class FixedIdentityIdGenerator implements IIdentityIdGenerator {
  public nextId(namespace: IdentityIdNamespace): string {
    return `${namespace}:test`;
  }
}

class CapturingLifecyclePublisher implements IIdentityLifecycleEventPublisher {
  public disposed = false;

  public async publish(_event: IdentityLifecycleEvent): Promise<void> {}

  public dispose(): void {
    this.disposed = true;
  }
}

describe("ServerIdentitySessionTrustedDeviceCompositionModule", () => {
  it("composes identity/session/trusted-device dependencies and supports lifecycle disposal", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-composition-module-"));
    const databasePath = join(tempDirectory, "identity-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({
      databasePath,
    });
    const lifecyclePublisher = new CapturingLifecyclePublisher();

    try {
      const composed = composeServerIdentitySessionTrustedDeviceCompositionModule({
        databasePath,
        env: {},
        identityRepository: persistentServices.identityRepository,
        trustedDeviceRepository: persistentServices.trustedDeviceRepository,
        identityPolicyService: new IdentityPolicyService(persistentServices.identityRepository),
        credentialAuthenticator: new LocalPasswordIdentityAuthenticator(new ScryptLocalPasswordCredentialService()),
        idGenerator: new FixedIdentityIdGenerator(),
        clock: new FixedIdentityClock(),
        sessionPolicies: IdentitySessionPolicyConfig.fromEnv({}).policies,
        sessionTrustPolicies: IdentitySessionTrustPolicyConfig.fromEnv({}).policies,
        providerAccountPolicies: new IdentityProviderAccountPolicyConfig(),
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
        eventPublisherOverride: lifecyclePublisher,
      });

      expect(composed.backendApi).toBeDefined();
      expect(composed.trustedDeviceManagementService).toBeDefined();

      composed.dispose();
      expect(lifecyclePublisher.disposed).toBeTrue();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
