"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CirclePlus,
  FileSpreadsheet,
  GraduationCap,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/permissions";
import { api, roleLabel } from "@/lib/client";
import type { Role, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";

const icons = {
  LayoutDashboard,
  GraduationCap,
  Headset,
  CirclePlus,
  FileSpreadsheet,
  UserCheck,
  UserPlus,
  Users,
  Settings2,
  ScrollText,
};

function isNavActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/my-supports") {
    return pathname === "/my-supports" || pathname.startsWith("/supports/");
  }
  if (href === "/students") return pathname === "/students" || pathname.startsWith("/students/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role as Role)),
    [user]
  );

  const isModerator = user?.role === "moderator";
  const hideMobileTabs = isModerator && pathname.startsWith("/supports/");
  const tabs = items.filter((item) =>
    ["/dashboard", "/my-supports", "/students"].includes(item.href)
  );

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[#f4efe6] md:grid md:grid-cols-[260px_1fr]">
      {open && !isModerator ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-[#17302c]/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] bg-[#0b3b38] text-[#e8f3f0] transition md:static md:translate-x-0",
          isModerator && "hidden md:block",
          !isModerator && (open ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        )}
      >
        <div className="flex h-full flex-col px-5 py-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="font-[family-name:var(--font-fraunces)] text-2xl text-white">Medico</p>
              <p className="text-xs tracking-[0.18em] text-[#9ec8c2] uppercase">Support desk</p>
            </div>
            <button type="button" className="min-h-11 min-w-11 md:hidden" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = icons[item.icon];
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                    active ? "bg-white/12 text-white" : "text-[#c5ddd8] hover:bg-white/8"
                  )}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-3xl bg-white/8 p-4">
            <p className="text-sm font-medium text-white">{user?.name ?? "…"}</p>
            <p className="text-xs text-[#9ec8c2]">{user ? roleLabel[user.role] : ""}</p>
            <button type="button" onClick={logout} className="mt-3 min-h-11 text-xs text-[#f0d2b0] hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header
          className={cn(
            "sticky top-0 z-30 flex items-center gap-2 border-b border-[#ddd4c4] bg-[#f4efe6]/95 backdrop-blur",
            isModerator ? "px-3 py-2 md:px-8 md:py-3" : "px-4 py-3 md:px-8"
          )}
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          {!isModerator ? (
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-[#efe7d8] md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          ) : (
            <div className="shrink-0 md:hidden">
              <p className="font-[family-name:var(--font-fraunces)] text-xl leading-none text-[#17302c]">Medico</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border border-[#ddd4c4] bg-white px-4 text-[#5d6f6b]",
              isModerator ? "flex-1 text-base md:max-w-xl md:text-sm" : "w-full max-w-xl text-sm"
            )}
          >
            <Search size={16} />
            <span className="truncate">{isModerator ? "Search" : "Search students, rolls, numbers, supports…"}</span>
          </button>
          {isModerator ? (
            <button
              type="button"
              onClick={logout}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#0f5c56] hover:bg-[#efe7d8] md:hidden"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          ) : null}
        </header>
        <main
          className={cn(
            "page-grid px-4 py-5 md:px-8 md:py-6",
            isModerator && !hideMobileTabs && "pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-6"
          )}
        >
          {children}
        </main>
      </div>

      {isModerator && !hideMobileTabs ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ddd4c4] bg-[#fffdf8]/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-3">
            {tabs.map((item) => {
              const Icon = icons[item.icon];
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-[#0f5c56]" : "text-[#5d6f6b]"
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {searchOpen ? <GlobalSearch onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}
