import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser-client";
import { getEffectiveWorkspaceId } from "@/lib/workspaceScope";
import {
  getWorkspaceCodeNormForActiveCompany,
  readWorkspaceSyncDocTimestamps,
  writeWorkspaceSyncDocTimestamp,
} from "@/lib/workspaceSyncContext";
import {
  isWorkspaceSyncApplyingRemote,
  setWorkspaceSyncApplyingRemote,
} from "@/lib/workspaceSyncFlags";
import type { WorkspaceDocKey } from "@/lib/workspaceSyncKeys";
import { WORKSPACE_DOC_KEYS } from "@/lib/workspaceSyncKeys";

import { parseDeals, saveDeals } from "@/lib/dealsSession";
import { parseManualContacts, saveManualContacts } from "@/lib/manualContactsSession";
import {
  parseCalendarEntries,
  saveCalendarEntries,
} from "@/lib/calendarSession";
import { parsePriceList, savePriceList } from "@/lib/priceListSession";
import {
  parseTeamMessageThreadsFromStorageJson,
  replaceTeamMessageStore,
} from "@/lib/teamMessagesSession";
import {
  parseTeamMessagesReadState,
  replaceTeamMessagesReadState,
} from "@/lib/teamMessagesReadSession";
import {
  parsePipelineContactHistory,
  replacePipelineContactHistoryStore,
} from "@/lib/pipelineContactHistorySession";

type Row = {
  doc_key: string;
  payload: unknown;
  updated_at: string;
};

export async function pushWorkspaceDocument(
  workspaceCodeNorm: string,
  docKey: WorkspaceDocKey,
  payload: unknown,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.from("workspace_sync_documents").upsert(
    {
      workspace_code_norm: workspaceCodeNorm,
      doc_key: docKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_code_norm,doc_key" },
  );

  if (error) {
    console.warn("[SkAna] workspace sync push", docKey, error.message);
    return;
  }
  writeWorkspaceSyncDocTimestamp(
    workspaceCodeNorm,
    docKey,
    new Date().toISOString(),
  );
}

function serverIsNewer(
  serverIso: string,
  localIso: string | undefined,
): boolean {
  if (!localIso) return true;
  const a = Date.parse(serverIso);
  const b = Date.parse(localIso);
  if (Number.isNaN(a)) return false;
  if (Number.isNaN(b)) return true;
  return a > b;
}

function applyPulledDataRow(row: Row): void {
  const docKey = row.doc_key as WorkspaceDocKey;
  if (!WORKSPACE_DOC_KEYS.includes(docKey) || docKey === "company_shared") {
    return;
  }

  const payloadStr = JSON.stringify(row.payload ?? null);

  switch (docKey) {
    case "deals": {
      saveDeals(parseDeals(payloadStr));
      break;
    }
    case "contacts": {
      saveManualContacts(parseManualContacts(payloadStr));
      break;
    }
    case "calendar": {
      saveCalendarEntries(parseCalendarEntries(payloadStr));
      break;
    }
    case "price_list": {
      savePriceList(parsePriceList(payloadStr));
      break;
    }
    case "team_messages": {
      const wrapped =
        row.payload &&
        typeof row.payload === "object" &&
        "threads" in (row.payload as object)
          ? payloadStr
          : JSON.stringify({ threads: row.payload ?? {} });
      replaceTeamMessageStore(parseTeamMessageThreadsFromStorageJson(wrapped));
      break;
    }
    case "team_messages_read": {
      replaceTeamMessagesReadState(parseTeamMessagesReadState(payloadStr));
      break;
    }
    case "pipeline_contact_history": {
      replacePipelineContactHistoryStore(
        parsePipelineContactHistory(payloadStr),
      );
      break;
    }
    default:
      break;
  }
}

/**
 * Pull all workspace documents from Supabase and apply any newer than local meta.
 */
export async function pullAndApplyWorkspaceDocuments(): Promise<void> {
  if (!isSupabaseConfigured() || isWorkspaceSyncApplyingRemote()) return;
  const norm = getWorkspaceCodeNormForActiveCompany();
  const localCompanyId = getEffectiveWorkspaceId();
  if (!norm || !localCompanyId) return;

  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await supabase
    .from("workspace_sync_documents")
    .select("doc_key, payload, updated_at")
    .eq("workspace_code_norm", norm);

  if (error) {
    console.warn("[SkAna] workspace sync pull", error.message);
    return;
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return;

  const meta = readWorkspaceSyncDocTimestamps(norm);
  const toApply: Row[] = [];
  for (const row of rows) {
    if (!row.doc_key || !row.updated_at) continue;
    const prev = meta[row.doc_key];
    if (serverIsNewer(row.updated_at, prev)) {
      toApply.push(row);
    }
  }

  if (toApply.length === 0) return;

  const dataRows = toApply.filter((r) => r.doc_key !== "company_shared");
  const companyRows = toApply.filter((r) => r.doc_key === "company_shared");
  const ordered = [...dataRows, ...companyRows];

  setWorkspaceSyncApplyingRemote(true);
  try {
    const skanaMod = await import("@/lib/skanaSession");
    for (const row of ordered) {
      if (row.doc_key === "company_shared") {
        skanaMod.applyRemoteCompanySharedPayload(norm, row.payload);
      } else {
        applyPulledDataRow(row);
      }
      writeWorkspaceSyncDocTimestamp(norm, row.doc_key, row.updated_at);
    }
  } finally {
    setWorkspaceSyncApplyingRemote(false);
  }
}
