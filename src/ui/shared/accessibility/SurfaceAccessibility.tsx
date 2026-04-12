import { useEffect, useRef, type ReactNode, type RefObject } from "react";

function joinClasses(...tokens: Array<string | undefined | false>): string {
  return tokens.filter((token): token is string => typeof token === "string" && token.length > 0).join(" ");
}

const focusableSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]",
].join(", ");

function toFocusableElements(container: HTMLElement): ReadonlyArray<HTMLElement> {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return element.tabIndex >= 0;
  });
}

function focusFirstInContainer(container: HTMLElement): void {
  const focusables = toFocusableElements(container);
  if (focusables.length > 0) {
    focusables[0]?.focus();
    return;
  }

  container.focus();
}

export function toSurfaceRouteAnnouncement(pathname: string): string {
  const normalized = pathname.trim().replace(/\/+$/, "") || "/";
  if (normalized === "/") {
    return "Navigated to home.";
  }

  const segments = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment).replace(/[-_]/g, " "));

  return `Navigated to ${segments.join(" / ")}.`;
}

export interface UseSurfaceRouteFocusOptions {
  readonly onAnnounce?: (message: string) => void;
  readonly toAnnouncement?: (pathname: string) => string;
}

export function useSurfaceRouteFocus(
  pathname: string,
  focusTargetRef: RefObject<HTMLElement>,
  options: UseSurfaceRouteFocusOptions = {},
): void {
  const previousPathRef = useRef(pathname);
  const toAnnouncement = options.toAnnouncement ?? toSurfaceRouteAnnouncement;

  useEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = pathname;
    if (previousPath === pathname) {
      return;
    }

    focusTargetRef.current?.focus({ preventScroll: true });
    options.onAnnounce?.(toAnnouncement(pathname));
  }, [focusTargetRef, options, pathname, toAnnouncement]);
}

export interface UseSurfaceDialogFocusTrapOptions {
  readonly isOpen: boolean;
  readonly containerRef: RefObject<HTMLElement>;
  readonly onRequestClose?: () => void;
  readonly restoreFocusOnClose?: boolean;
}

export function useSurfaceDialogFocusTrap({
  isOpen,
  containerRef,
  onRequestClose,
  restoreFocusOnClose = true,
}: UseSurfaceDialogFocusTrapOptions): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusFirstInContainer(container);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onRequestClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = toFocusableElements(container);
      if (focusables.length < 1) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [containerRef, isOpen, onRequestClose]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current || !restoreFocusOnClose) {
      return;
    }

    wasOpenRef.current = false;
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
    }
  }, [isOpen, restoreFocusOnClose]);
}

export interface SurfaceSkipLinkProps {
  readonly targetId: string;
  readonly label?: string;
  readonly className?: string;
}

export function SurfaceSkipLink({
  targetId,
  label = "Skip to main content",
  className,
}: SurfaceSkipLinkProps): JSX.Element {
  return (
    <a href={`#${targetId}`} className={joinClasses("ui-skip-link", className)}>
      {label}
    </a>
  );
}

export interface SurfaceLiveRegionProps {
  readonly message?: string;
  readonly politeness?: "off" | "polite" | "assertive";
  readonly id?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function SurfaceLiveRegion({
  message,
  politeness = "polite",
  id,
  className,
  children,
}: SurfaceLiveRegionProps): JSX.Element {
  return (
    <p
      id={id}
      className={joinClasses("ui-visually-hidden", className)}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
    >
      {message ?? children}
    </p>
  );
}
