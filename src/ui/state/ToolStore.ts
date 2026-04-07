import type { CapabilitySearchResult } from "@application/research/models/CapabilitySearchResult";
import type { ToolSearchCriteria } from "@application/dto/ToolSearchCriteria";
import type { ToolDefinition } from "@application/projection/models/ToolDefinition";
import type { ToolRunResult } from "@application/projection/models/ToolRunResult";
import type { ToolCapabilityDescriptor } from "@application/tools/models/ToolCapabilityDescriptor";
import { ToolService } from "../services/ToolService";

export interface ToolStoreState {
  readonly tools: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly description?: string;
    readonly category?: string;
    readonly typeId: string;
    readonly typeLabel: string;
  }>;
  readonly capabilities: ReadonlyArray<ToolCapabilityDescriptor>;
  readonly capabilitySearchResult?: CapabilitySearchResult;
  readonly availableTypes: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly selectedTool?: ToolDefinition;
  readonly runResult?: ToolRunResult;
  readonly activeSearch?: ToolSearchCriteria;
  readonly isLoading: boolean;
  readonly isRunning: boolean;
  readonly error?: string;
}

const defaultState: ToolStoreState = Object.freeze({
  tools: Object.freeze([]),
  capabilities: Object.freeze([]),
  availableTypes: Object.freeze([]),
  isLoading: false,
  isRunning: false,
});

export class ToolStore {
  private state: ToolStoreState = defaultState;
  private readonly listeners = new Set<(state: ToolStoreState) => void>();

  constructor(private readonly toolService: ToolService) {}

  public getState(): ToolStoreState {
    return this.state;
  }

  public subscribe(listener: (state: ToolStoreState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async refreshTools(criteria?: ToolSearchCriteria): Promise<void> {
    this.patch({ isLoading: true, error: undefined, activeSearch: criteria });
    try {
      const normalizedQuery = criteria?.query?.trim();
      const [publishedTools, capabilitySnapshot, capabilitySearchResult] = await Promise.all([
        this.toolService.listPublishedTools(criteria),
        this.toolService.listToolCapabilities(),
        normalizedQuery
          ? this.toolService.searchCapabilities({
              query: normalizedQuery,
              limit: 6,
            })
          : Promise.resolve(undefined),
      ]);
      this.patch({
        tools: Object.freeze([...publishedTools.tools]),
        capabilities: Object.freeze([...capabilitySnapshot.capabilities]),
        capabilitySearchResult: normalizedQuery ? capabilitySearchResult : undefined,
        availableTypes: Object.freeze([...publishedTools.availableTypes]),
        isLoading: false,
      });
    } catch (error) {
      this.patch({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown tool error.",
      });
      throw error;
    }
  }

  public async loadTool(toolId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const selectedTool = await this.toolService.loadToolDefinition(toolId);
      this.patch({ selectedTool, isLoading: false });
    } catch (error) {
      this.patch({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown tool error.",
      });
      throw error;
    }
  }

  public async runTool(values: Readonly<Record<string, unknown>>): Promise<void> {
    if (!this.state.selectedTool) throw new Error("No tool selected.");
    this.patch({ isRunning: true, error: undefined });
    try {
      const runResult = await this.toolService.runTool({
        toolId: this.state.selectedTool.id,
        values,
      });
      this.patch({ runResult, isRunning: false });
    } catch (error) {
      this.patch({
        isRunning: false,
        error: error instanceof Error ? error.message : "Unknown tool error.",
      });
      throw error;
    }
  }

  private patch(patch: Partial<ToolStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      tools: patch.tools ? Object.freeze([...patch.tools]) : this.state.tools,
      capabilities: patch.capabilities
        ? Object.freeze([...patch.capabilities])
        : this.state.capabilities,
      availableTypes: patch.availableTypes
        ? Object.freeze([...patch.availableTypes])
        : this.state.availableTypes,
      capabilitySearchResult: Object.prototype.hasOwnProperty.call(patch, "capabilitySearchResult")
        ? patch.capabilitySearchResult
        : this.state.capabilitySearchResult,
    });
    for (const listener of this.listeners) listener(this.state);
  }
}

