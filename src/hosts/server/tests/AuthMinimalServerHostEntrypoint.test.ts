import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  constructAuthMinimalServerHostAssembly,
  createAuthMinimalServerHostBootConfiguration,
  startAuthMinimalServerHostAssembly,
} from "../AuthMinimalServerHostEntrypoint";
import { AuthoritativeServerApiRouteRegistrationPlanArtifactKey } from "../AuthoritativeServerApiRouteComposition";
import {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
} from "../AuthoritativeServerCompositionRoot";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import { SqliteWorkspacePersistenceAdapter } from "@infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import { SqliteTrustedDevicePersistenceAdapter } from "@infrastructure/persistence/identity/SqliteTrustedDevicePersistenceAdapter";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
} from "@domain/identity/TrustedDeviceDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

describe("AuthMinimalServerHostEntrypoint", () => {
  it("constructs a boot configuration with auth-minimal startup reason", () => {
    const boot = createAuthMinimalServerHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:server:authoritative");
    expect(boot.startupReason).toBe("auth-minimal-server-entrypoint-startup");
  });

  it("composes auth-minimal route registration and starts through the dedicated entrypoint", async () => {
    let observedRouteFamilyIds: ReadonlyArray<string> = [];
    let composedAuthMinimalPersistenceShape: Readonly<Record<string, unknown>> | undefined;
    let observedComfyExecutionAdapterArtifact: unknown;
    let observedRunExecutionRegistrationArtifact: unknown;
    let observedStartedHostRunExecutionAdapters: unknown;
    let stopCount = 0;

    const assembly = constructAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath: "auth-minimal.sqlite",
      },
      startHost: async () => ({
        port: 6300,
        address: "127.0.0.1:6300",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          stopCount += 1;
        },
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const routePlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
              AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
            );
            observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId) ?? [];
            observedComfyExecutionAdapterArtifact = context.getArtifact(
              AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
            );
            observedRunExecutionRegistrationArtifact = context.getArtifact(
              AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
            );
          },
          [HostBootstrapStageIds.persistence]: (context) => {
            const services = context.getArtifact<unknown>(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
            );
            composedAuthMinimalPersistenceShape = (services ?? {}) as Readonly<Record<string, unknown>>;
          },
        },
      },
    });

    expect(assembly.boot.startupReason).toBe("auth-minimal-server-entrypoint-startup");

    const runtime = await startAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath: "auth-minimal.sqlite",
      },
      startHost: async (options) => {
        observedStartedHostRunExecutionAdapters = options.runExecutionAdapters;
        return {
          port: 6300,
          address: "127.0.0.1:6300",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {
            stopCount += 1;
          },
        };
      },
      boot: {
        environment: {
          AI_LOOM_COMFYUI_ADAPTER_ENABLED: "true",
          AI_LOOM_COMFYUI_BASE_URL: "http://127.0.0.1:8188",
        },
      },
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const routePlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
              AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
            );
            observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId) ?? [];
            observedComfyExecutionAdapterArtifact = context.getArtifact(
              AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
            );
            observedRunExecutionRegistrationArtifact = context.getArtifact(
              AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
            );
          },
          [HostBootstrapStageIds.persistence]: (context) => {
            const services = context.getArtifact<unknown>(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
            );
            composedAuthMinimalPersistenceShape = (services ?? {}) as Readonly<Record<string, unknown>>;
          },
        },
      },
    });

    expect(runtime.phase).toBe("ready");
    expect(observedRouteFamilyIds).toEqual(["identity-auth"]);
    expect(composedAuthMinimalPersistenceShape?.identityRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.trustedDeviceRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.workspaceRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.authorizationRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.deploymentPolicyRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.storageInstanceRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.assetRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.platformPersistenceRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.auditLedgerRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.generatedResultRepository).toBeUndefined();
    expect(observedComfyExecutionAdapterArtifact).toBeUndefined();
    expect(observedRunExecutionRegistrationArtifact).toBeUndefined();
    expect(observedStartedHostRunExecutionAdapters).toBeUndefined();

    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
    expect(stopCount).toBe(1);
  });

  it("preserves session bootstrap, trusted-device enforcement, and transport trust behavior", async () => {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), "ai-loom-auth-minimal-host-test-"));
    const databasePath = path.join(tempDirectory, "auth-minimal-host.sqlite");
    const runtime = await startAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath,
        host: "127.0.0.1",
        env: {
          NODE_ENV: "test",
        },
      },
      boot: {
        environment: {
          NODE_ENV: "test",
        },
      },
    });

    const baseUrl = `http://${runtime.address}`;
    try {
      const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "auth.minimal.user",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(register.status).toBe(200);
      const registerBody = await register.json() as {
        readonly ok: boolean;
        readonly data: {
          readonly userIdentityId: string;
        };
      };
      expect(registerBody.ok).toBeTrue();

      const userIdentityId = registerBody.data.userIdentityId;
      const now = new Date("2026-04-10T12:00:00.000Z");
      const workspaceRepository = new SqliteWorkspacePersistenceAdapter(databasePath);
      await workspaceRepository.saveWorkspace(createWorkspace({
        id: "workspace:auth-minimal",
        slug: "auth-minimal",
        displayName: "Auth Minimal Workspace",
        ownerUserId: userIdentityId,
        createdBy: userIdentityId,
        visibility: WorkspaceVisibilities.team,
        status: WorkspaceStatuses.active,
        now,
      }));
      await workspaceRepository.saveMembership(createWorkspaceMembership({
        id: "workspace-membership:auth-minimal-owner",
        workspaceId: "workspace:auth-minimal",
        userIdentityId,
        status: WorkspaceMembershipStatuses.active,
        joinedAt: now.toISOString(),
        createdBy: userIdentityId,
        now,
      }));
      await workspaceRepository.saveRoleAssignment(createWorkspaceRoleAssignment({
        id: "workspace-role-assignment:auth-minimal-owner",
        workspaceId: "workspace:auth-minimal",
        userIdentityId,
        role: WorkspaceRoles.owner,
        status: WorkspaceRoleAssignmentStatuses.active,
        assignedBy: userIdentityId,
        assignedAt: now.toISOString(),
      }));
      workspaceRepository.dispose();

      const desktopLogin = await fetch(`${baseUrl}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "auth.minimal.user",
          accessChannel: "desktop",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(desktopLogin.status).toBe(200);
      const desktopLoginBody = await desktopLogin.json() as {
        readonly ok: boolean;
        readonly data: {
          readonly sessionToken: string;
          readonly sessionDeviceTrustContext?: {
            readonly sessionAssuranceLevel?: string;
          };
        };
      };
      expect(desktopLoginBody.ok).toBeTrue();
      const desktopToken = desktopLoginBody.data.sessionToken;

      const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
        headers: {
          authorization: `Bearer ${desktopToken}`,
        },
      });
      expect(resolvedSession.status).toBe(200);

      const resolvedContext = await fetch(
        `${baseUrl}/api/v1/identity/session/context?workspaceId=${encodeURIComponent("workspace:auth-minimal")}`,
        {
          headers: {
            authorization: `Bearer ${desktopToken}`,
          },
        },
      );
      expect(resolvedContext.status).toBe(200);
      const resolvedContextBody = await resolvedContext.json() as {
        readonly ok: boolean;
        readonly data: {
          readonly actor: {
            readonly userIdentityId: string;
          };
          readonly workspaceContext: {
            readonly resolvedWorkspaceId?: string;
          };
        };
      };
      expect(resolvedContextBody.ok).toBeTrue();
      expect(resolvedContextBody.data.actor.userIdentityId).toBe(userIdentityId);
      expect(resolvedContextBody.data.workspaceContext.resolvedWorkspaceId).toBe("workspace:auth-minimal");

      const requireTrustedWithoutBinding = await fetch(`${baseUrl}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "auth.minimal.user",
          accessChannel: "desktop",
          sessionTrustRequirement: "require-trusted",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(requireTrustedWithoutBinding.status).toBe(401);
      const requireTrustedWithoutBindingBody = await requireTrustedWithoutBinding.json() as {
        readonly ok: boolean;
        readonly error?: {
          readonly message?: string;
        };
      };
      expect(requireTrustedWithoutBindingBody.ok).toBeFalse();
      expect(requireTrustedWithoutBindingBody.error?.message).toContain("trusted device");

      await seedTrustedDevice(databasePath, {
        trustedDeviceId: "trusted-device:auth-minimal",
        userIdentityId,
      });

      const trustedLogin = await fetch(`${baseUrl}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "auth.minimal.user",
          accessChannel: "desktop",
          sessionTrustRequirement: "require-trusted",
          client: {
            trustedDeviceBindingId: "trusted-device:auth-minimal",
          },
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(trustedLogin.status).toBe(200);
      const trustedLoginBody = await trustedLogin.json() as {
        readonly ok: boolean;
        readonly data: {
          readonly sessionDeviceTrustContext?: {
            readonly sessionAssuranceLevel?: string;
            readonly trustedDeviceBindingId?: string;
          };
        };
      };
      expect(trustedLoginBody.ok).toBeTrue();
      expect(trustedLoginBody.data.sessionDeviceTrustContext?.sessionAssuranceLevel).toBe("authenticated-trusted");
      expect(trustedLoginBody.data.sessionDeviceTrustContext?.trustedDeviceBindingId).toBe("trusted-device:auth-minimal");

      const thinClientLogin = await fetch(`${baseUrl}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "auth.minimal.user",
          accessChannel: "thin-client",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(thinClientLogin.status).toBe(200);
      const thinClientLoginBody = await thinClientLogin.json() as {
        readonly ok: boolean;
        readonly data: {
          readonly sessionToken: string;
        };
      };
      expect(thinClientLoginBody.ok).toBeTrue();

      const thinClientSessionResolve = await fetch(`${baseUrl}/api/v1/identity/session`, {
        headers: {
          authorization: `Bearer ${thinClientLoginBody.data.sessionToken}`,
        },
      });
      expect(thinClientSessionResolve.status).toBe(403);
      const thinClientSessionResolveBody = await thinClientSessionResolve.json() as {
        readonly ok: boolean;
        readonly error?: {
          readonly code?: string;
          readonly message?: string;
        };
      };
      expect(thinClientSessionResolveBody.ok).toBeFalse();
      expect(thinClientSessionResolveBody.error?.code).toBe("forbidden");
      expect(thinClientSessionResolveBody.error?.message).toContain("Transport trust validation");
    } finally {
      await runtime.stop();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});

async function seedTrustedDevice(
  databasePath: string,
  input: {
    readonly trustedDeviceId: string;
    readonly userIdentityId: string;
  },
): Promise<void> {
  const repository = new SqliteTrustedDevicePersistenceAdapter(databasePath);
  const now = new Date("2026-04-10T12:30:00.000Z");
  try {
    await repository.createTrustedDevice(createTrustedDevice({
      id: input.trustedDeviceId,
      userIdentityId: input.userIdentityId,
      displayName: "Auth Minimal Desktop",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: `fingerprint:${input.trustedDeviceId}`,
        capturedAt: now,
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: `material:${input.trustedDeviceId}`,
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      }),
      registeredAt: new Date(now.getTime() - 60_000),
      pairedAt: now,
      updatedAt: now,
    }));
  } finally {
    repository.dispose();
  }
}
