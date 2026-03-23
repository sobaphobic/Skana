"use client";

import type { CompanySession } from "@/lib/skanaSession";
import Link from "next/link";

function companyInitial(name: string) {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export function DashboardMainHeader({
  company,
}: {
  company: CompanySession | null;
}) {
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-crm-border/50 bg-crm-main/95 px-6 py-4 backdrop-blur-sm">
      {company ? (
        <>
          {company.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- session data URL
            <img
              src={company.logoDataUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-md ring-1 ring-crm-border/80"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-crm-cream/15 text-lg font-semibold text-crm-cream shadow-md ring-1 ring-crm-border/80">
              {companyInitial(company.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-crm-cream">
              {company.name}
            </h1>
            <p className="text-xs text-crm-muted">Company workspace</p>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-crm-cream">
              No company loaded
            </h1>
            <p className="text-sm text-crm-muted">
              Create a company to see your workspace header here.
            </p>
          </div>
          <Link
            href="/onboarding/company/create"
            className="rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
          >
            Set up company
          </Link>
        </div>
      )}
    </header>
  );
}
