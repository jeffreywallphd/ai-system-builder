import type { ExecutionPlanProvenanceEntry } from "../../../contracts/execution-plans";

export const createExecutionPlanProvenanceEvent = (event: ExecutionPlanProvenanceEntry["event"], at: string, refs: Omit<ExecutionPlanProvenanceEntry, "event" | "at">): ExecutionPlanProvenanceEntry => ({ event, at, ...refs });
