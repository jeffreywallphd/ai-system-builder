import type { AssetDefinitionRepositoryPort } from "../../../application/ports/asset";
import { SYSTEM_FOUNDATION_FUNCTIONAL_DEFAULTS } from "../../../application/services/asset-packs";
import type {
  AssetImplementationArtifactPort,
  AssetImplementationBuilderPort,
} from "../../../application/ports/asset-implementation";
import {
  BindAssetImplementationReleaseUseCase,
  CreateAssetImplementationDraftUseCase,
  DisableAssetImplementationBindingUseCase,
  ListAssetImplementationReleasesUseCase,
  PublishAssetImplementationReleaseUseCase,
  RequestAssetImplementationBuildUseCase,
  ResolveAssetImplementationUseCase,
  RevokeAssetImplementationReleaseUseCase,
  SnapshotAssetImplementationSourceUseCase,
} from "../../../application/use-cases/asset-implementation";
import { createStructuredAssetImplementationRepository } from "../../../adapters/persistence/asset-implementation";
import type { StructuredDocumentStore } from "../../../adapters/persistence/shared";
import {
  normalizeAssetId,
  type AssetReference,
} from "../../../contracts/asset";
import {
  normalizeAssetImplementationBindingId,
  normalizeAssetImplementationFacetId,
  normalizeAssetImplementationReleaseId,
  type AssetImplementationDeploymentProfile,
  type AssetImplementationFacetKind,
  type AssetImplementationResolutionRequest,
  type TrustedBuiltInImplementationSeed,
} from "../../../contracts/asset-implementation";
import type { WorkspaceId } from "../../../contracts/workspace";

const DEFAULT_PACKAGE_DIGEST = `sha256:${"c".repeat(64)}`;

const LEGACY_TRUSTED_ASSET_IMPLEMENTATION_SEEDS: readonly TrustedBuiltInImplementationSeed[] = [
    {
      definitionRef: {
        kind: "asset-definition-version",
        id: normalizeAssetId("builtin.feature"),
        version: "1.0.0",
      },
      releaseId: normalizeAssetImplementationReleaseId(
        "implementation-release.builtin-feature.1",
      ),
      bindingId: normalizeAssetImplementationBindingId(
        "implementation-binding.builtin-feature.1",
      ),
      version: "1.0.0",
      entryKey: "foundation.feature",
      facetKind: "ui",
      runtimeKind: "trusted-built-in",
      deploymentProfiles: [
        "local-desktop",
        "campus-server",
        "cloud-server",
        "thin-client",
      ],
      packageDigest: DEFAULT_PACKAGE_DIGEST,
    },
];

/** Exact, closed implementation bindings for every immutable foundation entry. */
export const SYSTEM_FOUNDATION_TRUSTED_IMPLEMENTATION_SEEDS: readonly TrustedBuiltInImplementationSeed[] =
  SYSTEM_FOUNDATION_FUNCTIONAL_DEFAULTS.map((descriptor) => {
    const identity = descriptor.definitionId.replace(/[^a-zA-Z0-9._:-]/g, "-");
    return {
      definitionRef: {
        kind: "asset-definition-version",
        id: normalizeAssetId(descriptor.definitionId),
        version: descriptor.definitionVersion,
      },
      releaseId: normalizeAssetImplementationReleaseId(
        `implementation-release.${identity}.1`,
      ),
      bindingId: normalizeAssetImplementationBindingId(
        `implementation-binding.${identity}.1`,
      ),
      version: descriptor.definitionVersion,
      entryKey: descriptor.entryKey,
      facetKind: descriptor.facetKind,
      runtimeKind: descriptor.runtimeKind,
      deploymentProfiles: descriptor.deploymentProfiles,
      packageDigest: DEFAULT_PACKAGE_DIGEST,
    };
  });

export const DEFAULT_TRUSTED_ASSET_IMPLEMENTATION_SEEDS: readonly TrustedBuiltInImplementationSeed[] =
  [
    ...LEGACY_TRUSTED_ASSET_IMPLEMENTATION_SEEDS,
    ...SYSTEM_FOUNDATION_TRUSTED_IMPLEMENTATION_SEEDS,
  ];

export interface ComposeAssetImplementationKernelOptions {
  readonly documents: StructuredDocumentStore;
  readonly definitions: AssetDefinitionRepositoryPort;
  readonly artifacts?: AssetImplementationArtifactPort;
  readonly builder?: AssetImplementationBuilderPort;
  readonly trustedSeeds?: readonly TrustedBuiltInImplementationSeed[];
  readonly now?: () => string;
  readonly createRevocationId?: () => string;
}

