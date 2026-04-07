import { CompositeNodeCatalogProvider } from "@application/nodes/CompositeNodeCatalogProvider";
import { Workflow } from "@domain/workflows/Workflow";
import { WorkflowConnection } from "@domain/workflows/WorkflowConnection";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "@domain/workflows/WorkflowMetadata";
import { MockNodeCatalogProvider } from "@infrastructure/mocks/catalog/MockNodeCatalogProvider";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "@infrastructure/nodes/NodeProviderRegistryIndex";
import basicRagPipeline from "../../dev/workflow-data/workflows/basic-rag-pipeline.json";
import sampleImagePipeline from "../../dev/workflow-data/workflows/sample-image-pipeline.json";
import sampleTextAnalysis from "../../dev/workflow-data/workflows/sample-text-analysis.json";
import documentChunkDisplayWorkflow from "../../dev/workflow-examples/document-chunk-display.workflow.json";

const WORKFLOW_SEED_MODULES = [
  basicRagPipeline,
  sampleImagePipeline,
  sampleTextAnalysis,
] as const;
const WORKFLOW_EXAMPLE_MODULES = [
  documentChunkDisplayWorkflow,
] as const;

const SEED_NODE_CATALOG_PROVIDER = new CompositeNodeCatalogProvider({
  providers: [
    new MockNodeCatalogProvider(),
    new ImplementationRegistryNodeCatalogProvider(
      createCompositeNodeImplementationRegistry()
    ),
  ],
});

const SEED_NODE_DEFINITION_INDEX = new Map(
  (await SEED_NODE_CATALOG_PROVIDER.getAllDefinitions()).map((definition) => [
    definition.id,
    definition,
  ])
);

interface WorkflowSeedRecord {
  readonly id: string;
  readonly metadata: {
    readonly name: string;
    readonly description?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly version?: string;
    readonly isPublishedAsTool?: boolean;
    readonly toolTitle?: string;
    readonly toolDescription?: string;
    readonly toolCategory?: string;
    readonly toolSlug?: string;
    readonly contextConfiguration?: {
      readonly recipeSelections?: ReadonlyArray<{
        readonly recipeId: string;
        readonly alias?: string;
        readonly isEnabled?: boolean;
        readonly surfaceInTool?: boolean;
      }>;
      readonly selectedRecipeIds?: ReadonlyArray<string>;
      readonly packageReferences?: ReadonlyArray<{
        readonly packageId: string;
        readonly alias?: string;
        readonly version?: string;
        readonly includeFragmentIds?: ReadonlyArray<string>;
        readonly excludeFragmentIds?: ReadonlyArray<string>;
        readonly isEnabled?: boolean;
      }>;
      readonly selectedPackageIds?: ReadonlyArray<string>;
      readonly visibilityMode?: "basic" | "advanced";
      readonly maxCharacters?: number;
      readonly maxTokens?: number;
      readonly trimPartialFragments?: boolean;
      readonly includeKinds?: ReadonlyArray<string>;
      readonly excludeKinds?: ReadonlyArray<string>;
    };
  };
  readonly status?: "draft" | "ready" | "invalid" | "disabled" | "archived";
  readonly isEnabled?: boolean;
  readonly executionPolicy?: "acyclic-only" | "allow-cycles" | "engine-defined";
  readonly runtimeProfile?: {
    readonly preferredRuntime?: string;
    readonly allowedRuntimes?: ReadonlyArray<string>;
  };
  readonly audit?: WorkflowSeedAuditRecord;
  readonly nodes: ReadonlyArray<WorkflowSeedNodeRecord>;
  readonly connections: ReadonlyArray<WorkflowSeedConnectionRecord>;
}

interface WorkflowSeedNodeRecord {
  readonly id: string;
  readonly definitionId: string;
  readonly title?: string;
  readonly notes?: string;
  readonly position?: {
    readonly x: number;
    readonly y: number;
  };
  readonly size?: {
    readonly width: number;
    readonly height: number;
  };
  readonly properties: ReadonlyArray<{
    readonly id: string;
    readonly value: unknown;
  }>;
  readonly executionProfile?: {
    readonly runtime: string;
    readonly tasks?: ReadonlyArray<string>;
  };
  readonly isEnabled: boolean;
  readonly isCollapsed: boolean;
}

