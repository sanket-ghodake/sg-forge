import type React from "react";
import { Header } from "@/app/components/ui/Header";
import { type NavItem, Sidebar } from "@/app/components/ui/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  brandingName?: string;
  brandingLogo?: string;
  headerTitle?: string;
  user?: any;
  onLogout?: () => void;
  headerActions?: React.ReactNode;
}

export function AppShell({
  children,
  navItems,
  brandingName,
  brandingLogo,
  headerTitle,
  user,
  onLogout,
  headerActions,
}: AppShellProps) {
  return (
    <div className="flex flex-col h-screen w-full bg-background-portal overflow-hidden">
      {/* Full width top Header */}
      <Header
        title={headerTitle}
        user={user}
        onLogout={onLogout}
        brandingName={brandingName}
        brandingLogo={brandingLogo}
      >
        {headerActions}
      </Header>

      {/* Content row under Header: Sidebar on left, main content on right */}
      <div className="flex flex-1 h-[calc(100vh-4rem)] w-full min-h-0 relative overflow-hidden">
        {/* Ambient glow backgrounds */}
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-brand-accent/10 blur-[120px] pointer-events-none transition-all duration-700"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[30%] h-[30%] rounded-full bg-success/10 blur-[120px] pointer-events-none transition-all duration-700"></div>

        <Sidebar items={navItems} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative z-10 flex flex-col items-center">
          <div className="w-full max-w-[1600px] h-full flex flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
