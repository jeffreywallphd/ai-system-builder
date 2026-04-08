import type { ExecutionNodeRecord } from "@domain/nodes/ExecutionNodeDomain";

export interface AssertCanRegisterExecutionNodeInput {
  readonly actorUserIdentityId: string;
  readonly node: ExecutionNodeRecord;
}

export interface AssertCanActivateExecutionNodeInput {
  readonly actorUserIdentityId: string;
  readonly node: ExecutionNodeRecord;
}

export interface ExecutionNodeManagementAuthorizationHook {
  assertCanRegisterExecutionNode?(input: AssertCanRegisterExecutionNodeInput): Promise<void>;
  assertCanActivateExecutionNode?(input: AssertCanActivateExecutionNodeInput): Promise<void>;
}
