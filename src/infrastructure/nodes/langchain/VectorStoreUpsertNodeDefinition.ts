import { NodePort, NodePortCompatibilityProfile } from "@domain/nodes/NodePort";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";

export interface ILangChainNodeCatalogMetadataProjection {
  readonly group: string;
  readonly tags: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly supportsAuthoringView: boolean;
  readonly supportsToolView: boolean;
}

export interface ILangChainNodeCatalogDefinition {
  readonly technicalName: string;
  readonly nonTechnicalName: string;
  readonly technicalDescription: string;
  readonly description: string;
  readonly inputPorts: INodeDefinition["inputPorts"];
  readonly outputPorts: INodeDefinition["outputPorts"];
  readonly properties: INodeDefinition["properties"];
  readonly projection: ILangChainNodeCatalogMetadataProjection;
}

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["vector store", "knowledge", "rag"]),
  keywords: Object.freeze(["knowledge base", "vector store", "upsert", "documents"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const VECTOR_STORE_UPSERT_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.vector_store_upsert",
  nonTechnicalName: "Save to Knowledge Base",
  technicalDescription:
    "Stores documents in a vector store handle so downstream retrieval nodes can search them semantically.",
  description:
    "Save prepared documents into a knowledge base that later nodes can search.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "documents",
      name: "Documents",
      description: "Documents that should be written into the knowledge base.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["document"] }),
    }),
    new NodePort({
      id: "embeddings",
      name: "Embeddings",
      description: "Embedding vectors or embedding-ready data aligned with the incoming documents.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["embedding", "json"] }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "vectorStore",
      name: "Vector Store",
      description: "Serializable handle describing the updated vector store.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["vector-store"] as never }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "storeType",
      name: "Store Type",
      description: "Which backing vector store implementation should be targeted.",
      type: "select",
      value: "memory",
      defaultValue: "memory",
      options: [
        { label: "Memory", value: "memory", description: "Keep vectors in an in-memory store." },
        { label: "Chroma", value: "chroma", description: "Target a Chroma collection." },
        { label: "FAISS", value: "faiss", description: "Target a FAISS index." },
      ],
      projection: {
        label: "Store type",
        description: "Which backing vector store implementation should be targeted.",
        group: "Storage",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      constraints: { required: true, allowedValues: ["memory", "chroma", "faiss"] },
      order: 0,
    }),
    new NodeProperty({
      id: "collectionName",
      name: "Collection Name",
      description: "Collection, namespace, or index name used by the target store.",
      type: "text",
      value: "default",
      defaultValue: "default",
      projection: {
        label: "Collection name",
        description: "Collection, namespace, or index name used by the target store.",
        group: "Storage",
        order: 1,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "text",
      },
      constraints: { required: true },
      order: 1,
    }),
  ]),
  projection,
});

