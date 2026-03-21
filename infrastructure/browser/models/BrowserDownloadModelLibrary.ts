import type { ManagedModelLibrarySnapshot } from "../../../application/models/ManagedModelLibrary";
import type { IInstalledModelCatalog } from "../../../application/ports/interfaces/IInstalledModelCatalog";
import type { IManagedModelLibrary } from "../../../application/ports/interfaces/IManagedModelLibrary";

export class BrowserDownloadModelLibrary implements IManagedModelLibrary {
  constructor(
    private readonly installedModelCatalog: IInstalledModelCatalog,
    private readonly location: string,
  ) {}

  public async inspectLibrary(): Promise<ManagedModelLibrarySnapshot> {
    const installed = await this.installedModelCatalog.listInstalled();
    return Object.freeze({
      mode: "browser-download-fallback",
      location: this.location,
      detail: "This browser-only path can register model metadata, but it does not manage a verified local model library.",
      items: Object.freeze(installed.map((model) => Object.freeze({
        id: model.id,
        name: model.name,
        state: "registered-metadata-only" as const,
        location: model.artifact.location,
        detail: "Browser-triggered downloads are not treated as a managed local install pipeline.",
        registered: true,
        verified: false,
      }))),
    });
  }
}