interface WorkflowSeedConnectionRecord {
  readonly id: string;
  readonly source: {
    readonly nodeId: string;
    readonly portId: string;
  };
  readonly target: {
    readonly nodeId: string;
    readonly portId: string;
  };
  readonly kind: string;
  readonly state: string;
  readonly isEnabled: boolean;
  readonly order?: number;
  readonly metadata?: {
    readonly label?: string;
    readonly description?: string;
    readonly tags?: ReadonlyArray<string>;
  };
}

interface WorkflowSeedAuditRecord {
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

function readWorkflowSeedRecords(): ReadonlyArray<WorkflowSeedRecord> {
  return Object.freeze(
    [...WORKFLOW_SEED_MODULES, ...WORKFLOW_EXAMPLE_MODULES]
      .filter((value): value is WorkflowSeedRecord => !!value && typeof value === "object" && "id" in value)
      .sort((left, right) => left.id.localeCompare(right.id))
  );
}

export function createSeedWorkflows(): ReadonlyArray<Workflow> {
  return Object.freeze(readWorkflowSeedRecords().map((record) => hydrateSeedWorkflow(record)));
}

function hydrateSeedWorkflow(record: WorkflowSeedRecord): Workflow {
  const nodes = record.nodes.map((nodeRecord) => {
    const definition = SEED_NODE_DEFINITION_INDEX.get(nodeRecord.definitionId);

    if (!definition) {
      throw new Error(
        `Node definition '${nodeRecord.definitionId}' could not be resolved while hydrating workflow '${record.id}'.`
      );
    }

    let node = definition.createInstance(nodeRecord.id);

    if (nodeRecord.title) {
      node = node.withTitle(nodeRecord.title);
    }

    if (nodeRecord.notes) {
      node = node.withNotes(nodeRecord.notes);
    }

    if (nodeRecord.position) {
      node = node.withPosition(nodeRecord.position);
    }

    if (nodeRecord.size) {
      node = node.withSize(nodeRecord.size);
    }

    if (nodeRecord.executionProfile) {
      node = node.withExecutionProfile({
        runtime: nodeRecord.executionProfile.runtime as never,
        tasks: nodeRecord.executionProfile.tasks as never,
      });
    }

    node = node.withEnabled(nodeRecord.isEnabled);
    node = node.withCollapsed(nodeRecord.isCollapsed);

    for (const propertyRecord of nodeRecord.properties) {
      if (!node.getProperty(propertyRecord.id)) {
        continue;
      }

      node = node.withPropertyValue(propertyRecord.id, propertyRecord.value);
    }

    return node;
  });

  const connections = record.connections.map(
    (connectionRecord) =>
      new WorkflowConnection({
        id: connectionRecord.id,
        source: connectionRecord.source,
        target: connectionRecord.target,
        kind: connectionRecord.kind as never,
        state: connectionRecord.state as never,
        isEnabled: connectionRecord.isEnabled,
        order: connectionRecord.order,
        metadata: connectionRecord.metadata,
      })
  );

  return new Workflow({
    id: record.id,
    metadata: new WorkflowMetadata({
      name: record.metadata.name,
      description: record.metadata.description,
      author: record.metadata.author,
      tags: record.metadata.tags,
      version: record.metadata.version,
      isPublishedAsTool: record.metadata.isPublishedAsTool,
      toolTitle: record.metadata.toolTitle,
      toolDescription: record.metadata.toolDescription,
      toolCategory: record.metadata.toolCategory,
      toolSlug: record.metadata.toolSlug,
      contextConfiguration: record.metadata.contextConfiguration,
    }),
    status: record.status,
    isEnabled: record.isEnabled,
    executionPolicy: record.executionPolicy,
    runtimeProfile: record.runtimeProfile
      ? new WorkflowRuntimeProfile({
          preferredRuntime: record.runtimeProfile.preferredRuntime as never,
          allowedRuntimes: record.runtimeProfile.allowedRuntimes as never,
        })
      : undefined,
    audit: record.audit
      ? new WorkflowAuditInfo({
          createdAt: record.audit.createdAt
            ? new Date(record.audit.createdAt)
            : undefined,
          updatedAt: record.audit.updatedAt
            ? new Date(record.audit.updatedAt)
            : undefined,
        })
      : undefined,
    nodes,
    connections,
  });
}

