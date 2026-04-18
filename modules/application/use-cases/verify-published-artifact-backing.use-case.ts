import { createContractError } from "../../contracts/shared";
import {
  createHasArtifactInRepoRequest,
  resolveArtifactRepoBackingTarget,
  type ArtifactStorageBinding,
} from "../../contracts/storage";
import type {
  ArtifactRepoStoragePort,
  ArtifactStorageBindingPort,
} from "../ports/storage";

export interface VerifyPublishedArtifactBackingCommand {
  artifactId: string;
}

export interface VerifyPublishedArtifactBackingSuccessValue {
  target: {
    provider: string;
    repository: string;
    path: string;
    revision?: string;
    locator: string;
  };
  verification: {
    exists: boolean;
    verifiedAt: string;
  };
}

export interface VerifyPublishedArtifactBackingUseCaseDependencies {
  artifactRepoStorage: ArtifactRepoStoragePort;
  artifactBindingStorage: ArtifactStorageBindingPort;
  now?: () => string;
}

function pickLatestPublishedBinding(bindings: ArtifactStorageBinding[]): ArtifactStorageBinding | undefined {
  return bindings
    .filter((binding) => binding.role === "published" && binding.backing.kind === "artifact-repo")
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0];
}

export class VerifyPublishedArtifactBackingUseCase {
  private readonly artifactRepoStorage: ArtifactRepoStoragePort;
  private readonly artifactBindingStorage: ArtifactStorageBindingPort;
  private readonly now: () => string;

  public constructor(dependencies: VerifyPublishedArtifactBackingUseCaseDependencies) {
    this.artifactRepoStorage = dependencies.artifactRepoStorage;
    this.artifactBindingStorage = dependencies.artifactBindingStorage;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async execute(command: VerifyPublishedArtifactBackingCommand) {
    const artifactId = command.artifactId.trim();
    if (!artifactId) {
      return {
        ok: false as const,
        error: createContractError("validation", "artifactId must be a non-empty string."),
      };
    }

    const readBindingsResult = await this.artifactBindingStorage.readArtifactStorageBindings({ artifactId });
    if (!readBindingsResult.ok) {
      return readBindingsResult;
    }

    const latestBinding = pickLatestPublishedBinding(readBindingsResult.value.bindings);
    if (!latestBinding) {
      return {
        ok: false as const,
        error: createContractError("not-found", "No published backing exists for this artifact."),
      };
    }

    const target = resolveArtifactRepoBackingTarget(latestBinding.backing);
    if (!target) {
      return {
        ok: false as const,
        error: createContractError("internal", "Published backing target could not be resolved."),
      };
    }

    const hasResult = await this.artifactRepoStorage.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: target.provider,
        repository: target.repository,
        revision: target.revision,
        path: target.path,
      }),
    );
    if (!hasResult.ok) {
      return hasResult;
    }

    const verifiedAt = this.now();
    const upsertResult = await this.artifactBindingStorage.upsertArtifactStorageBinding({
      binding: {
        ...latestBinding,
        createdAt: verifiedAt,
        backing: {
          ...latestBinding.backing,
          target: {
            provider: target.provider,
            repository: target.repository,
            path: target.path,
            revision: target.revision,
          },
          verification: {
            exists: hasResult.value.exists,
            verifiedAt,
          },
        },
      },
    });
    if (!upsertResult.ok) {
      return upsertResult;
    }

    return {
      ok: true as const,
      value: {
        target,
        verification: {
          exists: hasResult.value.exists,
          verifiedAt,
        },
      } satisfies VerifyPublishedArtifactBackingSuccessValue,
    };
  }
}
