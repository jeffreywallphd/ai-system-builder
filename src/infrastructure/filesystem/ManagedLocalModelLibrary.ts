import path from "node:path";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { ManagedModelLibraryItem, ManagedModelLibrarySnapshot } from "../../application/models/ManagedModelLibrary";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { IManagedModelLibrary } from "../../application/ports/interfaces/IManagedModelLibrary";

interface ArtifactInspection {
  readonly artifactName: string;
  readonly location?: string;
  readonly exists: boolean;
  readonly checksumMismatch: boolean;
  readonly verificationError?: string;
}

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
      const inspections = await inspectArtifacts(this.fileStorage, model);

      for (const inspection of inspections) {
        if (inspection.location) {
          registeredPaths.add(inspection.location);
        }
      }

      items.push(buildManagedItem(model, inspections));
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
        detail: "A model artifact exists on disk, but no installed-model catalog entry references it yet.",
        registered: false,
        verified: false,
        sourceOfTruth: "filesystem",
        artifactCount: 1,
        presentArtifactCount: 1,
        missingArtifactCount: 0,
        verificationErrors: Object.freeze([]),
      }));
    }

    return Object.freeze({
      mode: "managed-local",
      location: this.libraryRoot,
      detail: "Managed local model files are the canonical source of truth in desktop-backed development and desktop production. The installed-model catalog is a durable index reconciled against filesystem reality.",
      sourceOfTruth: "managed-local-filesystem",
      recordedAt: new Date(),
      items: Object.freeze(items.sort((left, right) => left.name.localeCompare(right.name))),
    });
  }
}

async function inspectArtifacts(fileStorage: IFileStorage, model: IModel): Promise<ReadonlyArray<ArtifactInspection>> {
  const artifacts = [model.artifact, ...model.additionalArtifacts];

  return Promise.all(artifacts.map(async (artifact) => {
    const location = artifact.location?.trim() || undefined;
    if (!location) {
      return Object.freeze({
        artifactName: artifact.name,
        location: undefined,
        exists: false,
        checksumMismatch: false,
      });
    }

    const exists = await fileStorage.exists(location);
    if (!exists) {
      return Object.freeze({
        artifactName: artifact.name,
        location,
        exists: false,
        checksumMismatch: false,
      });
    }

    if (!artifact.sha256) {
      return Object.freeze({
        artifactName: artifact.name,
        location,
        exists: true,
        checksumMismatch: false,
      });
    }

    const read = await fileStorage.read(location);
    const hash = await sha256Hex(read.content);
    const checksumMismatch = hash !== artifact.sha256.toLowerCase();

    return Object.freeze({
      artifactName: artifact.name,
      location,
      exists: true,
      checksumMismatch,
      verificationError: checksumMismatch
        ? `Checksum mismatch for ${artifact.name}: expected ${artifact.sha256.toLowerCase()}, received ${hash}.`
        : undefined,
    });
  }));
}

function buildManagedItem(model: IModel, inspections: ReadonlyArray<ArtifactInspection>): ManagedModelLibraryItem {
  const artifactCount = inspections.length;
  const presentArtifactCount = inspections.filter((inspection) => inspection.exists).length;
  const missingArtifactCount = inspections.filter((inspection) => inspection.location && !inspection.exists).length;
  const verificationErrors = inspections
    .map((inspection) => inspection.verificationError)
    .filter((value): value is string => !!value);
  const hasRecordedLocations = inspections.some((inspection) => !!inspection.location);
  const hasChecksumVerification = [model.artifact, ...model.additionalArtifacts].some((artifact) => !!artifact.sha256);

  if (!hasRecordedLocations) {
    return Object.freeze({
      id: model.id,
      name: model.name,
      state: "registered-metadata-only",
      location: undefined,
      detail: "The model is registered in the installed-model catalog, but no managed artifact path is recorded.",
      registered: true,
      verified: false,
      sourceOfTruth: "catalog",
      artifactCount,
      presentArtifactCount,
      missingArtifactCount,
      verificationErrors: Object.freeze(verificationErrors),
    });
  }

  if (presentArtifactCount === 0) {
    return Object.freeze({
      id: model.id,
      name: model.name,
      state: "missing-on-disk",
      location: firstLocation(inspections),
      detail: "The model is still registered, but none of its recorded managed artifacts exist on disk anymore.",
      registered: true,
      verified: false,
      sourceOfTruth: "catalog-and-filesystem",
      artifactCount,
      presentArtifactCount,
      missingArtifactCount,
      verificationErrors: Object.freeze(verificationErrors),
    });
  }

  if (missingArtifactCount > 0) {
    return Object.freeze({
      id: model.id,
      name: model.name,
      state: "partially-installed",
      location: firstLocation(inspections),
      detail: `Only ${presentArtifactCount} of ${artifactCount} recorded artifacts are present on disk.`,
      registered: true,
      verified: false,
      sourceOfTruth: "catalog-and-filesystem",
      artifactCount,
      presentArtifactCount,
      missingArtifactCount,
      verificationErrors: Object.freeze(verificationErrors),
    });
  }

  if (verificationErrors.length > 0) {
    return Object.freeze({
      id: model.id,
      name: model.name,
      state: "corrupted-checksum-mismatch",
      location: firstLocation(inspections),
      detail: "Managed files exist, but checksum verification failed for one or more recorded artifacts.",
      registered: true,
      verified: false,
      sourceOfTruth: "catalog-and-filesystem",
      artifactCount,
      presentArtifactCount,
      missingArtifactCount,
      verificationErrors: Object.freeze(verificationErrors),
    });
  }

  if (hasChecksumVerification) {
    return Object.freeze({
      id: model.id,
      name: model.name,
      state: "installed-and-verified",
      location: firstLocation(inspections),
      detail: "All recorded managed artifacts are present on disk and checksum-verified.",
      registered: true,
      verified: true,
      sourceOfTruth: "catalog-and-filesystem",
      artifactCount,
      presentArtifactCount,
      missingArtifactCount,
      verificationErrors: Object.freeze([]),
    });
  }

  return Object.freeze({
    id: model.id,
    name: model.name,
    state: "installed-but-unverified",
    location: firstLocation(inspections),
    detail: "All recorded managed artifacts are present on disk, but no checksum metadata is available for verification yet.",
    registered: true,
    verified: false,
    sourceOfTruth: "catalog-and-filesystem",
    artifactCount,
    presentArtifactCount,
    missingArtifactCount,
    verificationErrors: Object.freeze([]),
  });
}

function firstLocation(inspections: ReadonlyArray<ArtifactInspection>): string | undefined {
  return inspections.find((inspection) => inspection.location)?.location;
}

async function sha256Hex(content: Uint8Array): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content).digest("hex").toLowerCase();
}
