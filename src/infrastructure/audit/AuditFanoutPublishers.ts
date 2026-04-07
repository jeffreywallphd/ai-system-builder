import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import type { IdentityLifecycleEvent } from "@application/contracts/IdentityLifecycleEventContracts";
import type { NodeTrustAuditEvent, NodeTrustAuditSink } from "@application/nodes/ports/NodeTrustAuditPorts";

interface Disposable {
  dispose(): void;
}

export class FanoutIdentityLifecycleEventPublisher implements IIdentityLifecycleEventPublisher, Disposable {
  public constructor(private readonly publishers: ReadonlyArray<IIdentityLifecycleEventPublisher>) {}

  public async publish(event: IdentityLifecycleEvent): Promise<void> {
    for (const publisher of this.publishers) {
      try {
        await publisher.publish(event);
      } catch {
        // Best-effort fan-out keeps lifecycle flows non-blocking.
      }
    }
  }

  public dispose(): void {
    for (const publisher of this.publishers) {
      const disposablePublisher = publisher as Partial<Disposable>;
      if (typeof disposablePublisher.dispose === "function") {
        disposablePublisher.dispose();
      }
    }
  }
}

export class FanoutNodeTrustAuditSink implements NodeTrustAuditSink {
  public constructor(private readonly sinks: ReadonlyArray<NodeTrustAuditSink>) {}

  public async recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void> {
    for (const sink of this.sinks) {
      try {
        await sink.recordNodeTrustAuditEvent(event);
      } catch {
        // Best-effort fan-out keeps node trust mutation flows non-blocking.
      }
    }
  }
}
