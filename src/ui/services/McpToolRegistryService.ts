import {
  type ApplyMcpToolUpdateResult,
  type ApplyMcpToolUpdateRequest,
  type PreviewMcpToolUpdateRequest,
  type PreviewMcpToolUpdateResult,
} from "@application/mcp/registry/McpToolRegistryUseCases";

export interface UpdateMcpToolWithApprovalRequest extends ApplyMcpToolUpdateRequest {
  readonly requireExplicitApproval?: boolean;
}

export class McpToolRegistryService {
  constructor(
    private readonly previewUpdateUseCase: Pick<{ execute(request: PreviewMcpToolUpdateRequest): Promise<PreviewMcpToolUpdateResult> }, "execute">,
    private readonly applyUpdateUseCase: Pick<{ execute(request: ApplyMcpToolUpdateRequest): Promise<ApplyMcpToolUpdateResult> }, "execute">,
  ) {}

  public async previewUpdate(request: PreviewMcpToolUpdateRequest): Promise<PreviewMcpToolUpdateResult> {
    return this.previewUpdateUseCase.execute(request);
  }

  public async applyUpdateWithApproval(request: UpdateMcpToolWithApprovalRequest): Promise<ApplyMcpToolUpdateResult> {
    const requireApproval = request.requireExplicitApproval !== false;
    if (!requireApproval) {
      return this.applyUpdateUseCase.execute(request);
    }

    const preview = await this.previewUpdateUseCase.execute(request);
    const approval = {
      acknowledgedRisk: preview.compatibility !== "risky" || request.approval?.acknowledgedRisk === true,
      acknowledgedBreaking: preview.compatibility !== "breaking" || request.approval?.acknowledgedBreaking === true,
    };

    return this.applyUpdateUseCase.execute({
      ...request,
      approval,
    });
  }
}

