import {
  createEmbeddingIndexStudioTaxonomy,
  EmbeddingIndexStudioIdentity,
} from "../../../domain/embedding-index-studio/EmbeddingIndexStudioDomain";
import type { AtomicStudioRegistration } from "../StudioShellExtensions";
import { createAtomicStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

export const embeddingIndexStudioRegistration: AtomicStudioRegistration = Object.freeze({
  studioType: EmbeddingIndexStudioIdentity.studioType,
  studioId: EmbeddingIndexStudioIdentity.defaultStudioId,
  displayName: EmbeddingIndexStudioIdentity.defaultStudioName,
  role: "embedding-index",
  defaults: {
    title: "Embedding Index Asset Draft",
    tags: Object.freeze(["embedding-index", "studio-shell"]),
    contentTemplate: JSON.stringify(
      {
        embeddingIndexSpec: {
          provider: "local",
          indexAlgorithm: "hnsw",
          distanceMetric: "cosine",
          dimensions: 1536,
        },
      },
      null,
      2,
    ),
    metadataPatch: createAtomicStudioMetadataPatch({
      title: "Embedding Index Asset Draft",
      tags: ["embedding-index", "studio-shell"],
      summary: "Atomic embedding-index asset drafted through Embedding Index Studio.",
      taxonomy: createEmbeddingIndexStudioTaxonomy(),
      sourceLabel: EmbeddingIndexStudioIdentity.studioType,
    }),
    dependencies: Object.freeze([]),
  },
  extensions: Object.freeze([
    {
      id: "embedding-index-studio-draft-guidance",
      slot: "draft-authoring",
      title: "Embedding index draft guidance",
      subtitle: "Author vector-index identity/version as atomic assets; retrieval execution patterns stay in behavior semantics.",
      order: 10,
      render: ({ snapshot }) => Object.freeze([
        "Keep embedding-index authoring atomic: index identity/version in assets, runtime execution patterns in behaviors.",
        "Asset role: embedding-index (atomic)",
        `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
      ]),
    },
    {
      id: "embedding-index-studio-metadata-summary",
      slot: "metadata",
      title: "Embedding index taxonomy and contract status",
      subtitle: "Read-only projection of backend-authoritative metadata state.",
      order: 20,
      render: ({ snapshot }) => {
        const taxonomy = snapshot?.draft?.metadata.taxonomy;
        return Object.freeze([
          `Taxonomy: ${taxonomy
            ? `${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}`
            : "missing"}`,
          `Contract: ${snapshot?.draft?.metadata.contract ? "present" : "missing"}`,
          `Provenance source: ${snapshot?.draft?.metadata.provenance?.sourceLabel ?? "-"}`,
        ]);
      },
    },
  ]),
});
