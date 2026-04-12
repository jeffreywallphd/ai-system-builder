import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostSecureTransportKinds, resolveHostSecureTransportConfig } from "@infrastructure/config/HostSecureTransportConfig";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerTlsMaterialCompositionModule } from "../composition/ServerTlsMaterialCompositionModule";
import type { IManagedServerTlsRuntimeMaterialResolverPort } from "@application/security/ports/SecurityMaterialResolutionPorts";

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

  it("resolves managed TLS material through the centralized resolver interface", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-tls-material-resolver-module-"));
    const databasePath = join(tempDirectory, "tls-material-resolver-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });
    const calls: Array<Readonly<Record<string, string | undefined>>> = [];
    const stubResolver: IManagedServerTlsRuntimeMaterialResolverPort = {
      async resolveManagedServerTlsRuntimeMaterial(input) {
        calls.push(Object.freeze({
          targetReferenceId: input.targetReferenceId,
          actorUserIdentityId: input.actorUserIdentityId,
          workspaceId: input.workspaceId,
          certificateAuthorityId: input.certificateAuthorityId,
          serialNumber: input.serialNumber,
          privateKeyMaterialRef: input.privateKeyMaterialRef,
        }));
        return Object.freeze({
          certPem: "-----BEGIN CERTIFICATE-----managed-----END CERTIFICATE-----\n",
          keyPem: "-----BEGIN PRIVATE KEY-----managed-----END PRIVATE KEY-----\n",
          caPem: "-----BEGIN CERTIFICATE-----ca-----END CERTIFICATE-----\n",
        });
      },
    };

    try {
      const secureTransportConfig = resolveHostSecureTransportConfig({
        hostKind: HostSecureTransportKinds.server,
        hostAddress: "127.0.0.1",
        env: {
          AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED: "true",
          AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID: "server:authoritative",
          AI_LOOM_INTERNAL_CA_SERVER_TLS_ACTOR_USER_IDENTITY_ID: "system:tls-module-test",
          AI_LOOM_INTERNAL_CA_SERVER_TLS_WORKSPACE_ID: "workspace-alpha",
          AI_LOOM_INTERNAL_CA_SERVER_TLS_CERTIFICATE_AUTHORITY_ID: "ca:internal:root:v1",
          AI_LOOM_INTERNAL_CA_SERVER_TLS_SERIAL_NUMBER: "AA11BB22",
          AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF: "trust:server:key:v1",
        },
      });

      const composed = await composeServerTlsMaterialCompositionModule({
        env: {},
        secureTransportConfig,
        certificateAuthorityRepository: persistentServices.certificateAuthorityRepository,
        nodeTrustRepository: persistentServices.nodeTrustRepository,
        trustedDeviceManagementService: {} as never,
        protectedSecretStore: undefined,
        managedServerTlsRuntimeMaterialResolver: stubResolver,
      });

      expect(composed.managedTlsMaterial).toBeDefined();
      expect(composed.serverFactory).toBeDefined();
      expect(calls).toEqual([{
        targetReferenceId: "server:authoritative",
        actorUserIdentityId: "system:tls-module-test",
        workspaceId: "workspace-alpha",
        certificateAuthorityId: "ca:internal:root:v1",
        serialNumber: "AA11BB22",
        privateKeyMaterialRef: "trust:server:key:v1",
      }]);
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
