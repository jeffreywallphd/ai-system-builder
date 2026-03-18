import { NodeCatalogProvider } from "../../application/ports/NodeCatalogProvider";
import { Workflow } from "../../domain/workflows/Workflow";
import { WorkflowConnection } from "../../domain/workflows/WorkflowConnection";
import { WorkflowAuditInfo } from "../../domain/workflows/WorkflowMetadata";
import { MockNodeCatalogProvider } from "../../infrastructure/mocks/catalog/MockNodeCatalogProvider";
import { ImplementationRegistryNodeCatalogProvider } from "../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "../../infrastructure/nodes/NodeProviderRegistryIndex";
import sampleImagePipelineRecord from "../../dev/workflow-data/workflows/sample-image-pipeline.json";
import sampleTextAnalysisRecord from "../../dev/workflow-data/workflows/sample-text-analysis.json";

const SEED_NODE_CATALOG_PROVIDER = new NodeCatalogProvider({
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
  };
  readonly status?: "draft" | "ready" | "invalid" | "disabled" | "archived";
  readonly isEnabled?: boolean;
  readonly executionPolicy?: "acyclic-only" | "allow-cycles" | "engine-defined";
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

export function createSeedWorkflows(): ReadonlyArray<Workflow> {
  const seeds = [sampleImagePipelineRecord, sampleTextAnalysisRecord] as const;

  return Object.freeze(seeds.map((record) => hydrateSeedWorkflow(record)));
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
    metadata: {
      name: record.metadata.name,
      description: record.metadata.description,
      author: record.metadata.author,
      tags: record.metadata.tags,
      version: record.metadata.version,
    },
    status: record.status,
    isEnabled: record.isEnabled,
    executionPolicy: record.executionPolicy,
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
