import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export const CALENDAR_ENTRIES_SESSION_KEY = "skana_calendar_entries";

const listeners = new Set<() => void>();

function storageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return CALENDAR_ENTRIES_SESSION_KEY;
  return namespacedSessionKey(CALENDAR_ENTRIES_SESSION_KEY, id);
}

export function subscribeCalendarEntries(listener: () => void) {
  listeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    listeners.delete(listener);
    uw();
  };
}

function emitChanged() {
  for (const fn of listeners) fn();
}

/** Apple-style: none, at start, or N minutes before start. */
export type CalendarAlert =
  | { type: "none" }
  | { type: "at_time" }
  | { type: "before"; minutes: number };

export const ALERT_BEFORE_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "At time of event" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 10080, label: "1 week before" },
];

export type CalendarEntryKind = "meeting" | "task" | "contact";

type CalendarEntryBase = {
  id: string;
  date: string;
  kind: CalendarEntryKind;
  assignAll: boolean;
  assigneeIds: string[];
  alert1: CalendarAlert;
  alert2: CalendarAlert;
  completed: boolean;
  createdAt: string;
};

export type CalendarMeetingEntry = CalendarEntryBase & {
  kind: "meeting";
  name: string;
  mode: "online" | "in_person";
  locationOrLink: string;
  startTime: string;
  durationMinutes: number;
};

export type CalendarTaskEntry = CalendarEntryBase & {
  kind: "task";
  title: string;
  description: string;
  deadlineTime: string | null;
  /** Set when completed; used to drop off Kanban after 7 days (still on calendar). */
  completedAt: string | null;
};

export type CalendarContactEntry = CalendarEntryBase & {
  kind: "contact";
  title: string;
  channel: "phone" | "text" | "email";
  scheduledTime: string;
  notes: string;
  linkedContactId: string | null;
};

export type CalendarEntry =
  | CalendarMeetingEntry
  | CalendarTaskEntry
  | CalendarContactEntry;

function parseAlert(raw: unknown): CalendarAlert {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const r = raw as Record<string, unknown>;
  const t = r.type;
  if (t === "at_time") return { type: "at_time" };
  if (t === "before" && typeof r.minutes === "number" && Number.isFinite(r.minutes)) {
    return { type: "before", minutes: Math.max(0, Math.round(r.minutes)) };
  }
  return { type: "none" };
}

function parseBase(row: Record<string, unknown>): Omit<
  CalendarEntryBase,
  "kind"
> | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const date = typeof row.date === "string" ? row.date.trim() : "";
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const assignAll = row.assignAll === true;
  const assigneeIds: string[] = [];
  if (Array.isArray(row.assigneeIds)) {
    for (const x of row.assigneeIds) {
      if (typeof x === "string" && x.trim()) assigneeIds.push(x.trim());
    }
  }
  const completed = row.completed === true;
  const createdAt =
    typeof row.createdAt === "string" && row.createdAt.trim()
      ? row.createdAt.trim()
      : new Date().toISOString();
  return {
    id,
    date,
    assignAll,
    assigneeIds,
    alert1: parseAlert(row.alert1),
    alert2: parseAlert(row.alert2),
    completed,
    createdAt,
  };
}

