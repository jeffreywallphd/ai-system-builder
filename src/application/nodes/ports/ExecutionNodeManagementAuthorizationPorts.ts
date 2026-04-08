import type { ExecutionNodeRecord } from "@domain/nodes/ExecutionNodeDomain";
import type { ExecutionNodeListQuery } from "./ExecutionNodeManagementPorts";

export interface AssertCanRegisterExecutionNodeInput {
  readonly actorUserIdentityId: string;
  readonly node: ExecutionNodeRecord;
}

export interface AssertCanActivateExecutionNodeInput {
  readonly actorUserIdentityId: string;
  readonly node: ExecutionNodeRecord;
}

export interface AssertCanQueryExecutionNodesInput {
  readonly actorUserIdentityId: string;
  readonly query: ExecutionNodeListQuery;
}

export interface AssertCanGetExecutionNodeDetailInput {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
}

export interface ExecutionNodeManagementAuthorizationHook {
  assertCanRegisterExecutionNode?(input: AssertCanRegisterExecutionNodeInput): Promise<void>;
  assertCanActivateExecutionNode?(input: AssertCanActivateExecutionNodeInput): Promise<void>;
  assertCanQueryExecutionNodes?(input: AssertCanQueryExecutionNodesInput): Promise<void>;
  assertCanGetExecutionNodeDetail?(input: AssertCanGetExecutionNodeDetailInput): Promise<void>;
}
