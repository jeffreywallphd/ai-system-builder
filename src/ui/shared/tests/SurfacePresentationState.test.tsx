import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SurfaceStateBoundary,
  SurfaceStatePanel,
  createEmptyState,
  createLoadingState,
  toDisconnectedState,
  toSurfacePresentationStateFromApiError,
} from "../components/shell";

describe("Surface presentation state", () => {
  it("maps forbidden API errors to permission-denied state", () => {
    const state = toSurfacePresentationStateFromApiError(
      {
        code: "forbidden",
        message: "Not authorized",
      },
      {
        fallbackTitle: "Load failed",
        fallbackMessage: "Unable to load resource.",
      },
    );

    expect(state.kind).toBe("permission-denied");
    expect(state.title).toBe("Permission required");
  });

  it("maps missing resources and disconnected failures", () => {
    const notFound = toSurfacePresentationStateFromApiError(
      {
        code: "not-found",
        message: "Missing",
      },
      {
        fallbackTitle: "Load failed",
        fallbackMessage: "Unable to load resource.",
      },
    );
    const disconnected = toSurfacePresentationStateFromApiError(
      {
        code: "temporarily-unavailable",
        message: "Offline",
      },
      {
        fallbackTitle: "Load failed",
        fallbackMessage: "Unable to load resource.",
      },
    );

    expect(notFound.kind).toBe("not-found");
    expect(disconnected.kind).toBe("disconnected");
    expect(disconnected.retryable).toBeTrue();
  });

  it("renders empty and loading state panels", () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(SurfaceStatePanel, {
        state: createEmptyState("No data", "Nothing matched the current filters."),
      }),
    );

    const loadingHtml = renderToStaticMarkup(
      React.createElement(SurfaceStatePanel, {
        state: createLoadingState("Loading", "Loading from API."),
      }),
    );

    expect(emptyHtml).toContain("ui-shell-empty-state");
    expect(emptyHtml).toContain("No data");
    expect(loadingHtml).toContain("ui-shell-status ui-shell-status--neutral");
    expect(loadingHtml).toContain("Loading from API.");
  });

  it("renders boundary child content when no state is active", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SurfaceStateBoundary,
        { state: undefined },
        React.createElement("div", undefined, "table content"),
      ),
    );

    expect(html).toContain("table content");
  });

  it("creates explicit disconnected states", () => {
    const state = toDisconnectedState("Service unavailable", "Cannot reach host.");
    expect(state.kind).toBe("disconnected");
    expect(state.retryable).toBeTrue();
  });
});
