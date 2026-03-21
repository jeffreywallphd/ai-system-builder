import path from "node:path";
import type { ManagedModelLibraryItem, ManagedModelLibrarySnapshot } from "../../application/models/ManagedModelLibrary";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { IManagedModelLibrary } from "../../application/ports/interfaces/IManagedModelLibrary";

export class ManagedLocalModelLibrary implements IManagedModelLibrary {
  constructor(
    private readonly fileStorage: IFileStorage,
    private readonly installedModelCatalog: IInstalledModelCatalog,
    private readonly libraryRoot: string,
  ) {}

  public async inspectLibrary(): Promise<ManagedModelLibrarySnapshot> {
    const installed = await this.installedModelCatalog.listInstalled();
    const items: ManagedModelLibraryItem[] = [];
    const registeredPaths = new Set<string>();

    for (const model of installed) {
      const location = model.artifact.location?.trim() || undefined;
      if (location) {
        registeredPaths.add(location);
      }

      if (!location) {
        items.push(Object.freeze({
          id: model.id,
          name: model.name,
          state: "registered-metadata-only",
          location: undefined,
          detail: "The model is registered in metadata, but no artifact path is recorded.",
          registered: true,
          verified: false,
        }));
        continue;
      }

      const exists = await this.fileStorage.exists(location);
      if (!exists) {
        items.push(Object.freeze({
          id: model.id,
          name: model.name,
          state: "missing-on-disk",
          location,
          detail: "The model is registered, but the primary artifact is missing from disk.",
          registered: true,
          verified: false,
        }));
        continue;
      }

      if (model.artifact.sha256) {
        const read = await this.fileStorage.read(location);
        const hash = await sha256Hex(read.content);
        if (hash !== model.artifact.sha256.toLowerCase()) {
          items.push(Object.freeze({
            id: model.id,
            name: model.name,
            state: "verification-failed",
            location,
            detail: "The model artifact exists, but checksum verification failed.",
            registered: true,
            verified: false,
          }));
          continue;
        }
      }

      items.push(Object.freeze({
        id: model.id,
        name: model.name,
        state: "installed-and-verified",
        location,
        detail: "The model is registered and its primary artifact is present on disk.",
        registered: true,
        verified: true,
      }));
    }

    const diskEntries = await this.fileStorage.list(this.libraryRoot, { recursive: true });
    for (const entry of diskEntries) {
      if (entry.kind !== "file" || entry.path.endsWith("installed-models.index.json")) {
        continue;
      }
      if (registeredPaths.has(entry.path)) {
        continue;
      }
      items.push(Object.freeze({
        id: `unregistered:${entry.path}`,
        name: path.basename(entry.path),
        state: "downloaded-but-unregistered",
        location: entry.path,
        detail: "A model-like artifact exists on disk, but no installed-model registration references it yet.",
        registered: false,
        verified: false,
      }));
    }

    return Object.freeze({
      mode: "managed-local",
      location: this.libraryRoot,
      detail: "The desktop/dev managed model library is reconciled against real filesystem state.",
      items: Object.freeze(items.sort((left, right) => left.name.localeCompare(right.name))),
    });
  }
}

async function sha256Hex(content: Uint8Array): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content).digest("hex").toLowerCase();
}
