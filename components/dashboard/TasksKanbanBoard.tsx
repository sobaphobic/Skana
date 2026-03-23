"use client";

import { CalendarTaskForm } from "@/components/dashboard/CalendarTaskForm";
import { CALENDAR_FORM_CONTROL_CLASS } from "@/components/dashboard/calendarFormShared";
import {
  type CalendarTaskEntry,
  type KanbanTaskColumn,
  classifyTaskKanbanColumn,
  entryMatchesMemberFilter,
  formatLocalYmd,
  formatTaskKanbanDueCaption,
  getCalendarTaskEntries,
  parseCalendarEntries,
  patchCalendarTask,
  readCalendarEntriesRaw,
  setCalendarTaskCompleted,
  subscribeCalendarEntries,
} from "@/lib/calendarSession";
import {
  parseCompanySession,
  readCompanySessionRaw,
  subscribeCompanySession,
} from "@/lib/skanaSession";
import type { CompanyPerson } from "@/lib/skanaSession";
import { GripVertical } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

type ColumnDef = {
  id: KanbanTaskColumn;
  title: string;
  hint: string;
};

const COLUMNS: ColumnDef[] = [
  {
    id: "tasks",
    title: "Tasks",
    hint: "Based on due date and time — more than 2 calendar days away.",
  },
  {
    id: "due_soon",
    title: "Due soon",
    hint: "Based on due date and time — within the next 2 calendar days.",
  },
  {
    id: "overdue",
    title: "Overdue",
    hint: "Past the due day or past the time on the due day.",
  },
  {
    id: "completed",
    title: "Completed",
    hint: "Check Done, drag here, or reopen. Stays 7 days then leaves the board (still on the calendar).",
  },
];

function compareTaskBySchedule(a: CalendarTaskEntry, b: CalendarTaskEntry): number {
  const c = a.date.localeCompare(b.date);
  if (c !== 0) return c;
  return (a.deadlineTime ?? "").localeCompare(b.deadlineTime ?? "");
}

function sortBucketTasks(
  col: KanbanTaskColumn,
  list: CalendarTaskEntry[],
): void {
  if (col === "completed") {
    list.sort((a, b) => {
      const ta = new Date(a.completedAt ?? a.createdAt).getTime();
      const tb = new Date(b.completedAt ?? b.createdAt).getTime();
      return tb - ta;
    });
    return;
  }
  list.sort(compareTaskBySchedule);
}

function bucketTasks(
  tasks: CalendarTaskEntry[],
  now: Date,
): Record<KanbanTaskColumn, CalendarTaskEntry[]> {
  const empty: Record<KanbanTaskColumn, CalendarTaskEntry[]> = {
    tasks: [],
    due_soon: [],
    overdue: [],
    completed: [],
  };
  for (const t of tasks) {
    const col = classifyTaskKanbanColumn(t, now);
    if (col) empty[col].push(t);
  }
  (Object.keys(empty) as KanbanTaskColumn[]).forEach((col) =>
    sortBucketTasks(col, empty[col]),
  );
  return empty;
}

