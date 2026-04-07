import { IntentNavigationFeatureFlag } from "../features/IntentNavigationFeatureFlag";
import { ROUTE_PATHS } from "./RouteConfig";

export interface OnboardingStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionPath: string;
}

export interface OnboardingState {
  readonly isVisible: boolean;
  readonly currentStepIndex: number;
  readonly steps: ReadonlyArray<OnboardingStep>;
}

export interface OnboardingLaunchAction {
  readonly stepId: string;
  readonly launchPath: string;
}

export interface OnboardingProgress {
  readonly isCompleted: boolean;
  readonly isDismissed: boolean;
  readonly lastSeenAtIso?: string;
}

export interface OnboardingProgressStorage {
  load(): OnboardingProgress | undefined;
  save(progress: OnboardingProgress): void;
}

export interface OnboardingTriggerContext {
  readonly pathname: string;
}

const onboardingSteps: ReadonlyArray<OnboardingStep> = Object.freeze([
  Object.freeze({
    id: "build",
    title: "Build starts with intent",
    description: "Use Build when you want to create something. Start from your goal, then choose the right flow.",
    actionLabel: "Open Build",
    actionPath: ROUTE_PATHS.build,
  }),
  Object.freeze({
    id: "explore",
    title: "Explore is your unified library",
    description: "Use Explore to find and manage what already exists across all asset types.",
    actionLabel: "Open Explore",
    actionPath: ROUTE_PATHS.explore,
  }),
  Object.freeze({
    id: "run",
    title: "Run is where testing and execution live",
    description: "Use Run to launch tests and executions from one shared surface.",
    actionLabel: "Open Run",
    actionPath: ROUTE_PATHS.run,
  }),
  Object.freeze({
    id: "commands",
    title: "Need to move faster?",
    description: "Press Cmd/Ctrl + K anytime to open the command palette and jump to actions quickly.",
    actionLabel: "Start building",
    actionPath: ROUTE_PATHS.build,
  }),
]);

const defaultProgress: OnboardingProgress = Object.freeze({
  isCompleted: false,
  isDismissed: false,
});

const storageKey = "ai-loom-studio.intent-onboarding";

export class LocalStorageOnboardingProgressStore implements OnboardingProgressStorage {
  private readonly key: string;
  private readonly storage?: Pick<Storage, "getItem" | "setItem">;

  constructor(key = storageKey, storage = typeof window !== "undefined" ? window.localStorage : undefined) {
    this.key = key;
    this.storage = storage;
  }

  public load(): OnboardingProgress | undefined {
    const raw = this.storage?.getItem(this.key);
    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as OnboardingProgress;
    } catch {
      return undefined;
    }
  }

  public save(progress: OnboardingProgress): void {
    this.storage?.setItem(this.key, JSON.stringify(progress));
  }
}

export class OnboardingTriggerPolicy {
  constructor(private readonly featureFlag = new IntentNavigationFeatureFlag()) {}

  public shouldLaunch(context: OnboardingTriggerContext, progress: OnboardingProgress): boolean {
    if (!this.featureFlag.isEnabled()) {
      return false;
    }
    if (progress.isCompleted || progress.isDismissed) {
      return false;
    }
    return context.pathname === ROUTE_PATHS.home || context.pathname === ROUTE_PATHS.build;
  }
}

export class GuidedOnboardingFlow {
  private readonly triggerPolicy: OnboardingTriggerPolicy;
  private readonly progressStore: OnboardingProgressStorage;

  constructor(
    triggerPolicy = new OnboardingTriggerPolicy(),
    progressStore: OnboardingProgressStorage = new LocalStorageOnboardingProgressStore(),
  ) {
    this.triggerPolicy = triggerPolicy;
    this.progressStore = progressStore;
  }

  public resolveState(context: OnboardingTriggerContext): OnboardingState {
    const progress = this.progressStore.load() ?? defaultProgress;
    return Object.freeze({
      isVisible: this.triggerPolicy.shouldLaunch(context, progress),
      currentStepIndex: 0,
      steps: onboardingSteps,
    });
  }

  public complete(): void {
    this.progressStore.save(Object.freeze({
      isCompleted: true,
      isDismissed: false,
      lastSeenAtIso: new Date().toISOString(),
    }));
  }

  public dismiss(): void {
    this.progressStore.save(Object.freeze({
      isCompleted: false,
      isDismissed: true,
      lastSeenAtIso: new Date().toISOString(),
    }));
  }

  public toLaunchAction(step: OnboardingStep): OnboardingLaunchAction {
    return Object.freeze({ stepId: step.id, launchPath: step.actionPath });
  }
}
