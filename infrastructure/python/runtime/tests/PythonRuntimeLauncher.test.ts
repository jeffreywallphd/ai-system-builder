import { describe, expect, it } from "bun:test";
import { PythonRuntimeLauncher } from "../PythonRuntimeLauncher";

describe("PythonRuntimeLauncher", () => {
  it("spawns uvicorn with runtime module", () => {
    const calls: unknown[] = [];
    const launcher = new PythonRuntimeLauncher({
      spawn: (command, args, options) => {
        calls.push({ command, args, options });
        return { on: () => undefined, kill: () => true };
      },
      pythonExecutable: "python3",
      runtimeWorkingDirectory: "/tmp/python-runtime",
      port: 8123,
    });

    launcher.launch();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "python3",
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8123"],
    });
  });
});
