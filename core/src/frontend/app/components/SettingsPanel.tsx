"use client";
import React, { useMemo, useRef, useState } from "react";

interface SettingsPanelProps {
  session: any;
  users: any[];
  metadata: any[];
  theme: string;
  setTheme: (t: string) => void;
  density: "comfortable" | "compact";
  setDensity: (d: "comfortable" | "compact") => void;
  simulatedRole: string;
  loadWorkspaceData?: () => Promise<void>;
  font: string;
  setFont: (f: string) => void;
}

export default function SettingsPanel({
  session,
  users,
  metadata,
  theme,
  setTheme,
  density,
  setDensity,
  simulatedRole,
  loadWorkspaceData,
  font,
  setFont,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<
    "appearance" | "security" | "profile" | "sessions" | "platform" | "sandbox"
  >("appearance");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Platform branding state (admin)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const companyMeta = useMemo(() => metadata.find((m) => m.type === "company_name"), [metadata]);
  const [platformTitle, setPlatformTitle] = useState(companyMeta?.name || "SG Forge");
  const [platformLogo, setPlatformLogo] = useState<string>(
    companyMeta?.extendedAttributes?.logo || "",
  );
  const hasTitleChanged = platformTitle !== (companyMeta?.name || "SG Forge");

  // Sync state with metadata updates
  React.useEffect(() => {
    if (companyMeta) {
      setPlatformTitle(companyMeta.name);
      setPlatformLogo(companyMeta.extendedAttributes?.logo || "");
    }
  }, [companyMeta]);

  // Branding Logs State
  const [brandingLogs, setBrandingLogs] = useState<{ summary: any[]; details: any[] } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchBrandingLogs = async () => {
    if (simulatedRole !== "super_admin") return;
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/branding-logs");
      if (res.ok) {
        const data = await res.json();
        setBrandingLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch branding logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const saveBranding = async (title: string, logo: string) => {
    try {
      const res = await fetch("/api/admin/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: companyMeta?.id || "a0000000-0000-0000-0000-000000000001",
          name: title,
          type: "company_name",
          extendedAttributes: {
            ...companyMeta?.extendedAttributes,
            logo,
          },
        }),
      });
      if (res.ok) {
        showToast("Branding updated successfully.", "success");
        if (loadWorkspaceData) {
          await loadWorkspaceData();
        }
        fetchBrandingLogs();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save branding.", "error");
      }
    } catch {
      showToast("Network error while saving branding.", "error");
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
      showToast("Please upload an SVG file", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text.includes("<svg")) {
        showToast("Invalid SVG content", "error");
        return;
      }
      setPlatformLogo(text);
      await saveBranding(platformTitle, text);
    };
    reader.readAsText(file);
  };

  // Module flags (admin)
  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({
    "Living Architecture Health Map": true,
    "Internal Performance Evaluator": false,
    "Compliance Monitoring Suite": false,
  });

  const isAdmin = simulatedRole === "super_admin" || simulatedRole === "admin";
  const isSuperAdmin = simulatedRole === "super_admin";

  // Load branding logs on mount/tab change
  React.useEffect(() => {
    if (tab === "platform" && isSuperAdmin) {
      fetchBrandingLogs();
    }
  }, [tab, isSuperAdmin]);

  const currentUser = useMemo(
    () => users.find((u) => u.email?.toLowerCase() === session?.email?.toLowerCase()),
    [users, session],
  );

  // Password strength
  const pwStrength = useMemo(() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  }, [newPw]);

  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong"][pwStrength];
  const pwStrengthColor = ["", "bg-danger", "bg-warning", "bg-info", "bg-success"][pwStrength];
  const canSavePw = currentPw && newPw.length >= 8 && newPw === confirmPw && pwStrength >= 2;

  const handlePasswordSave = async () => {
    if (!canSavePw) return;
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser?.id,
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      if (res.ok) {
        showToast("Password updated successfully.", "success");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        const err = await res.json();
        showToast(err.error || "Password update failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setPwLoading(false);
    }
  };

  // Removed handleTitleChange due to manual save to prevent glitchy debounce

  const fakeSessions = [
    {
      device: "Chrome v124 (Linux)",
      ip: "192.168.1.42",
      location: "Current Session",
      current: true,
    },
    { device: "Edge v122 (Windows)", ip: "103.44.12.91", location: "Pune, India", current: false },
  ];

  const userTabs = [
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "sessions", label: "Sessions", icon: "🖥️" },
  ];

  const adminTabs = isAdmin
    ? [
        ...(isSuperAdmin ? [{ id: "platform", label: "Platform Branding", icon: "🏢" }] : []),
        { id: "sandbox", label: "Sandbox Tools", icon: "🧪" },
      ]
    : [];

  return (
    <div className="flex-1 flex min-h-0 bg-background-portal text-text-primary relative overflow-hidden h-full">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 animate-fadeIn ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : toast.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current animate-ping"></span>
          <p className="text-xs font-bold font-mono">{toast.message}</p>
        </div>
      )}

      {/* Left Category Nav */}
      <aside className="w-60 border-r border-border-accent bg-sidebar-bg flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="p-5 border-b border-border-accent">
          <h2 className="text-sm font-black tracking-tight text-text-primary">Settings</h2>
          <p className="text-[10px] text-text-secondary mt-0.5">Manage preferences & security</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <span className="text-[9px] text-text-tertiary font-black uppercase tracking-widest px-3 pb-1 block">
            User Preferences
          </span>
          {userTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                tab === t.id
                  ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary"
              }`}
            >
              <span className="text-sm">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}

          {adminTabs.length > 0 && (
            <>
              <div className="pt-4 pb-1">
                <span className="text-[9px] text-text-tertiary font-black uppercase tracking-widest px-3 block">
                  System Configuration
                </span>
              </div>
              {adminTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                    tab === t.id
                      ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary"
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Right Content Canvas */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8 animate-fadeIn">
        {/* ── APPEARANCE ── */}
        {tab === "appearance" && (
          <div className="space-y-8 max-w-4xl">
            <div>
              <h1 className="text-lg font-black text-text-primary">Theme Selection</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Choose from 5 curated visual themes for your interface
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {[
                {
                  id: "default",
                  label: "Default Theme",
                  desc: "Corporate Slate Dark",
                  preview: "bg-gradient-to-br from-[#0f172a] to-[#1e293b]",
                  dot: "#6366f1",
                },
                {
                  id: "light",
                  label: "Light Mode",
                  desc: "Clean High-Contrast Light",
                  preview: "bg-gradient-to-br from-slate-50 to-slate-200 border border-slate-300",
                  dot: "#4f46e5",
                },
                {
                  id: "dark",
                  label: "Obsidian Dark",
                  desc: "Deep Obsidian Canvas",
                  preview: "bg-gradient-to-br from-[#09090b] to-[#18181b]",
                  dot: "#818cf8",
                },
                {
                  id: "solarized-dark",
                  label: "Solarized Dark",
                  desc: "Warm Precision Teal",
                  preview: "bg-[#002b36]",
                  dot: "#268bd2",
                },
                {
                  id: "solarized-light",
                  label: "Solarized Light",
                  desc: "Crisp Warm Paper",
                  preview: "bg-[#fdf6e3] border border-[#decda3]",
                  dot: "#268bd2",
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`group relative p-4 rounded-2xl border-2 transition-all text-left ${
                    theme === t.id
                      ? "border-brand-accent shadow-lg shadow-brand-accent/10 scale-[1.02]"
                      : "border-border-accent hover:border-brand-accent/40"
                  }`}
                >
                  <div
                    className={`w-full h-14 rounded-xl mb-3 relative overflow-hidden ${t.preview}`}
                  >
                    {/* Accent dot swatch */}
                    <div
                      className="absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-white/30 shadow-sm"
                      style={{ background: t.dot }}
                    />
                  </div>
                  <p className="text-xs font-black text-text-primary">{t.label}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">{t.desc}</p>
                  {theme === t.id && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand-accent flex items-center justify-center">
                      <span className="text-white text-[10px] font-black">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Density */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-text-primary">Layout Density</h2>
              <div className="flex gap-3">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`px-5 py-3 rounded-xl border-2 text-xs font-bold capitalize transition-all ${
                      density === d
                        ? "border-brand-accent bg-brand-accent/5 text-brand-accent"
                        : "border-border-accent text-text-secondary hover:border-brand-accent/40"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-text-primary">UI Typography</h2>
              <div className="flex gap-3">
                {[
                  { id: "default", label: "Default Proportional", desc: "Refined Inter Sans" },
                  { id: "monospace", label: "Developer Monospace", desc: "Droid Sans Mono" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFont(f.id)}
                    className={`px-5 py-3.5 rounded-xl border-2 text-xs font-bold text-left transition-all flex flex-col gap-1 min-w-[200px] ${
                      font === f.id
                        ? "border-brand-accent bg-brand-accent/5 text-brand-accent"
                        : "border-border-accent text-text-secondary hover:border-brand-accent/40"
                    }`}
                  >
                    <span className="font-black">{f.label}</span>
                    <span className="text-[10px] text-text-tertiary">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-text-primary">Regional Preferences</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary font-bold">Timezone:</span>
                <select className="px-3 py-2 bg-input-bg border border-input-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-brand-accent">
                  <option>UTC+05:30 - Asia/Kolkata</option>
                  <option>UTC+00:00 - Europe/London</option>
                  <option>UTC-05:00 - America/New_York</option>
                  <option>UTC-08:00 - America/Los_Angeles</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab === "security" && (
          <div className="space-y-8 max-w-xl">
            <div>
              <h1 className="text-lg font-black text-text-primary">
                Password & Credential Security
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">Update your login credentials</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary block mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary block mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                  placeholder="Enter new password (min 8 chars)"
                />
                {newPw && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-background-portal rounded-full overflow-hidden flex gap-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all ${i <= pwStrength ? pwStrengthColor : "bg-border-accent"}`}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-[10px] font-bold ${pwStrength >= 3 ? "text-success" : pwStrength >= 2 ? "text-warning" : "text-danger"}`}
                    >
                      {pwStrengthLabel}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary block mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-accent"
                  placeholder="Re-enter new password"
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-[10px] text-danger mt-1 font-bold">Passwords do not match</p>
                )}
              </div>
              <button
                onClick={handlePasswordSave}
                disabled={!canSavePw || pwLoading}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                  canSavePw
                    ? "bg-brand-accent text-white hover:bg-brand-hover shadow-lg shadow-brand-accent/20"
                    : "bg-border-accent text-text-tertiary cursor-not-allowed"
                }`}
              >
                {pwLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Passkey section */}
            <div className="p-5 rounded-2xl border border-border-accent bg-surface-card space-y-3">
              <h3 className="text-xs font-black text-text-primary flex items-center gap-2">
                <span>🔑</span> Passkey Enrollment (WebAuthn)
              </h3>
              <p className="text-[10px] text-text-secondary">
                Register biometric login tokens (FaceID, Windows Hello, Fingerprint) for
                passwordless authentication.
              </p>
              <button className="px-4 py-2 rounded-xl border border-brand-accent/30 text-brand-accent text-[10px] font-black hover:bg-brand-accent/5 transition-all">
                Register Passkey
              </button>
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h1 className="text-lg font-black text-text-primary">Corporate Identity</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Your organization profile information
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-card border border-border-accent space-y-5">
              <div className="flex items-center gap-4 pb-4 border-b border-border-accent">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-accent to-success flex items-center justify-center text-white text-xl font-black shadow-lg">
                  {session?.name?.charAt(0) || "A"}
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">
                    {session?.name || "Unknown"}
                  </h3>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-brand-accent/15 text-brand-accent border border-brand-accent/20 mt-1">
                    {session?.role}
                  </span>
                </div>
              </div>

              {[
                { label: "Employee ID", value: currentUser?.eid || "N/A" },
                { label: "Full Name", value: currentUser?.name || session?.name },
                { label: "Primary Email", value: currentUser?.email || session?.email },
                { label: "Designation", value: currentUser?.designation || "Not assigned" },
                { label: "Business Vertical", value: currentUser?.vertical || "Not assigned" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    {f.label}
                  </span>
                  <span className="text-xs font-bold text-text-primary">{f.value}</span>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-3 border-t border-border-accent">
                <span className="text-[10px]">🔒</span>
                <span className="text-[10px] text-text-tertiary font-bold italic">
                  Managed by Corporate HR Metadata Configuration
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab === "sessions" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="text-lg font-black text-text-primary">Active Session Monitor</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                All active browser connections linked to your account
              </p>
            </div>

            <div className="rounded-2xl border border-border-accent overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-table-header">
                  <tr>
                    {["Device / Browser", "IP Address", "Location / Status", "Action"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-[9px] font-black uppercase tracking-wider text-text-secondary"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-accent">
                  {fakeSessions.map((s, i) => (
                    <tr key={i} className="hover:bg-table-row-hover transition-colors">
                      <td className="px-5 py-3.5 text-xs font-bold text-text-primary">
                        {s.device}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-text-secondary">{s.ip}</td>
                      <td className="px-5 py-3.5">
                        {s.current ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-success/10 text-success border border-success/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />{" "}
                            Current Session
                          </span>
                        ) : (
                          <span className="text-xs text-text-secondary">{s.location}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {s.current ? (
                          <span className="text-[10px] text-text-tertiary font-bold">
                            Active Token
                          </span>
                        ) : (
                          <button className="px-3 py-1.5 rounded-lg border border-danger/30 text-danger text-[10px] font-black hover:bg-danger/5 transition-all">
                            Revoke Access
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PLATFORM BRANDING (Admin) ── */}
        {tab === "platform" && isSuperAdmin && (
          <div className="space-y-8 max-w-5xl">
            <div className="flex items-center justify-between border-b border-border-accent/40 pb-5">
              <div>
                <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
                  <span>🏢</span> Platform Customization & Branding
                </h1>
                <p className="text-xs text-text-secondary mt-1">
                  Configure global white-label identity variables across the enterprise workspace
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-brand-accent/10 text-brand-accent px-3 py-1 rounded-full border border-brand-accent/25">
                Super Admin Privilege
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Controls Column */}
              <div className="lg:col-span-7 space-y-6">
                {/* Enterprise Title Card */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏷️</span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">
                        Enterprise Title
                      </h3>
                      <p className="text-[10px] text-text-secondary">
                        Used in webpage header, tabs, and login dashboards
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={platformTitle}
                        onChange={(e) => setPlatformTitle(e.target.value)}
                        placeholder="Enter brand name"
                        className="w-full pl-4 pr-12 py-3 bg-input-bg border border-input-border rounded-2xl text-xs text-text-primary font-bold focus:outline-none focus:border-brand-accent transition-all"
                      />
                      {hasTitleChanged && (
                        <span
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-warning animate-pulse"
                          title="Unsaved changes"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => saveBranding(platformTitle, platformLogo)}
                      disabled={!hasTitleChanged}
                      className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        hasTitleChanged
                          ? "bg-brand-accent text-white hover:bg-brand-hover shadow-lg shadow-brand-accent/20 cursor-pointer active:scale-95"
                          : "bg-border-accent text-text-tertiary cursor-not-allowed"
                      }`}
                    >
                      Save Title
                    </button>
                  </div>
                </div>

                {/* Custom Logo Card */}
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🖼️</span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">
                        Corporate SVG Logo
                      </h3>
                      <p className="text-[10px] text-text-secondary">
                        Upload an SVG format vector asset to replace the system icon
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border-accent hover:border-brand-accent/40 rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 bg-background-portal/30 hover:bg-background-portal/50"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept=".svg"
                      className="hidden"
                    />
                    {platformLogo ? (
                      <div
                        className="w-16 h-16 flex items-center justify-center border border-border-accent/80 p-2.5 rounded-xl bg-surface-card overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-brand-accent shadow-inner"
                        dangerouslySetInnerHTML={{ __html: platformLogo }}
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center rounded-xl bg-border-accent text-text-tertiary text-2xl font-black">
                        🏢
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-xs text-text-secondary font-bold">
                        {platformLogo
                          ? "Click to replace logo SVG"
                          : "Drop SVG asset or click to upload"}
                      </p>
                      <p className="text-[10px] text-text-tertiary">
                        Vector SVG files only (recommened viewbox: 24x24)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Column */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-text-primary mb-1">
                      Sidebar Live Preview
                    </h3>
                    <p className="text-[10px] text-text-secondary mb-5">
                      See how the branded elements render in the main layout navigation bar
                    </p>
                  </div>

                  {/* Sidebar mockup */}
                  <div className="bg-sidebar-bg border border-border-accent/80 rounded-2xl p-4 space-y-4 shadow-xl select-none">
                    <div className="flex items-center justify-between pb-3 border-b border-border-accent/40">
                      <div className="flex items-center gap-2.5">
                        {platformLogo ? (
                          <div
                            className="h-7 w-7 rounded-lg bg-surface-card p-1 border border-border-accent overflow-hidden flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-brand-accent"
                            dangerouslySetInnerHTML={{ __html: platformLogo }}
                          />
                        ) : (
                          <span className="p-1.5 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-black text-xs">
                            {platformTitle.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="font-extrabold text-xs text-text-primary truncate max-w-[120px]">
                          {platformTitle}
                        </span>
                      </div>
                      <span className="text-[8px] px-1 bg-brand-accent/15 text-brand-accent rounded font-black border border-brand-accent/20">
                        LIVE
                      </span>
                    </div>

                    <div className="space-y-1.5 opacity-60">
                      <div className="h-6 bg-sidebar-active rounded-lg flex items-center px-2.5 gap-2">
                        <span className="text-[10px]">📊</span>
                        <div className="h-2 w-12 bg-sidebar-text-active/50 rounded-sm"></div>
                      </div>
                      <div className="h-6 rounded-lg flex items-center px-2.5 gap-2">
                        <span className="text-[10px]">👥</span>
                        <div className="h-2 w-16 bg-sidebar-text/50 rounded-sm"></div>
                      </div>
                      <div className="h-6 rounded-lg flex items-center px-2.5 gap-2">
                        <span className="text-[10px]">⚙️</span>
                        <div className="h-2 w-10 bg-sidebar-text/50 rounded-sm"></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border-accent/40 text-[9px] text-text-tertiary flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Branding settings require super_admin authorization level</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs section */}
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">
                  Branding Modifications Audit
                </h3>
                <div className="h-[1px] flex-1 bg-border-accent/40"></div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Summary Table */}
                <div className="bg-surface-card border border-border-accent rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-table-header border-b border-border-accent flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-primary">
                      Change Frequency Summary
                    </span>
                    <span className="text-[8px] bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded text-brand-accent font-bold">
                      Aggregated
                    </span>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-table-header/40 border-b border-border-accent/50">
                      <tr>
                        {["Administrator", "Email", "Change Count", "Last Change"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-secondary"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-accent/60 text-xs">
                      {brandingLogs?.summary && brandingLogs.summary.length > 0 ? (
                        brandingLogs.summary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-table-row-hover transition-colors">
                            <td className="px-4 py-3 font-bold text-text-primary">
                              {row.userName}
                            </td>
                            <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">
                              {row.userEmail}
                            </td>
                            <td className="px-4 py-3 font-black text-brand-accent">
                              {row.changeCount} times
                            </td>
                            <td className="px-4 py-3 text-[10px] text-text-secondary">
                              {new Date(row.lastChangeDate).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-text-tertiary italic"
                          >
                            No branding logs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* History Detail Table */}
                <div className="bg-surface-card border border-border-accent rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-table-header border-b border-border-accent flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-primary">
                      Modification Event Stream
                    </span>
                    <span className="text-[8px] bg-success/10 border border-success/20 px-2 py-0.5 rounded text-success font-bold">
                      Realtime
                    </span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-table-header/40 border-b border-border-accent/50 sticky top-0 z-10">
                        <tr>
                          {["Timestamp", "Administrator", "IP Address", "Action Details"].map(
                            (h) => (
                              <th
                                key={h}
                                className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-text-secondary bg-table-header"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-accent/60 text-xs">
                        {brandingLogs?.details && brandingLogs.details.length > 0 ? (
                          brandingLogs.details.map((row, idx) => (
                            <tr key={idx} className="hover:bg-table-row-hover transition-colors">
                              <td className="px-4 py-2.5 text-[10px] text-text-secondary">
                                {new Date(row.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-text-primary">
                                {row.userName}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[9px] text-text-secondary">
                                {row.ipAddress}
                              </td>
                              <td className="px-4 py-2.5 text-[10px] text-text-secondary truncate max-w-[150px]">
                                {row.payload?.name ? `Title: "${row.payload.name}"` : ""}
                                {row.payload?.hasLogo ? " (Logo updated)" : ""}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-6 text-center text-text-tertiary italic"
                            >
                              No detailed logs found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SANDBOX (Admin) ── */}
        {tab === "sandbox" && isSuperAdmin && (
          <div className="space-y-8 max-w-xl">
            <div>
              <h1 className="text-lg font-black text-text-primary">Environment Sandbox Tools</h1>
              <p className="text-xs text-text-secondary mt-0.5">Development & staging utilities</p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-card border border-border-accent space-y-4">
              <h3 className="text-xs font-black text-text-primary">
                Production → Staging Synchronization
              </h3>
              <p className="text-[10px] text-text-secondary">
                Sanitizes real user emails and hashes, then copies structural hierarchy to the
                sandbox cluster for safe testing.
              </p>
              <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-accent to-success text-white text-xs font-black shadow-lg shadow-brand-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                Synchronize Production Data to Staging
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-surface-card border border-border-accent space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-text-primary">
                  Global Staging Sandbox Mode
                </h3>
                <button className="relative w-11 h-6 rounded-full bg-border-accent transition-all">
                  <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                </button>
              </div>
              <p className="text-[10px] text-text-secondary">
                When enabled, all data mutations are sandboxed and do not affect production
                databases.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
