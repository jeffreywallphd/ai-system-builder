import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("AgentStudioService", () => {
  it("uses desktop bridge methods for all studio and authoring flows", () => {
    const source = readSource("ui/services/AgentStudioService.ts");

    expect(source).toContain("resolveDesktopAgentBridge");
    expect(source).toContain("listAgents(");
    expect(source).toContain("createAgent(");
    expect(source).toContain("getStudioSnapshot(");
    expect(source).toContain("launchAgent(");
    expect(source).toContain("triggerLaunch(");
    expect(source).toContain("listSessions(");
    expect(source).toContain("getSessionDetail(");
    expect(source).toContain("controlRun");
    expect(source).toContain("public async controlRun(");
    expect(source).toContain("configureGoals(");
    expect(source).toContain("configurePolicy(");
    expect(source).toContain("configureTools(");
    expect(source).toContain("configureMemory(");
    expect(source).toContain("configureStrategy(");
    expect(source).not.toContain("fetch(");
  });
});
