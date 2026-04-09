import type { GeneratedResultLineageRecord } from "../ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultLineageDetailDto,
  GeneratedResultLineageSummaryDto,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";
import type { GeneratedResultPersistenceRecord } from "@shared/dto/assets/GeneratedResultPersistenceDtos";

interface NormalizedGeneratedResultLineage {
  readonly resultAssetId: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly inputAssetIds: ReadonlyArray<string>;
  readonly workflowTemplateVersionId?: string;
  readonly workflowTemplateVersionTag?: string;
  readonly systemSnapshotId?: string;
  readonly systemVersionTag?: string;
  readonly parameterSnapshotId?: string;
  readonly selectedNodeId?: string;
  readonly executionAdapterKind?: string;
  readonly executionBackendFamily?: string;
}

function normalizeLineage(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly lineage: GeneratedResultLineageRecord | undefined;
}): NormalizedGeneratedResultLineage {
  const source = input.lineage ?? {
    resultAssetId: input.record.resultAssetId,
    runId: input.record.runId,
    systemId: input.record.systemId,
    workflowId: input.record.workflowId,
    workflowTemplateId: input.record.workflowTemplateId,
    executionNodeId: input.record.executionNodeId,
    outputSlot: input.record.outputSlot,
    inputAssetIds: input.record.inputAssetIds,
    workflowTemplateVersionId: input.record.workflowTemplateVersionId,
    workflowTemplateVersionTag: input.record.workflowTemplateVersionTag,
    systemSnapshotId: input.record.systemSnapshotId,
    systemVersionTag: input.record.systemVersionTag,
    parameterSnapshotId: input.record.parameterSnapshotId,
    selectedNodeId: input.record.selectedNodeId,
    executionAdapterKind: input.record.executionAdapterKind,
    executionBackendFamily: input.record.executionBackendFamily,
  };

  return Object.freeze({
    resultAssetId: source.resultAssetId,
    runId: source.runId,
    systemId: source.systemId,
    workflowId: source.workflowId,
    workflowTemplateId: source.workflowTemplateId,
    executionNodeId: source.executionNodeId,
    outputSlot: source.outputSlot,
    inputAssetIds: Object.freeze([...source.inputAssetIds]),
    workflowTemplateVersionId: source.workflowTemplateVersionId,
    workflowTemplateVersionTag: source.workflowTemplateVersionTag,
    systemSnapshotId: source.systemSnapshotId,
    systemVersionTag: source.systemVersionTag,
    parameterSnapshotId: source.parameterSnapshotId,
    selectedNodeId: source.selectedNodeId,
    executionAdapterKind: source.executionAdapterKind,
    executionBackendFamily: source.executionBackendFamily,
  });
}

export function toGeneratedResultLineageSummaryDto(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly lineage: GeneratedResultLineageRecord | undefined;
}): GeneratedResultLineageSummaryDto {
  const normalized = normalizeLineage(input);
  return Object.freeze({
    resultAssetId: normalized.resultAssetId,
    runId: normalized.runId,
    systemId: normalized.systemId,
    workflowId: normalized.workflowId,
    workflowTemplateId: normalized.workflowTemplateId,
    executionNodeId: normalized.executionNodeId,
    outputSlot: normalized.outputSlot,
    inputAssetCount: normalized.inputAssetIds.length,
    hasWorkflowTemplateVersion: Boolean(normalized.workflowTemplateVersionId),
    hasSystemSnapshot: Boolean(normalized.systemSnapshotId),
    hasParameterSnapshot: Boolean(normalized.parameterSnapshotId),
    hasSelectedNode: Boolean(normalized.selectedNodeId),
  });
}

