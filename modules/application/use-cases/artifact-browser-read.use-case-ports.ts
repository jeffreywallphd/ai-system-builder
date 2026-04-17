import type {
  BrowseArtifactsCommand,
  BrowseArtifactsUseCaseResult,
  ReadArtifactContentCommand,
  ReadArtifactContentUseCaseResult,
  ReadArtifactDetailCommand,
  ReadArtifactDetailUseCaseResult,
  ArtifactBrowserCommandContext,
} from "./artifact-browser-read.types";

export interface BrowseArtifactsUseCasePort {
  execute: (
    command: BrowseArtifactsCommand,
    context?: ArtifactBrowserCommandContext,
  ) => Promise<BrowseArtifactsUseCaseResult>;
}

export interface ReadArtifactDetailUseCasePort {
  execute: (
    command: ReadArtifactDetailCommand,
    context?: ArtifactBrowserCommandContext,
  ) => Promise<ReadArtifactDetailUseCaseResult>;
}

export interface ReadArtifactContentUseCasePort {
  execute: (
    command: ReadArtifactContentCommand,
    context?: ArtifactBrowserCommandContext,
  ) => Promise<ReadArtifactContentUseCaseResult>;
}
