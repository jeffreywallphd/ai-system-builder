import { createContractError } from "../../contracts/shared";
import {
  createHasArtifactInRepoRequest,
  createStoreArtifactInRepoRequest,
} from "../../contracts/storage";
import type {
  ArtifactObjectStoragePort,
  ArtifactRepoStoragePort,
  ArtifactStorageBindingPort,
} from "../ports/storage";

export interface PublishArtifactToRepoCommand {
  artifactId: string;
  target: {
    provider: string;
    repository: string;
    revision?: string;
    path?: string;
  };
  mediaType?: string;
}

export interface PublishArtifactToRepoSuccessValue {
  provider: string;
  repository: string;
  path: string;
  revision?: string;
  exists: boolean;
}

export interface PublishArtifactToRepoUseCaseDependencies {
  artifactStorage: ArtifactObjectStoragePort;
  artifactRepoStorage: ArtifactRepoStoragePort;
  artifactBindingStorage: ArtifactStorageBindingPort;
  now?: () => string;
}

export class PublishArtifactToRepoUseCase {
  private readonly artifactStorage: ArtifactObjectStoragePort;
  private readonly artifactRepoStorage: ArtifactRepoStoragePort;
  private readonly artifactBindingStorage: ArtifactStorageBindingPort;
  private readonly now: () => string;

  public constructor(dependencies: PublishArtifactToRepoUseCaseDependencies) {
    this.artifactStorage = dependencies.artifactStorage;
    this.artifactRepoStorage = dependencies.artifactRepoStorage;
    this.artifactBindingStorage = dependencies.artifactBindingStorage;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async execute(command: PublishArtifactToRepoCommand) {
    const artifactId = command.artifactId.trim();
    if (!artifactId) {
      return {
        ok: false as const,
        error: createContractError("validation", "artifactId must be a non-empty string."),
      };
    }

    const targetPath = command.target.path?.trim();
    if (!targetPath) {
      return {
        ok: false as const,
        error: createContractError("validation", "target.path must be a non-empty string."),
      };
    }

    const localResult = await this.artifactStorage.retrieveArtifact({
      key: artifactId,
    });
    if (!localResult.ok) {
      return localResult;
    }

    const storeResult = await this.artifactRepoStorage.storeArtifactInRepo(
      createStoreArtifactInRepoRequest(localResult.value.content as Uint8Array, {
        target: command.target,
        mediaType: command.mediaType ?? localResult.value.descriptor.mediaType,
      }),
    );
    if (!storeResult.ok) {
      return storeResult;
    }

    const hasResult = await this.artifactRepoStorage.hasArtifactInRepo(
      createHasArtifactInRepoRequest(command.target),
    );
    if (!hasResult.ok) {
      return hasResult;
    }

    const revision = command.target.revision?.trim() || "main";
    const bindingResult = await this.artifactBindingStorage.upsertArtifactStorageBinding({
      binding: {
        artifactId,
        role: "published",
        createdAt: this.now(),
        backing: {
          kind: "artifact-repo",
          provider: command.target.provider,
          locator: `${command.target.repository}/${targetPath}`,
          revision,
        },
      },
    });
    if (!bindingResult.ok) {
      return bindingResult;
    }

    return {
      ok: true as const,
      value: {
        provider: command.target.provider,
        repository: command.target.repository,
        path: targetPath,
        revision,
        exists: hasResult.value.exists,
      } satisfies PublishArtifactToRepoSuccessValue,
    };
  }
}
