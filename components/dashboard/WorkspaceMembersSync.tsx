"use client";

import {
  parseCompanySession,
  readCompanySessionRaw,
  readOnboardingProfileRaw,
  saveCompanySession,
  subscribeCompanySession,
} from "@/lib/skanaSession";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";
import {
  buildMergedWorkspacePeople,
  shouldUpdateCompanyPeople,
} from "@/lib/workspaceMembersRemote";
import { useEffect, useSyncExternalStore } from "react";

const REFRESH_MS = 90_000;

/**
 * Keeps `company.people` in sync with Supabase-registered teammates for the active company.
 */
export function WorkspaceMembersSync() {
  const companyRaw = useSyncExternalStore(
    subscribeCompanySession,
    readCompanySessionRaw,
    () => null,
  );

  const profileRaw = useSyncExternalStore(
    () => () => {},
    readOnboardingProfileRaw,
    () => null,
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const c = parseCompanySession(companyRaw);
      if (!c?.id) return;
      const merged = await buildMergedWorkspacePeople(c, profileRaw);
      if (cancelled) return;
      if (shouldUpdateCompanyPeople(c.people, merged)) {
        saveCompanySession({ ...c, people: merged });
      }
    };

    void run();

    if (!isSupabaseConfigured()) {
      return () => {
        cancelled = true;
      };
    }

    const id = window.setInterval(() => {
      void run();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [companyRaw, profileRaw]);

  return null;
}
