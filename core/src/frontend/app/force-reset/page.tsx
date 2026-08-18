"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ForceResetPage() {
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCelebrated, setIsCelebrated] = useState(false);

  const router = useRouter();
  const [branding, setBranding] = useState({ name: "SG Forge", logo: "" });

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => setBranding(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (branding.name) {
      document.title = `${branding.name} — Workspace Activation`;
    }
  }, [branding.name]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        const parsed = data.session;
        if (!parsed) {
          throw new Error("No session");
        }
        setSession(parsed);
      } catch (_err) {
        const searchParams = new URLSearchParams(window.location.search);
        const redirectBack = searchParams.get("redirect_back") || searchParams.get("next") || "";
        router.replace(
          `/login${redirectBack ? `?redirect_back=${encodeURIComponent(redirectBack)}` : ""}`,
        );
      }
    };

    fetchSession();
  }, [router]);

  // Real-time password strength evaluator
  const getPasswordStrength = () => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strengthScore = getPasswordStrength();
  const isStrengthMet = strengthScore === 4;

  const handleVerifyTempPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // In our system, the initial temporary password seeded is 'password123'
    if (tempPassword === "password123") {
      setStep(3);
    } else {
      setError("Invalid temporary password. Please verify your onboarding welcome letter.");
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isStrengthMet) {
      setError("Password must meet all security strength parameters.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsCelebrated(true);
        // Smooth celebratory fade-out micro-transition before dashboard routing
        const searchParams = new URLSearchParams(window.location.search);
        const redirectBack = searchParams.get("redirect_back") || searchParams.get("next") || "";
        setTimeout(() => {
          if (redirectBack) {
            // Perform full page load for API routes or external redirects
            if (redirectBack.startsWith("/api/") || redirectBack.includes("://")) {
              window.location.replace(redirectBack);
            } else {
              router.replace(redirectBack);
            }
          } else {
            router.replace("/");
          }
        }, 1800);
      } else {
        setError(data.error || "Password update failed.");
        setIsLoading(false);
      }
    } catch (_err) {
      setError("Connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-portal text-text-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-background-portal text-text-primary relative overflow-hidden font-sans ${isCelebrated ? "opacity-0 scale-95 pointer-events-none transition-opacity duration-700" : "opacity-100 scale-100"}`}
    >
      {/* Neo-ambient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand-accent/15 blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-success/15 blur-[160px] pointer-events-none"></div>

      <div className="w-full max-w-lg p-8 bg-surface-card border border-border-accent rounded-3xl shadow-2xl relative z-10 transition-all duration-300">
        {/* Step 1: Personalized Onboarding Welcome Card */}
        {step === 1 && (
          <div className="text-center py-4">
            <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-brand-accent to-success text-white font-black text-2xl tracking-wider mb-6 shadow-xl shadow-brand-accent/20 items-center gap-2">
              {branding.logo ? (
                <div
                  className="w-8 h-8 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-white overflow-hidden flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: branding.logo }}
                />
              ) : null}
              <span>{branding.name}</span>
            </div>

            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-white to-brand-accent bg-clip-text text-transparent leading-tight">
              Welcome, {session.name}!
            </h1>

            <p className="text-gray-400 mt-3 text-sm leading-relaxed max-w-sm mx-auto">
              Your onboarding profile is initialized with EID{" "}
              <span className="font-extrabold text-success font-mono">{session.eid}</span>. To
              activate your secure workspace, let's complete a quick configuration setup.
            </p>

            <button
              onClick={() => setStep(3)}
              className="mt-8 px-8 py-3.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-brand-accent/25 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              Begin Account Activation
            </button>
          </div>
        )}

        {/* Step 2: Verification of temporary password */}
        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-text-primary">Identity Authorization</h2>
              <p className="text-xs text-gray-400 mt-2">
                Enter the temporary shared initialization credentials provided by HR.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-warning/10 border border-warning/20 text-warning rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyTempPassword} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Temporary Initialization Password
                </label>
                <input
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all duration-200"
                  placeholder="Enter temp code (password123)"
                  required
                />
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-brand-accent/20 cursor-pointer"
                >
                  Authorize Code
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Interactive Password Engine */}
        {step === 3 && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-text-primary">Establish Secure Key</h2>
              <p className="text-xs text-gray-400 mt-1">
                Design a high-entropy password to secure your admin credentials.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-warning/10 border border-warning/20 text-warning rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  New Private Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-600 focus:outline-none transition-all duration-300 ${
                    newPassword
                      ? isStrengthMet
                        ? "border-success ring-2 ring-success/20"
                        : "border-warning ring-2 ring-warning/20"
                      : "border-white/10"
                  }`}
                  placeholder="Minimum 8 high-entropy characters"
                  required
                />
              </div>

              {/* Real-time requirements checklist & border color shifts */}
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-400 font-extrabold uppercase">
                    Strength Metrics
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase ${
                      strengthScore === 4 ? "text-success" : "text-warning"
                    }`}
                  >
                    {strengthScore === 0 && "Unacceptable"}
                    {strengthScore === 1 && "Weak"}
                    {strengthScore === 2 && "Fair"}
                    {strengthScore === 3 && "Strong"}
                    {strengthScore === 4 && "Excellent / Compliant"}
                  </span>
                </div>

                {/* Visual score bar */}
                <div className="flex gap-1.5 h-1">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`flex-1 h-full rounded-full transition-all duration-300 ${
                        s <= strengthScore
                          ? strengthScore === 4
                            ? "bg-success shadow shadow-success"
                            : "bg-warning shadow shadow-warning"
                          : "bg-white/10"
                      }`}
                    ></div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[9px] font-bold">
                  <div
                    className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? "text-success" : "text-gray-500"}`}
                  >
                    <span>{newPassword.length >= 8 ? "✓" : "✕"}</span>
                    <span>8+ Characters</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? "text-success" : "text-gray-500"}`}
                  >
                    <span>{/[A-Z]/.test(newPassword) ? "✓" : "✕"}</span>
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? "text-success" : "text-gray-500"}`}
                  >
                    <span>{/[a-z]/.test(newPassword) ? "✓" : "✕"}</span>
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword) ? "text-success" : "text-gray-500"}`}
                  >
                    <span>
                      {/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword) ? "✓" : "✕"}
                    </span>
                    <span>Number / Special</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all duration-200"
                  placeholder="Repeat secure password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !isStrengthMet || newPassword !== confirmPassword}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-accent to-success hover:from-brand-accent/90 hover:to-success/90 text-white font-bold text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "Activate Workspace Profile"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Celebratory Transition Screen */}
        {isCelebrated && (
          <div className="text-center py-12 space-y-6 animate-bounce">
            <div className="inline-flex p-6 bg-success/20 rounded-full text-success border border-success/30 shadow-2xl shadow-success/25">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-3xl font-black text-success">Onboarding Complete!</h2>
              <p className="text-sm text-gray-400 mt-2">
                Workspace initialized. Booting up dashboard engines...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
