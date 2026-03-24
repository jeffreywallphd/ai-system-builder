import type { IWorkflowRepository } from "../../ports/interfaces/IWorkflowRepository";
import type { IWorkflowExecutor } from "../../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowValidator, IWorkflowValidationResult } from "../../../domain/services/interfaces/IWorkflowValidator";
import { WorkflowExecutionHandle, WorkflowExecutionProgress, WorkflowExecutionResult } from "../../ports/WorkflowExecutor";

const validResult: IWorkflowValidationResult = {
  isValid: true,
  messages: Object.freeze([]),
  errors: Object.freeze([]),
  warnings: Object.freeze([]),
  info: Object.freeze([]),
  invalidNodeIds: Object.freeze([]),
  invalidConnectionIds: Object.freeze([]),
  hasErrors: () => false,
  hasWarnings: () => false,
  hasMessage: () => false,
};

export function makeWorkflowRepository(overrides: Partial<IWorkflowRepository> = {}): IWorkflowRepository {
  return {
    save: async (workflow) => workflow,
    load: async () => undefined,
    remove: async () => false,
    list: async () => [],
    ...overrides,
  };
}

export function makeWorkflowValidator(overrides: Partial<IWorkflowValidator> = {}): IWorkflowValidator {
  return {
    validateWorkflow: () => validResult,
    validateNode: () => validResult,
    validateConnection: () => validResult,
    ...overrides,
  };
}

export function makeWorkflowExecutor(overrides: Partial<IWorkflowExecutor> = {}): IWorkflowExecutor {
  return {
    canExecute: () => true,
    execute: async () => ({ executionId: "exec", status: "completed", outputAssets: [] }),
    startExecution: async (input) => new WorkflowExecutionHandle({
      executionId: "exec",
      input,
      initialProgress: new WorkflowExecutionProgress({ executionId: "exec", status: "queued", percent: 0 }),
      completionPromise: Promise.resolve(new WorkflowExecutionResult({ executionId: "exec", status: "completed", outputAssets: [] })),
      cancel: async () => undefined,
    }),
    ...overrides,
  };
}
