export interface ToolAutomationType {
  readonly id: string;
  readonly label: string;
  readonly keywords: ReadonlyArray<string>;
}

function createType(
  id: string,
  label: string,
  keywords: ReadonlyArray<string>
): ToolAutomationType {
  return Object.freeze({
    id,
    label,
    keywords: Object.freeze(keywords.map((keyword) => keyword.toLowerCase())),
  });
}

export const DEFAULT_TOOL_AUTOMATION_TYPES: ReadonlyArray<ToolAutomationType> =
  Object.freeze([
    createType("image-generation", "Image Creation", ["image", "illustration", "art", "generate"]),
    createType("image-enhancement", "Image Enhancement", ["enhance", "upscale", "retouch", "image"]),
    createType("video-generation", "Video Creation", ["video", "animation", "motion", "clip"]),
    createType("content-writing", "Content Writing", ["copy", "write", "blog", "content", "text"]),
    createType("customer-messaging", "Customer Messaging", ["reply", "response", "support", "message", "chat"]),
    createType("transcription", "Transcription", ["transcribe", "speech", "caption", "subtitle", "audio"]),
    createType("voiceover", "Voiceover", ["voice", "narration", "speak", "audio"]),
    createType("data-extraction", "Data Extraction", ["extract", "parse", "document", "invoice", "data"]),
    createType("summarization", "Summaries", ["summary", "summarize", "brief", "digest"]),
    createType("custom-automation", "Custom Automation", ["workflow", "automation"]),
  ]);
