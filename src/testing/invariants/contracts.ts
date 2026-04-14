import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";

export const InvariantFeatureFamilies = Object.freeze({
  asset: "asset",
  workflow: "workflow",
  system: "system",
  run: "run",
  storage: "storage",
  secret: "secret",
  adminDeployment: "admin-deployment",
});

export type InvariantFeatureFamily =
  typeof InvariantFeatureFamilies[keyof typeof InvariantFeatureFamilies];

export type InvariantDecisionOutcome = "allow" | "deny";

export const InvariantTargetKinds = Object.freeze({
  resource: "resource",
  capability: "capability",
});

export type InvariantTargetKind = typeof InvariantTargetKinds[keyof typeof InvariantTargetKinds];

export interface InvariantActorContextInput {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
  readonly roleKeys?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantWorkspaceContextInput {
  readonly workspaceId: string;
  readonly ownerUserIdentityId?: string;
  readonly memberUserIdentityIds?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantTargetContextInput {
  readonly targetKind?: InvariantTargetKind;
  readonly resourceFamily: AuthorizationResourceFamily | string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
  readonly targetWorkspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantResourceContextInput {
  readonly resourceFamily: AuthorizationResourceFamily | string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantExpectedDecisionMetadata {
  readonly reasonCode?: string;
  readonly denialReason?: string;
  readonly requiredPermissionKey?: string;
  readonly matchedRoleAssignmentIds?: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds?: ReadonlyArray<string>;
  readonly matchedSharingGrantIds?: ReadonlyArray<string>;
}

export interface InvariantExpectedRuntimeMetadata {
  readonly statusCode?: string;
  readonly visibleResourceIds?: ReadonlyArray<string>;
  readonly redactedFields?: ReadonlyArray<string>;
  readonly notes?: ReadonlyArray<string>;
}

export interface InvariantScenarioExpectation {
  readonly outcome: InvariantDecisionOutcome;
  readonly decision?: InvariantExpectedDecisionMetadata;
  readonly runtime?: InvariantExpectedRuntimeMetadata;
}

export type InvariantFixtureBag = Readonly<Record<string, unknown>>;

export interface InvariantScenarioDefinition<TInput = unknown> {
  readonly scenarioId: string;
  readonly title: string;
  readonly family: InvariantFeatureFamily;
  readonly capability: string;
  readonly actor: InvariantActorContextInput;
  readonly workspace: InvariantWorkspaceContextInput;
  readonly target: InvariantTargetContextInput;
  readonly resource?: InvariantResourceContextInput;
  readonly input?: TInput;
  readonly expectation: InvariantScenarioExpectation;
  readonly tags?: ReadonlyArray<string>;
}

export interface InvariantObservedDecisionMetadata {
  readonly reasonCode?: string;
  readonly denialReason?: string;
  readonly requiredPermissionKey?: string;
  readonly matchedRoleAssignmentIds?: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds?: ReadonlyArray<string>;
  readonly matchedSharingGrantIds?: ReadonlyArray<string>;
}

export interface InvariantObservedRuntimeMetadata {
  readonly statusCode?: string;
  readonly visibleResourceIds?: ReadonlyArray<string>;
  readonly redactedFields?: ReadonlyArray<string>;
  readonly notes?: ReadonlyArray<string>;
}

export interface InvariantObservedResult<TResult = unknown> {
  readonly outcome: InvariantDecisionOutcome;
  readonly decision?: InvariantObservedDecisionMetadata;
  readonly runtime?: InvariantObservedRuntimeMetadata;
  readonly result?: TResult;
}

export interface InvariantEvaluationRequest<TInput = unknown> {
  readonly scenario: InvariantScenarioDefinition<TInput>;
  readonly fixtures: InvariantFixtureBag;
  readonly evaluatedAt: string;
}

export interface InvariantFamilyAdapter<TInput = unknown, TResult = unknown> {
  readonly family: InvariantFeatureFamily;
  evaluate(request: InvariantEvaluationRequest<TInput>): Promise<InvariantObservedResult<TResult>>;
}

export interface InvariantExecutionRequest<TInput = unknown> {
  readonly scenario: InvariantScenarioDefinition<TInput>;
  readonly fixtures?: InvariantFixtureBag;
  readonly now?: () => Date;
}

export interface InvariantExecutionResult<TInput = unknown, TResult = unknown> {
  readonly scenario: InvariantScenarioDefinition<TInput>;
  readonly observed: InvariantObservedResult<TResult>;
  readonly evaluatedAt: string;
}
