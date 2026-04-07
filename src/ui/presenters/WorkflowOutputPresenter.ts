import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { AssetKind } from "../../domain/assets/interfaces/IAsset";
import type { NodePortValueType } from "../../domain/nodes/interfaces/INodePort";
import { AssetPresenter, type AssetDetailViewModel } from "./AssetPresenter";

export type WorkflowOutputViewerType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "text"
  | "structured"
  | "download";

export interface WorkflowOutputAssetViewModel {
  readonly id: string;
  readonly title: string;
  readonly viewerType: WorkflowOutputViewerType;
  readonly detail: AssetDetailViewModel;
  readonly previewUrl?: string;
  readonly previewText?: string;
  readonly previewUnavailableReason?: string;
}

export interface WorkflowOutputViewModel {
  readonly title: string;
  readonly description: string;
  readonly expectedOutputTypes: ReadonlyArray<string>;
  readonly assets: ReadonlyArray<WorkflowOutputAssetViewModel>;
  readonly primaryAsset?: WorkflowOutputAssetViewModel;
  readonly emptyStateTitle: string;
  readonly emptyStateDescription: string;
}

const expectedOutputTypeLabels: Readonly<Record<WorkflowOutputViewerType, string>> = Object.freeze({
  image: "Image output",
  video: "Video output",
  audio: "Audio output",
  document: "Document output",
  text: "Text output",
  structured: "Structured output",
  download: "Generated file",
});

export class WorkflowOutputPresenter {
  private readonly assetPresenter: AssetPresenter;

  constructor(assetPresenter = new AssetPresenter()) {
    this.assetPresenter = assetPresenter;
  }

  public present(
    workflow: IWorkflow,
    outputAssets: ReadonlyArray<IAsset>
  ): WorkflowOutputViewModel {
    const assets = Object.freeze(outputAssets.map((asset) => this.presentAsset(asset)));
    const expectedOutputTypes = this.inferExpectedOutputTypes(workflow);

    return Object.freeze({
      title: "Workflow Output",
      description:
        assets.length > 0
          ? "Latest generated assets from the current workflow run."
          : expectedOutputTypes.length > 0
            ? `This workflow is expected to generate ${expectedOutputTypes.join(", ").toLowerCase()}.`
            : "Run the workflow to inspect the generated output assets here.",
      expectedOutputTypes,
      assets,
      primaryAsset: assets[assets.length - 1],
      emptyStateTitle: "No output available yet",
      emptyStateDescription:
        expectedOutputTypes.length > 0
          ? `Run the workflow to preview ${expectedOutputTypes.join(", ").toLowerCase()}.`
          : "Run the workflow to generate output assets for this workflow.",
    });
  }

  private presentAsset(asset: IAsset): WorkflowOutputAssetViewModel {
    const detail = this.assetPresenter.present(asset);
    const viewerType = this.resolveViewerType(asset.kind, asset.location.contentType);
    const previewUrl = this.resolvePreviewUrl(asset);
    const previewText = this.resolvePreviewText(asset, viewerType);

    return Object.freeze({
      id: asset.id,
      title: asset.name,
      viewerType,
      detail,
      previewUrl,
      previewText,
      previewUnavailableReason:
        previewUrl || previewText
          ? undefined
          : "Preview is unavailable for this asset location, but the asset metadata is still available.",
    });
  }

  private inferExpectedOutputTypes(workflow: IWorkflow): ReadonlyArray<string> {
    const connectedOutputKeys = new Set(
      workflow.connections.map(
        (connection) => `${connection.source.nodeId}.${connection.source.portId}`
      )
    );
    const outputTypes = new Set<string>();

    for (const node of workflow.nodes) {
      for (const port of node.outputPorts) {
        if (connectedOutputKeys.has(`${node.id}.${port.id}`)) {
          continue;
        }

        const viewerType = this.resolveViewerTypeFromValueTypes(port.compatibility.valueTypes);
        outputTypes.add(expectedOutputTypeLabels[viewerType]);
      }
    }

    return Object.freeze([...outputTypes]);
  }

  private resolveViewerTypeFromValueTypes(
    valueTypes: ReadonlyArray<NodePortValueType>
  ): WorkflowOutputViewerType {
    if (valueTypes.includes("image")) {
      return "image";
    }

    if (valueTypes.includes("video")) {
      return "video";
    }

    if (valueTypes.includes("audio")) {
      return "audio";
    }

    if (valueTypes.includes("document")) {
      return "document";
    }

    if (valueTypes.includes("json") || valueTypes.includes("dataset") || valueTypes.includes("embedding")) {
      return "structured";
    }

    if (valueTypes.includes("text") || valueTypes.includes("prompt") || valueTypes.includes("messages")) {
      return "text";
    }

    return "download";
  }

  private resolveViewerType(
    kind: AssetKind,
    contentType?: string
  ): WorkflowOutputViewerType {
    if (kind === "image") {
      return "image";
    }

    if (kind === "video") {
      return contentType?.startsWith("image/") ? "image" : "video";
    }

    if (kind === "audio") {
      return "audio";
    }

    if (kind === "document") {
      return "document";
    }

    if (kind === "json" || kind === "dataset" || kind === "embedding") {
      return "structured";
    }

    if (kind === "text" || kind === "model-output" || kind === "transcript" || kind === "prompt" || kind === "log") {
      return "text";
    }

    return "download";
  }

  private resolvePreviewText(
    asset: IAsset,
    viewerType: WorkflowOutputViewerType
  ): string | undefined {
    if (viewerType !== "text" && viewerType !== "structured" && viewerType !== "document") {
      return undefined;
    }

    const description = asset.semanticMetadata?.description?.trim();
    return description || undefined;
  }

  private resolvePreviewUrl(asset: IAsset): string | undefined {
    const location = asset.location.location?.trim();

    if (!location) {
      return undefined;
    }

    if (asset.location.accessMethod === "remote-url") {
      return location;
    }

    if (location.startsWith("data:") || location.startsWith("blob:")) {
      return location;
    }

    return undefined;
  }
}
