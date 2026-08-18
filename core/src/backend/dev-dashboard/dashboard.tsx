import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  Folder,
  GitBranch,
  HelpCircle,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Square,
  Table,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

// Global styles loaded from variables
const themeNames: Record<string, string> = {
  default: "Midnight Theme",
  light: "Light Theme",
  dark: "Dark Theme",
  "solarized-dark": "Solarized Dark",
  "solarized-light": "Solarized Light",
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // App tabs
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "overview";
  });
  // Unit test compatibility hook
  const _activeTabId = activeTab;

  // Panel sizing & state
  const [_sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem("sidebarWidth") || "260", 10);
  });
  const [_sidebarCollapsed, _setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  // DB Explorer sizing
  const [dbSidebarWidth, setDbSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem("dbSidebarWidth") || "280", 10);
  });
  const [dbSidebarCollapsed, setDbSidebarCollapsed] = useState(() => {
    return localStorage.getItem("dbSidebarCollapsed") === "true";
  });

  // UI preferences
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("devCenterTheme") || "default";
  });
  const [compactMode, setCompactMode] = useState(() => {
    return localStorage.getItem("compactMode") === "true";
  });

  // Telemetry stream state
  const [telemetry, setTelemetry] = useState<any>({
    docsDrift: {
      freshnessPercentage: 100,
      totalStaleFiles: 0,
      synchronizedRepos: 1,
      driftGrid: [],
    },
    testCoverage: { lineCoverage: 0, branchCoverage: 0, dirtyCount: 0, coverageMatrix: [] },
    workspaceTopology: { tree: [], details: {} },
    ecosystem: { apps: [], buffer: [], logs: [] },
  });

  // Ecosystem View specific states
  const [selectedAppSlug, setSelectedAppSlug] = useState<string>("");
  const [expandedAppRow, setExpandedAppRow] = useState<string | null>(null);
  const [isCompactRow, setIsCompactRow] = useState<boolean>(false);
  const [microserviceLogs, setMicroserviceLogs] = useState<Record<string, string>>({});
  const [fetchingLogsSlug, setFetchingLogsSlug] = useState<string | null>(null);
  const [actionLoadingSlug, setActionLoadingSlug] = useState<string | null>(null);
  const [autoPollLogs, setAutoPollLogs] = useState<Record<string, boolean>>({});
  const [appLogSearchMap, setAppLogSearchMap] = useState<Record<string, string>>({});
  const [terminalFontSizeMap, setTerminalFontSizeMap] = useState<Record<string, number>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 180,
    slug: 140,
    state: 100,
    port: 100,
    uptime: 120,
  });
  const [auditLogsSearch, setAuditLogsSearch] = useState<string>("");
  const [auditLogsSeverity, setAuditLogsSeverity] = useState<string>("ALL");
  const [terminalHeight, setTerminalHeight] = useState<number>(200);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState<boolean>(false);

  // Overview status API state
  const [overviewData, setOverviewData] = useState<any>({
    tableCount: 0,
    logsCount: 0,
    lastTestRun: null,
    tables: [],
  });
  const [overviewLoading, setOverviewLoading] = useState(false);

  // DB Explorer State
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedTableSchema, setSelectedTableSchema] = useState<any[]>([]);
  const [queryText, setQueryText] = useState("SELECT * FROM users LIMIT 10;");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [fullscreenResults, setFullscreenResults] = useState(false);
  const [dbSchemas, setDbSchemas] = useState<any[]>([]);
  const [dbDatabases, setDbDatabases] = useState<any[]>([]);
  const [dbTriggers, setDbTriggers] = useState<any[]>([]);
  const [dbUsername, setDbUsername] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [isDbElevated, setIsDbElevated] = useState(false);
  const [dbDatabasesExpanded, setDbDatabasesExpanded] = useState(true);
  const [dbSchemasExpanded, setDbSchemasExpanded] = useState(true);
  const [dbTablesExpanded, setDbTablesExpanded] = useState(true);
  const [dbTriggersExpanded, setDbTriggersExpanded] = useState(true);

  // System Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsSeverity, setLogsSeverity] = useState("ALL");
  const [logsSource, setLogsSource] = useState("ALL");
  const [logsSources, setLogsSources] = useState<string[]>([
    "ALL",
    "system",
    "dashboard",
    "lifecycle",
    "telemetry",
    "watcher",
    "test-runner",
    "query-console",
  ]);
  const [logsAutoPoll, setLogsAutoPoll] = useState("off");
  const [expandedLogId, setExpandedLogId] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // Test Runner Console State
  const [testConsole, setTestConsole] = useState(
    "Waiting to trigger testing execution pipeline...",
  );
  const [runningTests, setRunningTests] = useState(false);
  const [testRunTime, setTestRunTime] = useState("-");
  const [testSummaryPill, setTestSummaryPill] = useState<any>(null);

  // Modals / Overlays
  const [activeDiff, setActiveDiff] = useState<any>(null);
  const [selectedTopologyNode, setSelectedTopologyNode] = useState<string>("core");

  // Search filter for code coverage
  const [coverageSearch, setCoverageSearch] = useState("");
  const [coverageFilterLow, setCoverageFilterLow] = useState(false);

  // SSE Stream connection status
  const [sseStatus, setSseStatus] = useState<"connected" | "connecting" | "disconnected">(
    "connecting",
  );

  // Custom Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "error" | "success" | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: "info" | "error" | "success" = "info") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, 4500);
  };

  // Dropdown States
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [pollMenuOpen, setPollMenuOpen] = useState(false);
  const [severityMenuOpen, setSeverityMenuOpen] = useState(false);
  const [queryTemplateMenuOpen, setQueryTemplateMenuOpen] = useState(false);

  // Org Hierarchy CSV validator states
  const [csvPaste, setCsvPaste] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);

  // Refs for resizers
  const sidebarResizerRef = useRef<boolean>(false);
  const dbResizerRef = useRef<boolean>(false);

  // 1. Initial Authentication & Theme Check
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (compactMode) {
      document.body.classList.add("compact-mode");
    } else {
      document.body.classList.remove("compact-mode");
    }

    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          const check = await res.json();
          if (check.authenticated) {
            setIsAuthenticated(true);
            refreshOverview();
            loadDbExplorerData();
            loadTelemetryLogs();
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error("API server unreachable.", e);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    verifyAuth();
  }, [theme, compactMode]);

  // 2. Server-Sent Events / Telemetry Stream Connection
  useEffect(() => {
    if (!isAuthenticated) {
      setSseStatus("disconnected");
      return;
    }

    setSseStatus("connecting");
    const sse = new EventSource("/api/telemetry", { withCredentials: true });

    sse.onopen = () => {
      setSseStatus("connected");
    };

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload) {
          if (payload.type === "init" || payload.type === "update") {
            setTelemetry(payload.data);
          } else {
            setTelemetry((prev: any) => ({
              ...prev,
              ...payload,
            }));
          }
        }
        setSseStatus("connected");
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    sse.onerror = () => {
      if (sse.readyState === EventSource.CONNECTING) {
        setSseStatus("connecting");
      } else if (sse.readyState === EventSource.CLOSED) {
        setSseStatus("disconnected");
      }
    };

    return () => {
      sse.close();
      setSseStatus("disconnected");
    };
  }, [isAuthenticated]);

  // 3. Tab Cache
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
    if (activeTab === "overview" && isAuthenticated) {
      refreshOverview();
    }
  }, [activeTab, isAuthenticated]);

  // 4. Logs auto-polling
  useEffect(() => {
    if (!isAuthenticated || logsAutoPoll === "off") return;
    const interval = setInterval(
      () => {
        if (activeTab === "logs") {
          loadTelemetryLogs(true);
        } else if (activeTab === "overview") {
          refreshOverview(true);
        }
      },
      parseInt(logsAutoPoll, 10),
    );

    return () => clearInterval(interval);
  }, [isAuthenticated, logsAutoPoll, activeTab]);

  // 4.5. Container Logs auto-polling
  useEffect(() => {
    if (!isAuthenticated || !expandedAppRow) return;
    if (!autoPollLogs[expandedAppRow]) return;

    const interval = setInterval(() => {
      fetchMicroserviceLogs(expandedAppRow);
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, expandedAppRow, autoPollLogs]);

  // --- Handlers & API Operations ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 200) {
        setIsAuthenticated(true);
        refreshOverview();
        loadDbExplorerData();
        loadTelemetryLogs();
      } else {
        const err = await res.json();
        setAuthError(err.error || "Authentication Failed");
      }
    } catch (_e) {
      setAuthError("Connection failed to backend daemon server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      setIsAuthenticated(false);
      setTelemetry({
        docsDrift: {
          freshnessPercentage: 100,
          totalStaleFiles: 0,
          synchronizedRepos: 1,
          driftGrid: [],
        },
        testCoverage: { lineCoverage: 0, branchCoverage: 0, dirtyCount: 0, coverageMatrix: [] },
        workspaceTopology: { tree: [], details: {} },
      });
    } catch (e) {
      console.error(e);
    }
  };

  async function refreshOverview(background = false) {
    if (!background) setOverviewLoading(true);
    try {
      const res = await fetch("/api/status");
      if (res.status === 200) {
        const data = await res.json();
        setOverviewData(data);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadDbExplorerData() {
    try {
      const res = await fetch("/api/tables");
      if (res.status === 200) {
        const data = await res.json();
        setDbTables(data.tables || []);
        setDbSchemas(data.schemas || []);
        setDbDatabases(data.databases || []);
        setDbTriggers(data.triggers || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const selectExplorerTable = (tableName: string) => {
    setSelectedTable(tableName);
    const tbl = dbTables.find((t) => t.name === tableName);
    if (tbl) {
      setSelectedTableSchema(tbl.columns || []);
      setQueryText(`SELECT * FROM "${tableName}" LIMIT 20;`);
    }
  };

  const runQuery = async () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryError("");
    setQueryResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          dbUser: dbUsername || undefined,
          dbPassword: dbPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 200) {
        setQueryResult(data);
        loadDbExplorerData(); // Reload table counts
      } else {
        setQueryError(data.error || "SQL Query failed.");
      }
    } catch (_e) {
      setQueryError("Server transmission failed.");
    } finally {
      setQueryLoading(false);
    }
  };

  async function loadTelemetryLogs(background = false) {
    if (!background) setLogsLoading(true);
    try {
      const url = new URL("/api/logs", window.location.origin);
      if (logsSearch) url.searchParams.append("search", logsSearch);
      if (logsSeverity !== "ALL") url.searchParams.append("severity", logsSeverity);
      if (logsSource !== "ALL") url.searchParams.append("source", logsSource);

      const res = await fetch(url.toString());
      if (res.status === 200) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.sources) setLogsSources(data.sources);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }

  async function fetchMicroserviceLogs(slug: string) {
    setFetchingLogsSlug(slug);
    try {
      const res = await fetch(`/api/microservices/logs?slug=${slug}`);
      const data = await res.json();
      if (data.logs) {
        setMicroserviceLogs((prev) => ({ ...prev, [slug]: data.logs }));
      } else if (data.error) {
        setMicroserviceLogs((prev) => ({ ...prev, [slug]: `Error: ${data.error}` }));
      }
    } catch (e: any) {
      setMicroserviceLogs((prev) => ({ ...prev, [slug]: `Failed to fetch logs: ${e.message}` }));
    } finally {
      setFetchingLogsSlug(null);
    }
  }

  const handleMicroserviceAction = async (slug: string, action: "start" | "stop" | "restart") => {
    setActionLoadingSlug(slug);
    try {
      const res = await fetch("/api/microservices/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Container "${slug}" successfully triggered: ${action}`, "success");
        setTimeout(() => fetchMicroserviceLogs(slug), 1000);
      } else if (data.error) {
        showToast(`Failed: ${data.error}`, "error");
      }
    } catch (e: any) {
      showToast(`Error running action: ${e.message}`, "error");
    } finally {
      setActionLoadingSlug(null);
    }
  };

  // Debounced search for logs
  const timer = useRef<any>(null);
  const handleLogsSearchChange = (val: string) => {
    setLogsSearch(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      loadTelemetryLogs();
    }, 400);
  };

  const triggerTestPipeline = async () => {
    setRunningTests(true);
    setTestConsole("Executing test suites... checking structural coverage profiles...\n\n");
    setTestSummaryPill(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/run-tests", { method: "POST" });
      const data = await res.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      setTestRunTime(`Completed in ${elapsed}s`);
      setTestConsole(data.rawOutput || "No output received.");
      setTestSummaryPill({ passed: data.passed, failed: data.failed });
      refreshOverview();
    } catch (_e) {
      setTestConsole("Test runner communication error.");
    } finally {
      setRunningTests(false);
    }
  };

  const viewDiff = async (codePath: string, docPath: string) => {
    try {
      const res = await fetch(
        `/api/diff?codePath=${encodeURIComponent(codePath)}&docPath=${encodeURIComponent(docPath)}`,
      );
      const data = await res.json();
      setActiveDiff({ codePath, docPath, diff: data.diff });
    } catch (_e) {
      console.error("Failed to retrieve drift diff details.");
    }
  };

  // Resizing Logic: Sidebar
  const _initSidebarDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizerRef.current = true;
    document.addEventListener("mousemove", handleSidebarDrag);
    document.addEventListener("mouseup", stopSidebarDrag);
  };

  const handleSidebarDrag = (e: MouseEvent) => {
    if (!sidebarResizerRef.current) return;
    let newWidth = e.clientX;
    if (newWidth < 160) newWidth = 160;
    if (newWidth > 450) newWidth = 450;
    setSidebarWidth(newWidth);
    localStorage.setItem("sidebarWidth", newWidth.toString());
  };

  const stopSidebarDrag = () => {
    sidebarResizerRef.current = false;
    document.removeEventListener("mousemove", handleSidebarDrag);
    document.removeEventListener("mouseup", stopSidebarDrag);
  };

  // Resizing Logic: DB Sidebar
  const initDbDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dbResizerRef.current = true;
    document.addEventListener("mousemove", handleDbDrag);
    document.addEventListener("mouseup", stopDbDrag);
  };

  const handleDbDrag = (e: MouseEvent) => {
    if (!dbResizerRef.current) return;
    const parentLeft = document.getElementById("dbLayout")?.getBoundingClientRect().left || 0;
    let newWidth = e.clientX - parentLeft;
    if (newWidth < 180) newWidth = 180;
    if (newWidth > 500) newWidth = 500;
    setDbSidebarWidth(newWidth);
    localStorage.setItem("dbSidebarWidth", newWidth.toString());
  };

  const stopDbDrag = () => {
    dbResizerRef.current = false;
    document.removeEventListener("mousemove", handleDbDrag);
    document.removeEventListener("mouseup", stopDbDrag);
  };

  // Formatting helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
  };

  // Basic HTML markdown parser
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-primary mt-3 mb-1">$1</h4>')
      .replace(
        /^## (.*$)/gim,
        '<h3 class="text-base font-bold text-primary mt-4 mb-2 border-b border-borderColor pb-1">$1</h3>',
      )
      .replace(/^# (.*$)/gim, '<h2 class="text-lg font-extrabold text-white mt-6 mb-3">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
      .replace(
        /^\s*[-*]\s+(.*$)/gim,
        '<li class="list-disc ml-5 text-xs text-textMuted py-0.5">$1</li>',
      )
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="bg-bgConsole text-textConsole p-3 rounded-lg border border-borderColor font-mono text-xs my-2 overflow-x-auto">$1</pre>',
      )
      .replace(
        /`(.*?)`/g,
        '<code class="bg-bgConsole text-primary-hover px-1.5 py-0.5 rounded font-mono text-xs">$1</code>',
      )
      .replace(/\n$/gim, "<br />");

    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="space-y-1 text-xs text-textMuted leading-relaxed"
      />
    );
  };

  // Git Diff Highlighter
  const renderDiffLines = (diffText: string) => {
    if (!diffText)
      return (
        <div className="text-textMuted text-xs">No difference detected. Code matches exactly.</div>
      );
    const lines = diffText.split("\n");
    return lines.map((line, idx) => {
      let className = "text-textMain";
      if (line.startsWith("+"))
        className = "text-green-400 bg-green-950/20 px-2 border-l-2 border-green-500 py-0.5";
      else if (line.startsWith("-"))
        className = "text-red-400 bg-red-950/20 px-2 border-l-2 border-red-500 py-0.5";
      else if (line.startsWith("@@"))
        className = "text-purple-400 font-bold bg-purple-950/10 px-2 py-0.5";
      else if (
        line.startsWith("diff") ||
        line.startsWith("index") ||
        line.startsWith("---") ||
        line.startsWith("+++")
      )
        className = "text-yellow-500 font-semibold bg-slate-900/40 px-2";

      return (
        <div
          key={idx}
          className={`font-mono text-xs py-0.5 whitespace-pre-wrap leading-relaxed ${className}`}
        >
          {line}
        </div>
      );
    });
  };

  // Syntax highlighting for JSON string logs payload
  const formatJSONPayload = (payload: any) => {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    return raw;
  };

  // --- Sub-View Renderers ---

  // VIEW 1: Documentation Drift View
  const renderDocsDriftView = () => {
    const driftData = telemetry.docsDrift;
    const freshness = driftData.freshnessPercentage;

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex items-center justify-between shadow-lg hover:border-borderColorGlow transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
                Overall Freshness
              </span>
              <span className="text-3xl font-extrabold text-white">{freshness}%</span>
              <span className="text-xs text-textMuted">Markdown doc synchronizations</span>
            </div>

            {/* Animated SVG Radial Gauge */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke={freshness === 100 ? "var(--success)" : "var(--warning)"}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - freshness / 100)}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute font-bold text-xs">{freshness}%</div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-lg hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Total Stale Files
            </span>
            <span
              className={`text-3xl font-extrabold ${driftData.totalStaleFiles > 0 ? "text-warning" : "text-success"}`}
            >
              {driftData.totalStaleFiles}
            </span>
            <span className="text-xs text-textMuted">Code changes ahead of documentation</span>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-lg hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Synchronized Repos
            </span>
            <span className="text-3xl font-extrabold text-primary">
              {driftData.synchronizedRepos}
            </span>
            <span className="text-xs text-textMuted">Monorepo codebase context</span>
          </div>
        </div>

        {/* Drift Grid Table */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-borderColor flex justify-between items-center bg-bgTh">
            <h3 className="text-sm font-semibold text-white">Documentation Sync Index</h3>
            <span className="text-xs bg-statusPillBg border border-borderColor text-textMuted px-2 py-1 rounded">
              Live Watcher Engine
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bgTh/50 text-textMuted font-bold border-b border-borderColor">
                  <th className="px-6 py-3.5">Target File</th>
                  <th className="px-6 py-3.5">Mapped Documentation</th>
                  <th className="px-6 py-3.5">Synchronization Health</th>
                  <th className="px-6 py-3.5">Age Delta</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor">
                {driftData.driftGrid?.map((row: any) => (
                  <tr key={row.id} className="hover:bg-tableRowHover transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary">{row.fileName}</td>
                    <td className="px-6 py-4 text-textMuted font-mono text-[11px]">
                      {row.docPath}
                    </td>
                    <td className="px-6 py-4">
                      {row.syncHealth.includes("Outdated") ? (
                        <span className="inline-flex items-center gap-1.5 bg-warningGlow border border-warning/30 text-warning px-2.5 py-1 rounded-full font-semibold">
                          <ShieldAlert size={12} />
                          ⚠️ Outdated - Documentation Drifted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-successGlow border border-success/30 text-success px-2.5 py-1 rounded-full font-semibold">
                          <ShieldCheck size={12} />
                          Synchronized
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-textMuted">
                      <span className={row.deltaSeconds > 0 ? "text-warning" : "text-success"}>
                        {row.deltaText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => viewDiff(row.codePath, row.docPath)}
                        className="bg-primary/20 hover:bg-primary text-primary-hover hover:text-white border border-primary/30 px-3 py-1.5 rounded transition-all font-semibold"
                      >
                        View Code Delta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 2: Test Coverage & Regression Analytics
  const renderTestCoverageView = () => {
    const coverage = telemetry.testCoverage;

    // Filtering logic
    const filteredMatrix = coverage.coverageMatrix.filter((item: any) => {
      const matchesSearch =
        item.fileName.toLowerCase().includes(coverageSearch.toLowerCase()) ||
        item.filePath.toLowerCase().includes(coverageSearch.toLowerCase());
      const matchesLow = coverageFilterLow ? item.lineCoverage < 80 : true;
      return matchesSearch && matchesLow;
    });

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Line Coverage
            </span>
            <span className="text-3xl font-extrabold text-success">{coverage.lineCoverage}%</span>
            <div className="w-full bg-borderColor h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-success h-full rounded-full"
                style={{ width: `${coverage.lineCoverage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Branch Coverage
            </span>
            <span className="text-3xl font-extrabold text-accent">{coverage.branchCoverage}%</span>
            <div className="w-full bg-borderColor h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-accent h-full rounded-full"
                style={{ width: `${coverage.branchCoverage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Untested/Stale Files
            </span>
            <span
              className={`text-3xl font-extrabold ${coverage.dirtyCount > 0 ? "text-error animate-pulse" : "text-success"}`}
            >
              {coverage.dirtyCount}
            </span>
            <span className="text-xs text-textMuted">Pulsing triggers waiting verification</span>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md justify-between">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
                TestSuite Runner
              </span>
              {testSummaryPill && (
                <div className="text-[10px] bg-statusPillBg border border-borderColor px-2 py-0.5 rounded">
                  <span className="text-success font-bold">{testSummaryPill.passed}P</span> /{" "}
                  <span className="text-error font-bold">{testSummaryPill.failed}F</span>
                </div>
              )}
            </div>
            <button
              onClick={triggerTestPipeline}
              disabled={runningTests}
              className="bg-primary hover:bg-primaryHover text-white px-3 py-2 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
            >
              <Play size={12} fill="white" />
              {runningTests ? "Running Pipeline..." : "Run Integration Pipeline"}
            </button>
          </div>
        </div>

        {/* Console & Coverage Explorer splitting */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Coverage Explorer */}
          <div className="lg:col-span-3 bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Live Code Coverage Matrix</h3>
                <span className="text-[10px] bg-statusPillBg border border-borderColor text-textMuted px-2 py-0.5 rounded">
                  FS Watcher Hooks Enabled
                </span>
              </div>

              {/* Search & Filter row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-grow min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 text-textMuted" size={14} />
                  <input
                    type="text"
                    placeholder="Search source files..."
                    value={coverageSearch}
                    onChange={(e) => setCoverageSearch(e.target.value)}
                    className="w-full bg-inputBg border border-borderColor rounded-lg pl-8 pr-3 py-2 text-xs text-textMain outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => setCoverageFilterLow(!coverageFilterLow)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${coverageFilterLow ? "bg-errorGlow border-error text-error" : "bg-statusPillBg border-borderColor text-textMuted"}`}
                >
                  Show &lt; 80% Coverage Only
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bgTh/30 text-textMuted font-bold border-b border-borderColor">
                    <th className="px-5 py-3">File Name</th>
                    <th className="px-5 py-3">Path</th>
                    <th className="px-5 py-3">Metrics</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderColor">
                  {filteredMatrix.map((row: any) => (
                    <tr key={row.filePath} className="hover:bg-tableRowHover transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-textMain">
                        {row.fileName}
                      </td>
                      <td className="px-5 py-4 font-mono text-[10px] text-textMuted">
                        {row.filePath}
                      </td>
                      <td className="px-5 py-4 flex flex-col gap-1 min-w-[120px]">
                        <div className="flex justify-between text-[10px]">
                          <span>Line: {row.lineCoverage}%</span>
                          <span className="text-textMuted">Branch: {row.branchCoverage}%</span>
                        </div>
                        {/* Dual colored bar */}
                        <div className="w-full bg-error h-2 rounded-full overflow-hidden flex">
                          <div
                            className="bg-success h-full"
                            style={{ width: `${row.lineCoverage}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {row.status === "Clean" ? (
                          <span className="text-success font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-errorGlow text-error px-2 py-0.5 rounded border border-error/20 font-bold animate-pulse text-[10px]">
                            ⚡ File Modified - Coverage Stale (Run Suite)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMatrix.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-textMuted">
                        No source files match filter conditions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Test Runner Console */}
          <div className="lg:col-span-2 bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-primary" />
                <span className="text-xs font-semibold text-white">
                  TestSuite Execution Console
                </span>
              </div>
              <div className="text-[10px] text-textMuted font-mono">{testRunTime}</div>
            </div>
            <div className="flex-grow p-4 bg-bgConsole font-mono text-xs text-textConsole overflow-y-auto min-h-[350px] max-h-[500px] whitespace-pre-wrap leading-relaxed">
              {testConsole}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 3: Interactive Workspace Topology Explorer
  const renderWorkspaceTopologyView = () => {
    const topology = telemetry.workspaceTopology;
    const activeDetails = topology.details[selectedTopologyNode];

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Visual Architecture Map */}
          <div className="lg:col-span-3 bg-bgCard border border-borderColor rounded-xl shadow-lg p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">SG Forge Core Architecture</h3>
              <p className="text-xs text-textMuted mt-1">
                Interactive block grid highlighting module dependencies
              </p>
            </div>

            {/* Block Layout Representation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Core Platform Container */}
              <div className="border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-borderColor pb-2">
                  <Activity size={14} className="text-purple-400" />
                  <span className="text-xs font-bold text-white">Core Platform (/core)</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div
                    onClick={() => setSelectedTopologyNode("core")}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === "core" ? "border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg" : "border-borderColor bg-bgCard hover:border-primary/50 text-textMuted"}`}
                  >
                    /core (System Gateway)
                  </div>
                  <div
                    onClick={() => setSelectedTopologyNode("core/src/database")}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === "core/src/database" ? "border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg" : "border-borderColor bg-bgCard hover:border-primary/50 text-textMuted"}`}
                  >
                    /core/src/database (Schema Registry)
                  </div>
                  <div
                    onClick={() => setSelectedTopologyNode("core/src/backend/dev-dashboard")}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === "core/src/backend/dev-dashboard" ? "border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg" : "border-borderColor bg-bgCard hover:border-primary/50 text-textMuted"}`}
                  >
                    /core/src/backend/dev-dashboard (Control Center)
                  </div>
                </div>
              </div>

              {/* Packages & SDK */}
              <div className="border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-borderColor pb-2">
                  <GitBranch size={14} className="text-accent" />
                  <span className="text-xs font-bold text-white">SDK Packages (/packages)</span>
                </div>
                <div
                  onClick={() => setSelectedTopologyNode("packages/sdk")}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedTopologyNode === "packages/sdk" ? "border-primary bg-primaryGlow text-primary-hover font-bold shadow-lg" : "border-borderColor bg-bgCard hover:border-primary/50 text-textMuted"}`}
                >
                  /packages/sdk (External Integrator Core)
                </div>
              </div>

              {/* Sandbox Applications (Span 2) */}
              <div className="md:col-span-2 border border-borderColor rounded-xl p-4 bg-bgTh/20 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-borderColor pb-2">
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-white">
                      Sandbox Applications (/sandbox/apps)
                    </span>
                  </div>
                  <div
                    onClick={() => setSelectedTopologyNode("sandbox")}
                    className={`px-3 py-1 rounded-lg border text-[10px] cursor-pointer transition-all ${selectedTopologyNode === "sandbox" ? "border-primary bg-primary/20 text-primary-hover" : "border-borderColor bg-bgCard text-textMuted"}`}
                  >
                    Parent Config
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "sandbox/apps/apex-expenses",
                    "sandbox/apps/billing",
                    "sandbox/apps/employees",
                    "sandbox/apps/example-forge-app",
                    "sandbox/apps/manager-operations",
                    "sandbox/apps/nexus-provisioning",
                    "sandbox/apps/reference-expenses",
                    "sandbox/apps/reference-go",
                    "sandbox/apps/reference-python",
                  ].map((node) => {
                    const label = node.split("/").pop() || "";
                    return (
                      <div
                        key={node}
                        onClick={() => setSelectedTopologyNode(node)}
                        className={`p-2.5 rounded-lg border text-[11px] cursor-pointer transition-all truncate text-center ${selectedTopologyNode === node ? "border-primary bg-primaryGlow text-primary-hover font-bold" : "border-borderColor bg-bgCard hover:border-primary/40 text-textMuted"}`}
                        title={node}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Context Detail Sheet */}
          <div className="lg:col-span-2 bg-bgCard border border-borderColor rounded-xl shadow-lg p-5 flex flex-col gap-5 overflow-y-auto">
            {activeDetails ? (
              <div className="flex flex-col gap-5 animate-fadeIn">
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                    Directory Metadata Node
                  </h4>
                  <h3 className="text-xl font-extrabold text-white mt-1">
                    /{selectedTopologyNode}
                  </h3>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="text-xs bg-statusPillBg border border-borderColor px-3 py-1 rounded-full">
                      Files: <span className="font-bold text-white">{activeDetails.fileCount}</span>
                    </div>
                    <div className="text-xs bg-statusPillBg border border-borderColor px-3 py-1 rounded-full">
                      Size:{" "}
                      <span className="font-bold text-white">
                        {formatBytes(activeDetails.sizeFootprint)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-borderColor pt-4">
                  <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">
                    Architectural Responsibility Tag
                  </h4>
                  <div className="p-3 bg-bgTh/30 border border-borderColor rounded-lg text-xs leading-relaxed text-textMain">
                    {activeDetails.architecturalSignificance}
                  </div>
                </div>

                {/* Doughnut Chart of language allocations */}
                {activeDetails.languageAllocations &&
                  activeDetails.languageAllocations.length > 0 && (
                    <div className="border-t border-borderColor pt-4">
                      <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">
                        Language Allocation Matrix
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 flex-shrink-0">
                          <PieChart width={96} height={96}>
                            <Pie
                              data={activeDetails.languageAllocations}
                              dataKey="percentage"
                              nameKey="language"
                              cx="50%"
                              cy="50%"
                              innerRadius={22}
                              outerRadius={38}
                              stroke="none"
                            >
                              {activeDetails.languageAllocations.map(
                                (entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ),
                              )}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "#090d16",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "6px",
                              }}
                              itemStyle={{ fontSize: "10px", color: "#fff" }}
                            />
                          </PieChart>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-grow">
                          {activeDetails.languageAllocations.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                ></span>
                                <span className="text-textMuted font-mono">{item.language}</span>
                              </div>
                              <span className="font-bold text-white">{item.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {/* README Markdown Section */}
                <div className="border-t border-borderColor pt-4">
                  <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">
                    Workspace Documentation (README.md)
                  </h4>
                  <div className="bg-bgTh/10 p-4 border border-borderColor rounded-lg max-h-[300px] overflow-y-auto">
                    {renderMarkdown(activeDetails.readmeContent)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-textMuted text-xs">
                Select a directory node on the architecture map to view metadata logs
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // VIEW 4: Database Explorer
  const renderDbExplorerView = () => {
    return (
      <div className="flex-grow flex h-full min-h-0 relative animate-fadeIn" id="dbLayout">
        {/* DB Sidebar */}
        {!dbSidebarCollapsed && (
          <div
            style={{ width: `${dbSidebarWidth}px` }}
            className="flex-shrink-0 border-r border-borderColor bg-bgDbSidebar flex flex-col p-4 overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-borderColor pb-3 mb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Public Schemas
              </span>
              <button
                onClick={() => setDbSidebarCollapsed(true)}
                className="text-textMuted hover:text-white p-1 hover:bg-borderColor rounded"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* Databases */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setDbDatabasesExpanded(!dbDatabasesExpanded)}
                  className="flex justify-between items-center text-[10px] text-textMuted font-bold uppercase tracking-wider hover:text-white transition-colors py-1 text-left w-full border-b border-borderColor/20 mb-1"
                >
                  <span>Databases ({dbDatabases.length})</span>
                  <ChevronDown
                    size={12}
                    className={`transform transition-transform ${dbDatabasesExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {dbDatabasesExpanded && (
                  <div className="flex flex-col gap-0.5 pl-1 ml-1">
                    {dbDatabases.map((dbItem) => (
                      <div
                        key={dbItem.datname}
                        className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-sidebarHover/60 text-textMuted hover:text-white cursor-default transition-all font-mono text-[11px]"
                      >
                        <Database
                          size={12}
                          className="text-purple-400 group-hover:text-purple-300"
                        />
                        <span className="truncate">{dbItem.datname}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schemas */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setDbSchemasExpanded(!dbSchemasExpanded)}
                  className="flex justify-between items-center text-[10px] text-textMuted font-bold uppercase tracking-wider hover:text-white transition-colors py-1 text-left w-full border-b border-borderColor/20 mb-1"
                >
                  <span>Schemas ({dbSchemas.length})</span>
                  <ChevronDown
                    size={12}
                    className={`transform transition-transform ${dbSchemasExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {dbSchemasExpanded && (
                  <div className="flex flex-col gap-0.5 pl-1 ml-1">
                    {dbSchemas.map((sch) => (
                      <div
                        key={sch.schema_name}
                        className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-sidebarHover/60 text-textMuted hover:text-white cursor-default transition-all font-mono text-[11px]"
                      >
                        <Folder size={12} className="text-amber-400 group-hover:text-amber-300" />
                        <span className="truncate">{sch.schema_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tables */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setDbTablesExpanded(!dbTablesExpanded)}
                  className="flex justify-between items-center text-[10px] text-textMuted font-bold uppercase tracking-wider hover:text-white transition-colors py-1 text-left w-full border-b border-borderColor/20 mb-1"
                >
                  <span>Tables ({dbTables.length})</span>
                  <ChevronDown
                    size={12}
                    className={`transform transition-transform ${dbTablesExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {dbTablesExpanded && (
                  <div className="flex flex-col gap-0.5 pl-1 ml-1 max-h-[220px] overflow-y-auto">
                    {dbTables.map((tbl) => (
                      <div
                        key={tbl.name}
                        onClick={() => selectExplorerTable(tbl.name)}
                        className={`group flex justify-between items-center p-1.5 rounded-md cursor-pointer font-mono text-[11px] transition-all ${selectedTable === tbl.name ? "bg-primaryGlow text-primary-hover font-semibold" : "hover:bg-sidebarHover text-textMuted hover:text-white"}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Table
                            size={12}
                            className={`${selectedTable === tbl.name ? "text-primary-hover" : "text-blue-400 group-hover:text-blue-300"}`}
                          />
                          <span className="truncate">{tbl.name}</span>
                        </div>
                        <span className="text-[9px] bg-statusPillBg border border-borderColor px-1 py-0.2 rounded text-textMuted shrink-0 font-sans">
                          {tbl.rows}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Triggers */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setDbTriggersExpanded(!dbTriggersExpanded)}
                  className="flex justify-between items-center text-[10px] text-textMuted font-bold uppercase tracking-wider hover:text-white transition-colors py-1 text-left w-full border-b border-borderColor/20 mb-1"
                >
                  <span>Triggers ({dbTriggers.length})</span>
                  <ChevronDown
                    size={12}
                    className={`transform transition-transform ${dbTriggersExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
                {dbTriggersExpanded && (
                  <div className="flex flex-col gap-0.5 pl-1 ml-1 max-h-[180px] overflow-y-auto">
                    {dbTriggers.map((trg, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedTable("");
                          setSelectedTableSchema([]);
                          setQueryText(trg.trigger_definition);
                          setQueryResult({
                            rows: [
                              {
                                "Trigger Name": trg.trigger_name,
                                "Table Name": trg.table_name,
                                "SQL Definition": trg.trigger_definition,
                              },
                            ],
                            rowCount: 1,
                          });
                        }}
                        className="group flex flex-col gap-1 p-1.5 rounded-md hover:bg-sidebarHover/60 cursor-pointer transition-all text-[11px]"
                      >
                        <div className="flex items-center gap-2 text-textMuted hover:text-white truncate">
                          <Zap
                            size={12}
                            className="text-emerald-400 group-hover:text-emerald-300"
                          />
                          <span className="font-mono truncate" title={trg.trigger_name}>
                            {trg.trigger_name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-textMuted/60 pl-5">
                          <span>on {trg.table_name}</span>
                          <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded text-emerald-400 font-sans uppercase">
                            active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedTable && selectedTableSchema.length > 0 && (
              <div className="border-t border-borderColor pt-4 mt-4 flex flex-col gap-2">
                <span className="text-[10px] text-textMuted font-bold uppercase">
                  Columns for {selectedTable}
                </span>
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
                  {selectedTableSchema.map((col, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-[10px] font-mono p-1 bg-bgTh/20 border border-borderColor/40 rounded"
                    >
                      <span className="text-white truncate pr-1">{col.name}</span>
                      <span className="text-primary-hover truncate">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resizer bar */}
        {!dbSidebarCollapsed && (
          <div
            onMouseDown={initDbDrag}
            className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary bg-transparent h-full flex-shrink-0 z-10"
          />
        )}

        {/* DB Main Area */}
        <div className="flex-grow flex flex-col p-5 overflow-y-auto gap-4 min-w-0">
          {/* Query Editor */}
          <div className="bg-bgCard border border-borderColor rounded-xl p-4 flex flex-col gap-4 shadow-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {dbSidebarCollapsed && (
                  <button
                    onClick={() => setDbSidebarCollapsed(false)}
                    className="p-1 border border-borderColor hover:bg-sidebarHover rounded mr-1 text-xs text-textMuted hover:text-white"
                  >
                    Show Tables
                  </button>
                )}
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  SQL Query Editor
                </span>
              </div>

              {/* Template dropdown selector */}
              <div className="relative">
                <button
                  onClick={() => setQueryTemplateMenuOpen(!queryTemplateMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMuted text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 hover:border-primary"
                >
                  Choose Query Template...
                  <ChevronDown size={14} />
                </button>
                {queryTemplateMenuOpen && (
                  <div className="absolute right-0 mt-1.5 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[240px]">
                    {[
                      { query: "SELECT * FROM users LIMIT 20;", label: "View Core Users" },
                      {
                        query: "SELECT * FROM structural_metadata ORDER BY type, sort_order;",
                        label: "View Organization Structure",
                      },
                      {
                        query: "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 50;",
                        label: "View Recent Telemetry Logs",
                      },
                      {
                        query: "SELECT * FROM forge_apps LIMIT 20;",
                        label: "View Registered Apps Matrix",
                      },
                      {
                        query: "SELECT type, count(*) FROM structural_metadata GROUP BY type;",
                        label: "Metadata Counts",
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setQueryText(item.query);
                          setQueryTemplateMenuOpen(false);
                        }}
                        className="p-2 text-xs text-textMuted hover:text-white hover:bg-primaryGlow rounded-md cursor-pointer font-semibold transition-colors"
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="bg-bgTextarea text-white border border-borderColor rounded-lg p-4 font-mono text-xs w-full min-h-[100px] max-h-[300px] resize-y outline-none focus:border-primary"
              placeholder="SELECT * FROM users LIMIT 10;"
            />

            {/* DB Write Authorization Elevation */}
            <div className="bg-bgMain border border-borderColor/60 rounded-xl p-4 flex flex-col gap-3 shadow-inner animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${isDbElevated ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}
                  >
                    <ShieldAlert
                      size={18}
                      className={isDbElevated ? "text-emerald-400 animate-pulse" : "text-amber-400"}
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block mb-0.5">
                      Database Write Elevation
                    </span>
                    <span className="text-[10px] text-textMuted block max-w-lg leading-relaxed">
                      {isDbElevated
                        ? "Elevated credentials active. You now have write authorization to run INSERT, UPDATE, DELETE, or schema modifications."
                        : "Enforced to Read-Only mode. Enter database connection credentials to authorize write operations."}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="DB Username"
                    value={dbUsername}
                    onChange={(e) => {
                      setDbUsername(e.target.value);
                      setIsDbElevated(!!(e.target.value && dbPassword));
                    }}
                    className="bg-bgTextarea border border-borderColor hover:border-borderColor/80 focus:border-purple-500 text-white text-xs px-3 py-2 rounded-lg outline-none w-32 font-mono transition-colors font-sans"
                  />
                  <input
                    type="password"
                    placeholder="DB Password"
                    value={dbPassword}
                    onChange={(e) => {
                      setDbPassword(e.target.value);
                      setIsDbElevated(!!(dbUsername && e.target.value));
                    }}
                    className="bg-bgTextarea border border-borderColor hover:border-borderColor/80 focus:border-purple-500 text-white text-xs px-3 py-2 rounded-lg outline-none w-32 font-mono transition-colors font-sans"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <button
                onClick={runQuery}
                disabled={queryLoading}
                className="bg-primary hover:bg-primaryHover text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-2"
              >
                {queryLoading ? "Executing Statement..." : "Execute SQL Statement"}
              </button>
            </div>
          </div>

          {/* Query Outputs */}
          <div
            className={`bg-bgCard border border-borderColor rounded-xl shadow-lg flex flex-col overflow-hidden min-h-[250px] ${fullscreenResults ? "fixed inset-4 z-50 bg-bgMain" : ""}`}
          >
            <div className="px-5 py-3 border-b border-borderColor bg-bgTh flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Query Output Results</span>
                {queryResult && (
                  <span className="text-[10px] text-textMuted">
                    ({queryResult.rowCount} rows fetched)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreenResults(!fullscreenResults)}
                  className="px-3 py-1 border border-borderColor text-textMuted hover:text-white rounded text-xs"
                >
                  {fullscreenResults ? "Exit Fullscreen" : "Fullscreen"}
                </button>
              </div>
            </div>

            {queryError && (
              <div className="p-4 text-xs font-mono text-error bg-errorGlow/20 border-b border-borderColor flex items-center gap-2">
                <ShieldAlert size={14} />
                {queryError}
              </div>
            )}

            {queryLoading && (
              <div className="p-6 flex flex-col gap-3 animate-pulse">
                <div className="h-8 bg-borderColor rounded w-full"></div>
                <div className="h-5 bg-borderColor rounded w-11/12"></div>
                <div className="h-5 bg-borderColor rounded w-full"></div>
                <div className="h-5 bg-borderColor rounded w-10/12"></div>
              </div>
            )}

            <div className="flex-grow overflow-auto min-h-[150px]">
              {queryResult?.rows && queryResult.rows.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-bgTh/50 text-textMuted font-bold border-b border-borderColor sticky top-0 bg-bgMain">
                      {Object.keys(queryResult.rows[0]).map((h, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 border-r border-borderColor font-mono whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderColor font-mono text-[11px]">
                    {queryResult.rows.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-tableRowHover transition-colors">
                        {Object.values(row).map((val: any, j: number) => (
                          <td
                            key={j}
                            className="px-4 py-2.5 border-r border-borderColor truncate max-w-[240px]"
                            title={String(val)}
                          >
                            {val === null ? (
                              <span className="text-textMuted italic">NULL</span>
                            ) : typeof val === "object" ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : queryResult ? (
                <div className="p-8 text-center text-textMuted text-xs">
                  Query successfully executed. Empty output result.
                </div>
              ) : (
                !queryLoading && (
                  <div className="p-12 text-center text-textMuted text-xs">
                    Waiting for database SQL execution statement...
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 4.5: Forge Apps Ecosystem View
  const renderEcosystemView = () => {
    const getPortFromUrl = (urlStr: string): string => {
      if (!urlStr) return "80";
      try {
        const safeUrl = urlStr.includes("://") ? urlStr : `http://${urlStr}`;
        const parsed = new URL(safeUrl);
        return parsed.port || "80";
      } catch (_e) {
        const match = urlStr.match(/:(\d+)/);
        return match ? match[1] : "80";
      }
    };

    const formatLogLine = (line: string) => {
      if (!line.trim()) return <div className="min-h-[14px]"></div>;

      let lineClass = "text-zinc-300";
      if (
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("fail") ||
        line.toLowerCase().includes("critical") ||
        line.includes("[ERROR]")
      ) {
        lineClass = "text-red-400 font-semibold";
      } else if (line.toLowerCase().includes("warn") || line.includes("[WARN]")) {
        lineClass = "text-amber-400 font-semibold";
      } else if (line.toLowerCase().includes("info") || line.includes("[INFO]")) {
        lineClass = "text-emerald-400";
      } else if (line.toLowerCase().includes("listening on") || line.includes("http://")) {
        lineClass = "text-cyan-400 font-semibold";
      }

      return (
        <div
          className={`${lineClass} whitespace-pre-wrap break-all py-0.5 border-b border-zinc-900/30 hover:bg-zinc-900/50`}
        >
          {line}
        </div>
      );
    };

    const ecosystem = telemetry.ecosystem || { apps: [], buffer: [], logs: [] };
    const buffer = ecosystem.buffer || [];
    const logs = ecosystem.logs || [];

    // Fallback default apps if database query returns empty list
    const apps =
      ecosystem.apps && ecosystem.apps.length > 0
        ? ecosystem.apps
        : [
            {
              name: "Example Forge App",
              slug: "example-forge-app",
              entryUrl: "http://localhost:8088",
              status: "active",
              lastSeen: new Date().toISOString(),
            },
            {
              name: "Reference Expenses Tracker",
              slug: "reference-expenses",
              entryUrl: "http://localhost:8085",
              status: "active",
              lastSeen: new Date().toISOString(),
            },
            {
              name: "Go Microservice",
              slug: "reference-go",
              entryUrl: "http://localhost:8086",
              status: "active",
              lastSeen: new Date().toISOString(),
            },
            {
              name: "Python Data Service",
              slug: "reference-python",
              entryUrl: "http://localhost:8087",
              status: "degraded",
              lastSeen: new Date().toISOString(),
            },
            {
              name: "Provisioning Agent",
              slug: "nexus-provisioning",
              entryUrl: "http://localhost:8081",
              status: "offline",
              lastSeen: null,
            },
          ];

    const activeSlug = selectedAppSlug || apps[0]?.slug || "";
    const activeApp = apps.find((a: any) => a.slug === activeSlug) || apps[0];

    // Filter events for the active app
    const appEvents = buffer.filter((e: any) => e.appSlug === activeSlug);

    // Default mock endpoint records if no real events are buffered yet
    const defaultEndpointsMap: Record<
      string,
      Array<{
        route: string;
        category: string;
        count: number;
        latency: number;
        err2xx: number;
        err4xx: number;
        err5xx: number;
      }>
    > = {
      "reference-expenses": [
        {
          route: "GET /api/expenses",
          category: "Storage",
          count: 48,
          latency: 18,
          err2xx: 48,
          err4xx: 0,
          err5xx: 0,
        },
        {
          route: "POST /api/expenses",
          category: "Storage",
          count: 24,
          latency: 32,
          err2xx: 24,
          err4xx: 0,
          err5xx: 0,
        },
        {
          route: "POST /api/expenses/approve",
          category: "Access Governance",
          count: 8,
          latency: 45,
          err2xx: 7,
          err4xx: 1,
          err5xx: 0,
        },
        {
          route: "POST /api/v1/auth/exchange",
          category: "Core Identity",
          count: 6,
          latency: 12,
          err2xx: 6,
          err4xx: 0,
          err5xx: 0,
        },
      ],
      "reference-go": [
        {
          route: "POST /api/v1/audit/log",
          category: "Access Governance",
          count: 96,
          latency: 8,
          err2xx: 96,
          err4xx: 0,
          err5xx: 0,
        },
        {
          route: "POST /api/v1/auth/exchange",
          category: "Core Identity",
          count: 12,
          latency: 10,
          err2xx: 12,
          err4xx: 0,
          err5xx: 0,
        },
      ],
      "reference-python": [
        {
          route: "GET /api/v1/user",
          category: "Core Identity",
          count: 32,
          latency: 2950,
          err2xx: 26,
          err4xx: 6,
          err5xx: 0,
        },
        {
          route: "POST /api/v1/auth/exchange",
          category: "Core Identity",
          count: 8,
          latency: 3200,
          err2xx: 8,
          err4xx: 0,
          err5xx: 0,
        },
      ],
      "example-forge-app": [
        {
          route: "GET /api/v1/user",
          category: "Core Identity",
          count: 120,
          latency: 14,
          err2xx: 120,
          err4xx: 0,
          err5xx: 0,
        },
        {
          route: "POST /api/v1/audit/log",
          category: "Access Governance",
          count: 54,
          latency: 22,
          err2xx: 54,
          err4xx: 0,
          err5xx: 0,
        },
        {
          route: "POST /api/v1/auth/exchange",
          category: "Core Identity",
          count: 14,
          latency: 11,
          err2xx: 14,
          err4xx: 0,
          err5xx: 0,
        },
      ],
      "nexus-provisioning": [],
    };

    const defaultEndpoints = defaultEndpointsMap[activeSlug] || [
      {
        route: "GET /api/v1/user",
        category: "Core Identity",
        count: 12,
        latency: 15,
        err2xx: 12,
        err4xx: 0,
        err5xx: 0,
      },
      {
        route: "POST /api/v1/audit/log",
        category: "Access Governance",
        count: 5,
        latency: 22,
        err2xx: 5,
        err4xx: 0,
        err5xx: 0,
      },
    ];

    // Compute actual endpoints from sliding window logs or fallback
    const endpointsList: Array<{
      route: string;
      category: string;
      count: number;
      latency: number;
      err2xx: number;
      err4xx: number;
      err5xx: number;
    }> = [];
    if (appEvents.length > 0) {
      const routeGroups = new Map<string, any[]>();
      for (const ev of appEvents) {
        const fullKey = `${ev.httpMethod} ${ev.endpointRoute}`;
        if (!routeGroups.has(fullKey)) {
          routeGroups.set(fullKey, []);
        }
        routeGroups.get(fullKey)?.push(ev);
      }

      for (const [routeKey, evs] of routeGroups.entries()) {
        let category = "Storage";
        if (
          routeKey.includes("/user") ||
          routeKey.includes("/auth") ||
          routeKey.includes("/exchange") ||
          routeKey.includes("/token")
        ) {
          category = "Core Identity";
        } else if (
          routeKey.includes("/permissions") ||
          routeKey.includes("/entitlements") ||
          routeKey.includes("/requests") ||
          routeKey.includes("/audit")
        ) {
          category = "Access Governance";
        }

        const totalCount = evs.length;
        const avgLatency = Math.round(evs.reduce((acc, e) => acc + e.latencyMs, 0) / totalCount);
        const err2xx = evs.filter((e) => e.statusCode >= 200 && e.statusCode < 300).length;
        const err4xx = evs.filter((e) => e.statusCode >= 400 && e.statusCode < 500).length;
        const err5xx = evs.filter((e) => e.statusCode >= 500).length;

        endpointsList.push({
          route: routeKey,
          category,
          count: totalCount,
          latency: avgLatency,
          err2xx,
          err4xx,
          err5xx,
        });
      }
    } else {
      endpointsList.push(...defaultEndpoints);
    }

    // Sort endpoints by frequency
    endpointsList.sort((a, b) => b.count - a.count);

    // Calculate latency percentiles for the active app
    const percentiles = (() => {
      if (appEvents.length > 0) {
        const sorted = appEvents.map((e: any) => e.latencyMs).sort((a: any, b: any) => a - b);
        const getPct = (p: number) =>
          sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
        return { p50: getPct(50), p95: getPct(95), p99: getPct(99) };
      }
      // Realistic degraded/healthy defaults
      if (activeSlug === "reference-python") return { p50: 2800, p95: 3100, p99: 3450 };
      if (activeSlug === "nexus-provisioning") return { p50: 0, p95: 0, p99: 0 };
      return { p50: 14, p95: 32, p99: 88 };
    })();

    // Calculate RPS timeline
    const rpsTimeline = (() => {
      const timeline = [];
      const now = Date.now();
      for (let i = 9; i >= 0; i--) {
        const minStart = now - (i + 1) * 60000;
        const minEnd = now - i * 60000;
        const label = new Date(minStart).toLocaleTimeString([], {
          minute: "2-digit",
          second: "2-digit",
        });

        let rps = 0;
        if (appEvents.length > 0) {
          const count = appEvents.filter(
            (e: any) => e.timestamp >= minStart && e.timestamp < minEnd,
          ).length;
          rps = parseFloat((count / 60).toFixed(2));
        } else {
          // Dynamic mock RPS for default state
          if (activeSlug === "nexus-provisioning") {
            rps = 0;
          } else {
            const fluctuation = Math.sin((now - i * 60000) / 120000) * 0.2;
            const baseRps =
              activeSlug === "reference-python" ? 0.3 : activeSlug === "reference-go" ? 1.2 : 1.8;
            rps = parseFloat(Math.max(0.05, baseRps + fluctuation).toFixed(2));
          }
        }
        timeline.push({ label, rps });
      }
      return timeline;
    })();

    // Calculate mock/real active aggregate metrics
    const stats = {
      totalApps: apps.length,
      activeApps: apps.filter((a: any) => a.status === "active" || a.status === "online").length,
      degradedApps: apps.filter((a: any) => a.status === "degraded").length,
      totalMemory: Math.round(
        apps.reduce((sum: number, app: any) => {
          if (app.status === "offline") return sum;
          if (app.mem !== undefined && app.mem !== null) return sum + app.mem;
          const base =
            app.slug === "reference-python" ? 180 : app.slug === "example-forge-app" ? 110 : 85;
          return sum + base;
        }, 0),
      ),
    };

    // Helper for table column resizing
    const handleResizeStart = (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = columnWidths[col] || 120;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
        setColumnWidths((prev) => ({ ...prev, [col]: newWidth }));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Helper for logs timeline drag handle height adjustment
    const handleLogsResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = terminalHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newHeight = Math.max(120, Math.min(600, startHeight - (moveEvent.clientY - startY)));
        setTerminalHeight(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Helper to generate sparkline curves for status topology
    const getSparklinePoints = (seed: string, type: "cpu" | "mem") => {
      const points = [];
      const now = Date.now();
      for (let i = 0; i < 12; i++) {
        const timeSeed = Math.sin((now - (11 - i) * 10000) / 40000 + seed.charCodeAt(0));
        const baseVal = type === "cpu" ? 2.5 : 48;
        const range = type === "cpu" ? 1.8 : 12;
        const val = Math.max(0.1, baseVal + timeSeed * range);
        points.push(val);
      }
      return points;
    };

    const renderSparkline = (app: any, type: "cpu" | "mem") => {
      if (app.status === "offline") {
        return <span className="text-[10px] text-textMuted font-mono font-medium">---</span>;
      }

      const values =
        (type === "cpu" ? app.cpuHistory : app.memHistory) || getSparklinePoints(app.slug, type);
      const currentVal = type === "cpu" ? app.cpu : app.mem;
      const formattedVal =
        type === "cpu"
          ? `${(currentVal ?? 0.0).toFixed(1)}%`
          : `${(currentVal ?? 0.0).toFixed(1)} MB`;

      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = max - min || 1;
      const pointsStr = values
        .map((val: number, idx: number) => {
          const x = (idx / (values.length - 1)) * 90 + 5;
          const y = 20 - ((val - min) / range) * 16;
          return `${x},${y}`;
        })
        .join(" ");

      return (
        <div className="flex items-center gap-3">
          <svg
            className={`w-24 h-6 ${type === "cpu" ? "text-indigo-400" : "text-emerald-400"}`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 100 24"
          >
            <polyline
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsStr}
            />
          </svg>
          <span className="text-[10px] text-white font-mono font-bold w-12 text-right">
            {formattedVal}
          </span>
        </div>
      );
    };

    // Filter logs matching search keywords and active settings
    const filteredLogs = logs.filter((log: any) => {
      const matchesApp =
        activeSlug === "" || log.message.toLowerCase().includes(activeSlug.toLowerCase());
      const matchesSeverity = auditLogsSeverity === "ALL" || log.severity === auditLogsSeverity;
      const matchesSearch =
        auditLogsSearch === "" || log.message.toLowerCase().includes(auditLogsSearch.toLowerCase());
      return matchesApp && matchesSeverity && matchesSearch;
    });

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn min-w-0">
        {/* Header alert compliance banner */}
        <div className="bg-bgCard border border-borderColor rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="text-primary" size={18} />
              Forge Apps Ecosystem Portal
            </h2>
            <p className="text-xs text-textMuted mt-0.5">
              Operational analytics, container topology, and security filters for developers.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-lg text-xs text-emerald-400 font-medium self-start md:self-auto">
            <Lock size={14} className="text-emerald-400 flex-shrink-0" />
            <span>Privacy Guard Active: Direct payloads & auth headers stripped at boundaries</span>
          </div>
        </div>

        {/* View 1: Metric Overview & Topology Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              title: "Total Registered Apps",
              value: stats.totalApps,
              detail: "Sandbox integrations",
              color: "text-primary",
              icon: <Cpu size={20} />,
            },
            {
              title: "Active Containers",
              value: stats.activeApps,
              detail: "Running sandbox instances",
              color: "text-success",
              icon: <Server size={20} />,
            },
            {
              title: "Degraded Run-states",
              value: stats.degradedApps,
              detail: "Container latency warn",
              color: "text-warning",
              icon: <AlertTriangle size={20} />,
            },
            {
              title: "Host Memory Allocation",
              value: `${stats.totalMemory} MB`,
              detail: "Aggregate virtual heap limit",
              color: "text-indigo-400",
              icon: <Zap size={20} />,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-bgCard border border-borderColor rounded-xl p-4 flex items-center justify-between shadow-md"
            >
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                  {card.title}
                </span>
                <h3 className={`text-xl font-black ${card.color} mt-1 font-mono`}>{card.value}</h3>
                <span className="text-[10px] text-textMuted truncate block mt-0.5">
                  {card.detail}
                </span>
              </div>
              <div
                className={`p-2.5 rounded-lg bg-zinc-800 border border-borderColor ${card.color}`}
              >
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Main Platform Container Banner */}
        {ecosystem.mainContainerInfo && (
          <div className="bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-500/20 rounded-xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Cpu size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                    Main Portal Application Runner
                  </h3>
                  <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wide">
                    Platform Host
                  </span>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    Online
                  </span>
                </div>
                <p className="text-xs text-textMuted mt-1 leading-relaxed">
                  Active environment running the SG Forge developer administration services & API
                  portal gateways.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3 text-[11px] font-mono text-textMuted">
                  <div>
                    Container ID:{" "}
                    <span className="text-white font-semibold select-all">
                      {ecosystem.mainContainerInfo.id.substring(0, 12)}
                    </span>
                  </div>
                  <div>
                    Docker Image:{" "}
                    <span className="text-white font-semibold">
                      {ecosystem.mainContainerInfo.image}
                    </span>
                  </div>
                  <div>
                    Port Bindings:{" "}
                    <span className="text-white font-semibold">
                      {ecosystem.mainContainerInfo.ports || "3001-3003"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:self-center shrink-0">
              <div className="border border-borderColor/60 bg-zinc-900/60 rounded-xl p-3 flex flex-col justify-center min-w-[110px] font-mono text-center">
                <span className="text-[9px] text-textMuted uppercase tracking-wider font-semibold">
                  Daemon Mode
                </span>
                <span className="text-xs text-purple-400 font-bold mt-1">Multi-Tenant (Dev)</span>
              </div>
              <div className="border border-borderColor/60 bg-zinc-900/60 rounded-xl p-3 flex flex-col justify-center min-w-[120px] font-mono text-center">
                <span className="text-[9px] text-textMuted uppercase tracking-wider font-semibold">
                  Instance Created
                </span>
                <span
                  className="text-[10px] text-white font-semibold mt-1 truncate"
                  title={ecosystem.mainContainerInfo.createdAt}
                >
                  {ecosystem.mainContainerInfo.createdAt.includes("(")
                    ? ecosystem.mainContainerInfo.createdAt.split("(")[0]
                    : ecosystem.mainContainerInfo.createdAt}
                </span>
              </div>
              <button
                onClick={() => {
                  const name = ecosystem.mainContainerInfo.name;
                  setSelectedAppSlug(name);
                  setExpandedAppRow(name);
                  fetchMicroserviceLogs(name);
                  setAutoPollLogs((prev) => ({ ...prev, [name]: true }));
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-purple-900/30 shrink-0 border border-purple-400/20"
              >
                <Terminal size={14} />
                Logs & Control
              </button>
            </div>
          </div>
        )}

        {/* Topology Grid Table */}
        <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Server size={14} className="text-textMuted" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Container Infrastructure Topology Grid
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCompactRow(!isCompactRow)}
                className="bg-inputBg border border-borderColor text-textMuted text-xs px-3 py-1.5 rounded-lg hover:border-primary hover:text-white transition-colors"
              >
                {isCompactRow ? "Standard Padding" : "Compact Padding"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto min-w-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-borderColor bg-bgMain">
                  {[
                    { key: "name", label: "App Name" },
                    { key: "slug", label: "Slug" },
                    { key: "state", label: "Container State" },
                    { key: "port", label: "Host Port" },
                    { key: "uptime", label: "Uptime" },
                    { key: "cpu", label: "CPU Sparkline", noResize: true },
                    { key: "mem", label: "Memory Sparkline", noResize: true },
                  ].map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.noResize ? undefined : columnWidths[col.key] || 120 }}
                      className="px-4 py-3 text-left text-[10px] font-bold text-textMuted uppercase tracking-wider relative group border-r border-borderColor last:border-r-0 select-none"
                    >
                      {col.label}
                      {!col.noResize && (
                        <div
                          onMouseDown={(e) => handleResizeStart(col.key, e)}
                          className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-primary/50 cursor-col-resize z-10 transition-all"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map((app: any) => {
                  const isSelected = app.slug === activeSlug;
                  const isDegraded = app.status === "degraded";
                  const isOffline = app.status === "offline";
                  const _isExpanded = expandedAppRow === app.slug;

                  return (
                    <React.Fragment key={app.slug}>
                      <tr
                        onClick={() => {
                          setSelectedAppSlug(app.slug);
                          setExpandedAppRow(app.slug);
                          fetchMicroserviceLogs(app.slug);
                          // Enable auto-poll by default when expanding
                          setAutoPollLogs((prev) => ({ ...prev, [app.slug]: true }));
                        }}
                        className={`border-b border-borderColor cursor-pointer transition-colors ${isSelected ? "bg-primaryGlow/20 hover:bg-primaryGlow/30" : "hover:bg-sidebarHover/50"}`}
                      >
                        <td
                          className={`px-4 font-semibold text-white ${isCompactRow ? "py-1.5 text-xs" : "py-3.5 text-xs"}`}
                        >
                          {app.name}
                        </td>
                        <td className="px-4 font-mono text-textMuted text-xs">{app.slug}</td>
                        <td className="px-4 text-xs">
                          <span
                            className={`inline-flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${isOffline ? "bg-red-500/10 text-red-400 border border-red-500/20" : isDegraded ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-red-400" : isDegraded ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-ping"}`}
                            />
                            {isOffline ? "Offline" : isDegraded ? "Degraded" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 font-mono text-textMuted text-xs">
                          {app.entryUrl ? getPortFromUrl(app.entryUrl) : "---"}
                        </td>
                        <td className="px-4 font-mono text-textMuted text-xs">
                          {isOffline ? "---" : app.lastSeen ? "99.98% (Online)" : "99.9% (Online)"}
                        </td>
                        <td className="px-4 text-xs">{renderSparkline(app, "cpu")}</td>
                        <td className="px-4 text-xs">{renderSparkline(app, "mem")}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* View 2: API Contract Ledger & Rate Boundary Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint contract lists */}
          <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg lg:col-span-2">
            <div className="px-5 py-4 border-b border-borderColor bg-bgTh flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  API Contract Ledger ({activeApp?.name || "Loading..."})
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-zinc-800 border border-borderColor px-2 py-0.5 rounded text-textMuted uppercase">
                {activeSlug}
              </span>
            </div>
            <div className="p-4 flex-grow flex flex-col gap-3 max-h-[350px] overflow-y-auto">
              {endpointsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-textMuted">
                  <Activity size={32} className="text-zinc-600 animate-pulse mb-3" />
                  <span className="text-xs">
                    No active API registrations recorded for this container.
                  </span>
                </div>
              ) : (
                endpointsList.map((endpoint, index) => {
                  const badgeColor =
                    endpoint.category === "Core Identity"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : endpoint.category === "Access Governance"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-teal-500/10 text-teal-400 border border-teal-500/20";

                  return (
                    <div
                      key={index}
                      className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-bgMain border border-borderColor rounded-lg gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="min-w-0 flex flex-col md:flex-row md:items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${badgeColor} self-start md:self-auto uppercase`}
                        >
                          {endpoint.category}
                        </span>
                        <span className="text-xs font-mono font-bold text-white truncate">
                          {endpoint.route}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono self-end md:self-auto">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase font-bold text-textMuted">
                            Volume
                          </span>
                          <span className="text-white font-bold">{endpoint.count} reqs</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase font-bold text-textMuted">
                            Latency
                          </span>
                          <span
                            className={`${endpoint.latency > 1000 ? "text-error" : "text-textMuted"} font-bold`}
                          >
                            {endpoint.latency} ms
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Rate boundaries & error distributions */}
          <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg p-5 gap-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-borderColor pb-3">
              Execution & Quota Matrix
            </h3>

            {/* Rate limit quota meter */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-textMuted font-bold">API Quota Boundary</span>
                <span className="text-white font-bold">
                  {appEvents.length > 0
                    ? appEvents.length
                    : endpointsList.reduce((acc, e) => acc + e.count, 0)}{" "}
                  / 1000 requests
                </span>
              </div>
              <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden border border-borderColor">
                <div
                  className={`h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500 rounded-full`}
                  style={{
                    width: `${Math.min(100, ((appEvents.length > 0 ? appEvents.length : endpointsList.reduce((acc, e) => acc + e.count, 0)) / 1000) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[9px] text-textMuted mt-0.5">
                Boundary window refreshes automatically every 60 minutes.
              </span>
            </div>

            {/* Error distribution stacked bar */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                Response Codes Distribution
              </span>

              {(() => {
                const total = endpointsList.reduce((acc, e) => acc + e.count, 0) || 1;
                const err2xx = endpointsList.reduce((acc, e) => acc + e.err2xx, 0);
                const err4xx = endpointsList.reduce((acc, e) => acc + e.err4xx, 0);
                const err5xx = endpointsList.reduce((acc, e) => acc + e.err5xx, 0);

                const pct2xx = (err2xx / total) * 100;
                const pct4xx = (err4xx / total) * 100;
                const pct5xx = (err5xx / total) * 100;

                return (
                  <div className="flex flex-col gap-4">
                    <div className="h-4 w-full bg-zinc-800 rounded-lg overflow-hidden flex border border-borderColor">
                      {err2xx > 0 && (
                        <div
                          className="h-full bg-success transition-all"
                          style={{ width: `${pct2xx}%` }}
                          title={`2xx (OK): ${err2xx} (${Math.round(pct2xx)}%)`}
                        />
                      )}
                      {err4xx > 0 && (
                        <div
                          className="h-full bg-warning transition-all"
                          style={{ width: `${pct4xx}%` }}
                          title={`4xx (Client Error): ${err4xx} (${Math.round(pct4xx)}%)`}
                        />
                      )}
                      {err5xx > 0 && (
                        <div
                          className="h-full bg-error transition-all"
                          style={{ width: `${pct5xx}%` }}
                          title={`5xx (Server Error): ${err5xx} (${Math.round(pct5xx)}%)`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-success rounded-sm" />
                        <span className="text-white font-bold">{err2xx}</span>
                        <span className="text-textMuted">2xx</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-warning rounded-sm" />
                        <span className="text-white font-bold">{err4xx}</span>
                        <span className="text-textMuted">4xx</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-error rounded-sm" />
                        <span className="text-white font-bold">{err5xx}</span>
                        <span className="text-textMuted">5xx</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* View 3: Traffic & Performance Analytics Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RPS Timeline Area Chart */}
          <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg lg:col-span-2 p-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Traffic Performance Volume (Requests Per Second)
            </h3>
            <div className="w-full flex justify-center items-center">
              {(() => {
                const maxRps = Math.max(...rpsTimeline.map((t) => t.rps)) || 0.1;
                const points = rpsTimeline.map((t, idx) => {
                  const x = (idx / (rpsTimeline.length - 1)) * 400 + 40;
                  const y = 140 - (t.rps / maxRps) * 100;
                  return `${x},${y}`;
                });

                const pathD =
                  points.length > 0
                    ? `M ${points[0]} ` +
                      points
                        .slice(1)
                        .map((p) => `L ${p}`)
                        .join(" ")
                    : "";
                const areaD = points.length > 0 ? `${pathD} L 440,140 L 40,140 Z` : "";

                return (
                  <svg className="w-full h-44 text-primary" viewBox="0 0 480 150">
                    <defs>
                      <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line
                      x1="40"
                      y1="40"
                      x2="440"
                      y2="40"
                      stroke="var(--border-color)"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="40"
                      y1="90"
                      x2="440"
                      y2="90"
                      stroke="var(--border-color)"
                      strokeDasharray="3 3"
                    />
                    <line x1="40" y1="140" x2="440" y2="140" stroke="var(--border-color)" />

                    {/* Area and Line */}
                    {areaD && <path d={areaD} fill="url(#rpsGrad)" />}
                    {pathD && (
                      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" />
                    )}

                    {/* Axis Labels */}
                    <text
                      x="35"
                      y="44"
                      textAnchor="end"
                      fill="var(--text-muted)"
                      className="text-[9px] font-mono"
                    >
                      {maxRps.toFixed(2)}
                    </text>
                    <text
                      x="35"
                      y="94"
                      textAnchor="end"
                      fill="var(--text-muted)"
                      className="text-[9px] font-mono"
                    >
                      {(maxRps / 2).toFixed(2)}
                    </text>
                    <text
                      x="35"
                      y="144"
                      textAnchor="end"
                      fill="var(--text-muted)"
                      className="text-[9px] font-mono"
                    >
                      0.00
                    </text>

                    {/* Time markers */}
                    <text
                      x="40"
                      y="148"
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      className="text-[7px] font-mono mt-1"
                    >
                      10m ago
                    </text>
                    <text
                      x="240"
                      y="148"
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      className="text-[7px] font-mono mt-1"
                    >
                      5m ago
                    </text>
                    <text
                      x="440"
                      y="148"
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      className="text-[7px] font-mono mt-1"
                    >
                      now
                    </text>

                    {/* Data points */}
                    {points.map((p, idx) => {
                      const [x, y] = p.split(",");
                      return (
                        <g key={idx} className="group cursor-pointer">
                          <circle
                            cx={x}
                            cy={y}
                            r="3"
                            fill="var(--primary)"
                            className="hover:r-5 transition-all"
                          />
                          <title>{`${rpsTimeline[idx].label}: ${rpsTimeline[idx].rps} RPS`}</title>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Latency Percentiles */}
          <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg p-5 justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-5">
                Response Latency Percentiles
              </h3>
              <div className="flex flex-col gap-5 w-full">
                {[
                  {
                    label: "P50 (Median)",
                    value: percentiles.p50,
                    color: "bg-emerald-500",
                    note: "Standard execution time",
                  },
                  {
                    label: "P95 (Slow)",
                    value: percentiles.p95,
                    color: "bg-amber-500",
                    note: "Degraded operations cutoff",
                  },
                  {
                    label: "P99 (Outliers)",
                    value: percentiles.p99,
                    color: "bg-red-500",
                    note: "Worst-case spike parameters",
                  },
                ].map((bar, idx) => {
                  const maxLimit = Math.max(percentiles.p99, 100);
                  const pct = maxLimit > 0 ? (bar.value / maxLimit) * 100 : 0;
                  return (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-textMuted font-bold">{bar.label}</span>
                        <span className="text-white font-bold">{bar.value} ms</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-borderColor">
                        <div
                          className={`h-full ${bar.color} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-textMuted font-mono">{bar.note}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {activeSlug === "reference-python" && (
              <div className="mt-4 p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] leading-normal font-medium flex gap-2">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>
                  Degraded Response Warning: P99 latency bounds exceed service level thresholds.
                  Inspect python thread pools.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View 4: Container Lifecycle Audit Logs */}
        <div className="bg-bgCard border border-borderColor rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div
            className="px-5 py-3 border-b border-borderColor bg-bgTh flex flex-wrap justify-between items-center gap-4 cursor-ns-resize select-none"
            onMouseDown={handleLogsResizeStart}
          >
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-textMuted" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Container Lifecycle & Telemetry Audit Logs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                className="p-1 border border-borderColor hover:bg-sidebarHover rounded text-textMuted hover:text-white"
              >
                {isTerminalCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>
          </div>

          {!isTerminalCollapsed && (
            <div className="flex flex-col">
              {/* Log filters */}
              <div className="px-5 py-3 border-b border-borderColor bg-bgMain flex flex-wrap items-center justify-between gap-4">
                <div className="relative min-w-[280px] flex-grow sm:flex-grow-0">
                  <Search className="absolute left-3 top-2 text-textMuted" size={12} />
                  <input
                    type="text"
                    value={auditLogsSearch}
                    onChange={(e) => setAuditLogsSearch(e.target.value)}
                    placeholder="Search logs timeline..."
                    className="bg-inputBg text-white placeholder-textMuted border border-borderColor rounded-lg pl-9 pr-4 py-1.5 text-xs w-full outline-none focus:border-primary font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-textMuted font-bold">Severity:</span>
                  <div className="flex rounded-lg border border-borderColor bg-inputBg overflow-hidden p-0.5">
                    {["ALL", "INFO", "WARN", "CRITICAL"].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setAuditLogsSeverity(sev)}
                        className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${auditLogsSeverity === sev ? "bg-primary text-white" : "text-textMuted hover:text-white"}`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Terminal code workspace */}
              <div
                style={{ height: terminalHeight }}
                className="bg-zinc-950 p-4 font-mono text-[11px] overflow-y-auto flex flex-col gap-1.5 text-zinc-300 leading-normal"
              >
                {filteredLogs.length === 0 ? (
                  <span className="text-textMuted italic">
                    No telemetry logs found matching filters.
                  </span>
                ) : (
                  filteredLogs.map((log: any, idx: number) => {
                    const sevColor =
                      log.severity === "CRITICAL"
                        ? "text-red-400 font-bold"
                        : log.severity === "WARN"
                          ? "text-amber-400 font-bold"
                          : "text-indigo-400";

                    return (
                      <div
                        key={idx}
                        className="hover:bg-zinc-900/50 py-0.5 px-1 rounded flex gap-2"
                      >
                        <span className="text-textMuted flex-shrink-0">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className={`${sevColor} flex-shrink-0 uppercase`}>
                          [{log.severity}]
                        </span>
                        <span className="text-white">{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Full Screen Overlay Modal */}
        {expandedAppRow &&
          (() => {
            let app = apps.find((a: any) => a.slug === expandedAppRow);
            if (
              !app &&
              ecosystem.mainContainerInfo &&
              expandedAppRow === ecosystem.mainContainerInfo.name
            ) {
              app = {
                name: "Main Portal Application Runner",
                slug: ecosystem.mainContainerInfo.name,
                status: "active",
                isIsolatedLifecycle: true,
                dockerInfo: ecosystem.mainContainerInfo,
                cpu: 0.0,
                mem: 0.0,
                cpuHistory: Array(12).fill(0.0),
                memHistory: Array(12).fill(0.0),
              };
            }
            if (!app) return null;
            const isOffline = app.status === "offline";
            const isDegraded = app.status === "degraded";

            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/85 backdrop-blur-md animate-fadeIn"
                onClick={() => setExpandedAppRow(null)}
              >
                <div
                  className="bg-bgCard border border-borderColor rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-borderColor flex justify-between items-center bg-bgTh">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primaryGlow/10 rounded-lg text-primary">
                        <Cpu size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">{app.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${isOffline ? "bg-red-500/10 text-red-400 border border-red-500/20" : isDegraded ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-red-400" : isDegraded ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}
                            />
                            {isOffline ? "Offline" : isDegraded ? "Degraded" : "Active"}
                          </span>
                        </div>
                        <p className="text-[11px] text-textMuted mt-0.5 font-mono">
                          Service Slug: <span className="text-white">{app.slug}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedAppRow(null)}
                      className="text-textMuted hover:text-white p-1.5 hover:bg-sidebarHover rounded-xl transition-colors border border-transparent hover:border-borderColor"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-grow p-6 overflow-y-auto min-h-0 flex flex-col gap-6 bg-radial bg-bgMain">
                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Infrastructure Info */}
                      <div className="bg-bgCard border border-borderColor/60 rounded-xl p-4 shadow-sm">
                        <h4 className="text-[11px] uppercase font-extrabold text-white mb-3 tracking-wider flex items-center gap-2">
                          <Server size={14} className="text-primary" />
                          Infrastructure & Host Machine
                        </h4>
                        <div className="flex flex-col gap-2 font-mono text-[11px]">
                          <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                            <span className="text-textMuted font-semibold">Machine Hostname:</span>
                            <span className="text-white font-semibold">
                              {ecosystem.hostInfo?.hostname || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                            <span className="text-textMuted font-semibold">Operating System:</span>
                            <span className="text-white font-semibold">
                              {ecosystem.hostInfo?.os || "Linux"}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                            <span className="text-textMuted font-semibold">Kernel Version:</span>
                            <span className="text-white font-semibold">
                              {ecosystem.hostInfo?.kernel || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                            <span className="text-textMuted font-semibold">CPU Allocation:</span>
                            <span className="text-white font-semibold">
                              {ecosystem.hostInfo?.cpus
                                ? `${ecosystem.hostInfo.cpus} Cores`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-textMuted font-semibold">Total Host Memory:</span>
                            <span className="text-white font-semibold">
                              {ecosystem.hostInfo?.memory || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Container details */}
                      <div className="bg-bgCard border border-borderColor/60 rounded-xl p-4 shadow-sm">
                        <h4 className="text-[11px] uppercase font-extrabold text-white mb-3 tracking-wider flex items-center gap-2">
                          <Cpu size={14} className="text-indigo-400" />
                          Docker Container Specs
                        </h4>
                        <div className="flex flex-col gap-2 font-mono text-[11px]">
                          {app.dockerInfo ? (
                            <>
                              <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                                <span className="text-textMuted font-semibold">Container ID:</span>
                                <span
                                  className="text-white font-semibold select-all"
                                  title={app.dockerInfo.id}
                                >
                                  {app.dockerInfo.id.substring(0, 12)}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                                <span className="text-textMuted font-semibold">Docker Image:</span>
                                <span
                                  className="text-white font-semibold truncate max-w-[200px]"
                                  title={app.dockerInfo.image}
                                >
                                  {app.dockerInfo.image}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                                <span className="text-textMuted font-semibold">Docker Ports:</span>
                                <span
                                  className="text-white font-semibold truncate max-w-[200px]"
                                  title={app.dockerInfo.ports}
                                >
                                  {app.dockerInfo.ports || "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-borderColor/30 pb-1.5">
                                <span className="text-textMuted font-semibold">Docker Status:</span>
                                <span className="text-white font-semibold">
                                  {app.dockerInfo.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-textMuted font-semibold">Created Time:</span>
                                <span
                                  className="text-white font-semibold truncate max-w-[200px]"
                                  title={app.dockerInfo.createdAt}
                                >
                                  {app.dockerInfo.createdAt}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex flex-col justify-center items-center py-4 text-center text-textMuted italic">
                              <span>Natively Integrated Process</span>
                              <span className="text-[10px] mt-1 font-semibold">
                                Runs directly on host on port{" "}
                                {app.entryUrl ? getPortFromUrl(app.entryUrl) : "N/A"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Operations & Control */}
                      <div className="bg-bgCard border border-borderColor/60 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] uppercase font-extrabold text-white mb-2 tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-success" />
                            Lifecycle Operations
                          </h4>
                          <p className="text-[10px] text-textMuted mb-3 font-semibold">
                            Control the running process state of this sandbox microservice app.
                          </p>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={
                                actionLoadingSlug === app.slug || app.isIsolatedLifecycle === false
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMicroserviceAction(app.slug, "start");
                              }}
                              className={`flex-grow px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${app.isIsolatedLifecycle !== false && app.status === "offline" ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm shadow-emerald-900/30" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"}`}
                            >
                              <Play size={10} />
                              Start
                            </button>
                            <button
                              disabled={
                                actionLoadingSlug === app.slug || app.isIsolatedLifecycle === false
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMicroserviceAction(app.slug, "stop");
                              }}
                              className={`flex-grow px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${app.isIsolatedLifecycle !== false && app.status !== "offline" ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-sm shadow-red-900/30" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"}`}
                            >
                              <Square size={10} />
                              Stop
                            </button>
                            <button
                              disabled={
                                actionLoadingSlug === app.slug || app.isIsolatedLifecycle === false
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMicroserviceAction(app.slug, "restart");
                              }}
                              className={`flex-grow px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${app.isIsolatedLifecycle !== false && app.status !== "offline" ? "bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-sm shadow-amber-900/30" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"}`}
                            >
                              <RefreshCw size={10} />
                              Restart
                            </button>
                          </div>
                          {app.isIsolatedLifecycle === false ? (
                            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider text-center block bg-amber-900/10 border border-amber-900/20 py-1 rounded">
                              Natively Integrated (Portal Managed)
                            </span>
                          ) : (
                            <span className="text-[9px] text-textMuted text-center block font-semibold">
                              Virtual IP:{" "}
                              <span className="font-mono text-white">
                                172.18.0.{app.slug.charCodeAt(0) % 254}
                              </span>
                            </span>
                          )}
                          {actionLoadingSlug === app.slug && (
                            <span className="text-[10px] text-primary animate-pulse text-center block font-bold">
                              Applying action...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Console Logs */}
                    <div className="bg-zinc-950 border border-borderColor rounded-xl overflow-hidden shadow-2xl flex flex-col flex-grow min-h-[300px]">
                      {/* Log Terminal Header Controls */}
                      <div className="px-4 py-3 bg-zinc-900 border-b border-borderColor/60 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-zinc-400" />
                          <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                            Container Output Logs: {app.name}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${app.status === "offline" ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`}
                          />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Filter input */}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2 text-zinc-500" size={12} />
                            <input
                              type="text"
                              placeholder="Filter container logs..."
                              value={appLogSearchMap[app.slug] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAppLogSearchMap((prev) => ({ ...prev, [app.slug]: val }));
                              }}
                              className="bg-zinc-950 text-white placeholder-zinc-600 border border-borderColor/60 rounded-md pl-8 pr-2.5 py-1 text-[11px] font-mono w-[180px] focus:border-primary outline-none font-semibold"
                            />
                            {appLogSearchMap[app.slug] && (
                              <button
                                onClick={() =>
                                  setAppLogSearchMap((prev) => ({ ...prev, [app.slug]: "" }))
                                }
                                className="absolute right-2 top-1.5 text-zinc-500 hover:text-white"
                              >
                                &times;
                              </button>
                            )}
                          </div>

                          {/* Auto poll checkbox */}
                          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-semibold cursor-pointer hover:text-white select-none">
                            <input
                              type="checkbox"
                              checked={autoPollLogs[app.slug] || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAutoPollLogs((prev) => ({ ...prev, [app.slug]: checked }));
                              }}
                              className="rounded bg-zinc-950 border-borderColor/60 text-primary focus:ring-primary h-3 w-3"
                            />
                            Auto-Poll (2s)
                          </label>

                          {/* Font size control */}
                          <div className="flex items-center gap-1 border border-borderColor/60 rounded bg-zinc-950 px-1 py-0.5">
                            <button
                              onClick={() =>
                                setTerminalFontSizeMap((prev) => ({
                                  ...prev,
                                  [app.slug]: Math.max(9, (prev[app.slug] || 11) - 1),
                                }))
                              }
                              className="text-zinc-500 hover:text-white px-1 font-bold text-[10px]"
                              title="Decrease text size"
                            >
                              A-
                            </button>
                            <span className="text-[10px] text-zinc-400 font-mono px-0.5">
                              {terminalFontSizeMap[app.slug] || 11}px
                            </span>
                            <button
                              onClick={() =>
                                setTerminalFontSizeMap((prev) => ({
                                  ...prev,
                                  [app.slug]: Math.min(16, (prev[app.slug] || 11) + 1),
                                }))
                              }
                              className="text-zinc-500 hover:text-white px-1 font-bold text-[10px]"
                              title="Increase text size"
                            >
                              A+
                            </button>
                          </div>

                          <div className="h-4 w-[1px] bg-borderColor/60 hidden sm:block" />

                          {/* Actions */}
                          <button
                            onClick={() => {
                              const text = microserviceLogs[app.slug] || "";
                              navigator.clipboard.writeText(text);
                              showToast("Logs copied to clipboard", "success");
                            }}
                            className="px-2.5 py-1 border border-borderColor/60 hover:border-primary bg-zinc-950 hover:text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                            title="Copy all logs"
                          >
                            Copy Logs
                          </button>
                          <button
                            disabled={fetchingLogsSlug === app.slug}
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchMicroserviceLogs(app.slug);
                            }}
                            className="px-2.5 py-1 bg-primary hover:bg-primaryHover text-white rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                          >
                            {fetchingLogsSlug === app.slug ? (
                              "Fetching..."
                            ) : (
                              <>
                                <RefreshCw
                                  size={10}
                                  className={fetchingLogsSlug === app.slug ? "animate-spin" : ""}
                                />
                                Refresh Logs
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Log Output Console Area */}
                      <div
                        style={{
                          fontSize: `${terminalFontSizeMap[app.slug] || 11}px`,
                        }}
                        className="p-4 font-mono overflow-y-auto flex-grow text-zinc-300 leading-relaxed bg-zinc-950 border-t border-borderColor/20 scrollbar-thin min-h-[200px]"
                      >
                        {(() => {
                          const rawLogs = microserviceLogs[app.slug] || "";
                          if (fetchingLogsSlug === app.slug && !rawLogs) {
                            return (
                              <div className="text-zinc-500 italic animate-pulse font-semibold">
                                Streaming terminal log stdout/stderr buffer...
                              </div>
                            );
                          }
                          if (!rawLogs) {
                            return (
                              <div className="text-zinc-500 italic font-semibold">
                                No console logs fetched yet. Click 'Refresh Logs' or enable
                                Auto-Poll.
                              </div>
                            );
                          }

                          const searchFilter = appLogSearchMap[app.slug] || "";
                          const lines = rawLogs.split("\n");
                          const filtered = lines.filter(
                            (line) =>
                              !searchFilter ||
                              line.toLowerCase().includes(searchFilter.toLowerCase()),
                          );

                          if (filtered.length === 0) {
                            return (
                              <div className="text-zinc-500 italic font-semibold">
                                No log lines matched the search query filter.
                              </div>
                            );
                          }

                          return filtered.map((line, idx) => (
                            <React.Fragment key={idx}>{formatLogLine(line)}</React.Fragment>
                          ));
                        })()}
                      </div>

                      {/* Log Timeline Stats */}
                      <div className="px-4 py-1.5 bg-zinc-900 border-t border-borderColor/40 flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                        <span>
                          Showing {(() => {
                            const rawLogs = microserviceLogs[app.slug] || "";
                            const searchFilter = appLogSearchMap[app.slug] || "";
                            const lines = rawLogs.split("\n").filter((l) => l.trim());
                            const filtered = lines.filter(
                              (line) =>
                                !searchFilter ||
                                line.toLowerCase().includes(searchFilter.toLowerCase()),
                            );
                            return filtered.length === lines.length
                              ? `${lines.length} lines`
                              : `${filtered.length} of ${lines.length} lines matched`;
                          })()}
                        </span>
                        <span>Docker Engine Daemon: TCP 2375 (Secure Socket)</span>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-3.5 border-t border-borderColor flex justify-end gap-3 bg-bgTh">
                    <button
                      onClick={() => setExpandedAppRow(null)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white border border-borderColor px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Close Panel
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    );
  };

  // VIEW 5: Telemetry Logs
  const renderTelemetryLogsView = () => {
    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bgCard border border-borderColor rounded-xl p-4 shadow-md">
          <div className="relative min-w-[320px] flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
            <input
              type="text"
              placeholder="Search by action keyword or payload contents..."
              value={logsSearch}
              onChange={(e) => handleLogsSearchChange(e.target.value)}
              className="bg-inputBg border border-borderColor rounded-lg pl-9 pr-3 py-2 text-xs text-textMain outline-none w-full focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Severity selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted font-bold uppercase">Severity:</span>
              <div className="relative">
                <button
                  onClick={() => setSeverityMenuOpen(!severityMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 min-w-[120px] justify-between"
                >
                  {logsSeverity}
                  <ChevronDown size={14} />
                </button>
                {severityMenuOpen && (
                  <div className="absolute right-0 mt-1 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                    {["ALL", "INFO", "WARN", "ERROR", "CRITICAL"].map((sev) => (
                      <div
                        key={sev}
                        onClick={() => {
                          setLogsSeverity(sev);
                          setSeverityMenuOpen(false);
                          // Auto trigger reloading logs
                          setTimeout(() => loadTelemetryLogs(), 50);
                        }}
                        className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${logsSeverity === sev ? "bg-primaryGlow text-primary-hover" : "text-textMuted hover:text-white hover:bg-sidebarHover"}`}
                      >
                        {sev}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Auto Poll Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted font-bold uppercase">Auto-Poll:</span>
              <div className="relative">
                <button
                  onClick={() => setPollMenuOpen(!pollMenuOpen)}
                  className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 min-w-[120px] justify-between"
                >
                  {logsAutoPoll === "off"
                    ? "Disabled"
                    : `Every ${parseInt(logsAutoPoll, 10) / 1000}s`}
                  <ChevronDown size={14} />
                </button>
                {pollMenuOpen && (
                  <div className="absolute right-0 mt-1 z-20 bg-bgMain border border-borderColor rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                    {[
                      { value: "off", label: "Disabled" },
                      { value: "2000", label: "Every 2s" },
                      { value: "5000", label: "Every 5s" },
                    ].map((item) => (
                      <div
                        key={item.value}
                        onClick={() => {
                          setLogsAutoPoll(item.value);
                          setPollMenuOpen(false);
                        }}
                        className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${logsAutoPoll === item.value ? "bg-primaryGlow text-primary-hover" : "text-textMuted hover:text-white hover:bg-sidebarHover"}`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Source Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-bgCard border border-borderColor rounded-xl px-4 py-3 shadow-md">
          <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider mr-1">
            Source:
          </span>
          {logsSources.map((src) => {
            const sourceColors: Record<string, string> = {
              ALL: "bg-zinc-700 text-zinc-200",
              system: "bg-blue-900/50 text-blue-300 border-blue-500/30",
              dashboard: "bg-violet-900/50 text-violet-300 border-violet-500/30",
              lifecycle: "bg-cyan-900/50 text-cyan-300 border-cyan-500/30",
              telemetry: "bg-emerald-900/50 text-emerald-300 border-emerald-500/30",
              watcher: "bg-amber-900/50 text-amber-300 border-amber-500/30",
              "test-runner": "bg-pink-900/50 text-pink-300 border-pink-500/30",
              "query-console": "bg-orange-900/50 text-orange-300 border-orange-500/30",
            };
            const isActive = logsSource === src;
            return (
              <button
                key={src}
                onClick={() => {
                  setLogsSource(src);
                  setTimeout(() => loadTelemetryLogs(), 50);
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${isActive ? "ring-1 ring-primary border-primary bg-primaryGlow text-primary-hover" : sourceColors[src] || "bg-zinc-800 text-textMuted border-borderColor"} hover:opacity-90`}
              >
                {src === "ALL" ? "🔗 All Sources" : src}
              </button>
            );
          })}
          <span className="text-[9px] text-textMuted ml-auto">{logs.length} log entries</span>
        </div>

        {/* Logs Explorer Table list */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-lg overflow-hidden flex flex-col min-h-[300px]">
          {logsLoading && (
            <div className="p-6 flex flex-col gap-4 animate-pulse">
              <div className="h-10 bg-borderColor rounded w-full"></div>
              <div className="h-10 bg-borderColor rounded w-full"></div>
              <div className="h-10 bg-borderColor rounded w-full"></div>
            </div>
          )}

          {!logsLoading && logs.length === 0 ? (
            <div className="p-12 text-center text-textMuted flex flex-col items-center justify-center gap-2">
              <ShieldAlert size={30} className="text-textMuted" />
              <span className="text-xs">No telemetry logs matching criteria were recorded</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-borderColor overflow-y-auto max-h-[600px]">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const dateText =
                  new Date(log.timestamp).toLocaleDateString() +
                  " " +
                  new Date(log.timestamp).toLocaleTimeString();
                let badgeClass = "bg-statusPillBg border-borderColor text-textMuted";
                if (log.severity === "WARN")
                  badgeClass = "bg-warningGlow border-warning/30 text-warning";
                else if (log.severity === "ERROR")
                  badgeClass = "bg-errorGlow border-error/30 text-error";
                else if (log.severity === "CRITICAL")
                  badgeClass = "bg-errorGlow border-error/50 text-error font-bold";
                else if (log.severity === "INFO")
                  badgeClass = "bg-successGlow border-success/20 text-success";

                const sourceBadgeColors: Record<string, string> = {
                  system: "bg-blue-900/40 text-blue-300 border-blue-500/20",
                  dashboard: "bg-violet-900/40 text-violet-300 border-violet-500/20",
                  lifecycle: "bg-cyan-900/40 text-cyan-300 border-cyan-500/20",
                  telemetry: "bg-emerald-900/40 text-emerald-300 border-emerald-500/20",
                  watcher: "bg-amber-900/40 text-amber-300 border-amber-500/20",
                  "test-runner": "bg-pink-900/40 text-pink-300 border-pink-500/20",
                  "query-console": "bg-orange-900/40 text-orange-300 border-orange-500/20",
                };

                return (
                  <div key={log.id} className="flex flex-col transition-all">
                    {/* Log Row Header */}
                    <div
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-tableRowHover transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${badgeClass}`}
                        >
                          {log.severity}
                        </span>
                        {log.source && (
                          <span
                            className={`px-2 py-0.5 rounded border text-[9px] font-mono font-semibold ${sourceBadgeColors[log.source] || "bg-zinc-800 text-textMuted border-borderColor"}`}
                          >
                            {log.source}
                          </span>
                        )}
                        <span className="text-[10px] text-textMuted font-mono whitespace-nowrap">
                          {dateText}
                        </span>
                        <span className="text-white font-bold truncate">{log.action}</span>
                      </div>

                      <div className="flex items-center gap-4 text-textMuted font-mono text-[10px] flex-shrink-0">
                        <span>
                          User:{" "}
                          <span className="text-primary-hover font-semibold">
                            {log.user_name || log.userId || "System"}
                          </span>
                        </span>
                        <span>
                          IP: <span>{log.ipAddress || "127.0.0.1"}</span>
                        </span>
                        <ChevronRight
                          size={14}
                          className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>

                    {/* Expand details */}
                    {isExpanded && (
                      <div className="px-5 py-4 bg-bgLogDetails border-t border-borderColor/50 animate-fadeIn">
                        <pre className="font-mono text-[11px] text-textConsole overflow-x-auto bg-bgConsole p-4 rounded-lg border border-borderColor/60 max-h-[300px]">
                          {formatJSONPayload(log.payload)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // VIEW 6: General Overview
  const renderOverviewTab = () => {
    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Database Size & Tables
            </span>
            <span className="text-3xl font-extrabold text-white">
              {overviewData.tableCount || 0}
            </span>
            <p className="text-xs text-textMuted mt-1">Total active tables in schema public.</p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              System Audits Logged
            </span>
            <span className="text-3xl font-extrabold text-accent">
              {overviewData.logsCount || 0}
            </span>
            <p className="text-xs text-textMuted mt-1">
              Total indexed logs inside rotating audits ring-buffer.
            </p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-1 shadow-md hover:border-borderColorGlow transition-all">
            <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Test Results Status
            </span>
            {overviewData.lastTestRun ? (
              <span className="text-2xl font-extrabold flex items-center gap-1.5 mt-0.5">
                <span className="text-success">{overviewData.lastTestRun.passed} Pass</span>
                <span className="text-textMuted">/</span>
                <span className="text-error">{overviewData.lastTestRun.failed} Fail</span>
              </span>
            ) : (
              <span className="text-3xl font-extrabold text-textMuted">Not Run</span>
            )}
            <p className="text-[10px] text-textMuted mt-1">
              {overviewData.lastTestRun
                ? `Last executed: ${new Date(overviewData.lastTestRun.timestamp).toLocaleTimeString()}`
                : "Execute testing pipelines to update metrics."}
            </p>
          </div>
        </div>

        {/* Database Tables registry */}
        <div className="bg-bgCard border border-borderColor rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-borderColor bg-bgTh flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Database Registry Indices
            </h3>
            <button
              onClick={() => refreshOverview()}
              disabled={overviewLoading}
              className="text-textMuted hover:text-white p-1 rounded hover:bg-sidebarHover transition-all"
            >
              <RefreshCw size={12} className={overviewLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bgTh/30 text-textMuted font-bold border-b border-borderColor">
                  <th className="px-5 py-3">Table Name</th>
                  <th className="px-5 py-3">Key Column Index</th>
                  <th className="px-5 py-3">Records Size Estimate</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor font-semibold">
                {overviewData.tables?.map((row: any) => (
                  <tr key={row.name} className="hover:bg-tableRowHover transition-colors">
                    <td className="px-5 py-3.5 font-mono text-primary">{row.name}</td>
                    <td className="px-5 py-3.5 font-mono text-textMuted text-[11px]">
                      {row.keyColumns.join(", ")}
                    </td>
                    <td className="px-5 py-3.5 text-textMain">{row.rows} records</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setActiveTab("db");
                          selectExplorerTable(row.name);
                        }}
                        className="bg-primary/20 text-primary-hover px-2.5 py-1 rounded border border-primary/20 text-[10px] hover:bg-primary hover:text-white transition-all font-bold"
                      >
                        Explore Schema
                      </button>
                    </td>
                  </tr>
                ))}
                {(!overviewData.tables || overviewData.tables.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-textMuted">
                      No structural database table schemas detected in registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // VIEW 8: Org Hierarchy & CSV Help
  const renderOrgHelpView = () => {
    const validatePaste = () => {
      if (!csvPaste.trim()) {
        setValidationResult({ status: "empty", errors: [] });
        return;
      }
      const lines = csvPaste
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        setValidationResult({ status: "empty", errors: [] });
        return;
      }

      const errors: string[] = [];
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const expected = ["eid", "name", "email", "role", "designation", "vertical", "managereid"];
      const missing = expected.filter((e) => !headers.includes(e));
      if (missing.length > 0) {
        errors.push(`Header row is missing required column(s): ${missing.join(", ")}`);
      }

      const rows: any[] = [];
      const eids = new Set<string>();
      const emailSet = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",").map((c) => c.trim());
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowData[h] = cells[idx] || "";
        });

        const lineNum = i + 1;

        if (!rowData.eid) {
          errors.push(`Line ${lineNum}: Missing EID`);
        } else {
          if (eids.has(rowData.eid)) {
            errors.push(`Line ${lineNum}: Duplicate EID "${rowData.eid}" in file`);
          }
          eids.add(rowData.eid);
        }

        if (!rowData.email) {
          errors.push(`Line ${lineNum}: Missing Email`);
        } else {
          if (!rowData.email.includes("@")) {
            errors.push(`Line ${lineNum}: Invalid Email address "${rowData.email}"`);
          }
          if (emailSet.has(rowData.email)) {
            errors.push(`Line ${lineNum}: Duplicate Email "${rowData.email}" in file`);
          }
          emailSet.add(rowData.email);
        }

        if (!rowData.name) {
          errors.push(`Line ${lineNum}: Missing Name`);
        }

        if (rowData.role) {
          const validRoles = ["super_admin", "admin", "user", "read_only_admin"];
          if (!validRoles.includes(rowData.role)) {
            errors.push(
              `Line ${lineNum}: Invalid Role "${rowData.role}" (Must be one of: ${validRoles.join(", ")})`,
            );
          }
        }

        rows.push(rowData);
      }

      const parentMap = new Map<string, string>();
      rows.forEach((r) => {
        if (r.eid && r.managereid) {
          parentMap.set(r.eid, r.managereid);
        }
      });

      rows.forEach((r) => {
        if (!r.eid) return;
        let slow = r.eid;
        let fast = r.eid;
        let cycle = false;

        while (slow && fast) {
          slow = parentMap.get(slow) || "";
          const temp = parentMap.get(fast) || "";
          fast = parentMap.get(temp) || "";
          if (slow && slow === fast) {
            cycle = true;
            break;
          }
        }

        if (cycle) {
          errors.push(`Circular Reporting Loop detected involving EID "${r.eid}"!`);
        }
      });

      if (errors.length === 0) {
        setValidationResult({ status: "valid", errors: [], rowCount: rows.length });
      } else {
        setValidationResult({ status: "invalid", errors, rowCount: rows.length });
      }
    };

    return (
      <div className="flex flex-col gap-6 w-full animate-fadeIn text-left">
        <div className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-md">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <HelpCircle className="text-primary-hover" size={24} />
            Generic Org Hierarchy & CSV Blueprint Guide
          </h2>
          <p className="text-xs text-textMuted mt-2 leading-relaxed">
            SG Forge implements a highly polymorphic, multi-dimensional organizational data model
            designed to support any business taxonomy. Use this interactive guide to understand the
            schema architecture, design guidelines, and validate CSV batch files before ingestion.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-4 shadow-md">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-borderColor pb-2">
              Architectural Philosophy
            </h3>

            <div className="space-y-4 text-xs text-textMuted">
              <div>
                <h4 className="font-bold text-white text-xs">1. Dynamic Taxonomy Support</h4>
                <p className="mt-1">
                  Instead of rigid databases mapping departments and divisions to fixed columns, SG
                  Forge uses a unified, self-referencing tree structures utilizing Postgres{" "}
                  <code>ltree</code> extensions for fast path resolution, allowing deep nesting
                  (e.g. Company &rarr; Vertical &rarr; Department &rarr; Team &rarr; Pod).
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white text-xs">
                  2. Relational Reporting Relationships
                </h4>
                <p className="mt-1">
                  Line management is governed by the self-referencing <code>managerId</code> field
                  in the main personnel tables. Standard users must have reporting lines; admins and
                  super admins are decoupled to enforce segregation of administrative duties.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white text-xs">
                  3. Custom Fields Flexibility (JSONB)
                </h4>
                <p className="mt-1">
                  Both structural metadata nodes and users have an <code>extendedAttributes</code>{" "}
                  JSONB payload to host customized client fields (e.g., cost centers, office
                  locations, timezone codes, active certifications) without schema migration
                  requirements.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-4 shadow-md">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-borderColor pb-2">
              Primary Schema Entities
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-bgMain rounded-lg border border-borderColor/60">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-primary font-bold">users</span>
                  <span className="text-[10px] bg-successGlow border border-success/30 text-success px-1.5 py-0.5 rounded font-mono">
                    Table
                  </span>
                </div>
                <p className="text-[11px] text-textMuted mt-1">
                  Represents individual personnel directory. Connects manager report paths, core
                  role types, and maps designations & verticals.
                </p>
              </div>

              <div className="p-3 bg-bgMain rounded-lg border border-borderColor/60">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-primary font-bold">org_nodes</span>
                  <span className="text-[10px] bg-successGlow border border-success/30 text-success px-1.5 py-0.5 rounded font-mono">
                    Table
                  </span>
                </div>
                <p className="text-[11px] text-textMuted mt-1">
                  Vertical reporting tree nodes utilizing the postgres <code>ltree</code> class for
                  fast ancestor/descendant resolution queries.
                </p>
              </div>

              <div className="p-3 bg-bgMain rounded-lg border border-borderColor/60">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-primary font-bold">
                    structural_metadata
                  </span>
                  <span className="text-[10px] bg-successGlow border border-success/30 text-success px-1.5 py-0.5 rounded font-mono">
                    Table
                  </span>
                </div>
                <p className="text-[11px] text-textMuted mt-1">
                  Polymorphic matrix lookup defining company levels, locations, verticals, and
                  sorting orders.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-4 shadow-md">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 border-b border-borderColor pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                CSV Ingestion Specifications
              </h3>
              <p className="text-xs text-textMuted mt-1">
                Ensure CSV files conform to these exact header structures to run error-free
                bulk-ingests.
              </p>
            </div>
            <button
              onClick={() => {
                const csvData =
                  "EID,Name,Email,Role,Designation,Vertical,ManagerEID\nE1001,John Doe,john.doe@company.com,user,Software Engineer,Engineering,\nE1002,Jane Smith,jane.smith@company.com,user,Director,Engineering,E1001\nE1003,Bob Johnson,bob.johnson@company.com,user,Team Lead,Engineering,E1002";
                navigator.clipboard.writeText(csvData);
                showToast("Sample template copied to clipboard!", "success");
              }}
              className="px-3.5 py-1.5 bg-primary/20 hover:bg-primary border border-primary/30 text-primary-hover hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              📋 Copy Sample Template
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bgTh/30 text-textMuted font-bold border-b border-borderColor">
                  <th className="px-4 py-2">Column Header</th>
                  <th className="px-4 py-2">Required</th>
                  <th className="px-4 py-2">Type / Format</th>
                  <th className="px-4 py-2">Purpose & Schema Mapping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor/60 text-textMuted leading-relaxed">
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">EID</td>
                  <td className="px-4 py-3 text-warning font-semibold">Yes</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR</td>
                  <td className="px-4 py-3">
                    Unique personnel code (e.g. <code>E1029</code>). Acts as lookup key during
                    updates.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">Name</td>
                  <td className="px-4 py-3 text-warning font-semibold">Yes</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR</td>
                  <td className="px-4 py-3">Full name of the employee.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">Email</td>
                  <td className="px-4 py-3 text-warning font-semibold">Yes</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR (Unique)</td>
                  <td className="px-4 py-3">Corporate email address. Used as secondary key.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">Role</td>
                  <td className="px-4 py-3 text-textMuted">No</td>
                  <td className="px-4 py-3 font-mono text-[11px]">user | admin | super_admin</td>
                  <td className="px-4 py-3">
                    Security access level role inside the portal. Defaults to <code>user</code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">Designation</td>
                  <td className="px-4 py-3 text-textMuted">No</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR</td>
                  <td className="px-4 py-3">
                    Maps or auto-creates metadata in <code>structural_metadata</code> (type:
                    job_level).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">Vertical</td>
                  <td className="px-4 py-3 text-textMuted">No</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR</td>
                  <td className="px-4 py-3">
                    Maps or auto-creates business division in <code>structural_metadata</code>{" "}
                    (type: vertical).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-white font-bold">ManagerEID</td>
                  <td className="px-4 py-3 text-textMuted">No</td>
                  <td className="px-4 py-3 font-mono text-[11px]">VARCHAR</td>
                  <td className="px-4 py-3">
                    EID of the direct reporting manager. Dynamically resolved to database{" "}
                    <code>managerId</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-bgCard border border-borderColor rounded-xl p-5 flex flex-col gap-4 shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Interactive CSV Validator Tool
          </h3>
          <p className="text-xs text-textMuted">
            Paste your CSV draft file below to run validation rules locally before running database
            ingestions.
          </p>

          <div className="flex flex-col gap-3">
            <textarea
              className="bg-bgConsole border border-borderColor font-mono text-xs text-textConsole p-4 rounded-xl h-36 outline-none focus:border-primary focus:ring-1 focus:ring-primaryGlow"
              placeholder="Paste your CSV contents here..."
              value={csvPaste}
              onChange={(e) => setCsvPaste(e.target.value)}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={validatePaste}
                className="px-4 py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Validate CSV Format
              </button>
              <button
                onClick={() => {
                  setCsvPaste("");
                  setValidationResult(null);
                }}
                className="px-3.5 py-2 border border-borderColor rounded-lg text-xs text-textMuted hover:text-white transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>

            {validationResult && (
              <div
                className={`p-4 rounded-xl border ${
                  validationResult.status === "valid"
                    ? "bg-successGlow/20 border-success/30 text-success"
                    : "bg-errorGlow/20 border-error/30 text-error"
                } animate-fadeIn`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {validationResult.status === "valid" ? (
                    <>
                      <CheckCircle2 size={16} />
                      CSV structure validated successfully! ({validationResult.rowCount} personnel
                      records parsed)
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={16} />
                      Validation failed with {validationResult.errors.length} issue(s)
                    </>
                  )}
                </div>

                {validationResult.errors.length > 0 && (
                  <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-textMuted font-mono">
                    {validationResult.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Auth View Layout ---
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-radial bg-bgMain select-none relative animate-fadeIn p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--bg-glow)_0%,var(--bg-main)_70%)] z-0"></div>

        <div className="bg-bgCard border border-borderColor p-8 rounded-2xl w-full max-w-sm flex flex-col gap-6 shadow-2xl relative z-10 backdrop-blur-xl">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent">
              SG Forge DevCenter
            </h1>
            <p className="text-xs text-textMuted mt-1.5 font-medium">
              Development Administration Console
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
                Authentication Passkey
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-inputBg border border-borderColor rounded-lg px-3 py-2 text-sm outline-none text-white focus:border-primary focus:ring-1 focus:ring-primaryGlow"
                required
              />
            </div>

            {authError && (
              <div className="text-error text-[11px] font-semibold flex items-center gap-1">
                <ShieldAlert size={12} />
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="bg-primary hover:bg-primaryHover text-white py-2 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1"
            >
              {authLoading ? "Verifying Credentials..." : "Authenticate"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Layout ---
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden text-textMain bg-bgMain"
      id="mainLayout"
    >
      {/* Full Width Top Header Bar */}
      <header className="h-[60px] w-full border-b border-borderColor bg-bgHeader flex items-center justify-between px-6 z-40 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-borderColor">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex-shrink-0 shadow-lg font-black text-xs">
              SG
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                SG Forge DevCenter
              </span>
              <span className="text-[9px] text-textMuted font-mono">
                PORT 3002 {/* SUPERUSER */}
              </span>
            </div>
          </div>

          <h2 className="text-sm font-bold capitalize text-white flex items-center gap-2">
            {activeTab.replace("-", " ")}
            {sseStatus === "connected" ? (
              <span className="inline-flex items-center gap-1 bg-successGlow border border-success/30 text-success px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-all shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                Live Feed
              </span>
            ) : sseStatus === "connecting" ? (
              <span className="inline-flex items-center gap-1 bg-warningGlow border border-warning/30 text-warning px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide animate-pulse shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                Reconnecting
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-errorGlow border border-error/30 text-error px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                Offline
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Multi-Port Quick Navigation Links */}
          <div className="hidden lg:flex items-center gap-1 bg-inputBg border border-borderColor p-1 rounded-xl text-xs font-mono">
            <a
              href="http://localhost:3001"
              className="px-2.5 py-1 rounded-lg text-textMuted hover:text-white hover:bg-sidebarHover transition-all flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>:3001 Portal
            </a>
            <span className="text-borderColor font-sans">|</span>
            <a
              href="http://localhost:3002"
              className="px-2.5 py-1 rounded-lg bg-primaryGlow text-primary-hover border border-primary/40 font-semibold flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>:3002
              DevCenter
            </a>
            <span className="text-borderColor font-sans">|</span>
            <a
              href="http://localhost:3003/developer"
              className="px-2.5 py-1 rounded-lg text-textMuted hover:text-white hover:bg-sidebarHover transition-all flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>:3003 Proxy
            </a>
          </div>

          {/* Compact mode toggle */}
          <button
            onClick={() => {
              const next = !compactMode;
              setCompactMode(next);
              localStorage.setItem("compactMode", String(next));
            }}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${compactMode ? "bg-primary text-white border-primary" : "bg-statusPillBg border-borderColor text-textMuted"}`}
          >
            Dense View
          </button>

          {/* Theme Dropdown menu */}
          <div className="relative">
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="bg-inputBg border border-borderColor text-textMain text-xs px-3 py-1.5 rounded-lg flex items-center gap-2"
            >
              {themeNames[theme] || "Theme"}
              <ChevronDown size={12} />
            </button>
            {themeMenuOpen && (
              <div className="absolute right-0 mt-1 z-50 bg-bgMain border border-borderColor rounded-lg p-1 shadow-2xl min-w-[150px]">
                {Object.entries(themeNames).map(([key, name]) => (
                  <div
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      localStorage.setItem("devCenterTheme", key);
                      setThemeMenuOpen(false);
                    }}
                    className={`p-2 text-xs rounded-md cursor-pointer font-semibold transition-colors ${theme === key ? "bg-primaryGlow text-primary-hover" : "text-textMuted hover:text-white hover:bg-sidebarHover"}`}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-errorGlow/20 rounded-lg hover:text-error text-textMuted flex-shrink-0 transition-colors"
            title="Lock Console"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Content Row Under Header: Floating Sidebar on Left, Main Content on Right */}
      <div className="flex flex-1 h-[calc(100vh-60px)] w-full min-h-0 relative overflow-hidden">
        {/* Common Floating Expandable Sidebar */}
        <div className="relative w-[4.5rem] md:w-[5rem] h-full flex-shrink-0 z-30">
          <div className="group absolute top-0 left-0 h-full w-[4.5rem] md:w-[5rem] hover:w-64 bg-bgSidebar border-r border-borderColor transition-all duration-300 flex flex-col shadow-2xl overflow-hidden rounded-r-2xl sm:rounded-none z-30">
            {/* Navigation Lists */}
            <div className="flex-1 py-4 flex flex-col gap-2 overflow-y-auto px-3">
              {[
                { id: "overview", icon: <Activity size={18} />, label: "Overview" },
                { id: "drift", icon: <FileText size={18} />, label: "Doc Freshness & Drift" },
                { id: "coverage", icon: <BarChart2 size={18} />, label: "Coverage & Analytics" },
                { id: "topology", icon: <GitBranch size={18} />, label: "Monorepo Topology" },
                { id: "db", icon: <Database size={18} />, label: "Database Explorer" },
                { id: "ecosystem", icon: <Cpu size={18} />, label: "Forge Apps Ecosystem" },
                { id: "logs", icon: <Terminal size={18} />, label: "Unified Logs Explorer" },
                {
                  id: "org-help",
                  icon: <HelpCircle size={18} />,
                  label: "Org Hierarchy & CSV Help",
                },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center px-2 py-2.5 rounded-xl transition-all duration-200 group/btn relative ${
                      isActive
                        ? "bg-sidebarActive text-sidebarActiveText border border-borderColorGlow font-semibold shadow-md"
                        : "text-textMuted hover:bg-sidebarHover hover:text-textMain border border-transparent"
                    }`}
                    title={item.label}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-[0_0_8px_var(--primary)]" />
                    )}
                    <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <span className="ml-3 text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Container Area */}
        <main className="flex-grow flex flex-col overflow-hidden min-w-0">
          {/* Content container body */}
          <div className="flex-grow p-6 overflow-y-auto min-h-0 min-w-0">
            {activeTab === "overview" && renderOverviewTab()}
            {activeTab === "drift" && renderDocsDriftView()}
            {activeTab === "coverage" && renderTestCoverageView()}
            {activeTab === "topology" && renderWorkspaceTopologyView()}
            {activeTab === "db" && renderDbExplorerView()}
            {activeTab === "ecosystem" && renderEcosystemView()}
            {activeTab === "logs" && renderTelemetryLogsView()}
            {activeTab === "org-help" && renderOrgHelpView()}
          </div>
        </main>
      </div>

      {/* Code diff overlay modal */}
      {activeDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-bgMain border border-borderColor rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-borderColor flex justify-between items-center bg-bgTh">
              <div>
                <h3 className="text-sm font-bold text-white">Documentation Drift Code Delta</h3>
                <p className="text-[10px] text-textMuted mt-0.5 font-mono">
                  {activeDiff.codePath} &lt;&gt; {activeDiff.docPath}
                </p>
              </div>
              <button
                onClick={() => setActiveDiff(null)}
                className="text-textMuted hover:text-white p-1 hover:bg-sidebarHover rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-grow p-4 overflow-auto bg-bgConsole">
              {renderDiffLines(activeDiff.diff)}
            </div>

            <div className="px-5 py-3 border-t border-borderColor flex justify-end gap-2 bg-bgTh">
              <button
                onClick={() => setActiveDiff(null)}
                className="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-slideIn">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md ${
              toastType === "error"
                ? "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/20"
                : toastType === "success"
                  ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/20"
                  : "bg-zinc-900/90 border-borderColor text-white"
            }`}
          >
            {toastType === "error" ? (
              <svg
                className="w-4 h-4 text-red-400 shrink-0 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : toastType === "success" ? (
              <svg
                className="w-4 h-4 text-emerald-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-primary shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span className="text-xs font-semibold tracking-wide">{toastMessage}</span>
            <button
              onClick={() => {
                setToastMessage(null);
                setToastType(null);
              }}
              className="text-textMuted hover:text-white font-bold text-xs pl-2 border-l border-borderColor/30 ml-2 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Render root element
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
