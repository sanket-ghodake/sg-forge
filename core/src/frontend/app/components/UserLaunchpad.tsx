"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { AppShell } from "./ui/AppShell";

const EmployeesApp = dynamic<any>(() => import("@apps/employees"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center py-24">
      <span className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></span>
    </div>
  ),
});

interface AppConfig {
  id: string;
  slug?: string;
  name: string;
  description: string;
  icon: string;
  roles?: string[];
  entryPoint: string;
  entryUrl?: string;
  directoryName: string;
  routingMode?: string;
  database?: {
    requiresIsolatedSchema?: boolean;
    schemaName?: string;
  };
  targetRules?: {
    verticals?: string[];
    designations?: string[];
    minJobLevel?: number;
  };
}

interface UserSessionPayload {
  user: {
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    hierarchyLevel: number;
    managerId: string | null;
  };
  manager: {
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
  } | null;
  peers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  directReports: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    designation: string;
    verticalName: string;
  }>;
  allUsers: Array<{
    id: string;
    eid: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    verticalName: string;
    managerId: string | null;
  }>;
  allMetadata: Array<{
    id: string;
    type: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
  }>;
  apps: AppConfig[];
}

interface UserLaunchpadProps {
  initialData: UserSessionPayload;
  isAdmin: boolean;
}

