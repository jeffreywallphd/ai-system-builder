export const WorkflowConversationMessageRoles = Object.freeze({
  user: "user",
  assistant: "assistant",
  system: "system",
});

export type WorkflowConversationMessageRole =
  typeof WorkflowConversationMessageRoles[keyof typeof WorkflowConversationMessageRoles];

export const WorkflowConversationSessionStatuses = Object.freeze({
  active: "active",
  errored: "errored",
  archived: "archived",
});

export type WorkflowConversationSessionStatus =
  typeof WorkflowConversationSessionStatuses[keyof typeof WorkflowConversationSessionStatuses];

export interface WorkflowConversationMessage {
  readonly id: string;
  readonly role: WorkflowConversationMessageRole;
  readonly content: string;
  readonly timestamp: string;
  readonly executionId?: string;
}

export interface WorkflowConversationPromptBinding {
  readonly nodeId: string;
  readonly propertyId: string;
}

export interface WorkflowConversationSessionMetadata {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly title: string;
  readonly responseField?: string;
  readonly conversationScope?: string;
  readonly destinationType?: string;
  readonly promptBinding?: WorkflowConversationPromptBinding;
  readonly latestExecutionId?: string;
  readonly executionIds: ReadonlyArray<string>;
}

export interface WorkflowConversationSession {
  readonly id: string;
  readonly status: WorkflowConversationSessionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: ReadonlyArray<WorkflowConversationMessage>;
  readonly metadata: WorkflowConversationSessionMetadata;
  readonly lastError?: string;
}

export interface WorkflowConversationPersistencePayload {
  readonly schemaVersion: "workflow-conversation.v1";
  readonly sessions: ReadonlyArray<WorkflowConversationSession>;
}
