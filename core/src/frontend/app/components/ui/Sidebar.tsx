import type React from "react";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  active?: boolean;
}

interface SidebarProps {
  items: NavItem[];
  brandingLogo?: string;
  brandingName?: string;
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <div className="relative w-[4.5rem] md:w-[5rem] h-full flex-shrink-0 z-30">
      {/* The expanding overlay sidebar */}
      <div className="group absolute top-0 left-0 h-full w-[4.5rem] md:w-[5rem] hover:w-64 bg-sidebar-bg border-r border-border-accent transition-all duration-300 flex flex-col shadow-2xl overflow-hidden rounded-r-2xl sm:rounded-none">
        {/* Navigation Items */}
        <div className="flex-1 py-4 flex flex-col gap-2 overflow-y-auto px-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className={`w-full flex items-center px-2 py-2.5 rounded-xl transition-all duration-200 group/btn relative ${
                item.active
                  ? "bg-sidebar-active text-sidebar-text-active border border-brand-accent/30"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active border border-transparent"
              }`}
            >
              {item.active && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-accent rounded-r-full shadow-[0_0_8px_var(--brand-accent)]" />
              )}
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <span className="ml-3 text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
