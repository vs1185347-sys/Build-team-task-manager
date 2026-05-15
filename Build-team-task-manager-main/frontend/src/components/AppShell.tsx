import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, FolderKanban, LayoutDashboard, LogOut, Menu, Search, Shield, Users, X } from "lucide-react";
import { useState } from "react";

import type { User } from "../types";
import { cn } from "../utils/cn";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/Button";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: BarChart3 },
  { href: "/team", label: "Team", icon: Users },
];

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/team": "Team",
};

export function AppShell({
  user,
  isDark,
  onToggleTheme,
  onLogout,
}: {
  user: User;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] ?? "Workspace";

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200/70 bg-white/88 px-4 py-5 shadow-soft backdrop-blur-xl transition-transform dark:border-slate-800 dark:bg-slate-950/88 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">Team Task</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manager</p>
            </div>
          </div>
          <Button
            aria-label="Close navigation"
            className="h-9 w-9 px-0 lg:hidden"
            variant="ghost"
            icon={<X className="h-4 w-4" />}
            onClick={() => setOpen(false)}
          />
        </div>

        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-950 text-white shadow-soft dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-500 text-sm font-bold text-white">
              {user.avatar}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
            {user.role}
          </div>
        </div>
      </aside>

      {open ? <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/72 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/72 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                aria-label="Open navigation"
                className="h-10 w-10 px-0 lg:hidden"
                variant="secondary"
                icon={<Menu className="h-4 w-4" />}
                onClick={() => setOpen(true)}
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h1>
                <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                  {user.role === "ADMIN" ? "Plan, assign, and measure team delivery." : "Track your assigned work and project progress."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 md:flex">
                <Search className="h-4 w-4" />
                <span>Search in tables</span>
              </div>
              <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
              <Button aria-label="Logout" variant="secondary" className="h-10 w-10 px-0" icon={<LogOut className="h-4 w-4" />} onClick={onLogout} />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
