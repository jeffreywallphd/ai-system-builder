import type { IWorkflowRepository } from "../../ports/interfaces/IWorkflowRepository";
import type { IWorkflowExecutor } from "../../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowValidator, IWorkflowValidationResult } from "../../../domain/services/interfaces/IWorkflowValidator";

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
    startExecution: async (input) => ({
      executionId: "exec",
      input,
      completionPromise: Promise.resolve({ executionId: "exec", status: "completed", outputAssets: [] }),
      cancel: async () => undefined,
      onEvent: () => () => undefined,
    }),
    getStatus: async () => undefined,
    ...overrides,
  };
}