export function toGeneratedResultLineageDetailDto(input: {
  readonly record: GeneratedResultPersistenceRecord;
  readonly lineage: GeneratedResultLineageRecord | undefined;
}): GeneratedResultLineageDetailDto {
  const normalized = normalizeLineage(input);
  const summary = toGeneratedResultLineageSummaryDto(input);

  const resultNodeId = `lineage-node:result:${normalized.resultAssetId}`;
  const runNodeId = `lineage-node:run:${normalized.runId}`;
  const workflowNodeId = `lineage-node:workflow:${normalized.workflowId}`;
  const systemNodeId = `lineage-node:system:${normalized.systemId}`;
  const executionNodeReferenceId = normalized.executionNodeId ?? normalized.selectedNodeId;
  const executionNodeId = executionNodeReferenceId
    ? `lineage-node:execution-node:${executionNodeReferenceId}`
    : undefined;

  const inputNodes = normalized.inputAssetIds.map((assetId) => Object.freeze({
    nodeId: `lineage-node:input-asset:${assetId}`,
    nodeType: "input-asset" as const,
    referenceId: assetId,
  }));

  const nodes = Object.freeze([
    Object.freeze({
      nodeId: resultNodeId,
      nodeType: "result" as const,
      referenceId: normalized.resultAssetId,
    }),
    Object.freeze({
      nodeId: runNodeId,
      nodeType: "run" as const,
      referenceId: normalized.runId,
    }),
    Object.freeze({
      nodeId: workflowNodeId,
      nodeType: "workflow" as const,
      referenceId: normalized.workflowId,
    }),
    Object.freeze({
      nodeId: systemNodeId,
      nodeType: "system" as const,
      referenceId: normalized.systemId,
    }),
    ...(executionNodeId
      ? [Object.freeze({
        nodeId: executionNodeId,
        nodeType: "execution-node" as const,
        referenceId: executionNodeReferenceId!,
      })]
      : []),
    ...inputNodes,
  ]);

  const baseEdges = [
    Object.freeze({
      edgeId: `lineage-edge:produced-by-run:${runNodeId}:${resultNodeId}`,
      fromNodeId: runNodeId,
      toNodeId: resultNodeId,
      relation: "produced-by-run" as const,
    }),
    Object.freeze({
      edgeId: `lineage-edge:run-used-workflow:${runNodeId}:${workflowNodeId}`,
      fromNodeId: runNodeId,
      toNodeId: workflowNodeId,
      relation: "run-used-workflow" as const,
    }),
    Object.freeze({
      edgeId: `lineage-edge:run-targeted-system:${runNodeId}:${systemNodeId}`,
      fromNodeId: runNodeId,
      toNodeId: systemNodeId,
      relation: "run-targeted-system" as const,
    }),
  ];
  const executionEdge = executionNodeId
    ? [Object.freeze({
      edgeId: `lineage-edge:run-executed-on-node:${runNodeId}:${executionNodeId}`,
      fromNodeId: runNodeId,
      toNodeId: executionNodeId,
      relation: "run-executed-on-node" as const,
    })]
    : [];
  const inputEdges = inputNodes.map((node) => Object.freeze({
    edgeId: `lineage-edge:result-derived-from-input:${node.nodeId}:${resultNodeId}`,
    fromNodeId: node.nodeId,
    toNodeId: resultNodeId,
    relation: "result-derived-from-input" as const,
  }));

  return Object.freeze({
    summary,
    source: Object.freeze({
      workflowTemplateVersionId: normalized.workflowTemplateVersionId,
      workflowTemplateVersionTag: normalized.workflowTemplateVersionTag,
      systemSnapshotId: normalized.systemSnapshotId,
      systemVersionTag: normalized.systemVersionTag,
      parameterSnapshotId: normalized.parameterSnapshotId,
      selectedNodeId: normalized.selectedNodeId,
      executionAdapterKind: normalized.executionAdapterKind,
      executionBackendFamily: normalized.executionBackendFamily,
    }),
    upstreamInputs: Object.freeze(normalized.inputAssetIds.map((assetId) => Object.freeze({ assetId }))),
    graph: Object.freeze({
      nodes,
      edges: Object.freeze([...baseEdges, ...executionEdge, ...inputEdges]),
    }),
  });
}
