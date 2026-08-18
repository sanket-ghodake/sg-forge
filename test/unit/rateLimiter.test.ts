import { describe, expect, test } from "bun:test";
import { isRateLimited } from "@backend/utils/rateLimiter";

describe("Rate Limiter", () => {
  test("Allows requests under the limit", async () => {
    const ip = "1.2.3.4";
    const namespace = "test-under-limit";

    for (let i = 0; i < 5; i++) {
      const res = await isRateLimited(ip, namespace, 5, 10000);
      expect(res.limited).toBe(false);
      expect(res.current).toBe(i + 1);
    }
  });

  test("Blocks requests exceeding the limit", async () => {
    const ip = "5.6.7.8";
    const namespace = "test-exceed-limit";

    // Consume all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const res = await isRateLimited(ip, namespace, 5, 10000);
      expect(res.limited).toBe(false);
    }

    // The 6th request should be blocked
    const blockedRes = await isRateLimited(ip, namespace, 5, 10000);
    expect(blockedRes.limited).toBe(true);
    expect(blockedRes.current).toBe(5);
  });

  test("Is namespace isolated", async () => {
    const ip = "9.10.11.12";

    // Fill up namespace A
    for (let i = 0; i < 5; i++) {
      await isRateLimited(ip, "namespace-a", 5, 10000);
    }
    expect((await isRateLimited(ip, "namespace-a", 5, 10000)).limited).toBe(true);

    // Namespace B should still allow requests for the same IP
    const resB = await isRateLimited(ip, "namespace-b", 5, 10000);
    expect(resB.limited).toBe(false);
    expect(resB.current).toBe(1);
  });
});
