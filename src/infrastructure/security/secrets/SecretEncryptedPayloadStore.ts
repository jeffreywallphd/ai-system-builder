export interface ISecretEncryptedPayloadStore {
  writePayload(input: {
    readonly encryptedPayloadRef: string;
    readonly serializedEnvelope: string;
  }): Promise<void>;

  readPayload(encryptedPayloadRef: string): Promise<string | undefined>;
}
