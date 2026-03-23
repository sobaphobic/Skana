"use client";

import {
  listCompaniesInSession,
  parseCompanySession,
  readCompanySessionRaw,
  subscribeCompanySession,
  type CompanySession,
} from "@/lib/skanaSession";
import type { ReactNode } from "react";
import { useMemo, useSyncExternalStore } from "react";
import { DashboardMainHeader } from "./DashboardMainHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { WorkspaceDataSync } from "./WorkspaceDataSync";
import { WorkspaceMembersSync } from "./WorkspaceMembersSync";

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

  /** Session companies only exist in the browser; server snapshot is empty. */
  const companies = useMemo((): CompanySession[] => {
    void companyRaw;
    if (typeof window === "undefined") return [];
    return listCompaniesInSession();
  }, [companyRaw]);

  return (
    <div className="flex min-h-screen w-full bg-crm-main text-foreground">
      <WorkspaceDataSync />
      <WorkspaceMembersSync />
      <DashboardSidebar company={company} companies={companies} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardMainHeader company={company} />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}
