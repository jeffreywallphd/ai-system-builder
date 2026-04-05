import type {
  TrustedDevicePairingCompletionRequest,
  TrustedDevicePairingCompletionResponse,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ITrustedDevicePairingService } from "../../../../application/identity/ports/ITrustedDevicePairingService";

interface CompleteTrustedDevicePairingUseCaseDependencies {
  readonly pairingService: Pick<ITrustedDevicePairingService, "completePairing">;
}

export class CompleteTrustedDevicePairingUseCase {
  public constructor(private readonly dependencies: CompleteTrustedDevicePairingUseCaseDependencies) {}

  public async execute(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevicePairingCompletionResponse> {
    return this.dependencies.pairingService.completePairing(request);
  }
}
