"use client";
import type React from "react";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

export function GlassButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: GlassButtonProps) {
  const variantStyles =
    variant === "primary"
      ? "glass-button text-white font-medium shadow-lg"
      : "glass-pill bg-white/5 hover:bg-white/10 text-white font-medium";

  return (
    <button
      className={`px-4 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-full box-border ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
