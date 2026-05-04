import { useState } from "react";

export function LanPairingForm(props: { onSubmit: (pairingCode: string, deviceName?: string) => Promise<boolean>; busy?: boolean }) {
  const [pairingCode, setPairingCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  return <form onSubmit={(event) => { event.preventDefault(); void props.onSubmit(pairingCode, deviceName || undefined); }}>
    <label>Pairing code<input value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} /></label>
    <label>Device name (optional)<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></label>
    <button type="submit" disabled={props.busy || pairingCode.trim().length < 1}>{props.busy ? "Pairing..." : "Pair this device"}</button>
  </form>;
}
