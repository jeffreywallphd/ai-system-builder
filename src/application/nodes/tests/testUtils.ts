import type { INodeCatalogProvider } from "../../ports/interfaces/INodeCatalogProvider";
import type { IWorkflowValidator, IWorkflowValidationResult } from "../../../domain/services/interfaces/IWorkflowValidator";
import type { INodeCompatibilityService } from "../../../domain/services/interfaces/INodeCompatibilityService";

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

export function makeNodeCatalogProvider(overrides: Partial<INodeCatalogProvider> = {}): INodeCatalogProvider {
  return {
    listDefinitions: async () => [],
    searchDefinitions: async () => [],
    getDefinitionById: async () => undefined,
    getDefinitionByType: async () => undefined,
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

export function makeNodeCompatibilityService(overrides: Partial<INodeCompatibilityService> = {}): INodeCompatibilityService {
  const compatible = { isCompatible: true, score: 1, reasons: Object.freeze([]), metadata: {} };
  return {
    evaluatePortCompatibility: () => compatible,
    evaluateConnectionCompatibility: () => compatible,
    evaluateNodeModelCompatibility: () => compatible,
    evaluateNodeDependencyCompatibility: () => compatible,
    ...overrides,
  } as INodeCompatibilityService;
}
