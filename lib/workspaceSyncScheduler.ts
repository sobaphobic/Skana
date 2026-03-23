import { isSupabaseConfigured } from "@/lib/supabase/browser-client";
import {
  getActiveCompanySharedPayloadForSync,
  getWorkspaceCodeNormForActiveCompany,
} from "@/lib/workspaceSyncContext";
import {
  isWorkspaceSyncApplyingRemote,
} from "@/lib/workspaceSyncFlags";
import type { WorkspaceDocKey } from "@/lib/workspaceSyncKeys";
import { pushWorkspaceDocument } from "@/lib/workspaceSyncRemote";

export {
  isWorkspaceSyncApplyingRemote,
  setWorkspaceSyncApplyingRemote,
} from "@/lib/workspaceSyncFlags";

const debouncers = new Map<string, number>();

export function scheduleWorkspaceDocumentPush(
  docKey: WorkspaceDocKey,
  getPayload: () => unknown,
): void {
  if (typeof window === "undefined" || isWorkspaceSyncApplyingRemote() || !isSupabaseConfigured()) {
    return;
  }
  const norm = getWorkspaceCodeNormForActiveCompany();
  if (!norm) return;

  const prev = debouncers.get(docKey);
  if (prev) clearTimeout(prev);

  debouncers.set(
    docKey,
    window.setTimeout(() => {
      debouncers.delete(docKey);
      const payload = getPayload();
      if (payload === null || payload === undefined) return;
      void pushWorkspaceDocument(norm, docKey, payload).catch(() => {});
    }, 500),
  );
}

/** After company bundle writes (when not applying a remote merge). */
export function scheduleActiveCompanySharedPush(): void {
  scheduleWorkspaceDocumentPush("company_shared", () =>
    getActiveCompanySharedPayloadForSync(),
  );
}
