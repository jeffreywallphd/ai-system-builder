import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../modules/ui/shared/assets/branding/logo.svg", () => ({ default: "logo.svg" }));
vi.mock("../features/workspace", () => ({ WorkspaceSwitcher: () => <section>Workspace switcher</section> }));

import { AppShell } from "../components/layout/AppShell";
import { desktopPageDefinitions } from "../routes/desktopPages";

describe("desktop AppShell visible workspace page state", () => {
  it("does not mark a pending workspace-required route active while setup is visible", () => {
    const html = renderToString(
      <AppShell activePage={undefined} pages={desktopPageDefinitions} onNavigate={() => undefined}>
        <section>Workspace required</section>
      </AppShell>,
    );

    expect(html).toContain("Workspace required");
    expect(html).toContain("Models");
    expect(html).not.toContain("aria-current=\"page\"");
  });
});
