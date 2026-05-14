import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, it } from "node:test";

import { createWorkspaceId } from "../../../../contracts/workspace";
import { createLocalWorkspaceSystemPackActivationRepository } from "../createLocalWorkspaceSystemPackActivationRepository";
import { LocalWorkspacePersistenceError } from "../localWorkspacePersistenceErrors";
import { resolveWorkspaceSystemPackActivationsFile } from "../localWorkspacePersistencePaths";
import { assertSanitizedErrorText, makeSystemFoundationActivation, makeTempRoot } from "./local-workspace-test-helpers";

describe("createLocalWorkspaceSystemPackActivationRepository", () => {
  it("returns empty activation list when no activation file exists", async () => {
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory: await makeTempRoot() });

    assert.deepEqual(await repository.listWorkspaceSystemPackActivations(createWorkspaceId("workspace.alpha")), []);
  });

  it("saves and reads system.foundation@1.0.0 activation by reference", async () => {
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory: await makeTempRoot() });
    const workspaceId = createWorkspaceId("workspace.alpha");
    const activation = makeSystemFoundationActivation(workspaceId);

    await repository.saveWorkspaceSystemPackActivation(activation);

    assert.deepEqual(await repository.readWorkspaceSystemPackActivation(workspaceId, activation.activationId), activation);
    assert.deepEqual((await repository.listWorkspaceSystemPackActivations(workspaceId)).map((record) => `${record.packId}@${record.packVersion}`), [
      "system.foundation@1.0.0",
    ]);
  });

  it("isolates activations by workspace and sorts deterministically", async () => {
    const rootDirectory = await makeTempRoot();
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory });
    const alphaId = createWorkspaceId("workspace.alpha");
    const betaId = createWorkspaceId("workspace.beta");
    await repository.saveWorkspaceSystemPackActivation(makeSystemFoundationActivation(betaId));
    await repository.saveWorkspaceSystemPackActivation(makeSystemFoundationActivation(alphaId, {
      activationId: "activation.later",
      activatedAt: "2026-05-14T02:00:00.000Z",
    }));
    await repository.saveWorkspaceSystemPackActivation(makeSystemFoundationActivation(alphaId, {
      activationId: "activation.earlier",
      activatedAt: "2026-05-14T01:00:00.000Z",
    }));

    assert.deepEqual((await repository.listWorkspaceSystemPackActivations(alphaId)).map((activation) => activation.activationId), [
      "activation.earlier",
      "activation.later",
    ]);
    assert.deepEqual((await repository.listWorkspaceSystemPackActivations(betaId)).map((activation) => activation.workspaceId), [betaId]);
  });

  it("updates activation status and does not copy pack definitions or manifests", async () => {
    const rootDirectory = await makeTempRoot();
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory });
    const workspaceId = createWorkspaceId("workspace.alpha");
    const activation = makeSystemFoundationActivation(workspaceId);
    await repository.saveWorkspaceSystemPackActivation(activation);

    await repository.updateWorkspaceSystemPackActivation({
      ...activation,
      status: "failed",
      diagnostics: [{ code: "pack-reference-only", severity: "warning", message: "Reference persisted only." }],
    });

    const updated = await repository.readWorkspaceSystemPackActivation(workspaceId, activation.activationId);
    assert.equal(updated?.status, "failed");
    const document = await readFile(resolveWorkspaceSystemPackActivationsFile(rootDirectory, workspaceId), "utf8");
    assert.doesNotMatch(document, /manifest|definitions|assets|assetDefinitions|contents|bytes/i);
  });

  it("round-trips inactive and failed activation statuses", async () => {
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory: await makeTempRoot() });
    const workspaceId = createWorkspaceId("workspace.alpha");
    const inactive = makeSystemFoundationActivation(workspaceId, { activationId: "inactive", status: "inactive" });
    const failed = makeSystemFoundationActivation(workspaceId, { activationId: "failed", status: "failed", activatedAt: "2026-05-14T01:00:00.000Z" });

    await repository.saveWorkspaceSystemPackActivation(inactive);
    await repository.saveWorkspaceSystemPackActivation(failed);

    assert.deepEqual((await repository.listWorkspaceSystemPackActivations(workspaceId)).map((activation) => activation.status), ["inactive", "failed"]);
  });

  it("reports corrupt activation JSON with sanitized errors", async () => {
    const rootDirectory = await makeTempRoot();
    const workspaceId = createWorkspaceId("workspace.alpha");
    const activationFile = resolveWorkspaceSystemPackActivationsFile(rootDirectory, workspaceId);
    await mkdir(dirname(activationFile), { recursive: true });
    await writeFile(activationFile, '{"SECRET_TOKEN":"value", bad json curl http://localhost}', "utf8");
    const repository = createLocalWorkspaceSystemPackActivationRepository({ rootDirectory });

    try {
      await repository.listWorkspaceSystemPackActivations(workspaceId);
      assert.fail("Expected corrupt activations to fail.");
    } catch (error) {
      assert.equal((error as LocalWorkspacePersistenceError).code, "workspace-activation-persistence-read-failed");
      assertSanitizedErrorText(`${(error as { code?: string }).code ?? ""} ${(error as Error).message}`, rootDirectory);
    }
  });
});
