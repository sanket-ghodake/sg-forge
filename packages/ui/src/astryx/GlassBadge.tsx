import type React from "react";

export interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "danger";
  className?: string;
}

export function GlassBadge({ children, variant = "info", className = "" }: GlassBadgeProps) {
  const variantStyles = {
    info: "bg-brand-muted text-brand-accent border-brand-accent/30",
    success: "bg-emerald-500/15 text-success border-success/30",
    warning: "bg-amber-500/15 text-warning-text border-warning/30",
    danger: "bg-rose-500/15 text-danger border-danger/30",
  }[variant];

  return (
    <span
      className={`glass-pill border inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold tracking-wide max-w-full ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}
