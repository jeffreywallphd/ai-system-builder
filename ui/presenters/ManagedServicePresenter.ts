import type { ManagedServiceRecord } from "../services/ManagedServicesService";
import { toTitleCase } from "./PresenterFormatting";

export class ManagedServicePresenter {
  public presentState(service: ManagedServiceRecord): string {
    if (service.provisioning.required && service.provisioning.state !== "provisioned") {
      return toTitleCase(service.provisioning.state);
    }
    return toTitleCase(service.state);
  }

  public presentOwnership(service: ManagedServiceRecord): string {
    return toTitleCase(service.ownership);
  }

  public presentLastChecked(service: ManagedServiceRecord): string {
    const parsed = Date.parse(service.lastCheckedAt);
    if (Number.isNaN(parsed)) {
      return "Unknown";
    }

    return new Date(parsed).toISOString().replace(".000Z", "Z");
  }

  public presentEndpointSummary(service: ManagedServiceRecord): string {
    return service.endpointSummary ?? service.baseUrl ?? "Not configured";
  }

  public presentErrorDetail(service: ManagedServiceRecord): string {
    return service.lastErrorDetail ?? service.detail ?? "No recent error.";
  }

  public presentAvailability(service: ManagedServiceRecord): string {
    return service.isAvailable ? "Available" : "Not available";
  }
}
