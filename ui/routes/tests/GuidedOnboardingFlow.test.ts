import { describe, expect, it } from "bun:test";
import { IntentNavigationFeatureFlag } from "../../features/IntentNavigationFeatureFlag";
import {
  GuidedOnboardingFlow,
  OnboardingTriggerPolicy,
  type OnboardingProgress,
  type OnboardingProgressStorage,
} from "../GuidedOnboardingFlow";
import { ROUTE_PATHS } from "../RouteConfig";

class InMemoryOnboardingProgressStore implements OnboardingProgressStorage {
  public value: OnboardingProgress | undefined;

  public load(): OnboardingProgress | undefined {
    return this.value;
  }

  public save(progress: OnboardingProgress): void {
    this.value = progress;
  }
}

describe("OnboardingTriggerPolicy", () => {
  it("launches only for bounded first-run intent-ux paths", () => {
    const policy = new OnboardingTriggerPolicy(new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } }));

    expect(policy.shouldLaunch({ pathname: ROUTE_PATHS.home }, { isCompleted: false, isDismissed: false })).toBeTrue();
    expect(policy.shouldLaunch({ pathname: ROUTE_PATHS.build }, { isCompleted: false, isDismissed: false })).toBeTrue();
    expect(policy.shouldLaunch({ pathname: ROUTE_PATHS.explore }, { isCompleted: false, isDismissed: false })).toBeFalse();
    expect(policy.shouldLaunch({ pathname: ROUTE_PATHS.home }, { isCompleted: true, isDismissed: false })).toBeFalse();
  });
});

describe("GuidedOnboardingFlow", () => {
  it("exposes intent-friendly Build/Explore/Run guidance with real launch targets", () => {
    const store = new InMemoryOnboardingProgressStore();
    const flow = new GuidedOnboardingFlow(
      new OnboardingTriggerPolicy(new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } })),
      store,
    );

    const state = flow.resolveState({ pathname: ROUTE_PATHS.home });

    expect(state.isVisible).toBeTrue();
    expect(state.steps.map((step) => step.title)).toEqual([
      "Build starts with intent",
      "Explore is your unified library",
      "Run is where testing and execution live",
      "Need to move faster?",
    ]);
    expect(state.steps.every((step) => !step.description.toLowerCase().includes("taxonomy"))).toBeTrue();
    expect(flow.toLaunchAction(state.steps[0]!).launchPath).toBe(ROUTE_PATHS.build);
    expect(flow.toLaunchAction(state.steps[1]!).launchPath).toBe(ROUTE_PATHS.explore);
    expect(flow.toLaunchAction(state.steps[2]!).launchPath).toBe(ROUTE_PATHS.run);
  });

  it("records dismissed or completed onboarding progress", () => {
    const store = new InMemoryOnboardingProgressStore();
    const flow = new GuidedOnboardingFlow(
      new OnboardingTriggerPolicy(new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } })),
      store,
    );

    flow.dismiss();
    expect(store.value?.isDismissed).toBeTrue();
    expect(store.value?.isCompleted).toBeFalse();

    flow.complete();
    expect(store.value?.isCompleted).toBeTrue();
    expect(store.value?.isDismissed).toBeFalse();
  });
});