export default function UserLaunchpad({ initialData, isAdmin }: UserLaunchpadProps) {
  const router = useRouter();

  const runQuery = async (queryStr: string) => {
    // Intercept read-only directory queries for standard user sessions
    if (initialData.user?.role === "user") {
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
        const managerId = managerIdMatch ? managerIdMatch[1] : initialData.user?.id;

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

  const companyMeta = initialData.allMetadata.find((m) => m.type === "company_name") as any;
  const brandingTitle = companyMeta?.name || "SG Forge";
  const brandingLogo = companyMeta?.extendedAttributes?.logo || "";

  useEffect(() => {
    if (brandingTitle) {
      document.title = `${brandingTitle} — Member Portal`;
    }
  }, [brandingTitle]);

  // Theme & Font state synced with documentElement
  const [theme, setTheme] = useState("default");
  const [_font, setFont] = useState("default");

  useEffect(() => {
    // Read from localStorage or default
    const savedTheme = localStorage.getItem("theme") || "default";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    const savedFont = localStorage.getItem("font") || "default";
    setFont(savedFont);
    document.documentElement.setAttribute("data-font", savedFont);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // Sidebar collapsible state
  const [_sidebarOpen, _setSidebarOpen] = useState(true);

  // Active Workspace View
  // 'profile' | 'team' | 'directory' | 'apps'
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "directory" | "apps">("profile");

  // Profile Pivoting History Stack (allows walking the hierarchy tree and returning)
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>(initialData.user.id);

  // State to simulate network speed
  const [_isTabTransitioning, _setIsTabTransitioning] = useState(false);

  // Modal states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showVerticalScopeModal, setShowVerticalScopeModal] = useState(false);

  // Sudo Elevation State
  const [isElevated, setIsElevated] = useState(false);
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [showSudoModal, setShowSudoModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [sudoError, setSudoError] = useState("");
  const [_selectedOrgNodeId, _setSelectedOrgNodeId] = useState<string | null>(null);

  // Omni Search (Cmd+K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const checkSudoStatus = async () => {
      try {
        const res = await fetch("/api/auth/elevate");
        const data = await res.json();
        if (data.isElevated) {
          setIsElevated(true);
          setExpiresInSeconds(data.expiresInSeconds);
        } else {
          setIsElevated(false);
          setExpiresInSeconds(0);
        }
      } catch (err) {
        console.error("Failed to check elevation status:", err);
      }
    };

    checkSudoStatus();

    // Check status periodically
    const statusInterval = setInterval(checkSudoStatus, 15000);
    return () => clearInterval(statusInterval);
  }, [isAdmin]);

  // Countdown timer for sudo expiration
  useEffect(() => {
    if (!isElevated || expiresInSeconds <= 0) return;

    const timer = setInterval(() => {
      setExpiresInSeconds((prev) => {
        if (prev <= 1) {
          setIsElevated(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isElevated, expiresInSeconds]);

  // Helper to format remaining time (e.g. 14:59)
  const formatSudoTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleSudo = async () => {
    if (isElevated) {
      // De-elevate/demote instantly
      try {
        const res = await fetch("/api/auth/elevate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "demote" }),
        });
        const data = await res.json();
        if (data.success === true) {
          setIsElevated(false);
          setExpiresInSeconds(0);
        }
      } catch (err) {
        console.error("Failed to de-elevate:", err);
      }
    } else {
      // Open verification modal
      setMfaCode("");
      setSudoError("");
      setShowSudoModal(true);
    }
  };

  const handleSubmitSudo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSudoError("");
    try {
      const res = await fetch("/api/auth/elevate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (res.ok && data.isElevated) {
        setIsElevated(true);
        setExpiresInSeconds(900); // 15 minutes
        setShowSudoModal(false);
      } else {
        setSudoError(data.error || "Failed to elevate session.");
      }
    } catch (_err) {
      setSudoError("An error occurred during authentication.");
    }
  };

  // Marketplace & access states
  const [marketplaceSubTab, setMarketplaceSubTab] = useState<
    "catalog" | "requests" | "team-requests"
  >("catalog");
  const [marketplaceApps, setMarketplaceApps] = useState<{
    enabledApps: any[];
    requestableApps: any[];
    unavailableApps: any[];
  }>({
    enabledApps: initialData.apps,
    requestableApps: [],
    unavailableApps: [],
  });
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
  const [selectedRequestApp, setSelectedRequestApp] = useState<any | null>(null);

  // Request Form fields
  const [requestReason, setRequestReason] = useState("");
  const [requestScope, setRequestScope] = useState<"individual" | "org_node" | "project">(
    "individual",
  );
  const [requestTargetEntityId, setRequestTargetEntityId] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // 2026 Enterprise Request Extensions (Simulated)
  const [isTemporaryAccess, setIsTemporaryAccess] = useState(false);
  const [temporaryDuration, setTemporaryDuration] = useState("24h");
  const [isBreakGlassAccess, setIsBreakGlassAccess] = useState(false);

  // Ticket / Timeline Communication Modal states
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  // Org Hierarchy Tree and Autocomplete states
  const [teamSubView, setTeamSubView] = useState<"peers" | "tree">("peers");
  const [orgHierarchy, setOrgHierarchy] = useState<{ nodes: any[]; nodeTypes: any[] } | null>(null);
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [availableNodes, setAvailableNodes] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);

  const fetchHierarchyData = async () => {
    setIsHierarchyLoading(true);
    try {
      const res = await fetch("/api/v1/org/hierarchy");
      if (res.ok) {
        const data = await res.json();
        setOrgHierarchy(data);
        // Pre-expand all nodes by default
        const initialExpanded: Record<string, boolean> = {};
        data.nodes?.forEach((node: any) => {
          initialExpanded[node.id] = true;
        });
        setExpandedNodes(initialExpanded);
        setAvailableNodes(data.nodes || []);
      }
    } catch (e) {
      console.error("Error fetching hierarchy data:", e);
    } finally {
      setIsHierarchyLoading(false);
    }
  };

  const fetchProjectsData = async () => {
    try {
      const res = await fetch("/api/v1/org/projects");
      if (res.ok) {
        const data = await res.json();
        setAvailableProjects(data.projects || []);
      }
    } catch (e) {
      console.error("Error fetching projects data:", e);
    }
  };

  const fetchMarketplaceData = async () => {
    setIsMarketplaceLoading(true);
    try {
      const appsRes = await fetch("/api/v1/marketplace/apps");
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setMarketplaceApps({
          enabledApps: appsData.enabledApps || [],
          requestableApps: appsData.requestableApps || [],
          unavailableApps: appsData.unavailableApps || [],
        });
      }

      const reqRes = await fetch("/api/v1/marketplace/requests");
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setAccessRequests(reqData.requests || []);
      }
    } catch (e) {
      console.error("Error loading marketplace data:", e);
    } finally {
      setIsMarketplaceLoading(false);
    }
  };

  const fetchTicketMessages = async (requestId: string) => {
    setIsMessagesLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/requests/messages?requestId=${requestId}`);
      if (res.ok) {
        const data = await res.json();
        setTicketMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error fetching ticket messages:", err);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessageText.trim()) return;
    try {
      const res = await fetch("/api/v1/marketplace/requests/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedTicket.id,
          message: newMessageText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTicketMessages((prev) => [...prev, data.message]);
        setNewMessageText("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleReviewTicket = async (status: "approved" | "rejected") => {
    if (!selectedTicket) return;
    setIsReviewing(true);
    try {
      const res = await fetch("/api/v1/marketplace/approve-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedTicket.id,
          status,
          notes: reviewNotes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local ticket status
        setSelectedTicket((prev: any) => (prev ? { ...prev, status: data.nextStatus } : null));
        setReviewNotes("");
        fetchMarketplaceData();
        fetchTicketMessages(selectedTicket.id);
        setToastMessage({ text: `Request successfully ${status}!`, type: "success" });
      } else {
        const data = await res.json();
        setToastMessage({ text: data.error || "Failed to review request", type: "error" });
      }
    } catch (err) {
      console.error("Error reviewing request:", err);
      setToastMessage({ text: "Error reviewing request", type: "error" });
    } finally {
      setIsReviewing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "apps") {
      fetchMarketplaceData();
      fetchHierarchyData();
      fetchProjectsData();
    } else if (activeTab === "team") {
      fetchHierarchyData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (requestScope === "project" && availableProjects.length > 0) {
      setRequestTargetEntityId(availableProjects[0].id);
    } else if (requestScope === "org_node" && availableNodes.length > 0) {
      setRequestTargetEntityId(availableNodes[0].id);
    } else {
      setRequestTargetEntityId("");
    }
  }, [requestScope, availableProjects, availableNodes]);

  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestApp) return;

    setIsSubmittingRequest(true);
    setRequestError("");

    // Append 2026 enterprise tags to the reason description
    let finalReason = requestReason;
    if (isBreakGlassAccess) {
      finalReason = `[BREAK-GLASS EMERGENCY] ${finalReason}`;
    }
    if (isTemporaryAccess) {
      finalReason = `[TEMPORARY ACCESS: ${temporaryDuration}] ${finalReason}`;
    }

    try {
      const res = await fetch("/api/v1/marketplace/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedRequestApp.id,
          reason: finalReason,
          scope: requestScope,
          targetEntityId: requestTargetEntityId || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ text: "Access request submitted successfully!", type: "success" });
        setShowRequestAccessModal(false);
        setRequestReason("");
        setRequestScope("individual");
        setRequestTargetEntityId("");
        setIsTemporaryAccess(false);
        setIsBreakGlassAccess(false);
        fetchMarketplaceData();
      } else {
        setRequestError(data.error || "Failed to submit request");
      }
    } catch (err: any) {
      setRequestError(err.message || "An error occurred");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Autofocus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Fast tab switching simulation (<50ms)
  const handleTabChange = (tab: typeof activeTab) => {
    // Execute immediately without delay
    setActiveTab(tab);
  };

  // Helper to map icon string to emoji
  const getAppIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case "users":
        return "👥";
      case "creditcard":
        return "💳";
      case "briefcase":
        return "💼";
      case "activity":
        return "📈";
      case "settings":
        return "⚙️";
      default:
        return "📦";
    }
  };

  // Resolve current active profile user
  const activeUser =
    initialData.allUsers.find((u) => u.id === currentProfileId) || initialData.user;

  // Resolve active profile's manager
  const activeManager = activeUser.managerId
    ? initialData.allUsers.find((u) => u.id === activeUser.managerId) || null
    : null;

  // Resolve active profile's peers (same manager)
  const activePeers = activeUser.managerId
    ? initialData.allUsers.filter(
        (u) => u.managerId === activeUser.managerId && u.id !== activeUser.id,
      )
    : [];

  // Resolve active profile's direct reports
  const activeReports = initialData.allUsers.filter((u) => u.managerId === activeUser.id);

  // Calculate dynamic hierarchy depth for active profile
  const getProfileHierarchyLevel = (userId: string) => {
    let level = 0;
    let currId = userId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const parent = initialData.allUsers.find((u) => u.id === currId)?.managerId;
      if (parent) {
        level++;
        currId = parent;
      } else {
        break;
      }
    }
    return level;
  };

  const activeHierarchyLevel = getProfileHierarchyLevel(currentProfileId);

  // Pivot view helper
  const handlePivotProfile = (targetId: string) => {
    if (targetId === currentProfileId) return;
    setProfileHistory((prev) => [...prev, currentProfileId]);
    setCurrentProfileId(targetId);
    setActiveTab("profile");
  };

  // Rollback pivot helper
  const handlePivotBack = () => {
    if (profileHistory.length === 0) return;
    const previousId = profileHistory[profileHistory.length - 1];
    setProfileHistory((prev) => prev.slice(0, -1));
    setCurrentProfileId(previousId);
  };

  const handlePivotReset = () => {
    setProfileHistory([]);
    setCurrentProfileId(initialData.user.id);
  };

  // Filter application list by role permissions
  const filteredApps = initialData.apps.filter((app) => {
    if (!app.roles || app.roles.length === 0) return true;
    return app.roles.includes(initialData.user.role);
  });

  // Filter all users for omni-search
  const filteredSearchUsers =
    searchQuery.trim() === ""
      ? []
      : initialData.allUsers.filter(
          (u) =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.eid.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.designation.toLowerCase().includes(searchQuery.toLowerCase()),
        );

  const renderOrgNodeTree = (parentId: string | null): React.ReactNode => {
    if (!orgHierarchy) return null;
    const currentNodes = orgHierarchy.nodes.filter((n) => n.parentId === parentId);
    if (currentNodes.length === 0) return null;

    return (
      <div className="flex flex-col gap-6 pl-4 border-l border-border-accent/40 mt-3 ml-2">
        {currentNodes.map((node) => {
          const isExpanded = expandedNodes[node.id] !== false;
          const childNodesCount = orgHierarchy.nodes.filter((n) => n.parentId === node.id).length;

          return (
            <div key={node.id} className="relative group">
              {/* Card Container */}
              <div className="bg-surface-card border border-border-accent/60 hover:border-brand-accent rounded-2xl p-4 shadow-sm hover:shadow-md transition-all max-w-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base">
                      {node.type === "company"
                        ? "🏢"
                        : node.type === "division"
                          ? "📁"
                          : node.type === "department"
                            ? "💼"
                            : "👥"}
                    </span>
                    <div>
                      <h4 className="font-bold text-text-primary text-xs flex items-center gap-2">
                        {node.name}
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-background-portal text-text-secondary font-mono border border-border-accent uppercase">
                          {node.type}
                        </span>
                      </h4>
                      <p className="text-[9px] text-text-tertiary font-mono">ID: {node.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {childNodesCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNodes((prev) => ({ ...prev, [node.id]: !isExpanded }))
                        }
                        className="px-2.5 py-1 bg-surface-elevated hover:bg-brand-accent/20 border border-border-accent hover:border-brand-accent/40 rounded-lg text-[9px] font-black text-text-secondary hover:text-text-primary transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        {isExpanded ? "Collapse" : `Expand (${childNodesCount})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Node Members List */}
                {isExpanded && node.members && node.members.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-accent/40 space-y-2">
                    <span className="text-[8px] text-text-tertiary font-black uppercase tracking-wider block">
                      Members & Leads
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {node.members.map((member: any) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 bg-background-portal/50 border border-border-accent/30 rounded-xl p-2"
                        >
                          <div className="h-6 w-6 rounded-lg bg-surface-elevated text-text-secondary text-[10px] font-black flex items-center justify-center">
                            {member.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-text-primary block truncate leading-tight">
                              {member.name}
                              {member.relationship === "lead" && (
                                <span className="ml-1 text-[8px] text-warning bg-warning/10 border border-warning/20 px-1 rounded font-black uppercase">
                                  Lead
                                </span>
                              )}
                            </span>
                            <span className="text-[8px] text-text-secondary block truncate mt-0.5">
                              {member.designation || "Staff"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Children Nodes */}
              {isExpanded && renderOrgNodeTree(node.id)}
            </div>
          );
        })}
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (_err) {}
    router.push("/login");
  };

  const navItems = [
    {
      id: "profile",
      label: "Home / Profile",
      icon: "🏠",
      action: () => handleTabChange("profile"),
      active: activeTab === "profile",
    },
    {
      id: "team",
      label: "My Team Focus",
      icon: "👥",
      action: () => handleTabChange("team"),
      active: activeTab === "team",
    },
    {
      id: "directory",
      label: "Org Directory",
      icon: "🌐",
      action: () => handleTabChange("directory"),
      active: activeTab === "directory",
    },
    ...filteredApps.map((app) => ({
      id: `app-${app.id}`,
      label: app.name,
      icon: getAppIcon(app.icon),
      action: () => {
        if (app.routingMode === "standalone") {
          window.open(`/apps/${app.id}`, "_blank");
        } else {
          router.push(`/apps/${app.id}`);
        }
      },
    })),
    {
      id: "apps",
      label: "App Marketplace",
      icon: "🛒",
      action: () => handleTabChange("apps"),
      active: activeTab === "apps",
    },
  ];

  const headerActions = (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <div className="flex items-center gap-2 mr-2">
          {isElevated && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/")}
                className="px-2 py-1 bg-brand-muted hover:bg-brand-accent/20 border border-brand-accent/30 rounded text-[9px] font-black text-brand-accent uppercase tracking-widest transition-all cursor-pointer"
              >
                Admin
              </button>
              <button
                onClick={() => (window.location.href = "http://localhost:3003/developer")}
                className="px-2 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent rounded text-[9px] font-black text-text-secondary hover:text-text-primary uppercase tracking-widest transition-all cursor-pointer"
              >
                Dev
              </button>
            </div>
          )}
          <div className="px-2 py-1 bg-surface-elevated border border-border-accent rounded flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-text-secondary tracking-tight">
              Sudo
            </span>
            <button
              type="button"
              onClick={handleToggleSudo}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                isElevated ? "bg-red-500" : "bg-surface-elevated"
              }`}
              title="Toggle System Administration View"
            >
              <span
                className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${
                  isElevated ? "translate-x-3.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setSearchOpen(true)}
        className="h-8 px-3 rounded-full bg-surface-elevated/40 border border-border-accent hover:bg-surface-elevated text-xs text-text-secondary hover:text-text-primary transition-all flex items-center gap-2 font-bold"
        title="Search (⌘K)"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">Search</span>
        <kbd className="bg-background-portal px-1 rounded border border-border-accent text-[9px] font-sans">
          ⌘K
        </kbd>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="h-8 w-8 rounded-full bg-surface-elevated/40 border border-border-accent hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-all flex items-center justify-center text-xs">
            {theme === "light"
              ? "☀️"
              : theme === "solarized-dark"
                ? "🕶️"
                : theme === "solarized-light"
                  ? "📄"
                  : theme === "dark"
                    ? "🌙"
                    : "✨"}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="bg-surface-elevated border border-border-accent p-2.5 rounded-2xl shadow-2xl min-w-[170px] space-y-1 animate-fadeIn z-50"
            sideOffset={5}
            align="end"
          >
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
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer outline-none transition-colors ${theme === item.id ? "bg-brand-accent text-white" : "text-text-primary hover:bg-surface-card"}`}
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
    </div>
  );

  return (
    <AppShell
      navItems={navItems}
      brandingName={brandingTitle}
      brandingLogo={brandingLogo}
      headerTitle={
        isElevated ? `⚠️ Sudo (Expires in ${formatSudoTime(expiresInSeconds)})` : "Member Portal"
      }
      user={{ name: initialData.user.name, role: initialData.user.designation }}
      onLogout={handleLogout}
      headerActions={headerActions}
    >
      <div className="w-full relative animate-fadeIn">
        {/* Tab Content 1: The Identity Hub (Bento Grid) */}
        {activeTab === "profile" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
            {/* Pivoting Navigation Breadcrumb */}
            {profileHistory.length > 0 && (
              <div className="flex items-center justify-between bg-surface-card/50 border border-border-accent/40 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-text-secondary">Pivoted Profile Path:</span>
                  <button onClick={handlePivotReset} className="text-brand-accent hover:underline">
                    Me ({initialData.user.name})
                  </button>
                  {profileHistory.map((histId, idx) => {
                    const histUser = initialData.allUsers.find((u) => u.id === histId);
                    if (!histUser) return null;
                    return (
                      <React.Fragment key={`${histId}-${idx}`}>
                        <span className="text-text-tertiary">/</span>
                        <button
                          onClick={() => {
                            const newHistory = profileHistory.slice(0, idx + 1);
                            setProfileHistory(newHistory);
                            setCurrentProfileId(histId);
                          }}
                          className="text-brand-accent hover:underline truncate max-w-[120px]"
                        >
                          {histUser.name}
                        </button>
                      </React.Fragment>
                    );
                  })}
                  <span className="text-text-tertiary">/</span>
                  <span className="text-text-primary truncate max-w-[150px]">
                    {activeUser.name}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePivotBack}
                    className="px-3 py-1 bg-surface-card hover:bg-surface-elevated border border-border-accent text-xs font-bold rounded-lg transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePivotReset}
                    className="px-3 py-1 bg-brand-accent text-white hover:bg-brand-hover text-xs font-bold rounded-lg transition-all"
                  >
                    Reset to Me
                  </button>
                </div>
              </div>
            )}

            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Primary Identity Bento Block */}
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                      Primary Identity
                    </span>
                    <span className="px-2 py-0.5 bg-success/10 border border-success/20 rounded-full text-[9px] font-black text-success uppercase tracking-wider flex items-center gap-1 animate-pulse">
                      <span className="h-1 w-1 bg-success rounded-full"></span>
                      Active
                    </span>
                  </div>

                  <div className="flex items-center gap-4.5 my-6">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-brand-accent/15">
                      {activeUser.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-text-primary leading-tight truncate">
                        {activeUser.name}
                      </h2>
                      <p className="text-xs text-text-secondary font-mono mt-0.5">
                        {activeUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border-accent/40 pt-4.5 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">Corporate EID</span>
                      <span className="text-text-primary font-black font-mono">
                        {activeUser.eid}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">User Role Scope</span>
                      <span className="text-text-primary font-bold uppercase tracking-widest text-[10px]">
                        {activeUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => setShowVerificationModal(true)}
                    className="w-full py-2.5 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    View Digital Verification Token
                  </button>
                </div>
              </div>

              {/* 2. Corporate Alignment Bento Block */}
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                      Corporate Alignment
                    </span>
                    <span className="text-xs text-brand-accent font-extrabold">
                      Tier {activeHierarchyLevel + 1}
                    </span>
                  </div>

                  <div className="my-6 space-y-4">
                    <div>
                      <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">
                        Assigned Designation
                      </span>
                      <p className="text-base font-black text-text-primary truncate mt-0.5">
                        {activeUser.designation}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">
                        Department Vertical
                      </span>
                      <p className="text-base font-black text-text-primary truncate mt-0.5">
                        {activeUser.verticalName}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border-accent/40 pt-4.5 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">Structural Lineage</span>
                      <span className="text-text-primary font-bold">
                        Level {activeHierarchyLevel} Node
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary font-medium">Reporting Path</span>
                      <span className="text-text-primary font-bold">
                        {activeUser.managerId ? "Standard Chain" : "Root C-Suite"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => setShowVerticalScopeModal(true)}
                    className="w-full py-2.5 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    View Department Scope
                  </button>
                </div>
              </div>

              {/* 3. Reporting Line Bento Block */}
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                      Reporting Line
                    </span>
                    <span className="text-[9px] text-text-tertiary font-bold uppercase">
                      Upline Coordinates
                    </span>
                  </div>

                  {activeManager ? (
                    <div className="my-6">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-surface-elevated border border-border-accent text-brand-accent flex items-center justify-center font-bold text-sm">
                          👤
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-text-primary leading-tight truncate">
                            {activeManager.name}
                          </h4>
                          <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5 truncate">
                            {activeManager.designation}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border-accent/40 mt-6 pt-4.5 space-y-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-secondary font-medium">Manager EID</span>
                          <span className="text-text-primary font-black font-mono">
                            {activeManager.eid}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary font-medium">Contact email</span>
                          <span className="text-text-primary font-bold font-mono text-[10px] truncate max-w-[160px]">
                            {activeManager.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="my-10 text-center">
                      <span className="text-2xl block mb-2">👑</span>
                      <p className="text-xs font-black text-text-primary">
                        Top of Organization Tree
                      </p>
                      <p className="text-[10px] text-text-secondary mt-1">
                        This profile represents a primary root node.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-6">
                  {activeManager ? (
                    <button
                      onClick={() => handlePivotProfile(activeManager.id)}
                      className="w-full py-2.5 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Pivot to Manager View ➔
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 bg-surface-card border border-border-accent text-text-tertiary text-xs font-black rounded-xl cursor-not-allowed opacity-50"
                    >
                      Pivot Restrained
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Elevated System Registry & Audit Logs (gated by isElevated) */}
            {isElevated && (
              <div className="bg-surface-card border border-red-500/30 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all animate-fadeIn">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] text-red-500 font-black uppercase tracking-wider px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse"></span>
                    Elevated System Registry & Audit Logs
                  </span>
                  <span className="text-[9px] text-text-tertiary font-mono">
                    Scope: Global Admin
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider mb-2">
                      System Registry Tools
                    </h4>
                    <div className="space-y-2">
                      <button
                        onClick={() => router.push("/")}
                        className="w-full p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent hover:border-red-500/30 rounded-xl flex items-center justify-between transition-all text-left cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-text-primary">
                            App Catalog Registry
                          </p>
                          <p className="text-[9px] text-text-secondary mt-0.5">
                            Manage application scopes, routing entry points, and policies.
                          </p>
                        </div>
                        <span>⚙️</span>
                      </button>
                      <button
                        onClick={() => (window.location.href = "http://localhost:3003/developer")}
                        className="w-full p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent hover:border-red-500/30 rounded-xl flex items-center justify-between transition-all text-left cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-text-primary">DevCenter Workspace</p>
                          <p className="text-[9px] text-text-secondary mt-0.5">
                            Register new micro-frontends, check tenant handshakes, and debug apps.
                          </p>
                        </div>
                        <span>🛠️</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider mb-2">
                      Live System Audit Logs
                    </h4>
                    <div className="bg-background-portal border border-border-accent/40 rounded-2xl p-3 h-28 overflow-y-auto font-mono text-[9px] text-text-secondary space-y-1.5">
                      <p className="text-green-400">
                        [SYSTEM] Session elevated to SuperAdmin scope for {initialData.user.name}
                      </p>
                      <p>
                        [INFO] Loaded 4 active micro-frontend app manifests from database registry
                      </p>
                      <p>
                        [INFO] Initialized roDb connection pool - character transaction read-only
                      </p>
                      <p>
                        [SECURITY] Entitlement check passed for forge-app-directory (user_id:{" "}
                        {initialData.user.id.substring(0, 8)}...)
                      </p>
                      <p className="text-amber-400">
                        [WARN] Token verification request: session cookie signature valid
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bento Row 2: Substructures (if pivoted or manager) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Peer List Preview */}
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-wide border-b border-border-accent/40 pb-3 mb-4 flex justify-between items-center">
                  <span>Peers Sharing Coordinates ({activePeers.length})</span>
                  <button
                    onClick={() => handleTabChange("team")}
                    className="text-[10px] text-brand-accent font-bold hover:underline"
                  >
                    View Full Team Circle
                  </button>
                </h3>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {activePeers.slice(0, 5).map((peer) => (
                    <div
                      key={peer.id}
                      onClick={() => handlePivotProfile(peer.id)}
                      className="p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent/40 hover:border-brand-accent/30 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center text-xs font-bold">
                          {peer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-text-primary leading-tight">
                            {peer.name}
                          </p>
                          <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5">
                            {peer.designation}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-text-secondary font-bold">
                        {peer.eid}
                      </span>
                    </div>
                  ))}
                  {activePeers.length === 0 && (
                    <p className="text-xs text-text-secondary italic py-4 text-center">
                      No peers located at this reporting coordinate
                    </p>
                  )}
                </div>
              </div>

              {/* Direct Reports List Preview */}
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-wide border-b border-border-accent/40 pb-3 mb-4 flex justify-between items-center">
                  <span>Direct Downline Node Reports ({activeReports.length})</span>
                  {activeReports.length > 0 && (
                    <span className="text-[9px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded font-black uppercase">
                      Manager Mode
                    </span>
                  )}
                </h3>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {activeReports.slice(0, 5).map((report) => (
                    <div
                      key={report.id}
                      onClick={() => handlePivotProfile(report.id)}
                      className="p-3 bg-background-portal/60 hover:bg-surface-elevated border border-border-accent/40 hover:border-brand-accent/30 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-surface-elevated text-text-secondary flex items-center justify-center text-xs font-bold">
                          {report.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-text-primary leading-tight">
                            {report.name}
                          </p>
                          <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5">
                            {report.designation}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-text-secondary font-bold">
                        {report.eid}
                      </span>
                    </div>
                  ))}
                  {activeReports.length === 0 && (
                    <p className="text-xs text-text-secondary italic py-4 text-center">
                      No direct reporting assignments discovered for this profile
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: My Team Focus Circle */}
        {activeTab === "team" && (
          <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
            {/* View Selector Toggle */}
            <div className="flex justify-between items-center border-b border-border-accent/40 pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Team Coordinates & Structure
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Explore reporting chains and org unit hierarchy
                </p>
              </div>

              <div className="flex bg-surface-card border border-border-accent/60 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTeamSubView("peers")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    teamSubView === "peers"
                      ? "bg-brand-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  👥 Peer Coordinates
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSubView("tree")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    teamSubView === "tree"
                      ? "bg-brand-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  🏢 Org Structure Tree
                </button>
              </div>
            </div>

            {teamSubView === "peers" ? (
              <>
                {/* Upstream Manager Card Block */}
                <div className="space-y-3">
                  <span className="text-[10px] text-text-tertiary font-black uppercase tracking-widest block text-center">
                    Upstream Node Coordinates
                  </span>

                  {activeManager ? (
                    <div className="bg-surface-card border-2 border-brand-accent/25 rounded-3xl p-6 max-w-xl mx-auto shadow-md hover:border-brand-accent transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-brand-muted border border-brand-accent/20 text-brand-accent flex items-center justify-center font-bold text-lg shadow-sm">
                          💼
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-text-primary truncate">
                            {activeManager.name}
                          </h4>
                          <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wide">
                            {activeManager.designation}
                          </p>
                          <span className="text-[9px] text-text-secondary font-mono">
                            {activeManager.eid} · {activeManager.email}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePivotProfile(activeManager.id)}
                        className="px-3.5 py-2 bg-surface-elevated hover:bg-brand-accent hover:text-white border border-border-accent hover:border-brand-accent text-[11px] font-black rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                      >
                        View Profile Circle
                      </button>
                    </div>
                  ) : (
                    <div className="bg-surface-card border border-border-accent/40 rounded-3xl p-6 max-w-xl mx-auto text-center">
                      <p className="text-xs font-black text-text-primary uppercase tracking-wider">
                        Top level node structural status
                      </p>
                      <p className="text-[10px] text-text-secondary mt-1">
                        This node reports directly to the Board of Directors.
                      </p>
                    </div>
                  )}
                </div>

                {/* Connected Active Circle Peer Matrix */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border-accent/40 pb-3.5">
                    <div>
                      <h3 className="text-base font-black text-text-primary">
                        Connected Peer Coordinates
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        All employees reporting to the same upline node
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-brand-muted border border-brand-accent/20 rounded-full text-xs font-black text-brand-accent">
                      {activePeers.length + 1} Total Members
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Highlight Self card in peers matrix */}
                    <div className="bg-gradient-to-br from-surface-card to-brand-muted/10 border-2 border-brand-accent rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 p-2.5">
                        <span className="px-2 py-0.5 bg-brand-accent text-white text-[8px] font-black uppercase rounded tracking-widest shadow-sm">
                          You
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-sm shadow">
                          {activeUser.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-text-primary leading-tight truncate">
                            {activeUser.name} (You)
                          </h4>
                          <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 truncate tracking-wide">
                            {activeUser.designation}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border-accent/60 pt-3 flex justify-between items-center text-[10px]">
                        <span className="text-text-secondary font-mono font-bold">
                          {activeUser.eid}
                        </span>
                        <span className="text-text-primary font-bold">
                          {activeUser.verticalName}
                        </span>
                      </div>
                    </div>

                    {/* Other Peers */}
                    {activePeers.map((peer) => (
                      <div
                        key={peer.id}
                        onClick={() => handlePivotProfile(peer.id)}
                        className="bg-surface-card border border-border-accent hover:border-brand-accent/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-xl bg-surface-elevated group-hover:bg-brand-muted text-text-secondary group-hover:text-brand-accent border border-border-accent/40 group-hover:border-brand-accent/20 flex items-center justify-center font-bold text-sm transition-all">
                            {peer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-text-primary leading-tight truncate group-hover:text-brand-accent transition-colors">
                              {peer.name}
                            </h4>
                            <p className="text-[9px] text-text-secondary font-medium uppercase mt-0.5 truncate tracking-wide">
                              {peer.designation}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-border-accent/40 pt-3 flex justify-between items-center text-[10px]">
                          <span className="text-text-secondary font-mono font-semibold">
                            {peer.eid}
                          </span>
                          <span className="text-text-primary font-bold">{peer.verticalName}</span>
                        </div>
                      </div>
                    ))}

                    {activePeers.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-surface-card/40 border border-dashed border-border-accent rounded-3xl">
                        <span className="text-3xl block mb-2">🔭</span>
                        <p className="text-xs font-black text-text-secondary uppercase">
                          No matching peers located
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-1">
                          This employee appears to be the sole node coordinate reporting to their
                          manager.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : /* Interactive Org Hierarchy Tree Sub-View */
            isHierarchyLoading && !orgHierarchy ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-text-secondary">
                  Loading organizational hierarchy tree...
                </p>
              </div>
            ) : (
              <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-lg overflow-x-auto min-h-[400px]">
                <div className="text-xs font-bold text-text-secondary mb-4 flex justify-between items-center">
                  <span>Company Node Hierarchy</span>
                  <button
                    type="button"
                    onClick={fetchHierarchyData}
                    className="px-3 py-1 bg-surface-elevated hover:bg-brand-muted border border-border-accent rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    🔄 Refresh Tree
                  </button>
                </div>

                <div className="tree-container">{renderOrgNodeTree(null)}</div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Redesigned Teams Org Directory */}
        {activeTab === "directory" && (
          <div className="animate-fadeIn">
            <EmployeesApp user={initialData.user} runQuery={runQuery} />
          </div>
        )}

        {/* Tab Content 4: Modular App Marketplace */}
        {activeTab === "apps" && (
          <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-accent/45 pb-3.5 gap-4">
              <div>
                <h3 className="text-base font-black text-text-primary font-sans">
                  Enterprise Applications Hub
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Explore active extensions, request new privileges, and track entitlements
                </p>
              </div>

              {/* Marketplace view toggles */}
              <div className="flex bg-surface-card border border-border-accent/60 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setMarketplaceSubTab("catalog")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    marketplaceSubTab === "catalog"
                      ? "bg-brand-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  🔌 App Catalog
                </button>
                <button
                  onClick={() => setMarketplaceSubTab("requests")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    marketplaceSubTab === "requests"
                      ? "bg-brand-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  📜 My Access Requests
                  {accessRequests.filter(
                    (r) => r.requesterId === initialData.user.id && r.status.startsWith("pending"),
                  ).length > 0 && (
                    <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse"></span>
                  )}
                </button>
                {initialData.directReports && initialData.directReports.length > 0 && (
                  <button
                    onClick={() => setMarketplaceSubTab("team-requests")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      marketplaceSubTab === "team-requests"
                        ? "bg-brand-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    👥 Team Requests
                    {accessRequests.filter(
                      (r) =>
                        r.requesterId !== initialData.user.id && r.status === "pending_manager",
                    ).length > 0 && (
                      <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse"></span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {isMarketplaceLoading && marketplaceApps.enabledApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-7 h-7 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-text-tertiary">Connecting to app registry engine...</p>
              </div>
            ) : marketplaceSubTab === "catalog" ? (
              <div className="space-y-10">
                {/* Category 1: Enabled Apps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-text-primary uppercase tracking-wider">
                      Installed / Active Applications
                    </span>
                    <span className="text-[9px] bg-success/10 border border-success/20 text-success px-2 py-0.5 rounded-full font-mono font-bold">
                      {marketplaceApps.enabledApps.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {marketplaceApps.enabledApps.map((app) => (
                      <div
                        key={app.id}
                        className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-brand-accent/20 transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="h-10 w-10 rounded-2xl bg-brand-muted border border-brand-accent/20 text-brand-accent flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-all">
                              {getAppIcon(app.icon)}
                            </span>
                            <span className="px-2.5 py-1 bg-success/15 border border-success/20 text-[9px] font-black text-success uppercase tracking-wider rounded-md">
                              Installed
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-text-primary">{app.name}</h4>
                          <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                            {app.description}
                          </p>

                          <div className="flex items-center gap-1.5 mt-4">
                            <span className="text-[8px] text-text-tertiary font-bold uppercase">
                              Targeting vertical:
                            </span>
                            <span className="text-[8px] bg-surface-elevated border border-border-accent px-1.5 py-0.5 rounded font-mono font-bold text-text-secondary">
                              {app.targetRules?.verticals?.join(", ") || "Global"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-6 flex flex-col gap-2">
                          <Link
                            href={`/apps/${app.id}`}
                            target={app.routingMode === "standalone" ? "_blank" : undefined}
                            className="w-full py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            Launch Application 🡥
                          </Link>
                          {app.entryUrl &&
                            (app.routingMode === "iframe" || app.entryUrl.startsWith("http")) && (
                              <a
                                href={app.entryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent text-text-primary text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Direct Webpage 🔗
                              </a>
                            )}
                        </div>
                      </div>
                    ))}

                    {marketplaceApps.enabledApps.length === 0 && (
                      <div className="col-span-full py-10 text-center bg-surface-card/20 border border-dashed border-border-accent rounded-3xl text-text-secondary text-xs italic">
                        No active applications provisioned to your profile.
                      </div>
                    )}
                  </div>
                </div>

                {/* Category 2: Requestable Apps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-text-primary uppercase tracking-wider">
                      Discoverable Extensions (Eligible)
                    </span>
                    <span className="text-[9px] bg-brand-accent/10 border border-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-mono font-bold">
                      {marketplaceApps.requestableApps.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {marketplaceApps.requestableApps.map((app) => (
                      <div
                        key={app.id}
                        className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="h-10 w-10 rounded-2xl bg-surface-elevated border border-border-accent/40 text-text-secondary flex items-center justify-center font-bold text-lg shadow-sm">
                              {getAppIcon(app.icon)}
                            </span>
                            {app.hasPendingRequest ? (
                              <span className="px-2.5 py-1 bg-warning/15 border border-warning/20 text-[9px] font-black text-warning-text uppercase tracking-wider rounded-md">
                                Pending Review
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-brand-muted border border-brand-accent/10 text-[9px] font-black text-brand-accent uppercase tracking-wider rounded-md">
                                Requestable
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-black text-text-primary">{app.name}</h4>
                          <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                            {app.description}
                          </p>

                          <div className="flex items-center gap-1.5 mt-4">
                            <span className="text-[8px] text-text-tertiary font-bold uppercase">
                              Designations:
                            </span>
                            <span
                              className="text-[8px] bg-surface-elevated border border-border-accent px-1.5 py-0.5 rounded font-mono font-bold text-text-secondary max-w-[200px] truncate"
                              title={app.targetRules?.designations?.join(", ") || "Any"}
                            >
                              {app.targetRules?.designations?.join(", ") || "Any"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-6">
                          {app.hasPendingRequest ? (
                            <button
                              disabled
                              className="w-full py-2 bg-surface-elevated/40 border border-border-accent/45 text-xs font-black text-text-tertiary rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              ⏳ Request Pending
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedRequestApp(app);
                                setShowRequestAccessModal(true);
                              }}
                              className="w-full py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/30 text-xs font-black text-text-primary rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              🔑 Request Access
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {marketplaceApps.requestableApps.length === 0 && (
                      <div className="col-span-full py-8 text-center bg-surface-card/10 border border-dashed border-border-accent/40 rounded-3xl text-text-tertiary text-xs italic">
                        No additional eligible applications discovered in the catalog.
                      </div>
                    )}
                  </div>
                </div>

                {/* Category 3: Unavailable Apps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-text-primary uppercase tracking-wider text-text-tertiary">
                      Unavailable extensions (Restricted)
                    </span>
                    <span className="text-[9px] bg-surface-elevated border border-border-accent/40 text-text-tertiary px-2 py-0.5 rounded-full font-mono font-bold">
                      {marketplaceApps.unavailableApps.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 opacity-60">
                    {marketplaceApps.unavailableApps.map((app) => (
                      <div
                        key={app.id}
                        className="bg-surface-card/60 border border-border-accent/40 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="h-10 w-10 rounded-2xl bg-surface-elevated border border-border-accent/20 text-text-tertiary flex items-center justify-center font-bold text-lg shadow-sm">
                              🔒
                            </span>
                            <span className="px-2.5 py-1 bg-surface-elevated border border-border-accent/60 text-[9px] font-black text-text-tertiary uppercase tracking-wider rounded-md">
                              Locked
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-text-secondary">{app.name}</h4>
                          <p className="text-[11px] text-text-tertiary mt-1.5 leading-relaxed">
                            {app.description}
                          </p>

                          <div className="space-y-2 mt-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] text-text-tertiary font-bold uppercase">
                                Required Level:
                              </span>
                              <span className="text-[8px] bg-surface-elevated border border-border-accent px-1.5 py-0.5 rounded font-mono font-bold text-text-tertiary">
                                L{app.targetRules?.minJobLevel || 1}+
                              </span>
                            </div>
                            {app.targetRules?.verticals && app.targetRules.verticals.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-text-tertiary font-bold uppercase">
                                  Vertical Target:
                                </span>
                                <span className="text-[8px] bg-surface-elevated border border-border-accent px-1.5 py-0.5 rounded font-mono font-bold text-text-tertiary max-w-[180px] truncate">
                                  {app.targetRules.verticals.join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-6">
                          <button
                            disabled
                            className="w-full py-2 bg-surface-elevated/40 border border-border-accent/40 text-xs font-black text-text-tertiary rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            Restricted Targeting Rules
                          </button>
                        </div>
                      </div>
                    ))}

                    {marketplaceApps.unavailableApps.length === 0 && (
                      <div className="col-span-full py-6 text-center bg-surface-card/5 border border-dashed border-border-accent/20 rounded-3xl text-text-tertiary text-xs italic">
                        No restricted applications discovered.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : marketplaceSubTab === "requests" ? (
              /* Sub-tab: My Access Requests */
              <div className="bg-surface-card border border-border-accent rounded-3xl shadow-lg overflow-hidden animate-fadeIn">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-accent bg-surface-card/10 text-text-tertiary font-bold uppercase tracking-wider">
                        <th className="p-4 w-44">App / Requested On</th>
                        <th className="p-4">Reason / Justification</th>
                        <th className="p-4 w-32">Scope</th>
                        <th className="p-4 w-44">Status</th>
                        <th className="p-4 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-accent/40">
                      {accessRequests
                        .filter((req) => req.requesterId === initialData.user.id)
                        .map((req) => {
                          let statusClass =
                            "bg-surface-elevated text-text-secondary border-border-accent";
                          let statusLabel = req.status;

                          if (req.status.startsWith("pending")) {
                            statusClass = "bg-warning/10 border-warning/20 text-warning-text";
                            statusLabel = "Pending Review";
                          } else if (req.status === "approved") {
                            statusClass = "bg-success/15 border-success/20 text-success";
                            statusLabel = "Approved";
                          } else if (req.status === "rejected") {
                            statusClass = "bg-danger/15 border-danger/20 text-danger";
                            statusLabel = "Rejected";
                          }

                          return (
                            <tr key={req.id} className="hover:bg-surface-card/20 transition-colors">
                              <td className="p-4">
                                <span className="font-bold text-text-primary text-sm block">
                                  {req.appName}
                                </span>
                                <span className="text-[10px] text-text-tertiary block mt-0.5">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-4 text-[11px] text-text-secondary leading-relaxed max-w-xs break-words">
                                "{req.reason}"
                              </td>
                              <td className="p-4 font-mono text-[10px] uppercase">
                                <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-accent text-text-secondary font-bold">
                                  {req.scope}
                                </span>
                                {req.targetEntityId && (
                                  <span
                                    className="text-[9px] text-text-tertiary block mt-1 truncate max-w-[100px]"
                                    title={req.targetEntityId}
                                  >
                                    ID: {req.targetEntityId}
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="p-4">
                                <button
                                  onClick={() => {
                                    setSelectedTicket(req);
                                    fetchTicketMessages(req.id);
                                  }}
                                  className="px-2.5 py-1 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white border border-brand-accent/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  💬 View Ticket
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {accessRequests.filter((req) => req.requesterId === initialData.user.id)
                        .length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-text-secondary italic">
                            You have not submitted any access requests yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Sub-tab: Team Access Requests */
              <div className="bg-surface-card border border-border-accent rounded-3xl shadow-lg overflow-hidden animate-fadeIn">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-accent bg-surface-card/10 text-text-tertiary font-bold uppercase tracking-wider">
                        <th className="p-4 w-44">Requester / Date</th>
                        <th className="p-4 w-44">App</th>
                        <th className="p-4">Reason / Justification</th>
                        <th className="p-4 w-32">Scope</th>
                        <th className="p-4 w-44">Status</th>
                        <th className="p-4 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-accent/40">
                      {accessRequests
                        .filter((req) => req.requesterId !== initialData.user.id)
                        .map((req) => {
                          let statusClass =
                            "bg-surface-elevated text-text-secondary border-border-accent";
                          let statusLabel = req.status;

                          if (req.status === "pending_manager") {
                            statusClass = "bg-warning/15 border-warning/20 text-warning-text";
                            statusLabel = "Pending Your Review";
                          } else if (
                            req.status === "pending_app_admin" ||
                            req.status === "pending_super_admin"
                          ) {
                            statusClass =
                              "bg-brand-accent/10 border-brand-accent/20 text-brand-accent";
                            statusLabel = "Pending Admin Review";
                          } else if (req.status === "approved") {
                            statusClass = "bg-success/15 border-success/20 text-success";
                            statusLabel = "Approved";
                          } else if (req.status === "rejected") {
                            statusClass = "bg-danger/15 border-danger/20 text-danger";
                            statusLabel = "Rejected";
                          }

                          return (
                            <tr key={req.id} className="hover:bg-surface-card/20 transition-colors">
                              <td className="p-4">
                                <span className="font-bold text-text-primary text-sm block">
                                  {req.requesterName}
                                </span>
                                <span className="text-[10px] text-text-tertiary block mt-0.5">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-4 font-bold text-text-primary text-sm">
                                {req.appName}
                              </td>
                              <td className="p-4 text-[11px] text-text-secondary leading-relaxed max-w-xs break-words">
                                "{req.reason}"
                              </td>
                              <td className="p-4 font-mono text-[10px] uppercase">
                                <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-accent text-text-secondary font-bold">
                                  {req.scope}
                                </span>
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="p-4">
                                <button
                                  onClick={() => {
                                    setSelectedTicket(req);
                                    fetchTicketMessages(req.id);
                                  }}
                                  className="px-2.5 py-1 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white border border-brand-accent/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  {req.status === "pending_manager"
                                    ? "⚡ Review & Chat"
                                    : "💬 View Ticket"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {accessRequests.filter((req) => req.requesterId !== initialData.user.id)
                        .length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-text-secondary italic">
                            No team access requests found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Developer Link Section */}
            <div className="bg-surface-card border border-border-accent/40 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">
                  Internal Developer Framework
                </h4>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Want to plug a custom tool or application? Create a new module folder under{" "}
                  <code className="bg-surface-elevated px-1.5 py-0.5 rounded border border-border-accent text-[9px] font-mono text-brand-accent">
                    /src/apps/
                  </code>{" "}
                  and register config.
                </p>
              </div>

              <Link
                href="https://github.com/google"
                target="_blank"
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/30 text-xs font-black rounded-xl transition-all shadow-sm flex-shrink-0 cursor-pointer text-center text-text-primary"
              >
                View Developer Boilerplate Docs
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ─── DIGITAL VERIFICATION MODAL ─── */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-modal-overlay backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            <div className="p-6 border-b border-border-accent/40 flex justify-between items-center">
              <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                Cryptographic Badge
              </span>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="text-xs hover:text-brand-accent font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 text-center space-y-5">
              <div className="h-16 w-16 bg-gradient-to-tr from-brand-accent to-success rounded-full flex items-center justify-center mx-auto text-xl shadow-lg animate-pulse">
                🛡️
              </div>
              <div>
                <h4 className="text-sm font-black text-text-primary">{activeUser.name}</h4>
                <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5">
                  {activeUser.designation}
                </p>
                <p className="text-[9px] text-text-secondary font-mono mt-1">
                  EID ID: {activeUser.eid}
                </p>
              </div>

              {/* Mock verification JWT */}
              <div className="bg-background-portal border border-border-accent/60 rounded-xl p-3.5 text-left space-y-2">
                <span className="text-[8px] text-text-tertiary font-black uppercase tracking-wider block">
                  Decoded Token Payload
                </span>
                <pre className="text-[9px] font-mono text-text-secondary overflow-x-auto p-1.5 bg-surface-elevated/50 rounded border border-border-accent/30 leading-tight">
                  {`{
  "iss": "acme-corp-auth",
  "sub": "${activeUser.id}",
  "eid": "${activeUser.eid}",
  "name": "${activeUser.name}",
  "role": "${activeUser.role}",
  "dept": "${activeUser.verticalName}",
  "iat": ${Math.floor(Date.now() / 1000)},
  "verified": true
}`}
                </pre>
              </div>

              <span className="text-[8px] text-text-tertiary italic block">
                Verified securely using SHA-256 digital signature structure
              </span>
            </div>

            <div className="p-5 border-t border-border-accent/40 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        iss: "acme-corp-auth",
                        sub: activeUser.id,
                        eid: activeUser.eid,
                        name: activeUser.name,
                        role: activeUser.role,
                        dept: activeUser.verticalName,
                        iat: Math.floor(Date.now() / 1000),
                        verified: true,
                      },
                      null,
                      2,
                    ),
                  );
                  alert("Token copied to clipboard!");
                }}
                className="flex-1 py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-colors shadow"
              >
                Copy Claims JSON
              </button>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent text-xs font-bold rounded-xl transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUDO ELEVATION MODAL ─── */}
      {showSudoModal && (
        <div className="fixed inset-0 z-50 bg-modal-overlay backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            <div className="p-6 border-b border-border-accent/40 flex justify-between items-center">
              <span className="text-[9px] text-danger font-black uppercase tracking-wider px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                🔑 Sudo Session Elevation
              </span>
              <button
                onClick={() => setShowSudoModal(false)}
                className="text-xs hover:text-danger font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSudo} className="p-6 space-y-5">
              <div className="h-16 w-16 bg-gradient-to-tr from-danger to-amber-500 rounded-full flex items-center justify-center mx-auto text-xl shadow-lg shadow-danger/15 animate-bounce">
                🔑
              </div>

              <div className="text-center">
                <h4 className="text-sm font-black text-text-primary">
                  MFA Passkey / TOTP Verification
                </h4>
                <p className="text-[10px] text-text-secondary mt-1 leading-normal">
                  You are attempting to access system administration tools. Enter your 6-digit
                  verification code to confirm elevation.
                </p>
                <p className="text-[9px] text-brand-accent font-bold mt-1.5">
                  (For testing, use code:{" "}
                  <code className="bg-brand-muted px-1.5 py-0.5 rounded font-mono">123456</code>)
                </p>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-background-portal border border-border-accent focus:border-danger rounded-xl p-3 text-center text-lg font-black tracking-widest text-text-primary outline-none transition-all shadow-inner"
                  required
                />
                {sudoError && (
                  <p className="text-[10px] text-danger font-bold text-center mt-1.5 animate-pulse">
                    ⚠️ {sudoError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSudoModal(false)}
                  className="flex-1 py-2.5 bg-surface-elevated hover:bg-surface-card border border-border-accent rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 text-white rounded-xl text-xs font-black hover:brightness-110 shadow-md cursor-pointer"
                >
                  Elevate Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DEPARTMENT SCOPE MODAL ─── */}
      {showVerticalScopeModal && (
        <div className="fixed inset-0 z-50 bg-modal-overlay backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            <div className="p-6 border-b border-border-accent/40 flex justify-between items-center">
              <span className="text-[9px] text-brand-accent font-black uppercase tracking-wider px-2.5 py-1 bg-brand-muted border border-brand-accent/10 rounded-full">
                Department Vertical scope
              </span>
              <button
                onClick={() => setShowVerticalScopeModal(false)}
                className="text-xs hover:text-brand-accent font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center py-2">
                <span className="text-3xl block mb-2">🏢</span>
                <h4 className="text-base font-black text-text-primary">
                  {activeUser.verticalName} Vertical
                </h4>
                <p className="text-[10px] text-brand-accent font-extrabold uppercase mt-0.5">
                  Corporate organizational unit
                </p>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Assigned Members</span>
                  <span className="text-text-primary font-black">
                    {
                      initialData.allUsers.filter((u) => u.verticalName === activeUser.verticalName)
                        .length
                    }{" "}
                    active employees
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Designation Levels</span>
                  <span className="text-text-primary font-bold">
                    {
                      Array.from(
                        new Set(
                          initialData.allUsers
                            .filter((u) => u.verticalName === activeUser.verticalName)
                            .map((u) => u.designation),
                        ),
                      ).length
                    }{" "}
                    Roles
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-accent/30 pb-2">
                  <span className="text-text-secondary font-medium">Hierarchy Structure</span>
                  <span className="text-text-primary font-bold">
                    Autonomous reporting coordinates
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-text-tertiary font-black uppercase tracking-wider block">
                    Department Overview
                  </span>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    The {activeUser.verticalName} Vertical is a core unit designed to coordinate and
                    scale specific mission-critical corporate operations. The department is
                    structured hierarchically to maintain zero communications lag.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border-accent/40 flex justify-end">
              <button
                onClick={() => setShowVerticalScopeModal(false)}
                className="px-6 py-2 bg-brand-accent text-white hover:bg-brand-hover text-xs font-black rounded-xl transition-colors shadow"
              >
                Close Scope Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── GLOBAL OMNI-SEARCH BACKDROP MODAL (Cmd+K) ─── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-modal-overlay backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
            {/* Search input box */}
            <div className="p-5 border-b border-border-accent/40 flex items-center gap-3">
              <span className="text-base">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find peers by name, EID, or designation..."
                className="flex-1 bg-transparent text-text-primary placeholder-text-secondary focus:outline-none font-bold text-sm"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="px-2 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent text-[9px] text-text-secondary font-bold uppercase rounded-lg"
              >
                Esc
              </button>
            </div>

            {/* Search Results list */}
            <div className="p-5 max-h-[300px] overflow-y-auto space-y-4">
              {!searchQuery && (
                <div className="text-center py-6 text-text-secondary space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider text-text-tertiary">
                    Quick Search Tips
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Type to match names (e.g. "Smith"), EID codes (e.g. "E0005"), or designations
                    (e.g. "Engineer").
                  </p>
                </div>
              )}

              {searchQuery &&
                filteredSearchUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      handlePivotProfile(u.id);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="p-3 bg-background-portal hover:bg-brand-muted border border-border-accent/40 hover:border-brand-accent/20 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-xs">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-primary leading-tight group-hover:text-brand-accent transition-colors">
                          {u.name}
                        </p>
                        <p className="text-[9px] text-brand-accent font-extrabold uppercase mt-0.5 tracking-wide">
                          {u.designation} ·{" "}
                          <span className="text-text-tertiary font-bold">{u.verticalName}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-text-secondary">
                      {u.eid}
                    </span>
                  </div>
                ))}

              {searchQuery && filteredSearchUsers.length === 0 && (
                <p className="text-xs text-text-secondary italic text-center py-6">
                  No organizational peers match "{searchQuery}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Request Modal */}
      {showRequestAccessModal && selectedRequestApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-accent bg-surface-card/10 flex items-center justify-between">
              <h3 className="font-black text-xs uppercase tracking-wider text-text-primary">
                Request Application Access
              </h3>
              <button
                onClick={() => {
                  setShowRequestAccessModal(false);
                  setRequestError("");
                }}
                className="text-text-tertiary hover:text-text-primary text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRequestAccessSubmit} className="p-5 space-y-4 text-xs">
              {requestError && (
                <div className="p-3 bg-danger/15 border border-danger/20 text-danger rounded-xl text-[10px] font-bold font-mono">
                  [ERROR] {requestError}
                </div>
              )}

              <div className="flex items-center gap-3 bg-surface-elevated/40 border border-border-accent/40 p-3 rounded-2xl">
                <span className="text-2xl">{getAppIcon(selectedRequestApp.icon)}</span>
                <div>
                  <h4 className="font-bold text-text-primary text-xs">{selectedRequestApp.name}</h4>
                  <p className="text-[10px] text-text-secondary">
                    {selectedRequestApp.description}
                  </p>
                </div>
              </div>

              {/* Simulated Real-Time Compliance & Risk Analyzer */}
              {(() => {
                const isHighRisk =
                  selectedRequestApp.name.toLowerCase().includes("ledger") ||
                  selectedRequestApp.name.toLowerCase().includes("finance") ||
                  selectedRequestApp.name.toLowerCase().includes("provisioning") ||
                  selectedRequestApp.name.toLowerCase().includes("admin");

                const isMediumRisk =
                  selectedRequestApp.name.toLowerCase().includes("profile") ||
                  selectedRequestApp.name.toLowerCase().includes("directory");

                let riskScore = 45;
                let riskLabel = "Medium Risk";
                let riskColor = "text-warning border-warning/30 bg-warning/5";

                if (isHighRisk) {
                  riskScore = 82;
                  riskLabel = "High Risk (Sox/Fin)";
                  riskColor = "text-danger border-danger/30 bg-danger/5 animate-pulse";
                } else if (!isMediumRisk) {
                  riskScore = 15;
                  riskLabel = "Low Risk";
                  riskColor = "text-success border-success/30 bg-success/5";
                }

                return (
                  <div
                    className={`p-3 border rounded-2xl flex items-center justify-between text-[11px] ${riskColor}`}
                  >
                    <div className="space-y-0.5">
                      <span className="font-black uppercase tracking-wider block text-[9px]">
                        2026 AI Risk Guard
                      </span>
                      <p className="text-text-secondary">
                        App Class: <span className="font-bold text-text-primary">{riskLabel}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black font-mono">{riskScore}/100</span>
                      <p className="text-[9px] text-text-tertiary">Risk Score</p>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                  Reason / Justification
                </label>
                <textarea
                  required
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Explain why you require access to this extension..."
                  className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none resize-none leading-relaxed text-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                    Entitlement Scope
                  </label>
                  <select
                    value={requestScope}
                    onChange={(e) => setRequestScope(e.target.value as any)}
                    className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold text-text-primary"
                  >
                    <option value="individual">Individual (Just for me)</option>
                    <option value="project">Project / Workspace</option>
                    <option value="org_node">Department / Team Node</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                    Access Duration
                  </label>
                  <select
                    value={isTemporaryAccess ? temporaryDuration : "permanent"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "permanent") {
                        setIsTemporaryAccess(false);
                      } else {
                        setIsTemporaryAccess(true);
                        setTemporaryDuration(val);
                      }
                    }}
                    className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold text-text-primary"
                  >
                    <option value="permanent">Permanent Grant</option>
                    <option value="8h">Temporary: 8 Hours</option>
                    <option value="24h">Temporary: 24 Hours</option>
                    <option value="7d">Temporary: 7 Days</option>
                    <option value="30d">Temporary: 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Break-glass Toggle Option */}
              <div className="flex items-center justify-between p-3 bg-surface-elevated/30 border border-border-accent/40 rounded-2xl">
                <div className="space-y-0.5 pr-2">
                  <label className="text-[9px] font-black uppercase text-text-primary flex items-center gap-1.5">
                    🚨 Emergency Break-Glass
                  </label>
                  <p className="text-[9px] text-text-secondary">
                    Bypasses standard scheduling triggers. High priority incident logging active.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isBreakGlassAccess}
                  onChange={(e) => setIsBreakGlassAccess(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-accent focus:ring-brand-accent bg-background-portal border-input-border cursor-pointer"
                />
              </div>

              {requestScope !== "individual" && (
                <div className="animate-fadeIn">
                  <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                    {requestScope === "project"
                      ? "Select Target Project"
                      : "Select Target Department / Team"}
                  </label>
                  {requestScope === "project" ? (
                    availableProjects.length === 0 ? (
                      <p className="text-[10px] text-text-secondary italic">
                        No active projects available to select.
                      </p>
                    ) : (
                      <select
                        required
                        value={requestTargetEntityId}
                        onChange={(e) => setRequestTargetEntityId(e.target.value)}
                        className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold text-text-primary"
                      >
                        {availableProjects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name} ({proj.code})
                          </option>
                        ))}
                      </select>
                    )
                  ) : availableNodes.length === 0 ? (
                    <p className="text-[10px] text-text-secondary italic">
                      No organizational nodes available to select.
                    </p>
                  ) : (
                    <select
                      required
                      value={requestTargetEntityId}
                      onChange={(e) => setRequestTargetEntityId(e.target.value)}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold text-text-primary"
                    >
                      {availableNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} [{node.type.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-border-accent/40 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestAccessModal(false);
                    setRequestError("");
                  }}
                  className="px-4 py-2 border border-border-accent rounded-xl text-xs hover:bg-background-portal text-text-secondary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-5 py-2 bg-brand-accent hover:bg-brand-hover disabled:opacity-40 text-white font-bold text-xs uppercase rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Details & Discussion Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] max-h-[700px]">
            {/* Left Column: Metadata & Approvals */}
            <div className="w-full md:w-2/5 border-r border-border-accent/40 bg-surface-card/10 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-text-tertiary bg-surface-elevated border border-border-accent/60 px-2 py-0.5 rounded">
                    Ticket #{selectedTicket.id.split("-")[0]}
                  </span>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-text-tertiary hover:text-text-primary text-sm font-bold md:hidden"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-surface-elevated/40 border border-border-accent/30 p-4 rounded-2xl">
                  <span className="text-3xl">🔑</span>
                  <div>
                    <h4 className="font-bold text-text-primary text-xs">
                      {selectedTicket.appName}
                    </h4>
                    <p className="text-[10px] text-text-secondary">Access Entitlement Request</p>
                  </div>
                </div>

                {/* 2026 Enterprise Workflow Progress Checklist */}
                <div className="bg-background-portal/50 border border-border-accent/40 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] font-black uppercase text-brand-accent tracking-wider block">
                    Approval Pipeline State
                  </span>
                  <div className="space-y-2.5 text-[10px]">
                    {[
                      { label: "Submitted", isDone: true, isActive: false },
                      {
                        label: "Manager Review",
                        isDone: selectedTicket.status !== "pending_manager",
                        isActive: selectedTicket.status === "pending_manager",
                      },
                      {
                        label: "Security Verification",
                        isDone: ["pending_super_admin", "approved"].includes(selectedTicket.status),
                        isActive: selectedTicket.status === "pending_app_admin",
                      },
                      {
                        label: "App Admin Signoff",
                        isDone: ["pending_super_admin", "approved"].includes(selectedTicket.status),
                        isActive: selectedTicket.status === "pending_app_admin",
                      },
                      {
                        label: "Super Admin Signoff",
                        isDone: selectedTicket.status === "approved",
                        isActive: selectedTicket.status === "pending_super_admin",
                      },
                      {
                        label: "Auto-Provisioned",
                        isDone: selectedTicket.status === "approved",
                        isActive: false,
                        isError: selectedTicket.status === "rejected",
                      },
                    ].map((step, idx) => {
                      let dotColor = "bg-text-tertiary/40";
                      let textColor = "text-text-tertiary";
                      if (step.isDone) {
                        dotColor = "bg-success shadow-[0_0_8px_rgba(46,204,113,0.5)]";
                        textColor = "text-text-primary font-bold";
                      } else if (step.isActive) {
                        dotColor =
                          "bg-brand-accent animate-ping shadow-[0_0_8px_rgba(108,92,231,0.5)]";
                        textColor = "text-brand-accent font-black";
                      } else if (step.isError) {
                        dotColor = "bg-danger shadow-[0_0_8px_rgba(235,77,75,0.5)]";
                        textColor = "text-danger font-bold";
                      }

                      return (
                        <div key={idx} className="flex items-center gap-2.5">
                          <div className="relative flex items-center justify-center">
                            {step.isActive && (
                              <div className="absolute w-2 h-2 rounded-full bg-brand-accent/50 animate-ping"></div>
                            )}
                            <div
                              className={`w-2 h-2 rounded-full ${step.isActive ? "bg-brand-accent" : dotColor}`}
                            ></div>
                          </div>
                          <span className={textColor}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Requester
                    </span>
                    <p className="font-bold text-text-primary">{selectedTicket.requesterName}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      ID: {selectedTicket.requesterId}
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Risk Profile
                    </span>
                    {(() => {
                      const isHigh =
                        selectedTicket.appName.toLowerCase().includes("ledger") ||
                        selectedTicket.appName.toLowerCase().includes("finance") ||
                        selectedTicket.appName.toLowerCase().includes("admin");

                      const isMed =
                        selectedTicket.appName.toLowerCase().includes("profile") ||
                        selectedTicket.appName.toLowerCase().includes("directory");

                      if (isHigh) {
                        return (
                          <span className="px-2 py-0.5 rounded bg-danger/15 border border-danger/30 text-danger text-[9px] font-mono font-black uppercase">
                            🚨 High Risk (Fin/SOX)
                          </span>
                        );
                      } else if (isMed) {
                        return (
                          <span className="px-2 py-0.5 rounded bg-warning/15 border border-warning/30 text-warning text-[9px] font-mono font-black uppercase">
                            ⚠️ Medium Risk
                          </span>
                        );
                      } else {
                        return (
                          <span className="px-2 py-0.5 rounded bg-success/15 border border-success/30 text-success text-[9px] font-mono font-black uppercase">
                            ✅ Low Risk
                          </span>
                        );
                      }
                    })()}
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Scope / Target
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-accent text-text-secondary font-mono font-bold uppercase text-[9px]">
                      {selectedTicket.scope}
                    </span>
                    {selectedTicket.targetEntityId && (
                      <p className="text-[10px] text-text-tertiary font-mono mt-1 select-all">
                        Target ID: {selectedTicket.targetEntityId}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Status
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                        selectedTicket.status.startsWith("pending")
                          ? "bg-warning/15 border-warning/20 text-warning-text"
                          : selectedTicket.status === "approved"
                            ? "bg-success/15 border-success/20 text-success"
                            : "bg-danger/15 border-danger/20 text-danger"
                      }`}
                    >
                      {selectedTicket.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Submitted Reason
                    </span>
                    <div className="p-3 bg-surface-elevated/30 border border-border-accent/30 rounded-xl text-[11px] leading-relaxed text-text-secondary italic">
                      "{selectedTicket.reason}"
                    </div>
                  </div>
                </div>
              </div>

              {/* Reviewer Action Controls (For Managers) */}
              {selectedTicket.status === "pending_manager" &&
                selectedTicket.requesterId !== initialData.user.id && (
                  <div className="mt-6 pt-6 border-t border-border-accent/40 space-y-3">
                    <div className="p-3 bg-warning/10 border border-warning/25 rounded-2xl text-[10px] text-warning-text leading-relaxed font-bold">
                      ⚡ Manager Action Required: You are the designated manager for this requester.
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                        Manager Review Notes
                      </label>
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add manager review feedback (optional)..."
                        className="w-full px-2.5 py-1.5 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl text-[11px] resize-none outline-none text-text-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewTicket("rejected")}
                        disabled={isReviewing}
                        className="flex-1 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 hover:border-danger/30 rounded-xl font-black text-[10px] uppercase transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReviewTicket("approved")}
                        disabled={isReviewing}
                        className="flex-1 py-1.5 bg-success/15 hover:bg-success/25 text-success border border-success/20 hover:border-success/35 rounded-xl font-black text-[10px] uppercase transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                )}
            </div>

            {/* Right Column: Chat/Messages Timeline Thread */}
            <div className="flex-1 flex flex-col justify-between p-6 h-full min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border-accent/40 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">💬</span>
                  <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider">
                    Discussion Ticket Thread
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/30 text-[10px] font-black rounded-lg text-text-secondary transition-all cursor-pointer hidden md:block"
                >
                  ✕ Close Ticket
                </button>
              </div>

              {/* Scrollable chat body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 text-xs">
                {isMessagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-2 py-20">
                    <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] text-text-tertiary">Loading ticket logs...</p>
                  </div>
                ) : ticketMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center text-text-tertiary italic">
                    <span>📣</span>
                    <p className="text-[10px] mt-1">No ticket activity logs or messages yet.</p>
                    <p className="text-[9px] mt-0.5">
                      Use the input below to leave questions or notes.
                    </p>
                  </div>
                ) : (
                  ticketMessages.map((msg: any) => {
                    let roleBadgeClass = "bg-surface-elevated text-text-secondary";
                    if (msg.senderRole === "super_admin")
                      roleBadgeClass = "bg-danger/10 border border-danger/20 text-danger";
                    else if (msg.senderRole === "app_admin")
                      roleBadgeClass = "bg-success/15 border border-success/20 text-success";
                    else if (msg.senderRole === "manager")
                      roleBadgeClass = "bg-warning/15 border border-warning/20 text-warning-text";
                    else if (msg.senderRole === "user")
                      roleBadgeClass =
                        "bg-brand-accent/15 border border-brand-accent/20 text-brand-accent";

                    return (
                      <div
                        key={msg.id}
                        className="flex flex-col space-y-1 bg-surface-elevated/20 border border-border-accent/30 p-3 rounded-2xl animate-fadeIn"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-text-primary text-[10px]">
                              {msg.senderName}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${roleBadgeClass}`}
                            >
                              {msg.senderRole}
                            </span>
                          </div>
                          <span className="text-[8px] text-text-tertiary">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap mt-1">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input box */}
              <div className="mt-4 pt-4 border-t border-border-accent/40 flex items-center gap-2">
                <textarea
                  rows={2}
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a message or request details..."
                  className="flex-1 px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl text-xs resize-none outline-none text-text-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessageText.trim()}
                  className="px-4 py-2.5 bg-brand-accent hover:bg-brand-hover disabled:opacity-40 text-white font-bold text-[10px] uppercase rounded-xl transition-all shadow-md cursor-pointer h-full"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-55 bg-surface-card border border-border-accent rounded-2xl px-5 py-3 shadow-2xl animate-fadeIn flex items-center gap-3">
          <span className={toastMessage.type === "success" ? "text-success" : "text-danger"}>
            {toastMessage.type === "success" ? "✓" : "⚠"}
          </span>
          <span className="text-xs font-bold text-text-primary">{toastMessage.text}</span>
        </div>
      )}
    </AppShell>
  );
}
