import { describe, expect, it } from "bun:test";
import {
  ThinClientFormFactors,
  buildThinClientSessionChannelContext,
  evaluateThinClientWebSocketOriginPolicy,
  resolveThinClientFormFactor,
} from "../ThinClientTransportContracts";

describe("ThinClientTransportContracts", () => {
  it("classifies browser and mobile thin-client form factors", () => {
    expect(resolveThinClientFormFactor(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    )).toBe(ThinClientFormFactors.browser);
    expect(resolveThinClientFormFactor(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    )).toBe(ThinClientFormFactors.mobileBrowser);
    expect(resolveThinClientFormFactor(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 wv",
    )).toBe(ThinClientFormFactors.mobileWebView);
  });

  it("projects thin-client request metadata into channel context", () => {
    const context = buildThinClientSessionChannelContext({
      userAgent: "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
      origin: "https://studio.loom.example",
    });
    expect(context.accessChannel).toBe("thin-client");
    expect(context.formFactor).toBe(ThinClientFormFactors.mobileBrowser);
    expect(context.mobile).toBeTrue();
    expect(context.browserSurface).toBeTrue();
    expect(context.origin).toBe("https://studio.loom.example");
  });

  it("enforces origin presence and host/scheme policy for thin-client websocket upgrades", () => {
    const missingOrigin = evaluateThinClientWebSocketOriginPolicy({
      originHeader: undefined,
      expectedHost: "studio.loom.example",
    });
    expect(missingOrigin.accepted).toBeFalse();
    expect(missingOrigin.reason).toBe("origin-required");

    const mismatchedHost = evaluateThinClientWebSocketOriginPolicy({
      originHeader: "https://evil.example",
      expectedHost: "studio.loom.example",
    });
    expect(mismatchedHost.accepted).toBeFalse();
    expect(mismatchedHost.reason).toBe("origin-host-mismatch");

    const accepted = evaluateThinClientWebSocketOriginPolicy({
      originHeader: "https://studio.loom.example",
      expectedHost: "studio.loom.example",
    });
    expect(accepted.accepted).toBeTrue();
    expect(accepted.normalizedOrigin).toBe("https://studio.loom.example");

    const acceptedLoopbackHttp = evaluateThinClientWebSocketOriginPolicy({
      originHeader: "http://127.0.0.1:5174",
      expectedHost: "127.0.0.1:5174",
    });
    expect(acceptedLoopbackHttp.accepted).toBeTrue();
  });
});
