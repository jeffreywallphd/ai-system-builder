import { describe, expect, it } from "../../../../testing/node-test";
import {
  normalizeAssetId,
  type AssetDefinition,
  type AssetInstance,
  type AssetReference,
} from "../../../../contracts/asset";
import {
  normalizeAssetImplementationFacetId,
  normalizeAssetImplementationReleaseId,
} from "../../../../contracts/asset-implementation";
import {
  normalizeSystemBuilderRevisionId,
  normalizeSystemBuilderSystemId,
  type SystemBuilderRevision,
} from "../../../../contracts/system-builder";
import {
  normalizeSystemBuildArtifactId,
  normalizeSystemBuildId,
  normalizeSystemReleaseId,
  type SystemBuildArtifactDescriptor,
} from "../../../../contracts/system-build";
import { createWorkspaceId } from "../../../../contracts/workspace";
import { createInMemoryStructuredDocumentStore } from "../../../../adapters/persistence/shared";
import { createStructuredSystemBuildRepository } from "../../../../adapters/persistence/system-build";
import { createSha256SystemBuildHasher } from "../../../../adapters/storage/system-build";
import { ValidateSystemBuilderRevisionService } from "../../../services/system-builder";
import { createDeterministicSystemBuildMaterializer } from "../../../services/system-build";
import type { SystemBuilderRepositoryPort } from "../../../ports/system-builder";
import type {
  SystemBuildArtifactPort,
  SystemBuildImplementationResolverPort,
} from "../../../ports/system-build";
import {
  ApproveSystemReleaseUseCase,
  CompareSystemReleasesUseCase,
  RequestSystemBuildUseCase,
} from "../system-build-use-cases";

const workspaceId = createWorkspaceId("workspace-build-test");
const systemId = normalizeSystemBuilderSystemId("system.build-test");
const systemRevisionId = normalizeSystemBuilderRevisionId(
  "system-revision.build-test.1",
);
const definitionRef: AssetReference = {
  kind: "asset-definition-version",
  id: normalizeAssetId("builtin.ui.page"),
  version: "1.0.0",
};
const compositionId = normalizeAssetId("composition.build-test");
const instance: AssetInstance = {
  instanceId: normalizeAssetId("instance.page"),
  definitionRef,
  displayName: "Page",
  lifecycleStatus: "draft",
  selectedConfiguration: {},
  parentCompositionRef: { kind: "asset-composition", id: compositionId },
  provenance: { sourceKind: "human-authored" },
};
const revision: SystemBuilderRevision = {
  revisionId: systemRevisionId,
  systemId,
  targetWorkspaceId: workspaceId,
  revisionNumber: 1,
  composition: {
    compositionId,
    compositionType: "system",
    displayName: "Build test",
    version: "0.1.0",
    lifecycleStatus: "draft",
    rootInstanceRefs: [
      {
        kind: "asset-instance",
        id: normalizeAssetId(String(instance.instanceId)),
      },
    ],
    instanceRefs: [
      {
        kind: "asset-instance",
        id: normalizeAssetId(String(instance.instanceId)),
      },
    ],
    bindingRefs: [],
    provenance: { sourceKind: "human-authored" },
  },
  instances: [instance],
  bindings: [],
  validationIssues: [],
  createdAt: "2026-07-17T00:00:00.000Z",
  createdBy: "user-1",
};
const definition: AssetDefinition = {
  definitionId: normalizeAssetId("builtin.ui.page"),
  assetType: "page",
  assetFamily: "structural",
  version: "1.0.0",
  displayName: "Page",
  description: "Page",
  lifecycleStatus: "published",
  provenance: { sourceKind: "system-generated" },
};

function systemRepository(
  value: SystemBuilderRevision = revision,
): SystemBuilderRepositoryPort {
  return {
    createRecordAndRevision: async () => {
      throw new Error("unused");
    },
    createRecord: async () => {
      throw new Error("unused");
    },
    readRecord: async () => undefined,
    listRecords: async () => [],
    updateRecord: async () => {
      throw new Error("unused");
    },
    saveRevision: async (value) => value,
    saveRevisionAndRecord: async () => {
      throw new Error("unused");
    },
    readRevision: async (
      requestedWorkspace,
      requestedSystem,
      requestedRevision,
    ) =>
      requestedWorkspace === workspaceId &&
      requestedSystem === systemId &&
      requestedRevision === systemRevisionId
        ? value
        : undefined,
    listRevisions: async () => [value],
  };
}

