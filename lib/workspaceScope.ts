/**
 * Fast lookup for the active company id so workspace-scoped session modules
 * (deals, contacts, etc.) do not import the full companies bundle graph.
 */

export const ACTIVE_COMPANY_ID_KEY = "skana_active_company_id";

/** Matches `COMPANY_SESSION_KEY` in skanaSession (kept here to avoid circular imports). */
const COMPANY_PROFILE_STORAGE_KEY = "skana_company_profile";

const workspaceListeners = new Set<() => void>();

export function subscribeWorkspaceScope(listener: () => void) {
  workspaceListeners.add(listener);
  return () => {
    workspaceListeners.delete(listener);
  };
}

export function emitWorkspaceScopeChanged() {
  for (const fn of workspaceListeners) {
    fn();
  }
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = sessionStorage.getItem(ACTIVE_COMPANY_ID_KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Prefer `skana_active_company_id`; if missing, recover `activeCompanyId` from the
 * v2 companies bundle and re-sync the session key. Prevents namespaced workspace data
 * (deals, calendar, etc.) from appearing empty after the active-id session key was lost.
 */
export function getEffectiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sid = getActiveWorkspaceId();
    if (sid) return sid;
    const raw = sessionStorage.getItem(COMPANY_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { v?: unknown; activeCompanyId?: unknown };
    if (p?.v !== 2 || typeof p.activeCompanyId !== "string") return null;
    const id = p.activeCompanyId.trim();
    if (!id) return null;
    syncActiveCompanyIdToSession(id);
    return id;
  } catch {
    return null;
  }
}

export function syncActiveCompanyIdToSession(activeCompanyId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!activeCompanyId?.trim()) {
      sessionStorage.removeItem(ACTIVE_COMPANY_ID_KEY);
    } else {
      sessionStorage.setItem(ACTIVE_COMPANY_ID_KEY, activeCompanyId.trim());
    }
    // Defer so callers inside useSyncExternalStore getSnapshot/read don’t
    // synchronously notify subscribers and trigger setState during render.
    queueMicrotask(() => emitWorkspaceScopeChanged());
  } catch {
    /* ignore */
  }
}

export function namespacedSessionKey(baseKey: string, companyId: string): string {
  return `${baseKey}__${companyId}`;
}
