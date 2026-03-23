import type { TeamMessage } from "./teamMessagesSession";
import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export const TEAM_MESSAGES_READ_SESSION_KEY = "skana_team_messages_read";

/** Messages from teammates (not you) since you last opened this thread. */
export function countUnreadPeerMessages(
  messages: TeamMessage[],
  myDisplayName: string,
  lastReadAtIso: string | undefined,
): number {
  const self = myDisplayName.trim();
  const fromPeer = messages.filter((m) => m.authorName.trim() !== self);
  if (fromPeer.length === 0) return 0;
  if (!lastReadAtIso) return fromPeer.length;
  const t = new Date(lastReadAtIso).getTime();
  return fromPeer.filter((m) => new Date(m.createdAt).getTime() > t).length;
}

const listeners = new Set<() => void>();

function teamReadStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return TEAM_MESSAGES_READ_SESSION_KEY;
  return namespacedSessionKey(TEAM_MESSAGES_READ_SESSION_KEY, id);
}

export function subscribeTeamMessagesRead(listener: () => void) {
  listeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    listeners.delete(listener);
    uw();
  };
}

function emitReadChanged() {
  for (const fn of listeners) {
    fn();
  }
}

export type TeamMessagesReadState = {
  /** threadId → ISO time you last opened that thread (messages modal). */
  lastReadAt: Record<string, string>;
};

function readStateNonEmpty(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as { lastReadAt?: Record<string, unknown> };
    const lr = data?.lastReadAt;
    return !!lr && typeof lr === "object" && Object.keys(lr).length > 0;
  } catch {
    return false;
  }
}

export function readTeamMessagesReadRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = teamReadStorageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || !readStateNonEmpty(raw)) &&
      key !== TEAM_MESSAGES_READ_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(TEAM_MESSAGES_READ_SESSION_KEY);
      if (leg && readStateNonEmpty(leg)) {
        sessionStorage.setItem(key, leg);
        sessionStorage.removeItem(TEAM_MESSAGES_READ_SESSION_KEY);
        raw = leg;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

export function parseTeamMessagesReadState(
  raw: string | null,
): TeamMessagesReadState {
  if (!raw) return { lastReadAt: {} };
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return { lastReadAt: {} };
    const lr = (data as { lastReadAt?: unknown }).lastReadAt;
    if (!lr || typeof lr !== "object") return { lastReadAt: {} };
    const lastReadAt: Record<string, string> = {};
    for (const [k, v] of Object.entries(lr)) {
      if (typeof k === "string" && k.trim() && typeof v === "string" && v) {
        lastReadAt[k.trim()] = v;
      }
    }
    return { lastReadAt };
  } catch {
    return { lastReadAt: {} };
  }
}

function saveReadState(state: TeamMessagesReadState): void {
  try {
    sessionStorage.setItem(teamReadStorageKey(), JSON.stringify(state));
    emitReadChanged();
  } catch {
    /* quota / private mode */
  }
}

/** Call when the user opens a thread so peer messages stop counting as unread. */
export function markTeamThreadRead(threadId: string): void {
  const tid = threadId.trim();
  if (!tid) return;
  const prev = parseTeamMessagesReadState(readTeamMessagesReadRaw());
  saveReadState({
    lastReadAt: {
      ...prev.lastReadAt,
      [tid]: new Date().toISOString(),
    },
  });
}

export function getThreadLastReadAt(
  threadId: string,
  state: TeamMessagesReadState,
): string | undefined {
  return state.lastReadAt[threadId.trim()];
}
