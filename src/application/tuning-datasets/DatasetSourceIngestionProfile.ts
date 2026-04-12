import { createFileIngestionProfile } from "../ingestion/IngestionProfiles";

export const DatasetSourceIngestionProfile = createFileIngestionProfile({
  id: "dataset-source-markdown-ingestion",
  capability: "dataset-source-ingestion",
  policy: {
    acceptedExtensions: [".pdf", ".docx", ".pptx", ".md", ".markdown", ".txt"],
    acceptedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/markdown",
      "text/x-markdown",
      "text/plain",
    ],
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowMissingMimeType: true,
    mismatchWarningsEnabled: true,
    conversion: {
      mode: "optional",
      allowedOutputFormats: ["markdown"],
      passThroughExtensions: [".md", ".markdown", ".txt"],
      passThroughMimeTypes: ["text/markdown", "text/x-markdown", "text/plain"],
    },
  },
  metadata: {
    boundedContext: "tuning-datasets",
    canonicalOutput: "markdown",
  },
});