export function composeAssetImplementationKernel(
  options: ComposeAssetImplementationKernelOptions,
) {
  const now = options.now ?? (() => new Date().toISOString());
  const repository = createStructuredAssetImplementationRepository(
    options.documents,
  );
  const definitions = {
    readExactDefinition: (reference: AssetReference) =>
      options.definitions.getDefinition(reference),
  };
  const publishRelease = new PublishAssetImplementationReleaseUseCase(
    repository,
    definitions,
    now,
  );
  const bindRelease = new BindAssetImplementationReleaseUseCase(
    repository,
    now,
  );
  const useCases = {
    createDraft: new CreateAssetImplementationDraftUseCase(repository, now),
    ...(options.artifacts
      ? {
          snapshotSource: new SnapshotAssetImplementationSourceUseCase(
            repository,
            options.artifacts,
            now,
          ),
        }
      : {}),
    ...(options.builder
      ? {
          requestBuild: new RequestAssetImplementationBuildUseCase(
            repository,
            options.builder,
            now,
          ),
        }
      : {}),
    publishRelease,
    bindRelease,
    disableBinding: new DisableAssetImplementationBindingUseCase(
      repository,
      now,
    ),
    revokeRelease: new RevokeAssetImplementationReleaseUseCase(
      repository,
      options.createRevocationId ??
        (() => `implementation-revocation.${Date.now()}`),
      now,
    ),
    resolve: new ResolveAssetImplementationUseCase(repository),
    listReleases: new ListAssetImplementationReleasesUseCase(repository),
  };

  return {
    repository,
    useCases,
    async ensureTrustedBuiltIns(): Promise<void> {
      for (const seed of options.trustedSeeds ??
        DEFAULT_TRUSTED_ASSET_IMPLEMENTATION_SEEDS) {
        const published = await publishRelease.execute({
          releaseId: seed.releaseId,
          definitionRef: seed.definitionRef,
          version: seed.version,
          trustLevel: "system-trusted",
          facets: [
            {
              facetId: normalizeAssetImplementationFacetId(
                `facet.${seed.releaseId}.${seed.facetKind}`,
              ),
              kind: seed.facetKind,
              runtimeKind: seed.runtimeKind,
              entryKey: seed.entryKey,
              requiredCapabilities: [],
              compatibility: {
                definitionVersion: seed.definitionRef.version!,
                hostApiRange: ">=1.0.0 <2.0.0",
                deploymentProfiles: seed.deploymentProfiles,
              },
            },
          ],
          packageDigest: seed.packageDigest,
          actorId: "system",
        });
        if (!published.ok) throw new Error(published.error.message);

        const bound = await bindRelease.execute({
          bindingId: seed.bindingId,
          definitionRef: seed.definitionRef,
          releaseId: seed.releaseId,
          priority: 1000,
          actorId: "system",
        });
        if (!bound.ok) {
          const existing = await repository.readBinding(seed.bindingId);
          if (!existing) throw new Error(bound.error.message);
        }
      }
    },
    resolveTrustedBuiltIn(
      workspaceId: WorkspaceId,
      deploymentProfile: AssetImplementationDeploymentProfile,
      definitionRef: AssetReference,
    ) {
      const request: AssetImplementationResolutionRequest = {
        workspaceId,
        definitionRef,
        requiredFacets: ["ui"],
        deploymentProfile,
        availableCapabilities: [],
        permittedTrustLevels: ["system-trusted"],
        hostApiVersion: "1.0.0",
      };
      return useCases.resolve.execute(request);
    },
    resolveFoundationDefault(
      workspaceId: WorkspaceId,
      deploymentProfile: AssetImplementationDeploymentProfile,
      definitionRef: AssetReference,
      requiredFacet: AssetImplementationFacetKind,
    ) {
      const request: AssetImplementationResolutionRequest = {
        workspaceId,
        definitionRef,
        requiredFacets: [requiredFacet],
        deploymentProfile,
        availableCapabilities: [],
        permittedTrustLevels: ["system-trusted"],
        hostApiVersion: "1.0.0",
      };
      return useCases.resolve.execute(request);
    },
  };
}

export type AssetImplementationKernelComposition = ReturnType<
  typeof composeAssetImplementationKernel
>;
