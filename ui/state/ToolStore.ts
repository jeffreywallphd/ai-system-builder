import type { ToolDefinition } from "../../application/projection/models/ToolDefinition";
import type { ToolRunResult } from "../../application/projection/models/ToolRunResult";
import { ToolService } from "../services/ToolService";

export interface ToolStoreState {
  readonly tools: ReadonlyArray<{ readonly id: string; readonly slug: string; readonly title: string; readonly description?: string; readonly category?: string }>;
  readonly selectedTool?: ToolDefinition;
  readonly runResult?: ToolRunResult;
  readonly isLoading: boolean;
  readonly isRunning: boolean;
  readonly error?: string;
}

const defaultState: ToolStoreState = Object.freeze({ tools: Object.freeze([]), isLoading: false, isRunning: false });

export class ToolStore {
  private state: ToolStoreState = defaultState;
  private readonly listeners = new Set<(state: ToolStoreState) => void>();

  constructor(private readonly toolService: ToolService) {}

  public getState(): ToolStoreState { return this.state; }
  public subscribe(listener: (state: ToolStoreState) => void): () => void {
    this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener);
  }

  public async refreshTools(): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const result = await this.toolService.listPublishedTools();
      this.patch({ tools: Object.freeze([...result.tools]), isLoading: false });
    } catch (error) {
      this.patch({ isLoading: false, error: error instanceof Error ? error.message : "Unknown tool error." });
      throw error;
    }
  }

  public async loadTool(toolId: string): Promise<void> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const selectedTool = await this.toolService.loadToolDefinition(toolId);
      this.patch({ selectedTool, isLoading: false });
    } catch (error) {
      this.patch({ isLoading: false, error: error instanceof Error ? error.message : "Unknown tool error." });
      throw error;
    }
  }

  public async runTool(values: Readonly<Record<string, unknown>>): Promise<void> {
    if (!this.state.selectedTool) throw new Error("No tool selected.");
    this.patch({ isRunning: true, error: undefined });
    try {
      const runResult = await this.toolService.runTool({ toolId: this.state.selectedTool.id, values });
      this.patch({ runResult, isRunning: false });
    } catch (error) {
      this.patch({ isRunning: false, error: error instanceof Error ? error.message : "Unknown tool error." });
      throw error;
    }
  }

  private patch(patch: Partial<ToolStoreState>): void {
    this.state = Object.freeze({ ...this.state, ...patch, tools: patch.tools ? Object.freeze([...patch.tools]) : this.state.tools });
    for (const listener of this.listeners) listener(this.state);
  }
}
