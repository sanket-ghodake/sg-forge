"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppContainerPage() {
  const params = useParams();
  const appId = params?.appId as string;
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [theme, setTheme] = useState("default");
  const [appConfig, setAppConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [iframeOffline, setIframeOffline] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);

  const [branding, setBranding] = useState({ name: "SG Forge", logo: "" });

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => setBranding(data))
      .catch(() => {});
  }, []);

  // Load initial theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "default";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);

    const iframe = document.querySelector("iframe");
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "THEME_CHANGE", theme: newTheme },
        window.location.origin,
      );
    }
  };

  // Load session and app config
  useEffect(() => {
    const initPage = async () => {
      setLoading(true);

      // Load session
      let currentUser = null;
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        currentUser = data.session;
        if (!currentUser) {
          throw new Error("No session");
        }
        setSession(currentUser);
      } catch (_err) {
        router.push("/login");
        return;
      }

      // Load app configs
      try {
        const res = await fetch("/api/apps");
        const data = await res.json();
        const config = data.apps?.find(
          (a: any) => a.id === appId || a.slug === appId || a.dbId === appId,
        );

        if (!config) {
          setError(`Application "${appId}" not found in local registries.`);
        } else {
          // Check role permissions
          if (config.roles && !config.roles.includes(currentUser.role)) {
            setError(
              `Privilege Violation: Role "${currentUser.role}" does not have access permissions for this app.`,
            );
          } else {
            setAppConfig(config);
            // If it's an iframe routing mode, verify network connectivity
            if (
              config.routingMode === "iframe" ||
              (config.routingMode !== "standalone" && config.entryPoint?.startsWith("http"))
            ) {
              setIframeLoading(true);
              try {
                // Generate secure handshake authorization code
                const handshakeRes = await fetch("/api/apps/handshake", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slug: config.slug }),
                });
                if (handshakeRes.ok) {
                  const handshakeData = await handshakeRes.json();
                  setAuthCode(handshakeData.code);
                }

                const checkRes = await fetch(`/forge-apps/${config.slug}`, { method: "GET" });
                if (!checkRes.ok || checkRes.status === 504) {
                  setIframeOffline(true);
                }
              } catch (_err) {
                setIframeOffline(true);
              } finally {
                setIframeLoading(false);
              }
            }
          }
        }
      } catch (_err) {
        setError("Failed to load application configurations.");
      } finally {
        setLoading(false);
      }
    };

    if (appId) {
      initPage();
    }
  }, [appId, router]);

  // Automatically redirect if it's a standalone application
  useEffect(() => {
    if (!loading && !error && appConfig && appConfig.routingMode === "standalone") {
      const redirectUri =
        appConfig.redirectUri ||
        (appConfig.sandboxEntryPoint
          ? `${appConfig.sandboxEntryPoint.replace(/\/$/, "")}/callback`
          : "") ||
        (appConfig.entryPoint ? `${appConfig.entryPoint.replace(/\/$/, "")}/callback` : "") ||
        (appConfig.entryUrl ? `${appConfig.entryUrl.replace(/\/$/, "")}/callback` : "");
      const targetUrl = `/api/v1/auth/authorize?client_id=${appConfig.clientId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&state=sso_state_launch&response_type=code`;
      window.location.href = targetUrl;
    }
  }, [loading, error, appConfig]);

  // Client-side query runner wrapper
  const runQuery = async (queryStr: string) => {
    // Intercept read-only directory queries for standard user sessions
    if (session?.role === "user") {
      const normalizedQuery = queryStr.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalizedQuery.includes("select * from users")) {
        const res = await fetch("/api/directory");
        if (!res.ok) {
          throw new Error("Database query failed.");
        }
        const data = await res.json();
        return { rows: data.users || [] };
      }
      if (normalizedQuery.includes("select * from structural_metadata")) {
        const res = await fetch("/api/directory");
        if (!res.ok) {
          throw new Error("Database query failed.");
        }
        const data = await res.json();
        return { rows: data.metadata || [] };
      }
      if (normalizedQuery.includes("manager_id")) {
        const res = await fetch("/api/directory");
        if (!res.ok) {
          throw new Error("Database query failed.");
        }
        const data = await res.json();
        const users = data.users || [];
        const metadata = data.metadata || [];

        // Extract manager UUID from query string
        const managerIdMatch = queryStr.match(/manager_id\s*=\s*['"]([^'"]+)['"]/i);
        const managerId = managerIdMatch ? managerIdMatch[1] : session?.id;

        // Filter users by manager_id
        const directReports = users.filter((u: any) => u.manager_id === managerId);

        // Perform LEFT JOIN dm and vm
        const rows = directReports.map((u: any) => {
          const designationMeta = metadata.find((m: any) => m.id === u.designation_id);
          const verticalMeta = metadata.find((m: any) => m.id === u.vertical_id);
          return {
            eid: u.eid,
            name: u.name,
            email: u.email,
            designation: designationMeta ? designationMeta.name : null,
            vertical: verticalMeta ? verticalMeta.name : null,
          };
        });

        // Apply ordering: ORDER BY u.name ASC
        if (normalizedQuery.includes("order by")) {
          rows.sort((a: any, b: any) => {
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            return nameA.localeCompare(nameB);
          });
        }

        return { rows, rowCount: rows.length };
      }

      throw new Error(
        "Forbidden: Access denied. Only administrative roles can execute raw SQL queries.",
      );
    }

    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryStr }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Database query failed.");
    }
    return data;
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  const handleIframeLoad = (e: any) => {
    const iframe = e.target;
    if (iframe && session) {
      const tokenPayload = {
        type: "FORGE_AUTH_TOKEN",
        token:
          authCode ||
          btoa(
            JSON.stringify({
              userId: session.id,
              role: session.role,
              timestamp: Date.now(),
            }),
          ),
        code: authCode || null,
        user: {
          id: session.id,
          name: session.name,
          email: session.email,
          role: session.role,
        },
      };
      iframe.contentWindow?.postMessage(tokenPayload, window.location.origin);
      iframe.contentWindow?.postMessage({ type: "THEME_CHANGE", theme }, window.location.origin);
    }
  };

  const isStandalone = appConfig?.routingMode === "standalone";
  const isIframe =
    !isStandalone &&
    (appConfig?.routingMode === "iframe" || appConfig?.entryPoint?.startsWith("http"));

  // Dynamically import the app entrypoint only if it's a local react component.
  const DynamicApp =
    appConfig && !isIframe
      ? dynamic<any>(
          () => {
            switch (appConfig.directoryName) {
              case "billing":
                return import("@apps/billing");
              case "employees":
                return import("@apps/employees");
              case "manager-operations":
                return import("@apps/manager-operations");
              default:
                return Promise.resolve(() => (
                  <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono">
                    Error: React Component registry matching directory &quot;
                    {appConfig.directoryName}&quot; was not found.
                  </div>
                ));
            }
          },
          {
            loading: () => (
              <div className="flex justify-center items-center py-24">
                <span className="w-8 h-8 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin"></span>
              </div>
            ),
            ssr: false, // Keep client-side only for standalone sandbox predictability
          },
        )
      : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-portal text-text-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-portal text-text-primary transition-colors duration-200 font-sans pb-12">
      {/* Top Navbar */}
      <header className="border-b border-border-accent bg-header-bg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <div
                className="h-8 w-8 rounded-lg bg-surface-card p-1 border border-border-accent overflow-hidden flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-brand-accent"
                dangerouslySetInnerHTML={{ __html: branding.logo }}
              />
            ) : (
              <Link
                href="/"
                className="p-2 rounded-lg bg-gradient-to-tr from-[#ff007f] to-brand-accent text-white font-extrabold text-sm tracking-wider hover:opacity-90"
              >
                {branding.name.substring(0, 2).toUpperCase()}
              </Link>
            )}
            <span className="font-bold text-sm tracking-tight text-text-tertiary">/</span>
            <span className="font-bold text-sm tracking-tight text-text-primary">
              {appConfig?.name || "Application"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Back to main portal button */}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-text-primary text-xs font-semibold border border-border-accent transition-colors flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Portal Home
            </Link>

            {appConfig?.entryUrl && (
              <a
                href={appConfig.entryUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-text-primary text-xs font-semibold border border-border-accent transition-colors flex items-center gap-1.5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open Directly
              </a>
            )}

            {/* Theme Selector Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-accent text-xs font-bold text-text-primary hover:bg-surface-elevated transition-all flex items-center gap-2 cursor-pointer shadow-sm">
                  <span>
                    {theme === "light"
                      ? "☀️"
                      : theme === "solarized-dark"
                        ? "🕶️"
                        : theme === "solarized-light"
                          ? "📄"
                          : theme === "dark"
                            ? "🌙"
                            : "✨"}
                  </span>
                  <span className="capitalize text-text-secondary">
                    {theme === "default" ? "Default" : theme.replace("-", " ")}
                  </span>
                  <span className="text-[10px] text-text-tertiary">▼</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="bg-surface-elevated border border-border-accent p-2.5 rounded-2xl shadow-2xl min-w-[170px] space-y-1 z-50 animate-fadeIn"
                  sideOffset={5}
                  align="end"
                >
                  <DropdownMenu.Label className="px-2.5 py-1.5 text-[9px] font-black uppercase text-text-tertiary tracking-wider">
                    Select Layout Theme
                  </DropdownMenu.Label>
                  {[
                    { id: "default", label: "Default Theme", icon: "✨" },
                    { id: "light", label: "Light Mode", icon: "☀️" },
                    { id: "dark", label: "Obsidian Dark", icon: "🌙" },
                    { id: "solarized-dark", label: "Solarized Dark", icon: "🕶️" },
                    { id: "solarized-light", label: "Solarized Light", icon: "📄" },
                  ].map((item) => (
                    <DropdownMenu.Item
                      key={item.id}
                      onClick={() => changeTheme(item.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer outline-none transition-colors ${
                        theme === item.id
                          ? "bg-brand-accent text-white"
                          : "text-text-primary hover:bg-surface-card"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {theme === item.id && <span className="text-[10px]">✓</span>}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3 pl-4 border-l border-border-accent">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-text-primary">{session?.name}</p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  {session?.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-surface-elevated rounded-lg text-red-400 hover:text-red-300 transition-colors"
                title="Log Out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error ? (
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-4 max-w-xl mx-auto">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-full w-fit mx-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-lg text-red-400">Access Restricted</h3>
            <p className="text-sm text-text-secondary">{error}</p>
            <div className="pt-4">
              <Link
                href="/"
                className="px-6 py-2 bg-surface-elevated border border-border-accent hover:bg-surface-card rounded-lg text-xs font-bold text-text-primary transition-all inline-block"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-accent shadow-md">
            {isStandalone ? (
              <div className="p-8 text-center space-y-6 max-w-xl mx-auto my-12 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <div className="p-4 bg-brand-accent/20 text-brand-accent rounded-full w-fit mx-auto shadow-lg shadow-brand-accent/15">
                  <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-extrabold text-xl text-text-primary">
                    Redirecting to Standalone Application
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Launching &quot;{appConfig.name}&quot; in the current window. Please wait...
                  </p>
                </div>
                <div className="text-[10px] text-text-tertiary font-mono">
                  If you are not redirected automatically,{" "}
                  <a
                    href={`/api/v1/auth/authorize?client_id=${appConfig.clientId}&redirect_uri=${encodeURIComponent(
                      appConfig.redirectUri ||
                        (appConfig.sandboxEntryPoint
                          ? `${appConfig.sandboxEntryPoint.replace(/\/$/, "")}/callback`
                          : "") ||
                        (appConfig.entryPoint
                          ? `${appConfig.entryPoint.replace(/\/$/, "")}/callback`
                          : "") ||
                        (appConfig.entryUrl
                          ? `${appConfig.entryUrl.replace(/\/$/, "")}/callback`
                          : ""),
                    )}&state=sso_state_launch&response_type=code`}
                    className="text-brand-accent hover:underline font-bold"
                  >
                    click here
                  </a>
                  .
                </div>
              </div>
            ) : isIframe ? (
              iframeOffline ? (
                <div className="p-8 rounded-2xl bg-warning/10 border border-warning/20 text-center space-y-4 max-w-xl mx-auto my-12">
                  <div className="p-3 bg-warning/20 text-warning-text rounded-full w-fit mx-auto">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg text-warning-text">Extension Network Offline</h3>
                  <p className="text-sm text-text-secondary">
                    ⚠️ Extension Network Offline: Verify Local Intranet Connection Configuration
                    Address
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => router.refresh()}
                      className="px-6 py-2 bg-brand-accent text-white hover:bg-brand-hover rounded-lg text-xs font-bold transition-all"
                    >
                      Retry Connection
                    </button>
                  </div>
                </div>
              ) : iframeLoading ? (
                <div className="space-y-4 animate-pulse py-12">
                  <div className="h-8 bg-surface-elevated rounded-lg w-1/4"></div>
                  <div className="h-64 bg-surface-elevated rounded-2xl w-full"></div>
                  <div className="h-12 bg-surface-elevated rounded-lg w-1/2"></div>
                </div>
              ) : (
                <div className="relative w-full h-[600px] border border-border-accent rounded-xl overflow-hidden bg-black/5">
                  <iframe
                    src={`/forge-apps/${appConfig.slug}`}
                    className="w-full h-full border-none"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    onLoad={handleIframeLoad}
                  />
                </div>
              )
            ) : (
              DynamicApp && <DynamicApp user={session} runQuery={runQuery} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