export function parseCalendarEntries(raw: string | null): CalendarEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: CalendarEntry[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const kind = r.kind;
      const base = parseBase(r);
      if (!base) continue;
      if (kind === "meeting") {
        const name = typeof r.name === "string" ? r.name.trim() : "";
        const mode = r.mode === "online" ? "online" : "in_person";
        const locationOrLink =
          typeof r.locationOrLink === "string" ? r.locationOrLink.trim() : "";
        const startTime =
          typeof r.startTime === "string" ? r.startTime.trim() : "";
        let durationMinutes = 60;
        if (typeof r.durationMinutes === "number" && Number.isFinite(r.durationMinutes)) {
          durationMinutes = Math.max(5, Math.round(r.durationMinutes));
        }
        if (!name || !startTime) continue;
        out.push({
          ...base,
          kind: "meeting",
          name,
          mode,
          locationOrLink,
          startTime,
          durationMinutes,
        });
      } else if (kind === "task") {
        const title = typeof r.title === "string" ? r.title.trim() : "";
        const description =
          typeof r.description === "string" ? r.description.trim() : "";
        let deadlineTime: string | null = null;
        if (typeof r.deadlineTime === "string" && r.deadlineTime.trim()) {
          deadlineTime = r.deadlineTime.trim();
        }
        let completedAt: string | null = null;
        if (typeof r.completedAt === "string" && r.completedAt.trim()) {
          completedAt = r.completedAt.trim();
        } else if (base.completed) {
          completedAt = base.createdAt;
        }
        if (!title) continue;
        out.push({
          ...base,
          kind: "task",
          title,
          description,
          deadlineTime,
          completedAt,
        });
      } else if (kind === "contact") {
        const title = typeof r.title === "string" ? r.title.trim() : "";
        const ch = r.channel;
        const channel =
          ch === "text" || ch === "email" ? ch : "phone";
        const scheduledTime =
          typeof r.scheduledTime === "string" ? r.scheduledTime.trim() : "";
        const notes = typeof r.notes === "string" ? r.notes.trim() : "";
        let linkedContactId: string | null = null;
        if (typeof r.linkedContactId === "string" && r.linkedContactId.trim()) {
          linkedContactId = r.linkedContactId.trim();
        }
        if (!title || !scheduledTime) continue;
        out.push({
          ...base,
          kind: "contact",
          title,
          channel,
          scheduledTime,
          notes,
          linkedContactId,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function readCalendarEntriesRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = storageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || raw === "[]") &&
      key !== CALENDAR_ENTRIES_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(CALENDAR_ENTRIES_SESSION_KEY);
      if (leg && leg !== "[]" && leg.trim()) {
        try {
          const arr = JSON.parse(leg) as unknown;
          if (Array.isArray(arr) && arr.length > 0) {
            sessionStorage.setItem(key, leg);
            sessionStorage.removeItem(CALENDAR_ENTRIES_SESSION_KEY);
            raw = leg;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return raw;
  } catch {
    return null;
  }
}

export function readCalendarEntries(): CalendarEntry[] {
  return parseCalendarEntries(readCalendarEntriesRaw());
}

export function saveCalendarEntries(entries: CalendarEntry[]): void {
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify(entries));
    emitChanged();
  } catch {
    /* quota */
  }
}

export function newCalendarEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function upsertCalendarEntry(entry: CalendarEntry): void {
  const all = readCalendarEntries();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    saveCalendarEntries(all.map((e) => (e.id === entry.id ? entry : e)));
  } else {
    saveCalendarEntries([...all, entry]);
  }
}

export function removeCalendarEntry(id: string): void {
  saveCalendarEntries(readCalendarEntries().filter((e) => e.id !== id));
}

export function setCalendarTaskCompleted(id: string, completed: boolean): void {
  const all = readCalendarEntries();
  const now = new Date().toISOString();
  saveCalendarEntries(
    all.map((e) => {
      if (e.kind !== "task" || e.id !== id) return e;
      return {
        ...e,
        completed,
        completedAt: completed ? now : null,
      };
    }),
  );
}

/** Kanban column id for tasks, or null when completed and older than retention. */
export type KanbanTaskColumn = "tasks" | "due_soon" | "overdue" | "completed";

/** Inclusive calendar-day window after today: due soon through today + this many days. */
export const KANBAN_DUE_SOON_DAYS = 2;
export const KANBAN_COMPLETED_VISIBLE_DAYS = 7;

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, mo, da] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    return ymd;
  }
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalYmd(d);
}

