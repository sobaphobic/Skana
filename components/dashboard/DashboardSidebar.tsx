"use client";

import { FormField, PrimarySubmitButton } from "@/components/auth-forms";
import { BrandLogo } from "@/components/BrandLogo";
import type { CompanySession } from "@/lib/skanaSession";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser-client";
import {
  clearSkanaClientSession,
  joinCompanyByInviteCode,
  removeCompanyFromWorkspace,
  setActiveCompanyById,
} from "@/lib/skanaSession";
import {
  Bell,
  Building2,
  CheckSquare,
  LayoutDashboard,
  LineChart,
  LogOut,
  Pencil,
  RefreshCw,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: LineChart },
  { href: "/dashboard/current-users", label: "Current Users", icon: UserCircle },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/company", label: "Company", icon: Building2 },
  { href: "#", label: "Notifications", icon: Bell },
] as const;

function companyInitial(name: string) {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export function DashboardSidebar({
  company,
  companies,
}: {
  company: CompanySession | null;
  companies: CompanySession[];
}) {
  const pathname = usePathname();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanySession | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDeleteCompany = companies.length > 1;

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const handleSignOut = useCallback(async () => {
    clearSkanaClientSession();
    if (isSupabaseConfigured()) {
      const supabase = getBrowserSupabase();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    window.location.href = "/login";
  }, []);

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-crm-border/50 bg-crm-sidebar px-3 py-5">
      <div className="flex flex-col items-center gap-2 px-1 text-center">
        <BrandLogo size="xs" className="opacity-95" />
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-crm-muted">
          SkAna
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl border border-crm-border/80 py-2 text-xs font-medium text-crm-cream/90 transition hover:bg-white/5"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
          Edit
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center justify-center gap-2 rounded-xl border border-crm-border/80 py-2 text-xs font-medium text-crm-cream/90 transition hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
          Refresh
        </button>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
        <nav
          className="flex flex-col gap-0.5"
          aria-label="Main navigation"
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href !== "#" &&
              (href === "/dashboard"
                ? pathname === "/dashboard"
                : href === "/dashboard/pipeline"
                  ? pathname.startsWith("/dashboard/pipeline")
                  : href === "/dashboard/contacts"
                    ? pathname.startsWith("/dashboard/contacts")
                    : href === "/dashboard/company"
                      ? pathname.startsWith("/dashboard/company")
                      : pathname === href);
            const base =
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition";
            const activeCls = active
              ? "bg-crm-active/90 text-crm-cream shadow-sm"
              : "text-crm-muted hover:bg-white/5 hover:text-crm-cream";

            if (href === "#") {
              return (
                <span
                  key={label}
                  className={`${base} ${activeCls} cursor-default opacity-80`}
                  title="Coming soon"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                  {label}
                </span>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={`${base} ${activeCls}`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 shrink-0 border-t border-crm-border/40 pt-3">
          <p className="mb-2 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-crm-muted">
            Company
          </p>
          <div className="mb-2 flex max-h-48 flex-col gap-1 overflow-y-auto pr-0.5">
            {companies.map((c) => {
              const isActive = !!company?.id && c.id === company.id;
              const inner = (
                <>
                  {c.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- session data URL
                    <img
                      src={c.logoDataUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-crm-border/80"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-crm-cream/15 text-sm font-semibold text-crm-cream ring-1 ring-crm-border/80">
                      {companyInitial(c.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-crm-cream">
                    {c.name}
                  </span>
                  {isActive ? (
                    <span className="shrink-0 text-[0.6rem] font-medium uppercase tracking-wide text-crm-muted">
                      Active
                    </span>
                  ) : null}
                </>
              );
              const deleteBtn = canDeleteCompany ? (
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  title="Delete company"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(c);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-crm-border/60 text-crm-muted transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              ) : null;
              if (isActive) {
                return (
                  <div
                    key={c.id}
                    className="flex items-stretch gap-1"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-crm-active/50 bg-crm-active/15 px-2.5 py-2">
                      {inner}
                    </div>
                    {deleteBtn}
                  </div>
                );
              }
              return (
                <div key={c.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveCompanyById(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-crm-border/60 bg-crm-bg/25 px-2.5 py-2 text-left transition hover:border-crm-cream/25 hover:bg-white/5"
                  >
                    {inner}
                  </button>
                  {deleteBtn}
                </div>
              );
            })}
          </div>
          <Link
            href="/dashboard/company/new"
            className="mb-2 flex w-full items-center justify-center rounded-xl border border-dashed border-crm-border/70 py-2.5 text-xs font-medium text-crm-muted transition hover:border-crm-cream/35 hover:text-crm-cream"
          >
            + Add company
          </Link>
          <button
            type="button"
            onClick={() => {
              setJoinError(null);
              setJoinOpen(true);
            }}
            className="mb-3 flex w-full items-center justify-center rounded-xl border border-dashed border-crm-border/70 py-2.5 text-xs font-medium text-crm-muted transition hover:border-crm-cream/35 hover:text-crm-cream"
          >
            Join another company
          </button>
          {deleteTarget ? (
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-company-title"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-crm-border bg-crm-sidebar p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="delete-company-title"
                  className="text-sm font-semibold text-crm-cream"
                >
                  Delete &ldquo;{deleteTarget.name}&rdquo;?
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-crm-muted">
                  Removes this workspace from your list on this device and deletes
                  its pipeline, contacts, calendar entries, price list, and team
                  messages. Other companies are not affected. This cannot be undone.
                </p>
                {deleteError ? (
                  <p className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100/95">
                    {deleteError}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteError(null);
                    }}
                    className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const result = removeCompanyFromWorkspace(deleteTarget.id);
                      if (!result.ok) {
                        setDeleteError(result.error);
                        return;
                      }
                      setDeleteTarget(null);
                      setDeleteError(null);
                    }}
                    className="rounded-xl border border-red-500/45 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/25"
                  >
                    Delete company
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {joinOpen ? (
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="join-company-title"
              onClick={() => setJoinOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-crm-border bg-crm-sidebar p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="join-company-title"
                  className="text-sm font-semibold text-crm-cream"
                >
                  Join with company code
                </h2>
                <p className="mt-1 text-xs text-crm-muted">
                  Adds a separate workspace with its own pipeline and contacts.
                  Codes from a signed-in admin are checked online.
                </p>
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setJoinError(null);
                    const fd = new FormData(e.currentTarget);
                    const raw = String(
                      fd.get("company_login_code") ?? "",
                    ).trim();
                    setJoinBusy(true);
                    try {
                      const result = await joinCompanyByInviteCode(raw);
                      if (!result.ok) {
                        setJoinError(result.error);
                        return;
                      }
                      setJoinOpen(false);
                    } finally {
                      setJoinBusy(false);
                    }
                  }}
                >
                  {joinError ? (
                    <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100/95">
                      {joinError}
                    </p>
                  ) : null}
                  <FormField
                    id="sidebar_company_login_code"
                    name="company_login_code"
                    label="Company login code"
                    autoComplete="off"
                    placeholder="e.g. SKANA-X4K2-P8M1"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setJoinOpen(false)}
                      className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <PrimarySubmitButton disabled={joinBusy}>
                      {joinBusy ? "Adding…" : "Add company"}
                    </PrimarySubmitButton>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 shrink-0 border-t border-crm-border/40 pt-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-crm-border/80 py-2.5 text-sm font-medium text-crm-cream/90 transition hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" aria-hidden strokeWidth={2} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
