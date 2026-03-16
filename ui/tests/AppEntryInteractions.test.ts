import { describe, expect, it } from "bun:test";
import { readSource } from "./testUtils";

describe("ui app entry interactions", () => {
  it("wires App to providers, AppRouter, and the main entrypoint", () => {
    const appSource = readSource("ui/App.tsx");
    const mainSource = readSource("ui/main.tsx");

    expect(appSource).toContain('import AppRouter from "./routes/AppRouter"');
    expect(appSource).toContain(
      'import { AppProviders } from "./composition/AppProviders"'
    );
    expect(appSource).toContain("<AppProviders config={config}>");
    expect(appSource).toContain("<AppRouter isAuthenticated={isAuthenticated} />");
    expect(mainSource).toContain('import App from "./App"');
    expect(mainSource).toContain('import "./styles/app.css"');
    expect(mainSource).toContain("<App isAuthenticated={true} />");
  });

  it("provides root html shell for mounting", () => {
    const source = readSource("index.html");

    expect(source).toContain('<div id="root"></div>');
    expect(source).toContain('<script type="module" src="/ui/main.tsx"></script>');
  });
});
