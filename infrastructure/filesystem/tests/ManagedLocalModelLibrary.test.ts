import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Model, ModelArtifact, ModelSource } from "../../../domain/models/Model";
import { ModelCompatibility } from "../../../domain/models/ModelCompatibility";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalModelRepository } from "../LocalModelRepository";
import { ManagedLocalModelLibrary } from "../ManagedLocalModelLibrary";

function makeModel(id: string, location?: string, sha256?: string) {
  return new Model({
    id,
    name: id,
    kind: "generic",
    isRunnable: true,
    status: "installed",
    source: new ModelSource({ type: "local" }),
    artifact: new ModelArtifact({ name: `${id}.bin`, accessMethod: "local-file", location, format: "bin", sha256 }),
    additionalArtifacts: [],
    dependencies: [],
    compatibility: new ModelCompatibility({ inputModalities: [], outputModalities: [], supportedTasks: [], supportedRuntimes: [], architectureFamilies: [], allowsAnyRuntime: true, allowsAnyArchitectureFamily: true, compatibleAssetTypes: [] }),
    requirements: [],
    tags: [],
    languageCodes: [],
    requiresAuth: false,
  });
}

describe("ManagedLocalModelLibrary", () => {
  it("reconciles registered, missing, and unregistered model files truthfully", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ai-loom-model-library-"));
    const fileStorage = new LocalFileStorage();
    const catalog = new LocalModelRepository({ fileStorage, rootDirectory: root });
    const registeredPath = path.join(root, "registered.bin");
    mkdirSync(root, { recursive: true });
    writeFileSync(registeredPath, Buffer.from("ok"));
    writeFileSync(path.join(root, "orphan.bin"), Buffer.from("orphan"));
    await catalog.saveInstalled(makeModel("registered", registeredPath));
    await catalog.saveInstalled(makeModel("missing", path.join(root, "missing.bin")));
    await catalog.saveInstalled(makeModel("metadata-only"));

    const snapshot = await new ManagedLocalModelLibrary(fileStorage, catalog, root).inspectLibrary();
    const states = Object.fromEntries(snapshot.items.map((item) => [item.name, item.state]));

    expect(snapshot.mode).toBe("managed-local");
    expect(states.registered).toBe("installed-and-verified");
    expect(states.missing).toBe("missing-on-disk");
    expect(states["metadata-only"]).toBe("registered-metadata-only");
    expect(states["orphan.bin"]).toBe("downloaded-but-unregistered");
  });
});
