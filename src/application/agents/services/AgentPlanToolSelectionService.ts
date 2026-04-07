import type { Agent } from "../../../domain/agents/Agent";
import type { AgentGoal } from "../../../domain/agents/AgentGoal";
import type {
  AgentPlanToolCompatibilityIssue,
  AgentPlanToolSelectionRequest,
  AgentPlanToolSelectionResult,
  AgentPlanToolSelectionService,
} from "../contracts/AgentPlanningStrategy";
import { isMcpToolId } from "../../../domain/mcp/McpToolIdentity";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { AgentMcpToolGovernanceService } from "./AgentMcpToolGovernanceService";

function buildIssuesFromMissingCandidates(
  goal: AgentGoal,
  candidateToolIds: ReadonlyArray<string>,
): ReadonlyArray<AgentPlanToolCompatibilityIssue> {
  return Object.freeze(candidateToolIds.map((toolId) => Object.freeze({
    toolId,
    category: "unavailable" as const,
    code: "tool-not-available-in-catalog",
    message: `Goal '${goal.id}' candidate tool '${toolId}' is not available in the capability catalog.`,
  })));
}

function chooseFirstAllowed(
  availableCandidates: ReadonlyArray<string>,
  agent: Agent,
): string | undefined {
  for (const toolId of availableCandidates) {
    if (agent.toolAccess.allowedToolIds.includes(toolId)) {
      return toolId;
    }
  }
  return undefined;
}

export class DefaultAgentPlanToolSelectionService implements AgentPlanToolSelectionService {
  constructor(
    private readonly catalog: IToolCapabilityCatalog,
    private readonly governanceService?: AgentMcpToolGovernanceService,
  ) {}

  public async selectToolForGoal(request: AgentPlanToolSelectionRequest): Promise<AgentPlanToolSelectionResult> {
    const availableTools = await this.catalog.listCapabilities();
    const availableIds = new Set(availableTools.map((tool) => tool.id));
    const candidateToolIds = [...new Set(request.candidateToolIds.map((toolId) => toolId.trim()).filter(Boolean))];

    const availableCandidates = candidateToolIds.filter((toolId) => availableIds.has(toolId));
    const issues: AgentPlanToolCompatibilityIssue[] = [];

    if (availableCandidates.length === 0) {
      return Object.freeze({
        selectedToolId: undefined,
        issues: buildIssuesFromMissingCandidates(request.goal, candidateToolIds),
      });
    }

    for (const toolId of availableCandidates) {
      if (!request.agent.toolAccess.allowedToolIds.includes(toolId)) {
        issues.push(Object.freeze({
          toolId,
          category: "not-allowed",
          code: "tool-not-allowed",
          message: `Goal '${request.goal.id}' candidate tool '${toolId}' is not allowed by agent policy.`,
        }));
        continue;
      }

      if (isMcpToolId(toolId) && this.governanceService) {
        const stepIssues = await this.governanceService.validateToolSelection({
          agent: request.agent,
          toolId,
          stepId: `plan:${request.agent.id}:${request.goal.id}`,
          action: request.action,
          expectedOutputKey: request.expectedOutputKey,
        });
        if (stepIssues.length > 0) {
          issues.push(...stepIssues.map((issue) => Object.freeze({
            toolId,
            category: this.mapGovernanceCategory(issue.code),
            code: issue.code,
            message: issue.message,
          })));
          continue;
        }
      }

      return Object.freeze({ selectedToolId: toolId, issues: Object.freeze(issues) });
    }

    if (issues.length === 0) {
      const allowed = chooseFirstAllowed(availableCandidates, request.agent);
      if (allowed) {
        return Object.freeze({ selectedToolId: allowed, issues: Object.freeze([]) });
      }
    }

    return Object.freeze({ selectedToolId: undefined, issues: Object.freeze(issues) });
  }

  private mapGovernanceCategory(code: string): AgentPlanToolCompatibilityIssue["category"] {
    if (code === "approval-required") {
      return "approval-required";
    }
    if (code === "tool-not-installed" || code === "tool-disabled") {
      return "unavailable";
    }
    if (code === "input-schema-mismatch" || code === "output-schema-missing") {
      return "incompatible";
    }
    if (code === "tool-not-allowed") {
      return "not-allowed";
    }
    return "denied";
  }
}
