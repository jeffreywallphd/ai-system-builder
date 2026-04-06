import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuthProvider, CredentialPolicy } from "../../../src/domain/identity/IdentityDomain";
import { IdentityProviderAccountPolicyConfig } from "../../../infrastructure/config/IdentityProviderAccountPolicyConfig";
import { SqliteWorkspacePersistenceAdapter } from "../../../src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter";
import { SqliteNodeTrustAuditRecorder } from "../../../src/infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder";
import { SqliteNodeTrustPersistenceAdapter } from "../../../src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../src/domain/nodes/NodeTrustDomain";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
} from "../../../src/domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../src/shared/workspaces/WorkspaceOwnership";
import {
  applyIdentityStartupConfiguration,
  initializeCertificateAuthorityForFirstSetup,
  startIdentityServerHost,
} from "../IdentityServerHost";
import type { InitializeInternalCertificateAuthorityInput, InitializeInternalCertificateAuthorityResult } from "../../../src/application/security/ports/ICertificateAuthorityIssuerPort";
import { SqliteCertificateAuthorityPersistenceAdapter } from "../../../src/infrastructure/persistence/security/SqliteCertificateAuthorityPersistenceAdapter";
import { InternalCertificateAuthorityIssuer } from "../../../src/infrastructure/security/ca/InternalCertificateAuthorityIssuer";
import { createFileSystemProtectedSecretStoreFromEnvironment } from "../../../src/infrastructure/security/secrets/FileSystemProtectedSecretStore";
import { ProtectedCertificateAuthorityRootMaterialStorage } from "../../../src/infrastructure/security/ca/ProtectedCertificateAuthorityRootMaterialStorage";
import {
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
} from "../../../src/domain/security/CertificateAuthorityDomain";
import { SecretAccessActions, SecretActorTypes, SecretKinds, SecretScopes } from "../../../src/domain/security/SecretDomain";

class InMemoryIdentityDefaultConfigurationRepository {
  public readonly providers = new Map<string, AuthProvider>();
  public readonly policies = new Map<string, CredentialPolicy>();

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.policies.set(policy.id, policy);
    return policy;
  }
}

