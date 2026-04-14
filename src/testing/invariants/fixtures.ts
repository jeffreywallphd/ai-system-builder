import type {
  InvariantActorContextInput,
  InvariantFixtureBag,
  InvariantResourceContextInput,
  InvariantTargetContextInput,
  InvariantTargetKind,
  InvariantWorkspaceContextInput,
} from "./contracts";
import { InvariantTargetKinds } from "./contracts";

export type InvariantFixtureContribution =
  | InvariantFixtureBag
  | ((current: InvariantFixtureBag) => InvariantFixtureBag | Promise<InvariantFixtureBag>);

const DEFAULT_ACTOR_USER_ID = "user:actor-default";
const DEFAULT_ACTIVE_WORKSPACE_ID = "workspace:active-default";
const DEFAULT_RESOURCE_FAMILY = "asset";
const DEFAULT_RESOURCE_TYPE = "asset";
const DEFAULT_RESOURCE_ID = "asset:resource-default";
const DEFAULT_CAPABILITY_TARGET_FAMILY = "capability-target";
const DEFAULT_CAPABILITY_TARGET_TYPE = "capability-target";
const DEFAULT_CAPABILITY_KEY = "generic.access";

export interface InvariantActorContextFixtureInput {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
  readonly roleKeys?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantWorkspaceContextFixtureInput {
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly memberUserIdentityIds?: ReadonlyArray<string>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantResourceContextFixtureInput {
  readonly resourceFamily?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly identifiers?: Readonly<Record<string, string | undefined>>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface InvariantTargetContextFixtureInput {
  readonly targetKind?: InvariantTargetKind | string;
  readonly capabilityKey?: string;
  readonly resourceFamily?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly workspaceId?: string;
  readonly targetWorkspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly identifiers?: Readonly<Record<string, string | undefined>>;
  readonly attributes?: Readonly<Record<string, string>>;
}

export const InvariantWorkspaceRelationshipModes = Object.freeze({
  aligned: "aligned",
  actorVsTargetMismatch: "actor-vs-target-mismatch",
  actorVsResourceMismatch: "actor-vs-resource-mismatch",
  targetVsResourceMismatch: "target-vs-resource-mismatch",
  fullyDivergent: "fully-divergent",
});

export type InvariantWorkspaceRelationshipMode =
  typeof InvariantWorkspaceRelationshipModes[keyof typeof InvariantWorkspaceRelationshipModes];

export interface InvariantWorkspaceRelationshipFixtureInput {
  readonly mode?: InvariantWorkspaceRelationshipMode;
  readonly actor?: InvariantActorContextFixtureInput;
  readonly activeWorkspace?: InvariantWorkspaceContextFixtureInput;
  readonly targetWorkspace?: InvariantWorkspaceContextFixtureInput;
  readonly resourceWorkspace?: InvariantWorkspaceContextFixtureInput;
  readonly target?: InvariantTargetContextFixtureInput;
  readonly resource?: InvariantResourceContextFixtureInput;
}

export interface InvariantWorkspaceRelationshipFixture {
  readonly actor: InvariantActorContextInput;
  readonly activeWorkspace: InvariantWorkspaceContextInput;
  readonly targetWorkspace: InvariantWorkspaceContextInput;
  readonly resourceWorkspace: InvariantWorkspaceContextInput;
  readonly target: InvariantTargetContextInput;
  readonly resource: InvariantResourceContextInput;
}

export function normalizeInvariantIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} must not be empty.`);
  }
  return normalized;
}

export function normalizeOptionalInvariantIdentifier(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeInvariantIdentifierMap(
  values?: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> | undefined {
  if (!values) {
    return undefined;
  }

  const normalizedEntries = Object.entries(values)
    .map(([key, rawValue]) => {
      const normalizedValue = normalizeOptionalInvariantIdentifier(rawValue);
      if (!normalizedValue) {
        return undefined;
      }
      return [
        normalizeInvariantIdentifier(key, "Identifier key"),
        normalizedValue,
      ] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function normalizeInvariantStringArray(
  values: ReadonlyArray<string> | undefined,
  fieldName: string,
): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values.map((value, index) => normalizeInvariantIdentifier(value, `${fieldName}[${index}]`));
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeInvariantStringRecord(
  values: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!values) {
    return undefined;
  }

  const normalizedEntries = Object.entries(values).map(([key, value]) => [
    normalizeInvariantIdentifier(key, "Attribute key"),
    normalizeInvariantIdentifier(value, `Attribute '${key}' value`),
  ] as const);

  return normalizedEntries.length > 0 ? Object.freeze(Object.fromEntries(normalizedEntries)) : undefined;
}

function normalizeTargetKind(targetKind?: InvariantTargetKind | string): InvariantTargetKind {
  const normalized = normalizeOptionalInvariantIdentifier(targetKind)?.toLowerCase();
  if (!normalized) {
    return InvariantTargetKinds.resource;
  }
  if (normalized === InvariantTargetKinds.resource || normalized === InvariantTargetKinds.capability) {
    return normalized;
  }
  throw new Error(`Unsupported target kind '${targetKind}'.`);
}

function deriveWorkspaceId(baseWorkspaceId: string, suffix: string): string {
  return `${baseWorkspaceId}:${suffix}`;
}

function normalizeWorkspaceRelationshipMode(
  mode?: InvariantWorkspaceRelationshipMode,
): InvariantWorkspaceRelationshipMode {
  return mode ?? InvariantWorkspaceRelationshipModes.aligned;
}

export function buildInvariantActorContext(
  input: InvariantActorContextFixtureInput = {},
): InvariantActorContextInput {
  const actorUserIdentityId = normalizeOptionalInvariantIdentifier(input.actorUserIdentityId);
  const actorServiceId = normalizeOptionalInvariantIdentifier(input.actorServiceId);
  const resolvedActorUserIdentityId = actorUserIdentityId ?? (actorServiceId ? undefined : DEFAULT_ACTOR_USER_ID);
  const activeWorkspaceId = normalizeOptionalInvariantIdentifier(input.activeWorkspaceId);
  const roleKeys = normalizeInvariantStringArray(input.roleKeys, "roleKeys");
  const attributes = normalizeInvariantStringRecord(input.attributes);

  return Object.freeze({
    actorUserIdentityId: resolvedActorUserIdentityId,
    actorServiceId,
    activeWorkspaceId,
    roleKeys,
    attributes,
  });
}

export function buildInvariantWorkspaceContext(
  input: InvariantWorkspaceContextFixtureInput = {},
): InvariantWorkspaceContextInput {
  const workspaceId = normalizeInvariantIdentifier(
    input.workspaceId ?? DEFAULT_ACTIVE_WORKSPACE_ID,
    "workspaceId",
  );

  return Object.freeze({
    workspaceId,
    ownerUserIdentityId: normalizeOptionalInvariantIdentifier(input.ownerUserIdentityId),
    memberUserIdentityIds: normalizeInvariantStringArray(input.memberUserIdentityIds, "memberUserIdentityIds"),
    attributes: normalizeInvariantStringRecord(input.attributes),
  });
}

export function buildInvariantResourceContext(
  input: InvariantResourceContextFixtureInput = {},
): InvariantResourceContextInput {
  const resourceId = normalizeInvariantIdentifier(input.resourceId ?? DEFAULT_RESOURCE_ID, "resourceId");
  const normalizedIdentifiers = normalizeInvariantIdentifierMap({
    ...input.identifiers,
    resourceId,
  });

  return Object.freeze({
    resourceFamily: normalizeInvariantIdentifier(
      input.resourceFamily ?? DEFAULT_RESOURCE_FAMILY,
      "resourceFamily",
    ),
    resourceType: normalizeInvariantIdentifier(input.resourceType ?? DEFAULT_RESOURCE_TYPE, "resourceType"),
    resourceId,
    workspaceId: normalizeOptionalInvariantIdentifier(input.workspaceId),
    ownerUserIdentityId: normalizeOptionalInvariantIdentifier(input.ownerUserIdentityId),
    identifiers: normalizedIdentifiers,
    attributes: normalizeInvariantStringRecord(input.attributes),
  });
}

export function buildInvariantTargetContext(
  input: InvariantTargetContextFixtureInput = {},
): InvariantTargetContextInput {
  const targetKind = normalizeTargetKind(input.targetKind);
  const targetWorkspaceId = normalizeOptionalInvariantIdentifier(input.targetWorkspaceId ?? input.workspaceId);
  const capabilityKey = normalizeOptionalInvariantIdentifier(input.capabilityKey) ?? DEFAULT_CAPABILITY_KEY;

  const resourceFamily = targetKind === InvariantTargetKinds.capability
    ? normalizeInvariantIdentifier(input.resourceFamily ?? DEFAULT_CAPABILITY_TARGET_FAMILY, "resourceFamily")
    : normalizeInvariantIdentifier(input.resourceFamily ?? DEFAULT_RESOURCE_FAMILY, "resourceFamily");
  const resourceType = targetKind === InvariantTargetKinds.capability
    ? normalizeInvariantIdentifier(input.resourceType ?? DEFAULT_CAPABILITY_TARGET_TYPE, "resourceType")
    : normalizeInvariantIdentifier(input.resourceType ?? DEFAULT_RESOURCE_TYPE, "resourceType");
  const resourceId = targetKind === InvariantTargetKinds.capability
    ? normalizeInvariantIdentifier(input.resourceId ?? `capability:${capabilityKey}`, "resourceId")
    : normalizeInvariantIdentifier(input.resourceId ?? DEFAULT_RESOURCE_ID, "resourceId");

  const identifiers = normalizeInvariantIdentifierMap({
    ...input.identifiers,
    resourceId,
    capabilityKey: targetKind === InvariantTargetKinds.capability ? capabilityKey : undefined,
  });

  return Object.freeze({
    targetKind,
    resourceFamily,
    resourceType,
    resourceId,
    workspaceId: targetWorkspaceId,
    targetWorkspaceId,
    ownerUserIdentityId: normalizeOptionalInvariantIdentifier(input.ownerUserIdentityId),
    identifiers,
    attributes: normalizeInvariantStringRecord(input.attributes),
  });
}

export function buildCapabilityTargetContext(
  input: Omit<InvariantTargetContextFixtureInput, "targetKind"> = {},
): InvariantTargetContextInput {
  return buildInvariantTargetContext({
    ...input,
    targetKind: InvariantTargetKinds.capability,
  });
}

function resolveWorkspaceRelationshipIds(
  input: InvariantWorkspaceRelationshipFixtureInput,
): { activeWorkspaceId: string; targetWorkspaceId: string; resourceWorkspaceId: string } {
  const activeWorkspaceId = normalizeInvariantIdentifier(
    input.activeWorkspace?.workspaceId ?? input.actor?.activeWorkspaceId ?? DEFAULT_ACTIVE_WORKSPACE_ID,
    "activeWorkspaceId",
  );
  let targetWorkspaceId = normalizeOptionalInvariantIdentifier(input.targetWorkspace?.workspaceId);
  let resourceWorkspaceId = normalizeOptionalInvariantIdentifier(input.resourceWorkspace?.workspaceId);
  const mode = normalizeWorkspaceRelationshipMode(input.mode);

  if (!targetWorkspaceId) {
    targetWorkspaceId = mode === InvariantWorkspaceRelationshipModes.actorVsTargetMismatch
      || mode === InvariantWorkspaceRelationshipModes.fullyDivergent
      ? deriveWorkspaceId(activeWorkspaceId, "target")
      : activeWorkspaceId;
  }

  if (!resourceWorkspaceId) {
    if (mode === InvariantWorkspaceRelationshipModes.actorVsResourceMismatch) {
      resourceWorkspaceId = deriveWorkspaceId(activeWorkspaceId, "resource");
    } else if (mode === InvariantWorkspaceRelationshipModes.targetVsResourceMismatch) {
      resourceWorkspaceId = deriveWorkspaceId(targetWorkspaceId, "resource");
    } else if (mode === InvariantWorkspaceRelationshipModes.fullyDivergent) {
      resourceWorkspaceId = deriveWorkspaceId(activeWorkspaceId, "resource");
    } else {
      resourceWorkspaceId = targetWorkspaceId;
    }
  }

  return Object.freeze({
    activeWorkspaceId,
    targetWorkspaceId,
    resourceWorkspaceId,
  });
}

export function buildInvariantWorkspaceRelationshipFixture(
  input: InvariantWorkspaceRelationshipFixtureInput = {},
): InvariantWorkspaceRelationshipFixture {
  const workspaceIds = resolveWorkspaceRelationshipIds(input);

  const actor = buildInvariantActorContext({
    ...input.actor,
    activeWorkspaceId: input.actor?.activeWorkspaceId ?? workspaceIds.activeWorkspaceId,
  });

  const activeWorkspace = buildInvariantWorkspaceContext({
    ...input.activeWorkspace,
    workspaceId: workspaceIds.activeWorkspaceId,
  });

  const targetWorkspace = buildInvariantWorkspaceContext({
    ...input.targetWorkspace,
    workspaceId: workspaceIds.targetWorkspaceId,
  });

  const resourceWorkspace = buildInvariantWorkspaceContext({
    ...input.resourceWorkspace,
    workspaceId: workspaceIds.resourceWorkspaceId,
  });

  const resource = buildInvariantResourceContext({
    ...input.resource,
    workspaceId: input.resource?.workspaceId ?? resourceWorkspace.workspaceId,
  });

  const target = buildInvariantTargetContext({
    ...input.target,
    workspaceId: input.target?.workspaceId ?? targetWorkspace.workspaceId,
    targetWorkspaceId: input.target?.targetWorkspaceId ?? targetWorkspace.workspaceId,
    resourceFamily: input.target?.resourceFamily ?? resource.resourceFamily,
    resourceType: input.target?.resourceType ?? resource.resourceType,
    resourceId: input.target?.resourceId ?? resource.resourceId,
    ownerUserIdentityId: input.target?.ownerUserIdentityId ?? resource.ownerUserIdentityId,
  });

  return Object.freeze({
    actor,
    activeWorkspace,
    targetWorkspace,
    resourceWorkspace,
    target,
    resource,
  });
}

export function buildAlignedInvariantWorkspaceRelationshipFixture(
  input: Omit<InvariantWorkspaceRelationshipFixtureInput, "mode"> = {},
): InvariantWorkspaceRelationshipFixture {
  return buildInvariantWorkspaceRelationshipFixture({
    ...input,
    mode: InvariantWorkspaceRelationshipModes.aligned,
  });
}

export async function composeInvariantFixtures(
  ...contributions: ReadonlyArray<InvariantFixtureContribution>
): Promise<InvariantFixtureBag> {
  let composed: InvariantFixtureBag = Object.freeze({});

  for (const contribution of contributions) {
    const next = typeof contribution === "function"
      ? await contribution(composed)
      : contribution;
    composed = Object.freeze({
      ...composed,
      ...next,
    });
  }

  return composed;
}
