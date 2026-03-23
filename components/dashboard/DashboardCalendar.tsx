"use client";

import { CalendarTaskForm } from "@/components/dashboard/CalendarTaskForm";
import {
  alertSelectOptions,
  AssignBlock,
  AlertRow,
  CALENDAR_FORM_CONTROL_CLASS,
  decodeAlert,
} from "@/components/dashboard/calendarFormShared";
import {
  type CalendarContactEntry,
  type CalendarEntry,
  type CalendarEntryKind,
  type CalendarMeetingEntry,
  calendarEntryTitle,
  entryMatchesMemberFilter,
  isCalendarEntryOverdue,
  newCalendarEntryId,
  parseCalendarEntries,
  readCalendarEntriesRaw,
  removeCalendarEntry,
  saveCalendarEntries,
  setCalendarTaskCompleted,
  subscribeCalendarEntries,
  upsertCalendarEntry,
} from "@/lib/calendarSession";
import { formatMonthYear } from "@/lib/formatDate";
import {
  appendManualContact,
  appendManualContactHistory,
  parseManualContacts,
  readManualContactsRaw,
  subscribeManualContacts,
  type ManualContact,
} from "@/lib/manualContactsSession";
import {
  parseCompanySession,
  readCompanySessionRaw,
  subscribeCompanySession,
  type CompanyPerson,
} from "@/lib/skanaSession";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

