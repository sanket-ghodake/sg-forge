export interface OAuthProfile {
  email: string;
  name: string;
}

export interface OAuthProviderConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  getProfile: (accessToken: string) => Promise<OAuthProfile>;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    async getProfile(accessToken: string): Promise<OAuthProfile> {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Google profile fetch failed: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.email) {
        throw new Error("Google did not return an email address");
      }
      return {
        email: data.email.toLowerCase().trim(),
        name: data.name || data.given_name || "Google User",
      };
    },
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "user:email"],
    async getProfile(accessToken: string): Promise<OAuthProfile> {
      // 1. Fetch basic profile info
      const profileRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "SG-Forge-OAuth-Client",
        },
      });
      if (!profileRes.ok) {
        throw new Error(`GitHub profile fetch failed: ${profileRes.statusText}`);
      }
      const profileData = await profileRes.json();

      // 2. Fetch email addresses (especially if profile email is private/null)
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "SG-Forge-OAuth-Client",
        },
      });

      let email = profileData.email;
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        if (Array.isArray(emails)) {
          const primaryEmail =
            emails.find((e: any) => e.primary && e.verified) ||
            emails.find((e: any) => e.primary) ||
            emails[0];
          if (primaryEmail) {
            email = primaryEmail.email;
          }
        }
      }

      if (!email) {
        throw new Error("GitHub did not return a verified email address");
      }

      return {
        email: email.toLowerCase().trim(),
        name: profileData.name || profileData.login || "GitHub User",
      };
    },
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "profile", "User.Read"],
    async getProfile(accessToken: string): Promise<OAuthProfile> {
      const res = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Microsoft Graph API fetch failed: ${res.statusText}`);
      }
      const data = await res.json();
      const email = data.mail || data.userPrincipalName;
      if (!email) {
        throw new Error("Microsoft did not return an email address");
      }
      return {
        email: email.toLowerCase().trim(),
        name: data.displayName || data.givenName || "Microsoft User",
      };
    },
  },
  okta: {
    clientId: process.env.OKTA_CLIENT_ID,
    clientSecret: process.env.OKTA_CLIENT_SECRET,
    authUrl: `https://${process.env.OKTA_DOMAIN || "dummy"}/oauth2/default/v1/authorize`,
    tokenUrl: `https://${process.env.OKTA_DOMAIN || "dummy"}/oauth2/default/v1/token`,
    scopes: ["openid", "email", "profile"],
    async getProfile(accessToken: string): Promise<OAuthProfile> {
      const res = await fetch(
        `https://${process.env.OKTA_DOMAIN || "dummy"}/oauth2/default/v1/userinfo`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!res.ok) {
        throw new Error(`Okta userinfo fetch failed: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.email) {
        throw new Error("Okta did not return an email address");
      }
      return {
        email: data.email.toLowerCase().trim(),
        name: data.name || data.given_name || "Okta User",
      };
    },
  },
};
