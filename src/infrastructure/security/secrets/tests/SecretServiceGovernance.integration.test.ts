import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SecretAccessActions, SecretActorTypes, SecretKinds, SecretScopes } from "../../../../domain/security/SecretDomain";
import type { SecretAccessAuditEvent } from "../../../../application/security/ports/SecretServicePorts";
import { SecretServiceErrorCodes } from "../../../../application/security/use-cases/SecretManagementServiceContracts";
import { composeServerSecretService } from "../SecretServiceComposition";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("Secret service governance integration", () => {
  it("enforces scoped governance across lifecycle operations and records redacted audit traces", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-secret-governance-int-"));
    createdRoots.push(root);

    const databasePath = path.join(root, "secret-governance.sqlite");
    const payloadDirectory = path.join(root, "secret-envelopes");
    const auditEvents: SecretAccessAuditEvent[] = [];
    const service = composeServerSecretService({
      databasePath,
      env: {
        AI_LOOM_SECRET_MASTER_KEY_ID: "kek:workspace:default",
        AI_LOOM_SECRET_MASTER_KEY: Buffer.alloc(32, 43).toString("base64"),
        AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY: payloadDirectory,
      },
      auditHook: (event) => {
        auditEvents.push(event);
      },
    });
    try {
      const initialPlaintext = "workspace-alpha-openai-token-v1";
      const rotatedPlaintext = "workspace-alpha-openai-token-v2";
      const secretId = "secret:workspace:alpha:openai";

      const createResult = await service.createSecretUseCase.execute({
        actor: {
          actorId: "user:workspace-alpha-admin",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.create],
        },
        operationKey: "op:secret:governance:create",
        secretId,
        name: "provider.openai.api-key",
        owner: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        kind: SecretKinds.apiKey,
        plaintext: initialPlaintext,
        metadata: {
          tags: ["openai", "workspace"],
          labels: {
            provider: "openai",
            usage: "model-inference",
          },
        },
      });
      expect(createResult.ok).toBeTrue();

      const listResult = await service.listSecretsUseCase.execute({
        actor: {
          actorId: "user:workspace-alpha-admin",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.list],
        },
        owner: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
      });
      expect(listResult.ok).toBeTrue();
      if (!listResult.ok) {
        return;
      }
      expect(listResult.value.items).toHaveLength(1);
      expect(JSON.stringify(listResult.value.items[0])).not.toContain(initialPlaintext);

      const metadataResult = await service.getSecretMetadataUseCase.execute({
        actor: {
          actorId: "user:workspace-alpha-admin",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.readMetadata],
        },
        secretId,
      });
      expect(metadataResult.ok).toBeTrue();
      if (!metadataResult.ok) {
        return;
      }
      expect(JSON.stringify(metadataResult.value)).not.toContain(initialPlaintext);
      expect(JSON.stringify(metadataResult.value)).not.toContain(rotatedPlaintext);

      const authorizedRuntimeRetrieval = await service.retrieveSecretPlaintextForRuntimeUseCase.execute({
        actor: {
          actorId: "system:runtime:workspace-alpha",
          actorType: SecretActorTypes.workspaceService,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.retrievePlaintext],
        },
        secretId,
        operationKey: "op:secret:governance:retrieve:authorized",
        runtimeContext: {
          serviceIdentity: "runtime:workspace-alpha:workflow-executor",
          scope: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
          justification: "execute provider API call for workspace-alpha",
        },
      });
      expect(authorizedRuntimeRetrieval).toEqual({
        ok: true,
        value: {
          secretId,
          currentVersionId: "secret:workspace:alpha:openai:v1",
          scope: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
          plaintext: initialPlaintext,
        },
      });

      const deniedCrossScopeList = await service.listSecretsUseCase.execute({
        actor: {
          actorId: "user:workspace-beta-member",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:beta",
          grantedActions: [SecretAccessActions.list],
        },
        owner: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
      });
      expect(deniedCrossScopeList).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: SecretServiceErrorCodes.accessDenied,
        }),
      });

      const deniedCrossScopeRuntimeRetrieval = await service.retrieveSecretPlaintextForRuntimeUseCase.execute({
        actor: {
          actorId: "system:runtime:workspace-alpha",
          actorType: SecretActorTypes.workspaceService,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.retrievePlaintext],
        },
        secretId,
        operationKey: "op:secret:governance:retrieve:denied-cross-scope",
        runtimeContext: {
          serviceIdentity: "runtime:workspace-alpha:workflow-executor",
          scope: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:beta",
          },
          justification: "attempted cross-scope retrieval should be denied",
        },
      });
      expect(deniedCrossScopeRuntimeRetrieval).toEqual({
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: `Secret '${secretId}' was not found.`,
        },
      });

      const rotateResult = await service.rotateSecretUseCase.execute({
        actor: {
          actorId: "user:workspace-alpha-admin",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.rotate],
        },
        operationKey: "op:secret:governance:rotate",
        secretId,
        plaintext: rotatedPlaintext,
      });
      expect(rotateResult.ok).toBeTrue();

      const retrievedAfterRotation = await service.retrieveSecretPlaintextForRuntimeUseCase.execute({
        actor: {
          actorId: "system:runtime:workspace-alpha",
          actorType: SecretActorTypes.workspaceService,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.retrievePlaintext],
        },
        secretId,
        operationKey: "op:secret:governance:retrieve:post-rotate",
        runtimeContext: {
          serviceIdentity: "runtime:workspace-alpha:workflow-executor",
          scope: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
          justification: "use the newly rotated secret value",
        },
      });
      expect(retrievedAfterRotation).toEqual({
        ok: true,
        value: expect.objectContaining({
          secretId,
          plaintext: rotatedPlaintext,
        }),
      });

      const disableResult = await service.disableSecretUseCase.execute({
        actor: {
          actorId: "user:workspace-alpha-admin",
          actorType: SecretActorTypes.workspaceMember,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.disable],
        },
        operationKey: "op:secret:governance:disable",
        secretId,
      });
      expect(disableResult.ok).toBeTrue();
      if (!disableResult.ok) {
        return;
      }
      expect(disableResult.value.state).toBe("disabled");

      const deniedAfterDisableRetrieval = await service.retrieveSecretPlaintextForRuntimeUseCase.execute({
        actor: {
          actorId: "system:runtime:workspace-alpha",
          actorType: SecretActorTypes.workspaceService,
          workspaceId: "workspace:alpha",
          grantedActions: [SecretAccessActions.retrievePlaintext],
        },
        secretId,
        operationKey: "op:secret:governance:retrieve:disabled",
        runtimeContext: {
          serviceIdentity: "runtime:workspace-alpha:workflow-executor",
          scope: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
          justification: "disabled secrets cannot be retrieved",
        },
      });
      expect(deniedAfterDisableRetrieval).toEqual({
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: `Secret '${secretId}' was not found.`,
        },
      });

      const payloadFiles = readdirSync(payloadDirectory);
      expect(payloadFiles.length).toBeGreaterThanOrEqual(2);
      const encryptedPayloadContents = payloadFiles
        .map((fileName) => readFileSync(path.join(payloadDirectory, fileName), "utf8"))
        .join("\n");
      expect(encryptedPayloadContents).not.toContain(initialPlaintext);
      expect(encryptedPayloadContents).not.toContain(rotatedPlaintext);

      const serializedAudit = JSON.stringify(auditEvents);
      expect(serializedAudit).not.toContain(initialPlaintext);
      expect(serializedAudit).not.toContain(rotatedPlaintext);

      const operationEvents = auditEvents.filter(
        (event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.operation" }> =>
          event.eventKind === "secret.operation",
      );
      const accessDecisionEvents = auditEvents.filter(
        (event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }> =>
          event.eventKind === "secret.access-decision",
      );
      expect(operationEvents.length).toBeGreaterThanOrEqual(8);
      expect(accessDecisionEvents.some((event) => event.decision === "denied" && event.reason === "scope-mismatch")).toBeTrue();
      expect(operationEvents.some((event) => event.operation === SecretAccessActions.rotate && event.status === "succeeded")).toBeTrue();
      expect(operationEvents.some((event) => event.operation === SecretAccessActions.disable && event.status === "succeeded")).toBeTrue();
      expect(operationEvents.some((event) => event.operation === SecretAccessActions.retrievePlaintext && event.status === "denied")).toBeTrue();
    } finally {
      service.dispose();
    }
  });
});
