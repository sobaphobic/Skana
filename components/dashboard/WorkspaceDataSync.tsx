"use client";

import { pullAndApplyWorkspaceDocuments } from "@/lib/workspaceSyncRemote";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";
import { getWorkspaceCodeNormForActiveCompany } from "@/lib/workspaceSyncContext";
import {
  readCompanySessionRaw,
  subscribeCompanySession,
} from "@/lib/skanaSession";
import { useEffect, useSyncExternalStore } from "react";

const INTERVAL_MS = 18_000;

/**
 * Periodically pulls workspace JSON documents from Supabase so cofounders share
 * deals, contacts, calendar/tasks, messages, etc. Pushes are debounced from each save path.
 */
export function WorkspaceDataSync() {
  const companyRaw = useSyncExternalStore(
    subscribeCompanySession,
    readCompanySessionRaw,
    () => null,
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    const run = async () => {
      if (cancelled || !getWorkspaceCodeNormForActiveCompany()) return;
      await pullAndApplyWorkspaceDocuments();
    };

    void run();
    const intervalId = window.setInterval(() => void run(), INTERVAL_MS);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [companyRaw]);

  return null;
}
