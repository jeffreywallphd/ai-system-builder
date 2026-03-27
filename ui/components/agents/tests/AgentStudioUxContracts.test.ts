import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("Agent Studio UX contract wiring", () => {
  it("keeps run controls thin over backend-advertised control capabilities", () => {
    const controls = readSource("ui/components/agents/AgentRunControls.tsx");

    expect(controls).toContain("controls.includes(\"cancel\")");
    expect(controls).toContain("session.status");
    expect(controls).toContain("onControlRun");
    expect(controls).not.toContain("pause");
    expect(controls).not.toContain("resume");
  });

  it("routes backend trigger launches through triggerLaunch handler and keeps basic shape validation in the panel", () => {
    const launch = readSource("ui/components/agents/AgentLaunchPanel.tsx");
    const composition = readSource("ui/components/agents/CompositionSummaryCard.tsx");
    const outputAssets = readSource("ui/components/agents/OutputAssetExplorerPanel.tsx");

    expect(launch).toContain("TriggerSelector");
    expect(launch).toContain("TriggerConfigFields");
    expect(launch).toContain("props.onTriggerLaunch");
    expect(launch).toContain("isBackendTriggerInvalid");
    expect(launch).toContain("Backend trigger requires trigger.source");
    expect(launch).toContain("CompositionSummaryCard");
    expect(launch).toContain("OutputAssetExplorerPanel");
    expect(outputAssets).toContain("canonicalAssetManagementService.loadAssetDetail");
    expect(outputAssets).toContain("canonicalAssetManagementService.listVersionChain");
    expect(composition).toContain("props.taxonomy.structuralKind");
    expect(composition).toContain("props.contract");
  });
});
