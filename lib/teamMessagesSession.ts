import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export const TEAM_MESSAGES_SESSION_KEY = "skana_team_messages";

const listeners = new Set<() => void>();

function teamMessagesStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return TEAM_MESSAGES_SESSION_KEY;
  return namespacedSessionKey(TEAM_MESSAGES_SESSION_KEY, id);
}

export function subscribeTeamMessages(listener: () => void) {
  listeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    listeners.delete(listener);
    uw();
  };
}

function emitTeamMessagesChanged() {
  for (const fn of listeners) {
    fn();
  }
}

export type TeamMessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

export type TeamMessage = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: TeamMessageAttachment[];
};

export type TeamMessageThreads = Record<string, TeamMessage[]>;

function threadsPayloadNonEmpty(raw: string): boolean {
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    return !!o && typeof o === "object" && Object.keys(o).length > 0;
  } catch {
    return false;
  }
}

export function readTeamMessagesRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = teamMessagesStorageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || !threadsPayloadNonEmpty(raw)) &&
      key !== TEAM_MESSAGES_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(TEAM_MESSAGES_SESSION_KEY);
      if (leg && threadsPayloadNonEmpty(leg)) {
        sessionStorage.setItem(key, leg);
        sessionStorage.removeItem(TEAM_MESSAGES_SESSION_KEY);
        raw = leg;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function parseAttachment(row: unknown): TeamMessageAttachment | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const fileName = typeof r.fileName === "string" ? r.fileName.trim() : "";
  const mimeType = typeof r.mimeType === "string" ? r.mimeType.trim() : "";
  const dataUrl = typeof r.dataUrl === "string" ? r.dataUrl : "";
  if (!id || !fileName || !dataUrl) return null;
  return {
    id,
    fileName,
    mimeType: mimeType || "application/octet-stream",
    dataUrl,
  };
}

function parseMessageArray(data: unknown): TeamMessage[] {
  if (!Array.isArray(data)) return [];
  const out: TeamMessage[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const authorName =
      typeof r.authorName === "string" ? r.authorName.trim() : "";
    const body = typeof r.body === "string" ? r.body : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
    if (!id || !authorName || !createdAt) continue;
    const attRaw = r.attachments;
    const attachments: TeamMessageAttachment[] = [];
    if (Array.isArray(attRaw)) {
      for (const a of attRaw) {
        const p = parseAttachment(a);
        if (p) attachments.push(p);
      }
    }
    out.push({ id, authorName, body, createdAt, attachments });
  }
  return out;
}

/** Legacy single-thread format was a raw JSON array. */
const LEGACY_THREAD_KEY = "demo_alex_chen";

function parseStoredThreads(raw: string | null): TeamMessageThreads {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      return { [LEGACY_THREAD_KEY]: parseMessageArray(data) };
    }
    if (data && typeof data === "object" && "threads" in data) {
      const t = (data as { threads: unknown }).threads;
      if (!t || typeof t !== "object") return {};
      const out: TeamMessageThreads = {};
      for (const [key, value] of Object.entries(t)) {
        if (typeof key !== "string" || !key.trim()) continue;
        out[key] = parseMessageArray(value);
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveThreads(threads: TeamMessageThreads): boolean {
  try {
    sessionStorage.setItem(
      teamMessagesStorageKey(),
      JSON.stringify({ threads }),
    );
    emitTeamMessagesChanged();
    return true;
  } catch {
    /* quota / private mode */
    return false;
  }
}

export function getThreadMessages(threadId: string): TeamMessage[] {
  const threads = parseStoredThreads(readTeamMessagesRaw());
  return threads[threadId] ?? [];
}

export function appendTeamMessage(
  threadId: string,
  message: {
    authorName: string;
    body: string;
    attachments: TeamMessageAttachment[];
  },
): boolean {
  const tid = threadId.trim();
  if (!tid) return false;
  const authorName = message.authorName.trim();
  const body = message.body.trim();
  if (!authorName) return false;
  if (!body && message.attachments.length === 0) return false;

  const threads = parseStoredThreads(readTeamMessagesRaw());
  const prev = threads[tid] ?? [];
  const row: TeamMessage = {
    id: crypto.randomUUID(),
    authorName,
    body,
    createdAt: new Date().toISOString(),
    attachments: message.attachments,
  };
  return saveThreads({ ...threads, [tid]: [...prev, row] });
}

/** Legacy session key; still cleared on sign-out / migration. */
export const TEAM_DEMO_UNREAD_SEED_KEY = "skana_demo_unread_seeded_v1";
