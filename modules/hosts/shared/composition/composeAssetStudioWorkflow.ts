import { createHash, randomUUID } from "node:crypto";

import type { AssetCodingModelPort } from "../../../application/ports/asset-studio";
import { ListAssetStudioWorkflowsUseCase, ProposeAssetStudioChangeUseCase, ReadAssetStudioProposalUseCase, ReviewAssetStudioProposalUseCase, StartAssetStudioUseCase } from "../../../application/use-cases/asset-studio";
import { createStructuredAssetStudioWorkflowRepository } from "../../../adapters/persistence/asset-studio";
import type { StructuredDocumentStore } from "../../../adapters/persistence/shared";
import type { AssetImplementationArtifactPort } from "../../../application/ports/asset-implementation";
import type { AssetImplementationKernelComposition } from "./composeAssetImplementationKernel";
import { normalizeSha256Digest } from "../../../contracts/asset-implementation";
import { normalizeAssetImplementationDraftId, normalizeAssetSourceSnapshotId } from "../../../contracts/asset-implementation";

export function composeAssetStudioWorkflow(options: {
  readonly documents: StructuredDocumentStore;
  readonly implementations: AssetImplementationKernelComposition;
  readonly artifacts: AssetImplementationArtifactPort;
  readonly codingModel?: AssetCodingModelPort;
  readonly codingModelTimeoutMs?: number;
  readonly now: () => string;
}) {
  const workflows = createStructuredAssetStudioWorkflowRepository(options.documents);
  const snapshotSource = options.implementations.useCases.snapshotSource;
  if (!snapshotSource) throw new Error("Asset Studio requires immutable implementation artifact storage.");
  return {
    repository: workflows,
    useCases: {
      propose: new ProposeAssetStudioChangeUseCase({ workflows, implementations: options.implementations.repository, artifacts: options.artifacts, codingModel: options.codingModel, digestText: (value) => normalizeSha256Digest(`sha256:${createHash("sha256").update(value).digest("hex")}`), now: options.now, timeoutMs: options.codingModelTimeoutMs }),
      start: new StartAssetStudioUseCase(options.implementations.useCases.createDraft, () => normalizeAssetImplementationDraftId(`implementation-draft.${randomUUID()}`)),
      review: new ReviewAssetStudioProposalUseCase({ workflows, artifacts: options.artifacts, snapshotSource, nextSnapshotId: () => normalizeAssetSourceSnapshotId(`source-snapshot.${randomUUID()}`), now: options.now }),
      read: new ReadAssetStudioProposalUseCase(workflows, options.artifacts),
      list: new ListAssetStudioWorkflowsUseCase(workflows),
    },
  };
}

export type AssetStudioWorkflowComposition = ReturnType<typeof composeAssetStudioWorkflow>;
