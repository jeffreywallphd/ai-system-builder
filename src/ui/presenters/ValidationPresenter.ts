import type {
  IWorkflowValidationMessage,
  IWorkflowValidationResult,
  WorkflowValidationSeverity,
} from "../../domain/services/interfaces/IWorkflowValidator";

export interface ValidationBadgeViewModel {
  readonly severity: WorkflowValidationSeverity;
  readonly count: number;
  readonly label: string;
}

export interface ValidationMessageViewModel {
  readonly code: string;
  readonly severity: WorkflowValidationSeverity;
  readonly scope: string;
  readonly message: string;
  readonly targetLabel?: string;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly connectionId?: string;
  readonly portId?: string;
  readonly propertyId?: string;
}

export interface ValidationGroupViewModel {
  readonly scope: string;
  readonly count: number;
  readonly messages: ReadonlyArray<ValidationMessageViewModel>;
}

export interface ValidationSummaryViewModel {
  readonly isValid: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly badges: ReadonlyArray<ValidationBadgeViewModel>;
  readonly groups: ReadonlyArray<ValidationGroupViewModel>;
}

const SCOPE_ORDER = [
  "workflow",
  "graph",
  "node",
  "connection",
  "runtime",
  "policy",
  "dependency",
  "model",
] as const;

export class ValidationPresenter {
  public present(
    validation: IWorkflowValidationResult | undefined
  ): ValidationSummaryViewModel {
    if (!validation) {
      return Object.freeze({
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        badges: Object.freeze([
          Object.freeze({ severity: "error", count: 0, label: "Errors" }),
          Object.freeze({ severity: "warning", count: 0, label: "Warnings" }),
          Object.freeze({ severity: "info", count: 0, label: "Info" }),
        ]),
        groups: Object.freeze([]),
      });
    }

    const groupsMap = new Map<string, ValidationMessageViewModel[]>();
    for (const message of validation.messages) {
      const current = groupsMap.get(message.scope) ?? [];
      current.push(this.presentMessage(message));
      groupsMap.set(message.scope, current);
    }

    const groups = [...groupsMap.entries()]
      .map(([scope, messages]) =>
        Object.freeze({
          scope,
          count: messages.length,
          messages: Object.freeze(
            [...messages].sort((left, right) =>
              left.message.localeCompare(right.message)
            )
          ),
        })
      )
      .sort((left, right) => {
        const leftIndex = SCOPE_ORDER.indexOf(left.scope as (typeof SCOPE_ORDER)[number]);
        const rightIndex = SCOPE_ORDER.indexOf(right.scope as (typeof SCOPE_ORDER)[number]);

        if (leftIndex >= 0 && rightIndex >= 0) {
          return leftIndex - rightIndex;
        }

        if (leftIndex >= 0) {
          return -1;
        }

        if (rightIndex >= 0) {
          return 1;
        }

        return left.scope.localeCompare(right.scope);
      });

    return Object.freeze({
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      infoCount: validation.info.length,
      badges: Object.freeze([
        Object.freeze({ severity: "error", count: validation.errors.length, label: "Errors" }),
        Object.freeze({ severity: "warning", count: validation.warnings.length, label: "Warnings" }),
        Object.freeze({ severity: "info", count: validation.info.length, label: "Info" }),
      ]),
      groups: Object.freeze(groups),
    });
  }

  public presentMessage(
    message: IWorkflowValidationMessage
  ): ValidationMessageViewModel {
    return Object.freeze({
      code: message.code,
      severity: message.severity,
      scope: message.scope,
      message: message.message,
      targetLabel: this.buildTargetLabel(message),
      workflowId: message.target?.workflowId,
      nodeId: message.target?.nodeId,
      connectionId: message.target?.connectionId,
      portId: message.target?.portId,
      propertyId: message.target?.propertyId,
    });
  }

  private buildTargetLabel(message: IWorkflowValidationMessage): string | undefined {
    const parts: string[] = [];

    if (message.target?.workflowId) {
      parts.push(`Workflow ${message.target.workflowId}`);
    }
    if (message.target?.nodeId) {
      parts.push(`Node ${message.target.nodeId}`);
    }
    if (message.target?.connectionId) {
      parts.push(`Connection ${message.target.connectionId}`);
    }
    if (message.target?.portId) {
      parts.push(`Port ${message.target.portId}`);
    }
    if (message.target?.propertyId) {
      parts.push(`Property ${message.target.propertyId}`);
    }

    return parts.length > 0 ? parts.join(" • ") : undefined;
  }
}
