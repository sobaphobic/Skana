"use client";

import {
  listCompaniesInSession,
  parseCompanySession,
  readCompanySessionRaw,
  subscribeCompanySession,
  type CompanySession,
} from "@/lib/skanaSession";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DashboardMainHeader } from "./DashboardMainHeader";
import { DashboardSidebar } from "./DashboardSidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const companyRaw = useSyncExternalStore(
    subscribeCompanySession,
    readCompanySessionRaw,
    () => null,
  );

  const company = useMemo(
    () => parseCompanySession(companyRaw),
    [companyRaw],
  );

  /** Avoid SSR/client hydration mismatch: session companies only exist in the browser. */
  const [companies, setCompanies] = useState<CompanySession[]>([]);
  useEffect(() => {
    setCompanies(listCompaniesInSession());
  }, [companyRaw]);

  return (
    <div className="flex min-h-screen w-full bg-crm-main text-foreground">
      <DashboardSidebar company={company} companies={companies} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardMainHeader company={company} />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}
