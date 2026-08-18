"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [branding, setBranding] = useState({ name: "SG Forge", logo: "" });

  // Clear any stale or expired session cookie when landing on login page and fetch branding
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => setBranding(data))
      .catch(() => {});

    // Read error query parameter if present
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, []);

  useEffect(() => {
    if (branding.name) {
      document.title = `${branding.name} — Corporate Portal`;
    }
  }, [branding.name]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        const searchParams = new URLSearchParams(window.location.search);
        const redirectBack = searchParams.get("redirect_back") || searchParams.get("next") || "";

        // Use replace so back button doesn't loop back to login
        if (data.user && data.user.isPasswordChanged === false) {
          router.replace(
            "/force-reset" +
              (redirectBack ? `?redirect_back=${encodeURIComponent(redirectBack)}` : ""),
          );
        } else if (redirectBack) {
          // Perform full page load for API routes or external redirects
          if (redirectBack.startsWith("/api/") || redirectBack.includes("://")) {
            // Prevent javascript: open redirect vector
            const isSafeScheme = !redirectBack.toLowerCase().trim().startsWith("javascript:");
            if (isSafeScheme) {
              // nosemgrep: javascript.browser.security.open-redirect.js-open-redirect
              window.location.replace(redirectBack);
            } else {
              router.replace("/");
            }
          } else {
            router.replace(redirectBack);
          }
        } else {
          router.replace("/");
        }
      } else {
        setError(data.error || "Login failed.");
        setIsLoading(false);
      }
    } catch (_err) {
      setError("Connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-portal text-text-primary relative overflow-hidden font-sans">
      {/* Background ambient glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-success/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-surface-card border border-border-accent rounded-2xl shadow-2xl relative z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-gradient-to-tr from-brand-accent to-brand-hover text-white font-black text-2xl tracking-wider mb-4 shadow-lg items-center gap-2">
            {branding.logo ? (
              <div
                className="w-8 h-8 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-white overflow-hidden flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: branding.logo }}
              />
            ) : null}
            <span>{branding.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Corporate Portal</h1>
          <p className="text-text-secondary mt-2 text-sm">
            Sign in to access your administrative tools
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Email Address
            </label>
            <input
              type="text"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input-bg border border-input-border text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all duration-200"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input-bg border border-input-border text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#00ffcc] hover:from-[#3b82f6] hover:to-[#55ffd8] text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Authenticate"
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border-accent"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface-card px-2 text-text-secondary">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <a
            href="/api/auth/oauth/google"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Google
          </a>
          <a
            href="/api/auth/oauth/github"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm transition-all duration-200"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            GitHub
          </a>
          <a
            href="/api/auth/oauth/microsoft"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 23 23">
              <rect x="0" y="0" width="10.5" height="10.5" fill="#f25022" />
              <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7fba00" />
              <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00a4ef" />
              <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#ffb900" />
            </svg>
            Microsoft
          </a>
          <a
            href="/api/auth/oauth/okta"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium text-sm transition-all duration-200"
          >
            <svg className="w-5 h-5 fill-current text-[#007dc1]" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            </svg>
            Okta
          </a>
        </div>

        <div className="mt-8 text-center border-t border-white/5 pt-6 text-xs text-[#64748b]">
          <p className="mt-2 text-[#00ffcc]/70">
            Secure authentication powered by bcrypt & session tokens
          </p>
        </div>
      </div>
    </div>
  );
}