/** Whole calendar days from `fromYmd` to `toYmd` (signed: later − earlier). */
export function signedCalendarDaysBetweenYmd(
  fromYmd: string,
  toYmd: string,
): number {
  const [fy, fm, fd] = fromYmd.split("-").map((x) => Number.parseInt(x, 10));
  const [ty, tm, td] = toYmd.split("-").map((x) => Number.parseInt(x, 10));
  if (
    ![fy, fm, fd, ty, tm, td].every((n) => Number.isFinite(n)) ||
    fromYmd.length < 10 ||
    toYmd.length < 10
  ) {
    return 0;
  }
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

/** One line for Kanban cards: days left, overdue, or due today. */
export function formatTaskKanbanDueCaption(
  t: CalendarTaskEntry,
  now: Date,
): string {
  const todayYmd = formatLocalYmd(now);
  if (t.completed) return "";

  if (isCalendarEntryOverdue(t, todayYmd)) {
    if (t.date < todayYmd) {
      const n = signedCalendarDaysBetweenYmd(t.date, todayYmd);
      if (n === 1) return "1 day overdue";
      return `${n} days overdue`;
    }
    return "Due today — overdue";
  }

  const daysLeft = signedCalendarDaysBetweenYmd(todayYmd, t.date);
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "1 day remaining";
  return `${daysLeft} days remaining`;
}

export function classifyTaskKanbanColumn(
  t: CalendarTaskEntry,
  now: Date,
): KanbanTaskColumn | null {
  const todayYmd = formatLocalYmd(now);
  if (t.completed) {
    const ca = t.completedAt ?? t.createdAt;
    const t0 = new Date(ca).getTime();
    if (Number.isNaN(t0)) return "completed";
    const maxAge = KANBAN_COMPLETED_VISIBLE_DAYS * 86400000;
    if (now.getTime() - t0 > maxAge) return null;
    return "completed";
  }
  if (isCalendarEntryOverdue(t, todayYmd)) return "overdue";
  const dueSoonEnd = addDaysToYmd(todayYmd, KANBAN_DUE_SOON_DAYS);
  if (t.date >= todayYmd && t.date <= dueSoonEnd) return "due_soon";
  return "tasks";
}

export function getCalendarTaskEntries(entries: CalendarEntry[]): CalendarTaskEntry[] {
  return entries.filter((e): e is CalendarTaskEntry => e.kind === "task");
}

export function patchCalendarTask(
  id: string,
  patch: Partial<{
    date: string;
    deadlineTime: string | null;
    completed: boolean;
    completedAt: string | null;
  }>,
): void {
  const all = readCalendarEntries();
  saveCalendarEntries(
    all.map((e) => {
      if (e.kind !== "task" || e.id !== id) return e;
      const next = { ...e, ...patch };
      if (patch.completed === false) {
        next.completed = false;
        next.completedAt = null;
      }
      return next;
    }),
  );
}

export function entryMatchesMemberFilter(
  e: CalendarEntry,
  filter: "all" | Set<string>,
): boolean {
  if (e.assignAll) return true;
  if (filter === "all") return true;
  if (e.assigneeIds.length === 0) return true;
  return e.assigneeIds.some((id) => filter.has(id));
}

export function calendarEntryTitle(e: CalendarEntry): string {
  if (e.kind === "meeting") return e.name;
  if (e.kind === "task") return e.title;
  return e.title;
}

export function isCalendarEntryOverdue(e: CalendarEntry, todayYmd: string): boolean {
  if (e.kind === "task") {
    if (e.completed) return false;
    if (e.date < todayYmd) return true;
    if (e.date === todayYmd && e.deadlineTime) {
      const [hh, mm] = e.deadlineTime.split(":").map((x) => Number.parseInt(x, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
        return now.getTime() > end.getTime();
      }
    }
    return false;
  }
  if (e.kind === "meeting" || e.kind === "contact") {
    if (e.date < todayYmd) return true;
    if (e.date === todayYmd) {
      const time = e.kind === "meeting" ? e.startTime : e.scheduledTime;
      const [hh, mm] = time.split(":").map((x) => Number.parseInt(x, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const now = new Date();
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
        return now.getTime() > at.getTime();
      }
    }
    return false;
  }
  return false;
}