class StubCertificateAuthorityIssuerPort {
  public async initializeInternalCertificateAuthority(
    input: InitializeInternalCertificateAuthorityInput,
  ): Promise<InitializeInternalCertificateAuthorityResult> {
    return Object.freeze({
      certificateAuthorityId: input.certificateAuthorityId,
      serialNumber: "AABBCCDD",
      notBefore: "2026-04-05T00:00:00.000Z",
      notAfter: "2036-04-05T00:00:00.000Z",
      rootCertificatePem: "-----BEGIN CERTIFICATE-----root-cert-----END CERTIFICATE-----",
      encryptedRootPrivateKeyPem: "-----BEGIN ENCRYPTED PRIVATE KEY-----root-key-----END ENCRYPTED PRIVATE KEY-----",
      rootCertificateFingerprintSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
  }

  public async issueCertificateMaterial(): Promise<never> {
    throw new Error("not implemented in host test");
  }

  public async revokeCertificateMaterial(): Promise<never> {
    throw new Error("not implemented in host test");
  }
}

describe("IdentityServerHost", () => {
  it("applies default startup identity configuration", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig();

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("active");
    expect(provider?.displayName).toBe("Local Password");
    expect(credentialPolicy?.minLength).toBe(12);
    expect(credentialPolicy?.maxFailedAttempts).toBe(5);
  });

  it("seeds a disabled local provider and overridden credential policy defaults when configured", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      localProviderEnabled: false,
      allowLocalRegistration: false,
      localCredentialPolicyDefaults: {
        minLength: 16,
        passwordHistoryCount: 20,
        blockedSubstrings: ["admin", "password"],
      },
    });

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("disabled");
    expect(credentialPolicy?.minLength).toBe(16);
    expect(credentialPolicy?.passwordHistoryCount).toBe(20);
    expect(credentialPolicy?.blockedSubstrings).toEqual(["admin", "password"]);
  });

  it("does not seed provider or policy records when startup seeding is disabled", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      bootstrapSeedDefaults: false,
    });

    await applyIdentityStartupConfiguration(repository, policies);

    expect(repository.providers.size).toBe(0);
    expect(repository.policies.size).toBe(0);
  });

  it("boots the runtime host with seeded local provider/policy and serves lifecycle endpoints", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-host-test-"));
    const databasePath = join(tempDirectory, "identity-host.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    });

    try {
      const loginBeforeRegister = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "host.lifecycle.user",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(loginBeforeRegister.status).toBe(401);

      const register = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "host.lifecycle.user",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(register.status).toBe(200);
      const registerBody = await register.json();
      expect(registerBody.ok).toBe(true);
      expect(registerBody.data.providerId).toBe("provider:local-password");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("composes the secret service in authoritative host runtime", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-secret-service-host-test-"));
    const databasePath = join(tempDirectory, "identity-secret-service-host.sqlite");
    const encryptedPayloadDirectory = join(tempDirectory, "secret-envelopes");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 17).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: encryptedPayloadDirectory,
      },
    });

    try {
      expect(host.secretService.status.configured).toBeTrue();
      expect(host.secretService.status.payloadDirectory).toBe(encryptedPayloadDirectory);

      const createSecretResult = await host.secretService.createSecretUseCase.execute({
        actor: {
          actorId: "user:server-admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.create],
        },
        operationKey: "op:host:secret:create:1",
        secretId: "secret:server:openai",
        name: "provider.openai.api-key",
        owner: {
          scope: SecretScopes.server,
        },
        kind: SecretKinds.apiKey,
        plaintext: "sk-live-123",
        metadata: {
          tags: ["openai"],
          labels: {
            provider: "openai",
            usage: "model-inference",
          },
        },
      });
      expect(createSecretResult.ok).toBeTrue();
      if (!createSecretResult.ok) {
        return;
      }

      const metadataResult = await host.secretService.getSecretMetadataUseCase.execute({
        actor: {
          actorId: "user:server-admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.readMetadata],
        },
        secretId: "secret:server:openai",
      });
      expect(metadataResult.ok).toBeTrue();
      if (!metadataResult.ok) {
        return;
      }
      expect(metadataResult.value.secretId).toBe("secret:server:openai");
      expect(metadataResult.value.currentVersionId).toBe("secret:server:openai:v1");

      const runtimeCredentialResult = await host.secretService.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
        secretId: "secret:server:openai",
        operationKey: "op:host:secret:retrieve:1",
        serviceIdentity: "runtime:server:identity-token-service",
        signingPurpose: "host-runtime-secret-consumption-test",
      });
      expect(runtimeCredentialResult).toEqual({
        ok: true,
        value: {
          secretId: "secret:server:openai",
          currentVersionId: "secret:server:openai:v1",
          scope: {
            scope: SecretScopes.server,
          },
          plaintext: "sk-live-123",
          credential: "sk-live-123",
        },
      });
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("fails closed when required system secrets are missing at startup", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-required-system-secret-missing-"));
    const databasePath = join(tempDirectory, "required-system-secret-missing.sqlite");

    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 31).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: join(tempDirectory, "secret-envelopes"),
        AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
        AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV: "false",
      },
    })).rejects.toThrow("System secret bootstrap validation failed.");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("bootstraps required system secrets from legacy environment values during startup", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-required-system-secret-migration-"));
    const databasePath = join(tempDirectory, "required-system-secret-migration.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 32).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: join(tempDirectory, "secret-envelopes"),
        AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
        OPENAI_API_KEY: "sk-live-migrated-via-startup",
      },
    });

    try {
      const metadata = await host.secretService.getSecretMetadataUseCase.execute({
        actor: {
          actorId: "user:server-admin",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: [SecretAccessActions.readMetadata],
        },
        secretId: "secret:server:provider:openai",
      });
      expect(metadata.ok).toBeTrue();
      if (!metadata.ok) {
        return;
      }
      expect(metadata.value.name).toBe("provider.openai.api-key");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("exposes workspace invitation issuance and onboarding routes on the runtime host", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-workspace-host-test-"));
    const databasePath = join(tempDirectory, "identity-workspace-host.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    });

    try {
      const ownerRegisterResponse = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "workspace.owner.host",
          email: "owner.host@example.com",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const ownerRegisterBody = await ownerRegisterResponse.json();

      const ownerLoginResponse = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerSubject: "workspace.owner.host",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const ownerLoginBody = await ownerLoginResponse.json();

      const memberRegisterResponse = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "workspace.member.host",
          email: "member.host@example.com",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const memberRegisterBody = await memberRegisterResponse.json();
      expect(memberRegisterBody.ok).toBe(true);

      const workspaceRepository = new SqliteWorkspacePersistenceAdapter(databasePath);
      const now = new Date("2026-04-05T11:00:00.000Z");
      await workspaceRepository.saveWorkspace(createWorkspace({
        id: "workspace:alpha",
        slug: "host-workspace-alpha",
        displayName: "Host Workspace Alpha",
        ownerUserId: ownerRegisterBody.data.userIdentityId,
        createdBy: ownerRegisterBody.data.userIdentityId,
        visibility: WorkspaceVisibilities.team,
        status: WorkspaceStatuses.active,
        now,
      }));
      await workspaceRepository.saveMembership(createWorkspaceMembership({
        id: "workspace-membership:owner",
        workspaceId: "workspace:alpha",
        userIdentityId: ownerRegisterBody.data.userIdentityId,
        status: WorkspaceMembershipStatuses.active,
        joinedAt: now.toISOString(),
        createdBy: ownerRegisterBody.data.userIdentityId,
        now,
      }));
      await workspaceRepository.saveRoleAssignment(createWorkspaceRoleAssignment({
        id: "workspace-role-assignment:owner",
        workspaceId: "workspace:alpha",
        userIdentityId: ownerRegisterBody.data.userIdentityId,
        role: WorkspaceRoles.owner,
        status: WorkspaceRoleAssignmentStatuses.active,
        assignedBy: ownerRegisterBody.data.userIdentityId,
        assignedAt: now.toISOString(),
      }));
      workspaceRepository.dispose();

      const listWorkspacesResponse = await fetch(`http://${host.address}/api/v1/workspaces`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
      });
      expect(listWorkspacesResponse.status).toBe(200);
      const listWorkspacesBody = await listWorkspacesResponse.json();
      expect(listWorkspacesBody.ok).toBe(true);
      expect(listWorkspacesBody.data.workspaces[0].workspaceId).toBe("workspace:alpha");

      const workspaceAdminViewResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/admin-view`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
      });
      expect(workspaceAdminViewResponse.status).toBe(200);
      const workspaceAdminViewBody = await workspaceAdminViewResponse.json();
      expect(workspaceAdminViewBody.ok).toBe(true);
      expect(workspaceAdminViewBody.data.workspace.workspaceId).toBe("workspace:alpha");

      const issueResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/invitations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ownerLoginBody.data.sessionToken}`,
        },
        body: JSON.stringify({
          invitedEmail: "member.host@example.com",
          invitedRoles: ["member"],
        }),
      });
      expect(issueResponse.status).toBe(200);
      const issueBody = await issueResponse.json();
      expect(issueBody.ok).toBe(true);

      const memberLoginResponse = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerSubject: "workspace.member.host",
          credential: { candidate: "StrongPass!2026" },
        }),
      });
      const memberLoginBody = await memberLoginResponse.json();

      const acceptResponse = await fetch(`http://${host.address}/api/v1/workspaces/workspace%3Aalpha/onboarding/accept`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${memberLoginBody.data.sessionToken}`,
        },
        body: JSON.stringify({
          invitationToken: issueBody.data.invitationToken,
        }),
      });
      expect(acceptResponse.status).toBe(200);
      const acceptBody = await acceptResponse.json();
      expect(acceptBody.ok).toBe(true);
      expect(acceptBody.data.invitation.status).toBe("accepted");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("exposes node enrollment submission and pending-review routes on the runtime host", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-node-host-test-"));
    const databasePath = join(tempDirectory, "identity-node-host.sqlite");
    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    });

    try {
      const submitResponse = await fetch(`http://${host.address}/api/v1/nodes/enrollments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actorUserIdentityId: "node:bootstrap:host-1",
          nodeId: "node:host:1",
          nodeType: "compute",
          displayName: "Host Node 1",
          capabilityProfile: {
            enabledCapabilities: ["workflow-execution"],
            supportsRemoteScheduling: true,
          },
          bootstrap: {
            trustMaterialRef: "trust-material:host-node-1",
            publicKeyAlgorithm: "ed25519",
            publicKeyFingerprintSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        }),
      });
      expect(submitResponse.status).toBe(200);
      const submitBody = await submitResponse.json();
      expect(submitBody.ok).toBe(true);
      expect(submitBody.data.enrollment.status).toBe("submitted");

      const registerAdmin = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "node.host.admin",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(registerAdmin.status).toBe(200);

      const loginAdmin = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: "node.host.admin",
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(loginAdmin.status).toBe(200);
      const loginAdminBody = await loginAdmin.json();

      const pendingResponse = await fetch(`http://${host.address}/api/v1/nodes/enrollments/pending`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${loginAdminBody.data.sessionToken}`,
        },
      });
      expect(pendingResponse.status).toBe(200);
      const pendingBody = await pendingResponse.json();
      expect(pendingBody.ok).toBe(true);
      expect(pendingBody.data.enrollments).toHaveLength(1);
      expect(pendingBody.data.enrollments[0].nodeId).toBe("node:host:1");

      const auditRecorder = new SqliteNodeTrustAuditRecorder(databasePath);
      const auditEvents = auditRecorder.listRecent(20);
      expect(auditEvents.some((event) => event.type === "node-enrollment-requested")).toBeTrue();
      expect(auditEvents.some((event) => event.type === "node-pending-enrollment-reviewed")).toBeTrue();
      auditRecorder.dispose();
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("fails closed when internal CA bootstrap configuration is partially defined", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-ca-startup-invalid-"));
    const databasePath = join(tempDirectory, "identity-ca-startup-invalid.sqlite");
    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_INTERNAL_CA_ID: "ca:internal:root:v1",
      },
    })).rejects.toThrow("Internal CA startup validation failed");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when secret master key configuration is partially defined", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-secret-master-key-partial-"));
    const databasePath = join(tempDirectory, "identity-secret-master-key-partial.sqlite");

    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:server:default",
      },
    })).rejects.toThrow("Secret encryption configuration is incomplete");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when protected CA secret refs are configured but protected storage is unavailable", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-ca-protected-secret-unavailable-"));
    const databasePath = join(tempDirectory, "identity-ca-protected-secret-unavailable.sqlite");
    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_INTERNAL_CA_ID: "ca:internal:root:v1",
        AI_LOOM_INTERNAL_CA_ROOT_CERT_MATERIAL_REF: "trust:ca:cert:v1",
        AI_LOOM_INTERNAL_CA_ROOT_KEY_MATERIAL_REF: "trust:ca:key:v1",
        AI_LOOM_INTERNAL_CA_ROOT_CERT_SECRET_REF: "secret-store:internal-ca:root-cert",
        AI_LOOM_INTERNAL_CA_ROOT_KEY_SECRET_REF: "secret-store:internal-ca:root-key",
      },
    })).rejects.toThrow("Internal CA startup validation failed");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when managed TLS is enabled but runtime trust material cannot be resolved", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-managed-tls-missing-runtime-package-"));
    const databasePath = join(tempDirectory, "identity-managed-tls-missing-runtime-package.sqlite");
    const protectedSecretsDirectory = join(tempDirectory, "protected-secrets");

    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED: "true",
        AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF: "trust:server:key:missing",
        AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY: protectedSecretsDirectory,
        AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY: Buffer.alloc(32, 21).toString("base64"),
      },
    })).rejects.toThrow("Managed identity-server TLS startup failed");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed for non-loopback host startup when HTTPS transport material is unavailable", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-non-loopback-insecure-"));
    const databasePath = join(tempDirectory, "identity-non-loopback-insecure.sqlite");

    await expect(startIdentityServerHost({
      databasePath,
      host: "0.0.0.0",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
    })).rejects.toThrow("requires HTTPS startup");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when secure transport policy disables loopback HTTP fallback", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-loopback-http-disabled-"));
    const databasePath = join(tempDirectory, "identity-loopback-http-disabled.sqlite");

    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: {
        AI_LOOM_TRANSPORT_ALLOW_INSECURE_LOOPBACK: "false",
      },
    })).rejects.toThrow("requires HTTPS startup");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed when managed TLS resolves a revoked server certificate", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-managed-tls-revoked-"));
    const databasePath = join(tempDirectory, "identity-managed-tls-revoked.sqlite");
    const managedTlsEnv = createManagedTlsEnvironment(tempDirectory);
    await seedManagedTlsServerCertificate({
      databasePath,
      env: managedTlsEnv,
      certificateStatus: "revoked",
    });

    await expect(startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: managedTlsEnv,
    })).rejects.toThrow("is not usable");

    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("fails closed with safe diagnostics when managed TLS private key trust material is unavailable", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-managed-tls-private-key-missing-"));
    const databasePath = join(tempDirectory, "identity-managed-tls-private-key-missing.sqlite");
    const managedTlsEnv = createManagedTlsEnvironment(tempDirectory);
    await seedManagedTlsServerCertificate({
      databasePath,
      env: managedTlsEnv,
      certificateStatus: "issued",
    });

    const missingPrivateKeyRef = "trust:server:key:missing";
    try {
      await startIdentityServerHost({
        databasePath,
        host: "127.0.0.1",
        providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
          bootstrapSeedDefaults: true,
        }),
        env: {
          ...managedTlsEnv,
          AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF: missingPrivateKeyRef,
        },
      });
      throw new Error("Expected managed TLS startup to fail.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("private key trust material is unavailable");
      expect(message).not.toContain(missingPrivateKeyRef);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("boots with managed TLS material resolved through certificate services", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-managed-tls-success-"));
    const databasePath = join(tempDirectory, "identity-managed-tls-success.sqlite");
    const managedTlsEnv = createManagedTlsEnvironment(tempDirectory);
    await seedManagedTlsServerCertificate({
      databasePath,
      env: managedTlsEnv,
      certificateStatus: "issued",
    });

    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: managedTlsEnv,
    });

    await host.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("wires approved node runtime trust retrieval through managed certificate services", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-node-runtime-trust-host-success-"));
    const databasePath = join(tempDirectory, "node-runtime-trust-host-success.sqlite");
    const managedTlsEnv = Object.freeze({
      ...createManagedTlsEnvironment(tempDirectory),
      AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED: "false",
    });
    const nodeId = "node:host:runtime-1";
    await seedManagedNodeRuntimeTrustMaterial({
      databasePath,
      env: managedTlsEnv,
      nodeId,
    });

    const host = await startIdentityServerHost({
      databasePath,
      host: "127.0.0.1",
      providerAccountPolicies: new IdentityProviderAccountPolicyConfig({
        bootstrapSeedDefaults: true,
      }),
      env: managedTlsEnv,
    });

    try {
      const registerNode = await fetch(`http://${host.address}/api/v1/identity/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: nodeId,
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(registerNode.status).toBe(200);

      const loginNode = await fetch(`http://${host.address}/api/v1/identity/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerSubject: nodeId,
          credential: {
            candidate: "StrongPass!2026",
          },
        }),
      });
      expect(loginNode.status).toBe(200);
      const loginNodeBody = await loginNode.json();

      const runtimeTrustMaterial = await fetch(
        `http://${host.address}/api/v1/nodes/${encodeURIComponent(nodeId)}/runtime-trust-material`,
        {
          headers: {
            authorization: `Bearer ${loginNodeBody.data.sessionToken}`,
          },
        },
      );
      expect(runtimeTrustMaterial.status).toBe(200);
      const runtimeTrustMaterialBody = await runtimeTrustMaterial.json();
      expect(runtimeTrustMaterialBody.ok).toBe(true);
      expect(runtimeTrustMaterialBody.data.runtimeTrustMaterial.targetKind).toBe("node");
      expect(runtimeTrustMaterialBody.data.runtimeTrustMaterial.targetReferenceId).toBe(nodeId);
      expect(runtimeTrustMaterialBody.data.runtimeTrustMaterial.leafCertificatePem).toContain("BEGIN CERTIFICATE");
    } finally {
      await host.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("initializes CA through host composition by invoking the application use case", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-identity-ca-init-host-"));
    const databasePath = join(tempDirectory, "identity-ca-init-host.sqlite");
    const secretDirectory = join(tempDirectory, "protected-secrets");

    const result = await initializeCertificateAuthorityForFirstSetup({
      databasePath,
      issuer: new StubCertificateAuthorityIssuerPort(),
      env: {
        AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY: secretDirectory,
        AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY: Buffer.alloc(32, 11).toString("base64"),
      },
    }, {
      operationKey: "host-ca-init-v1",
      certificateAuthorityId: "ca:internal:root:v1",
      displayName: "AI Loom Internal Root",
      subject: {
        commonName: "AI Loom Internal Root CA",
        dnsNames: [],
        ipAddresses: [],
        uriSanEntries: [],
      },
      signatureAlgorithm: "sha256WithRSAEncryption",
      validityDays: 3650,
      actorUserIdentityId: "user:admin",
      rootCertificateMaterialRef: "trust:ca:cert:v1",
      rootPrivateKeyMaterialRef: "trust:ca:key:v1",
      rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
      rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
    });

    const repository = new SqliteCertificateAuthorityPersistenceAdapter(databasePath);
    const persistedAuthority = await repository.findCertificateAuthorityById("ca:internal:root:v1");
    const rootCertificateTrustMaterial = await repository.findTrustMaterialByRef("trust:ca:cert:v1");
    const rootPrivateKeyTrustMaterial = await repository.findTrustMaterialByRef("trust:ca:key:v1");
    repository.dispose();

    expect(result.outcome).toBe("initialized");
    expect(persistedAuthority?.certificateAuthorityId).toBe("ca:internal:root:v1");
    expect(rootCertificateTrustMaterial?.storageLocator).toBe("secret-store:internal-ca:root-cert");
    expect(rootPrivateKeyTrustMaterial?.storageLocator).toBe("secret-store:internal-ca:root-key");

    rmSync(tempDirectory, { recursive: true, force: true });
  });
});

