import { describe, expect, it } from "bun:test";
import {
  createStudioHandoffContext,
  listStudioHandoffPrefillKeys,
  StudioHandoffActorKinds,
} from "../StudioHandoffContext";
import { StudioHandoffIntentKinds } from "../StudioHandoffContract";

describe("createStudioHandoffContext", () => {
  it("captures source/target/intent/actor/prefill/provenance for atomic/composite/system and system-of-systems handoffs", () => {
    const context = createStudioHandoffContext({
      sourceStudioId: "dataset-studio-default",
      sourceStudioType: "dataset-studio",
      targetStudioId: "system-studio-default",
      targetStudioType: "system-studio",
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
        description: "compose into a system draft",
        labels: ["epic-9", "handoff"],
      },
      actor: {
        actorKind: StudioHandoffActorKinds.user,
        actorId: "user:123",
        requestSource: "studio-shell",
      },
      sourceReferences: [
        { assetId: "asset:atomic", versionId: "asset:atomic:v4", relation: "primary" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v2", relation: "system-dependency" },
        { assetId: "asset:system", versionId: "asset:system:v6", relation: "system-of-systems" },
      ],
      prefill: {
        values: {
          preferredSplit: "train",
          nestedStrategy: "compose",
        },
        hintOnlyKeys: ["preferredSplit", "nestedStrategy"],
        note: "Hints only; source asset versions remain authoritative.",
      },
      provenance: {
        correlationId: "corr-123",
        sourceSessionId: "session-abc",
        sourceDraftId: "draft-abc",
        sourceVersionLineage: ["asset:system:v5", "asset:system:v6"],
        labels: ["studio-to-studio", "compose"],
        metadata: {
          launchedFrom: "registry",
        },
      },
    });

    expect(context.domain).toBe("studio-handoff-context");
    expect(context.sourceReferences).toHaveLength(3);
    expect(context.sourceReferences[2]?.versionId).toBe("asset:system:v6");
    expect(context.prefill?.values.preferredSplit).toBe("train");
    expect(context.provenance?.sourceVersionLineage).toEqual(["asset:system:v5", "asset:system:v6"]);
  });

  it("keeps bounded prefill hints separate from authoritative source asset references", () => {
    const context = createStudioHandoffContext({
      sourceStudioId: "workflow-studio-default",
      sourceStudioType: "workflow-studio",
      targetStudioId: "training-recipe-studio-default",
      targetStudioType: "training-recipe-studio",
      intent: {
        kind: StudioHandoffIntentKinds.authoringContinuation,
      },
      sourceReferences: [
        { assetId: "asset:workflow", versionId: "asset:workflow:v8", relation: "primary" },
      ],
      prefill: {
        values: {
          assetId: "prefill-only-id",
          suggestedEpochs: 4,
        },
        hintOnlyKeys: ["assetId", "suggestedEpochs"],
      },
    });

    expect(context.sourceReferences[0]?.assetId).toBe("asset:workflow");
    expect(context.prefill?.values.assetId).toBe("prefill-only-id");
    expect(context.sourceReferences[0]?.assetId).not.toBe(context.prefill?.values.assetId);
    expect(listStudioHandoffPrefillKeys(context)).toEqual(["assetId", "suggestedEpochs"]);
  });

  it("stays distinct from runtime/deployment/request context models", () => {
    const context = createStudioHandoffContext({
      sourceStudioId: "dataset-studio-default",
      sourceStudioType: "dataset-studio",
      targetStudioId: "workflow-studio-default",
      targetStudioType: "workflow-studio",
      intent: {
        kind: StudioHandoffIntentKinds.validationReview,
      },
      sourceReferences: [
        { assetId: "asset:dataset", versionId: "asset:dataset:v3", relation: "primary" },
      ],
    });

    expect((context as unknown as { packageReferences?: unknown }).packageReferences).toBeUndefined();
    expect((context as unknown as { assembledContext?: unknown }).assembledContext).toBeUndefined();
    expect((context as unknown as { deploymentEnvironmentId?: unknown }).deploymentEnvironmentId).toBeUndefined();
    expect((context as unknown as { requestSource?: unknown }).requestSource).toBeUndefined();
  });
});
