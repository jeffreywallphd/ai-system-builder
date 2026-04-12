import type { INode } from "@domain/nodes/interfaces/INode";

export interface IModelExecutionRequest {
  readonly node: INode;
  readonly modelId?: string;
  readonly runtime?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface IModelExecutionResult {
  readonly status: "completed" | "failed";
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly messages?: ReadonlyArray<string>;
  readonly errorMessage?: string;
}

export interface IModelExecutor {
  readonly runtime: string;
  canExecute(request: IModelExecutionRequest): boolean;
  execute(request: IModelExecutionRequest): Promise<IModelExecutionResult>;
}