function createManagedTlsEnvironment(tempDirectory: string): Readonly<Record<string, string>> {
  const protectedSecretsDirectory = join(tempDirectory, "protected-secrets");
  return Object.freeze({
    AI_LOOM_INTERNAL_CA_ID: "ca:internal:root:v1",
    AI_LOOM_INTERNAL_CA_ROOT_CERT_MATERIAL_REF: "trust:ca:cert:v1",
    AI_LOOM_INTERNAL_CA_ROOT_KEY_MATERIAL_REF: "trust:ca:key:v1",
    AI_LOOM_INTERNAL_CA_ROOT_CERT_SECRET_REF: "secret-store:internal-ca:root-cert",
    AI_LOOM_INTERNAL_CA_ROOT_KEY_SECRET_REF: "secret-store:internal-ca:root-key",
    AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED: "true",
    AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID: "server:authoritative",
    AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF: "trust:ca:key:v1",
    AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_DIRECTORY: protectedSecretsDirectory,
    AI_LOOM_INTERNAL_CA_PROTECTED_SECRETS_KEY: Buffer.alloc(32, 47).toString("base64"),
  });
}

async function seedManagedTlsServerCertificate(input: {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly certificateStatus: "issued" | "revoked";
}): Promise<void> {
  const repository = new SqliteCertificateAuthorityPersistenceAdapter(input.databasePath);
  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(input.env);
  if (!protectedSecretStore) {
    throw new Error("Managed TLS test setup requires protected secret storage.");
  }

  const issuer = new InternalCertificateAuthorityIssuer({
    certificateAuthorityRepository: repository,
    trustMaterialRepository: repository,
    rootMaterialStorage: new ProtectedCertificateAuthorityRootMaterialStorage(protectedSecretStore),
  });

  const initialized = await initializeCertificateAuthorityForFirstSetup({
    databasePath: input.databasePath,
    issuer,
    env: input.env,
  }, {
    operationKey: `managed-tls-test-ca-init:${Date.now()}`,
    certificateAuthorityId: "ca:internal:root:v1",
    displayName: "AI Loom Internal Root",
    subject: {
      commonName: "AI Loom Internal Root CA",
      dnsNames: ["ca.ai-loom.internal"],
      ipAddresses: [],
      uriSanEntries: [],
    },
    signatureAlgorithm: "sha256WithRSAEncryption",
    validityDays: 3650,
    actorUserIdentityId: "user:admin",
    rootCertificateMaterialRef: "trust:ca:cert:v1",
    rootPrivateKeyMaterialRef: "trust:ca:key:v1",
    rootCertificateSecretRef: "secret-store:internal-ca:root-cert",
    rootPrivateKeySecretRef: "secret-store:internal-ca:root-key",
  });

  if (initialized.outcome !== "initialized") {
    throw new Error("Managed TLS test setup expected certificate authority initialization.");
  }

  const issuedAt = "2026-04-05T12:00:00.000Z";
  const revokedAt = "2026-04-05T12:30:00.000Z";
  await repository.saveIssuedCertificate({
    mutation: {
      operationKey: `managed-tls-test-issued-cert:${Date.now()}`,
      context: {
        actorUserIdentityId: "user:admin",
        occurredAt: issuedAt,
      },
    },
    record: {
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "AA11BB22",
      status: input.certificateStatus,
      subject: {
        commonName: "authoritative.ai-loom.internal",
        dnsNames: ["authoritative.ai-loom.internal"],
        ipAddresses: [],
        uriSanEntries: [],
      },
      subjectReference: {
        kind: "service",
        referenceId: "server:authoritative",
      },
      usages: ["server-auth", "client-auth"],
      validity: {
        notBefore: "2026-04-05T11:00:00.000Z",
        notAfter: "2027-04-05T11:00:00.000Z",
      },
      issuedAt,
      certificateMaterialRef: "trust:ca:cert:v1",
      certificateChainMaterialRef: "trust:ca:cert:v1",
      trustMaterialRef: "trust:ca:cert:v1",
      publicKeyAlgorithm: "rsa-4096",
      publicKeyFingerprintSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      revocation: input.certificateStatus === "revoked"
        ? {
          reason: "superseded",
          revokedAt,
          revokedByActorId: "user:admin",
          note: "managed tls revoked test",
        }
        : undefined,
      createdAt: issuedAt,
      createdBy: "user:admin",
      lastModifiedAt: input.certificateStatus === "revoked" ? revokedAt : issuedAt,
      lastModifiedBy: "user:admin",
      revision: 1,
    },
  });
  repository.dispose();
}

