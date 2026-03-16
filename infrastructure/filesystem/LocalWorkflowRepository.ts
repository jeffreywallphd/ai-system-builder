import path from "node:path";
import type {
  IWorkflowRecordSummary,
  IWorkflowRepository,
} from "../../application/ports/interfaces/IWorkflowRepository";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { Workflow } from "../../domain/workflows/Workflow";
import { WorkflowConnection } from "../../domain/workflows/WorkflowConnection";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "../../domain/workflows/WorkflowMetadata";

interface WorkflowRecord {
  readonly id: string;
  readonly metadata: {
    readonly name: string;
    readonly description?: string;
    readonly author?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly version?: string;
  };
  readonly status: IWorkflow["status"];
  readonly isEnabled: boolean;
  readonly executionPolicy: IWorkflow["executionPolicy"];
  readonly runtimeProfile?: {
    readonly preferredRuntime?: string;
    readonly allowedRuntimes?: ReadonlyArray<string>;
  };
  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };
  readonly nodes: ReadonlyArray<{
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
      readonly runtime?: string;
      readonly tasks?: ReadonlyArray<string>;
    };
    readonly isEnabled: boolean;
    readonly isCollapsed: boolean;
  }>;
  readonly connections: ReadonlyArray<{
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
  }>;
}

export class LocalWorkflowRepository implements IWorkflowRepository {
  private readonly fileStorage: IFileStorage;
  private readonly nodeCatalogProvider: INodeCatalogProvider;
  private readonly rootDirectory: string;

  constructor(params: {
    fileStorage: IFileStorage;
    nodeCatalogProvider: INodeCatalogProvider;
    rootDirectory: string;
  }) {
    this.fileStorage = params.fileStorage;
    this.nodeCatalogProvider = params.nodeCatalogProvider;
    this.rootDirectory = params.rootDirectory.trim();
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    const filePath = this.resolveWorkflowPath(workflow.id);
    const record = this.toRecord(workflow);

    await this.fileStorage.write({
      path: filePath,
      content: JSON.stringify(record, null, 2),
      createDirectories: true,
      overwrite: true,
    });

    return workflow;
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const workflowId = id.trim();
    const filePath = this.resolveWorkflowPath(workflowId);

    if (!(await this.fileStorage.exists(filePath))) {
      return undefined;
    }

    const content = await this.fileStorage.readText(filePath, "utf-8");
    const record = JSON.parse(content) as WorkflowRecord;

    return this.toDomain(record);
  }

  public async delete(id: string): Promise<void> {
    const workflowId = id.trim();
    const filePath = this.resolveWorkflowPath(workflowId);

    if (!(await this.fileStorage.exists(filePath))) {
      return;
    }

    await this.fileStorage.delete(filePath);
  }

  public async exists(id: string): Promise<boolean> {
    const workflowId = id.trim();
    return this.fileStorage.exists(this.resolveWorkflowPath(workflowId));
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    const info = await this.fileStorage.stat(this.rootDirectory);

    if (info.kind === "missing") {
      return Object.freeze([]);
    }

    const entries = await this.fileStorage.list(this.rootDirectory, {
      recursive: false,
      includeHidden: false,
    });

    const workflows: IWorkflowRecordSummary[] = [];

    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const content = await this.fileStorage.readText(entry.path, "utf-8");
      const record = JSON.parse(content) as WorkflowRecord;
      workflows.push(this.toSummary(record));
    }

    return Object.freeze(
      workflows.sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
    );
  }

  private resolveWorkflowPath(id: string): string {
    const workflowId = id.trim();

    if (!workflowId) {
      throw new Error("Workflow ID cannot be empty.");
    }

    return path.join(this.rootDirectory, `${workflowId}.json`);
  }

  private toSummary(record: WorkflowRecord): IWorkflowRecordSummary {
    return {
      id: record.id,
      metadata: new WorkflowMetadata(record.metadata),
      status: record.status,
      isEnabled: record.isEnabled,
      provider: "local-file-storage",
      updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
    };
  }

  private toRecord(workflow: IWorkflow): WorkflowRecord {
    return {
      id: workflow.id,
      metadata: {
        name: workflow.metadata.name,
        description: workflow.metadata.description,
        author: workflow.metadata.author,
        tags: workflow.metadata.tags,
        version: workflow.metadata.version,
      },
      status: workflow.status,
      isEnabled: workflow.isEnabled,
      executionPolicy: workflow.executionPolicy,
      runtimeProfile: workflow.runtimeProfile
        ? {
            preferredRuntime: workflow.runtimeProfile.preferredRuntime,
            allowedRuntimes: workflow.runtimeProfile.allowedRuntimes,
          }
        : undefined,
      audit: workflow.audit
        ? {
            createdAt: workflow.audit.createdAt?.toISOString(),
            updatedAt: workflow.audit.updatedAt?.toISOString(),
          }
        : undefined,
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        definitionId: node.definition.id,
        title: node.title,
        notes: node.notes,
        position: node.position,
        size: node.size,
        properties: node.properties.map((property) => ({
          id: property.id,
          value: property.value,
        })),
        executionProfile: node.executionProfile
          ? {
              runtime: node.executionProfile.runtime,
              tasks: node.executionProfile.tasks,
            }
          : undefined,
        isEnabled: node.isEnabled,
        isCollapsed: node.isCollapsed,
      })),
      connections: workflow.connections.map((connection) => ({
        id: connection.id,
        source: {
          nodeId: connection.source.nodeId,
          portId: connection.source.portId,
        },
        target: {
          nodeId: connection.target.nodeId,
          portId: connection.target.portId,
        },
        kind: connection.kind,
        state: connection.state,
        isEnabled: connection.isEnabled,
        order: connection.order,
        metadata: connection.metadata
          ? {
              label: connection.metadata.label,
              description: connection.metadata.description,
              tags: connection.metadata.tags,
            }
          : undefined,
      })),
    };
  }

  private async toDomain(record: WorkflowRecord): Promise<IWorkflow> {
    const nodes = await Promise.all(
      record.nodes.map(async (nodeRecord) => {
        const definition = await this.nodeCatalogProvider.getDefinitionById(
          nodeRecord.definitionId
        );

        if (!definition) {
          throw new Error(
            `Node definition '${nodeRecord.definitionId}' could not be resolved while loading workflow '${record.id}'.`
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
      })
    );

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
      metadata: new WorkflowMetadata(record.metadata),
      status: record.status,
      isEnabled: record.isEnabled,
      runtimeProfile: record.runtimeProfile
        ? new WorkflowRuntimeProfile({
            preferredRuntime: record.runtimeProfile.preferredRuntime as never,
            allowedRuntimes: record.runtimeProfile.allowedRuntimes as never,
          })
        : undefined,
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
}
