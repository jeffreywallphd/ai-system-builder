export interface InstallModelRequest {
  /**
   * Either provide a concrete known model ID or a remote catalog ID.
   */
  readonly modelId?: string;
  readonly remoteId?: string;
  readonly provider?: string;

  /**
   * Required install destination resolved by the application/infrastructure.
   */
  readonly destination: string;

  readonly overwrite?: boolean;
  readonly verifyIntegrity?: boolean;
  readonly authToken?: string;

  /**
   * Whether the installed model should be persisted in the installed-model catalog.
   */
  readonly registerInstalled?: boolean;
}
