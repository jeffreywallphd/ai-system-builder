import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostSecureTransportKinds, resolveHostSecureTransportConfig } from "@infrastructure/config/HostSecureTransportConfig";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerTlsMaterialCompositionModule } from "../composition/ServerTlsMaterialCompositionModule";

describe("ServerTlsMaterialCompositionModule", () => {
  it("composes transport trust validators and TLS material resolution contract", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-tls-composition-module-"));
    const databasePath = join(tempDirectory, "tls-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const secureTransportConfig = resolveHostSecureTransportConfig({
        hostKind: HostSecureTransportKinds.server,
        hostAddress: "127.0.0.1",
        env: {},
      });

      const composed = await composeServerTlsMaterialCompositionModule({
        env: {},
        secureTransportConfig,
        certificateAuthorityRepository: persistentServices.certificateAuthorityRepository,
        nodeTrustRepository: persistentServices.nodeTrustRepository,
        trustedDeviceManagementService: {} as never,
        protectedSecretStore: undefined,
      });

      expect(composed.managedTlsMaterial).toBeUndefined();
      expect(composed.serverFactory).toBeUndefined();
      expect(composed.transportTrust).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
