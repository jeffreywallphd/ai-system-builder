import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretRecordStates, SecretScopes, type SecretReference } from "../../../../src/domain/security/SecretDomain";
import { SecretServiceErrorCodes } from "../../../../src/application/security/use-cases/SecretManagementServiceContracts";
import { WorkspaceMembershipStatuses } from "../../../../src/domain/workspaces/WorkspaceDomain";
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
