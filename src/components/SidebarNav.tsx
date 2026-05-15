"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SidebarNavProps {
  items: NavItem[];
  role: string;
  orgName: string;
  userName?: string;
  userEmail?: string;
}

export function SidebarNav({
  items,
  role,
  orgName,
  userName,
  userEmail,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isActive = (href: string) => {
    if (href.includes("?")) return false;
    if (href === "/instructor" || href === "/student") return pathname === href;
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      {/* Logo + Org */}
      <div className="px-4 pt-5 pb-4 border-b border-zinc-200">
        <Logo />
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            {orgName}
          </p>
          <span className="status-badge status-badge--neutral mt-1">
            {role}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto text-[10px] font-bold bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 py-3 border-t border-zinc-200 mt-auto">
        {userName && (
          <div className="mb-3">
            <p className="text-sm font-semibold text-zinc-900 truncate">
              {userName}
            </p>
            {userEmail && (
              <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
            )}
          </div>
        )}
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden bg-white border border-zinc-200 rounded-lg p-2 text-zinc-700 hover:bg-zinc-50"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-60 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Sidebar navigation"
      >
        {navContent}
      </aside>
    </>
  );
}
