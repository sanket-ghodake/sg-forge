"use client";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

interface AdminPanelProps {
  session: any;
  users: any[];
  metadata: any[];
  systemLogs: any[];
  simulatedRole: string;
  loadWorkspaceData?: () => Promise<void>;
  // CSV Ingestion
  csvRawText: string;
  parsedRows: any[];
  validationErrors: { [k: number]: string[] };
  showErrorDrawer: boolean;
  commitLoading: boolean;
  setCsvRawText: (v: string) => void;
  handleCsvUpload: (text: string) => void;
  handleCellEdit: (i: number, f: string, v: string) => void;
  handleCommitIngest: () => void;
  handleRemoveRow?: (rowIndex: number) => void;
  setParsedRows: (v: any[]) => void;
  setShowErrorDrawer: (v: boolean) => void;
  // Metadata
  selectedMetaType: "vertical" | "job_level";
  metaNameInput: string;
  metaParentInput: string;
  setSelectedMetaType: (v: "vertical" | "job_level") => void;
  setMetaNameInput: (v: string) => void;
  setMetaParentInput: (v: string) => void;
  handleAddMetadata: (e: React.FormEvent) => void;
  handleMetadataReorder: (id: string, dir: "up" | "down") => void;
  handleMetadataDelete: (id: string) => void;
  sub?: "dashboard" | "users" | "metadata" | "access" | "database" | "logs" | "apps";
  onSubChange?: (
    v: "dashboard" | "users" | "metadata" | "access" | "database" | "logs" | "apps",
  ) => void;
  hideSidebar?: boolean;
}

