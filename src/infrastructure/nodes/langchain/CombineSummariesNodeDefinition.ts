import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["summary", "aggregation", "text"]),
  keywords: Object.freeze(["combine summaries", "reduce summaries", "summary reducer"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const COMBINE_SUMMARIES_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.combine_summaries",
  nonTechnicalName: "Combine Summaries",
  technicalDescription:
    "Combines multiple summary strings into one final summary using concatenation or reduction.",
  description:
    "Merge several summaries into one final result.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "summaries",
      name: "Summaries",
      description: "One or more summary strings to combine.",
      direction: "input",
      cardinality: "many",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "combinedSummary",
      name: "Combined Summary",
      description: "The final combined summary text.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "method",
      name: "Method",
      description: "How the incoming summaries should be merged together.",
      type: "select",
      value: "concatenate",
      defaultValue: "concatenate",
      options: [
        { label: "Concatenate", value: "concatenate", description: "Join summaries in their original order." },
        { label: "Reduce", value: "reduce", description: "Compress the summary set into a tighter overall result." },
      ],
      constraints: { required: true, allowedValues: ["concatenate", "reduce"] },
      projection: {
        label: "Method",
        description: "How the incoming summaries should be merged together.",
        group: "Combination",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      order: 0,
    }),
  ]),
  projection,
});
