import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretRecordStates, SecretScopes, type SecretReference } from "@domain/security/SecretDomain";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import { WorkspaceMembershipStatuses } from "@domain/workspaces/WorkspaceDomain";
import { SecretMetadataBackendApi } from "../SecretMetadataBackendApi";
import { SecretMetadataApiErrorCodes } from "../sdk/PublicSecretMetadataApiContract";

describe("SecretMetadataBackendApi", () => {
  it("creates and returns redacted metadata records", async () => {
    const backend = createBackend({
      createSecretUseCase: {
        execute: async () => Object.freeze({
          ok: true,
          value: Object.freeze({
            secret: createReference({
              secretId: "secret:user:openai",
              scope: SecretScopes.user,
              userIdentityId: "user:alpha",
            }),
          }),
        }),
      },
    });

    const response = await backend.createSecret({
      actorUserIdentityId: "user:alpha",
      secretId: "secret:user:openai",
      name: "personal.openai.api-key",
      owner: {
        scope: SecretScopes.user,
        userIdentityId: "user:alpha",
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-live-redacted",
      metadata: {
        tags: ["openai"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }

    expect(response.data.secret.secretId).toBe("secret:user:openai");
    expect((response.data.secret as Record<string, unknown>).plaintext).toBeUndefined();
  });

  it("maps access-denied service outcomes to forbidden", async () => {
    const backend = createBackend({
      listSecretsUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.accessDenied,
            message: "Secret list access denied (scope-mismatch).",
          }),
        }),
      },
    });

    const response = await backend.listSecrets({
      actorUserIdentityId: "user:alpha",
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(SecretMetadataApiErrorCodes.forbidden);
  });

  it("fails closed for workspace actor context when membership is inactive", async () => {
    const backend = createBackend({
      workspaceAuthorizationReadRepository: {
        getWorkspaceAuthorizationSnapshot: async () => Object.freeze({
          workspace: {} as never,
          membership: Object.freeze({
            status: WorkspaceMembershipStatuses.suspended,
          }),
          activeRoleAssignments: Object.freeze([]),
          effectiveRoles: Object.freeze([]),
          isWorkspaceOwner: false,
        }),
      },
      listSecretsUseCase: {
        execute: async (request: { readonly actor: { readonly workspaceId?: string } }) => {
          expect(request.actor.workspaceId).toBeUndefined();
          return Object.freeze({
            ok: false,
            error: Object.freeze({
              code: SecretServiceErrorCodes.accessDenied,
              message: "Secret list access denied (scope-mismatch).",
            }),
          });
        },
      },
    });

    const response = await backend.listSecrets({
      actorUserIdentityId: "user:alpha",
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(SecretMetadataApiErrorCodes.forbidden);
  });

  it("maps not-found disable outcomes to not-found", async () => {
    const backend = createBackend({
      disableSecretUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.notFound,
            message: "Secret 'secret:missing' was not found.",
          }),
        }),
      },
    });

    const response = await backend.disableSecret({
      actorUserIdentityId: "user:alpha",
      secretId: "secret:missing",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(SecretMetadataApiErrorCodes.notFound);
  });

  it("rotates and returns metadata-only records", async () => {
    const backend = createBackend({
      rotateSecretUseCase: {
        execute: async () => Object.freeze({
          ok: true,
          value: Object.freeze({
            secret: createReference({
              secretId: "secret:user:openai",
              scope: SecretScopes.user,
              userIdentityId: "user:alpha",
            }),
            currentVersionId: "secret:user:openai:v2",
          }),
        }),
      },
    });

    const response = await backend.rotateSecret({
      actorUserIdentityId: "user:alpha",
      secretId: "secret:user:openai",
      plaintext: "sk-live-rotated",
      expectedCurrentVersionId: "secret:user:openai:v1",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }

    expect(response.data.secret.secretId).toBe("secret:user:openai");
    expect((response.data.secret as Record<string, unknown>).plaintext).toBeUndefined();
  });

  it("returns stable validation errors for malformed create payloads", async () => {
    const backend = createBackend({});

    const response = await backend.createSecret({
      actorUserIdentityId: "user:alpha",
      secretId: " ",
      name: " ",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }

    expect(response.error.code).toBe(SecretMetadataApiErrorCodes.invalidRequest);
    expect(response.error.message).toBe("Request validation failed.");
    expect(response.error.validationErrors?.length).toBeGreaterThan(0);
  });

  it("starts secret re-encryption and exposes operation status metadata", async () => {
    const backend = createBackend({
      reEncryptSecretsUseCase: {
        execute: async () => Object.freeze({
          ok: true,
          value: Object.freeze({
            operationId: "secret-reencrypt:op-1",
            status: "running",
            startedAt: "2026-04-06T12:20:00.000Z",
            updatedAt: "2026-04-06T12:20:01.000Z",
            totalTargets: 3,
            processedTargets: 1,
            succeededTargets: 1,
            failedTargets: 0,
            remainingTargets: 2,
            failures: Object.freeze([]),
          }),
        }),
        getStatus: async () => Object.freeze({
          ok: true,
          value: Object.freeze({
            operationId: "secret-reencrypt:op-1",
            status: "succeeded",
            startedAt: "2026-04-06T12:20:00.000Z",
            updatedAt: "2026-04-06T12:21:00.000Z",
            completedAt: "2026-04-06T12:21:00.000Z",
            totalTargets: 3,
            processedTargets: 3,
            succeededTargets: 3,
            failedTargets: 0,
            remainingTargets: 0,
            failures: Object.freeze([]),
          }),
        }),
      },
    });

    const start = await backend.reEncryptSecrets({
      actorUserIdentityId: "user:alpha",
      operationKey: "op:secret:reencrypt:start",
      maxTargetsPerInvocation: 2,
    });
    expect(start.ok).toBeTrue();
    if (!start.ok || !start.data) {
      return;
    }
    expect(start.data.operation.operationId).toBe("secret-reencrypt:op-1");
    expect(start.data.operation.status).toBe("running");

    const status = await backend.getSecretReEncryptionStatus({
      actorUserIdentityId: "user:alpha",
      operationId: "secret-reencrypt:op-1",
    });
    expect(status.ok).toBeTrue();
    if (!status.ok || !status.data) {
      return;
    }
    expect(status.data.operation.status).toBe("succeeded");
    expect(status.data.operation.remainingTargets).toBe(0);
  });

  it("redacts opaque sensitive error tokens from re-encryption API errors", async () => {
    const backend = createBackend({
      reEncryptSecretsUseCase: {
        execute: async () => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.internal,
            message: "aB93kLm0QwErTy12UiOp34AsDf56GhJkLmNo78Pq",
          }),
        }),
        getStatus: async () => {
          throw new Error("not configured");
        },
      },
    });

    const response = await backend.reEncryptSecrets({
      actorUserIdentityId: "user:alpha",
      operationKey: "op:secret:reencrypt:opaque-error",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe(SecretMetadataApiErrorCodes.internal);
    expect(response.error.message).toBe("Secret metadata operation failed.");
  });

  it("returns minimal secret service health view", async () => {
    const backend = createBackend({
      secretOperationalDiagnosticsProvider: {
        collectDiagnostics: async () => Object.freeze({
          state: "degraded",
          checkedAt: "2026-04-06T12:10:00.000Z",
          healthFlags: Object.freeze({
            encryptionMaterialAvailable: false,
            repositoryReachable: true,
            bootstrapSecretsHealthy: false,
            runtimeDependenciesHealthy: false,
          }),
          diagnostics: Object.freeze([Object.freeze({
            code: "secret-encryption-unavailable",
            severity: "warning",
            message: "Secret encryption material is not configured.",
          })]),
          bootstrap: Object.freeze({
            requiredSecretIds: Object.freeze(["secret:server:provider:openai"]),
            diagnostics: Object.freeze([Object.freeze({
              code: "required-secret-missing",
              severity: "error",
              message: "Required system secret is missing.",
              secretId: "secret:server:provider:openai",
            })]),
            materialMetadata: Object.freeze([]),
          }),
        }),
      },
    });

    const response = await backend.getSecretServiceHealth({
      actorUserIdentityId: "user:alpha",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }

    expect(response.data.health.state).toBe("degraded");
    expect((response.data.health as Record<string, unknown>).bootstrap).toBeUndefined();
  });

  it("returns detailed diagnostics without leaking secret material", async () => {
    const backend = createBackend({
      secretOperationalDiagnosticsProvider: {
        collectDiagnostics: async () => Object.freeze({
          state: "degraded",
          checkedAt: "2026-04-06T12:15:00.000Z",
          healthFlags: Object.freeze({
            encryptionMaterialAvailable: false,
            repositoryReachable: true,
            bootstrapSecretsHealthy: false,
            runtimeDependenciesHealthy: false,
          }),
          diagnostics: Object.freeze([Object.freeze({
            code: "secret-encryption-unavailable",
            severity: "warning",
            message: "secret-store:/top-level/sensitive/path leaked",
          })]),
          bootstrap: Object.freeze({
            requiredSecretIds: Object.freeze(["secret:server:provider:openai"]),
            diagnostics: Object.freeze([Object.freeze({
              code: "bootstrap-error",
              severity: "error",
              message: "secret-store:/sensitive/path leaked",
              secretId: "secret:server:provider:openai",
            })]),
            materialMetadata: Object.freeze([Object.freeze({
              providerId: "openai",
              secretId: "secret:server:provider:openai",
              scope: "server",
              materialKind: "provider-credential",
              backend: Object.freeze({
                backendId: "durable-server-secret-store",
                backendKind: "durable-server-secret-store",
              }),
              reference: Object.freeze({
                secretId: "secret:server:provider:openai",
                name: "provider.openai.api-key",
                scope: "server",
                kind: "api-key",
                state: "active",
                currentVersionId: "secret:server:provider:openai:v1",
                metadata: Object.freeze({
                  tags: Object.freeze(["server", "openai"]),
                  labels: Object.freeze({
                    provider: "openai",
                  }),
                }),
                updatedAt: "2026-04-06T12:00:00.000Z",
              }),
              timestamps: Object.freeze({
                updatedAt: "2026-04-06T12:00:00.000Z",
              }),
              rotation: Object.freeze({
                status: "active",
                currentVersionId: "secret:server:provider:openai:v1",
              }),
              policyFlags: Object.freeze({
                metadataSafeForDiagnostics: true,
                plaintextAccessRequiresDedicatedRetrievalFlow: true,
                failFastRequiredOnStartup: true,
              }),
            })]),
          }),
        }),
      },
    });

    const response = await backend.getSecretServiceDiagnostics({
      actorUserIdentityId: "user:alpha",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }

    expect(response.data.diagnostics.bootstrap.requiredSecretIds).toEqual(["secret:server:provider:openai"]);
    expect(response.data.diagnostics.bootstrap.materialMetadata).toHaveLength(1);
    expect((response.data.diagnostics.bootstrap.materialMetadata[0] as Record<string, unknown>).rawValue).toBeUndefined();
    expect(response.data.diagnostics.diagnostics[0]?.message).toBe("Secret service diagnostic emitted.");
    expect(response.data.diagnostics.bootstrap.diagnostics[0]?.message).toBe("Secret service diagnostic emitted.");
  });
});

function createBackend(overrides: Record<string, unknown>): SecretMetadataBackendApi {
  return new SecretMetadataBackendApi({
    createSecretUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    getSecretMetadataUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    listSecretsUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    disableSecretUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    rotateSecretUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
    },
    reEncryptSecretsUseCase: {
      execute: async () => {
        throw new Error("not configured");
      },
      getStatus: async () => {
        throw new Error("not configured");
      },
    },
    ...overrides,
  } as never);
}

function createReference(input: {
  readonly secretId: string;
  readonly scope: SecretReference["scope"];
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}): SecretReference {
  return Object.freeze({
    secretId: input.secretId,
    name: "personal.openai.api-key",
    scope: input.scope,
    workspaceId: input.workspaceId,
    userIdentityId: input.userIdentityId,
    kind: SecretKinds.apiKey,
    state: SecretRecordStates.active,
    currentVersionId: `${input.secretId}:v1`,
    metadata: Object.freeze({
      tags: Object.freeze(["openai"]),
      labels: Object.freeze({
        provider: "openai",
      }),
    }),
    updatedAt: "2026-04-05T20:00:00.000Z",
  });
}

