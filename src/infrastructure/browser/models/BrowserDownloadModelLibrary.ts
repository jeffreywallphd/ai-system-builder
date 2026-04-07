import type { ManagedModelLibrarySnapshot } from "@application/models/ManagedModelLibrary";
import type { IInstalledModelCatalog } from "@application/ports/interfaces/IInstalledModelCatalog";
import type { IManagedModelLibrary } from "@application/ports/interfaces/IManagedModelLibrary";

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
      detail: "Browser-triggered downloads are not treated as managed local installs. The catalog can retain metadata, but verification, uninstall, and reconciliation are limited to registration state until a desktop-backed managed library is available.",
      sourceOfTruth: "browser-download-fallback",
      recordedAt: new Date(),
      items: Object.freeze(installed.map((model) => Object.freeze({
        id: model.id,
        name: model.name,
        state: "browser-fallback-downloaded-only" as const,
        location: model.artifact.location,
        detail: "This model was downloaded via the browser fallback path. Only metadata deregistration is supported from this environment.",
        registered: true,
        verified: false,
        sourceOfTruth: "browser-download-fallback" as const,
        artifactCount: 1 + model.additionalArtifacts.length,
        presentArtifactCount: 0,
        missingArtifactCount: 0,
        verificationErrors: Object.freeze([]),
      }))),
    });
  }
}

