import { describe, expect, it } from "bun:test";
import {
  ExchangeBundleReferenceRelations,
  ExchangeBundleSubjectKinds,
  createExchangeBundle,
} from "../ExchangeBundleDomain";

describe("ExchangeBundleDomain", () => {
  it("represents atomic/composite/system exchange subjects with pinned references", () => {
    const atomic = createExchangeBundle({
      bundleId: "bundle:atomic:v1",
      subject: {
        root: {
          assetId: "asset:model",
          versionId: "asset:model:v3",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        references: [],
      },
      dependencySnapshot: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v2", relation: "direct" }],
    });

    const composite = createExchangeBundle({
      bundleId: "bundle:composite:v1",
      subject: {
        root: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v7",
          kind: ExchangeBundleSubjectKinds.compositeAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        },
        references: [
          {
            assetId: "asset:model",
            versionId: "asset:model:v3",
            kind: ExchangeBundleSubjectKinds.atomicAsset,
            relation: ExchangeBundleReferenceRelations.component,
          },
        ],
      },
    });

    const system = createExchangeBundle({
      bundleId: "bundle:system:v1",
      subject: {
        root: {
          assetId: "system:root",
          versionId: "system:root:v11",
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.root,
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" },
        },
        references: [
          {
            assetId: "system:child",
            versionId: "system:child:v2",
            kind: ExchangeBundleSubjectKinds.systemAsset,
            relation: ExchangeBundleReferenceRelations.nestedSystem,
          },
        ],
      },
      formatVersion: "ai-loom.exchange-bundle.v3",
    });

    expect(atomic.subject.root.kind).toBe("atomic-asset");
    expect(composite.subject.root.kind).toBe("composite-asset");
    expect(system.subject.root.kind).toBe("system-asset");
    expect(system.subject.references.map((entry) => `${entry.relation}:${entry.assetId}@${entry.versionId}`)).toEqual([
      "nested-system:system:child@system:child:v2",
      "root:system:root@system:root:v11",
    ]);
  });

  it("keeps bundle identity and format version distinct from asset version identity", () => {
    const bundle = createExchangeBundle({
      bundleId: "bundle:portable:2026-03-28",
      formatVersion: "ai-loom.exchange-bundle.v9",
      subject: {
        root: {
          assetId: "asset:prompt",
          versionId: "asset:prompt:v5",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
    });

    expect(bundle.bundleId.value).toBe("bundle:portable:2026-03-28");
    expect(bundle.formatVersion.value).toBe("ai-loom.exchange-bundle.v9");
    expect(bundle.subject.root.versionId).toBe("asset:prompt:v5");
    expect(bundle.bundleId.value).not.toContain(bundle.subject.root.versionId);
  });

  it("captures provenance metadata without mutating asset truth and stays distinct from runtime/deployment semantics", () => {
    const bundle = createExchangeBundle({
      bundleId: "bundle:handoff:v1",
      subject: {
        root: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v2",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      provenance: {
        originType: "handoff",
        sourceBundleId: "bundle:source:v5",
        sourceVersionLineage: ["asset:dataset:v1", "asset:dataset:v1", "asset:dataset:v0"],
        handoffSessionId: "handoff-session:42",
        metadata: { lane: "studio-handoff", actor: "user:123" },
      },
    });

    expect(bundle.provenance?.originType).toBe("handoff");
    expect(bundle.provenance?.sourceVersionLineage).toEqual(["asset:dataset:v0", "asset:dataset:v1"]);
    expect(bundle.scope).toEqual({ excludesRuntimeState: true, excludesDeploymentState: true });
  });
});