export function TasksKanbanBoard() {
  const [now, setNow] = useState(() => new Date());
  const tick = useCallback(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 300_000);
    return () => window.clearInterval(id);
  }, []);

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
  const tasks = useMemo(() => {
    const all = parseCalendarEntries(calendarRaw);
    return getCalendarTaskEntries(all);
  }, [calendarRaw]);

  const [memberFilter, setMemberFilter] = useState<"all" | Set<string>>(
    "all",
  );
  const [addOpen, setAddOpen] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        entryMatchesMemberFilter(t, memberFilter),
      ),
    [tasks, memberFilter],
  );

  const buckets = useMemo(
    () => bucketTasks(filtered, now),
    [filtered, now],
  );

  const todayYmd = formatLocalYmd(now);

  function completeTaskFromDrop(taskId: string) {
    setCalendarTaskCompleted(taskId, true);
    tick();
  }

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

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-crm-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-crm-muted">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream md:text-3xl">
            Tasks
          </h1>
          <p className="mt-2 max-w-xl text-sm text-crm-muted">
            Same tasks as the dashboard calendar. Open columns follow each
            task&apos;s due date and time; you can only move a task to{" "}
            <strong className="font-medium text-crm-cream/90">Completed</strong>{" "}
            (or use Done). Edit dates on the calendar if you need to reschedule.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-xl border border-crm-cream/40 bg-crm-active/90 px-5 py-2.5 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
        >
          Add task
        </button>
      </div>

      {teamMembers.length > 0 ? (
        <div
          className="flex flex-col gap-2"
          role="group"
          aria-label="Filter by assignee"
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
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            role="region"
            aria-label={col.title}
            className={`flex min-h-[16rem] min-w-0 flex-col rounded-2xl border border-crm-border/70 bg-crm-elevated/20 px-4 pb-4 pt-3 transition ${
              dragTaskId && col.id === "completed"
                ? "ring-2 ring-crm-cream/35"
                : ""
            }`}
            onDragOver={(e) => {
              if (col.id !== "completed") return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              if (col.id !== "completed") return;
              e.preventDefault();
              const id = e.dataTransfer.getData("text/skana-task-id");
              if (!id) return;
              completeTaskFromDrop(id);
              setDragTaskId(null);
            }}
          >
            <div className="mb-2 border-b border-crm-border/40 px-1 pb-2">
              <h2 className="text-sm font-semibold text-crm-cream">
                {col.title}
              </h2>
              <p className="mt-0.5 text-[0.65rem] leading-snug text-crm-muted">
                {col.hint}
              </p>
              <p className="mt-1 text-xs text-crm-muted/80">
                {buckets[col.id].length}{" "}
                {buckets[col.id].length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2 pr-0.5">
              {buckets[col.id].map((t) => {
                const dueCaption =
                  col.id === "completed"
                    ? ""
                    : formatTaskKanbanDueCaption(t, now);
                const overdueTone =
                  col.id === "overdue" ||
                  dueCaption.includes("overdue") ||
                  dueCaption.includes("Due today — overdue");
                return (
                <article
                  key={t.id}
                  draggable={col.id !== "completed"}
                  onDragStart={(e) => {
                    if (col.id === "completed") return;
                    e.dataTransfer.setData("text/skana-task-id", t.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragTaskId(t.id);
                  }}
                  onDragEnd={() => setDragTaskId(null)}
                  className={`rounded-xl border border-crm-border/60 bg-crm-bg/40 p-3 ${
                    col.id === "completed"
                      ? ""
                      : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {col.id === "completed" ? (
                      <span
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden
                      />
                    ) : (
                    <GripVertical
                      className="mt-0.5 h-4 w-4 shrink-0 text-crm-muted"
                      aria-hidden
                    />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-crm-cream">
                        {t.title}
                      </p>
                      {dueCaption ? (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            overdueTone
                              ? "text-amber-200/95"
                              : "text-crm-cream/85"
                          }`}
                        >
                          {dueCaption}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[0.7rem] text-crm-muted">
                        {t.date}
                        {t.deadlineTime ? ` · ${t.deadlineTime}` : ""}
                      </p>
                      {t.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-crm-muted/90">
                          {t.description}
                        </p>
                      ) : null}
                      {col.id === "completed" && t.completedAt ? (
                        <p className="mt-1 text-[0.65rem] text-crm-muted">
                          Done{" "}
                          {new Date(t.completedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      ) : null}
                    </div>
                    {col.id !== "completed" ? (
                      <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={() => {
                            setCalendarTaskCompleted(t.id, !t.completed);
                            tick();
                          }}
                          className="rounded border-crm-border"
                        />
                        <span className="text-[0.6rem] text-crm-muted">Done</span>
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          patchCalendarTask(t.id, {
                            completed: false,
                            completedAt: null,
                          });
                          tick();
                        }}
                        className="shrink-0 text-[0.65rem] font-medium text-crm-cream underline-offset-2 hover:underline"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </article>
              );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-crm-muted">
        Today is <span className="text-crm-cream/90">{todayYmd}</span>. Open the
        dashboard calendar to see every task on its scheduled day.
      </p>

      {addOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tasks-add-title"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-crm-border bg-crm-sidebar p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="tasks-add-title"
              className="text-base font-semibold text-crm-cream"
            >
              New task
            </h2>
            <p className="mt-1 text-xs text-crm-muted">
              Set a due date and time so the task appears on the right calendar
              day and moves correctly on this board.
            </p>
            <CalendarTaskForm
              dateYmd={todayYmd}
              teamMembers={teamMembers}
              controlClass={CALENDAR_FORM_CONTROL_CLASS}
              requireDueDateAndTime
              onCancel={() => setAddOpen(false)}
              onSaved={() => {
                setAddOpen(false);
                tick();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
