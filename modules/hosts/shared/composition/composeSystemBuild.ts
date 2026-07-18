import type { SystemBuildArtifactPort, SystemBuildHasherPort, SystemBuildImplementationResolverPort } from "../../../application/ports/system-build";
import { createDeterministicSystemBuildMaterializer } from "../../../application/services/system-build";
import { ApproveSystemReleaseUseCase, CancelSystemBuildUseCase, CompareSystemReleasesUseCase, ListSystemBuildsUseCase, ListSystemReleasesUseCase, ReadSystemBuildUseCase, ReadSystemReleaseUseCase, RequestSystemBuildUseCase } from "../../../application/use-cases/system-build";
import { createStructuredSystemBuildRepository } from "../../../adapters/persistence/system-build";
import type { StructuredDocumentStore } from "../../../adapters/persistence/shared";
import type { SystemBuilderCompositionRoot } from "./composeSystemBuilder";

export interface ComposeSystemBuildOptions {
  readonly documents: StructuredDocumentStore;
  readonly systemBuilder: SystemBuilderCompositionRoot;
  readonly resolver: SystemBuildImplementationResolverPort;
  readonly artifacts: SystemBuildArtifactPort;
  readonly hasher: SystemBuildHasherPort;
  readonly now?: () => string;
}

export function composeSystemBuild(options: ComposeSystemBuildOptions) {
  const repository = createStructuredSystemBuildRepository(options.documents);
  const request = new RequestSystemBuildUseCase({
    repository, systems: options.systemBuilder.repository, validator: options.systemBuilder.validator,
    resolver: options.resolver, artifacts: options.artifacts, hasher: options.hasher,
    materializer: createDeterministicSystemBuildMaterializer(), now: options.now,
  });
  return {
    repository,
    useCases: {
      request,
      cancel: new CancelSystemBuildUseCase(repository, options.now),
      read: new ReadSystemBuildUseCase(repository),
      list: new ListSystemBuildsUseCase(repository),
      approve: new ApproveSystemReleaseUseCase(repository, options.artifacts, options.hasher, options.now),
      readRelease: new ReadSystemReleaseUseCase(repository),
      listReleases: new ListSystemReleasesUseCase(repository),
      compareReleases: new CompareSystemReleasesUseCase(repository),
    },
  };
}

export type SystemBuildCompositionRoot = ReturnType<typeof composeSystemBuild>;
