import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/services contract adherence", () => {
  it("exports service classes and options types at runtime", async () => {
    const nodeModule = await importModule("ui/services/NodeService.ts");
    const modelModule = await importModule("ui/services/ModelService.ts");
    const workflowModule = await importModule("ui/services/WorkflowService.ts");
    const mcpModule = await importModule("ui/services/McpService.ts");
    const workspaceAdministrationModule = await importModule("ui/services/WorkspaceAdministrationService.ts");
    const nodeEnrollmentReviewModule = await importModule("ui/services/NodeEnrollmentReviewService.ts");
    const authorizationManagementModule = await importModule("ui/services/AuthorizationManagementService.ts");
    const secretMetadataManagementModule = await importModule("ui/services/SecretMetadataManagementService.ts");
    const deploymentPolicyAdministrationReadModule = await importModule("ui/services/DeploymentPolicyAdministrationReadService.ts");
    const deploymentPolicyAdministrationWriteModule = await importModule("ui/services/DeploymentPolicyAdministrationWriteService.ts");

    expect(Object.keys(nodeModule)).toContain("NodeService");
    expect(Object.keys(modelModule)).toContain("ModelService");
    expect(Object.keys(workflowModule)).toContain("WorkflowService");
    expect(Object.keys(mcpModule)).toContain("McpService");
    expect(Object.keys(workspaceAdministrationModule)).toContain("WorkspaceAdministrationService");
    expect(Object.keys(nodeEnrollmentReviewModule)).toContain("NodeEnrollmentReviewService");
    expect(Object.keys(authorizationManagementModule)).toContain("AuthorizationManagementService");
    expect(Object.keys(secretMetadataManagementModule)).toContain("SecretMetadataManagementService");
    expect(Object.keys(deploymentPolicyAdministrationReadModule)).toContain("DeploymentPolicyAdministrationReadService");
    expect(Object.keys(deploymentPolicyAdministrationWriteModule)).toContain("DeploymentPolicyAdministrationWriteService");
  });
});
