import { describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers";
import { encryptSecret } from "../src/tools/github.js";

describe("GitHub encrypted secrets", () => {
  it("seals plaintext with the GitHub public key format", async () => {
    await sodium.ready;
    const keyPair = sodium.crypto_box_keypair();
    const publicKey = sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL);
    const encrypted = await encryptSecret("test-secret", publicKey);
    const plaintext = sodium.crypto_box_seal_open(
      sodium.from_base64(encrypted, sodium.base64_variants.ORIGINAL),
      keyPair.publicKey,
      keyPair.privateKey
    );
    expect(sodium.to_string(plaintext)).toBe("test-secret");
  });
});
