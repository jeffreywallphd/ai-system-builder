import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { Model, ModelArtifact, ModelSource } from "../../../src/domain/models/Model";
import { ModelCompatibility } from "../../../src/domain/models/ModelCompatibility";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalModelRepository } from "../LocalModelRepository";
import { ManagedLocalModelLibrary } from "../ManagedLocalModelLibrary";

function sha256(value: string): string {
  return createHash("sha256").update(Buffer.from(value)).digest("hex");
}

function makeModel(id: string, location?: string, sha?: string, additionalArtifacts: ModelArtifact[] = []) {
  return new Model({
    id,
    name: id,
    kind: "generic",
    isRunnable: true,
    status: "installed",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({ name: `${id}.bin`, accessMethod: "local-file", location, format: "bin", sha256: sha }),
    additionalArtifacts,
    dependencies: [],
    compatibility: new ModelCompatibility({ inputModalities: [], outputModalities: [], supportedTasks: [], supportedRuntimes: [], architectureFamilies: [], allowsAnyRuntime: true, allowsAnyArchitectureFamily: true, compatibleAssetTypes: [] }),
    requirements: [],
    tags: [],
    languageCodes: [],
    requiresAuth: false,
  });
}

describe("ManagedLocalModelLibrary", () => {
  it("reconciles registered, missing, partial, corrupted, and unregistered model files truthfully", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-model-library-"));
    const fileStorage = new LocalFileStorage();
    const catalog = new LocalModelRepository({ fileStorage, rootDirectory: root });
    const registeredPath = path.join(root, "registered.bin");
    const partialMainPath = path.join(root, "partial-main.bin");
    const corruptedPath = path.join(root, "corrupted.bin");
    mkdirSync(root, { recursive: true });
    writeFileSync(registeredPath, Buffer.from("ok"));
    writeFileSync(partialMainPath, Buffer.from("partial"));
    writeFileSync(corruptedPath, Buffer.from("bad-data"));
    writeFileSync(path.join(root, "orphan.bin"), Buffer.from("orphan"));
    await catalog.saveInstalled(makeModel("registered", registeredPath, sha256("ok")));
    await catalog.saveInstalled(makeModel("missing", path.join(root, "missing.bin")));
    await catalog.saveInstalled(makeModel("metadata-only"));
    await catalog.saveInstalled(makeModel("partial", partialMainPath, undefined, [new ModelArtifact({ name: "missing-sidecar.bin", accessMethod: "local-file", location: path.join(root, "missing-sidecar.bin"), format: "bin" })]));
    await catalog.saveInstalled(makeModel("corrupted", corruptedPath, sha256("expected")));

    const snapshot = await new ManagedLocalModelLibrary(fileStorage, catalog, root).inspectLibrary();
    const states = Object.fromEntries(snapshot.items.map((item) => [item.name, item.state]));

    expect(snapshot.mode).toBe("managed-local");
    expect(snapshot.sourceOfTruth).toBe("managed-local-filesystem");
    expect(states.registered).toBe("installed-and-verified");
    expect(states.missing).toBe("missing-on-disk");
    expect(states["metadata-only"]).toBe("registered-metadata-only");
    expect(states.partial).toBe("partially-installed");
    expect(states.corrupted).toBe("corrupted-checksum-mismatch");
    expect(states["orphan.bin"]).toBe("downloaded-but-unregistered");
  });
});
