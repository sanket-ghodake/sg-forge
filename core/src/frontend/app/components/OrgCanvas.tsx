"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface OrgCanvasProps {
  users: any[];
  metadata: any[];
  session: any;
}

export interface OrgCanvasRef {
  centerNode: (userId: string) => void;
}

export const OrgCanvas = forwardRef<OrgCanvasRef, OrgCanvasProps>(
  ({ users, metadata, session }, ref) => {
    // Filter out admins/super admins from corporate hierarchy
    const displayUsers = React.useMemo(() => {
      return users.filter((u) => u.role === "user");
    }, [users]);

    // Canvas States
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [highlightedUserPath, setHighlightedUserPath] = useState<string[]>([]);
    const [selectedUserNode, setSelectedUserNode] = useState<string | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);

    // 1. Tree Positions Calculation (Dynamic hierarchical drawing)
    const computePositions = () => {
      const spacingX = 280;
      const spacingY = 220;
      const positions: { [key: string]: { x: number; y: number } } = {};
      const childrenMap: { [key: string]: string[] } = {};

      // Group children by manager
      displayUsers.forEach((u) => {
        if (u.manager_id) {
          if (!childrenMap[u.manager_id]) childrenMap[u.manager_id] = [];
          childrenMap[u.manager_id].push(u.id);
        }
      });

      // Roots are users whose manager_id is null or not in the user list
      const roots = displayUsers.filter(
        (u) => !u.manager_id || !displayUsers.some((parent) => parent.id === u.manager_id),
      );

      let nextX = 0;

      const traverse = (nodeId: string, depth: number): number => {
        const children = childrenMap[nodeId] || [];
        const childrenX: number[] = [];

        children.forEach((childId) => {
          childrenX.push(traverse(childId, depth + 1));
        });

        let x = 0;
        if (children.length > 0) {
          const minX = Math.min(...childrenX);
          const maxX = Math.max(...childrenX);
          x = (minX + maxX) / 2;
        } else {
          x = nextX;
          nextX += spacingX;
        }

        positions[nodeId] = { x, y: depth * spacingY };
        return x;
      };

      roots.forEach((r) => {
        traverse(r.id, 0);
        nextX += spacingX; // Space out disjoint trees
      });

      return positions;
    };

    const nodePositions = computePositions();

    // Find User Reporting Line Path to C-suite
    const highlightReportingLine = (userId: string) => {
      const path: string[] = [];
      let currentId: string | null = userId;

      while (currentId) {
        path.push(currentId);
        const currentUser = displayUsers.find((u) => u.id === currentId);
        currentId = currentUser ? currentUser.manager_id : null;
      }
      setHighlightedUserPath(path);
    };

    // Center Canvas on specific User
    const centerCanvasOnNode = (userId: string) => {
      const pos = nodePositions[userId];
      if (pos && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const newPanX = rect.width / 2 - pos.x * 1.5;
        const newPanY = rect.height / 2 - pos.y * 1.5;
        setZoom(1.5); // Micro Level
        setPan({ x: newPanX, y: newPanY });
        setSelectedUserNode(userId);
        highlightReportingLine(userId);
      }
    };

    // Expose centerNode method to parent component via ref
    useImperativeHandle(ref, () => ({
      centerNode: (userId: string) => {
        centerCanvasOnNode(userId);
      },
    }));

    const handleWhereAmI = () => {
      if (session) {
        const currentUser = displayUsers.find(
          (u) => u.email.toLowerCase() === session.email.toLowerCase(),
        );
        if (currentUser) {
          centerCanvasOnNode(currentUser.id);
        }
      }
    };

    // Canvas Mouse Panning & Zooming handlers
    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Wheel zoom handler — attached imperatively with { passive: false } to allow preventDefault
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        setZoom((prev) =>
          e.deltaY < 0 ? Math.min(prev * zoomFactor, 2.5) : Math.max(prev / zoomFactor, 0.4),
        );
      };
      canvas.addEventListener("wheel", onWheel, { passive: false });
      return () => canvas.removeEventListener("wheel", onWheel);
    }, []);

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Top Canvas Controls Panel */}
        <div className="absolute top-4 left-4 z-10 bg-surface-card/90 backdrop-blur border border-border-accent p-3 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="text-xs">
            <span className="font-bold text-text-secondary mr-2">Zoom Level:</span>
            <span className="font-black text-brand-accent px-2 py-0.5 bg-background-portal border border-border-accent rounded">
              {zoom < 0.8 ? "Macro (Verticals)" : zoom < 1.4 ? "Meso (Managers)" : "Micro (Cards)"}{" "}
              ({Math.round(zoom * 100)}%)
            </span>
          </div>

          <div className="h-4 w-[1px] bg-border-accent"></div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}
              className="p-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-text-primary transition-all font-extrabold text-sm"
              title="Zoom In"
            >
              ＋
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))}
              className="p-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-text-primary transition-all font-extrabold text-sm"
              title="Zoom Out"
            >
              －
            </button>
            <button
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
                setHighlightedUserPath([]);
                setSelectedUserNode(null);
              }}
              className="px-2.5 py-1.5 rounded-lg hover:bg-background-portal border border-border-accent text-xs font-bold transition-all"
              title="Reset View"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Main Interactive Zoom / Pan SVG viewport Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 w-full relative outline-none select-none overflow-hidden bg-[radial-gradient(var(--border-accent)_1px,transparent_1px)] bg-[size:24px_24px] cursor-grab ${isDragging ? "cursor-grabbing" : ""}`}
        >
          <div
            className="absolute origin-top-left transition-transform duration-100 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* SVG Connections Layer */}
            {zoom >= 0.8 && (
              <svg
                className="absolute overflow-visible pointer-events-none"
                style={{ left: 0, top: 0, width: 2000, height: 2000 }}
              >
                <defs>
                  <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {displayUsers.map((u) => {
                  if (!u.manager_id || !nodePositions[u.id] || !nodePositions[u.manager_id])
                    return null;
                  const from = nodePositions[u.manager_id];
                  const to = nodePositions[u.id];

                  const isHighlighted =
                    highlightedUserPath.includes(u.id) &&
                    highlightedUserPath.includes(u.manager_id);

                  // Beautiful cubic bezier curves
                  const controlY = (from.y + to.y) / 2;
                  const d = `M ${from.x + 100} ${from.y + 60} C ${from.x + 100} ${controlY}, ${to.x + 100} ${controlY}, ${to.x + 100} ${to.y}`;

                  return (
                    <path
                      key={u.id}
                      d={d}
                      fill="none"
                      stroke={isHighlighted ? "var(--brand-accent)" : "var(--border-accent)"}
                      strokeWidth={isHighlighted ? 4 : 2}
                      strokeDasharray={isHighlighted ? "0" : "4 4"}
                      style={{
                        filter: isHighlighted ? "url(#neon-glow)" : "none",
                        opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.25 : 1.0,
                      }}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>
            )}

            {/* ZOOM LEVEL 1: MACRO VIEW */}
            {zoom < 0.8 && (
              <div
                className="absolute grid grid-cols-2 gap-12 p-24 w-[1200px]"
                style={{ left: 100, top: 100 }}
              >
                {metadata
                  .filter((m) => m.type === "vertical")
                  .map((v) => {
                    const deptUsers = displayUsers.filter((u) => u.vertical_id === v.id);
                    return (
                      <div
                        key={v.id}
                        className="p-8 rounded-3xl bg-surface-card border-2 border-border-accent shadow-2xl hover:border-brand-accent transition-all duration-300 transform hover:scale-[1.02]"
                      >
                        <div className="flex items-center justify-between mb-4 border-b border-border-accent pb-4">
                          <h2 className="text-2xl font-black text-brand-accent">
                            {v.name} Department
                          </h2>
                          <span className="px-3.5 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-full text-xs font-bold text-brand-accent">
                            {deptUsers.length} Members
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-2">
                          {deptUsers.map((du) => (
                            <div
                              key={du.id}
                              className="p-3 bg-background-portal rounded-xl border border-border-accent flex items-center gap-2"
                            >
                              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-brand-accent to-success text-white font-extrabold flex items-center justify-center text-[10px] uppercase">
                                {du.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{du.name}</p>
                                <p className="text-[10px] text-text-secondary truncate">
                                  {du.designation || "Specialist"}
                                </p>
                              </div>
                            </div>
                          ))}
                          {deptUsers.length === 0 && (
                            <p className="text-xs text-text-secondary italic">
                              No active structural assignments in this vertical
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ZOOM LEVEL 2: MESO VIEW */}
            {zoom >= 0.8 && zoom < 1.4 && (
              <div className="absolute" style={{ left: 0, top: 0 }}>
                {displayUsers.map((u) => {
                  const pos = nodePositions[u.id];
                  if (!pos) return null;

                  const isHighlighted = highlightedUserPath.includes(u.id);
                  const isSelected = selectedUserNode === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUserNode(u.id);
                        highlightReportingLine(u.id);
                      }}
                      className={`absolute p-4 rounded-2xl bg-surface-card border-2 shadow-lg cursor-pointer transition-all duration-300 w-[200px] hover:border-brand-accent ${
                        isSelected
                          ? "border-success scale-105 shadow-success/25"
                          : isHighlighted
                            ? "border-brand-accent"
                            : "border-border-accent"
                      }`}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.4 : 1.0,
                      }}
                    >
                      <p className="text-xs font-bold truncate text-text-primary">{u.name}</p>
                      <p className="text-[10px] truncate text-brand-accent font-semibold">
                        {u.designation || "Specialist"}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[8px] text-text-secondary uppercase font-semibold">
                        <span>{u.eid}</span>
                        <span>{u.vertical || "SG Forge"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ZOOM LEVEL 3: MICRO VIEW */}
            {zoom >= 1.4 && (
              <div className="absolute" style={{ left: 0, top: 0 }}>
                {displayUsers.map((u) => {
                  const pos = nodePositions[u.id];
                  if (!pos) return null;

                  const isHighlighted = highlightedUserPath.includes(u.id);
                  const isSelected = selectedUserNode === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUserNode(u.id);
                        highlightReportingLine(u.id);
                      }}
                      className={`absolute p-5 rounded-2xl bg-surface-card border-2 shadow-2xl cursor-pointer transition-all duration-300 w-[240px] flex gap-4 ${
                        isSelected
                          ? "border-success scale-105 shadow-success/20 ring-4 ring-success/20"
                          : isHighlighted
                            ? "border-brand-accent shadow-brand-accent/20 ring-2 ring-brand-accent/20"
                            : "border-border-accent"
                      }`}
                      style={{
                        left: pos.x,
                        top: pos.y,
                        opacity: highlightedUserPath.length > 0 && !isHighlighted ? 0.3 : 1.0,
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-accent to-success flex items-center justify-center text-white text-base font-extrabold shadow-inner">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-success rounded-full border-2 border-surface-card animate-pulse shadow-md"></span>
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-black truncate text-text-primary leading-tight">
                            {u.name}
                          </h4>
                          <p className="text-[10px] text-brand-accent font-extrabold uppercase tracking-wide truncate mt-0.5">
                            {u.designation || "Staff Member"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-accent/40 text-[9px] text-text-secondary font-bold uppercase tracking-wider">
                          <span>EID: {u.eid}</span>
                          <span className="px-1.5 py-0.5 bg-background-portal border border-border-accent rounded text-[8px] truncate max-w-[80px]">
                            {u.vertical || "Corporate"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleWhereAmI}
          className="absolute bottom-6 right-6 p-4 rounded-full bg-brand-accent text-white hover:bg-brand-accent/90 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/20 z-10 flex items-center justify-center"
          title="Locate Myself and trace reporting line"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    );
  },
);

OrgCanvas.displayName = "OrgCanvas";
