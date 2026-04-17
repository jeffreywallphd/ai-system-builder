import type { ContractResult } from "../../../contracts/shared";
import type { ArtifactBrowserBoundaryContext } from "../artifact-browser";
import type { ArtifactCatalogRecord } from "./artifact-catalog-record";

export interface AppendArtifactCatalogRecordRequest {
  record: ArtifactCatalogRecord;
}

export interface BrowseArtifactCatalogRecordsRequest {
  artifactKind: ArtifactCatalogRecord["artifactKind"];
}

export interface ReadArtifactCatalogRecordRequest {
  storageKey: string;
}

export interface ArtifactCatalogAppendPort {
  appendArtifactCatalogRecord(
    request: AppendArtifactCatalogRecordRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<{ storageKey: string }>>;
}

export interface ArtifactCatalogReadPort {
  browseArtifactCatalogRecords(
    request: BrowseArtifactCatalogRecordsRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<{ records: ArtifactCatalogRecord[] }>>;

  readArtifactCatalogRecord(
    request: ReadArtifactCatalogRecordRequest,
    context?: ArtifactBrowserBoundaryContext,
  ): Promise<ContractResult<{ record: ArtifactCatalogRecord }>>;
}