function artifactPort(hasher = createSha256SystemBuildHasher()) {
  const content = new Map<string, Uint8Array>();
  let tampered = false;
  const port: SystemBuildArtifactPort = {
    async putImmutable(request) {
      const bytes =
        typeof request.content === "string"
          ? new TextEncoder().encode(request.content)
          : (request.content as Uint8Array);
      const digest = hasher.digest(bytes);
      const descriptor: SystemBuildArtifactDescriptor = {
        artifactId: normalizeSystemBuildArtifactId(
          `artifact:${request.kind}:${digest.slice(7)}`,
        ),
        kind: request.kind,
        digest,
        mediaType: request.mediaType,
        sizeBytes: bytes.byteLength,
      };
      content.set(digest, bytes);
      return descriptor;
    },
    async readVerified(_workspace, descriptor) {
      if (tampered || !content.has(descriptor.digest))
        throw new Error("tampered");
      return content.get(descriptor.digest) as never;
    },
  };
  return {
    port,
    tamper: () => {
      tampered = true;
    },
  };
}

function resolver(ready = true): SystemBuildImplementationResolverPort {
  return {
    async resolve(request) {
      if (!ready || request.requiredFacets[0] !== "ui")
        return {
          status: ready ? "incompatible" : "unimplemented",
          definitionRef: request.definitionRef,
          selectedFacets: [],
          diagnostics: [
            {
              severity: "error",
              code: ready ? "facet.missing" : "implementation.missing",
              message: ready
                ? "Facet unavailable."
                : "Implementation unavailable.",
            },
          ],
        };
      return {
        status: "ready",
        definitionRef: request.definitionRef,
        selectedRelease: {
          releaseId: normalizeAssetImplementationReleaseId(
            "implementation.page.1",
          ),
          definitionRef,
          version: "1.0.0",
          status: "published",
          trustLevel: "system-trusted",
          facetKinds: ["ui"],
          packageDigest: `sha256:${"b".repeat(64)}`,
          publishedAt: "2026-07-17T00:00:00.000Z",
          revoked: false,
        },
        selectedFacets: [
          {
            facetId: normalizeAssetImplementationFacetId("facet.page.ui"),
            kind: "ui",
            runtimeKind: "trusted-built-in",
            entryKey: "foundation.page",
            requiredCapabilities: [],
            compatibility: {
              definitionVersion: "1.0.0",
              hostApiRange: ">=1.0.0 <2.0.0",
              deploymentProfiles: [
                "local-desktop",
                "campus-server",
                "cloud-server",
                "thin-client",
              ],
            },
          },
        ],
        diagnostics: [],
      };
    },
  };
}

function command(buildId: string) {
  return {
    buildId: normalizeSystemBuildId(buildId),
    workspaceId,
    systemId,
    systemRevisionId,
    deploymentProfile: "local-desktop" as const,
    availableCapabilities: [],
    permittedTrustLevels: ["system-trusted" as const],
    hostApiVersion: "1.0.0",
    toolchainProfile: "system-builder/1.0.0",
    actorId: "user-1",
  };
}

