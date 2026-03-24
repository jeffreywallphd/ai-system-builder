import type { IWorkflowRecordSummary } from "../../application/ports/interfaces/IWorkflowRepository";
import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import { McpToolCallNodeConfigurationService } from "../../application/mcp/McpToolCallNodeConfigurationService";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { Workflow } from "../../domain/workflows/Workflow";
import { WorkflowConnection } from "../../domain/workflows/WorkflowConnection";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "../../domain/workflows/WorkflowMetadata";

export interface WorkflowRecord {
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
    readonly metadata?: {
      readonly label?: string;
      readonly description?: string;
      readonly tags?: ReadonlyArray<string>;
    };
  }>;
}

export class WorkflowPersistenceCodec {
  private readonly mcpToolCallNodeConfigurationService = new McpToolCallNodeConfigurationService();

  public toRecord(workflow: IWorkflow): WorkflowRecord {
    return {
      id: workflow.id,
      metadata: {
        name: workflow.metadata.name,
        description: workflow.metadata.description,
        author: workflow.metadata.author,
        tags: workflow.metadata.tags,
        version: workflow.metadata.version,
        isPublishedAsTool: workflow.metadata.isPublishedAsTool,
        toolTitle: workflow.metadata.toolTitle,
        toolDescription: workflow.metadata.toolDescription,
        toolCategory: workflow.metadata.toolCategory,
        toolSlug: workflow.metadata.toolSlug,
        contextConfiguration: workflow.metadata.contextConfiguration
          ? {
              recipeSelections: workflow.metadata.contextConfiguration.recipeSelections?.map((selection) => ({
                recipeId: selection.recipeId,
                alias: selection.alias,
                isEnabled: selection.isEnabled,
                surfaceInTool: selection.surfaceInTool,
              })),
              selectedRecipeIds: workflow.metadata.contextConfiguration.selectedRecipeIds,
              packageReferences: workflow.metadata.contextConfiguration.packageReferences?.map((reference) => ({
                packageId: reference.packageId,
                alias: reference.alias,
                version: reference.version,
                includeFragmentIds: reference.includeFragmentIds,
                excludeFragmentIds: reference.excludeFragmentIds,
                isEnabled: reference.isEnabled,
              })),
              selectedPackageIds: workflow.metadata.contextConfiguration.selectedPackageIds,
              visibilityMode: workflow.metadata.contextConfiguration.visibilityMode,
              maxCharacters: workflow.metadata.contextConfiguration.maxCharacters,
              maxTokens: workflow.metadata.contextConfiguration.maxTokens,
              trimPartialFragments: workflow.metadata.contextConfiguration.trimPartialFragments,
              includeKinds: workflow.metadata.contextConfiguration.includeKinds,
              excludeKinds: workflow.metadata.contextConfiguration.excludeKinds,
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

  public toSummary(record: WorkflowRecord, provider = "local-file-storage"): IWorkflowRecordSummary {
    return {
      id: record.id,
      metadata: new WorkflowMetadata(record.metadata),
      status: record.status,
      isEnabled: record.isEnabled,
      provider,
      updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
    };
  }

  public async toDomain(record: WorkflowRecord, nodeCatalogProvider: INodeCatalogProvider): Promise<IWorkflow> {
    const nodes = await Promise.all(
      record.nodes.map(async (nodeRecord) => {
        const definition = await nodeCatalogProvider.getDefinitionById(nodeRecord.definitionId);
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

        const deferredProperties: Array<{ readonly id: string; readonly value: unknown }> = [];
        for (const propertyRecord of nodeRecord.properties) {
          if (!node.getProperty(propertyRecord.id)) {
            deferredProperties.push({ id: propertyRecord.id, value: propertyRecord.value });
            continue;
          }

          node = node.withPropertyValue(propertyRecord.id, propertyRecord.value);
        }

        node = this.mcpToolCallNodeConfigurationService.configureNode(node);

        for (const deferredProperty of deferredProperties) {
          if (!node.getProperty(deferredProperty.id)) {
            continue;
          }

          node = node.withPropertyValue(deferredProperty.id, deferredProperty.value);
        }

        return node;
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
