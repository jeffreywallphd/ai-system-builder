import { describe, expect, it } from "bun:test";
import { ScryptLocalPasswordCredentialService } from "../ScryptLocalPasswordCredentialService";

describe("ScryptLocalPasswordCredentialService", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const service = new ScryptLocalPasswordCredentialService({
      costFactor: 4096,
      pepperVersion: "pepper:v1",
    });

    const material = await service.hashPassword("Str0ng!Passphrase");

    expect(material.hashAlgorithm).toBe("scrypt");
    expect(material.hashValue).toContain("$scrypt$");
    expect(material.hashValue).not.toContain("Str0ng!Passphrase");
    expect(material.salt).toBeTruthy();
    expect(material.pepperVersion).toBe("pepper:v1");

    await expect(service.verifyPassword("Str0ng!Passphrase", material)).resolves.toBe(true);
  });

  it("rejects invalid password candidates", async () => {
    const service = new ScryptLocalPasswordCredentialService({
      costFactor: 4096,
    });
    const material = await service.hashPassword("Str0ng!Passphrase");

    await expect(service.verifyPassword("wrong-password", material)).resolves.toBe(false);
  });
});
