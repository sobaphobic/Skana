import {
  createHistoryEntryId,
  parseContactHistoryEntries,
  type ContactHistoryEntry,
} from "./contactHistory";
import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export type { ContactHistoryEntry } from "./contactHistory";

export const MANUAL_CONTACTS_SESSION_KEY = "skana_manual_contacts";

/** Previous key; rows are migrated when read. */
export const LEGACY_BUSINESS_CONTACTS_SESSION_KEY = "skana_business_contacts";

const listeners = new Set<() => void>();

function manualContactsStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return MANUAL_CONTACTS_SESSION_KEY;
  return namespacedSessionKey(MANUAL_CONTACTS_SESSION_KEY, id);
}

export function subscribeManualContacts(listener: () => void) {
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

export type ManualContactKind = "customer" | "business";

export type ManualContact = {
  id: string;
  kind: ManualContactKind;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  jobTitle: string;
  createdAt: string;
  history: ContactHistoryEntry[];
};

function parseManualRow(row: Record<string, unknown>): ManualContact | null {
  const id = typeof row.id === "string" ? row.id : "";
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : "";
  if (!id || !createdAt) return null;

  const kindRaw = row.kind;
  if (kindRaw === "customer" || kindRaw === "business") {
    const firstName =
      typeof row.firstName === "string" ? row.firstName.trim() : "";
    const lastName = typeof row.lastName === "string" ? row.lastName.trim() : "";
    const phone = typeof row.phone === "string" ? row.phone.trim() : "";
    const email = typeof row.email === "string" ? row.email.trim() : "";
    const jobTitle =
      typeof row.jobTitle === "string" ? row.jobTitle.trim() : "";
    if (!email) return null;
    return {
      id,
      kind: kindRaw,
      firstName,
      lastName,
      phone,
      email,
      jobTitle,
      createdAt,
      history: parseContactHistoryEntries(row.history),
    };
  }

  const name = typeof row.name === "string" ? row.name.trim() : "";
  const email = typeof row.email === "string" ? row.email.trim() : "";
  if (!name || !email) return null;
  const company = typeof row.company === "string" ? row.company.trim() : "";
  const notes = typeof row.notes === "string" ? row.notes.trim() : "";
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? name;
  const lastName = parts.slice(1).join(" ");
  const jobTitle = [company, notes].filter(Boolean).join(" · ");
  return {
    id,
    kind: "business",
    firstName,
    lastName,
    phone: "",
    email,
    jobTitle,
    createdAt,
    history: [],
  };
}

export function parseManualContacts(raw: string | null): ManualContact[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: ManualContact[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const c = parseManualRow(row as Record<string, unknown>);
      if (c) out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

export function readManualContactsRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = manualContactsStorageKey();
    let next = sessionStorage.getItem(key);
    if (next) return next;
    const id = getEffectiveWorkspaceId();
    if (!id) {
      const legacy = sessionStorage.getItem(MANUAL_CONTACTS_SESSION_KEY);
      if (legacy) return legacy;
      return sessionStorage.getItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
    }
    const leg =
      sessionStorage.getItem(MANUAL_CONTACTS_SESSION_KEY) ??
      sessionStorage.getItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
    if (leg && leg !== "[]" && leg.trim()) {
      try {
        const arr = JSON.parse(leg) as unknown;
        if (Array.isArray(arr) && arr.length > 0) {
          sessionStorage.setItem(key, leg);
          sessionStorage.removeItem(MANUAL_CONTACTS_SESSION_KEY);
          sessionStorage.removeItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
          return leg;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function readManualContacts(): ManualContact[] {
  return parseManualContacts(readManualContactsRaw());
}

export function saveManualContacts(contacts: ManualContact[]): void {
  try {
    sessionStorage.setItem(
      manualContactsStorageKey(),
      JSON.stringify(contacts),
    );
    sessionStorage.removeItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
    emitChanged();
    if (typeof window !== "undefined") {
      void import("./workspaceSyncScheduler").then((m) => {
        m.scheduleWorkspaceDocumentPush("contacts", () => contacts);
      });
    }
  } catch {
    /* quota / private mode */
  }
}

function updateManualContactInStore(
  id: string,
  updater: (c: ManualContact) => ManualContact,
): void {
  const all = readManualContacts();
  if (!all.some((c) => c.id === id)) return;
  saveManualContacts(all.map((c) => (c.id === id ? updater(c) : c)));
}

export function updateManualContactFields(
  id: string,
  fields: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    jobTitle: string;
  },
): void {
  updateManualContactInStore(id, (c) => ({
    ...c,
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    jobTitle: fields.jobTitle.trim(),
  }));
}

export function appendManualContactHistory(id: string, body: string): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const entry: ContactHistoryEntry = {
    id: createHistoryEntryId(),
    body: trimmed,
    createdAt: new Date().toISOString(),
  };
  updateManualContactInStore(id, (c) => ({
    ...c,
    history: [entry, ...c.history].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  }));
}

export function appendManualContact(fields: {
  kind: ManualContactKind;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  jobTitle: string;
}): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const next: ManualContact = {
    id,
    kind: fields.kind,
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    jobTitle: fields.jobTitle.trim(),
    createdAt: new Date().toISOString(),
    history: [],
  };
  const all = readManualContacts();
  saveManualContacts([...all, next]);
  return id;
}

export function removeManualContact(id: string): void {
  const all = readManualContacts();
  saveManualContacts(all.filter((c) => c.id !== id));
}
