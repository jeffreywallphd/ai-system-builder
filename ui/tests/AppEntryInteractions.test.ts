import { describe, expect, it } from "bun:test";
import { readSource } from "./testUtils";

describe("ui app entry interactions", () => {
  it("wires App to AppRouter and main entrypoint", () => {
    const appSource = readSource("ui/App.tsx");
    const mainSource = readSource("ui/main.tsx");

    expect(appSource).toContain('import AppRouter from "./routes/AppRouter"');
    expect(appSource).toContain("<AppRouter isAuthenticated={isAuthenticated} />");
    expect(mainSource).toContain('import App from "./App"');
    expect(mainSource).toContain('import "./layout/AppLayout.css"');
    expect(mainSource).toContain("<App isAuthenticated={true} />");
  });

  it("provides root html shell for mounting", () => {
    const source = readSource("index.html");

    expect(source).toContain('<div id="root"></div>');
    expect(source).toContain('<script type="module" src="/ui/main.tsx"></script>');
  });
});