function useAlertSelectOptions() {
  return useMemo(() => alertSelectOptions(), []);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TYPE_META: Record<
  CalendarEntryKind,
  { label: string; dotClass: string }
> = {
  meeting: { label: "Meetings", dotClass: "bg-fuchsia-400" },
  task: { label: "Tasks", dotClass: "bg-sky-400" },
  contact: { label: "Contacts", dotClass: "bg-amber-400" },
};

const controlClass = CALENDAR_FORM_CONTROL_CLASS;

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type DayCell = { ymd: string; dayNum: number; inCurrentMonth: boolean };

function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    cells.push({
      ymd: formatLocalYMD(d),
      dayNum: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function formatDayHeading(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return ymd;
  }
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function contactDisplayName(c: ManualContact): string {
  const n = `${c.firstName} ${c.lastName}`.trim();
  return n || c.email;
}

function buildContactHistoryNote(entry: CalendarContactEntry): string {
  const via =
    entry.channel === "email"
      ? "Email"
      : entry.channel === "text"
        ? "Text"
        : "Phone";
  const bits = [
    `Calendar follow-up: ${entry.title}`,
    `${via} at ${entry.scheduledTime}`,
    entry.notes ? entry.notes : null,
  ].filter(Boolean);
  return bits.join(" — ");
}

export function DashboardCalendar() {
  const today = useMemo(() => new Date(), []);
  const todayYmd = formatLocalYMD(today);

  const companyRaw = useSyncExternalStore(
    subscribeCompanySession,
    readCompanySessionRaw,
    () => null,
  );
  const company = useMemo(
    () => parseCompanySession(companyRaw),
    [companyRaw],
  );
  const teamMembers: CompanyPerson[] = company?.people ?? [];

  const calendarRaw = useSyncExternalStore(
    subscribeCalendarEntries,
    readCalendarEntriesRaw,
    () => null,
  );
  const entries = useMemo(
    () => parseCalendarEntries(calendarRaw),
    [calendarRaw],
  );

  const contactsRaw = useSyncExternalStore(
    subscribeManualContacts,
    readManualContactsRaw,
    () => null,
  );
  const contacts = useMemo(
    () => parseManualContacts(contactsRaw),
    [contactsRaw],
  );

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [memberFilter, setMemberFilter] = useState<"all" | Set<string>>("all");
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [addStep, setAddStep] = useState<
    null | "pick-kind" | CalendarEntryKind
  >(null);
  const [viewEntry, setViewEntry] = useState<CalendarEntry | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const filteredEntries = useMemo(
    () => entries.filter((it) => entryMatchesMemberFilter(it, memberFilter)),
    [entries, memberFilter],
  );

  const itemsByDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const it of filteredEntries) {
      const list = m.get(it.date) ?? [];
      list.push(it);
      m.set(it.date, list);
    }
    return m;
  }, [filteredEntries]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const monthTitle = formatMonthYear(cursor);

  const openDay = useCallback((ymd: string) => {
    setSelectedYmd(ymd);
    setAddStep(null);
    setViewEntry(null);
  }, []);

  const closePanels = useCallback(() => {
    setSelectedYmd(null);
    setAddStep(null);
    setViewEntry(null);
  }, []);

  function setAllMembers() {
    setMemberFilter("all");
  }

  function toggleMember(id: string) {
    setMemberFilter((prev) => {
      if (prev === "all") return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) return "all";
        return next;
      }
      next.add(id);
      return next;
    });
  }

  function memberButtonActive(id: string): boolean {
    if (memberFilter === "all") return false;
    return memberFilter.has(id);
  }

  const dayEntries = selectedYmd
    ? (itemsByDate.get(selectedYmd) ?? []).slice().sort((a, b) => {
        const ta =
          a.kind === "meeting"
            ? a.startTime
            : a.kind === "task"
              ? a.deadlineTime ?? "99:99"
              : a.scheduledTime;
        const tb =
          b.kind === "meeting"
            ? b.startTime
            : b.kind === "task"
              ? b.deadlineTime ?? "99:99"
              : b.scheduledTime;
        return ta.localeCompare(tb);
      })
    : [];

  return (
    <section className="rounded-2xl border border-crm-border bg-crm-elevated/35 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-crm-cream">Team calendar</h3>
        {teamMembers.length > 0 ? (
          <div
            className="flex flex-col gap-2"
            role="group"
            aria-label="Whose calendar to show"
          >
            <span className="text-xs font-medium text-crm-muted">Show</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={setAllMembers}
                aria-pressed={memberFilter === "all"}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  memberFilter === "all"
                    ? "border-crm-cream bg-crm-cream text-crm-bg shadow-sm"
                    : "border-crm-border/80 text-crm-cream/90 hover:bg-white/5"
                }`}
              >
                All
              </button>
              {teamMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  aria-pressed={memberButtonActive(m.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    memberButtonActive(m.id)
                      ? "border-crm-cream bg-crm-cream text-crm-bg shadow-sm"
                      : "border-crm-border/80 text-crm-cream/90 hover:bg-white/5"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-crm-muted">
            Add people under Company to filter by team member.
          </p>
        )}
      </div>

      <div
        className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-crm-muted"
        aria-label="Calendar legend"
      >
        {(Object.keys(TYPE_META) as CalendarEntryKind[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${TYPE_META[key].dotClass}`}
              aria-hidden
            />
            <span className="text-crm-cream/90">{TYPE_META[key].label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 border-l border-crm-border/60 pl-4">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-sky-400 ring-2 ring-green-400/85 ring-offset-1 ring-offset-crm-elevated/35"
            aria-hidden
          />
          <span className="text-crm-cream/90">Task done</span>
        </span>
        <span className="flex items-center gap-1.5 border-l border-crm-border/60 pl-4">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-400 ring-2 ring-red-400/60"
            aria-hidden
          />
          <span className="text-crm-cream/90">Overdue</span>
        </span>
      </div>

      <div className="mb-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-crm-border/80 text-crm-cream transition hover:bg-white/5"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h4 className="min-w-[10rem] text-center text-base font-semibold text-crm-cream">
          {monthTitle}
        </h4>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-crm-border/80 text-crm-cream transition hover:bg-white/5"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-crm-border/60 bg-crm-border/40"
        role="grid"
        aria-label={`Calendar for ${monthTitle}`}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-crm-sidebar/90 px-1 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted"
            role="columnheader"
          >
            {d}
          </div>
        ))}

        {grid.map((cell, idx) => {
          const dayItems = itemsByDate.get(cell.ymd) ?? [];
          const isToday = cell.ymd === todayYmd;
          const isPastDay = cell.ymd < todayYmd;
          const hasOverdue = dayItems.some((it) =>
            isCalendarEntryOverdue(it, todayYmd),
          );

          return (
            <button
              key={`${cell.ymd}-${idx}`}
              type="button"
              role="gridcell"
              onClick={() => openDay(cell.ymd)}
              className={`relative min-h-[4.25rem] w-full bg-crm-bg/50 p-1.5 text-left transition hover:bg-crm-bg/70 ${
                !cell.inCurrentMonth ? "opacity-40" : ""
              } ${isPastDay && cell.inCurrentMonth ? "bg-crm-bg/35" : ""} ${
                isToday
                  ? "z-[1] ring-2 ring-inset ring-crm-cream/70 ring-offset-0"
                  : ""
              } ${
                hasOverdue
                  ? "shadow-[inset_0_0_0_1px_rgba(248,113,113,0.55)]"
                  : ""
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday
                    ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-crm-cream text-crm-bg"
                    : cell.inCurrentMonth
                      ? "text-crm-cream"
                      : "text-crm-muted"
                }`}
              >
                {cell.dayNum}
              </span>
              {dayItems.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayItems.map((it) => {
                    const overdue = isCalendarEntryOverdue(it, todayYmd);
                    const done = it.kind === "task" && it.completed === true;
                    const meta = TYPE_META[it.kind];
                    const ringClass = done
                      ? "ring-2 ring-green-400 ring-offset-1 ring-offset-crm-bg/80"
                      : overdue
                        ? "ring-2 ring-red-400 ring-offset-1 ring-offset-crm-bg/80"
                        : "";
                    return (
                      <span
                        key={it.id}
                        title={calendarEntryTitle(it)}
                        className={`h-1.5 w-1.5 rounded-full ${meta.dotClass} ${ringClass}`}
                      />
                    );
                  })}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-crm-muted">
        Click a day to view entries and add new ones. Use{" "}
        <span className="text-crm-cream/90">Show</span> to filter by team
        member. Completed tasks show a{" "}
        <span className="text-green-300/90">green</span> ring.
      </p>

      {selectedYmd ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cal-day-title"
          onClick={closePanels}
        >
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-crm-border bg-crm-sidebar p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="cal-day-title"
              className="text-base font-semibold text-crm-cream"
            >
              {formatDayHeading(selectedYmd)}
            </h3>
            <p className="mt-0.5 text-xs text-crm-muted">{selectedYmd}</p>

            {addStep === null && !viewEntry ? (
              <>
                <ul className="mt-4 space-y-2">
                  {dayEntries.length === 0 ? (
                    <li className="rounded-xl border border-crm-border/60 bg-crm-bg/20 px-3 py-4 text-sm text-crm-muted">
                      Nothing scheduled this day.
                    </li>
                  ) : (
                    dayEntries.map((e) => {
                      const overdue = isCalendarEntryOverdue(e, todayYmd);
                      const meta = TYPE_META[e.kind];
                      return (
                        <li
                          key={e.id}
                          className="flex items-start gap-3 rounded-xl border border-crm-border/60 bg-crm-bg/20 px-3 py-2.5"
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dotClass} ${
                              e.kind === "task" && e.completed
                                ? "ring-2 ring-green-400"
                                : overdue
                                  ? "ring-2 ring-red-400"
                                  : ""
                            }`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setViewEntry(e)}
                              className="text-left text-sm font-medium text-crm-cream hover:underline"
                            >
                              {calendarEntryTitle(e)}
                            </button>
                            <p className="text-xs capitalize text-crm-muted">
                              {e.kind}
                              {e.kind === "meeting"
                                ? ` · ${e.startTime} · ${e.durationMinutes}m`
                                : e.kind === "task" && e.deadlineTime
                                  ? ` · due ${e.deadlineTime}`
                                  : e.kind === "contact"
                                    ? ` · ${e.scheduledTime}`
                                    : ""}
                            </p>
                          </div>
                          {e.kind === "task" ? (
                            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-crm-muted">
                              <input
                                type="checkbox"
                                checked={e.completed}
                                onChange={() => {
                                  setCalendarTaskCompleted(e.id, !e.completed);
                                }}
                                className="rounded border-crm-border"
                              />
                              Done
                            </label>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closePanels}
                    className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddStep("pick-kind")}
                    className="rounded-xl border border-crm-cream/40 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
                  >
                    Add entry
                  </button>
                </div>
              </>
            ) : null}

            {addStep === "pick-kind" ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-crm-muted">What are you adding?</p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["meeting", "Meeting"],
                      ["task", "Task"],
                      ["contact", "Contact follow-up"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setAddStep(kind)}
                      className="rounded-xl border border-crm-border/80 px-4 py-3 text-left text-sm font-medium text-crm-cream transition hover:bg-white/5"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddStep(null)}
                  className="text-sm text-crm-muted underline-offset-2 hover:underline"
                >
                  Back
                </button>
              </div>
            ) : null}

            {addStep === "meeting" && selectedYmd ? (
              <MeetingForm
                dateYmd={selectedYmd}
                teamMembers={teamMembers}
                controlClass={controlClass}
                onCancel={() => setAddStep(null)}
                onSaved={() => {
                  setAddStep(null);
                }}
              />
            ) : null}

            {addStep === "task" && selectedYmd ? (
              <CalendarTaskForm
                dateYmd={selectedYmd}
                teamMembers={teamMembers}
                controlClass={controlClass}
                cancelLabel="Back"
                onCancel={() => setAddStep(null)}
                onSaved={() => {
                  setAddStep(null);
                }}
              />
            ) : null}

            {addStep === "contact" && selectedYmd ? (
              <ContactForm
                dateYmd={selectedYmd}
                teamMembers={teamMembers}
                contacts={contacts}
                controlClass={controlClass}
                onCancel={() => setAddStep(null)}
                onSaved={() => {
                  setAddStep(null);
                }}
              />
            ) : null}

            {viewEntry ? (
              <ViewEntryPanel
                entry={viewEntry}
                contacts={contacts}
                teamMembers={teamMembers}
                todayYmd={todayYmd}
                onClose={() => setViewEntry(null)}
                onDelete={() => {
                  removeCalendarEntry(viewEntry.id);
                  setViewEntry(null);
                }}
                onToggleTask={(id, done) => {
                  setCalendarTaskCompleted(id, done);
                  const next = readCalendarEntriesRaw();
                  const list = parseCalendarEntries(next);
                  const u = list.find((x) => x.id === id);
                  if (u) setViewEntry(u);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MeetingForm({
  dateYmd,
  teamMembers,
  controlClass,
  onCancel,
  onSaved,
}: {
  dateYmd: string;
  teamMembers: CompanyPerson[];
  controlClass: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const alertOpts = useAlertSelectOptions();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"online" | "in_person">("in_person");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [assignAll, setAssignAll] = useState(true);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [alert1, setAlert1] = useState("none");
  const [alert2, setAlert2] = useState("none");

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startTime) return;
    if (!assignAll && teamMembers.length > 0 && assigneeIds.length === 0) {
      window.alert(
        "Select at least one team member, or enable “All team members”.",
      );
      return;
    }
    const base = {
      id: newCalendarEntryId(),
      date: dateYmd,
      assignAll,
      assigneeIds: assignAll ? [] : assigneeIds,
      alert1: decodeAlert(alert1),
      alert2: decodeAlert(alert2),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const row: CalendarMeetingEntry = {
      ...base,
      kind: "meeting",
      name: name.trim(),
      mode,
      locationOrLink: locationOrLink.trim(),
      startTime,
      durationMinutes,
    };
    upsertCalendarEntry(row);
    onSaved();
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <p className="text-sm font-medium text-crm-cream">New meeting</p>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Name</span>
        <input
          className={controlClass}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          required
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs text-crm-muted">Location</legend>
        <label className="flex items-center gap-2 text-sm text-crm-cream">
          <input
            type="radio"
            name="meet-mode"
            checked={mode === "in_person"}
            onChange={() => setMode("in_person")}
          />
          In person
        </label>
        <label className="flex items-center gap-2 text-sm text-crm-cream">
          <input
            type="radio"
            name="meet-mode"
            checked={mode === "online"}
            onChange={() => setMode("online")}
          />
          Online
        </label>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">
          {mode === "online" ? "Meeting link" : "Address"}
        </span>
        <input
          className={controlClass}
          value={locationOrLink}
          onChange={(ev) => setLocationOrLink(ev.target.value)}
          placeholder={
            mode === "online" ? "https://…" : "Street, room, postcode…"
          }
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-crm-muted">Start time</span>
          <input
            type="time"
            className={controlClass}
            value={startTime}
            onChange={(ev) => setStartTime(ev.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-crm-muted">Duration</span>
          <select
            className={controlClass}
            value={durationMinutes}
            onChange={(ev) =>
              setDurationMinutes(Number.parseInt(ev.target.value, 10))
            }
          >
            {[15, 30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <AssignBlock
        teamMembers={teamMembers}
        assignAll={assignAll}
        setAssignAll={setAssignAll}
        assigneeIds={assigneeIds}
        toggleAssignee={toggleAssignee}
      />
      <AlertRow
        label="Alert"
        value={alert1}
        onChange={setAlert1}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <AlertRow
        label="Second alert"
        value={alert2}
        onChange={setAlert2}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded-xl border border-crm-cream/40 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm"
        >
          Save
        </button>
      </div>
    </form>
  );
}

function ContactForm({
  dateYmd,
  teamMembers,
  contacts,
  controlClass,
  onCancel,
  onSaved,
}: {
  dateYmd: string;
  teamMembers: CompanyPerson[];
  contacts: ManualContact[];
  controlClass: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const alertOpts = useAlertSelectOptions();
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<"phone" | "text" | "email">("phone");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [linkMode, setLinkMode] = useState<"existing" | "new">("existing");
  const [linkedId, setLinkedId] = useState("");
  const [nf, setNf] = useState("");
  const [nl, setNl] = useState("");
  const [ne, setNe] = useState("");
  const [np, setNp] = useState("");
  const [assignAll, setAssignAll] = useState(true);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [alert1, setAlert1] = useState("none");
  const [alert2, setAlert2] = useState("none");

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !scheduledTime) return;
    if (!assignAll && teamMembers.length > 0 && assigneeIds.length === 0) {
      window.alert(
        "Select at least one team member, or enable “All team members”.",
      );
      return;
    }

    let linkedContactId: string | null = null;
    if (linkMode === "existing") {
      if (!linkedId) return;
      linkedContactId = linkedId;
    } else {
      if (!ne.trim()) return;
      linkedContactId = appendManualContact({
        kind: "customer",
        firstName: nf.trim(),
        lastName: nl.trim(),
        email: ne.trim(),
        phone: np.trim(),
        jobTitle: "",
      });
    }

    const base = {
      id: newCalendarEntryId(),
      date: dateYmd,
      assignAll,
      assigneeIds: assignAll ? [] : assigneeIds,
      alert1: decodeAlert(alert1),
      alert2: decodeAlert(alert2),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const row: CalendarContactEntry = {
      ...base,
      kind: "contact",
      title: title.trim(),
      channel,
      scheduledTime,
      notes: notes.trim(),
      linkedContactId,
    };
    upsertCalendarEntry(row);
    if (linkedContactId) {
      appendManualContactHistory(
        linkedContactId,
        buildContactHistoryNote(row),
      );
    }
    onSaved();
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <p className="text-sm font-medium text-crm-cream">Contact follow-up</p>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Title</span>
        <input
          className={controlClass}
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Channel</span>
        <select
          className={controlClass}
          value={channel}
          onChange={(ev) =>
            setChannel(ev.target.value as "phone" | "text" | "email")
          }
        >
          <option value="phone">Phone</option>
          <option value="text">Text</option>
          <option value="email">Email</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Time</span>
        <input
          type="time"
          className={controlClass}
          value={scheduledTime}
          onChange={(ev) => setScheduledTime(ev.target.value)}
          required
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs text-crm-muted">Contact</legend>
        <label className="flex items-center gap-2 text-sm text-crm-cream">
          <input
            type="radio"
            name="contact-link"
            checked={linkMode === "existing"}
            onChange={() => setLinkMode("existing")}
          />
          Link existing
        </label>
        <label className="flex items-center gap-2 text-sm text-crm-cream">
          <input
            type="radio"
            name="contact-link"
            checked={linkMode === "new"}
            onChange={() => setLinkMode("new")}
          />
          Add new contact
        </label>
      </fieldset>
      {linkMode === "existing" ? (
        <label className="block">
          <span className="mb-1 block text-xs text-crm-muted">Contact</span>
          <select
            className={controlClass}
            value={linkedId}
            onChange={(ev) => setLinkedId(ev.target.value)}
            required
          >
            <option value="">Select…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactDisplayName(c)} ({c.email})
              </option>
            ))}
          </select>
          {contacts.length === 0 ? (
            <span className="mt-1 block text-xs text-amber-200/90">
              No contacts yet — add one under Contacts or choose “Add new”.
            </span>
          ) : null}
        </label>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-crm-muted">Email</span>
            <input
              className={controlClass}
              type="email"
              value={ne}
              onChange={(ev) => setNe(ev.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-crm-muted">First name</span>
            <input
              className={controlClass}
              value={nf}
              onChange={(ev) => setNf(ev.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-crm-muted">Last name</span>
            <input
              className={controlClass}
              value={nl}
              onChange={(ev) => setNl(ev.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-crm-muted">Phone</span>
            <input
              className={controlClass}
              value={np}
              onChange={(ev) => setNp(ev.target.value)}
            />
          </label>
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-crm-muted">Notes</span>
        <textarea
          className={`${controlClass} min-h-[72px] resize-y`}
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          rows={3}
        />
      </label>
      <AssignBlock
        teamMembers={teamMembers}
        assignAll={assignAll}
        setAssignAll={setAssignAll}
        assigneeIds={assigneeIds}
        toggleAssignee={toggleAssignee}
      />
      <AlertRow
        label="Alert"
        value={alert1}
        onChange={setAlert1}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <AlertRow
        label="Second alert"
        value={alert2}
        onChange={setAlert2}
        alertOpts={alertOpts}
        controlClass={controlClass}
      />
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-muted transition hover:bg-white/5"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded-xl border border-crm-cream/40 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm"
        >
          Save
        </button>
      </div>
    </form>
  );
}

function ViewEntryPanel({
  entry,
  contacts,
  teamMembers,
  todayYmd,
  onClose,
  onDelete,
  onToggleTask,
}: {
  entry: CalendarEntry;
  contacts: ManualContact[];
  teamMembers: CompanyPerson[];
  todayYmd: string;
  onClose: () => void;
  onDelete: () => void;
  onToggleTask: (id: string, done: boolean) => void;
}) {
  const overdue = isCalendarEntryOverdue(entry, todayYmd);
  const assigneeLabel =
    entry.assignAll || entry.assigneeIds.length === 0
      ? "Everyone"
      : entry.assigneeIds
          .map(
            (id) => teamMembers.find((p) => p.id === id)?.name ?? id,
          )
          .join(", ");
  const linked =
    entry.kind === "contact" && entry.linkedContactId
      ? contacts.find((c) => c.id === entry.linkedContactId)
      : null;

  return (
    <div className="mt-4 space-y-3 border-t border-crm-border/40 pt-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-crm-cream">
            {calendarEntryTitle(entry)}
          </h4>
          <p className="text-xs capitalize text-crm-muted">
            {entry.kind}
            {overdue ? " · overdue" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-crm-muted underline-offset-2 hover:underline"
        >
          Back to list
        </button>
      </div>

      {entry.kind === "meeting" ? (
        <dl className="space-y-1 text-sm text-crm-cream/90">
          <div>
            <dt className="text-xs text-crm-muted">When</dt>
            <dd>
              {entry.startTime} · {entry.durationMinutes} min
            </dd>
          </div>
          <div>
            <dt className="text-xs text-crm-muted">
              {entry.mode === "online" ? "Link" : "Address"}
            </dt>
            <dd className="break-words">{entry.locationOrLink || "—"}</dd>
          </div>
        </dl>
      ) : null}

      {entry.kind === "task" ? (
        <dl className="space-y-1 text-sm text-crm-cream/90">
          <div>
            <dt className="text-xs text-crm-muted">Description</dt>
            <dd className="whitespace-pre-wrap">{entry.description || "—"}</dd>
          </div>
          {entry.deadlineTime ? (
            <div>
              <dt className="text-xs text-crm-muted">Deadline</dt>
              <dd>{entry.deadlineTime}</dd>
            </div>
          ) : null}
          <label className="flex items-center gap-2 pt-1 text-sm text-crm-cream">
            <input
              type="checkbox"
              checked={entry.completed}
              onChange={() => onToggleTask(entry.id, !entry.completed)}
            />
            Mark complete
          </label>
        </dl>
      ) : null}

      {entry.kind === "contact" ? (
        <dl className="space-y-1 text-sm text-crm-cream/90">
          <div>
            <dt className="text-xs text-crm-muted">Channel & time</dt>
            <dd className="capitalize">
              {entry.channel} · {entry.scheduledTime}
            </dd>
          </div>
          {linked ? (
            <div>
              <dt className="text-xs text-crm-muted">Linked contact</dt>
              <dd>{contactDisplayName(linked)} · {linked.email}</dd>
            </div>
          ) : entry.linkedContactId ? (
            <div>
              <dt className="text-xs text-crm-muted">Linked contact</dt>
              <dd>Contact id: {entry.linkedContactId}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-crm-muted">Notes</dt>
            <dd className="whitespace-pre-wrap">{entry.notes || "—"}</dd>
          </div>
        </dl>
      ) : null}

      <div className="text-xs text-crm-muted">
        <p>
          Alert 1:{" "}
          {entry.alert1.type === "none"
            ? "None"
            : entry.alert1.type === "at_time"
              ? "At time"
              : `${entry.alert1.minutes} min before`}
        </p>
        <p>
          Alert 2:{" "}
          {entry.alert2.type === "none"
            ? "None"
            : entry.alert2.type === "at_time"
              ? "At time"
              : `${entry.alert2.minutes} min before`}
        </p>
        <p>Assigned: {assigneeLabel}</p>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/15"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete entry
      </button>
    </div>
  );
}
