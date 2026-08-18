import { afterEach, describe, expect, test } from "bun:test";
import { OAUTH_PROVIDERS } from "@backend/auth/oauthProviders";

const originalFetch = globalThis.fetch;

describe("OAuth Providers Profile Mapping", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("Google getProfile parses email and name correctly", async () => {
    globalThis.fetch = (async (url: any, options: any) => {
      expect(url.toString()).toBe("https://www.googleapis.com/oauth2/v3/userinfo");
      expect(options.headers.Authorization).toBe("Bearer google_test_token");
      return {
        ok: true,
        json: async () => ({
          email: "GOOGLE.user@example.com ",
          name: "Google Test User",
        }),
      } as any;
    }) as any;

    const profile = await OAUTH_PROVIDERS.google.getProfile("google_test_token");
    expect(profile.email).toBe("google.user@example.com");
    expect(profile.name).toBe("Google Test User");
  });

  test("GitHub getProfile handles public email and private email list fallback", async () => {
    let callCount = 0;
    globalThis.fetch = (async (url: any, options: any) => {
      callCount++;
      const urlStr = url.toString();
      expect(options.headers.Authorization).toBe("Bearer github_test_token");

      if (urlStr === "https://api.github.com/user") {
        return {
          ok: true,
          json: async () => ({
            login: "github_handle",
            name: "GitHub Test User",
            email: null,
          }),
        } as any;
      } else if (urlStr === "https://api.github.com/user/emails") {
        return {
          ok: true,
          json: async () => [
            { email: "backup@example.com", primary: false, verified: true },
            { email: "GITHUB.user@example.com", primary: true, verified: true },
          ],
        } as any;
      }
      throw new Error(`Unexpected url: ${urlStr}`);
    }) as any;

    const profile = await OAUTH_PROVIDERS.github.getProfile("github_test_token");
    expect(profile.email).toBe("github.user@example.com");
    expect(profile.name).toBe("GitHub Test User");
    expect(callCount).toBe(2);
  });

  test("Microsoft getProfile parses mail / userPrincipalName and displayName", async () => {
    globalThis.fetch = (async (url: any, options: any) => {
      expect(url.toString()).toBe("https://graph.microsoft.com/v1.0/me");
      expect(options.headers.Authorization).toBe("Bearer ms_test_token");
      return {
        ok: true,
        json: async () => ({
          mail: "ms.user@example.com",
          userPrincipalName: "ms.user.upn@example.com",
          displayName: "Microsoft Test User",
        }),
      } as any;
    }) as any;

    const profile = await OAUTH_PROVIDERS.microsoft.getProfile("ms_test_token");
    expect(profile.email).toBe("ms.user@example.com");
    expect(profile.name).toBe("Microsoft Test User");
  });

  test("Okta getProfile parses email and name", async () => {
    process.env.OKTA_DOMAIN = "test-tenant.okta.com";
    globalThis.fetch = (async (url: any, options: any) => {
      expect(url.toString()).toBe("https://test-tenant.okta.com/oauth2/default/v1/userinfo");
      expect(options.headers.Authorization).toBe("Bearer okta_test_token");
      return {
        ok: true,
        json: async () => ({
          email: "okta.user@example.com",
          name: "Okta Test User",
        }),
      } as any;
    }) as any;

    const profile = await OAUTH_PROVIDERS.okta.getProfile("okta_test_token");
    expect(profile.email).toBe("okta.user@example.com");
    expect(profile.name).toBe("Okta Test User");
  });
});
