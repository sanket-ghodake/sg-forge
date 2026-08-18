"use client";

import { useEffect, useRef, useState } from "react";

interface EmployeesAppProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  runQuery?: (sql: string) => Promise<{ rows: any[]; rowCount: number }>;
}

export default function EmployeesApp({ user }: EmployeesAppProps) {
  // Directory & Hierarchy state
  const [focalUserId, setFocalUserId] = useState<string>(user.id);
  const [focalData, setFocalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchEmployees, setSearchEmployees] = useState<any[]>([]);
  const [searchDepartments, setSearchDepartments] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // UI Option style selection - only 'sandwich' (default) and 'split-pane'
  const [layoutStyle, setLayoutStyle] = useState<"sandwich" | "split-pane">("sandwich");

  // Fetch Hierarchy Context for the focal user
  const fetchHierarchyContext = async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/org/hierarchy/context?userId=${userId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch hierarchy context from API");
      }
      const data = await res.json();
      if (data.success) {
        setFocalData(data);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error loading employee hierarchy data.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial hierarchy on mount or focal user change
  useEffect(() => {
    fetchHierarchyContext(focalUserId);
  }, [focalUserId]);

  // Search Autocomplete Handler
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const res = await fetch(
            `/api/v1/org/hierarchy/search?q=${encodeURIComponent(searchQuery)}`,
          );
          if (res.ok) {
            const data = await res.json();
            setSearchEmployees(data.employees || []);
            setSearchDepartments(data.departments || []);
            setShowDropdown(true);
          }
        } catch (err) {
          console.error("Search error:", err);
        }
      } else {
        setSearchEmployees([]);
        setSearchDepartments([]);
        setShowDropdown(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside search dropdown closer
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        // Collapse search if query is empty
        if (!searchQuery) {
          setIsSearchExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchQuery]);

  // Switch directory focus user
  const handlePivot = (userId: string) => {
    setFocalUserId(userId);
    setSearchQuery("");
    setShowDropdown(false);
    setIsSearchExpanded(false);
  };

  // Deterministic colorful avatar gradients based on names to make UI vibrant
  const getAvatarGradient = (name: string) => {
    if (!name) return "linear-gradient(135deg, #6366f1, #4f46e5)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 60) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 75%, 55%), hsl(${h2}, 80%, 45%))`;
  };

  // Render initials avatar
  const renderAvatar = (name: string, size = "h-10 w-10 text-sm") => {
    const initials = name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "👤";
    return (
      <div
        className={`${size} rounded-full text-white flex items-center justify-center font-bold shadow-md select-none transition-transform duration-300 group-hover:scale-105`}
        style={{ background: getAvatarGradient(name) }}
      >
        {initials}
      </div>
    );
  };

  // ─── OPTION 1: COMPACT SANDWICH CHART (DEFAULT) ───
  const renderSandwichStyle = () => {
    const immediateManager = focalData.parentChain[focalData.parentChain.length - 1];
    const ceo = focalData.parentChain[0];
    const hasUpline = focalData.parentChain.length > 0;
    const directReports = focalData.directReports || [];

    return (
      <div className="flex flex-col items-center space-y-4 animate-fadeIn py-2">
        {/* Top: Immediate Manager Card (Slightly larger, dynamic max-width limit) */}
        {hasUpline ? (
          <div className="flex flex-col items-center">
            {focalData.parentChain.length > 1 && (
              <button
                onClick={() => handlePivot(ceo.id)}
                className="text-[9px] text-brand-accent hover:underline mb-1 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                👑 Skip to CEO
              </button>
            )}
            <div
              onClick={() => handlePivot(immediateManager.id)}
              className="p-3 bg-surface-card hover:bg-surface-elevated border border-border-accent/60 hover:border-brand-accent/30 rounded-2xl flex items-center gap-3.5 shadow-md cursor-pointer transition-all duration-200 hover:-translate-y-0.5 w-60 sm:w-64"
            >
              {renderAvatar(immediateManager.name, "h-8.5 w-8.5 text-[11px]")}
              <div className="text-left text-xs min-w-0">
                <div className="font-extrabold text-text-primary flex items-center gap-1">
                  <span className="truncate">{immediateManager.name}</span>
                  <span className="text-[7.5px] bg-brand-muted text-brand-accent px-1 rounded font-bold uppercase flex-shrink-0">
                    Manager
                  </span>
                </div>
                <p className="text-[9.5px] text-text-secondary truncate mt-0.5">
                  {immediateManager.designation}
                </p>
              </div>
            </div>
            {/* Connection Line */}
            <div className="w-0.5 h-6 bg-brand-accent/30" />
          </div>
        ) : (
          <div className="flex flex-col items-center mb-1">
            <span className="text-lg">👑</span>
            <div className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-[8px] font-bold uppercase tracking-wider mt-0.5">
              Root Node
            </div>
            <div className="w-0.5 h-6 bg-brand-accent/30 mt-1" />
          </div>
        )}

        {/* Center: Focal Coordinate Display Card (Small size, w-64 md:w-72 max) */}
        <div className="relative bg-gradient-to-br from-surface-card via-surface-card to-background-portal/45 border border-brand-accent/60 rounded-2xl p-4 shadow-lg w-64 sm:w-72 text-center flex-shrink-0">
          <div className="absolute top-0 right-0 bg-brand-accent/15 border-bl border-brand-accent/25 px-2 py-0.5 rounded-bl-xl text-[8px] font-black uppercase tracking-wider text-brand-accent">
            Focal
          </div>

          <div className="flex flex-col items-center space-y-2 pt-1">
            {renderAvatar(focalData.user.name, "h-10 w-10 text-xs")}
            <div>
              <h3 className="text-xs font-black text-text-primary leading-tight">
                {focalData.user.name}
              </h3>
              <p className="text-[9.5px] text-brand-accent font-extrabold uppercase tracking-wide mt-0.5">
                {focalData.user.designation}
              </p>
              <p className="text-[9px] text-text-secondary mt-0.5 flex items-center justify-center gap-1 font-medium">
                <span>🏢</span> {focalData.user.verticalName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 border-t border-border-accent/20 pt-3 text-left text-[9.5px]">
            <div>
              <span className="text-[8px] text-text-tertiary font-bold uppercase tracking-wider">
                EID
              </span>
              <p className="font-mono font-black text-text-primary leading-none mt-0.5">
                {focalData.user.eid}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-text-tertiary font-bold uppercase tracking-wider">
                Email
              </span>
              <p
                className="font-mono font-black text-text-primary leading-none mt-0.5 truncate"
                title={focalData.user.email}
              >
                {focalData.user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Connection Trees & Reports (Larger cards, wrapping dynamically) */}
        {directReports.length > 0 ? (
          <div className="flex flex-col items-center w-full">
            {/* Center connector line down */}
            <div className="w-0.5 h-6 bg-brand-accent/30" />

            {/* Horizontal branching connector line */}
            {directReports.length > 1 && (
              <div className="relative w-full flex justify-center">
                <div
                  className="absolute top-0 h-0.5 bg-brand-accent/30"
                  style={{ width: `calc(100% - ${100 / directReports.length}% - 40px)` }}
                />
              </div>
            )}

            {/* Direct Reports List (Dynamic columns, large cards w-60 sm:w-64 max-w-sm) */}
            <div className="flex flex-wrap justify-center gap-4 pt-0.5 w-full">
              {directReports.map((report: any) => (
                <div key={report.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-brand-accent/30" />
                  <div
                    onClick={() => handlePivot(report.id)}
                    className="p-3 bg-surface-card hover:bg-surface-elevated border border-border-accent/50 hover:border-brand-accent/25 rounded-2xl flex items-center gap-3 shadow-md cursor-pointer transition-all duration-200 hover:-translate-y-0.5 w-60 sm:w-64"
                  >
                    {renderAvatar(report.name, "h-8 w-8 text-xs")}
                    <div className="text-left text-xs min-w-0">
                      <h4 className="font-bold text-text-primary truncate">{report.name}</h4>
                      <p className="text-[9.5px] text-text-secondary truncate mt-0.5">
                        {report.designation || "Staff"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-brand-accent/30" />
            <div className="px-3 py-2 bg-surface-card/40 border border-dashed border-border-accent/50 rounded-xl text-[10px] text-text-secondary italic">
              No reports context mapped below.
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── OPTION 2: SPLIT-PANE BREADCRUMB DESIGN ───
  const renderSplitPaneStyle = () => {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Breadcrumb Upline Chain */}
        <div className="flex flex-wrap items-center gap-1.5 bg-surface-card/50 border border-border-accent/40 p-2.5 rounded-xl overflow-x-auto shadow-sm">
          {focalData.parentChain.map((parent: any) => (
            <div key={parent.id} className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handlePivot(parent.id)}
                className="px-2 py-1 bg-surface-card hover:bg-surface-elevated border border-border-accent/60 text-[10px] font-bold text-text-primary hover:text-brand-accent rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {parent.name}{" "}
                <span className="text-[8px] text-text-tertiary font-mono ml-0.5">
                  [{parent.designation?.split(" ")[0] || "Mgr"}]
                </span>
              </button>
              <span className="text-text-tertiary text-[10px]">➔</span>
            </div>
          ))}
          <span className="px-2 py-1 bg-brand-accent text-white border border-brand-hover text-[10px] font-black rounded-lg shadow-sm">
            {focalData.user.name}{" "}
            <span className="text-[8px] text-indigo-100 font-mono ml-0.5">
              [{focalData.user.designation?.split(" ")[0] || "Staff"}]
            </span>
          </span>
        </div>

        {/* Split Pane Main */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Focal Info Card (Small layout, fixed width) */}
          <div className="lg:col-span-3 bg-surface-card border border-border-accent/40 rounded-2xl p-4 shadow-md space-y-3 w-full sm:w-72 flex-shrink-0">
            <h3 className="text-[9px] font-black uppercase text-text-secondary tracking-widest border-b border-border-accent/45 pb-2">
              Focal Profile
            </h3>

            <div className="flex items-center gap-3">
              {renderAvatar(focalData.user.name, "h-9 w-9 text-xs")}
              <div>
                <h4 className="text-xs font-black text-text-primary leading-tight">
                  {focalData.user.name}
                </h4>
                <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wider">
                  {focalData.user.designation}
                </p>
                <p className="text-[9px] text-text-secondary font-medium">
                  {focalData.user.verticalName}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border-accent/30 text-[10px]">
              <div className="flex justify-between py-0.5">
                <span className="text-text-secondary font-semibold">EID</span>
                <span className="font-mono font-bold text-text-primary">{focalData.user.eid}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-text-secondary font-semibold">Email</span>
                <span
                  className="font-mono font-bold text-text-primary truncate max-w-[130px]"
                  title={focalData.user.email}
                >
                  {focalData.user.email}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-text-secondary font-semibold">Scope</span>
                <span className="font-bold text-emerald-400 capitalize">
                  {focalData.user.role?.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Right Pane: Co-workers and Direct Reports lists (Larger cards, dynamic layout wrap) */}
          <div className="lg:col-span-9 bg-surface-card border border-border-accent/40 rounded-2xl p-4 shadow-md space-y-4">
            {/* Direct Reports Panel */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-black uppercase text-text-secondary tracking-widest pl-1">
                Direct Reports ({focalData.directReports.length})
              </h4>
              {/* Dynamic grid to prevent overly wide card stretching on large screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {focalData.directReports.map((report: any) => (
                  <div
                    key={report.id}
                    onClick={() => handlePivot(report.id)}
                    className="bg-surface-card hover:bg-surface-elevated border border-border-accent/50 hover:border-brand-accent/20 rounded-2xl p-3.5 cursor-pointer transition-all duration-200 flex items-center justify-between group shadow-sm w-full max-w-[280px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(report.name, "h-8.5 w-8.5 text-xs")}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">
                          {report.name}
                        </h4>
                        <p className="text-[9.5px] text-text-secondary truncate mt-0.5">
                          {report.designation || "Staff"}
                        </p>
                        <p className="text-[8.5px] text-text-tertiary truncate">
                          {report.verticalName}
                        </p>
                      </div>
                    </div>
                    <span className="text-text-tertiary group-hover:translate-x-0.5 transition-transform text-[9px] flex-shrink-0">
                      ➔
                    </span>
                  </div>
                ))}
                {focalData.directReports.length === 0 && (
                  <div className="col-span-full py-6 text-center text-[10px] text-text-secondary italic">
                    No active direct reports.
                  </div>
                )}
              </div>
            </div>

            {/* Circle Peers Panel */}
            <div className="space-y-2.5 pt-2 border-t border-border-accent/30">
              <h4 className="text-[10px] font-black uppercase text-text-secondary tracking-widest pl-1 mt-2">
                Circle Peers ({focalData.peers.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {focalData.peers.map((peer: any) => (
                  <div
                    key={peer.id}
                    onClick={() => handlePivot(peer.id)}
                    className="bg-surface-card hover:bg-surface-elevated border border-border-accent/50 hover:border-brand-accent/20 rounded-2xl p-3.5 cursor-pointer transition-all duration-200 flex items-center justify-between group shadow-sm w-full max-w-[280px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(peer.name, "h-8.5 w-8.5 text-xs")}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">
                          {peer.name}
                        </h4>
                        <p className="text-[9.5px] text-text-secondary truncate mt-0.5">
                          {peer.designation || "Staff"}
                        </p>
                        <p className="text-[8.5px] text-text-tertiary truncate">
                          {peer.verticalName}
                        </p>
                      </div>
                    </div>
                    <span className="text-text-tertiary group-hover:translate-x-0.5 transition-transform text-[9px] flex-shrink-0">
                      ➔
                    </span>
                  </div>
                ))}
                {focalData.peers.length === 0 && (
                  <div className="col-span-full py-6 text-center text-[10px] text-text-secondary italic">
                    No mapping circle peers coordinates.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-text-primary">
      {/* Super Compact Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 bg-surface-card/45 border border-border-accent/40 rounded-2xl p-2 shadow-md backdrop-blur-md relative z-20">
        <div className="flex items-center gap-2 pl-2">
          <span className="text-xs font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-brand-accent to-indigo-300">
            Directory
          </span>
        </div>

        {/* Actions layout (Expandable Search and Switcher) */}
        <div className="flex items-center gap-2">
          {/* Expandable Search Input Container */}
          <div className="relative flex items-center" ref={dropdownRef}>
            {/* Slide-out search input field */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${isSearchExpanded ? "w-48 sm:w-64 opacity-100 mr-1.5" : "w-0 opacity-0 pointer-events-none"}`}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-background-portal border border-border-accent/60 focus:border-brand-accent rounded-lg pl-3 pr-7 py-1 text-xs text-text-primary placeholder-text-tertiary focus:outline-none transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center bg-surface-elevated hover:bg-brand-accent hover:text-white text-[9px] text-text-secondary cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Toggle Icon Button */}
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
                isSearchExpanded || searchQuery
                  ? "bg-brand-accent text-white border-brand-hover shadow-sm"
                  : "bg-surface-elevated/40 text-text-secondary border-border-accent/50 hover:bg-surface-elevated hover:text-text-primary"
              }`}
              title="Toggle Search"
            >
              🔍
            </button>

            {/* Autocomplete Dropdown */}
            {isSearchExpanded &&
              showDropdown &&
              (searchEmployees.length > 0 || searchDepartments.length > 0) && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-surface-card border border-border-accent rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 p-1.5 space-y-1.5 backdrop-blur-xl animate-fadeIn">
                  {/* Departments Section */}
                  {searchDepartments.length > 0 && (
                    <div>
                      <p className="text-[8px] font-black uppercase text-brand-accent tracking-widest px-2 py-0.5 border-b border-border-accent/40 mb-1 flex items-center gap-1">
                        <span>🏢</span> Departments ({searchDepartments.length})
                      </p>
                      {searchDepartments.map((dept) => (
                        <div
                          key={dept.id}
                          onClick={() => dept.headUserId && handlePivot(dept.headUserId)}
                          className={`p-1.5 rounded-md flex items-center justify-between border border-transparent transition-all duration-150 ${
                            dept.headUserId
                              ? "bg-surface-card hover:bg-surface-elevated hover:border-brand-accent/20 cursor-pointer"
                              : "opacity-65 cursor-not-allowed"
                          }`}
                        >
                          <div className="min-w-0">
                            <h4 className="text-[11px] font-bold text-text-primary truncate">
                              {dept.name}
                            </h4>
                            {dept.headUserId ? (
                              <p className="text-[8.5px] text-text-secondary leading-none mt-0.5">
                                Lead: {dept.headUserName}
                              </p>
                            ) : (
                              <p className="text-[8.5px] text-text-tertiary italic mt-0.5">
                                No leader
                              </p>
                            )}
                          </div>
                          {dept.headUserId && (
                            <span className="text-[8px] bg-brand-muted border border-brand-accent/20 px-1 rounded text-brand-accent font-bold">
                              Pivot
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Employees Section */}
                  {searchEmployees.length > 0 && (
                    <div>
                      <p className="text-[8px] font-black uppercase text-emerald-400 tracking-widest px-2 py-0.5 border-b border-border-accent/40 mb-1 flex items-center gap-1 mt-0.5">
                        <span>👤</span> Employees ({searchEmployees.length})
                      </p>
                      {searchEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => handlePivot(emp.id)}
                          className="p-1.5 bg-surface-card hover:bg-surface-elevated border border-transparent hover:border-border-accent/30 rounded-md flex items-center justify-between cursor-pointer transition-all duration-150"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {renderAvatar(emp.name, "h-6 w-6 text-[9px]")}
                            <div className="min-w-0">
                              <h4 className="text-[11px] font-bold text-text-primary truncate">
                                {emp.name}
                              </h4>
                              <p className="text-[8.5px] text-text-secondary truncate leading-none">
                                {emp.designation || "Staff"} ·{" "}
                                <span className="text-brand-accent/90">{emp.verticalName}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[8px] font-mono bg-background-portal border border-border-accent/60 px-1 rounded text-text-tertiary">
                            {emp.eid}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Layout Switcher (Sandwich and Split views) */}
          <div className="flex bg-background-portal border border-border-accent/60 rounded-xl p-0.5 backdrop-blur-sm">
            {[
              { id: "sandwich", name: "Sandwich", icon: "🥪" },
              { id: "split-pane", name: "Split", icon: "🍞" },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setLayoutStyle(style.id as any)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  layoutStyle === style.id
                    ? "bg-brand-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                title={style.name}
              >
                <span className="mr-1">{style.icon}</span>
                <span className="hidden sm:inline">{style.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono animate-fadeIn flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Core Layout Switcher */}
      {loading && !focalData ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-secondary animate-pulse">Resolving org hierarchy...</p>
        </div>
      ) : focalData ? (
        <div>
          {layoutStyle === "sandwich" && renderSandwichStyle()}
          {layoutStyle === "split-pane" && renderSplitPaneStyle()}
        </div>
      ) : (
        <div className="text-center py-10 text-text-secondary italic bg-surface-card/30 border border-border-accent/40 rounded-2xl">
          Org graph data coordinates failed to resolve.
        </div>
      )}
    </div>
  );
}
