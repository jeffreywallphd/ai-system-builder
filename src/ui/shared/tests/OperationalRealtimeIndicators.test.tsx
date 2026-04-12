import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OperationalRealtimeBanner,
  OperationalRealtimeStatusPill,
} from "../operations";

describe("OperationalRealtimeIndicators", () => {
  it("renders connected live-state affordances", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalRealtimeBanner, {
        connectionState: Object.freeze({
          state: "connected",
          stale: false,
        }),
        onRefresh: () => undefined,
        onReconnect: () => undefined,
      }),
    );

    expect(html).toContain("Connected");
    expect(html).toContain("live event stream active");
    expect(html).toContain("Refresh operational data");
    expect(html).toContain("Reconnect live updates");
  });

  it("renders stale reconnecting status consistently across banner and pill", () => {
    const bannerHtml = renderToStaticMarkup(
      React.createElement(OperationalRealtimeBanner, {
        connectionState: Object.freeze({
          state: "reconnecting",
          stale: true,
          detail: "Socket closed unexpectedly.",
        }),
        onRefresh: () => undefined,
        onReconnect: () => undefined,
      }),
    );
    const pillHtml = renderToStaticMarkup(
      React.createElement(OperationalRealtimeStatusPill, {
        connectionState: Object.freeze({
          state: "reconnecting",
          stale: true,
        }),
      }),
    );

    expect(bannerHtml).toContain("Reconnecting");
    expect(bannerHtml).toContain("stale data fallback active");
    expect(bannerHtml).toContain("Socket closed unexpectedly.");
    expect(pillHtml).toContain("Reconnecting");
    expect(pillHtml).toContain("stale");
  });
});
