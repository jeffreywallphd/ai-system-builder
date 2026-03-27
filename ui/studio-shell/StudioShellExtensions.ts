import type { ReactNode } from "react";
import type { StudioShellSnapshotReadModel, StudioShellValidationIssue } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";

export const StudioShellExtensionSlots = Object.freeze({
  sessionContext: "session-context",
  draftAuthoring: "draft-authoring",
  metadata: "metadata",
  dependencies: "dependencies",
  lifecycle: "lifecycle",
  validation: "validation",
});

export type StudioShellExtensionSlot = typeof StudioShellExtensionSlots[keyof typeof StudioShellExtensionSlots];

export interface StudioShellExtensionContext {
  readonly studioId: string;
  readonly snapshot: StudioShellSnapshotReadModel | undefined;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly operationError?: string;
  readonly isBusy: boolean;
}

export interface StudioShellExtensionContribution {
  readonly id: string;
  readonly slot: StudioShellExtensionSlot;
  readonly title: string;
  readonly subtitle?: string;
  readonly order?: number;
  render(context: StudioShellExtensionContext): ReactNode;
}

export class StudioShellExtensionRegistry {
  private readonly byId = new Map<string, StudioShellExtensionContribution>();

  public register(contribution: StudioShellExtensionContribution): void {
    const id = contribution.id.trim();
    if (!id) {
      throw new Error("Studio shell extension id is required.");
    }
    if (this.byId.has(id)) {
      throw new Error(`Studio shell extension '${id}' is already registered.`);
    }
    this.byId.set(id, contribution);
  }

  public registerMany(contributions: ReadonlyArray<StudioShellExtensionContribution>): void {
    for (const contribution of contributions) {
      this.register(contribution);
    }
  }

  public listBySlot(slot: StudioShellExtensionSlot): ReadonlyArray<StudioShellExtensionContribution> {
    const entries = [...this.byId.values()]
      .filter((entry) => entry.slot === slot)
      .sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.id.localeCompare(right.id);
      });

    return Object.freeze(entries);
  }
}
