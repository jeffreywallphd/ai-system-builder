export type SurfaceActionScope = "page" | "row" | "bulk";

export type SurfaceActionTone = "primary" | "secondary" | "danger";

export type SurfaceActionSurface = "desktop" | "thin-client" | "mobile";

export type SurfaceActionVisibility = "visible" | "disabled" | "hidden";

export type SurfaceActionRestrictionBehavior = "hidden" | "disabled";

export interface SurfaceActionAvailability {
  readonly hidden?: boolean;
  readonly hiddenReason?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

export interface SurfaceActionConfirmationDescriptor {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: "secondary" | "danger";
}

export interface SurfaceActionTelemetryDescriptor {
  readonly eventName: string;
  readonly auditCategory?: string;
}

export interface SurfaceActionContext<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
> {
  readonly actorPermissionIds: ReadonlySet<string>;
  readonly surface: SurfaceActionSurface;
  readonly surfaceCapabilities: ReadonlySet<string>;
  readonly resource?: TResource;
  readonly selection?: TSelection;
  readonly meta?: TMeta;
}

export interface SurfaceActionDescriptor<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
> {
  readonly id: string;
  readonly label: string;
  readonly scope: SurfaceActionScope;
  readonly tone?: SurfaceActionTone;
  readonly priority?: number;
  readonly requiredPermissions?: ReadonlyArray<string>;
  readonly permissionRestrictionBehavior?: SurfaceActionRestrictionBehavior;
  readonly requiredSurfaceCapabilities?: ReadonlyArray<string>;
  readonly capabilityRestrictionBehavior?: SurfaceActionRestrictionBehavior;
  readonly availability?: (
    context: SurfaceActionContext<TResource, TSelection, TMeta>,
  ) => SurfaceActionAvailability;
  readonly confirmation?: SurfaceActionConfirmationDescriptor;
  readonly telemetry?: SurfaceActionTelemetryDescriptor;
  readonly onInvoke: (
    context: SurfaceActionContext<TResource, TSelection, TMeta>,
  ) => void | Promise<void>;
}

export interface ResolvedSurfaceActionDescriptor<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
> extends SurfaceActionDescriptor<TResource, TSelection, TMeta> {
  readonly visibility: SurfaceActionVisibility;
  readonly hiddenReason?: string;
  readonly disabledReason?: string;
}

export interface SurfaceActionExecutionTelemetryEvent {
  readonly actionId: string;
  readonly scope: SurfaceActionScope;
  readonly eventName?: string;
  readonly auditCategory?: string;
  readonly surface: SurfaceActionSurface;
}

export interface SurfaceActionExecutionOptions {
  readonly confirm?: (
    confirmation: SurfaceActionConfirmationDescriptor,
    descriptor: ResolvedSurfaceActionDescriptor,
  ) => boolean | Promise<boolean>;
  readonly onTelemetry?: (event: SurfaceActionExecutionTelemetryEvent) => void;
}

export interface SurfaceActionExecutionResult {
  readonly invoked: boolean;
  readonly blockedReason?: string;
}

function toMissingPermissionList(
  descriptor: SurfaceActionDescriptor,
  context: SurfaceActionContext,
): ReadonlyArray<string> {
  const requiredPermissions = descriptor.requiredPermissions ?? [];
  return requiredPermissions.filter((permissionId) => !context.actorPermissionIds.has(permissionId));
}

function toMissingCapabilityList(
  descriptor: SurfaceActionDescriptor,
  context: SurfaceActionContext,
): ReadonlyArray<string> {
  const requiredCapabilities = descriptor.requiredSurfaceCapabilities ?? [];
  return requiredCapabilities.filter((capability) => !context.surfaceCapabilities.has(capability));
}

function toHiddenResolution<
  TResource,
  TSelection,
  TMeta,
>(
  descriptor: SurfaceActionDescriptor<TResource, TSelection, TMeta>,
  hiddenReason: string,
): ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta> {
  return Object.freeze({
    ...descriptor,
    visibility: "hidden",
    hiddenReason,
  });
}

function toDisabledResolution<
  TResource,
  TSelection,
  TMeta,
>(
  descriptor: SurfaceActionDescriptor<TResource, TSelection, TMeta>,
  disabledReason: string,
): ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta> {
  return Object.freeze({
    ...descriptor,
    visibility: "disabled",
    disabledReason,
  });
}

function toVisibleResolution<
  TResource,
  TSelection,
  TMeta,
>(
  descriptor: SurfaceActionDescriptor<TResource, TSelection, TMeta>,
): ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta> {
  return Object.freeze({
    ...descriptor,
    visibility: "visible",
  });
}

export function resolveSurfaceActionDescriptor<
  TResource,
  TSelection,
  TMeta,
>(
  descriptor: SurfaceActionDescriptor<TResource, TSelection, TMeta>,
  context: SurfaceActionContext<TResource, TSelection, TMeta>,
): ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta> {
  const missingPermissions = toMissingPermissionList(descriptor, context);
  if (missingPermissions.length > 0) {
    const reason = `Requires permission: ${missingPermissions.join(", ")}.`;
    if ((descriptor.permissionRestrictionBehavior ?? "disabled") === "hidden") {
      return toHiddenResolution(descriptor, reason);
    }
    return toDisabledResolution(descriptor, reason);
  }

  const missingCapabilities = toMissingCapabilityList(descriptor, context);
  if (missingCapabilities.length > 0) {
    const reason = `Unavailable on ${context.surface}: ${missingCapabilities.join(", ")}.`;
    if ((descriptor.capabilityRestrictionBehavior ?? "hidden") === "hidden") {
      return toHiddenResolution(descriptor, reason);
    }
    return toDisabledResolution(descriptor, reason);
  }

  const availability = descriptor.availability?.(context);
  if (availability?.hidden) {
    return toHiddenResolution(descriptor, availability.hiddenReason ?? "Action is hidden in the current context.");
  }
  if (availability?.disabled) {
    return toDisabledResolution(descriptor, availability.disabledReason ?? "Action is unavailable in the current context.");
  }

  return toVisibleResolution(descriptor);
}

export function resolveSurfaceActionDescriptors<
  TResource,
  TSelection,
  TMeta,
>(
  descriptors: ReadonlyArray<SurfaceActionDescriptor<TResource, TSelection, TMeta>>,
  context: SurfaceActionContext<TResource, TSelection, TMeta>,
): ReadonlyArray<ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>> {
  return [...descriptors]
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
    .map((descriptor) => resolveSurfaceActionDescriptor(descriptor, context));
}

export function toVisibleSurfaceActions<
  TResource,
  TSelection,
  TMeta,
>(
  resolvedActions: ReadonlyArray<ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>>,
): ReadonlyArray<ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>> {
  return resolvedActions.filter((descriptor) => descriptor.visibility !== "hidden");
}

function defaultConfirmation(
  confirmation: SurfaceActionConfirmationDescriptor,
): boolean {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(`${confirmation.title}\n\n${confirmation.message}`);
  }
  return true;
}

