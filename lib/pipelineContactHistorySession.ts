import {
  type ContactHistoryEntry,
  createHistoryEntryId,
  parseContactHistoryEntries,
} from "./contactHistory";
import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export const PIPELINE_CONTACT_HISTORY_SESSION_KEY =
  "skana_pipeline_contact_history";

export type HistoryStore = Record<string, ContactHistoryEntry[]>;

const listeners = new Set<() => void>();

function pipelineHistoryStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return PIPELINE_CONTACT_HISTORY_SESSION_KEY;
  return namespacedSessionKey(PIPELINE_CONTACT_HISTORY_SESSION_KEY, id);
}

export function subscribePipelineContactHistory(listener: () => void) {
  listeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    listeners.delete(listener);
    uw();
  };
}

function emitChanged() {
  for (const fn of listeners) {
    fn();
  }
}

function historyStoreNonEmpty(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    return !!data && typeof data === "object" && Object.keys(data).length > 0;
  } catch {
    return false;
  }
}

export function readPipelineContactHistoryRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = pipelineHistoryStorageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || !historyStoreNonEmpty(raw)) &&
      key !== PIPELINE_CONTACT_HISTORY_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(PIPELINE_CONTACT_HISTORY_SESSION_KEY);
      if (leg && historyStoreNonEmpty(leg)) {
        sessionStorage.setItem(key, leg);
        sessionStorage.removeItem(PIPELINE_CONTACT_HISTORY_SESSION_KEY);
        raw = leg;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

export function parsePipelineContactHistory(
  raw: string | null,
): HistoryStore {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    const out: HistoryStore = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (!k) continue;
      const entries = parseContactHistoryEntries(v);
      if (entries.length > 0) out[k] = entries;
    }
    return out;
  } catch {
    return {};
  }
}

export function readPipelineContactHistory(): HistoryStore {
  return parsePipelineContactHistory(readPipelineContactHistoryRaw());
}

export function replacePipelineContactHistoryStore(store: HistoryStore): void {
  savePipelineContactHistory(store);
}

function savePipelineContactHistory(store: HistoryStore): void {
  try {
    sessionStorage.setItem(
      pipelineHistoryStorageKey(),
      JSON.stringify(store),
    );
    emitChanged();
    if (typeof window !== "undefined") {
      void import("./workspaceSyncScheduler").then((m) => {
        m.scheduleWorkspaceDocumentPush(
          "pipeline_contact_history",
          () => store,
        );
      });
    }
  } catch {
    /* quota / private mode */
  }
}

export function getHistoryForPipelineKey(
  store: HistoryStore,
  pipelineKey: string,
): ContactHistoryEntry[] {
  return store[pipelineKey] ?? [];
}

export function appendPipelineContactHistory(
  pipelineKey: string,
  body: string,
): void {
  const trimmed = body.trim();
  if (!trimmed || !pipelineKey) return;
  const store = readPipelineContactHistory();
  const prev = store[pipelineKey] ?? [];
  const entry: ContactHistoryEntry = {
    id: createHistoryEntryId(),
    body: trimmed,
    createdAt: new Date().toISOString(),
  };
  savePipelineContactHistory({
    ...store,
    [pipelineKey]: [entry, ...prev].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  });
}
