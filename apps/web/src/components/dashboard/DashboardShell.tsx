"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Calculator, LogOut, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Kerangka area login Petain: header dengan menu berpindah antara tabel
 * dashboard dan kalkulator HPP, plus info akun & keluar. Dipakai oleh
 * /dashboard dan /kalkulator-hpp agar UI/UX kedua halaman konsisten.
 */

const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: Table2 },
  { key: "kalkulator-hpp", href: "/kalkulator-hpp", label: "Kalkulator HPP", shortLabel: "HPP", icon: Calculator },
  { key: "agent-ai", href: "/agent-ai", label: "Agent AI", shortLabel: "AI", icon: Bot },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

interface DashboardShellProps {
  email: string;
  active: NavKey;
  /** Halaman padat (kalkulator) memakai kontainer lebih lebar. */
  wide?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ email, active, wide = false, children }: DashboardShellProps) {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div
          className={cn(
            "mx-auto flex h-14 items-center gap-4 px-4 sm:px-6",
            wide ? "max-w-7xl" : "max-w-6xl",
          )}
        >
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
            <img src="/logo.svg" alt="" className="h-6 w-auto" />
          </Link>

          <nav aria-label="Menu dashboard" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === active;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-sm text-muted-foreground md:inline">
              {email}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-3.5" />
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8 sm:px-6",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </main>
    </div>
  );
}
