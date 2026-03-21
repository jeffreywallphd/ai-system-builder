import { describe, expect, it } from "bun:test";
import { buildLinearWizardDefinition } from "../contracts";

describe("buildLinearWizardDefinition", () => {
  it("derives navigation metadata for a linear wizard", () => {
    const wizard = buildLinearWizardDefinition({
      currentStepId: "review",
      progressPercent: 44,
      steps: [
        { id: "define", title: "Define", description: "Define the workflow.", status: "completed" },
        { id: "review", title: "Review", description: "Review the data.", status: "current" },
        { id: "export", title: "Export", description: "Export the artifact.", status: "pending" },
      ],
    });

    expect(wizard.previousStepId).toBe("define");
    expect(wizard.nextStepId).toBe("export");
    expect(wizard.steps[0]?.isAccessible).toBe(true);
    expect(wizard.steps[2]?.isAccessible).toBe(false);
    expect(wizard.completedStepCount).toBe(1);
  });
});
