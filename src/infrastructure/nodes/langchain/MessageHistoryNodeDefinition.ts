import { NodePort, NodePortCompatibilityProfile } from "@domain/nodes/NodePort";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["memory", "chat", "session"]),
  keywords: Object.freeze(["message history", "session memory", "conversation state", "chat history"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const MESSAGE_HISTORY_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.message_history",
  nonTechnicalName: "Remember Conversation",
  technicalDescription:
    "Stores and retrieves session-scoped chat messages so downstream conversational nodes can reuse prior turns.",
  description:
    "Keep the important messages from an ongoing conversation available for later AI steps.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "sessionId",
      name: "Session ID",
      description: "Stable conversation identifier used to group stored messages.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
    new NodePort({
      id: "messages",
      name: "Messages",
      description: "New chat messages that should be appended to the stored conversation history.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["messages", "json"], isOptional: true }),
    }),
    new NodePort({
      id: "seedHistory",
      name: "Seed History",
      description: "Optional starting history used when the session has not been seen before.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["messages", "json"], isOptional: true }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "history",
      name: "History",
      description: "Updated message history for the current conversation session.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["messages", "json"] }),
    }),
    new NodePort({
      id: "historyState",
      name: "History State",
      description: "Session metadata describing how many messages were retained and which session was updated.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["json", "workflow-state"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "maxMessages",
      name: "Max Messages",
      description: "Maximum number of recent messages to retain for each session.",
      type: "integer",
      value: 12,
      defaultValue: 12,
      constraints: {
        required: true,
        min: 1,
        max: 100,
        range: { min: 1, max: 100, step: 1, defaultValue: 12, clamp: true },
      },
      projection: {
        label: "Messages to remember",
        description: "Maximum number of recent messages to retain for each session.",
        group: "Memory",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "integer",
      },
      order: 0,
    }),
    new NodeProperty({
      id: "seedStrategy",
      name: "Seed Strategy",
      description: "Controls whether incoming seed history is only used for new sessions or merged every time.",
      type: "select",
      value: "on-miss",
      defaultValue: "on-miss",
      options: [
        {
          label: "Only when empty",
          value: "on-miss",
          description: "Use the seed history only when the session has no stored messages yet.",
        },
        {
          label: "Merge every run",
          value: "merge",
          description: "Merge the seed history before appending new messages on every execution.",
        },
      ],
      constraints: { required: true, allowedValues: ["on-miss", "merge"] },
      projection: {
        label: "Seed behavior",
        description: "Controls whether incoming seed history is only used for new sessions or merged every time.",
        group: "Memory",
        order: 1,
        authorVisibility: "basic",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      order: 1,
    }),
    new NodeProperty({
      id: "dedupeConsecutive",
      name: "Dedupe Consecutive",
      description: "Drop back-to-back duplicate role/content pairs before saving history.",
      type: "boolean",
      value: true,
      defaultValue: true,
      projection: {
        label: "Remove duplicates",
        description: "Drop back-to-back duplicate role/content pairs before saving history.",
        group: "Memory",
        order: 2,
        authorVisibility: "advanced",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "boolean",
      },
      isAdvanced: true,
      order: 2,
    }),
  ]),
  projection,
});