export default function AdminPanel({
  session,
  users,
  metadata,
  systemLogs,
  simulatedRole,
  loadWorkspaceData,
  csvRawText,
  parsedRows,
  validationErrors,
  showErrorDrawer,
  commitLoading,
  setCsvRawText,
  handleCsvUpload,
  handleCellEdit,
  handleCommitIngest,
  handleRemoveRow,
  setParsedRows,
  setShowErrorDrawer,
  selectedMetaType,
  metaNameInput,
  metaParentInput,
  setSelectedMetaType,
  setMetaNameInput,
  setMetaParentInput,
  handleAddMetadata,
  handleMetadataReorder,
  handleMetadataDelete,
  sub: propSub,
  onSubChange,
  hideSidebar = false,
}: AdminPanelProps) {
  // ─── NAV NAVIGATION STATE ───
  const [subInternal, setSubInternal] = useState<
    "dashboard" | "users" | "metadata" | "access" | "database" | "logs" | "apps"
  >("dashboard");
  const sub = propSub || subInternal;
  const setSub = (newSub: any) => {
    setSubInternal(newSub);
    if (onSubChange) {
      onSubChange(newSub);
    }
  };

  useEffect(() => {
    if (propSub) {
      setSubInternal(propSub);
    }
  }, [propSub]);

  // ─── LAYOUT RESIZING STATES ───
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [metaSplitWidth, setMetaSplitWidth] = useState(380);
  const [metaLeftMinimized, setMetaLeftMinimized] = useState(false);

  const [accessSplitWidth, setAccessSplitWidth] = useState(300);

  const [dbSplitWidth, setDbSplitWidth] = useState(300);
  const [dbSchemaMinimized, setDbSchemaMinimized] = useState(false);
  const [dbEditorHeight, setDbEditorHeight] = useState(220);

  const [logDrawerWidth, setLogDrawerWidth] = useState(450);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const [ingestDrawerWidth, setIngestDrawerWidth] = useState(650);

  // ─── ASYNC STATE SKELETONS ───
  const [isDataRefreshing, setIsDataRefreshing] = useState(false);

  // ─── GLOBAL NOTIFICATION TOAST STATE ───
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── DIRECTORY FILTER & SELECTION STATES ───
  const [userSearch, setUserSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // 'active' (password setup done) or 'pending' (default password)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // ─── ADD/EDIT SINGLE USER STATES ───
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"add" | "edit">("add");
  const [userForm, setUserForm] = useState({
    id: "",
    eid: "",
    name: "",
    email: "",
    role: "user",
    designationId: "",
    verticalId: "",
    managerId: "",
  });
  const [userModalError, setUserModalError] = useState("");
  const [userModalLoading, setUserModalLoading] = useState(false);

  // ─── BULK INGESTION BATCH & MATRIX STATES ───
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestBatchProgress, setIngestBatchProgress] = useState(0);
  const [_isIngestingRows, setIsIngestingRows] = useState(false);
  const [ingestStatusLogs, setIngestStatusLogs] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [ingestInputMethod, setIngestInputMethod] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");

  const liveParseResult = useMemo(() => {
    if (!pasteText.trim()) return null;
    const text = pasteText.trim();
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const count = Array.isArray(parsed) ? parsed.length : 1;
        return {
          valid: true,
          type: "JSON",
          count,
          message: `Valid JSON array found (${count} records)`,
        };
      } catch (e: any) {
        return { valid: false, type: "JSON", message: `Malformed JSON: ${e.message}` };
      }
    } else {
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return {
          valid: false,
          type: "CSV",
          message: "CSV requires a header line and at least one data row",
        };
      }
      return {
        valid: true,
        type: "CSV",
        count: lines.length - 1,
        message: `CSV detected (${lines.length - 1} records)`,
      };
    }
  }, [pasteText]);

  useEffect(() => {
    if (sub !== "users" || !showErrorDrawer || parsedRows.length > 0) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT");
      if (isInput && activeEl.id !== "global-ingest-paste-textarea") {
        return;
      }

      const pastedText = e.clipboardData?.getData("text");
      if (pastedText) {
        e.preventDefault();
        handleCsvUpload(pastedText);
        simulateIngestionBatchLogs();
        showToast("Clipboard data parsed and loaded successfully!", "success");
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [
    sub,
    showErrorDrawer,
    parsedRows.length,
    handleCsvUpload,
    simulateIngestionBatchLogs,
    showToast,
  ]);

  // ─── HIERARCHY TREE STATES ───
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);
  const [inlineAddName, setInlineAddName] = useState("");

  // ─── ACCESS CONTROL STATES ───
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [permissionsMatrix, setPermissionsMatrix] = useState<
    Record<string, Record<string, { read: boolean; write: boolean; execute: boolean }>>
  >({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // ─── DB TERMINAL STATES ───
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState("");
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [sqlSuggestions, setSqlSuggestions] = useState<string[]>([]);
  const [showSqlSuggestions, setShowSqlSuggestions] = useState(false);

  // ─── LOG STREAMING STATES ───
  const [logSearch, setLogSearch] = useState("");
  const [logSeverityFilter, setLogSeverityFilter] = useState("");

  // ─── APP REGISTRY LIFECYCLE STATES ───
  const [appsList, setAppsList] = useState<any[]>([]);
  const [isAppsLoading, setIsAppsLoading] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [manifestText, setManifestText] = useState("");
  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({
    "Living Architecture Health Map": true,
    "Internal Performance Evaluator": false,
    "Compliance Monitoring Suite": false,
  });

  // Marketplace Admin states
  const [appManagementView, setAppManagementView] = useState<
    "registry" | "requests" | "entitlements"
  >("registry");
  const [adminAccessRequests, setAdminAccessRequests] = useState<any[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [requestActionNotes, setRequestActionNotes] = useState<Record<string, string>>({});
  const [isSubmittingRequestAction, setIsSubmittingRequestAction] = useState<
    Record<string, boolean>
  >({});
  const [activeEntitlements, setActiveEntitlements] = useState<any[]>([]);
  const [isEntitlementsLoading, setIsEntitlementsLoading] = useState(false);
  const [isRevokingEntitlement, setIsRevokingEntitlement] = useState<Record<string, boolean>>({});

  // Ticket Timeline / Discussion Modal states
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  // ─── NEW APP ACCESS & DELEGATION STATES ───
  const [selectedAppForAccess, setSelectedAppForAccess] = useState<any | null>(null);
  const [appAccessUsers, setAppAccessUsers] = useState<any[]>([]);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [appAssignedAdmins, setAppAssignedAdmins] = useState<any[]>([]);
  const [appAllAdmins, setAppAllAdmins] = useState<any[]>([]);
  const [isAdminsLoading, setIsAdminsLoading] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [isUpdatingAccess, setIsUpdatingAccess] = useState<Record<string, boolean>>({});
  const [isUpdatingDelegation, setIsUpdatingDelegation] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const fetchAppAccessDetails = async (appId: string) => {
    setIsAccessLoading(true);
    try {
      const res = await fetch(`/api/admin/apps/access?appId=${appId}`);
      if (res.ok) {
        const data = await res.json();
        setAppAccessUsers(data.users || []);
        if (data.app) {
          setSelectedAppForAccess(data.app);
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to fetch app access details", "error");
      }
    } catch (_e) {
      showToast("Network error fetching app access details", "error");
    } finally {
      setIsAccessLoading(false);
    }
  };

  const fetchAppAdminDelegation = async (appId: string) => {
    setIsAdminsLoading(true);
    try {
      const res = await fetch(`/api/admin/apps/admins?appId=${appId}`);
      if (res.ok) {
        const data = await res.json();
        setAppAssignedAdmins(data.assignedAdmins || []);
        setAppAllAdmins(data.allAdmins || []);
      } else {
        showToast("Failed to fetch admin delegation data", "error");
      }
    } catch (_e) {
      showToast("Network error fetching admin delegation", "error");
    } finally {
      setIsAdminsLoading(false);
    }
  };

  const handleUpdateAppAccess = async (
    userId: string,
    action: "grant" | "revoke",
    scope: "individual" | "subtree",
  ) => {
    if (!selectedAppForAccess) return;
    const appId = selectedAppForAccess.id;
    const key = `${userId}-${scope}`;
    setIsUpdatingAccess((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/apps/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, userId, action, scope }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Access successfully ${action}ed for ${data.affectedCount} user(s)!`, "success");
        fetchAppAccessDetails(appId);
        fetchActiveEntitlements();
      } else {
        showToast(data.error || "Failed to update access", "error");
      }
    } catch (_e) {
      showToast("Network error updating access", "error");
    } finally {
      setIsUpdatingAccess((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUpdateAdminDelegation = async (userId: string, action: "add" | "remove") => {
    if (!selectedAppForAccess) return;
    const appId = selectedAppForAccess.id;
    setIsUpdatingDelegation(true);
    try {
      const res = await fetch("/api/admin/apps/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, userId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          action === "add" ? "Admin successfully assigned!" : "Admin successfully removed!",
          "success",
        );
        fetchAppAdminDelegation(appId);
      } else {
        showToast(data.error || "Failed to update delegation", "error");
      }
    } catch (_e) {
      showToast("Network error updating admin delegation", "error");
    } finally {
      setIsUpdatingDelegation(false);
    }
  };

  const hierarchyRoots = useMemo(() => {
    const userIds = new Set(appAccessUsers.map((u) => u.id));
    return appAccessUsers.filter((u) => !u.managerId || !userIds.has(u.managerId));
  }, [appAccessUsers]);

  const renderHierarchyNode = (node: any, depth = 0) => {
    const directReports = appAccessUsers.filter((u) => u.managerId === node.id);
    const isExpanded = expandedNodes[node.id] !== false;
    const hasReports = directReports.length > 0;

    const matchesSearch = (u: any): boolean => {
      const q = searchUserQuery.trim().toLowerCase();
      if (!q) return true;
      if (
        u.name.toLowerCase().includes(q) ||
        u.eid.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q)
      )
        return true;
      return false;
    };

    const subtreeMatchesSearch = (u: any): boolean => {
      if (matchesSearch(u)) return true;
      const reports = appAccessUsers.filter((r) => r.managerId === u.id);
      return reports.some((r) => subtreeMatchesSearch(r));
    };

    if (searchUserQuery.trim() && !subtreeMatchesSearch(node)) {
      return null;
    }

    const badgeClass = node.hasAccess
      ? "bg-success/15 border-success/20 text-success"
      : "bg-danger/15 border-danger/20 text-danger";

    const eligibilityClass = node.isEligible
      ? "bg-brand-muted border-brand-accent/20 text-brand-accent"
      : "bg-surface-elevated border-border-accent text-text-secondary";

    const isUpdatingInd = isUpdatingAccess[`${node.id}-individual`] || false;
    const isUpdatingSub = isUpdatingAccess[`${node.id}-subtree`] || false;

    return (
      <div key={node.id} className="space-y-1.5" style={{ marginLeft: `${depth * 16}px` }}>
        <div
          className={`flex items-center justify-between p-3 bg-background-portal border border-border-accent/40 rounded-2xl hover:border-brand-accent/20 transition-all group ${!node.isEligible ? "opacity-75" : ""}`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {hasReports ? (
              <button
                type="button"
                onClick={() => setExpandedNodes((prev) => ({ ...prev, [node.id]: !isExpanded }))}
                className="w-5 h-5 flex items-center justify-center rounded-lg bg-surface-elevated hover:bg-surface-card border border-border-accent text-[9px] cursor-pointer"
              >
                {isExpanded ? "▼" : "►"}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-text-tertiary/40 text-[10px]">
                •
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-text-primary truncate">
                  {node.name}
                </span>
                <span className="text-[9px] font-mono bg-surface-elevated px-1.5 py-0.5 rounded border border-border-accent text-text-secondary">
                  {node.eid}
                </span>
              </div>
              <p className="text-[10px] text-text-secondary mt-0.5 font-bold truncate">
                {node.designation} <span className="text-text-tertiary">·</span> {node.vertical}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${eligibilityClass}`}
                title="Default Rule Eligibility"
              >
                {node.isEligible ? "Eligible" : "Restricted"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${badgeClass}`}
                title="Resolved Access Permission"
              >
                {node.hasAccess ? "Granted" : "Blocked"}
              </span>
            </div>

            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
              {node.hasAccess ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdateAppAccess(node.id, "revoke", "individual")}
                    disabled={isUpdatingInd}
                    className="px-2.5 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 hover:border-danger/35 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingInd ? "Revoking..." : "Revoke Individual"}
                  </button>
                  {hasReports && (
                    <button
                      type="button"
                      onClick={() => handleUpdateAppAccess(node.id, "revoke", "subtree")}
                      disabled={isUpdatingSub}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 cursor-pointer"
                      title="Revoke access for this user and all downstream direct/indirect reports"
                    >
                      {isUpdatingSub ? "Revoking Team..." : "Revoke Team ⧉"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdateAppAccess(node.id, "grant", "individual")}
                    disabled={isUpdatingInd}
                    className="px-2.5 py-1.5 bg-success/15 hover:bg-success/20 text-success border border-success/20 hover:border-success/35 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdatingInd ? "Granting..." : "Grant Individual"}
                  </button>
                  {hasReports && (
                    <button
                      type="button"
                      onClick={() => handleUpdateAppAccess(node.id, "grant", "subtree")}
                      disabled={isUpdatingSub}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/35 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 cursor-pointer"
                      title="Grant access to this user and all downstream direct/indirect reports"
                    >
                      {isUpdatingSub ? "Granting Team..." : "Grant Team ⧉"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {hasReports && isExpanded && (
          <div className="space-y-1.5">
            {directReports.map((report) => renderHierarchyNode(report, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const fetchActiveEntitlements = async () => {
    setIsEntitlementsLoading(true);
    try {
      const res = await fetch("/api/v1/marketplace/entitlements");
      if (res.ok) {
        const data = await res.json();
        setActiveEntitlements(data.entitlements || []);
      } else {
        showToast("Failed to fetch active entitlements", "error");
      }
    } catch (_e) {
      showToast("Network error fetching active entitlements", "error");
    } finally {
      setIsEntitlementsLoading(false);
    }
  };

  const handleRevokeEntitlement = async (entitlementId: string) => {
    if (!confirm("Are you sure you want to revoke this active entitlement?")) return;
    setIsRevokingEntitlement((prev) => ({ ...prev, [entitlementId]: true }));
    try {
      const res = await fetch(`/api/v1/marketplace/entitlements?id=${entitlementId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Entitlement was successfully revoked!", "success");
        fetchActiveEntitlements();
      } else {
        showToast(data.error || "Failed to revoke entitlement", "error");
      }
    } catch (_err) {
      showToast("Network error revoking entitlement", "error");
    } finally {
      setIsRevokingEntitlement((prev) => ({ ...prev, [entitlementId]: false }));
    }
  };

  const fetchAdminAccessRequests = async () => {
    setIsRequestsLoading(true);
    try {
      const res = await fetch("/api/v1/marketplace/requests?filter=all");
      if (res.ok) {
        const data = await res.json();
        setAdminAccessRequests(data.requests || []);
      } else {
        showToast("Failed to fetch access requests queue", "error");
      }
    } catch (_e) {
      showToast("Network error fetching requests queue", "error");
    } finally {
      setIsRequestsLoading(false);
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

  const handleReviewAccessRequest = async (requestId: string, status: "approved" | "rejected") => {
    const notes = requestActionNotes[requestId] || "";
    setIsSubmittingRequestAction((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch("/api/v1/marketplace/approve-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status, notes }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Request was successfully ${status}!`, "success");
        setRequestActionNotes((prev) => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
        fetchAdminAccessRequests();
        fetchActiveEntitlements();
        if (selectedTicket && selectedTicket.id === requestId) {
          setSelectedTicket((prev: any) => (prev ? { ...prev, status: data.nextStatus } : null));
          fetchTicketMessages(requestId);
        }
      } else {
        showToast(data.error || "Failed to review request", "error");
      }
    } catch (_err) {
      showToast("Network error reviewing request", "error");
    } finally {
      setIsSubmittingRequestAction((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const fetchApps = async () => {
    setIsAppsLoading(true);
    try {
      const res = await fetch("/api/admin/apps");
      if (res.ok) {
        const data = await res.json();
        setAppsList(data.apps || []);
      } else {
        showToast("Failed to fetch apps list", "error");
      }
    } catch (_err) {
      showToast("Network error fetching apps", "error");
    } finally {
      setIsAppsLoading(false);
    }
  };

  const handleManifestUpload = async () => {
    if (!manifestText.trim()) return;
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(manifestText);
      } catch (_e) {
        showToast("Invalid JSON format", "error");
        return;
      }

      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        showToast("Extension registered successfully", "success");
        setManifestText("");
        fetchApps();
        if (loadWorkspaceData) {
          await loadWorkspaceData();
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to register extension", "error");
      }
    } catch {
      showToast("Network error during registration", "error");
    }
  };

  const toggleAppEnable = async (appId: string, isCurrentlyEnabled: boolean) => {
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          appId,
          isEnabled: !isCurrentlyEnabled,
        }),
      });
      if (res.ok) {
        showToast(!isCurrentlyEnabled ? "Application enabled" : "Application disabled", "success");
        fetchApps();
      } else {
        showToast("Failed to update application state", "error");
      }
    } catch (_err) {
      showToast("Network error toggling app", "error");
    }
  };

  const removeApp = async (appId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this application and drop its custom schema? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          appId,
        }),
      });
      if (res.ok) {
        showToast("Application successfully removed from registry", "success");
        fetchApps();
      } else {
        showToast("Failed to remove application", "error");
      }
    } catch (_err) {
      showToast("Network error removing app", "error");
    }
  };

  const scanApps = async () => {
    setIsAppsLoading(true);
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Scan complete. Synced ${data.count} applications.`, "success");
        fetchApps();
      } else {
        showToast("Failed to run application scanning pipeline", "error");
      }
    } catch (_err) {
      showToast("Network error scanning apps", "error");
    } finally {
      setIsAppsLoading(false);
    }
  };

  useEffect(() => {
    if (sub === "apps") {
      fetchApps();
      fetchAdminAccessRequests();
      fetchActiveEntitlements();
    }
  }, [sub]);

  // ─── UTILS & PERSISTENT ACCESS MATRIX INGESTION ───
  const adminUsers = useMemo(() => {
    return users.filter(
      (u) => u.role === "super_admin" || u.role === "admin" || u.role === "read_only_admin",
    );
  }, [users]);

  // Load and sync permissions from metadata
  useEffect(() => {
    const permRows = metadata.filter((m) => m.type === "admin_permissions");
    const newMatrix: typeof permissionsMatrix = {};

    // Seed default permissions for admins
    adminUsers.forEach((admin) => {
      const dbRecord = permRows.find((m) => m.name === admin.id);
      if (dbRecord?.extendedAttributes) {
        newMatrix[admin.id] = dbRecord.extendedAttributes;
      } else {
        // Default based on roles
        const isSuper = admin.role === "super_admin";
        const _isReadOnly = admin.role === "read_only_admin";
        newMatrix[admin.id] = {
          user_management: {
            read: true,
            write: isSuper || admin.role === "admin",
            execute: isSuper || admin.role === "admin",
          },
          metadata_config: {
            read: true,
            write: isSuper || admin.role === "admin",
            execute: isSuper || admin.role === "admin",
          },
          database_console: { read: true, write: isSuper, execute: isSuper },
          system_audit_logs: { read: true, write: isSuper, execute: isSuper },
        };
      }
    });
    setPermissionsMatrix(newMatrix);

    if (adminUsers.length > 0 && !selectedAdminId) {
      setSelectedAdminId(adminUsers[0].id);
    }
  }, [metadata, adminUsers, selectedAdminId]);

  // Safeguard Checks
  const verifyPrivilege = (module: string, action: "read" | "write" | "execute") => {
    if (simulatedRole === "super_admin") return true;

    // Look up current session user's permissions
    const sessionUser = users.find((u) => u.email?.toLowerCase() === session?.email?.toLowerCase());
    if (!sessionUser) return false;

    // Check if read-only admin
    if (simulatedRole === "read_only_admin" && action !== "read") {
      return false;
    }

    const perms = permissionsMatrix[sessionUser.id]?.[module];
    if (perms) {
      return perms[action];
    }

    return false;
  };

  // ─── RESIZING HANDLER MOUSE LISTENERS ───
  const startResizing = (
    e: React.MouseEvent,
    initialSize: number,
    direction: "horizontal" | "vertical",
    minVal: number,
    maxVal: number,
    setter: (val: number) => void,
  ) => {
    e.preventDefault();
    const startPos = direction === "horizontal" ? e.clientX : e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      // Invert delta if shrinking from right/bottom
      const newVal = initialSize + delta;
      setter(Math.max(minVal, Math.min(maxVal, newVal)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const startResizingLogDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = logDrawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // Swapped subtraction since drawer is right-anchored
      setLogDrawerWidth(Math.max(300, Math.min(800, startWidth + delta)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const startResizingIngestDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = ingestDrawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setIngestDrawerWidth(Math.max(300, Math.min(600, startWidth + delta)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // ─── FILTERED USER LISTS ───
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.eid.toLowerCase().includes(userSearch.toLowerCase());
      const matchesVertical = !verticalFilter || u.vertical_id === verticalFilter;

      // Status Check: isPasswordChanged === true is active/set; false is default pending
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && u.is_password_changed) ||
        (statusFilter === "pending" && !u.is_password_changed);

      return matchesSearch && matchesVertical && matchesStatus;
    });
  }, [users, userSearch, verticalFilter, statusFilter]);

  // ─── STATS & KPI LOGIC ───
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalMetadata = metadata.length;
    const totalLogs = systemLogs.length;

    const roleDistribution = users.reduce((acc: any, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const verticalDistribution = users.reduce((acc: any, u) => {
      const vertName = u.vertical || "Unassigned";
      acc[vertName] = (acc[vertName] || 0) + 1;
      return acc;
    }, {});

    const statusCounts = users.reduce(
      (acc: any, u) => {
        const state = u.is_password_changed ? "active" : "pending";
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      },
      { active: 0, pending: 0 },
    );

    return {
      totalUsers,
      totalMetadata,
      totalLogs,
      roleDistribution,
      verticalDistribution,
      statusCounts,
    };
  }, [users, metadata, systemLogs]);

  // ─── DIRECTORY ACTIONS ───
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllUsersSelection = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!verifyPrivilege("user_management", "write")) {
      showToast("Privilege Violation: Action blocked for this administrative profile.", "error");
      return;
    }

    if (selectedUserIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete the ${selectedUserIds.size} selected employee records?`,
      )
    )
      return;

    setIsDataRefreshing(true);
    try {
      const idsArray = Array.from(selectedUserIds)
        .map((id) => `'${id}'`)
        .join(",");
      // Unlink reporting direct managers
      const unlinkQuery = `UPDATE users SET manager_id = NULL WHERE manager_id IN (${idsArray});`;
      const deleteQuery = `DELETE FROM users WHERE id IN (${idsArray});`;

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${unlinkQuery} ${deleteQuery}` }),
      });

      if (res.ok) {
        setSelectedUserIds(new Set());
        showToast("Successfully deleted personnel profile records.", "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete records", "error");
      }
    } catch (_e) {
      showToast("Network request failed", "error");
    } finally {
      setIsDataRefreshing(false);
    }
  };

  const handleBulkModifyRole = async (newRole: string) => {
    if (!verifyPrivilege("user_management", "write")) {
      showToast("Privilege Violation: Action blocked for this administrative profile.", "error");
      return;
    }
    if (selectedUserIds.size === 0) return;

    setIsDataRefreshing(true);
    try {
      const idsArray = Array.from(selectedUserIds)
        .map((id) => `'${id}'`)
        .join(",");
      const query = `UPDATE users SET role = '${newRole}', updated_at = CURRENT_TIMESTAMP WHERE id IN (${idsArray});`;

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        setSelectedUserIds(new Set());
        showToast(`Successfully updated role to ${newRole} for selected profiles.`, "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update roles", "error");
      }
    } catch (_e) {
      showToast("Network request failed", "error");
    } finally {
      setIsDataRefreshing(false);
    }
  };

  // Add/Edit Single User operations
  const openAddUserModal = () => {
    setUserForm({
      id: "",
      eid: "",
      name: "",
      email: "",
      role: "user",
      designationId: "",
      verticalId: "",
      managerId: "",
    });
    setUserModalMode("add");
    setUserModalError("");
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: any) => {
    setUserForm({
      id: user.id,
      eid: user.eid,
      name: user.name,
      email: user.email,
      role: user.role,
      designationId: user.designation_id || "",
      verticalId: user.vertical_id || "",
      managerId: user.manager_id || "",
    });
    setUserModalMode("edit");
    setUserModalError("");
    setIsUserModalOpen(true);
  };

  const saveSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError("");
    setUserModalLoading(true);

    if (!verifyPrivilege("user_management", "write")) {
      setUserModalError("Privilege Violation: Action blocked for this administrative profile.");
      setUserModalLoading(false);
      return;
    }

    const isEdit = userModalMode === "edit";
    const eidRegex = /^E\d{4}$/;
    if (!userForm.eid || !eidRegex.test(userForm.eid)) {
      setUserModalError("EID format invalid (Must be E followed by 4 digits)");
      setUserModalLoading(false);
      return;
    }

    try {
      let query = "";
      if (isEdit) {
        query = `UPDATE users SET 
          eid = '${userForm.eid.trim()}', 
          name = '${userForm.name.trim()}', 
          email = '${userForm.email.toLowerCase().trim()}', 
          role = '${userForm.role}', 
          designation_id = ${userForm.designationId ? `'${userForm.designationId}'` : "NULL"}, 
          vertical_id = ${userForm.verticalId ? `'${userForm.verticalId}'` : "NULL"}, 
          manager_id = ${userForm.managerId ? `'${userForm.managerId}'` : "NULL"},
          updated_at = CURRENT_TIMESTAMP
          WHERE id = '${userForm.id}';`;
      } else {
        // nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
        const defaultPasswordHash = "$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm"; // bcrypt hash for 'password123'
        const randomId = crypto.randomUUID();
        query = `INSERT INTO users (id, eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id) 
          VALUES (
            '${randomId}',
            '${userForm.eid.trim()}', 
            '${userForm.name.trim()}', 
            '${userForm.email.toLowerCase().trim()}', 
            '${defaultPasswordHash}', 
            false, 
            '${userForm.role}', 
            ${userForm.designationId ? `'${userForm.designationId}'` : "NULL"}, 
            ${userForm.verticalId ? `'${userForm.verticalId}'` : "NULL"}, 
            ${userForm.managerId ? `'${userForm.managerId}'` : "NULL"}
          );`;
      }

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        setIsUserModalOpen(false);
        showToast(
          isEdit ? "Updated personnel record." : "Created default personnel record.",
          "success",
        );
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        setUserModalError(err.error || "Failed to save user profile record");
      }
    } catch (e: any) {
      setUserModalError(e.message || "Connection failure");
    } finally {
      setUserModalLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!verifyPrivilege("user_management", "write")) {
      showToast("Privilege Violation: Action blocked for this administrative profile.", "error");
      return;
    }
    if (
      !confirm(
        `Reset credentials for "${userName}"? They will be forced to configure a new credential on login.`,
      )
    )
      return;

    try {
      // nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
      const defaultPasswordHash = "$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm";
      const query = `UPDATE users SET password_hash = '${defaultPasswordHash}', is_password_changed = false, updated_at = CURRENT_TIMESTAMP WHERE id = '${userId}';`;

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        showToast(`Credentials reset successfully. Temporary key: password123`, "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || "Credential reset failed", "error");
      }
    } catch (_e) {
      showToast("Connection failed", "error");
    }
  };

  const handleDeleteSingleUser = async (userId: string, userName: string) => {
    if (!verifyPrivilege("user_management", "write")) {
      showToast("Privilege Violation: Action blocked for this administrative profile.", "error");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to remove "${userName}"? This will disconnect their direct reports.`,
      )
    )
      return;

    try {
      const preQuery = `UPDATE users SET manager_id = NULL WHERE manager_id = '${userId}';`;
      const deleteQuery = `DELETE FROM users WHERE id = '${userId}';`;

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${preQuery} ${deleteQuery}` }),
      });

      if (res.ok) {
        showToast("Successfully deleted employee profile.", "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        const err = await res.json();
        showToast(err.error || "Delete failed", "error");
      }
    } catch (_e) {
      showToast("Connection failed", "error");
    }
  };

  // ─── DRAG & DROP BULK UPLOAD HANDLERS ───
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const _handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = (ev: any) => {
        handleCsvUpload(ev.target.result);
        simulateIngestionBatchLogs();
      };
      r.readAsText(file);
    }
  };

  function simulateIngestionBatchLogs() {
    setIsIngestingRows(true);
    setIngestBatchProgress(5);
    setIngestStatusLogs([
      "[INFO] Parsing raw ingestion data source...",
      "[INFO] CSV Headers mapped successfully.",
    ]);

    setTimeout(() => {
      setIngestBatchProgress(35);
      setIngestStatusLogs((prev) => [
        ...prev,
        "[INFO] Pre-validating schema structure variables...",
        "[WARN] Row #2 vertical assignment mismatch auto-flagged.",
      ]);
    }, 400);

    setTimeout(() => {
      setIngestBatchProgress(75);
      setIngestStatusLogs((prev) => [
        ...prev,
        "[INFO] Compiling local matrix correction records...",
        "[INFO] Integrity check complete. Awaiting direct operator input corrections.",
      ]);
      setIngestBatchProgress(100);
      setIsIngestingRows(false);
    }, 900);
  }

  // ─── ACCESS CONTROL ASSIGNMENT MUTATION ───
  const handlePermissionToggle = async (
    adminId: string,
    module: string,
    variable: "read" | "write" | "execute",
  ) => {
    if (simulatedRole !== "super_admin") {
      showToast("Access Violation: Only Super Admin profiles can mutate permissions.", "error");
      return;
    }

    const currentPerms = permissionsMatrix[adminId] || {
      user_management: { read: false, write: false, execute: false },
      metadata_config: { read: false, write: false, execute: false },
      database_console: { read: false, write: false, execute: false },
      system_audit_logs: { read: false, write: false, execute: false },
    };

    const targetModule = currentPerms[module] || { read: false, write: false, execute: false };
    const updatedModule = { ...targetModule, [variable]: !targetModule[variable] };
    const updatedPerms = { ...currentPerms, [module]: updatedModule };

    // Optimistic Update
    setPermissionsMatrix((prev) => ({
      ...prev,
      [adminId]: updatedPerms,
    }));

    setIsSavingPermissions(true);
    try {
      // 1. Look up if record already exists in database
      const checkRes = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `SELECT id FROM structural_metadata WHERE type = 'admin_permissions' AND name = '${adminId}' LIMIT 1;`,
        }),
      });
      const checkData = await checkRes.json();

      let query = "";
      if (checkData.rows && checkData.rows.length > 0) {
        // Update
        const metaId = checkData.rows[0].id;
        query = `UPDATE structural_metadata SET extended_attributes = '${JSON.stringify(updatedPerms)}'::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = '${metaId}';`;
      } else {
        // Insert
        query = `INSERT INTO structural_metadata (id, type, name, extended_attributes) VALUES (gen_random_uuid(), 'admin_permissions', '${adminId}', '${JSON.stringify(updatedPerms)}'::jsonb);`;
      }

      const saveRes = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (saveRes.ok) {
        showToast("Administrative privileges database matrix updated.", "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        // Rollback
        setPermissionsMatrix((prev) => ({
          ...prev,
          [adminId]: currentPerms,
        }));
        showToast("Failed to persist permissions updates.", "error");
      }
    } catch (_e) {
      setPermissionsMatrix((prev) => ({
        ...prev,
        [adminId]: currentPerms,
      }));
      showToast("Network error saving permissions", "error");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // ─── SQL EDITOR TERMINAL ACTIONS ───
  const runSQLQuery = async () => {
    setQueryError("");
    setQueryResult(null);

    const destructiveKeywords = ["drop", "delete", "truncate", "update", "insert", "alter"];
    const isDestructive = destructiveKeywords.some((keyword) =>
      sqlQuery.toLowerCase().includes(keyword),
    );

    if (isDestructive && !verifyPrivilege("database_console", "write")) {
      setQueryError(
        "Privilege Violation: Administrative profile lacks write/execute privileges to execute destructive commands.",
      );
      showToast("SQL Execution Blocked: Destructive statement intercepted.", "error");
      return;
    }

    setIsQueryRunning(true);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery }),
      });
      const data = await res.json();
      if (res.ok) {
        setQueryResult(data);
        showToast("SQL Statement executed successfully.", "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        setQueryError(data.error || "Execution failed.");
      }
    } catch (err: any) {
      setQueryError(err.message || "Execution failed.");
    } finally {
      setIsQueryRunning(false);
    }
  };

  const handleSqlChange = (val: string) => {
    setSqlQuery(val);
    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "INSERT",
      "INTO",
      "UPDATE",
      "SET",
      "DELETE",
      "DROP",
      "users",
      "structural_metadata",
      "system_logs",
    ];
    const lastWord = val.split(/[\s,;]+/).pop() || "";
    if (lastWord.length >= 2) {
      const filtered = keywords.filter(
        (kw) => kw.toLowerCase().startsWith(lastWord.toLowerCase()) && kw !== lastWord,
      );
      setSqlSuggestions(filtered);
      setShowSqlSuggestions(filtered.length > 0);
    } else {
      setShowSqlSuggestions(false);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const words = sqlQuery.split(/([\s,;]+)/);
    words.pop(); // Remove the typing part
    words.push(suggestion);
    setSqlQuery(words.join(""));
    setShowSqlSuggestions(false);
  };

  const highlightSQLKeywords = (code: string) => {
    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "DROP",
      "TABLE",
      "LIMIT",
      "JOIN",
      "LEFT",
      "ON",
      "ORDER",
      "BY",
      "DESC",
      "ASC",
    ];
    let highlighted = code;

    keywords.forEach((kw) => {
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      highlighted = highlighted.replace(
        regex,
        `<span class="text-brand-accent font-bold">${kw.toUpperCase()}</span>`,
      );
    });

    return highlighted;
  };

  // ─── HIERARCHICAL STRUCTURAL BLUEPRINT TREE RENDERING ───
  const treeItems = useMemo(() => {
    return metadata.filter((m) => m.type === "vertical");
  }, [metadata]);

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleInlineAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineAddName.trim() || !inlineAddParentId) return;

    if (!verifyPrivilege("metadata_config", "write")) {
      showToast("Privilege Violation: Action blocked for this administrative profile.", "error");
      return;
    }

    setIsDataRefreshing(true);
    try {
      const res = await fetch("/api/admin/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vertical",
          name: inlineAddName.trim(),
          parentId: inlineAddParentId,
          sortOrder: metadata.filter((m) => m.type === "vertical").length + 1,
        }),
      });
      if (res.ok) {
        setInlineAddName("");
        setInlineAddParentId(null);
        showToast("Successfully appended structural vertical branch.", "success");
        if (loadWorkspaceData) await loadWorkspaceData();
      } else {
        showToast("Failed to append branch.", "error");
      }
    } catch (_err) {
      showToast("Connection error", "error");
    } finally {
      setIsDataRefreshing(false);
    }
  };

  const renderTreeNodes = (parentId: string | null = null, depth = 0) => {
    const nodes = treeItems.filter((node) => node.parent_id === parentId);
    if (nodes.length === 0) return null;

    return (
      <div className={`space-y-3 pl-4 border-l border-border-accent/40 ${depth > 0 ? "mt-2" : ""}`}>
        {nodes.map((node) => {
          const isCollapsed = collapsedNodes.has(node.id);
          const hasChildren = treeItems.some((n) => n.parent_id === node.id);
          const directReports = users.filter((u) => u.vertical_id === node.id);

          return (
            <div key={node.id} className="relative group/tree animate-fadeIn">
              {/* Connector line for child nodes */}
              <div className="absolute -left-4 top-5 w-4 h-[1px] bg-border-accent/40"></div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleNodeCollapse(node.id)}
                  disabled={!hasChildren}
                  className={`p-1 rounded hover:bg-background-portal text-text-tertiary transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  } ${!hasChildren ? "opacity-0 cursor-default" : "opacity-100"}`}
                >
                  ▼
                </button>

                <div className="flex-1 flex items-center justify-between p-3.5 bg-surface-card border border-border-accent hover:border-brand-accent/30 rounded-xl transition-all shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-brand-accent shadow shadow-brand-accent"></div>
                    <div>
                      <span className="text-xs font-bold text-text-primary">{node.name}</span>
                      <span className="text-[10px] text-text-tertiary ml-2">
                        ({directReports.length} members)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover/tree:opacity-100 transition-opacity">
                    <button
                      onClick={() => setInlineAddParentId(node.id)}
                      className="p-1 rounded bg-background-portal border border-border-accent hover:border-brand-accent/40 text-brand-accent text-[9px] px-2 py-0.5 font-extrabold flex items-center gap-1"
                      title="Add sub-team branch"
                    >
                      <span>＋</span> sub-team
                    </button>
                    <button
                      onClick={() => handleMetadataDelete(node.id)}
                      className="p-1 rounded hover:bg-rose-500/10 text-rose-500 text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Add input */}
              {inlineAddParentId === node.id && (
                <form
                  onSubmit={handleInlineAddMetadata}
                  className="mt-2 ml-10 p-3 bg-surface-card border border-brand-accent/30 rounded-xl flex items-center gap-2 shadow-inner"
                >
                  <input
                    type="text"
                    value={inlineAddName}
                    onChange={(e) => setInlineAddName(e.target.value)}
                    placeholder="Sub-team title..."
                    required
                    className="flex-1 px-3 py-1.5 bg-background-portal border border-input-border rounded-lg text-xs outline-none focus:border-brand-accent"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-brand-accent text-white text-[10px] font-black uppercase rounded-lg shadow-sm"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setInlineAddParentId(null)}
                    className="px-3 py-1.5 border border-border-accent rounded-lg text-[10px] hover:bg-background-portal text-text-secondary"
                  >
                    Cancel
                  </button>
                </form>
              )}

              {/* Recursive child list */}
              {!isCollapsed && renderTreeNodes(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── LOGS FILTER & VIRTUAL SCROLLING ───
  const filteredLogs = useMemo(() => {
    return systemLogs.filter((l) => {
      const matchesSearch =
        l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        (l.payload && JSON.stringify(l.payload).toLowerCase().includes(logSearch.toLowerCase())) ||
        l.ip_address?.includes(logSearch) ||
        l.user_id?.toLowerCase().includes(logSearch.toLowerCase());
      const matchesSeverity = !logSeverityFilter || l.severity === logSeverityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [systemLogs, logSearch, logSeverityFilter]);

  const logParentRef = useRef<HTMLDivElement>(null);

  const logVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => logParentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      INFO: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
      WARN: "bg-warning/10 text-warning-text border border-warning/20",
      ERROR: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
      CRITICAL: "bg-red-500/15 text-red-500 border border-red-500/30 animate-pulse font-extrabold",
    };
    return map[severity] || "bg-slate-500/10 text-slate-500 border border-slate-500/20";
  };

  const getLogSeverityColorClass = (severity: string) => {
    const map: Record<string, string> = {
      INFO: "text-text-secondary hover:bg-table-row-hover",
      WARN: "text-warning-text border-l-2 border-l-warning/60 bg-warning/5 hover:bg-warning/10",
      ERROR: "text-rose-500 border-l-2 border-l-rose-500/60 bg-rose-500/5 hover:bg-rose-500/10",
      CRITICAL:
        "text-red-500 border-l-4 border-l-red-500 bg-red-500/10 hover:bg-red-500/15 font-bold animate-pulse",
    };
    return map[severity] || "text-text-secondary hover:bg-table-row-hover";
  };

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

  return (
    <div
      className="flex-1 flex min-h-0 bg-background-portal text-text-primary relative overflow-hidden h-full"
      style={hideSidebar ? { height: "100%" } : { height: "calc(100vh - 4.1rem)" }}
    >
      {/* ─── GLOBAL TOAST NOTIFICATION ─── */}
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

      {/* ─── LEFT SIDEBAR NAVIGATION (Resizable) ─── */}
      {!hideSidebar && (
        <aside
          className="relative bg-sidebar-bg border-r border-border-accent flex flex-col transition-all flex-shrink-0"
          style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
        >
          <div className="flex-1 flex flex-col min-h-0">
            {/* Collapse/Expand Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute top-4 -right-3 h-6 w-6 rounded-full border border-border-accent bg-surface-card hover:bg-background-portal flex items-center justify-center text-[10px] text-text-secondary z-20 shadow cursor-pointer transition-transform duration-200"
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none" }}
            >
              ◀
            </button>

            {/* Profile Card Summary */}
            <div className="p-4 border-b border-border-accent bg-surface-card/10 flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-accent to-emerald-500 flex items-center justify-center text-white font-extrabold shadow flex-shrink-0 text-sm">
                {session?.name?.charAt(0) || "A"}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-black truncate text-text-primary">{session?.name}</p>
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-brand-accent/15 text-brand-accent border border-brand-accent/20">
                    {simulatedRole}
                  </span>
                </div>
              )}
            </div>

            {/* Sidebar Nav Items */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {[
                { id: "dashboard", label: "Dashboard", icon: "📊" },
                { id: "users", label: "Users & Ingest", icon: "👥" },
                { id: "metadata", label: "Metadata/Org", icon: "🪢" },
                { id: "access", label: "Access Control", icon: "🔐" },
                { id: "database", label: "DB Terminal", icon: "🗄️" },
                { id: "logs", label: "Audit Logs", icon: "📜" },
                { id: "apps", label: "App Registry", icon: "🔌" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSub(item.id as any)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                    sub === item.id
                      ? "bg-sidebar-active text-sidebar-text-active shadow-sm font-black"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary"
                  }`}
                  title={item.label}
                >
                  <span className="text-sm">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}

              <a
                href="http://localhost:3003/developer"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary"
                title="Developer Portal"
              >
                <span className="text-sm">🛠️</span>
                {!sidebarCollapsed && <span className="truncate">DevCenter Portal</span>}
              </a>
            </nav>
          </div>

          {/* Resizer Handle */}
          {!sidebarCollapsed && (
            <div
              className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
              onMouseDown={(e) =>
                startResizing(e, sidebarWidth, "horizontal", 150, 400, setSidebarWidth)
              }
            />
          )}
        </aside>
      )}

      {/* ─── WORKSPACE PANE (Zero layout shifts, skeletons loading) ─── */}
      <main className="flex-1 flex flex-col min-w-0 bg-background-portal overflow-hidden relative">
        {isDataRefreshing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-accent to-success animate-pulse z-30" />
        )}

        {/* ── 1. MODULE: DASHBOARD ── */}
        {sub === "dashboard" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-xl font-black tracking-tight text-text-primary">
                Admin Control Center
              </h1>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Global telemetric activity monitoring and configuration platform core.
              </p>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  label: "Active Roster",
                  value: stats.totalUsers,
                  desc: `${stats.statusCounts.active} setup done • ${stats.statusCounts.pending} credentials pending`,
                  color: "border-l-4 border-brand-accent",
                },
                {
                  label: "Metadata Units",
                  value: stats.totalMetadata,
                  desc: "Structural Vertical units & designated classes",
                  color: "border-l-4 border-success",
                },
                {
                  label: "Telemetry Buffer",
                  value: stats.totalLogs,
                  desc: "Rotating event logs count limit of 100,000",
                  color: "border-l-4 border-warning",
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className={`p-4.5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between ${kpi.color}`}
                >
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold">
                      {kpi.label}
                    </span>
                    <h2 className="text-2xl font-black mt-1 text-text-primary">{kpi.value}</h2>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-2.5">{kpi.desc}</p>
                </div>
              ))}
            </div>

            {/* Sub Charts & Distribution Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Departmental Vertical Spread */}
              <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-4">
                    Vertical Divisions Spread
                  </h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {Object.entries(stats.verticalDistribution).map(
                      ([dept, count]: [string, any]) => {
                        const percentage = Math.round((count / (stats.totalUsers || 1)) * 100);
                        return (
                          <div key={dept}>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-text-primary truncate max-w-[200px]">
                                {dept}
                              </span>
                              <span className="text-text-secondary">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-background-portal rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-accent rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border-accent/40 flex items-center justify-between text-[10px] text-text-tertiary">
                  <span>Capacity: Dynamic allocation active</span>
                  <button
                    onClick={() => setSub("metadata")}
                    className="text-brand-accent font-bold hover:underline"
                  >
                    Configure Structures
                  </button>
                </div>
              </div>

              {/* Roles Breakdown & System State */}
              <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-4">
                    Privilege Distribution Matrix
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(stats.roleDistribution).map(([role, count]: [string, any]) => (
                      <div
                        key={role}
                        className="p-3 bg-background-portal border border-border-accent rounded-xl text-center"
                      >
                        <span className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-brand-accent/10 text-brand-accent">
                          {role}
                        </span>
                        <h4 className="text-xl font-black mt-2 text-text-primary">{count}</h4>
                        <span className="text-[9px] text-text-tertiary">profiles</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border-accent/40 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Admin Control Mode</h4>
                    <p className="text-[10px] text-text-secondary">
                      Simulated level:{" "}
                      <span className="font-extrabold text-brand-accent uppercase">
                        {simulatedRole}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSub("users")}
                    className="px-3 py-1.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Manage Roster
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="p-5 rounded-2xl bg-surface-card border border-border-accent shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[11px] uppercase tracking-wider text-text-secondary">
                  Recent System Activities
                </h3>
                <button
                  onClick={() => setSub("logs")}
                  className="text-xs text-brand-accent font-semibold hover:underline"
                >
                  View Stream
                </button>
              </div>
              <div className="divide-y divide-border-accent/40 max-h-[200px] overflow-y-auto pr-1">
                {systemLogs.slice(0, 5).map((log, idx) => (
                  <div key={idx} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <p className="font-bold text-text-primary">{log.action}</p>
                      <p className="text-[9px] text-text-tertiary mt-0.5">
                        IP: {log.ip_address} • Operator ID:{" "}
                        {log.user_id?.substring(0, 8) || "System"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${severityBadge(log.severity)}`}
                      >
                        {log.severity}
                      </span>
                      <span className="text-[9px] text-text-tertiary font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. MODULE: USER MANAGEMENT & INGESTION ── */}
        {sub === "users" && (
          <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
            {/* Tab sub-headers */}
            <div className="px-6 py-4 border-b border-border-accent flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-background-portal p-1 rounded-xl border border-border-accent">
                <button
                  onClick={() => setShowErrorDrawer(false)}
                  className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    !showErrorDrawer
                      ? "bg-surface-card text-brand-accent shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Active Roster
                </button>
                <button
                  onClick={() => setShowErrorDrawer(true)}
                  className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    showErrorDrawer
                      ? "bg-surface-card text-brand-accent shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Bulk Ingestion Upload
                </button>
              </div>

              {!showErrorDrawer && (
                <button
                  onClick={openAddUserModal}
                  className="px-4 py-2 bg-gradient-to-r from-brand-accent to-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                >
                  <span>＋</span> Add Single User
                </button>
              )}
            </div>

            {/* ACTIVE ROSTER SUB-VIEW */}
            {!showErrorDrawer && (
              <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4">
                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm flex-shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by Name, EID, Email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl text-xs outline-none"
                    />
                    <span className="absolute left-2.5 top-2.5 text-text-tertiary">🔍</span>
                  </div>

                  <div>
                    <select
                      value={verticalFilter}
                      onChange={(e) => setVerticalFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                    >
                      <option value="">All Verticals</option>
                      {metadata
                        .filter((m) => m.type === "vertical")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active (Credentials Configured)</option>
                      <option value="pending">Pending (Default Password)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end text-[10px] text-text-secondary font-bold">
                    Showing {filteredUsers.length} of {users.length} profiles
                  </div>
                </div>

                {/* Directory Table Layout (Virtual Scrolling ready) */}
                <div className="flex-1 border border-border-accent rounded-2xl overflow-hidden bg-surface-card shadow-sm min-h-0 flex flex-col">
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full text-xs">
                      <thead className="bg-table-header border-b border-border-accent sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left w-8">
                            <input
                              type="checkbox"
                              checked={
                                selectedUserIds.size === filteredUsers.length &&
                                filteredUsers.length > 0
                              }
                              onChange={toggleAllUsersSelection}
                              className="rounded border-input-border"
                            />
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            EID
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            Personnel Record
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            Email Address
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            Designation
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            Vertical
                          </th>
                          <th className="px-4 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-black uppercase text-[10px] text-text-secondary">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-accent/40 bg-surface-card">
                        {filteredUsers.map((u) => {
                          const isChecked = selectedUserIds.has(u.id);
                          return (
                            <tr
                              key={u.id}
                              className={`hover:bg-table-row-hover transition-colors ${isChecked ? "bg-brand-muted/30" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleUserSelection(u.id)}
                                  className="rounded border-input-border"
                                />
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-text-primary">
                                {u.eid}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-brand-accent to-emerald-500 text-white font-extrabold flex items-center justify-center text-[10px] uppercase">
                                    {u.name?.charAt(0)}
                                  </div>
                                  <span className="font-bold text-text-primary">{u.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-text-secondary font-mono text-[11px]">
                                {u.email}
                              </td>
                              <td className="px-4 py-3 text-text-secondary">
                                {u.designation || "Specialist"}
                              </td>
                              <td className="px-4 py-3 text-text-secondary">
                                {u.vertical || "SG Forge HQ"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${u.is_password_changed ? "bg-success shadow shadow-success" : "bg-warning shadow shadow-warning"}`}
                                  />
                                  <span className="text-[10px] font-bold text-text-secondary">
                                    {u.is_password_changed ? "Active" : "Setup Pending"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                <button
                                  onClick={() => handleResetPassword(u.id, u.name)}
                                  className="px-2 py-1 bg-warning/10 hover:bg-warning/20 text-warning-text rounded text-[10px] font-bold"
                                  title="Reset credentials"
                                >
                                  Reset Key
                                </button>
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="px-2 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded text-[10px] font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteSingleUser(u.id, u.name)}
                                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Floating Utility Panel for checked list */}
                {selectedUserIds.size > 0 && (
                  <div className="bg-surface-elevated border-2 border-brand-accent/40 rounded-2xl p-4 flex items-center justify-between shadow-2xl animate-fadeIn flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-brand-accent animate-ping"></div>
                      <span className="text-xs font-bold text-text-primary">
                        {selectedUserIds.size} personnel record files selected for action
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleBulkModifyRole(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="px-3 py-1.5 bg-background-portal border border-input-border rounded-xl text-xs outline-none font-bold"
                      >
                        <option value="">Modify Roles...</option>
                        <option value="user">Set role: user</option>
                        <option value="admin">Set role: admin</option>
                        <option value="read_only_admin">Set role: read_only_admin</option>
                      </select>

                      <button
                        onClick={handleBulkDelete}
                        className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow"
                      >
                        Delete Selected
                      </button>

                      <button
                        onClick={() => setSelectedUserIds(new Set())}
                        className="px-3.5 py-1.5 border border-border-accent rounded-xl text-xs hover:bg-background-portal font-semibold text-text-secondary"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BULK INGESTION SUB-VIEW */}
            {showErrorDrawer && (
              <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-background-portal animate-fadeIn animate-duration-300">
                {parsedRows.length === 0 ? (
                  /* --- NO ROWS PARSED YET: UPLOAD / PASTE SCREEN --- */
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🛠️</span>
                        <h3 className="text-lg font-black text-text-primary">
                          Bulk Personnel Ingestion Control
                        </h3>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Provision new user accounts and establish organizational reporting
                        structures instantly. Supported formats: CSV or JSON array data.
                      </p>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="bg-sidebar-bg border border-border-accent/40 p-1 rounded-2xl flex items-center gap-1.5 w-fit">
                      <button
                        onClick={() => setIngestInputMethod("upload")}
                        className={`px-4.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                          ingestInputMethod === "upload"
                            ? "bg-surface-card text-brand-accent shadow-sm"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <span>📁</span> File Upload
                      </button>
                      <button
                        onClick={() => setIngestInputMethod("paste")}
                        className={`px-4.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                          ingestInputMethod === "paste"
                            ? "bg-surface-card text-brand-accent shadow-sm"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <span>✍️</span> Direct Raw Paste
                      </button>
                    </div>

                    {ingestInputMethod === "upload" ? (
                      /* Drag & drop file target */
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragOver(false);
                          const file = e.dataTransfer.files[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = (ev: any) => {
                              handleCsvUpload(ev.target.result);
                              simulateIngestionBatchLogs();
                            };
                            r.readAsText(file);
                          }
                        }}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".csv,.json";
                          input.onchange = (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              const r = new FileReader();
                              r.onload = (ev: any) => {
                                handleCsvUpload(ev.target.result);
                                simulateIngestionBatchLogs();
                              };
                              r.readAsText(file);
                            }
                          };
                          input.click();
                        }}
                        className={`border-2 border-dashed rounded-3xl p-14 flex flex-col items-center justify-center transition-all bg-surface-card/45 backdrop-blur-md cursor-pointer group relative overflow-hidden ${
                          isDragOver
                            ? "border-brand-accent bg-brand-muted/20 scale-98 shadow-inner shadow-brand-accent/10"
                            : "border-border-accent hover:border-brand-accent/40 hover:bg-surface-card/65"
                        }`}
                      >
                        {/* Background glow decorative details */}
                        <div className="absolute -top-12 -left-12 h-32 w-32 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-12 -right-12 h-32 w-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                        <div className="p-4.5 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-350">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-brand-accent"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        </div>
                        <p className="text-xs font-black text-text-primary tracking-wide">
                          Drag & drop roster files here or click to browse
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-1.5 font-medium">
                          Supports standard .csv and .json roster formats
                        </p>
                      </div>
                    ) : (
                      /* Raw text paste editor workspace */
                      <div className="space-y-4">
                        <div className="relative rounded-3xl border border-border-accent bg-sidebar-bg/60 backdrop-blur-md overflow-hidden p-4 focus-within:ring-1 focus-within:ring-brand-accent focus-within:border-brand-accent">
                          <div className="flex items-center justify-between pb-3.5 border-b border-border-accent/40 mb-3">
                            <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest">
                              Raw Payload Clipboard Input
                            </span>
                            {liveParseResult && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  liveParseResult.valid
                                    ? "bg-success/15 border-success/20 text-success"
                                    : "bg-danger/15 border-danger/20 text-danger"
                                }`}
                              >
                                {liveParseResult.type}: {liveParseResult.message}
                              </span>
                            )}
                          </div>

                          <textarea
                            id="global-ingest-paste-textarea"
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder={`Paste CSV data here. Format:\nEID,Name,Email,Role,Designation,Vertical,ManagerEID\nE0001,Aarav,aarav@sgforge.com,user,Developer,HQ,E0002\n\nOr paste JSON array:\n[\n  { "eid": "E0001", "name": "Aarav", "email": "aarav@sgforge.com", "designation": "Developer" }\n]`}
                            rows={10}
                            className="w-full bg-transparent font-mono text-xs text-text-primary placeholder-text-tertiary focus:outline-none resize-y min-h-[220px]"
                          />
                        </div>

                        <button
                          onClick={() => {
                            if (pasteText.trim()) {
                              handleCsvUpload(pasteText);
                              simulateIngestionBatchLogs();
                            }
                          }}
                          disabled={
                            !pasteText.trim() ||
                            (liveParseResult !== null && !liveParseResult.valid)
                          }
                          className="px-6 py-3 bg-gradient-to-r from-brand-accent to-indigo-500 hover:from-brand-hover hover:to-indigo-600 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black uppercase rounded-2xl shadow-lg shadow-brand-accent/20 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          ⚡ Parse & Validate Payload
                        </button>
                      </div>
                    )}

                    {/* Template Guides with CSV/JSON tabs */}
                    <div className="bg-surface-card border border-border-accent rounded-3xl p-5 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest">
                          Roster Template Schema
                        </span>
                        <span className="text-[9px] text-text-tertiary italic">
                          Click code to copy template headers
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">
                            CSV Format
                          </span>
                          <pre
                            onClick={() => {
                              navigator.clipboard.writeText(
                                "EID,Name,Email,Role,Designation,Vertical,ManagerEID",
                              );
                              showToast("CSV template copied!", "success");
                            }}
                            className="font-mono text-xs text-brand-accent select-all overflow-x-auto p-4 bg-background-portal border border-border-accent/40 rounded-2xl cursor-pointer hover:border-brand-accent/35 transition-colors"
                          >
                            EID,Name,Email,Role,Designation,Vertical,ManagerEID
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">
                            JSON Format
                          </span>
                          <pre
                            onClick={() => {
                              const jsonTemp = `[\n  {\n    "EID": "E0001",\n    "Name": "Aarav",\n    "Email": "aarav@sgforge.com",\n    "Role": "user",\n    "Designation": "Developer",\n    "Vertical": "Core",\n    "ManagerEID": "E0002"\n  }\n]`;
                              navigator.clipboard.writeText(jsonTemp);
                              showToast("JSON template copied!", "success");
                            }}
                            className="font-mono text-xs text-emerald-400 select-all overflow-x-auto p-4 bg-background-portal border border-border-accent/40 rounded-2xl cursor-pointer hover:border-emerald-500/35 transition-colors"
                          >
                            {`[\n  {\n    "EID": "E0001",\n    "Name": "Aarav",\n    "Email": "aarav@sgforge.com",\n    "Role": "user",\n    "Designation": "Developer",\n    "Vertical": "Core",\n    "ManagerEID": "E0002"\n  }\n]`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- INGESTION WORKBENCH: SIDE-BY-SIDE GRID --- */
                  <div className="flex-1 flex min-h-0 divide-x divide-border-accent/40 bg-background-portal overflow-hidden relative">
                    {/* Left Pane: Ingest Status & Logs Panel */}
                    <div
                      className="flex-shrink-0 bg-sidebar-bg/50 backdrop-blur-md p-5 flex flex-col justify-between overflow-y-auto space-y-6"
                      style={{ width: ingestDrawerWidth }}
                    >
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-border-accent/40 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                              Ingestion Hub
                            </h4>
                          </div>

                          <button
                            onClick={() => {
                              setParsedRows([]);
                              setCsvRawText("");
                              setIngestBatchProgress(0);
                              setIngestStatusLogs([]);
                              setPasteText("");
                            }}
                            className="text-[10px] font-black uppercase border border-border-accent/80 hover:border-brand-accent/40 hover:bg-background-portal/50 px-3 py-1.5 rounded-xl text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                          >
                            Reset Upload
                          </button>
                        </div>

                        {/* Batch Progress */}
                        <div className="space-y-3.5 bg-background-portal border border-border-accent/40 p-4.5 rounded-2xl">
                          <div className="flex justify-between text-[11px] font-black uppercase text-text-secondary">
                            <span>Analysis Status</span>
                            <span>{ingestBatchProgress}%</span>
                          </div>

                          <div className="w-full h-2 bg-surface-card border border-border-accent/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-brand-accent to-indigo-400 transition-all duration-300"
                              style={{ width: `${ingestBatchProgress}%` }}
                            />
                          </div>

                          {/* Record statistics badges */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="bg-surface-card/65 border border-border-accent/40 p-2 rounded-xl text-center">
                              <span className="text-[8px] font-black uppercase text-text-tertiary block">
                                Total Rows
                              </span>
                              <span className="text-sm font-black text-text-primary">
                                {parsedRows.length}
                              </span>
                            </div>
                            <div className="bg-surface-card/65 border border-border-accent/40 p-2 rounded-xl text-center">
                              <span className="text-[8px] font-black uppercase text-text-tertiary block">
                                Active Faults
                              </span>
                              <span
                                className={`text-sm font-black ${Object.keys(validationErrors).length > 0 ? "text-danger" : "text-success"}`}
                              >
                                {Object.keys(validationErrors).length}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Compiler Console Logs */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">
                            Compiler Console Logs
                          </span>

                          <div className="bg-background-portal border border-border-accent rounded-2xl p-4 font-mono text-[10px] text-text-secondary h-[180px] overflow-y-auto space-y-1.5 scrollbar-thin">
                            {ingestStatusLogs.map((logStr, idx) => (
                              <p
                                key={idx}
                                className={`leading-relaxed truncate ${
                                  logStr.includes("[WARN]") || logStr.includes("error")
                                    ? "text-warning-text"
                                    : logStr.includes("[INFO]")
                                      ? "text-text-tertiary/90"
                                      : "text-zinc-400"
                                }`}
                              >
                                {logStr}
                              </p>
                            ))}
                            {Object.keys(validationErrors).length > 0 && (
                              <p className="text-rose-400 font-bold mt-2">
                                [HALT] Ingestion paused. {Object.keys(validationErrors).length} rows
                                require cell corrections.
                              </p>
                            )}
                            {Object.keys(validationErrors).length === 0 && (
                              <p className="text-emerald-400 font-bold mt-2">
                                [READY] Schema verified. Integrity check 100% complete.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Commit Button */}
                      <button
                        onClick={handleCommitIngest}
                        disabled={Object.keys(validationErrors).length > 0 || commitLoading}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {commitLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Writing to Core DB...
                          </>
                        ) : (
                          <>
                            🚀 Commit {parsedRows.length - Object.keys(validationErrors).length}{" "}
                            Records
                          </>
                        )}
                      </button>
                    </div>

                    {/* Resizer Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-accent z-50"
                      style={{ left: ingestDrawerWidth }}
                      onMouseDown={startResizingIngestDrawer}
                    />

                    {/* Right Pane: Validation Workbench Matrix Grid */}
                    <div className="flex-1 p-6 flex flex-col min-h-0 space-y-4 overflow-hidden bg-background-portal/30">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">
                            Validation Workbench Matrix
                          </span>
                          <h4 className="text-sm font-extrabold text-text-primary">
                            Personnel Records Editor Sandbox
                          </h4>
                        </div>
                        <span className="text-[10px] text-text-secondary bg-surface-card border border-border-accent/40 px-3 py-1.5 rounded-xl font-bold">
                          💡 Double-click any value cell to modify inline
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4.5 pr-2 scrollbar-thin">
                        {parsedRows.map((row, rIdx) => {
                          const rowErrs = validationErrors[rIdx] || [];
                          const isFaulty = rowErrs.length > 0;

                          // Helper to check if a specific field has a validation error
                          const getFieldError = (field: string) => {
                            const f = field.toLowerCase();
                            if (f === "eid")
                              return rowErrs.find(
                                (e) =>
                                  e.toLowerCase().includes("eid") &&
                                  !e.toLowerCase().includes("manager"),
                              );
                            if (f === "name")
                              return rowErrs.find((e) => e.toLowerCase().includes("name"));
                            if (f === "email")
                              return rowErrs.find((e) => e.toLowerCase().includes("email"));
                            if (f === "designation")
                              return rowErrs.find((e) => e.toLowerCase().includes("designation"));
                            if (f === "vertical")
                              return rowErrs.find((e) => e.toLowerCase().includes("vertical"));
                            if (f === "role")
                              return rowErrs.find((e) => e.toLowerCase().includes("role"));
                            if (f === "managereid" || f === "manager")
                              return rowErrs.find((e) => e.toLowerCase().includes("manager"));
                            return null;
                          };

                          return (
                            <div
                              key={rIdx}
                              className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                                isFaulty
                                  ? "bg-rose-500/[0.02] border-rose-500/20 hover:border-rose-500/35 shadow-sm shadow-rose-500/[0.02]"
                                  : "bg-emerald-500/[0.02] border-emerald-500/20 hover:border-emerald-500/35 shadow-sm shadow-emerald-500/[0.02]"
                              }`}
                            >
                              {/* Glowing side accent line */}
                              <div
                                className={`absolute top-0 bottom-0 left-0 w-1 ${
                                  isFaulty ? "bg-danger/60" : "bg-success/60"
                                }`}
                              />

                              {/* Row metadata header */}
                              <div className="flex items-center justify-between mb-3 text-[10px] font-bold pl-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-text-primary font-black text-xs">
                                    Record #{rIdx + 1}
                                  </span>
                                  {row.name && (
                                    <span className="text-text-secondary font-medium">
                                      ({row.name})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                      isFaulty
                                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    }`}
                                  >
                                    {isFaulty ? `⚠️ ${rowErrs.length} Faults` : "✓ Validated"}
                                  </span>
                                  {handleRemoveRow && (
                                    <button
                                      onClick={() => handleRemoveRow(rIdx)}
                                      className="text-text-tertiary hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer hover:bg-background-portal"
                                      title="Remove record"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Row input field grids */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pl-1">
                                {[
                                  { key: "eid", label: "Employee ID (EID)" },
                                  { key: "name", label: "Full Name" },
                                  { key: "email", label: "Email Address" },
                                  { key: "designation", label: "Job Designation" },
                                  { key: "vertical", label: "Business Vertical" },
                                  { key: "role", label: "Security Role" },
                                  { key: "managerEid", label: "Reporting Manager EID" },
                                ].map(({ key: field, label }) => {
                                  const isEditing =
                                    editingCell?.rowIndex === rIdx && editingCell?.field === field;
                                  const fieldErr = getFieldError(field);
                                  const isFieldFaulty = !!fieldErr;

                                  return (
                                    <div
                                      key={field}
                                      className={`space-y-1 ${
                                        field === "managerEid" ? "md:col-span-2" : ""
                                      }`}
                                    >
                                      <label
                                        className={`text-[9px] font-black uppercase tracking-wider block ${
                                          isFieldFaulty ? "text-rose-400" : "text-text-tertiary"
                                        }`}
                                      >
                                        {label}
                                      </label>

                                      {isEditing ? (
                                        field === "role" ? (
                                          <select
                                            defaultValue={row[field] || "user"}
                                            onBlur={(e) => {
                                              handleCellEdit(rIdx, field, e.target.value);
                                              setEditingCell(null);
                                            }}
                                            onChange={(e) => {
                                              handleCellEdit(rIdx, field, e.target.value);
                                              setEditingCell(null);
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-surface-elevated border border-brand-accent rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
                                          >
                                            <option value="user">user</option>
                                            <option value="admin">admin</option>
                                            <option value="super_admin">super_admin</option>
                                            <option value="read_only_admin">read_only_admin</option>
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            defaultValue={row[field] || ""}
                                            onBlur={(e) => {
                                              handleCellEdit(rIdx, field, e.target.value);
                                              setEditingCell(null);
                                            }}
                                            onKeyDown={(e: any) => {
                                              if (e.key === "Enter") {
                                                handleCellEdit(rIdx, field, e.target.value);
                                                setEditingCell(null);
                                              }
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-surface-elevated border border-brand-accent rounded-xl text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-accent"
                                          />
                                        )
                                      ) : (
                                        <div
                                          onDoubleClick={() =>
                                            setEditingCell({ rowIndex: rIdx, field })
                                          }
                                          className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-text truncate transition-all duration-200 border flex items-center justify-between ${
                                            isFieldFaulty
                                              ? "bg-rose-500/[0.04] border-rose-500/20 text-rose-300"
                                              : "bg-background-portal/60 border-input-border/70 text-text-primary hover:border-brand-accent/40"
                                          }`}
                                        >
                                          <span className="truncate">
                                            {row[field] || (
                                              <span className="text-text-tertiary font-normal italic">
                                                not specified
                                              </span>
                                            )}
                                          </span>
                                          <span className="opacity-0 group-hover:opacity-40 text-[9px] font-normal pl-1.5">
                                            ✏️
                                          </span>
                                        </div>
                                      )}

                                      {/* Specific Field Error Message */}
                                      {isFieldFaulty && (
                                        <span className="text-[9px] font-medium text-rose-400 block pt-0.5 leading-tight">
                                          ⚠️ {fieldErr}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 3. MODULE: STRUCTURAL METADATA & HIERARCHY BUILDER ── */}
        {sub === "metadata" && (
          <div className="flex-1 flex min-h-0 animate-fadeIn overflow-hidden">
            {/* Left entities list panel */}
            <div
              className={`bg-sidebar-bg border-r border-border-accent flex flex-col min-h-0 relative ${
                metaLeftMinimized ? "w-12 overflow-hidden" : ""
              }`}
              style={{ width: metaLeftMinimized ? 48 : metaSplitWidth }}
            >
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6">
                {!metaLeftMinimized ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                        Structural Config
                      </h3>
                      <button
                        onClick={() => setMetaLeftMinimized(true)}
                        className="text-xs text-text-tertiary hover:text-text-primary"
                      >
                        ◀
                      </button>
                    </div>

                    {/* Metadata addition form */}
                    <form
                      onSubmit={handleAddMetadata}
                      className="space-y-4 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm"
                    >
                      <h4 className="text-xs font-black uppercase text-text-secondary tracking-widest">
                        Append Node Entity
                      </h4>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                            Class Type
                          </label>
                          <select
                            value={selectedMetaType}
                            onChange={(e) => setSelectedMetaType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl font-bold outline-none"
                          >
                            <option value="vertical">Vertical Unit</option>
                            <option value="job_level">Job Designation Level</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                            Label Name
                          </label>
                          <input
                            type="text"
                            value={metaNameInput}
                            onChange={(e) => setMetaNameInput(e.target.value)}
                            placeholder="e.g. Core Engineering, VP"
                            required
                            className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none"
                          />
                        </div>

                        {selectedMetaType === "vertical" && (
                          <div>
                            <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                              Parent Division
                            </label>
                            <select
                              value={metaParentInput}
                              onChange={(e) => setMetaParentInput(e.target.value)}
                              className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none"
                            >
                              <option value="">Top Level Division</option>
                              {metadata
                                .filter((m) => m.type === "vertical")
                                .map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-brand-accent hover:bg-brand-hover text-white text-xs font-black uppercase rounded-xl shadow transition-all"
                      >
                        Append Entity Node
                      </button>
                    </form>

                    {/* Job levels list configurator */}
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      <span className="text-[9px] font-black uppercase text-text-secondary tracking-widest block">
                        Job Levels Configurator (Rank Order)
                      </span>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                        {metadata
                          .filter((m) => m.type === "job_level")
                          .map((lvl, idx) => (
                            <div
                              key={lvl.id}
                              className="flex items-center justify-between p-3 bg-surface-card border border-border-accent rounded-xl hover:border-brand-accent/20 transition-all group animate-fadeIn"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-brand-accent bg-brand-muted/20 px-2 py-0.5 rounded-lg">
                                  L{idx + 1}
                                </span>
                                <span className="text-xs font-bold text-text-primary">
                                  {lvl.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleMetadataReorder(lvl.id, "up")}
                                  className="p-1 rounded bg-background-portal hover:bg-brand-muted/30 text-text-secondary text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMetadataReorder(lvl.id, "down")}
                                  className="p-1 rounded bg-background-portal hover:bg-brand-muted/30 text-text-secondary text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMetadataDelete(lvl.id)}
                                  className="p-1 rounded hover:bg-rose-500/10 text-rose-500 text-[10px] h-6 w-6 flex items-center justify-center font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setMetaLeftMinimized(false)}
                    className="mx-auto text-xs text-brand-accent font-bold py-4"
                  >
                    ▶
                  </button>
                )}
              </div>

              {/* Resizer Handle */}
              {!metaLeftMinimized && (
                <div
                  className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) =>
                    startResizing(e, metaSplitWidth, "horizontal", 250, 500, setMetaSplitWidth)
                  }
                />
              )}
            </div>

            {/* Right Interactive Hierarchy Map */}
            <div className="flex-1 p-6 flex flex-col min-h-0 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                  Interactive Vertical Division Tree Map
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Click [+] sub-team under any block to append inline sub-vertical structures.
                </p>
              </div>

              <div className="flex-1 bg-surface-card p-6 border border-border-accent rounded-3xl shadow-sm min-h-[400px]">
                {/* Tree Root */}
                <div className="p-4 bg-brand-muted/20 border border-brand-accent/20 rounded-2xl w-fit flex items-center gap-2 shadow-sm">
                  <span className="text-sm">🏢</span>
                  <span className="text-xs font-black text-brand-accent uppercase tracking-wider">
                    SG Forge Corporate HQ Root
                  </span>
                </div>

                {renderTreeNodes(null)}
              </div>
            </div>
          </div>
        )}

        {/* ── 4. MODULE: ACCESS CONTROL & PRIVILEGE MATRIX ── */}
        {sub === "access" && (
          <div className="flex-1 flex min-h-0 animate-fadeIn overflow-hidden">
            {/* Left Admins list panel */}
            <div
              className="bg-sidebar-bg border-r border-border-accent flex flex-col min-h-0 relative"
              style={{ width: accessSplitWidth }}
            >
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                    Administrative Profile Roster
                  </h3>
                  <span className="text-[10px] bg-brand-accent/15 px-2 py-0.5 rounded-full text-brand-accent font-mono font-bold">
                    {adminUsers.length} profiles
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                  {adminUsers.map((admin) => {
                    const isSelected = selectedAdminId === admin.id;
                    return (
                      <div
                        key={admin.id}
                        onClick={() => setSelectedAdminId(admin.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${
                          isSelected
                            ? "bg-surface-card border-brand-accent shadow"
                            : "bg-surface-card/40 border-border-accent hover:border-brand-accent/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate text-text-primary">
                              {admin.name}
                            </p>
                            <p className="text-[10px] text-text-tertiary truncate font-mono mt-0.5">
                              {admin.email}
                            </p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase flex-shrink-0 ${
                              admin.role === "super_admin"
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                : admin.role === "admin"
                                  ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                                  : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            }`}
                          >
                            {admin.role}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resizer Handle */}
              <div
                className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                onMouseDown={(e) =>
                  startResizing(e, accessSplitWidth, "horizontal", 200, 450, setAccessSplitWidth)
                }
              />
            </div>

            {/* Right Privileges checkbox matrix */}
            <div className="flex-1 p-6 flex flex-col min-h-0 overflow-y-auto">
              {selectedAdminId ? (
                (() => {
                  const targetAdmin = adminUsers.find((a) => a.id === selectedAdminId);
                  const matrix = permissionsMatrix[selectedAdminId] || {
                    user_management: { read: false, write: false, execute: false },
                    metadata_config: { read: false, write: false, execute: false },
                    database_console: { read: false, write: false, execute: false },
                    system_audit_logs: { read: false, write: false, execute: false },
                  };

                  return (
                    <div className="space-y-6 max-w-4xl animate-fadeIn">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                            Granular Privileges Matrix: {targetAdmin?.name}
                          </h3>
                          {isSavingPermissions && (
                            <span className="text-[9px] text-text-tertiary italic flex items-center gap-1.5">
                              <span className="w-2 h-2 border border-brand-accent border-t-transparent rounded-full animate-spin"></span>
                              Syncing...
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          Define backend execution context and write restrictions. Checks enforce
                          access security rules instantly.
                        </p>
                      </div>

                      <div className="border border-border-accent rounded-3xl overflow-hidden bg-surface-card shadow-sm">
                        <table className="min-w-full text-xs">
                          <thead className="bg-table-header border-b border-border-accent">
                            <tr>
                              <th className="px-5 py-3 text-left font-black uppercase text-[10px] text-text-secondary">
                                System Module
                              </th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">
                                Read
                              </th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">
                                Write
                              </th>
                              <th className="px-5 py-3 text-center font-black uppercase text-[10px] text-text-secondary w-28">
                                Execute
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-accent/40">
                            {[
                              { id: "user_management", label: "User Directory & Ingestion" },
                              { id: "metadata_config", label: "Structural Org Metadata" },
                              { id: "database_console", label: "Database SQL Console Sandbox" },
                              { id: "system_audit_logs", label: "System Telemetry & Audit Logs" },
                            ].map((mod) => (
                              <tr key={mod.id} className="hover:bg-table-row-hover transition-all">
                                <td className="px-5 py-4 font-bold text-text-primary">
                                  {mod.label}
                                </td>
                                {["read", "write", "execute"].map((v: any) => {
                                  const isChecked = !!(matrix[mod.id] as any)?.[v];
                                  // Super Admin cannot be restricted
                                  const disabled = targetAdmin?.role === "super_admin";

                                  return (
                                    <td key={v} className="px-5 py-4 text-center">
                                      <input
                                        type="checkbox"
                                        checked={disabled ? true : isChecked}
                                        disabled={disabled || isSavingPermissions}
                                        onChange={() =>
                                          handlePermissionToggle(selectedAdminId, mod.id, v)
                                        }
                                        className="h-4.5 w-4.5 rounded border-input-border text-brand-accent focus:ring-brand-accent focus:ring-offset-0 disabled:opacity-50"
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 rounded-2xl bg-brand-muted/20 border border-brand-accent/20 flex gap-3 text-xs text-brand-accent">
                        <span>ℹ</span>
                        <p className="text-[11px] leading-relaxed">
                          Note: Toggling permission checkboxes triggers an immediate asynchronous
                          database mutation. Super Admins are granted bypass override permissions.
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-border-accent rounded-3xl p-10 text-text-tertiary">
                  Please select an administrative profile card to audit or configure privilege
                  matrix parameters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. MODULE: LIVE DB SANDBOX TERMINAL ── */}
        {sub === "database" && (
          <div className="flex-1 flex min-h-0 bg-background-portal text-text-primary animate-fadeIn overflow-hidden">
            {/* Left telemetry panel */}
            {!dbSchemaMinimized ? (
              <div
                className="bg-surface-card border-r border-border-accent flex flex-col min-h-0 relative flex-shrink-0"
                style={{ width: dbSplitWidth }}
              >
                <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">
                      PostgreSQL Engine Telemetry
                    </h3>
                    <button
                      onClick={() => setDbSchemaMinimized(true)}
                      className="text-[10px] text-gray-500 hover:text-gray-300"
                    >
                      ◀ Minimize
                    </button>
                  </div>

                  <div className="space-y-4 text-xs font-mono bg-surface-elevated p-4 rounded-2xl border border-border-accent">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Schema Version:</span>
                      <span className="text-brand-accent font-bold">v1.4.1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">DB Size:</span>
                      <span className="text-emerald-500 font-bold">42.2 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Telemetry Volume:</span>
                      <span className="text-warning-text font-bold">{stats.totalLogs} entries</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">
                      Physical Tables Matrix
                    </span>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                      {[
                        {
                          name: "users",
                          count: stats.totalUsers,
                          cols: [
                            "id (UUID)",
                            "eid (VARCHAR)",
                            "name (VARCHAR)",
                            "email (VARCHAR)",
                            "role (VARCHAR)",
                            "designation_id (UUID)",
                            "vertical_id (UUID)",
                            "manager_id (UUID)",
                            "is_password_changed (BOOL)",
                          ],
                        },
                        {
                          name: "structural_metadata",
                          count: stats.totalMetadata,
                          cols: [
                            "id (UUID)",
                            "type (VARCHAR)",
                            "name (VARCHAR)",
                            "parent_id (UUID)",
                            "sort_order (INT)",
                            "extended_attributes (JSONB)",
                          ],
                        },
                        {
                          name: "system_logs",
                          count: stats.totalLogs,
                          cols: [
                            "id (UUID)",
                            "user_id (UUID)",
                            "action (VARCHAR)",
                            "severity (VARCHAR)",
                            "payload (JSONB)",
                            "ip_address (VARCHAR)",
                            "timestamp (TIMESTAMP)",
                          ],
                        },
                      ].map((tbl) => (
                        <div
                          key={tbl.name}
                          className="p-3 bg-gray-900/40 border border-gray-850 rounded-xl hover:border-brand-accent/40 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1.5 font-mono">
                            <span className="text-xs font-bold text-gray-300">/{tbl.name}</span>
                            <span className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                              {tbl.count} rows
                            </span>
                          </div>

                          <details className="text-[8px] font-mono text-gray-500 cursor-pointer">
                            <summary className="hover:text-gray-300 uppercase tracking-widest outline-none">
                              Schema details
                            </summary>
                            <ul className="mt-1.5 space-y-0.5 pl-2 border-l border-gray-800 text-gray-400">
                              {tbl.cols.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Resizer Handle */}
                <div
                  className="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) =>
                    startResizing(e, dbSplitWidth, "horizontal", 200, 450, setDbSplitWidth)
                  }
                />
              </div>
            ) : (
              <div className="w-12 bg-surface-card border-r border-border-accent flex flex-col p-4">
                <button
                  onClick={() => setDbSchemaMinimized(false)}
                  className="text-[10px] text-text-secondary font-bold mx-auto"
                >
                  ▶
                </button>
              </div>
            )}

            {/* Right SQL Console */}
            <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[9px] text-gray-400 font-mono">
                    SQL ENGINE v1.2
                  </span>
                  <span className="h-2 w-2 rounded-full bg-success shadow shadow-success animate-pulse" />
                </div>

                <button
                  onClick={runSQLQuery}
                  disabled={isQueryRunning}
                  className="px-4.5 py-2 bg-gradient-to-r from-brand-accent to-emerald-500 hover:opacity-90 transition-all rounded-xl text-white font-bold text-xs shadow-md shadow-brand-accent/20 flex items-center gap-2"
                >
                  {isQueryRunning ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Executing...
                    </>
                  ) : (
                    "Run SQL Query"
                  )}
                </button>
              </div>

              {/* SQL Console Input Box (Resizable Height) */}
              <div
                className="relative border border-border-accent bg-surface-card rounded-2xl overflow-hidden flex-shrink-0"
                style={{ height: dbEditorHeight }}
              >
                {/* Syntax Highlight Overlay */}
                <div
                  className="absolute inset-0 p-4 font-mono text-xs whitespace-pre-wrap pointer-events-none overflow-y-auto leading-relaxed select-none"
                  dangerouslySetInnerHTML={{
                    __html: highlightSQLKeywords(sqlQuery),
                  }}
                  style={{ color: "transparent" }}
                />

                <textarea
                  value={sqlQuery}
                  onChange={(e) => handleSqlChange(e.target.value)}
                  placeholder="SELECT * FROM users;"
                  className="absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs text-success focus:outline-none resize-none leading-relaxed overflow-y-auto"
                  style={{ caretColor: "#ffffff" }}
                />

                {/* Suggestions matrix */}
                {showSqlSuggestions && (
                  <div className="absolute left-4 bottom-4 z-50 bg-surface-elevated border border-border-accent rounded-xl p-1.5 space-y-1 shadow-2xl max-w-xs font-mono text-[10px]">
                    {sqlSuggestions.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => insertSuggestion(kw)}
                        className="block w-full text-left px-2.5 py-1 rounded hover:bg-brand-accent text-gray-300 hover:text-white"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                )}

                {/* Vertical Resizer Handle */}
                <div
                  className="h-1 cursor-row-resize absolute bottom-0 left-0 right-0 hover:bg-brand-accent/50 z-10"
                  onMouseDown={(e) =>
                    startResizing(e, dbEditorHeight, "vertical", 120, 400, setDbEditorHeight)
                  }
                />
              </div>

              {/* SQL Result Set Output pane */}
              <div className="flex-1 flex flex-col min-h-0 bg-surface-card border border-border-accent rounded-2xl p-4 overflow-hidden relative">
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest block mb-2">
                  Query Output Response Stream
                </span>

                {queryError && (
                  <div className="flex-1 overflow-auto p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs rounded-xl whitespace-pre-wrap">
                    [ERROR] {queryError}
                  </div>
                )}

                {!queryError && queryResult && (
                  <div className="flex-1 overflow-auto">
                    {queryResult.rows && queryResult.rows.length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-800 text-left font-mono text-[10px] select-text">
                        <thead className="bg-table-header text-text-secondary sticky top-0 z-10">
                          <tr>
                            {Object.keys(queryResult.rows[0]).map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2.5 font-bold uppercase tracking-wider bg-table-header whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-850 text-gray-300">
                          {queryResult.rows.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-gray-900/40">
                              {Object.values(row).map((val: any, cIdx: number) => (
                                <td
                                  key={cIdx}
                                  className="px-3 py-2 whitespace-nowrap truncate max-w-xs"
                                  title={String(val)}
                                >
                                  {val === null ? (
                                    <span className="text-warning italic opacity-50">null</span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 text-center font-mono text-gray-500 text-xs italic">
                        Statement executed successfully. Empty set or records updated.
                      </div>
                    )}
                  </div>
                )}

                {!queryError && !queryResult && (
                  <div className="flex-1 flex items-center justify-center font-mono text-gray-600 text-xs italic">
                    Execute a query in the terminal sandbox above to stream database result records.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 6. MODULE: SYSTEM AUDIT LOGS (Virtual Scrolling) ── */}
        {sub === "logs" && (
          <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 animate-fadeIn relative overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase text-text-primary tracking-wider">
                  System Audit Logs
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Continuous telemetric log streaming. Pruned automatically to 100,000 maximum
                  entries.
                </p>
              </div>

              {/* Status volume indicator */}
              <div className="flex items-center gap-2 bg-surface-card border border-border-accent rounded-xl px-3 py-1.5 text-xs text-text-secondary">
                <span className="font-bold text-text-tertiary">Telemetry Load:</span>
                <span className="font-black text-brand-accent">{stats.totalLogs} / 100,000</span>
                <div className="w-16 h-1.5 bg-background-portal rounded-full overflow-hidden border border-border-accent">
                  <div
                    className="h-full bg-brand-accent"
                    style={{ width: `${Math.min((stats.totalLogs / 100000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-card p-4 border border-border-accent rounded-2xl shadow-sm flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Action, EID, IP..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                />
                <span className="absolute left-2.5 top-2.5 text-text-tertiary">🔍</span>
              </div>

              <div>
                <select
                  value={logSeverityFilter}
                  onChange={(e) => setLogSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs outline-none"
                >
                  <option value="">All Severities</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="flex items-center justify-end text-[10px] text-text-secondary font-bold">
                Showing {filteredLogs.length} events
              </div>
            </div>

            {/* High-density virtualized log table container */}
            <div className="flex-1 border border-border-accent rounded-2xl bg-surface-card shadow-sm min-h-0 flex flex-col">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs table-fixed">
                  <thead className="bg-table-header border-b border-border-accent">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-36">
                        Timestamp
                      </th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-20">
                        Severity
                      </th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-48">
                        Action
                      </th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-36">
                        Operator
                      </th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary w-28">
                        IP Address
                      </th>
                      <th className="px-4 py-2.5 text-left font-black uppercase text-[9px] text-text-secondary">
                        Payload
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Scroll viewport for virtual rows */}
              <div ref={logParentRef} className="flex-1 overflow-auto">
                <div
                  style={{
                    height: `${logVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {logVirtualizer.getVirtualItems().map((virtualRow) => {
                    const log = filteredLogs[virtualRow.index];
                    if (!log) return null;
                    const logDate = new Date(log.timestamp).toLocaleString();
                    const operatorName = log.user_id
                      ? users.find((u) => u.id === log.user_id)?.name || log.user_id.substring(0, 8)
                      : "System";

                    return (
                      <div
                        key={virtualRow.key}
                        onClick={() => {
                          setSelectedLog(log);
                          setLogDrawerOpen(true);
                        }}
                        className={`absolute left-0 right-0 px-4 py-2.5 border-b border-border-accent/40 font-mono text-[10px] cursor-pointer transition-colors flex items-center ${getLogSeverityColorClass(log.severity)}`}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="w-36 text-text-tertiary truncate">{logDate}</div>
                        <div className="w-20">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${severityBadge(log.severity)}`}
                          >
                            {log.severity}
                          </span>
                        </div>
                        <div className="w-48 font-bold text-text-primary truncate pr-2">
                          {log.action}
                        </div>
                        <div className="w-36 text-text-primary truncate pr-2">{operatorName}</div>
                        <div className="w-28 text-text-secondary truncate">{log.ip_address}</div>
                        <div className="flex-1 text-text-tertiary truncate">
                          {JSON.stringify(log.payload)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PAYLOAD INSIGHT DRAWER ( Radix Focus Trap ) */}
            {logDrawerOpen && selectedLog && (
              <div
                className="absolute top-0 right-0 bottom-0 z-40 bg-sidebar-bg border-l border-border-accent shadow-2xl flex flex-col min-h-0"
                style={{ width: logDrawerWidth }}
              >
                {/* Resizer Handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-accent z-50"
                  onMouseDown={startResizingLogDrawer}
                />

                <FocusScope trapped={true}>
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Drawer Header */}
                    <div className="px-5 py-4 border-b border-border-accent bg-surface-card/25 flex items-center justify-between flex-shrink-0">
                      <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                        Payload Insight drawer
                      </h4>
                      <button
                        onClick={() => {
                          setLogDrawerOpen(false);
                          setSelectedLog(null);
                        }}
                        className="text-text-tertiary hover:text-text-primary text-sm font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Drawer content (Scrollable JSON view) */}
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 font-mono text-[10px]">
                      <div className="grid grid-cols-2 gap-3 bg-background-portal p-3.5 border border-border-accent rounded-2xl text-[10px]">
                        <div>
                          <span className="text-text-tertiary block">Timestamp:</span>
                          <span className="font-bold text-text-secondary">
                            {new Date(selectedLog.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Severity:</span>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${severityBadge(selectedLog.severity)}`}
                          >
                            {selectedLog.severity}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Action:</span>
                          <span className="font-bold text-text-primary">{selectedLog.action}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary block">Operator ID:</span>
                          <span className="font-bold text-text-secondary truncate block">
                            {selectedLog.user_id || "System"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-text-tertiary tracking-widest block">
                          Raw JSON Data Payload
                        </span>
                        <pre className="p-4 bg-background-portal border border-border-accent rounded-2xl overflow-auto text-brand-accent text-xs select-all">
                          {JSON.stringify(selectedLog.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </FocusScope>
              </div>
            )}
          </div>
        )}

        {/* ── 7. MODULE: APP REGISTRY LIFECYCLE ── */}
        {sub === "apps" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-accent pb-4 gap-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-text-primary">
                  Enterprise App Management
                </h1>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Manage app registration, toggle global access, and approve entitlement requests.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-surface-card border border-border-accent/60 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setAppManagementView("registry")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      appManagementView === "registry"
                        ? "bg-brand-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    🔌 Registry Lifecycle
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppManagementView("requests")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      appManagementView === "requests"
                        ? "bg-brand-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    📜 Access Request Queue
                    {adminAccessRequests.filter((r) => r.status.startsWith("pending")).length >
                      0 && (
                      <span className="bg-warning text-text-primary text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-4 text-center">
                        {adminAccessRequests.filter((r) => r.status.startsWith("pending")).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAppManagementView("entitlements");
                      fetchActiveEntitlements();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      appManagementView === "entitlements"
                        ? "bg-brand-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    🔑 Active Entitlements
                  </button>
                </div>

                {appManagementView === "registry" && (
                  <button
                    onClick={scanApps}
                    disabled={isAppsLoading}
                    className="px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    🔄 Scan Apps
                  </button>
                )}
              </div>
            </div>

            {appManagementView === "registry" && !selectedAppForAccess && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Apps Table Column */}
                <div className="xl:col-span-2 space-y-4">
                  {isAppsLoading && appsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-surface-card border border-border-accent rounded-3xl shadow-lg">
                      <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-text-secondary">
                        Loading registered applications...
                      </p>
                    </div>
                  ) : (
                    <div className="bg-surface-card border border-border-accent rounded-3xl shadow-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border-accent bg-surface-card/10 text-text-tertiary font-bold uppercase tracking-wider">
                              <th className="p-4">Application Details</th>
                              <th className="p-4">Entry URL / Slug</th>
                              <th className="p-4">OAuth Credentials</th>
                              <th className="p-4">Health Status</th>
                              <th className="p-4 text-right">Lifecycle Controls</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-accent/40">
                            {appsList.map((app) => {
                              const isSecretRevealed = revealedSecrets[app.id] || false;

                              return (
                                <tr
                                  key={app.id}
                                  className="hover:bg-surface-card/20 transition-colors"
                                >
                                  {/* Application Details */}
                                  <td className="p-4">
                                    <div className="flex items-start gap-3">
                                      <div className="h-9 w-9 rounded-xl bg-surface-elevated text-lg flex items-center justify-center border border-border-accent/30 shadow-sm flex-shrink-0 mt-0.5">
                                        {getAppIcon(app.icon)}
                                      </div>
                                      <div className="space-y-1">
                                        <h3 className="font-black text-text-primary text-sm leading-tight">
                                          {app.name}
                                        </h3>
                                        <span className="text-[10px] text-text-secondary block leading-normal">
                                          {app.description}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                          <span className="px-1.5 py-0.5 rounded bg-background-portal text-text-secondary border border-border-accent text-[9px] font-bold uppercase">
                                            ID: {app.id}
                                          </span>
                                          <span
                                            className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${
                                              app.isIsolatedLifecycle
                                                ? "bg-warning/10 text-warning-text border-warning/25"
                                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
                                            }`}
                                          >
                                            {app.isIsolatedLifecycle ? "Isolated DB" : "Shared DB"}
                                          </span>
                                          {app.isIsolatedLifecycle && app.schemaName && (
                                            <span className="px-1.5 py-0.5 bg-background-portal text-text-secondary border border-border-accent rounded text-[9px] font-mono">
                                              Schema: {app.schemaName}
                                            </span>
                                          )}
                                          {app.targetRules?.minJobLevel !== undefined && (
                                            <span className="px-1.5 py-0.5 bg-background-portal text-text-secondary border border-border-accent rounded text-[9px] font-bold">
                                              Min Level: L{app.targetRules.minJobLevel}
                                            </span>
                                          )}
                                          {app.targetRules?.verticals?.map((v: string) => (
                                            <span
                                              key={v}
                                              className="px-1.5 py-0.5 bg-background-portal text-text-secondary border border-border-accent rounded text-[9px] font-bold"
                                            >
                                              {v === "core-tech-uuid-placeholder"
                                                ? "Engineering"
                                                : v === "exec-uuid-placeholder"
                                                  ? "Executive"
                                                  : v}
                                            </span>
                                          ))}
                                          {(!app.targetRules?.verticals ||
                                            app.targetRules.verticals.length === 0) && (
                                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase">
                                              Global Release
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Entry / Schema */}
                                  <td className="p-4 font-mono text-[10px] text-text-secondary">
                                    <div>
                                      Url:{" "}
                                      <a
                                        href={app.entryUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-brand-accent hover:underline font-bold"
                                      >
                                        {app.entryUrl}
                                      </a>
                                    </div>
                                    <div className="mt-1">
                                      Slug:{" "}
                                      <span className="text-text-primary font-bold">
                                        {app.slug}
                                      </span>
                                    </div>
                                  </td>

                                  {/* OAuth Credentials */}
                                  <td className="p-4 font-mono text-[10px] space-y-1">
                                    <div>
                                      Client ID:{" "}
                                      <span className="text-text-primary font-bold">
                                        {app.clientId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span>Client Secret:</span>
                                      <span className="font-bold text-text-secondary">
                                        {isSecretRevealed ? app.clientSecret : "••••••••••••••••"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRevealedSecrets((prev) => ({
                                            ...prev,
                                            [app.id]: !isSecretRevealed,
                                          }))
                                        }
                                        className="text-[9px] font-sans font-black uppercase text-brand-accent hover:underline ml-1 cursor-pointer"
                                      >
                                        {isSecretRevealed ? "Hide" : "Reveal"}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Health Status */}
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></span>
                                      <div>
                                        <span className="text-[10px] font-bold text-success uppercase block">
                                          Active / Ready
                                        </span>
                                        <span className="text-[9px] text-text-tertiary">
                                          Verified successfully
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Enable/Disable & Actions */}
                                  <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                      {/* Toggle enable */}
                                      <label className="relative inline-flex items-center cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={app.isEnabled}
                                          onChange={() => toggleAppEnable(app.id, app.isEnabled)}
                                          className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-background-portal border border-border-accent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success peer-checked:border-success"></div>
                                        <span className="ml-2 text-[10px] font-bold text-text-secondary hidden sm:inline">
                                          {app.isEnabled ? "Enabled" : "Disabled"}
                                        </span>
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          fetchAppAccessDetails(app.id);
                                          fetchAppAdminDelegation(app.id);
                                        }}
                                        className="px-2.5 py-1.5 bg-brand-muted hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 hover:border-brand-accent/35 rounded-xl font-bold transition-all text-[11px] cursor-pointer"
                                      >
                                        ⚙️ Manage Access
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => removeApp(app.id)}
                                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded-xl font-bold transition-all text-[11px] cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {appsList.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="p-8 text-center text-text-secondary italic"
                                >
                                  No applications currently registered. Click Scan to discover apps.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Manifest Upload & Extension Modules Column */}
                <div className="xl:col-span-1 space-y-6">
                  {/* Register Manifest Card */}
                  <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-lg space-y-4 flex flex-col">
                    <div>
                      <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                        Register New Manifest
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-1">
                        Paste a new extension's{" "}
                        <code className="font-mono text-brand-accent bg-background-portal px-1 py-0.5 rounded">
                          app.json
                        </code>{" "}
                        contents below to dynamically parse and register the manifest.
                      </p>
                    </div>
                    <div className="flex-1 min-h-[220px]">
                      <textarea
                        value={manifestText}
                        onChange={(e) => setManifestText(e.target.value)}
                        className="w-full h-full min-h-[220px] p-3.5 bg-background-portal border border-border-accent rounded-2xl text-[11px] font-mono text-text-primary focus:outline-none focus:border-brand-accent resize-none focus:ring-1 focus:ring-brand-accent/30 placeholder-text-tertiary"
                        placeholder={`{\n  "id": "new-app-slug",\n  "name": "New App Name",\n  "description": "...",\n  "entryPoint": "http://192.168.1.100:5000",\n  "routingMode": "iframe",\n  "database": {\n    "requiresIsolatedSchema": true,\n    "schemaName": "forge_new_app"\n  },\n  "targetRules": {\n    "verticals": ["exec-uuid-placeholder"],\n    "minJobLevel": 2\n  }\n}`}
                      />
                    </div>
                    <button
                      onClick={handleManifestUpload}
                      disabled={!manifestText.trim()}
                      className={`w-full py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                        manifestText.trim()
                          ? "bg-brand-accent text-white hover:bg-brand-hover shadow-lg shadow-brand-accent/20"
                          : "bg-border-accent text-text-tertiary cursor-not-allowed border border-transparent"
                      }`}
                    >
                      Register Extension Manifest
                    </button>
                  </div>

                  {/* Modular App Ecosystem (Extensions Manager) Card */}
                  <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-lg space-y-4">
                    <div>
                      <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                        Modular App Ecosystem
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-1">
                        Toggle sub-applications and extension modules detected in the workspace.
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      {Object.entries(moduleFlags).map(([name, active]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-background-portal border border-border-accent hover:border-brand-accent/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success shadow shadow-success" : "bg-text-tertiary"}`}
                            />
                            <div>
                              <p className="text-xs font-bold text-text-primary leading-tight">
                                {name}
                              </p>
                              <p className="text-[9px] text-text-secondary mt-0.5">
                                {active ? "Active" : "Disabled"}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setModuleFlags((prev) => ({ ...prev, [name]: !prev[name] }))
                            }
                            className={`relative w-9 h-5 rounded-full transition-all ${active ? "bg-brand-accent" : "bg-border-accent"}`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {appManagementView === "registry" && selectedAppForAccess && (
              <div className="space-y-6 animate-fadeIn">
                {/* Back bar */}
                <div className="flex items-center justify-between bg-surface-card border border-border-accent p-4 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedAppForAccess(null);
                        setAppAccessUsers([]);
                        setAppAssignedAdmins([]);
                      }}
                      className="px-3.5 py-1.5 bg-surface-elevated hover:bg-surface-card border border-border-accent hover:border-brand-accent/30 text-xs font-black text-text-primary rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      ← Back to Registry
                    </button>
                    <span className="text-text-tertiary">|</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getAppIcon(selectedAppForAccess.icon)}</span>
                      <div>
                        <h3 className="text-sm font-black text-text-primary">
                          {selectedAppForAccess.name}
                        </h3>
                        <p className="text-[9px] text-text-secondary">
                          App ID: {selectedAppForAccess.id}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick target rules summary */}
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[9px] text-text-tertiary block font-sans">
                        Min Job Level Required
                      </span>
                      <span className="text-text-primary font-bold">
                        L{selectedAppForAccess.targetRules?.minJobLevel || 1}+
                      </span>
                    </div>
                    <div className="text-right border-l border-border-accent/40 pl-4">
                      <span className="text-[9px] text-text-tertiary block font-sans">
                        Vertical Targets
                      </span>
                      <span
                        className="text-text-primary font-bold truncate max-w-[120px] inline-block"
                        title={selectedAppForAccess.targetRules?.verticals?.join(", ")}
                      >
                        {selectedAppForAccess.targetRules?.verticals?.join(", ") || "Global"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left part: Org hierarchy user entitlements tree */}
                  <div className="lg:col-span-2 bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-accent/40 pb-4">
                      <div>
                        <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">
                          Organizational Entitlements Tree
                        </h4>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          Control app visibility and usage permissions hierarchically across the
                          reporting tree.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newExpanded: Record<string, boolean> = {};
                            appAccessUsers.forEach((u) => {
                              newExpanded[u.id] = true;
                            });
                            setExpandedNodes(newExpanded);
                          }}
                          className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent text-[9px] text-text-secondary font-bold uppercase rounded-lg"
                        >
                          Expand All
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedNodes({})}
                          className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-card border border-border-accent text-[9px] text-text-secondary font-bold uppercase rounded-lg"
                        >
                          Collapse All
                        </button>
                      </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search users by name, EID, or designation to configure access..."
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background-portal border border-input-border rounded-xl focus:border-brand-accent outline-none text-xs font-bold text-text-primary"
                      />
                    </div>

                    {/* Hierarchy Legend */}
                    <div className="flex items-center gap-4 text-[10px] text-text-secondary border-b border-border-accent/20 pb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                        <span>Developer Eligible Profile</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-success"></span>
                        <span>Access Active (Granted)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-danger"></span>
                        <span>Access Blocked (Revoked)</span>
                      </div>
                    </div>

                    {isAccessLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-text-tertiary">
                          Resolving user eligibility and entitlement policies...
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {hierarchyRoots.length === 0 ? (
                          <div className="text-center py-12 text-xs text-text-secondary italic">
                            No reporting hierarchy roots resolved in active directory dataset.
                          </div>
                        ) : (
                          hierarchyRoots.map((root) => renderHierarchyNode(root, 0))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right part: Delegation control */}
                  <div className="bg-surface-card border border-border-accent rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="border-b border-border-accent/40 pb-4">
                        <h4 className="text-sm font-black text-text-primary uppercase tracking-wider">
                          App Management Delegation
                        </h4>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          Configure which administrators can review, approve, grant, or revoke
                          permissions for this app.
                        </p>
                      </div>

                      <div className="p-3 bg-surface-elevated/40 border border-border-accent/45 rounded-2xl text-[10px] text-text-secondary leading-relaxed">
                        💡 <span className="font-bold text-text-primary">Super Admins</span> retain
                        complete global ownership over all apps. Here you can delegate operational
                        control to standard{" "}
                        <span className="font-bold text-text-primary">App Admins</span>.
                      </div>

                      {simulatedRole === "super_admin" ? (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-wider text-text-tertiary">
                            Delegate to Administrator
                          </label>
                          <div className="flex gap-2">
                            <select
                              id="delegatedAdminSelect"
                              className="flex-1 px-3 py-2 bg-background-portal border border-input-border rounded-xl text-xs font-bold text-text-primary outline-none"
                            >
                              <option value="">-- Select Administrator --</option>
                              {appAllAdmins
                                .filter((adm) => !appAssignedAdmins.some((a) => a.id === adm.id))
                                .map((adm) => (
                                  <option key={adm.id} value={adm.id}>
                                    {adm.name} ({adm.eid} - {adm.role})
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              disabled={isUpdatingDelegation}
                              onClick={() => {
                                const sel = document.getElementById(
                                  "delegatedAdminSelect",
                                ) as HTMLSelectElement;
                                if (sel?.value) {
                                  handleUpdateAdminDelegation(sel.value, "add");
                                  sel.value = "";
                                }
                              }}
                              className="px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-warning/10 border border-warning/20 text-warning-text rounded-xl text-[10px] font-bold">
                          ⚠️ Management Delegation controls are read-only for App Admins.
                        </div>
                      )}

                      <div className="space-y-2.5 pt-4">
                        <span className="text-[9px] font-black uppercase tracking-wider text-text-tertiary block">
                          Assigned App Managers ({appAssignedAdmins.length})
                        </span>
                        {isAdminsLoading ? (
                          <div className="flex justify-center items-center py-6">
                            <span className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></span>
                          </div>
                        ) : appAssignedAdmins.length === 0 ? (
                          <p className="text-[10px] text-text-secondary italic">
                            No admins currently assigned. Only Super Admins can manage this
                            application.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {appAssignedAdmins.map((admin) => (
                              <div
                                key={admin.id}
                                className="p-3 bg-background-portal border border-border-accent/40 rounded-xl flex items-center justify-between hover:border-brand-accent/20 transition-all"
                              >
                                <div>
                                  <span className="font-extrabold text-xs text-text-primary block">
                                    {admin.name}
                                  </span>
                                  <span className="text-[9px] text-text-tertiary block mt-0.5">
                                    {admin.eid} ·{" "}
                                    <span className="uppercase text-brand-accent font-black">
                                      {admin.role}
                                    </span>
                                  </span>
                                </div>
                                {simulatedRole === "super_admin" && (
                                  <button
                                    type="button"
                                    disabled={isUpdatingDelegation}
                                    onClick={() => handleUpdateAdminDelegation(admin.id, "remove")}
                                    className="px-2 py-1 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 hover:border-danger/35 text-[9px] font-black uppercase rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAppForAccess(null);
                        setAppAccessUsers([]);
                        setAppAssignedAdmins([]);
                      }}
                      className="w-full py-2 bg-surface-elevated hover:bg-surface-card border border-border-accent text-xs font-black text-text-primary rounded-xl transition-all text-center cursor-pointer"
                    >
                      Close Control Panel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {appManagementView === "requests" &&
              (isRequestsLoading && adminAccessRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-text-secondary">Loading pending access requests...</p>
                </div>
              ) : (
                <div className="bg-surface-card border border-border-accent rounded-3xl shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-accent bg-surface-card/10 text-text-tertiary font-bold uppercase tracking-wider">
                          <th className="p-4 w-44">Requester / Role</th>
                          <th className="p-4 w-44">App / Created On</th>
                          <th className="p-4">Reason & Justification</th>
                          <th className="p-4 w-32">Scope</th>
                          <th className="p-4 w-44">Status</th>
                          <th className="p-4 w-72">Action / Review Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-accent/40">
                        {adminAccessRequests.map((req) => {
                          const isPending = req.status.startsWith("pending");
                          const isSubmitting = isSubmittingRequestAction[req.id] || false;
                          const notesValue = requestActionNotes[req.id] || "";

                          let statusClass =
                            "bg-surface-elevated text-text-secondary border-border-accent";
                          let statusLabel = req.status;

                          if (req.status === "pending_app_admin") {
                            statusClass = "bg-warning/10 border-warning/20 text-warning-text";
                            statusLabel = "Pending App Admin";
                          } else if (req.status === "pending_super_admin") {
                            statusClass = "bg-warning/10 border-warning/20 text-warning-text";
                            statusLabel = "Pending Super Admin";
                          } else if (req.status === "approved") {
                            statusClass = "bg-success/15 border-success/20 text-success";
                            statusLabel = "Approved";
                          } else if (req.status === "rejected") {
                            statusClass = "bg-danger/15 border-danger/20 text-danger";
                            statusLabel = "Rejected";
                          }

                          return (
                            <tr key={req.id} className="hover:bg-surface-card/20 transition-colors">
                              {/* Requester */}
                              <td className="p-4">
                                <span className="font-bold text-text-primary text-sm block">
                                  {req.requesterName}
                                </span>
                                <span className="text-[10px] text-text-tertiary block font-mono mt-0.5">
                                  ID: {req.requesterId}
                                </span>
                              </td>

                              {/* App & Date */}
                              <td className="p-4">
                                <span className="font-bold text-text-primary block">
                                  {req.appName}
                                </span>
                                <span className="text-[10px] text-text-tertiary block mt-0.5">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </td>

                              {/* Reason */}
                              <td className="p-4 text-[11px] text-text-secondary leading-relaxed max-w-xs break-words">
                                "{req.reason}"
                              </td>

                              {/* Scope */}
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

                              {/* Status Badge */}
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>

                              {/* Action Controls */}
                              <td className="p-4">
                                {isPending ? (
                                  <div className="space-y-2">
                                    <textarea
                                      rows={2}
                                      value={notesValue}
                                      onChange={(e) =>
                                        setRequestActionNotes((prev) => ({
                                          ...prev,
                                          [req.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Add review feedback notes (optional)..."
                                      className="w-full px-2 py-1 bg-background-portal border border-input-border focus:border-brand-accent rounded-lg text-[10px] resize-none outline-none leading-normal text-text-primary"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTicket(req);
                                          fetchTicketMessages(req.id);
                                        }}
                                        className="px-2.5 py-1 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white border border-brand-accent/20 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                                      >
                                        💬 Discuss / Ticket
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleReviewAccessRequest(req.id, "rejected")
                                        }
                                        disabled={isSubmitting}
                                        className="px-2.5 py-1 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 hover:border-danger/35 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleReviewAccessRequest(req.id, "approved")
                                        }
                                        disabled={isSubmitting}
                                        className="px-2.5 py-1 bg-success/10 hover:bg-success/20 text-success border border-success/20 hover:border-success/35 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] text-text-secondary leading-normal max-w-[200px] break-words italic">
                                      {req.notes || (
                                        <span className="text-text-tertiary opacity-40">
                                          No review comments left.
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTicket(req);
                                        fetchTicketMessages(req.id);
                                      }}
                                      className="px-2 py-0.5 bg-surface-elevated hover:bg-surface-card border border-border-accent text-text-secondary rounded text-[9px] font-bold transition-all cursor-pointer"
                                    >
                                      💬 View Ticket Thread
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {adminAccessRequests.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-10 text-center text-text-secondary italic">
                              No access requests in the queue.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

            {appManagementView === "entitlements" &&
              (isEntitlementsLoading && activeEntitlements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-text-secondary">Loading active app entitlements...</p>
                </div>
              ) : (
                <div className="bg-surface-card border border-border-accent rounded-3xl shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-accent bg-surface-card/10 text-text-tertiary font-bold uppercase tracking-wider">
                          <th className="p-4 w-48">Application Name</th>
                          <th className="p-4 w-44">Subject Type / Name</th>
                          <th className="p-4 w-32">Access Type</th>
                          <th className="p-4 w-44">Granted By</th>
                          <th className="p-4 w-44">Granted On</th>
                          <th className="p-4 w-32 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-accent/40">
                        {activeEntitlements.map((ent) => {
                          const isRevoking = isRevokingEntitlement[ent.id] || false;

                          let subjectLabel = "";
                          let subjectSub = "";
                          if (ent.subjectType === "user") {
                            subjectLabel = ent.userName || "Unknown User";
                            subjectSub = ent.userEid
                              ? `EID: ${ent.userEid}`
                              : `ID: ${ent.subjectId}`;
                          } else {
                            subjectLabel = ent.nodeName || "Unknown Node";
                            subjectSub = `Org Node (${ent.nodeType || "N/A"})`;
                          }

                          return (
                            <tr key={ent.id} className="hover:bg-surface-card/20 transition-colors">
                              {/* Application Name */}
                              <td className="p-4">
                                <span className="font-bold text-text-primary text-sm block">
                                  {ent.appName}
                                </span>
                                <span className="text-[10px] text-text-tertiary block font-mono mt-0.5">
                                  App ID: {ent.appId}
                                </span>
                              </td>

                              {/* Subject Type / Name */}
                              <td className="p-4">
                                <span className="font-bold text-text-primary block">
                                  {subjectLabel}
                                </span>
                                <span className="text-[10px] text-text-tertiary block mt-0.5">
                                  {ent.subjectType === "user" ? "👤 " : "🏢 "} {subjectSub}
                                </span>
                              </td>

                              {/* Access Type */}
                              <td className="p-4 font-mono text-[10px] uppercase">
                                <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-accent text-text-secondary font-bold">
                                  {ent.accessType}
                                </span>
                              </td>

                              {/* Granted By */}
                              <td className="p-4 font-mono text-[10px]">
                                <span className="text-text-secondary">
                                  {ent.grantedByName || "System"}
                                </span>
                              </td>

                              {/* Granted On */}
                              <td className="p-4 text-text-secondary">
                                {new Date(ent.createdAt).toLocaleDateString()}
                              </td>

                              {/* Actions */}
                              <td className="p-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRevokeEntitlement(ent.id)}
                                  disabled={isRevoking}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded-xl font-bold transition-all text-[11px] cursor-pointer disabled:opacity-50"
                                >
                                  {isRevoking ? "Revoking..." : "Revoke"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {activeEntitlements.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-10 text-center text-text-secondary italic">
                              No active app entitlements found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>

      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <FocusScope trapped={true}>
            <div className="w-full max-w-lg bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border-accent bg-surface-card/10 flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-wider text-text-primary">
                  {userModalMode === "edit"
                    ? "Edit Personnel Record file"
                    : "Add Single Personnel profile"}
                </h3>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-text-tertiary hover:text-text-primary text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={saveSingleUser} className="p-5 space-y-4">
                {userModalError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold font-mono">
                    [FAULT] {userModalError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. E0123"
                      required
                      disabled={userModalMode === "edit"}
                      value={userForm.eid}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, eid: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="jane@company.com"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-background-portal border border-input-border focus:border-brand-accent rounded-xl outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      System Role
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-background-portal border border-input-border rounded-xl outline-none font-bold"
                    >
                      <option value="user">User (Standard)</option>
                      <option value="admin">Admin</option>
                      <option value="read_only_admin">Read-Only Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Job Designation
                    </label>
                    <select
                      value={userForm.designationId}
                      onChange={(e) =>
                        setUserForm((prev) => ({ ...prev, designationId: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">Unassigned</option>
                      {metadata
                        .filter((m) => m.type === "job_level")
                        .map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Vertical Department
                    </label>
                    <select
                      value={userForm.verticalId}
                      onChange={(e) =>
                        setUserForm((prev) => ({ ...prev, verticalId: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">Corporate HQ</option>
                      {metadata
                        .filter((m) => m.type === "vertical")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-text-tertiary block mb-1">
                      Direct Manager
                    </label>
                    <select
                      value={userForm.managerId}
                      onChange={(e) =>
                        setUserForm((prev) => ({ ...prev, managerId: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-background-portal border border-input-border rounded-xl outline-none"
                    >
                      <option value="">No Manager (Root)</option>
                      {users
                        .filter((u) => u.id !== userForm.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.eid})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-accent/40 flex items-center justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2 border border-border-accent rounded-xl text-xs hover:bg-background-portal text-text-secondary font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userModalLoading}
                    className="px-5 py-2 bg-brand-accent hover:bg-brand-hover disabled:opacity-40 text-white font-bold text-xs uppercase rounded-xl transition-all shadow flex items-center gap-2"
                  >
                    {userModalLoading ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          </FocusScope>
        </div>
      )}

      {/* Ticket Details & Discussion Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-surface-card border border-border-accent rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] max-h-[700px]">
            {/* Left Column: Metadata */}
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
    </div>
  );
}
