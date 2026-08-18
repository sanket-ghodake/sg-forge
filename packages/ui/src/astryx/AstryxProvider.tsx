"use client";
import type React from "react";

export interface AstryxProviderProps {
  children: React.ReactNode;
  theme?: "dark" | "light" | "system";
}

export function AstryxProvider({ children, theme = "dark" }: AstryxProviderProps) {
  return (
    <div data-astryx-root data-theme={theme} className="astryx-container">
      {children}
    </div>
  );
}
