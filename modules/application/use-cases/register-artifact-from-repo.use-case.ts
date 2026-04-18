import type { ArtifactCatalogAppendPort } from "../ports/artifact-catalog";
import type { ArtifactRepoStoragePort, ArtifactStorageBindingPort } from "../ports/storage";
import { createContractError } from "../../contracts/shared";
import {
  createHasArtifactInRepoRequest,
  encodeArtifactRepoBackingLocator,
} from "../../contracts/storage";
import {
  Artifact,
  ArtifactBacking,
  ArtifactId,
  SystemArtifactIdFactory,
  type ArtifactIdFactory,
} from "../../domain/artifact";

export interface RegisterArtifactFromRepoCommand {
  target: {
    provider: string;
    repository: string;
    path: string;
    revision?: string;
  };
  artifactKind?: "image";
  mediaType?: string;
}

export interface RegisterArtifactFromRepoSuccessValue {
  artifactId: string;
  backing: {
    target: {
      provider: string;
      repository: string;
      path: string;
      revision: string;
      locator: string;
    };
    verification: {
      exists: true;
      verifiedAt: string;
    };
    role: "imported-source";
  };
}

export interface RegisterArtifactFromRepoUseCaseDependencies {
  artifactRepoStorage: ArtifactRepoStoragePort;
  artifactBindingStorage: ArtifactStorageBindingPort;
  artifactCatalogAppend: ArtifactCatalogAppendPort;
  now?: () => string;
  artifactIdFactory?: ArtifactIdFactory;
  createArtifactId?: () => ArtifactId;
}

export class RegisterArtifactFromRepoUseCase {
  private readonly artifactRepoStorage: ArtifactRepoStoragePort;
  private readonly artifactBindingStorage: ArtifactStorageBindingPort;
  private readonly artifactCatalogAppend: ArtifactCatalogAppendPort;
  private readonly now: () => string;
  private readonly createArtifactId: () => ArtifactId;

  public constructor(dependencies: RegisterArtifactFromRepoUseCaseDependencies) {
    this.artifactRepoStorage = dependencies.artifactRepoStorage;
    this.artifactBindingStorage = dependencies.artifactBindingStorage;
    this.artifactCatalogAppend = dependencies.artifactCatalogAppend;
    this.now = dependencies.now ?? (() => new Date().toISOString());
    const artifactIdFactory = dependencies.artifactIdFactory ?? new SystemArtifactIdFactory();
    this.createArtifactId = dependencies.createArtifactId ?? (() => artifactIdFactory.createArtifactId());
  }

  public async execute(command: RegisterArtifactFromRepoCommand) {
    const provider = command.target.provider?.trim();
    const repository = command.target.repository?.trim();
    const path = command.target.path?.trim();
    const revision = command.target.revision?.trim() || "main";

    if (!provider || !repository || !path) {
      return {
        ok: false as const,
        error: createContractError(
          "validation",
          "target.provider, target.repository, and target.path must be non-empty strings.",
        ),
      };
    }

    const hasResult = await this.artifactRepoStorage.hasArtifactInRepo(
      createHasArtifactInRepoRequest({ provider, repository, path, revision }),
    );

    if (!hasResult.ok) {
      return hasResult;
    }

    if (!hasResult.value.exists) {
      return {
        ok: false as const,
        error: createContractError(
          "not-found",
          "Remote artifact was not found at the requested provider/repository/path.",
        ),
      };
    }

    // Internal artifact identity is system-owned; repo coordinates remain backing metadata.
    const artifactId = this.createArtifactId();
    const verifiedAt = this.now();
    const locator = encodeArtifactRepoBackingLocator({ repository, path });

    const appendResult = await this.artifactCatalogAppend.appendArtifactCatalogRecord({
      record: {
        storageKey: artifactId.toString(),
        artifactKind: command.artifactKind ?? "image",
        mediaType: command.mediaType?.trim() || undefined,
        originalName: path,
        createdAt: verifiedAt,
      },
    });
    if (!appendResult.ok) {
      return appendResult;
    }

    const artifact = Artifact.create({
      id: artifactId,
      artifactKind: command.artifactKind ?? "image",
    });
    artifact.attachOrUpdateBacking(
      ArtifactBacking.from({
        kind: "artifact-repo",
        provider,
        locator,
        role: "imported-source",
        createdAt: verifiedAt,
        revision,
        target: {
          provider,
          repository,
          path,
          revision,
        },
        verification: {
          exists: true,
          verifiedAt,
        },
      }),
    );
    const importedSource = artifact.latestBackingForRole("imported-source");
    if (!importedSource) {
      return {
        ok: false as const,
        error: createContractError("internal", "Imported-source backing could not be constructed."),
      };
    }

    const bindingResult = await this.artifactBindingStorage.upsertArtifactStorageBinding({
      binding: importedSource.toStorageBinding(artifact.id.toString()),
    });

    if (!bindingResult.ok) {
      return bindingResult;
    }

    return {
      ok: true as const,
      value: {
        artifactId: artifact.id.toString(),
        backing: {
          role: "imported-source",
          target: {
            provider,
            repository,
            path,
            revision,
            locator,
          },
          verification: {
            exists: true,
            verifiedAt,
          },
        },
      } satisfies RegisterArtifactFromRepoSuccessValue,
    };
  }
}