async function seedManagedNodeRuntimeTrustMaterial(input: {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly nodeId: string;
}): Promise<void> {
  await seedManagedTlsServerCertificate({
    databasePath: input.databasePath,
    env: input.env,
    certificateStatus: "issued",
  });

  const repository = new SqliteCertificateAuthorityPersistenceAdapter(input.databasePath);
  const nodeRepository = new SqliteNodeTrustPersistenceAdapter(input.databasePath);
  const protectedSecretStore = createFileSystemProtectedSecretStoreFromEnvironment(input.env);
  if (!protectedSecretStore) {
    repository.dispose();
    nodeRepository.dispose();
    throw new Error("Node runtime trust test setup requires protected secret storage.");
  }
  const materialStorage = new ProtectedCertificateAuthorityRootMaterialStorage(protectedSecretStore);

  const issuedAt = "2026-04-05T13:00:00.000Z";
  const leafRef = `trust:cert:${input.nodeId}:v1`;
  const chainRef = `trust:chain:${input.nodeId}:v1`;
  const leafSecretRef = `secret-store:internal-ca:${encodeURIComponent(`${input.nodeId}:leaf`)}`;
  const chainSecretRef = `secret-store:internal-ca:${encodeURIComponent(`${input.nodeId}:chain`)}`;

  await materialStorage.persistRootMaterials({
    certificateAuthorityId: "ca:internal:root:v1",
    reason: "seed-node-runtime-trust-material",
    materials: [{
      materialRef: leafRef,
      kind: "certificate-pem",
      plaintextValue: "-----BEGIN CERTIFICATE-----node-leaf-----END CERTIFICATE-----\n",
      secretRef: leafSecretRef,
    }, {
      materialRef: chainRef,
      kind: "certificate-chain-pem",
      plaintextValue: "-----BEGIN CERTIFICATE-----node-chain-----END CERTIFICATE-----\n",
      secretRef: chainSecretRef,
    }],
  });

  await repository.saveTrustMaterial({
    mutation: {
      operationKey: `seed-node-runtime-trust-leaf-ref:${Date.now()}`,
      context: {
        actorUserIdentityId: "user:admin",
        occurredAt: issuedAt,
      },
    },
    record: {
      materialRef: leafRef,
      kind: "certificate-pem",
      storageLocator: leafSecretRef,
      createdAt: issuedAt,
      createdBy: "user:admin",
      lastModifiedAt: issuedAt,
      lastModifiedBy: "user:admin",
      revision: 1,
    },
  });
  await repository.saveTrustMaterial({
    mutation: {
      operationKey: `seed-node-runtime-trust-chain-ref:${Date.now()}`,
      context: {
        actorUserIdentityId: "user:admin",
        occurredAt: issuedAt,
      },
    },
    record: {
      materialRef: chainRef,
      kind: "certificate-chain-pem",
      storageLocator: chainSecretRef,
      createdAt: issuedAt,
      createdBy: "user:admin",
      lastModifiedAt: issuedAt,
      lastModifiedBy: "user:admin",
      revision: 1,
    },
  });

  await repository.saveIssuedCertificate({
    mutation: {
      operationKey: `seed-node-runtime-issued-cert:${Date.now()}`,
      context: {
        actorUserIdentityId: "user:admin",
        occurredAt: issuedAt,
      },
    },
    record: {
      certificateAuthorityId: "ca:internal:root:v1",
      serialNumber: "CC33DD44",
      status: CertificateStatuses.issued,
      subject: {
        commonName: `${input.nodeId}.ai-loom.internal`,
        dnsNames: [`${input.nodeId}.ai-loom.internal`],
        ipAddresses: [],
        uriSanEntries: [`spiffe://ai-loom.internal/${input.nodeId}`],
      },
      subjectReference: {
        kind: CertificateSubjectReferenceKinds.node,
        referenceId: input.nodeId,
      },
      usages: [CertificateUsageKinds.clientAuth, CertificateUsageKinds.mutualTls],
      validity: {
        notBefore: "2026-04-05T12:30:00.000Z",
        notAfter: "2027-04-05T12:30:00.000Z",
      },
      issuedAt,
      certificateMaterialRef: leafRef,
      certificateChainMaterialRef: chainRef,
      trustMaterialRef: chainRef,
      publicKeyAlgorithm: "rsa-4096",
      publicKeyFingerprintSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: issuedAt,
      createdBy: "user:admin",
      lastModifiedAt: issuedAt,
      lastModifiedBy: "user:admin",
      revision: 1,
    },
  });

  await nodeRepository.registerNode({
    mutation: {
      operationKey: `seed-node-runtime-node-record:${Date.now()}`,
      context: {
        actorUserIdentityId: "user:admin",
      },
    },
    record: {
      nodeId: input.nodeId,
      nodeType: NodeTypes.compute,
      displayName: "Runtime Host Node",
      capabilityProfile: {
        enabledCapabilities: [NodeRoleCapabilities.executor],
        supportsRemoteScheduling: true,
      },
      approvalStatus: NodeApprovalStatuses.approved,
      trustState: NodeTrustStates.trusted,
      certificate: {
        certificateRef: leafRef,
      },
      deploymentTags: ["runtime"],
      revocation: {
        state: NodeRevocationStates.active,
      },
      enrolledAt: issuedAt,
      approvedAt: issuedAt,
      createdAt: issuedAt,
      createdBy: "user:admin",
      lastModifiedAt: issuedAt,
      lastModifiedBy: "user:admin",
      revision: 0,
    },
  });

  repository.dispose();
  nodeRepository.dispose();
}