export async function invokeSurfaceAction<
  TResource,
  TSelection,
  TMeta,
>(
  descriptor: ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>,
  context: SurfaceActionContext<TResource, TSelection, TMeta>,
  options: SurfaceActionExecutionOptions = {},
): Promise<SurfaceActionExecutionResult> {
  if (descriptor.visibility === "hidden") {
    return Object.freeze({ invoked: false, blockedReason: descriptor.hiddenReason ?? "Action is hidden." });
  }
  if (descriptor.visibility === "disabled") {
    return Object.freeze({ invoked: false, blockedReason: descriptor.disabledReason ?? "Action is disabled." });
  }

  if (descriptor.confirmation) {
    const confirm = options.confirm ?? defaultConfirmation;
    const confirmed = await confirm(descriptor.confirmation, descriptor);
    if (!confirmed) {
      return Object.freeze({ invoked: false, blockedReason: "Action was not confirmed." });
    }
  }

  options.onTelemetry?.({
    actionId: descriptor.id,
    scope: descriptor.scope,
    eventName: descriptor.telemetry?.eventName,
    auditCategory: descriptor.telemetry?.auditCategory,
    surface: context.surface,
  });

  await descriptor.onInvoke(context);
  return Object.freeze({ invoked: true });
}

export function createSurfaceActionContext<
  TResource,
  TSelection,
  TMeta,
>(
  input: {
    readonly actorPermissionIds?: ReadonlyArray<string>;
    readonly surface: SurfaceActionSurface;
    readonly surfaceCapabilities?: ReadonlyArray<string>;
    readonly resource?: TResource;
    readonly selection?: TSelection;
    readonly meta?: TMeta;
  },
): SurfaceActionContext<TResource, TSelection, TMeta> {
  return Object.freeze({
    actorPermissionIds: new Set(input.actorPermissionIds ?? []),
    surface: input.surface,
    surfaceCapabilities: new Set(input.surfaceCapabilities ?? []),
    resource: input.resource,
    selection: input.selection,
    meta: input.meta,
  });
}
