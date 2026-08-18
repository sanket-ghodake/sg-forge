import type React from "react";

interface HeaderProps {
  title?: string;
  user?: any;
  onLogout?: () => void;
  brandingName?: string;
  brandingLogo?: string;
  children?: React.ReactNode;
}

export function Header({
  title,
  user,
  onLogout,
  brandingName,
  brandingLogo,
  children,
}: HeaderProps) {
  return (
    <header className="h-16 w-full flex items-center justify-between px-6 bg-header-bg border-b border-border-accent flex-shrink-0 z-40 transition-colors duration-200">
      <div className="flex items-center gap-4">
        {(brandingLogo || brandingName) && (
          <div className="flex items-center gap-3 pr-4 border-r border-border-accent">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-brand-accent to-brand-hover text-white flex-shrink-0 shadow-lg">
              {brandingLogo ? (
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                <div
                  className="w-5 h-5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-white overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: brandingLogo }}
                />
              ) : (
                <span className="font-black text-sm">{brandingName?.charAt(0) || "S"}</span>
              )}
            </div>
            {brandingName && (
              <span className="font-black text-sm tracking-wide text-text-primary hidden sm:inline-block">
                {brandingName}
              </span>
            )}
          </div>
        )}
        {title && <h1 className="text-lg font-black tracking-tight text-text-primary">{title}</h1>}
      </div>

      <div className="flex items-center gap-4">
        {children}

        {user && (
          <div className="flex items-center gap-3 bg-surface-elevated border border-border-accent rounded-full py-1 pr-1 pl-4 hover:bg-surface-card transition-colors">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-black text-text-primary tracking-wide">{user.name}</div>
              <div className="text-[9px] text-brand-accent uppercase font-black tracking-widest">
                {user.role?.replace(/_/g, " ")}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-accent to-brand-hover flex items-center justify-center text-white font-bold text-sm shadow-md border border-white/20 relative cursor-pointer hover:scale-105 transition-transform"
              title="Click to logout"
            >
              {user.name?.charAt(0) || "U"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
