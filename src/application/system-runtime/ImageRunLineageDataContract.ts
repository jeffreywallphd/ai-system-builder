import { z } from "zod";
import type { ImageRunHistoryWithOutputs } from "./ImageRunHistoryService";

export const ImageLineageNodeKinds = Object.freeze({
  inputImage: "input-image",
  workflowRun: "workflow-run",
  outputImage: "output-image",
  outputDataset: "output-dataset",
});

export const ImageLineageEdgeKinds = Object.freeze({
  inputToRun: "input-to-run",
  runToOutput: "run-to-output",
  outputToDataset: "output-to-dataset",
});

const imageLineageNodeSchema = z.object({
  nodeId: z.string().trim().min(1),
  kind: z.enum([
    ImageLineageNodeKinds.inputImage,
    ImageLineageNodeKinds.workflowRun,
    ImageLineageNodeKinds.outputImage,
    ImageLineageNodeKinds.outputDataset,
  ]),
  label: z.string().trim().min(1),
  refId: z.string().trim().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
});

const imageLineageEdgeSchema = z.object({
  edgeId: z.string().trim().min(1),
  kind: z.enum([
    ImageLineageEdgeKinds.inputToRun,
    ImageLineageEdgeKinds.runToOutput,
    ImageLineageEdgeKinds.outputToDataset,
  ]),
  fromNodeId: z.string().trim().min(1),
  toNodeId: z.string().trim().min(1),
});

export const ImageRunLineageViewSchema = z.object({
  kind: z.literal("image-run-lineage"),
  summary: z.object({
    systemId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    workflowAssetId: z.string().trim().min(1),
    workflowAssetVersionId: z.string().trim().min(1).optional(),
    datasetInstanceId: z.string().trim().min(1).optional(),
    inputCount: z.number().int().nonnegative(),
    outputCount: z.number().int().nonnegative(),
    lineageStatus: z.enum(["complete", "partial", "incomplete"]).optional(),
    traceId: z.string().trim().min(1).optional(),
  }),
  nodes: z.array(imageLineageNodeSchema),
  edges: z.array(imageLineageEdgeSchema),
});

export type ImageRunLineageView = z.infer<typeof ImageRunLineageViewSchema>;

function coalesceRefId(image: {
  readonly stableId?: string;
  readonly assetId?: string;
  readonly uri?: string;
  readonly path?: string;
  readonly outputId?: string;
  readonly recordId?: string;
}, fallbackPrefix: string, fallbackIndex: number): string {
  return image.recordId?.trim()
    || image.stableId?.trim()
    || image.assetId?.trim()
    || image.outputId?.trim()
    || image.uri?.trim()
    || image.path?.trim()
    || `${fallbackPrefix}:${fallbackIndex}`;
}

export function buildImageRunLineageView(entry: ImageRunHistoryWithOutputs): ImageRunLineageView {
  const runNodeId = `run:${entry.run.runId}`;
  const inputNodes = entry.run.inputs.images.map((image, index) => {
    const refId = coalesceRefId(image, "input", index);
    return Object.freeze({
      nodeId: `input:${refId}`,
      kind: ImageLineageNodeKinds.inputImage,
      label: image.recordId?.trim() || image.stableId?.trim() || `input-${index + 1}`,
      refId,
    });
  });

  const outputNodes = entry.linkedOutputs.map((output, index) => Object.freeze({
    nodeId: `output:${output.image.recordId}`,
    kind: ImageLineageNodeKinds.outputImage,
    label: output.image.recordId,
    refId: output.image.recordId,
    metadata: {
      outputIndex: output.workflow?.outputIndex !== undefined ? String(output.workflow.outputIndex) : String(index),
      workflowRunId: output.workflow?.workflowRunId ?? entry.run.runId,
    },
  }));

  const dataset = entry.run.outputs.datasetInstance;
  const datasetNode = dataset
    ? Object.freeze({
      nodeId: `dataset:${dataset.instanceId}`,
      kind: ImageLineageNodeKinds.outputDataset,
      label: dataset.instanceId,
      refId: dataset.instanceId,
      metadata: {
        datasetAssetId: dataset.datasetAssetId,
        role: dataset.role,
      },
    })
    : undefined;

  const nodes = Object.freeze([
    ...inputNodes,
    Object.freeze({
      nodeId: runNodeId,
      kind: ImageLineageNodeKinds.workflowRun,
      label: entry.run.runId,
      refId: entry.run.runId,
      metadata: {
        workflowAssetId: entry.run.workflow.workflowAssetId,
        workflowAssetVersionId: entry.run.workflow.workflowAssetVersionId ?? "",
        workflowExecutionId: entry.run.lineage?.workflowExecutionId ?? entry.run.workflowExecutionId ?? "",
        runtimeSessionId: entry.run.lineage?.runtimeSessionId ?? "",
        systemAssetId: entry.run.lineage?.systemAssetId ?? "",
        systemVersionId: entry.run.lineage?.systemVersionId ?? "",
      },
    }),
    ...outputNodes,
    ...(datasetNode ? [datasetNode] : []),
  ]);

  const edges = Object.freeze([
    ...inputNodes.map((node) => Object.freeze({
      edgeId: `${node.nodeId}->${runNodeId}`,
      kind: ImageLineageEdgeKinds.inputToRun,
      fromNodeId: node.nodeId,
      toNodeId: runNodeId,
    })),
    ...outputNodes.map((node) => Object.freeze({
      edgeId: `${runNodeId}->${node.nodeId}`,
      kind: ImageLineageEdgeKinds.runToOutput,
      fromNodeId: runNodeId,
      toNodeId: node.nodeId,
    })),
    ...(datasetNode
      ? outputNodes.map((node) => Object.freeze({
        edgeId: `${node.nodeId}->${datasetNode.nodeId}`,
        kind: ImageLineageEdgeKinds.outputToDataset,
        fromNodeId: node.nodeId,
        toNodeId: datasetNode.nodeId,
      }))
      : []),
  ]);

  return ImageRunLineageViewSchema.parse({
    kind: "image-run-lineage",
    summary: {
      systemId: entry.run.system.systemId,
      runId: entry.run.runId,
      workflowAssetId: entry.run.workflow.workflowAssetId,
      workflowAssetVersionId: entry.run.workflow.workflowAssetVersionId,
      datasetInstanceId: dataset?.instanceId,
      inputCount: inputNodes.length,
      outputCount: outputNodes.length,
      lineageStatus: entry.run.lineage?.status,
      traceId: entry.run.lineage?.traceId,
    },
    nodes,
    edges,
  });
}
