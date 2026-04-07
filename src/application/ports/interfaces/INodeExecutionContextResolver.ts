import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import type { INodeOutputStore } from "./INodeOutputStore";

export interface INodeExecutionContext {
  readonly workflow: IWorkflow;
  readonly node: INode;
  readonly inputAssets: ReadonlyArray<IAsset>;
  readonly workflowInputs: Readonly<Record<string, unknown>>;
  readonly upstreamOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly resolvedInputs: Readonly<Record<string, unknown>>;
  readonly executionMetadata?: Readonly<Record<string, unknown>>;
}

export interface INodeExecutionContextResolveInput {
  readonly workflow: IWorkflow;
  readonly node: INode;
  readonly outputStore: INodeOutputStore;
  readonly inputAssets?: ReadonlyArray<IAsset>;
  readonly workflowInputs?: Readonly<Record<string, unknown>>;
  readonly executionMetadata?: Readonly<Record<string, unknown>>;
}

export interface INodeExecutionContextResolver {
  resolve(input: INodeExecutionContextResolveInput): INodeExecutionContext;
}
