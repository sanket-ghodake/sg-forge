import type React from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
}

export function GlassCard({
  children,
  interactive = false,
  className = "",
  ...props
}: GlassCardProps) {
  const baseClass = interactive ? "glass-card-interactive" : "glass-card";
  return (
    <div className={`${baseClass} p-4 max-w-full min-w-0 box-border ${className}`} {...props}>
      {children}
    </div>
  );
}
