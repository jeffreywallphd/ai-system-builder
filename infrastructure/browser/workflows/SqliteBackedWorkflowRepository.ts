import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import { Workflow } from "../../../domain/workflows/Workflow";
import { WorkflowConnection } from "../../../domain/workflows/WorkflowConnection";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "../../../domain/workflows/WorkflowMetadata";
import type { INodeCatalogProvider } from "../../../application/ports/interfaces/INodeCatalogProvider";
import { McpToolCallNodeConfigurationService } from "../../../application/mcp/McpToolCallNodeConfigurationService";
import type { IWorkflowRepository } from "../../../ui/services/WorkflowService";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WorkflowRecord {
  readonly id: string;
  readonly metadata: Record<string, unknown> & { readonly name: string };
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
    readonly position?: { readonly x: number; readonly y: number };
    readonly size?: { readonly width: number; readonly height: number };
    readonly properties: ReadonlyArray<{ readonly id: string; readonly value: unknown }>;
    readonly executionProfile?: { readonly runtime?: string; readonly tasks?: ReadonlyArray<string> };
    readonly isEnabled: boolean;
    readonly isCollapsed: boolean;
  }>;
  readonly connections: ReadonlyArray<{
    readonly id: string;
    readonly source: { readonly nodeId: string; readonly portId: string };
    readonly target: { readonly nodeId: string; readonly portId: string };
    readonly kind: string;
    readonly state: string;
    readonly isEnabled: boolean;
    readonly order?: number;
    readonly metadata?: Record<string, unknown>;
  }>;
}

const STORAGE_KEY = "ai-loom-studio.workflows";

export class SqliteBackedWorkflowRepository implements IWorkflowRepository {
  private readonly mcpToolCallNodeConfigurationService = new McpToolCallNodeConfigurationService();

  constructor(
    private readonly nodeCatalogProvider: INodeCatalogProvider,
    private readonly storage: StorageLike,
  ) {}

  public async save(workflow: IWorkflow): Promise<void> {
    const records = this.readRecords();
    records.set(workflow.id, this.toRecord(workflow));
    this.writeRecords(records);
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const record = this.readRecords().get(id.trim());
    return record ? this.toDomain(record) : undefined;
  }

  public async list(): Promise<ReadonlyArray<IWorkflow>> {
    const workflows = await Promise.all(
      [...this.readRecords().values()].map((record) => this.toDomain(record)),
    );
    return Object.freeze(workflows.sort((left, right) => left.metadata.name.localeCompare(right.metadata.name)));
  }

  public async delete(id: string): Promise<boolean> {
    const records = this.readRecords();
    const deleted = records.delete(id.trim());
    this.writeRecords(records);
    return deleted;
  }

  private readRecords(): Map<string, WorkflowRecord> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Map<string, WorkflowRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<WorkflowRecord>;
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      return new Map<string, WorkflowRecord>();
    }
  }

  private writeRecords(records: Map<string, WorkflowRecord>): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify([...records.values()], null, 2));
  }

  private toRecord(workflow: IWorkflow): WorkflowRecord {
    return {
      id: workflow.id,
      metadata: {
        ...workflow.metadata,
        contextConfiguration: workflow.metadata.contextConfiguration
          ? {
              ...workflow.metadata.contextConfiguration,
              recipeSelections: workflow.metadata.contextConfiguration.recipeSelections?.map((selection) => ({ ...selection })),
              packageReferences: workflow.metadata.contextConfiguration.packageReferences?.map((reference) => ({ ...reference })),
            }
          : undefined,
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
        properties: node.properties.map((property) => ({ id: property.id, value: property.value })),
        executionProfile: node.executionProfile
          ? { runtime: node.executionProfile.runtime, tasks: node.executionProfile.tasks }
          : undefined,
        isEnabled: node.isEnabled,
        isCollapsed: node.isCollapsed,
      })),
      connections: workflow.connections.map((connection) => ({
        id: connection.id,
        source: { nodeId: connection.source.nodeId, portId: connection.source.portId },
        target: { nodeId: connection.target.nodeId, portId: connection.target.portId },
        kind: connection.kind,
        state: connection.state,
        isEnabled: connection.isEnabled,
        order: connection.order,
        metadata: connection.metadata,
      })),
    };
  }

  private async toDomain(record: WorkflowRecord): Promise<IWorkflow> {
    const nodes = await Promise.all(record.nodes.map(async (nodeRecord) => {
      const definition = await this.nodeCatalogProvider.getDefinitionById(nodeRecord.definitionId);
      if (!definition) {
        throw new Error(`Node definition '${nodeRecord.definitionId}' could not be resolved while loading workflow '${record.id}'.`);
      }

      let node = definition.createInstance(nodeRecord.id);
      if (nodeRecord.title) node = node.withTitle(nodeRecord.title);
      if (nodeRecord.notes) node = node.withNotes(nodeRecord.notes);
      if (nodeRecord.position) node = node.withPosition(nodeRecord.position);
      if (nodeRecord.size) node = node.withSize(nodeRecord.size);
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
          if (this.mcpToolCallNodeConfigurationService.isMcpToolCallNode(node) && propertyRecord.id === "toolDescriptor") {
            node = this.mcpToolCallNodeConfigurationService.configureNode(node.withPropertyValue(propertyRecord.id, propertyRecord.value));
          }
          continue;
        }

        node = node.withPropertyValue(propertyRecord.id, propertyRecord.value);
        if (this.mcpToolCallNodeConfigurationService.isMcpToolCallNode(node) && propertyRecord.id === "toolDescriptor") {
          node = this.mcpToolCallNodeConfigurationService.configureNode(node);
        }
      }
      return node;
    }));

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
            createdAt: record.audit.createdAt ? new Date(record.audit.createdAt) : undefined,
            updatedAt: record.audit.updatedAt ? new Date(record.audit.updatedAt) : undefined,
          })
        : undefined,
      nodes,
      connections: record.connections.map((connectionRecord) => new WorkflowConnection({
        id: connectionRecord.id,
        source: connectionRecord.source,
        target: connectionRecord.target,
        kind: connectionRecord.kind as never,
        state: connectionRecord.state as never,
        isEnabled: connectionRecord.isEnabled,
        order: connectionRecord.order,
        metadata: connectionRecord.metadata,
      })),
    });
  }
}
