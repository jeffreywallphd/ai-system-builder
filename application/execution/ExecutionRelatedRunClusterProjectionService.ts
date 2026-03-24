import type { ExecutionRunProjection } from "./ExecutionRunProjectionService";

export interface RelatedExecutionRunProjection {
  readonly run: ExecutionRunProjection;
  readonly isAnchor: boolean;
  readonly relationLabel: string;
}

export interface ExecutionRelatedRunClusterProjection {
  readonly groupId: string;
  readonly groupLabel: string;
  readonly anchorRunId?: string;
  readonly orderingLabel: string;
  readonly runs: ReadonlyArray<RelatedExecutionRunProjection>;
}

export class ExecutionRelatedRunClusterProjectionService {
  public project(
    anchorRunId: string,
    runs: ReadonlyArray<ExecutionRunProjection>,
  ): ExecutionRelatedRunClusterProjection {
    const ordered = [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    const anchor = ordered.find((run) => run.runId === anchorRunId);
    const groupId = anchor?.executionFlowId ?? anchor?.planId ?? `related-runs:${anchorRunId}`;
    const groupLabel = anchor?.executionFlowId
      ? `Execution flow ${anchor.executionFlowId}`
      : anchor?.planId
        ? `Plan ${anchor.planId}`
        : "Related execution runs";

    return Object.freeze({
      groupId,
      groupLabel,
      anchorRunId: anchor?.runId,
      orderingLabel: "Newest first",
      runs: Object.freeze(ordered.map((run) => Object.freeze({
        run,
        isAnchor: run.runId === anchorRunId,
        relationLabel: run.runId === anchorRunId ? "Anchor run" : "Related run",
      }))),
    });
  }
}
