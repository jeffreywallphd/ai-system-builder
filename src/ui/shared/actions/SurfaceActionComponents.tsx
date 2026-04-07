import { useId, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { SurfaceResponsiveProfile } from "@ui/shared/responsive";
import {
  invokeSurfaceAction,
  resolveSurfaceActionDescriptors,
  toVisibleSurfaceActions,
  type ResolvedSurfaceActionDescriptor,
  type SurfaceActionContext,
  type SurfaceActionDescriptor,
  type SurfaceActionExecutionOptions,
  type SurfaceActionScope,
} from "./SurfaceActionModel";

export interface SurfaceActionRenderProps<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
> {
  readonly actions: ReadonlyArray<SurfaceActionDescriptor<TResource, TSelection, TMeta>>;
  readonly context: SurfaceActionContext<TResource, TSelection, TMeta>;
  readonly scope?: SurfaceActionScope;
  readonly className?: string;
  readonly execution?: SurfaceActionExecutionOptions;
  readonly responsiveProfile?: SurfaceResponsiveProfile;
}

function joinClasses(...tokens: Array<string | undefined | false>): string {
  return tokens.filter((token): token is string => typeof token === "string" && token.length > 0).join(" ");
}

function toActionToneClass(action: ResolvedSurfaceActionDescriptor): string {
  if (action.tone === "primary") {
    return "ui-button--primary";
  }
  if (action.tone === "danger") {
    return "ui-button--danger";
  }
  return "ui-button--secondary";
}

function toRenderableActions<
  TResource,
  TSelection,
  TMeta,
>(
  props: SurfaceActionRenderProps<TResource, TSelection, TMeta>,
): ReadonlyArray<ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>> {
  const resolvedActions = resolveSurfaceActionDescriptors(props.actions, props.context);
  const visibleActions = toVisibleSurfaceActions(resolvedActions);
  if (!props.scope) {
    return visibleActions;
  }
  return visibleActions.filter((action) => action.scope === props.scope);
}

function runSurfaceAction<
  TResource,
  TSelection,
  TMeta,
>(
  action: ResolvedSurfaceActionDescriptor<TResource, TSelection, TMeta>,
  context: SurfaceActionContext<TResource, TSelection, TMeta>,
  execution?: SurfaceActionExecutionOptions,
): void {
  void invokeSurfaceAction(action, context, execution);
}

function moveFocusToMenuAction(
  refs: ReadonlyArray<HTMLButtonElement | null>,
  startIndex: number,
): void {
  for (let index = 0; index < refs.length; index += 1) {
    const candidate = refs[(startIndex + index) % refs.length];
    if (!candidate || candidate.disabled) {
      continue;
    }

    candidate.focus();
    return;
  }
}

export function SurfaceActionButtonStrip<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
>(
  props: SurfaceActionRenderProps<TResource, TSelection, TMeta>,
): JSX.Element | null {
  const actions = toRenderableActions(props);
  if (actions.length < 1) {
    return null;
  }

  return (
    <div
      className={joinClasses(
        "ui-action-strip",
        props.responsiveProfile ? `ui-action-strip--interaction-${props.responsiveProfile.interactionMode}` : undefined,
        props.responsiveProfile ? `ui-action-strip--density-${props.responsiveProfile.density}` : undefined,
        props.className,
      )}
      role="toolbar"
      aria-label="Surface actions"
      data-action-layout={props.responsiveProfile?.actionMenuLayout}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={joinClasses("ui-button ui-button--sm", toActionToneClass(action))}
          title={action.disabledReason}
          disabled={action.visibility === "disabled"}
          onClick={() => runSurfaceAction(action, props.context, props.execution)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export interface SurfaceActionMenuProps<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
> extends SurfaceActionRenderProps<TResource, TSelection, TMeta> {
  readonly triggerLabel?: string;
}

export function SurfaceActionMenu<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
>(
  props: SurfaceActionMenuProps<TResource, TSelection, TMeta>,
): JSX.Element | null {
  const actions = toRenderableActions(props);
  if (actions.length < 1) {
    return null;
  }
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const actionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  actionButtonRefs.current.length = actions.length;
  const menuId = useId();
  const menuLabel = props.triggerLabel ?? "Actions";

  const onDetailsKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (!detailsRef.current?.open) {
      return;
    }

    event.preventDefault();
    detailsRef.current.open = false;
    setIsOpen(false);
    summaryRef.current?.focus();
  };

  const onMenuItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void => {
    const focusTargetByOffset = (offset: number): void => {
      if (actions.length < 1) {
        return;
      }

      moveFocusToMenuAction(actionButtonRefs.current, (index + offset + actions.length) % actions.length);
    };

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTargetByOffset(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTargetByOffset(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveFocusToMenuAction(actionButtonRefs.current, 0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveFocusToMenuAction(actionButtonRefs.current, actions.length - 1);
    }
  };

  return (
    <details
      ref={detailsRef}
      className={joinClasses(
        "ui-action-menu",
        props.responsiveProfile ? `ui-action-menu--layout-${props.responsiveProfile.actionMenuLayout}` : undefined,
        props.responsiveProfile ? `ui-action-menu--interaction-${props.responsiveProfile.interactionMode}` : undefined,
        props.className,
      )}
      onToggle={() => setIsOpen(Boolean(detailsRef.current?.open))}
      onKeyDown={onDetailsKeyDown}
      data-action-layout={props.responsiveProfile?.actionMenuLayout}
    >
      <summary
        ref={summaryRef}
        className="ui-button ui-button--ghost ui-button--sm"
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={isOpen}
      >
        {menuLabel}
      </summary>
      <ul id={menuId} className="ui-action-menu__list" role="menu" aria-label={menuLabel}>
        {actions.map((action, index) => (
          <li key={action.id} className="ui-action-menu__item">
            <button
              ref={(element) => {
                actionButtonRefs.current[index] = element;
              }}
              type="button"
              className={joinClasses("ui-button ui-button--sm ui-action-menu__button", toActionToneClass(action))}
              role="menuitem"
              aria-disabled={action.visibility === "disabled"}
              title={action.disabledReason}
              disabled={action.visibility === "disabled"}
              onKeyDown={(event) => onMenuItemKeyDown(event, index)}
              onClick={() => runSurfaceAction(action, props.context, props.execution)}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SurfaceActionList<
  TResource = unknown,
  TSelection = unknown,
  TMeta = unknown,
>(
  props: SurfaceActionRenderProps<TResource, TSelection, TMeta>,
): JSX.Element | null {
  const actions = toRenderableActions(props);
  if (actions.length < 1) {
    return null;
  }

  return (
    <div
      className={joinClasses(
        "ui-action-list",
        props.responsiveProfile ? `ui-action-list--interaction-${props.responsiveProfile.interactionMode}` : undefined,
        props.responsiveProfile ? `ui-action-list--density-${props.responsiveProfile.density}` : undefined,
        props.className,
      )}
      role="toolbar"
      aria-label="Surface actions"
      data-action-layout={props.responsiveProfile?.actionMenuLayout}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={joinClasses("ui-button ui-button--sm ui-action-list__button", toActionToneClass(action))}
          title={action.disabledReason}
          disabled={action.visibility === "disabled"}
          onClick={() => runSurfaceAction(action, props.context, props.execution)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
