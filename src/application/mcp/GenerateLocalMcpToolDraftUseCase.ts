import type { LocalMcpToolDraft } from "./models/LocalMcpToolDraft";

export interface IGenerateLocalMcpToolDraftRequest {
  readonly prompt: string;
  readonly serverId?: string;
  readonly serverName?: string;
  readonly toolName?: string;
  readonly toolTitle?: string;
  readonly toolDescription?: string;
}

export class GenerateLocalMcpToolDraftUseCase {
  public async execute(request: IGenerateLocalMcpToolDraftRequest): Promise<Pick<LocalMcpToolDraft, "toolName" | "toolTitle" | "toolDescription" | "code" | "inputSchema" | "outputSchema">> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      throw new Error("Generating an MCP tool draft requires a prompt.");
    }

    const normalizedToolName = slugify(request.toolName || inferName(prompt) || "workspace_tool");
    const toolTitle = request.toolTitle?.trim() || titleCase(normalizedToolName.replace(/_/g, " "));
    const toolDescription = request.toolDescription?.trim() || sentenceCase(prompt);

    return Object.freeze({
      toolName: normalizedToolName,
      toolTitle,
      toolDescription,
      inputSchema: Object.freeze({
        type: "object",
        properties: Object.freeze({
          input: Object.freeze({
            type: "string",
            description: "Primary prompt, input text, or serialized data for the tool.",
          }),
          options: Object.freeze({
            type: "object",
            description: "Optional structured settings supplied by the caller.",
            additionalProperties: true,
          }),
        }),
        additionalProperties: true,
      }),
      outputSchema: Object.freeze({
        type: "object",
        properties: Object.freeze({
          summary: Object.freeze({ type: "string" }),
          data: Object.freeze({ type: "object", additionalProperties: true }),
        }),
        additionalProperties: true,
      }),
      code: buildCodeTemplate({
        prompt,
        toolName: normalizedToolName,
        toolDescription,
      }),
    });
  }
}

function buildCodeTemplate(params: { prompt: string; toolName: string; toolDescription: string }): string {
  const guidance = params.prompt.replace(/\s+/g, " ").trim();
  return [
    '"""AI-generated starter logic.',
    '',
    `Intent: ${guidance}`,
    'The runtime provides a `payload` dictionary and expects the function to return JSON-serializable data.',
    'You can edit everything below before saving the server.',
    '"""',
    '',
    'input_value = payload.get("input", "")',
    'options = payload.get("options", {})',
    '',
    '# Replace this starter implementation with real tool logic.',
    'summary = f"' + params.toolDescription.replace(/"/g, '\\"') + ': {input_value}".strip()',
    '',
    'return {',
    '    "summary": summary,',
    '    "data": {',
    `        "tool": "${params.toolName}",`,
    '        "input": input_value,',
    '        "options": options,',
    '        "intent": ' + JSON.stringify(guidance) + ',',
    '    },',
    '}',
  ].join("\n");
}

function inferName(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.join("_");
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "workspace_tool";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function sentenceCase(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Workspace-local MCP tool.";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
