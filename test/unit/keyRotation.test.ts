import { describe, expect, test } from "bun:test";
import { getAllJwks, getKeys, getPublicKeyByKid, rotateKeys } from "@backend/auth/keyManager";

describe("JWT Key Rotation & JWKS", () => {
  test("getKeys returns active key details", () => {
    const keys = getKeys();
    expect(keys).toBeDefined();
    expect(keys.publicKey).toBeDefined();
    expect(keys.privateKey).toBeDefined();
    expect(keys.jwk.kid).toBeDefined();
    expect(keys.jwk.alg).toBe("RS256");
  });

  test("rotateKeys updates active key and archives the old key", () => {
    const initialKeys = getKeys();
    const initialKid = initialKeys.jwk.kid;

    const newKid = rotateKeys();
    expect(newKid).toBeDefined();
    expect(newKid).not.toBe(initialKid);

    const activeKeys = getKeys();
    expect(activeKeys.jwk.kid).toBe(newKid);

    // Verify historical keys lookup works
    const oldPublicKey = getPublicKeyByKid(initialKid);
    expect(oldPublicKey).toBe(initialKeys.publicKey);

    // Verify all JWKs includes both
    const allJwks = getAllJwks();
    expect(allJwks.length).toBeGreaterThanOrEqual(2);
    expect(allJwks[0].kid).toBe(newKid);
    expect(allJwks[1].kid).toBe(initialKid);
  });

  test("getPublicKeyByKid falls back to active key if kid is not found", () => {
    const activeKeys = getKeys();
    const resolvedKey = getPublicKeyByKid("non-existent-kid");
    expect(resolvedKey).toBe(activeKeys.publicKey);
  });
});