describe("system build and release use cases", () => {
  it("produces repeatable content-addressed builds and an immutable approved release", async () => {
    const repository = createStructuredSystemBuildRepository(
      createInMemoryStructuredDocumentStore(),
    );
    const hasher = createSha256SystemBuildHasher();
    const artifacts = artifactPort(hasher);
    const build = new RequestSystemBuildUseCase({
      repository,
      systems: systemRepository(),
      validator: new ValidateSystemBuilderRevisionService({
        readExactDefinition: async () => definition,
      }),
      resolver: resolver(),
      artifacts: artifacts.port,
      hasher,
      materializer: createDeterministicSystemBuildMaterializer(),
      now: () => "2026-07-17T00:00:00.000Z",
    });
    const first = await build.execute(command("build.one"));
    const second = await build.execute(command("build.two"));
    expect(first.ok && first.value.status).toBe("succeeded");
    expect(second.ok && second.value.status).toBe("succeeded");
    if (!first.ok || !second.ok || !first.value.lockDigest)
      throw new Error("Expected successful builds.");
    expect(first.value.lockDigest).toBe(second.value.lockDigest);
    expect(first.value.outputArtifacts.map((item) => item.digest)).toEqual(
      second.value.outputArtifacts.map((item) => item.digest),
    );
    const approve = new ApproveSystemReleaseUseCase(
      repository,
      artifacts.port,
      hasher,
      () => "2026-07-17T01:00:00.000Z",
    );
    const approved = await approve.execute({
      workspaceId,
      buildId: first.value.buildId,
      expectedLockDigest: first.value.lockDigest,
      actorId: "approver-1",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error("Expected release.");
    expect(String(approved.value.releaseId)).toBe(
      `system-release:${approved.value.releaseDigest.slice(7)}`,
    );
    expect(approved.value.compatibility.deploymentProfiles).toEqual([
      "local-desktop",
      "campus-server",
      "cloud-server",
      "thin-client",
    ]);
    const comparison = await new CompareSystemReleasesUseCase(
      repository,
    ).execute({
      workspaceId,
      leftReleaseId: approved.value.releaseId,
      rightReleaseId: approved.value.releaseId,
    });
    expect(comparison.ok && comparison.value).toMatchObject({
      sameInputs: true,
      sameArtifacts: true,
      changedImplementationInstanceIds: [],
    });
  });

  it("fails closed for unresolved implementations and tampered evidence", async () => {
    const repository = createStructuredSystemBuildRepository(
      createInMemoryStructuredDocumentStore(),
    );
    const hasher = createSha256SystemBuildHasher();
    const artifacts = artifactPort(hasher);
    const build = new RequestSystemBuildUseCase({
      repository,
      systems: systemRepository(),
      validator: new ValidateSystemBuilderRevisionService({
        readExactDefinition: async () => definition,
      }),
      resolver: resolver(false),
      artifacts: artifacts.port,
      hasher,
      materializer: createDeterministicSystemBuildMaterializer(),
      now: () => "2026-07-17T00:00:00.000Z",
    });
    const blocked = await build.execute(command("build.blocked"));
    expect(blocked.ok && blocked.value.status).toBe("failed");
    const good = new RequestSystemBuildUseCase({
      repository,
      systems: systemRepository(),
      validator: new ValidateSystemBuilderRevisionService({
        readExactDefinition: async () => definition,
      }),
      resolver: resolver(),
      artifacts: artifacts.port,
      hasher,
      materializer: createDeterministicSystemBuildMaterializer(),
      now: () => "2026-07-17T00:00:00.000Z",
    });
    const successful = await good.execute(command("build.tamper"));
    if (!successful.ok || !successful.value.lockDigest)
      throw new Error("Expected successful build.");
    artifacts.tamper();
    const denied = await new ApproveSystemReleaseUseCase(
      repository,
      artifacts.port,
      hasher,
    ).execute({
      workspaceId,
      buildId: successful.value.buildId,
      expectedLockDigest: successful.value.lockDigest,
      releaseId: normalizeSystemReleaseId("release.invalid"),
      actorId: "approver-1",
    });
    expect(denied).toMatchObject({ ok: false, error: { code: "integrity" } });
  });

  it("rejects a system revision that exceeds the bounded build instance count", async () => {
    const repository = createStructuredSystemBuildRepository(
      createInMemoryStructuredDocumentStore(),
    );
    const hasher = createSha256SystemBuildHasher();
    const artifacts = artifactPort(hasher);
    const build = new RequestSystemBuildUseCase({
      repository,
      systems: systemRepository({
        ...revision,
        instances: Array.from({ length: 5_001 }, () => instance),
      }),
      validator: new ValidateSystemBuilderRevisionService({
        readExactDefinition: async () => definition,
      }),
      resolver: resolver(),
      artifacts: artifacts.port,
      hasher,
      materializer: createDeterministicSystemBuildMaterializer(),
      now: () => "2026-07-17T00:00:00.000Z",
    });

    const result = await build.execute(command("build.oversized"));

    expect(result.ok && result.value.status).toBe("failed");
    expect(
      result.ok ? result.value.diagnostics[0]?.code : result.error.code,
    ).toBe("system.build.instance-count-exceeded");
  });
});
